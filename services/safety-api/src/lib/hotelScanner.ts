import { openai } from "@where2go/safety-openai";

export interface HotelSafetyResult {
  hotelName: string | null;
  overallScore: number;
  neighborhoodScore: number;
  soloFemaleScore: number;
  deadboltMentioned: boolean;
  summary: string;
  tips: string[];
}

const SYSTEM_PROMPT = `You are SafeTrip AI's hotel safety analyst for solo travelers, with special attention to solo female travelers.
Given a hotel name, address, or booking link, assess its safety using general knowledge of the property, brand, and neighborhood.
You must respond with a single JSON object and nothing else, matching this exact shape:
{
  "hotelName": string | null,        // best guess of the hotel's name, or null if it can't be inferred
  "overallScore": number,            // 0-100 overall safety score
  "neighborhoodScore": number,       // 0-100 safety of the surrounding neighborhood
  "soloFemaleScore": number,         // 0-100 suitability/safety for solo female travelers
  "deadboltMentioned": boolean,      // true if rooms are likely to have deadbolts / secondary locks
  "summary": string,                 // 2-3 sentence plain-language risk summary
  "tips": string[]                   // 3-5 short, specific, actionable safety tips for this stay
}
Be honest and specific. If you have limited information, give a conservative score and say so in the summary. Never refuse; always return the JSON.`;

function clampScore(value: unknown, fallback = 60): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function scanHotel(query: string): Promise<HotelSafetyResult> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Assess the safety of this hotel for a solo traveler: ${query}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("Empty response from AI scanner");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse AI scanner response");
  }

  const tips = Array.isArray(parsed.tips)
    ? parsed.tips.filter((t): t is string => typeof t === "string").slice(0, 5)
    : [];

  return {
    hotelName:
      typeof parsed.hotelName === "string" && parsed.hotelName.trim().length > 0
        ? parsed.hotelName.trim()
        : null,
    overallScore: clampScore(parsed.overallScore),
    neighborhoodScore: clampScore(parsed.neighborhoodScore),
    soloFemaleScore: clampScore(parsed.soloFemaleScore),
    deadboltMentioned: parsed.deadboltMentioned === true,
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : "Limited information was available for this property. Treat the score as a conservative estimate and take standard solo-travel precautions.",
    tips,
  };
}
