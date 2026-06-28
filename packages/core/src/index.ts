import type {
  Action,
  Candidate,
  CostEstimate,
  PlanOption,
  PlanRequest,
  PlanResponse,
  PlanStop,
  ProviderStatus,
  TimelineItem,
  WeatherSnapshot,
} from "@where2go/schemas";

type ScoredCandidate = {
  candidate: Candidate;
  score: number;
  cost: CostEstimate;
  driveMinutes: number;
};

type BuildPlanInput = {
  request: PlanRequest;
  candidates: Candidate[];
  weather?: WeatherSnapshot;
  providerStatus: ProviderStatus[];
  requestId?: string;
};

export class NoPlanCandidatesError extends Error {
  readonly code = "NO_CANDIDATES";
  readonly providerStatus: ProviderStatus[];

  constructor(providerStatus: ProviderStatus[]) {
    super("No real event or place candidates were returned by the configured providers.");
    this.name = "NoPlanCandidatesError";
    this.providerStatus = providerStatus;
  }
}

export function buildPlanResponse(input: BuildPlanInput): PlanResponse {
  const { request, candidates, weather, providerStatus } = input;
  const requestId = input.requestId ?? id("req");
  const activityCandidates = candidates.filter((candidate) => candidate.kind !== "food");
  const scored = activityCandidates
    .filter((candidate) => !matchesAvoidList(candidate, request.avoid))
    .map((candidate) => scoreCandidate(candidate, request, weather))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    throw new NoPlanCandidatesError(providerStatus);
  }

  const foodCandidates = candidates
    .filter((candidate) => candidate.kind === "food")
    .map((candidate) => scoreCandidate(candidate, request, weather))
    .sort((a, b) => b.score - a.score);

  const bestScored = scored[0];
  const bestFood = selectFoodStop(bestScored, foodCandidates, request);
  const bestPlan = createPlanOption({
    request,
    scored: bestScored,
    food: bestFood,
    weather,
    kind: "best",
  });

  const alternatives = buildAlternatives(scored.slice(1), foodCandidates, request, weather, bestPlan);
  const providerHadFailure = providerStatus.some((status) =>
    ["failed", "degraded", "not_configured"].includes(status.status),
  );

  return {
    requestId,
    planId: id("plan"),
    generatedAt: new Date().toISOString(),
    status: providerHadFailure ? "partial" : "ready",
    bestPlan,
    alternatives,
    weather,
    debug: {
      candidateCount: candidates.length,
      filteredCount: scored.length,
      providerStatus,
      aiStatus: [],
    },
  };
}

export function scoreCandidate(
  candidate: Candidate,
  request: PlanRequest,
  weather?: WeatherSnapshot,
): ScoredCandidate {
  const cost = estimateCost(candidate, request);
  const driveMinutes = estimateDriveMinutes(candidate, request);
  let score = 48;

  if (cost.max <= request.budgetMax) {
    score += 16;
  } else {
    const overBudgetRatio = (cost.max - request.budgetMax) / Math.max(request.budgetMax, 1);
    score -= Math.min(28, overBudgetRatio * 30);
  }

  if (driveMinutes <= request.driveTimeMaxMinutes) {
    score += 14;
  } else {
    score -= Math.min(24, (driveMinutes - request.driveTimeMaxMinutes) * 0.9);
  }

  if (candidate.rating) {
    score += Math.min(12, candidate.rating * 2.2);
  }

  if ((candidate.ratingCount ?? 0) > 100) {
    score += 4;
  }

  const interestMatches = request.interests.filter((interest) =>
    searchableText(candidate).includes(interest.toLowerCase()),
  ).length;
  score += Math.min(12, interestMatches * 4);

  if (
    request.indoorOutdoorPreference !== "either" &&
    candidate.indoorOutdoor === request.indoorOutdoorPreference
  ) {
    score += 9;
  }

  if (
    weather &&
    candidate.indoorOutdoor === "outdoor" &&
    !weather.isOutdoorFriendly
  ) {
    score -= 18;
  }

  const youngestKid = Math.min(...request.party.kidsAges, 99);
  const oldestKid = Math.max(...request.party.kidsAges, 0);
  if (candidate.ageMin !== undefined && youngestKid < candidate.ageMin) {
    score -= 10;
  }
  if (candidate.ageMax !== undefined && oldestKid > candidate.ageMax) {
    score -= 10;
  }

  if (candidate.startDateTime && request.homeByTime) {
    const eventStart = new Date(candidate.startDateTime).getTime();
    const homeBy = new Date(request.homeByTime).getTime();
    if (!Number.isNaN(eventStart) && !Number.isNaN(homeBy) && eventStart > homeBy) {
      score -= 35;
    }
  }

  return {
    candidate,
    score: Math.max(0, Math.min(100, Math.round(score))),
    cost,
    driveMinutes,
  };
}

