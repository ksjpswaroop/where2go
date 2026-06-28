export type SubscriptionTier = "free" | "plus" | "pro";

export type PaidFeature =
  | "server_escalation"
  | "hotel_scanner"
  | "itinerary_timers"
  | "unlimited_plans";

const FEATURE_MIN_TIER: Record<PaidFeature, SubscriptionTier> = {
  server_escalation: "plus",
  hotel_scanner: "plus",
  itinerary_timers: "plus",
  unlimited_plans: "plus",
};

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  plus: 1,
  pro: 2,
};

export function tierAllowsFeature(
  tier: string | null | undefined,
  feature: PaidFeature,
): boolean {
  const current = (tier ?? "free") as SubscriptionTier;
  const required = FEATURE_MIN_TIER[feature];
  return TIER_RANK[current] >= TIER_RANK[required];
}

export function normalizeTier(raw: string | null | undefined): SubscriptionTier {
  if (raw === "plus" || raw === "pro") return raw;
  return "free";
}
