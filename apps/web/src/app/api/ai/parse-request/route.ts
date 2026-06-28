import { parseRequestWithAI } from "@where2go/providers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorFromUnknown } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParseRequestBody = z.object({
  queryText: z.string().trim().min(3).max(900),
});

export async function POST(request: Request) {
  try {
    const body = ParseRequestBody.parse(await request.json());
    const result = await parseRequestWithAI(body.queryText);
    return NextResponse.json(result);
  } catch (error) {
    return errorFromUnknown(error);
  }
}