function buildAlternatives(
  scored: ScoredCandidate[],
  foodCandidates: ScoredCandidate[],
  request: PlanRequest,
  weather: WeatherSnapshot | undefined,
  bestPlan: PlanOption,
): PlanOption[] {
  const used = new Set(bestPlan.stops.map((stop) => stop.id));
  const alternatives: PlanOption[] = [];
  const cheaper = scored
    .filter((item) => !used.has(item.candidate.id))
    .sort((a, b) => a.cost.max - b.cost.max || b.score - a.score)[0];

  if (cheaper) {
    alternatives.push(
      createPlanOption({
        request,
        scored: cheaper,
        food: selectFoodStop(cheaper, foodCandidates, request),
        weather,
        kind: "cheaper",
      }),
    );
    used.add(cheaper.candidate.id);
  }

  const rainOrLowEffort = scored
    .filter((item) => !used.has(item.candidate.id))
    .filter((item) =>
      weather?.isOutdoorFriendly === false
        ? item.candidate.indoorOutdoor !== "outdoor"
        : item.driveMinutes <= Math.max(15, request.driveTimeMaxMinutes * 0.75),
    )
    .sort((a, b) => b.score - a.score)[0];

  if (rainOrLowEffort) {
    alternatives.push(
      createPlanOption({
        request,
        scored: rainOrLowEffort,
        food: selectFoodStop(rainOrLowEffort, foodCandidates, request),
        weather,
        kind: "rain_or_low_effort",
      }),
    );
  }

  return alternatives.slice(0, 2);
}

function createPlanOption(input: {
  request: PlanRequest;
  scored: ScoredCandidate;
  food?: ScoredCandidate;
  weather?: WeatherSnapshot;
  kind: PlanOption["kind"];
}): PlanOption {
  const { request, scored, food, weather, kind } = input;
  const activity = scored.candidate;
  const cost = combineCosts(scored.cost, food?.cost);
  const totalDriveMinutes = scored.driveMinutes * 2 + (food ? 10 : 0);
  const timeline = buildTimeline(request, scored, food);
  const stops = buildStops(scored, food);
  const actions = mergeActions(activity.actions, [
    activity.location
      ? {
          type: "directions" as const,
          label: "Open directions",
          url: mapsDirectionsUrl(activity.location.lat, activity.location.lng),
        }
      : undefined,
    activity.url
      ? {
          type: activity.kind === "event" ? ("tickets" as const) : ("website" as const),
          label: activity.kind === "event" ? "View tickets" : "Open website",
          url: activity.url,
        }
      : undefined,
  ]);

  return {
    id: id("option"),
    kind,
    title: titleForKind(kind, activity.title),
    planType: activity.kind === "park" ? "park" : food ? "place_plus_food" : activity.kind,
    summary: summaryFor(activity, food, weather),
    estimatedTotalCost: cost,
    travel: {
      totalDriveMinutes,
      driveLimitSatisfied: scored.driveMinutes <= request.driveTimeMaxMinutes,
    },
    timeline,
    stops,
    actions,
    whyThisPlan: buildWhy(request, scored, food, weather, totalDriveMinutes),
    score: scored.score,
    providerSources: unique([activity.source, food?.candidate.source].filter(Boolean) as string[]),
  };
}

