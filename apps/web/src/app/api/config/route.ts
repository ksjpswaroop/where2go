import { NextResponse } from "next/server";
import { hasGeminiKey } from "@/lib/mapchat/gemini-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envPresent(...keys: string[]) {
  return keys.some((k) => Boolean(process.env[k]?.trim()));
}

export async function GET() {
  const milestone0 = {
    googleMaps: envPresent(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
      "GOOGLE_MAPS_API_KEY",
      "GOOGLE_MAPS_PLATFORM_KEY",
    ),
    googleSearch: envPresent("GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID"),
    googleAi: hasGeminiKey() || envPresent("GOOGLE_AI_API_KEY"),
    ticketmaster: envPresent("TICKETMASTER_API_KEY"),
    clerk: envPresent("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"),
    safetyApi: envPresent("SAFETY_API_URL", "NEXT_PUBLIC_SAFETY_API_URL"),
    stripe: envPresent("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"),
    database: envPresent("DATABASE_URL"),
  };

  const readyCount = Object.values(milestone0).filter(Boolean).length;
  const total = Object.keys(milestone0).length;

  return NextResponse.json({
    hasGeminiKey: hasGeminiKey(),
    hasMapsKey: milestone0.googleMaps,
    milestone0,
    milestone0Ready: readyCount === total,
    milestone0Progress: `${readyCount}/${total}`,
  });
}
