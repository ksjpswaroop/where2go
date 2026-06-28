import {
  applyVenueRiskToScore,
  computeVenueRiskAdjustment,
  normalizeVenueScore,
  venueSafetyBadgeLabel,
} from "@where2go/safety-core";
import type { PlanResponse, VenueSafetyBadge } from "@where2go/schemas";

function heuristicVenueScore(title: string, tags: string[] = []): VenueSafetyBadge {
  const lower = `${title} ${tags.join(" ")}`.toLowerCase();
  let base = 72;
  if (/bar|club|night|casino/.test(lower)) base -= 18;
  if (/museum|library|zoo|park|aquarium/.test(lower)) base += 8;
  if (/hotel|hostel/.test(lower)) base -= 5;

  const normalized = normalizeVenueScore({ overallScore: base });
  const adjustment = computeVenueRiskAdjustment({
    venueId: title,
    feltUnsafe: /unsafe|sketchy/.test(lower),
    tooCrowded: /crowded|festival/.test(lower),
  });
  const overallScore = applyVenueRiskToScore(normalized.overallScore, adjustment);

  return {
    overallScore,
    label: venueSafetyBadgeLabel(overallScore),
    soloFemaleScore: applyVenueRiskToScore(normalized.soloFemaleScore, adjustment),
  };
}

export function enrichPlanWithVenueSafety(plan: PlanResponse): PlanResponse {
  const enrichStops = (stops: PlanResponse["bestPlan"]["stops"]) =>
    stops.map((stop) => ({
      ...stop,
      safetyBadge: stop.safetyBadge ?? heuristicVenueScore(stop.title, []),
    }));

  return {
    ...plan,
    bestPlan: {
      ...plan.bestPlan,
      stops: enrichStops(plan.bestPlan.stops),
    },
    alternatives: plan.alternatives.map((alt) => ({
      ...alt,
      stops: enrichStops(alt.stops),
    })),
  };
}
