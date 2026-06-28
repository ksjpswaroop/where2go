import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getSharedPlan } from "@/lib/plan-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareToken: string }> },
) {
  const { shareToken } = await context.params;
  const shared = await getSharedPlan(shareToken);
  if (!shared) {
    return jsonError("SHARE_NOT_FOUND", "Shared plan was not found or has expired.", 404);
  }
  return NextResponse.json(shared);
}