function buildTimeline(
  request: PlanRequest,
  activity: ScoredCandidate,
  food?: ScoredCandidate,
): TimelineItem[] {
  const leaveAt = getStartDate(request);
  const arriveAt = addMinutes(leaveAt, activity.driveMinutes);
  const activityEnd = addMinutes(arriveAt, activity.candidate.durationMinutes);
  const timeline: TimelineItem[] = [
    { time: formatTime(leaveAt), label: "Leave", kind: "travel" },
    {
      time: formatTime(arriveAt),
      label: `Arrive at ${activity.candidate.title}`,
      kind: "activity",
    },
    {
      time: formatTime(activityEnd),
      label: "Wrap up activity",
      kind: "buffer",
    },
  ];

  if (food) {
    const mealStart = addMinutes(activityEnd, 10);
    timeline.push({
      time: formatTime(mealStart),
      label: `${mealLabel(request)} at ${food.candidate.title}`,
      kind: "meal",
    });
    timeline.push({
      time: formatTime(addMinutes(mealStart, 60)),
      label: "Head home",
      kind: "return",
    });
  } else {
    timeline.push({
      time: formatTime(addMinutes(activityEnd, 10)),
      label: "Head home",
      kind: "return",
    });
  }

  return timeline;
}

function buildStops(activity: ScoredCandidate, food?: ScoredCandidate): PlanStop[] {
  const stops: PlanStop[] = [toStop(activity)];
  if (food) {
    stops.push(toStop(food));
  }
  return stops;
}

function toStop(scored: ScoredCandidate): PlanStop {
  const candidate = scored.candidate;
  return {
    id: candidate.id,
    title: candidate.title,
    kind: candidate.kind,
    address: candidate.address,
    location: candidate.location,
    startTime: candidate.startDateTime,
    endTime: candidate.endDateTime,
    durationMinutes: candidate.durationMinutes,
    cost: scored.cost,
    url: candidate.url,
    notes: candidate.description,
  };
}

function buildWhy(
  request: PlanRequest,
  scored: ScoredCandidate,
  food: ScoredCandidate | undefined,
  weather: WeatherSnapshot | undefined,
  totalDriveMinutes: number,
) {
  const candidate = scored.candidate;
  const reasons = [
    `Scores ${scored.score}/100 against your budget, drive, timing, and family constraints.`,
    `Estimated round-trip driving is ${totalDriveMinutes} minutes.`,
  ];

  if (scored.cost.max <= request.budgetMax) {
    reasons.push(`Estimated cost stays under your $${request.budgetMax} budget.`);
  }

  if (candidate.rating) {
    reasons.push(`Published rating is ${candidate.rating.toFixed(1)} out of 5.`);
  }

  if (weather && candidate.indoorOutdoor === "outdoor") {
    reasons.push(
      weather.isOutdoorFriendly
        ? `Weather looks workable for an outdoor plan: ${weather.summary}.`
        : `Outdoor weather is a risk today: ${weather.summary}.`,
    );
  }

  if (food) {
    reasons.push(`Adds a nearby ${request.mealNeeded} stop without changing the core plan.`);
  }

  const caveats: string[] = [];
  if (scored.cost.confidence !== "high") {
    caveats.push(scored.cost.note ?? "Provider did not publish exact pricing.");
  }
  if (scored.driveMinutes > request.driveTimeMaxMinutes) {
    caveats.push(`One-way drive estimate is above your ${request.driveTimeMaxMinutes}-minute target.`);
  }
  if (!candidate.startDateTime && candidate.kind === "event") {
    caveats.push("Event time was not published by the provider.");
  }

  return {
    headline: "Best fit from live provider data",
    reasons: unique(reasons).slice(0, 5),
    caveats: unique(caveats),
  };
}

