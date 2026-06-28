import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getPlan } from "@/lib/plan-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ planId: string }> },
) {
  const { planId } = await context.params;
  const plan = await getPlan(planId);
  if (!plan) {
    return jsonError("PLAN_NOT_FOUND", "Plan was not found.", 404);
  }
  return NextResponse.json(plan);
}
