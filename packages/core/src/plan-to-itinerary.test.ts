import { describe, expect, it } from "vitest";
import { planResponseToItinerary } from "./plan-to-itinerary";
import type { PlanResponse } from "@where2go/schemas";

const samplePlan: PlanResponse = {
  requestId: "req_test",
  planId: "plan_test",
  generatedAt: "2026-06-28T12:00:00.000Z",
  status: "ready",
  bestPlan: {
    id: "option_best",
    kind: "best",
    title: "Golden Gate Park Family Adventure",
    planType: "place_plus_food",
    summary: "A balanced outdoor afternoon with a snack stop.",
    estimatedTotalCost: { min: 45, max: 80, currency: "USD", confidence: "medium" },
    travel: { totalDriveMinutes: 24, driveLimitSatisfied: true },
    timeline: [
      { time: "10:00 AM", label: "Leave", kind: "travel" },
      { time: "10:20 AM", label: "Arrive at Golden Gate Park", kind: "activity" },
      { time: "12:00 PM", label: "Wrap up activity", kind: "buffer" },
      { time: "12:10 PM", label: "Snack at Park Cafe", kind: "meal" },
    ],
    stops: [
      {
        id: "stop_park",
        title: "Golden Gate Park",
        kind: "park",
        address: "Golden Gate Park, San Francisco, CA",
        location: { lat: 37.7694, lng: -122.4862 },
        durationMinutes: 100,
        cost: { min: 0, max: 0, currency: "USD", confidence: "high" },
      },
      {
        id: "stop_food",
        title: "Park Cafe",
        kind: "food",
        address: "123 Park Rd, San Francisco, CA",
        location: { lat: 37.77, lng: -122.48 },
        durationMinutes: 45,
        cost: { min: 20, max: 40, currency: "USD", confidence: "medium" },
      },
    ],
    actions: [
      {
        type: "directions",
        label: "Open directions",
        url: "https://www.google.com/maps/dir/?api=1&destination=37.7694,-122.4862",
      },
    ],
    whyThisPlan: {
      headline: "Best fit from live provider data",
      reasons: ["Scores 88/100 against your constraints.", "Estimated cost stays under budget."],
      caveats: [],
    },
    score: 88,
    providerSources: ["google-places"],
  },
  alternatives: [
    {
      id: "option_cheaper",
      kind: "cheaper",
      title: "Free playground outing",
      planType: "park",
      summary: "Zero-cost backup at a nearby playground.",
      estimatedTotalCost: { min: 0, max: 10, currency: "USD", confidence: "high" },
      travel: { totalDriveMinutes: 15, driveLimitSatisfied: true },
      timeline: [],
      stops: [],
      actions: [],
      whyThisPlan: { headline: "Cheaper option", reasons: ["Free admission"], caveats: [] },
      score: 72,
      providerSources: ["google-places"],
    },
    {
      id: "option_rain",
      kind: "rain_or_low_effort",
      title: "Indoor science museum",
      planType: "place",
      summary: "Rain-friendly indoor alternative.",
      estimatedTotalCost: { min: 30, max: 60, currency: "USD", confidence: "medium" },
      travel: { totalDriveMinutes: 18, driveLimitSatisfied: true },
      timeline: [],
      stops: [],
      actions: [],
      whyThisPlan: { headline: "Rain backup", reasons: ["Fully indoor"], caveats: [] },
      score: 75,
      providerSources: ["google-places"],
    },
  ],
  weather: {
    source: "open-meteo",
    summary: "Partly cloudy, 68F",
    isOutdoorFriendly: true,
    observedAt: "2026-06-28T12:00:00.000Z",
  },
  debug: {
    candidateCount: 5,
    filteredCount: 3,
    providerStatus: [],
    aiStatus: [],
    storage: "memory",
  },
};

describe("planResponseToItinerary", () => {
  it("maps plan title and cost range", () => {
    const itinerary = planResponseToItinerary(samplePlan);
    expect(itinerary.title).toBe("Golden Gate Park Family Adventure");
    expect(itinerary.totalCostEstimate).toBe("$45 - $80");
  });

  it("maps timeline stops with coordinates", () => {
    const itinerary = planResponseToItinerary(samplePlan);
    expect(itinerary.timeline.length).toBeGreaterThan(0);
    const parkStop = itinerary.timeline.find((s) => s.locationName.includes("Golden Gate"));
    expect(parkStop?.lat).toBeCloseTo(37.7694);
    expect(parkStop?.lng).toBeCloseTo(-122.4862);
  });

  it("maps alternatives to cheaper and rain backup fields", () => {
    const itinerary = planResponseToItinerary(samplePlan);
    expect(itinerary.cheaperAlternative.title).toBe("Free playground outing");
    expect(itinerary.rainBackup.title).toBe("Indoor science museum");
  });

  it("includes whyThisPlan text and directions link", () => {
    const itinerary = planResponseToItinerary(samplePlan);
    expect(itinerary.whyThisPlan).toContain("Best fit from live provider data");
    expect(itinerary.directionsLink).toContain("google.com/maps");
  });
});
