import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function syncTierToSafetyApi(userId: string, tier: string) {
  const safetyApi = process.env.SAFETY_API_URL ?? process.env.NEXT_PUBLIC_SAFETY_API_URL;
  const secret = process.env.SAFETY_API_INTERNAL_SECRET;
  if (!safetyApi || !secret) return;

  await fetch(`${safetyApi.replace(/\/$/, "")}/api/internal/subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ userId, subscriptionTier: tier }),
  }).catch(() => undefined);
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const stripe = new Stripe(secret);
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId ?? session.client_reference_id;
    const tier = session.metadata?.tier ?? "plus";
    if (userId) {
      await syncTierToSafetyApi(userId, tier);
    }
  }

  return NextResponse.json({ received: true });
}
