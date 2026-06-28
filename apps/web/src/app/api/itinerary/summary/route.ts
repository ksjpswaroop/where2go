import { NextResponse } from "next/server";
import { getGeminiClient, getGeminiModel, hasGeminiKey } from "@/lib/mapchat/gemini-tools";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = checkRateLimit(rateLimitKey(request, "itinerary-summary"), 20);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const { itinerary } = await request.json();

  if (!itinerary) {
    return NextResponse.json({ error: "Missing itinerary data in request body." }, { status: 400 });
  }

  if (!hasGeminiKey()) {
    return NextResponse.json(
      { error: "Gemini API Key is not configured. Set GOOGLE_AI_API_KEY in .env.local." },
      { status: 500 },
    );
  }

  try {
    const ai = getGeminiClient();
    const prompt = `Provide a friendly, concise summary of this outing itinerary:

Title: "${itinerary.title}"
Description: "${itinerary.description}"
Total Cost: "${itinerary.totalCostEstimate}"
Timeline:
${itinerary.timeline?.map((stop: { time: string; activity: string; locationName: string; duration: string }) => `- ${stop.time}: ${stop.activity} at ${stop.locationName} (${stop.duration})`).join("\n")}

Include total duration, cost overview, and 1-2 highlights. Keep under 150 words in Markdown.`;

    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
      config: {
        systemInstruction:
          "You are a local outing advisor generating clear, friendly itinerary summaries.",
      },
    });

    return NextResponse.json({ summary: response.text || "No summary could be generated." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate itinerary summary.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
