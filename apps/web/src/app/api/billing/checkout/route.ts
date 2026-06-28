import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { errorFromUnknown, jsonError } from "@/lib/api";
import { getStripePriceId } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return jsonError("UNAUTHORIZED", "Sign in to upgrade.", 401);
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return jsonError("BILLING_NOT_CONFIGURED", "Stripe is not configured.", 503);
    }

    const body = (await request.json()) as { tier?: "plus" | "pro" };
    const tier = body.tier === "pro" ? "pro" : "plus";
    const priceId = getStripePriceId(tier);
    if (!priceId) {
      return jsonError("PRICE_NOT_CONFIGURED", `Missing Stripe price for ${tier}.`, 503);
    }

    const stripe = new Stripe(secret);
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
      client_reference_id: userId,
      metadata: { tier, userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return errorFromUnknown(error);
  }
}
