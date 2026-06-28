import { ShareRequestSchema } from "@where2go/schemas";
import { NextResponse } from "next/server";
import { errorFromUnknown, jsonError } from "@/lib/api";
import { createShare, getPlan } from "@/lib/plan-store";

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
    const body = ShareRequestSchema.parse(await request.json());
    const share = await createShare(planId, body);
    return NextResponse.json({
      ...share,
      url: `/share/${share.token}`,
    });
  } catch (error) {
    return errorFromUnknown(error);
  }
}
