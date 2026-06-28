import { auth } from "@clerk/nextjs/server";
import { ProfileSchema } from "@where2go/schemas";
import { NextResponse } from "next/server";
import { errorFromUnknown } from "@/lib/api";
import { getProfile, saveProfile } from "@/lib/plan-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  const profileUserId = userId ?? "anonymous";
  const profile = await getProfile(profileUserId);
  return NextResponse.json({
    profile:
      profile ??
      ProfileSchema.parse({
        party: { adults: 2, kidsAges: [8, 11] },
        budgetDefault: 120,
        driveTimeDefaultMinutes: 30,
        interests: ["parks", "museums", "family"],
        avoid: ["crowded bars"],
      }),
    userId: profileUserId,
  });
}

export async function PUT(request: Request) {
  try {
    const { userId } = await auth();
    const profileUserId = userId ?? "anonymous";
    const profile = ProfileSchema.parse(await request.json());
    const result = await saveProfile(profileUserId, profile);
    return NextResponse.json(result);
  } catch (error) {
    return errorFromUnknown(error);
  }
}
