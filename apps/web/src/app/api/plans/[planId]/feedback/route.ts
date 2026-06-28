import { FeedbackRequestSchema } from "@where2go/schemas";
import { NextResponse } from "next/server";
import { errorFromUnknown, jsonError } from "@/lib/api";
import { getPlan, saveFeedback } from "@/lib/plan-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ planId: string }> },
) {
  try {
    const { planId } = await context.params;
    const plan = await getPlan(planId);
    if (!plan) {
      return jsonError("PLAN_NOT_FOUND", "Plan was not found.", 404);
    }
    const body = FeedbackRequestSchema.parse(await request.json());
    const result = await saveFeedback(planId, body);
    const feltUnsafe = /unsafe|sketchy|uncomfortable/i.test(body.reason ?? body.freeText ?? "");
    const tooCrowded = /crowd|packed|busy/i.test(body.reason ?? body.freeText ?? "");
    return NextResponse.json({
      ...result,
      updatedPreferenceSignals: body.reason ? [body.reason] : [],
      venueRiskAdjustment: feltUnsafe || tooCrowded ? { feltUnsafe, tooCrowded } : null,
    });
  } catch (error) {
    return errorFromUnknown(error);
  }
}
