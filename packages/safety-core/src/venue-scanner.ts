export type VenueSafetyInput = {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  category?: string;
};

export type VenueSafetyScore = {
  overallScore: number;
  neighborhoodScore: number;
  soloFemaleScore: number;
  summary: string;
  tips: string[];
};

/** Normalize hotel scanner scores to a 0–100 venue safety badge. */
export function normalizeVenueScore(raw: {
  overallScore?: number | null;
  neighborhoodScore?: number | null;
  soloFemaleScore?: number | null;
}): VenueSafetyScore {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const overall = clamp(raw.overallScore ?? 50);
  const neighborhood = clamp(raw.neighborhoodScore ?? overall);
  const soloFemale = clamp(raw.soloFemaleScore ?? neighborhood);
  return {
    overallScore: overall,
    neighborhoodScore: neighborhood,
    soloFemaleScore: soloFemale,
    summary: overall >= 70 ? "Generally safe" : overall >= 45 ? "Use caution" : "Higher risk",
    tips: [],
  };
}

export function venueSafetyBadgeLabel(score: number): "safe" | "caution" | "risk" {
  if (score >= 70) return "safe";
  if (score >= 45) return "caution";
  return "risk";
}
