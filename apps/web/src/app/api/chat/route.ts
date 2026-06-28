import { planResponseToItinerary } from "@where2go/core";
import { NextResponse } from "next/server";
import {
  addMarkersTool,
  clearMapTool,
  drawRouteTool,
  generatePlanTool,
  getGeminiClient,
  getGeminiModelForChat,
  hasGeminiKey,
  setMapViewTool,
} from "@/lib/mapchat/gemini-tools";
import { generatePlanFromRequest, NoPlanCandidatesError } from "@/lib/mapchat/generate-plan";
import {
  buildPlanRequestFromProfileAndText,
  isPlanIntentMessage,
} from "@/lib/mapchat/plan-request";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEWS_FILE = path.join(process.cwd(), "data", "reviews.json");

function getLocalReviews() {
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      return JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf-8")) as Array<{
        locationName: string;
        rating: number;
        comment: string;
        username: string;
      }>;
    }
  } catch {
    return [];
  }
  return [];
}

function buildReviewsContext() {
  const localReviews = getLocalReviews();
  if (localReviews.length === 0) return "";

  const grouped: Record<string, { ratings: number[]; comments: string[] }> = {};
  for (const r of localReviews) {
    if (!grouped[r.locationName]) grouped[r.locationName] = { ratings: [], comments: [] };
    grouped[r.locationName].ratings.push(r.rating);
    if (r.comment) grouped[r.locationName].comments.push(`- "${r.comment}" (by ${r.username})`);
  }

  let context = "\n\nLOCAL USER REVIEWS:\n";
  for (const [locName, data] of Object.entries(grouped)) {
    const avg = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
    context += `- "${locName}" avg ${avg.toFixed(1)}/5 (${data.ratings.length} reviews)\n`;
  }
  return context;
}

function buildProfileContext(profile: Record<string, unknown> | undefined) {
  if (!profile) return "";
  return `
USER PROFILE:
- Adults: ${profile.adultsCount ?? 2}, Kids: ${profile.kidsCount ?? 0}
- Max drive: ${profile.maxDriveTime ?? 30} min, Budget: $${profile.maxBudget ?? 120}
- Preferences: ${Array.isArray(profile.preferences) ? profile.preferences.join(", ") : "none"}
`;
}

export async function POST(request: Request) {
  const limit = checkRateLimit(rateLimitKey(request, "chat"), 30);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  const { messages, mapCenter, searchMode, profile } = await request.json();

  if (!messages?.length) {
    return NextResponse.json({ error: "Missing messages." }, { status: 400 });
  }

  const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  const lastText = lastUserMessage?.content ?? "";

  if (isPlanIntentMessage(lastText) && mapCenter) {
    try {
      const planRequest = buildPlanRequestFromProfileAndText(lastText, profile, mapCenter);
      const planResponse = await generatePlanFromRequest(planRequest);
      const itinerary = planResponseToItinerary(planResponse);

      const markers = itinerary.timeline
        .filter((stop) => stop.lat && stop.lng)
        .map((stop) => ({
          lat: stop.lat!,
          lng: stop.lng!,
          title: stop.locationName,
          address: stop.address || "",
          category: "Itinerary Stop",
        }));

      return NextResponse.json({
        text: `I've built a real provider-backed plan: **${itinerary.title}**. Estimated cost: ${itinerary.totalCostEstimate}. Check the Itinerary tab for the full timeline and alternatives.`,
        groundingChunks: [],
        functionCalls: markers.length
          ? [{ name: "add_markers", args: { markers, focusCenter: true, zoom: 13 } }]
          : [],
        planResponse,
        itinerary,
      });
    } catch (error) {
      if (error instanceof NoPlanCandidatesError) {
        return jsonError(
          error.code,
          "No real events or places were returned. Configure provider API keys or broaden your search.",
          424,
          { providerStatus: error.providerStatus },
        );
      }
    }
  }

  if (!hasGeminiKey()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY / GOOGLE_AI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  try {
    const ai = getGeminiClient();
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const tools: Array<Record<string, unknown>> = [];
    if (searchMode === "maps") tools.push({ googleMaps: {} });
    else if (searchMode === "web") tools.push({ googleSearch: {} });

    tools.push({
      functionDeclarations: [
        addMarkersTool,
        drawRouteTool,
        setMapViewTool,
        clearMapTool,
        generatePlanTool,
      ],
    });

    const toolConfig: Record<string, unknown> = {};
    if (searchMode === "maps" || searchMode === "web") {
      // Required to combine googleMaps/googleSearch with custom function tools (Gemini 3+).
      toolConfig.includeServerSideToolInvocations = true;
    }
    if (mapCenter && searchMode === "maps") {
      toolConfig.retrievalConfig = {
        latLng: { latitude: mapCenter.lat, longitude: mapCenter.lng },
      };
    }

    const systemInstruction = `You are Where2Go AI, a constraint-aware local outing planner.
${buildProfileContext(profile)}
${buildReviewsContext()}

When the user requests a plan or itinerary, call generate_plan with their request text.
For exploratory questions, use add_markers, draw_route, set_map_view, or clear_map.
Do not invent plans yourself — use generate_plan for outing recommendations.
Current map center: ${mapCenter ? `${mapCenter.lat}, ${mapCenter.lng}` : "unknown"}.`;

    const response = await ai.models.generateContent({
      model: getGeminiModelForChat(searchMode),
      contents,
      config: {
        systemInstruction,
        tools: tools as never,
        ...(Object.keys(toolConfig).length > 0 ? { toolConfig: toolConfig as never } : {}),
      },
    });

    const functionCalls = response.functionCalls || [];
    let planResponse = null;

    for (const call of functionCalls) {
      if (call.name === "generate_plan" && mapCenter) {
        const queryText = String((call.args as { queryText?: string })?.queryText || lastText);
        try {
          const planRequest = buildPlanRequestFromProfileAndText(queryText, profile, mapCenter);
          planResponse = await generatePlanFromRequest(planRequest);
        } catch (error) {
          if (error instanceof NoPlanCandidatesError) {
            return jsonError(
              error.code,
              "No real events or places were returned. Configure provider API keys or broaden your search.",
              424,
              { providerStatus: error.providerStatus },
            );
          }
          throw error;
        }
      }
    }

    const mapFunctionCalls = functionCalls.filter((c) => c.name !== "generate_plan");

    if (planResponse) {
      const itinerary = planResponseToItinerary(planResponse);
      const markers = itinerary.timeline
        .filter((stop) => stop.lat && stop.lng)
        .map((stop) => ({
          lat: stop.lat!,
          lng: stop.lng!,
          title: stop.locationName,
          address: stop.address || "",
          category: "Itinerary Stop",
        }));

      if (markers.length > 0) {
        mapFunctionCalls.push({ name: "add_markers", args: { markers, focusCenter: true, zoom: 13 } });
      }

      return NextResponse.json({
        text:
          response.text ||
          `Plan ready: **${itinerary.title}**. See the Itinerary tab for details.`,
        groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
        functionCalls: mapFunctionCalls,
        planResponse,
        itinerary,
      });
    }

    return NextResponse.json({
      text: response.text || "No response received.",
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
      functionCalls: mapFunctionCalls,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An error occurred while communicating with Gemini.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
