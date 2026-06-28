import { parseRequestWithAI } from "@where2go/providers";
import { NextResponse } from "next/server";
import { mapParsedPlanToFreeformChoices } from "@/lib/mapchat/plan-request";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = checkRateLimit(rateLimitKey(request, "parse-choices"), 20);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  const { freeFormText } = await request.json();

  if (!freeFormText || typeof freeFormText !== "string") {
    return NextResponse.json({ error: "Missing or invalid freeFormText parameter." }, { status: 400 });
  }

  try {
    const { parsed, providerStatus } = await parseRequestWithAI(freeFormText.trim());
    if (!parsed) {
      const failed = providerStatus.find((p) => p.status === "failed");
      return NextResponse.json(
        {
          error:
            failed?.message ??
            "Could not parse preferences. Configure an AI provider key (GOOGLE_AI_API_KEY or OPENAI_API_KEY).",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(mapParsedPlanToFreeformChoices(parsed, freeFormText.trim()));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to parse free-form text preferences.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
