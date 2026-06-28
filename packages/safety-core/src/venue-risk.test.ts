import { describe, expect, it } from "vitest";
import { suggestTimersForItinerary } from "./itinerary-timers";
import { applyVenueRiskToScore, computeVenueRiskAdjustment } from "./venue-risk";
import { normalizeVenueScore, venueSafetyBadgeLabel } from "./venue-scanner";

describe("safety-core", () => {
  it("suggests timers for itinerary stops", () => {
    const timers = suggestTimersForItinerary([
      { id: "1", title: "Museum", arriveBy: "2:00 PM", durationMinutes: 60 },
    ]);
    expect(timers).toHaveLength(1);
    expect(timers[0]?.label).toContain("Museum");
  });

  it("computes venue risk adjustments from feedback signals", () => {
    const delta = computeVenueRiskAdjustment({
      venueId: "x",
      feltUnsafe: true,
      tooCrowded: true,
    });
    expect(delta).toBeLessThan(0);
    expect(applyVenueRiskToScore(80, delta)).toBeLessThan(80);
  });

  it("normalizes venue scores and labels", () => {
    const score = normalizeVenueScore({ overallScore: 75 });
    expect(score.overallScore).toBe(75);
    expect(venueSafetyBadgeLabel(75)).toBe("safe");
  });
});
