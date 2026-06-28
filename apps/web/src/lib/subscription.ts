import type { SubscriptionTier } from "@where2go/schemas";

export type PaidFeature = "unlimited_plans" | "leave_now_alerts" | "group_planning";

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  plus: 1,
  pro: 2,
};

const FEATURE_MIN: Record<PaidFeature, SubscriptionTier> = {
  unlimited_plans: "plus",
  leave_now_alerts: "plus",
  group_planning: "pro",
};

export function tierAllows(tier: SubscriptionTier, feature: PaidFeature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN[feature]];
}

export const FREE_PLANS_PER_WEEK = 3;

export function getStripePriceId(tier: "plus" | "pro"): string | null {
  if (tier === "plus") return process.env.STRIPE_PRICE_PLUS ?? null;
  if (tier === "pro") return process.env.STRIPE_PRICE_PRO ?? null;
  return null;
}
