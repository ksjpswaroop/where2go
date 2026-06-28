import { getProviderHealth } from "@where2go/providers";
import { NextResponse } from "next/server";
import { storageMode } from "@/lib/plan-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    storage: storageMode(),
    providers: getProviderHealth(),
  });
}
