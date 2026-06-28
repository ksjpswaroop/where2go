import { NextResponse } from "next/server";
import { NoPlanCandidatesError } from "@where2go/core";
import { errorFromUnknown, jsonError } from "@/lib/api";
import { generatePlanFromRequest } from "@/lib/mapchat/generate-plan";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = checkRateLimit(rateLimitKey(request, "plans-generate"), 20);
  if (!limit.allowed) {
    return jsonError("RATE_LIMITED", "Too many plan requests. Try again shortly.", 429);
  }

  try {
    const body = await request.json();
    const response = await generatePlanFromRequest(body);
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof NoPlanCandidatesError) {
      return jsonError(
        error.code,
        "No real events or places were returned. Add provider credentials or broaden the search.",
        424,
        { providerStatus: error.providerStatus },
      );
    }
    return errorFromUnknown(error);
  }
}