function selectFoodStop(
  activity: ScoredCandidate,
  foodCandidates: ScoredCandidate[],
  request: PlanRequest,
) {
  if (request.mealNeeded === "none") {
    return undefined;
  }

  const remainingBudget = request.budgetMax - activity.cost.max;
  return foodCandidates
    .filter((food) => food.cost.max <= Math.max(remainingBudget, 0))
    .sort((a, b) => b.score - a.score)[0];
}

function estimateCost(candidate: Candidate, request: PlanRequest): CostEstimate {
  if (candidate.price) {
    return candidate.price;
  }

  const partySize = request.party.adults + request.party.kidsAges.length;
  if (candidate.kind === "park") {
    return {
      min: 0,
      max: 25,
      currency: "USD",
      confidence: "low",
      note: "Provider did not publish pricing; this is a conservative category estimate.",
    };
  }

  if (candidate.kind === "food") {
    return {
      min: partySize * 9,
      max: partySize * 22,
      currency: "USD",
      confidence: "low",
      note: "Restaurant provider did not publish menu pricing.",
    };
  }

  return {
    min: 0,
    max: Math.max(30, partySize * 24),
    currency: "USD",
    confidence: "low",
    note: "Provider did not publish exact pricing; check the linked source before buying.",
  };
}

function combineCosts(primary: CostEstimate, secondary?: CostEstimate): CostEstimate {
  if (!secondary) {
    return primary;
  }

  return {
    min: primary.min + secondary.min,
    max: primary.max + secondary.max,
    currency: primary.currency,
    confidence: [primary.confidence, secondary.confidence].includes("low")
      ? "low"
      : [primary.confidence, secondary.confidence].includes("medium")
        ? "medium"
        : "high",
    note: [primary.note, secondary.note].filter(Boolean).join(" "),
  };
}

function estimateDriveMinutes(candidate: Candidate, request: PlanRequest) {
  if (candidate.driveMinutes !== undefined) {
    return candidate.driveMinutes;
  }
  if (candidate.distanceMiles !== undefined) {
    return Math.max(5, Math.round(candidate.distanceMiles * 2.6));
  }
  return request.driveTimeMaxMinutes;
}

function titleForKind(kind: PlanOption["kind"], title: string) {
  if (kind === "cheaper") {
    return `Cheaper backup: ${title}`;
  }
  if (kind === "rain_or_low_effort") {
    return `Rain or low-effort backup: ${title}`;
  }
  return title;
}

function summaryFor(
  activity: Candidate,
  food: ScoredCandidate | undefined,
  weather: WeatherSnapshot | undefined,
) {
  const parts = [
    activity.description ?? `${activity.title} from ${activity.source}.`,
    food ? `Includes a nearby meal stop at ${food.candidate.title}.` : undefined,
    weather ? `Weather check: ${weather.summary}.` : undefined,
  ].filter(Boolean);
  return parts.join(" ");
}

function mealLabel(request: PlanRequest) {
  if (request.mealNeeded === "snack") {
    return "Snack";
  }
  return request.mealNeeded.charAt(0).toUpperCase() + request.mealNeeded.slice(1);
}

function getStartDate(request: PlanRequest) {
  const raw = request.startTime ?? `${request.date}T10:00:00`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return new Date();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function mergeActions(existing: Action[], additions: Array<Action | undefined>): Action[] {
  const seen = new Set<string>();
  return [...existing, ...additions]
    .filter((action): action is Action => Boolean(action))
    .filter((action) => {
      const key = `${action.type}:${action.url}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function mapsDirectionsUrl(lat: number, lng: number) {
  const destination = encodeURIComponent(`${lat},${lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

function matchesAvoidList(candidate: Candidate, avoid: string[]) {
  const text = searchableText(candidate);
  return avoid.some((term) => text.includes(term.toLowerCase()));
}

function searchableText(candidate: Candidate) {
  return [candidate.title, candidate.description, candidate.address, ...candidate.tags]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function id(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${random.replaceAll("-", "").slice(0, 16)}`;
}

export { planResponseToItinerary } from "./plan-to-itinerary";
export type { ItineraryData, ItineraryStop } from "./plan-to-itinerary";
