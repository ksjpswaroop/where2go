import type { PlanOption, PlanResponse, PlanStop } from "@where2go/schemas";

export interface ItineraryStop {
  time: string;
  activity: string;
  duration: string;
  locationName: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface ItineraryData {
  title: string;
  description: string;
  whyThisPlan: string;
  totalCostEstimate: string;
  costBreakdown: {
    tickets: string;
    food: string;
    parking?: string;
    other?: string;
  };
  timeline: ItineraryStop[];
  cheaperAlternative: {
    title: string;
    description: string;
    cost: string;
  };
  rainBackup: {
    title: string;
    description: string;
  };
  foodNearby: {
    title: string;
    cuisine: string;
    distance: string;
    rating?: number;
  };
  bookingLink?: string;
  directionsLink?: string;
}

function formatCostRange(min: number, max: number, currency = "USD"): string {
  if (min === 0 && max === 0) return "Free";
  const symbol = currency === "USD" ? "$" : `${currency} `;
  if (min === max) return `${symbol}${Math.round(min)}`;
  return `${symbol}${Math.round(min)} - ${symbol}${Math.round(max)}`;
}

function formatDuration(minutes?: number): string {
  if (!minutes) return "1 hour";
  if (minutes < 60) return `${minutes} mins`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? "s" : ""}`;
}

function stopToTimelineItem(
  stop: PlanStop,
  timelineIndex: number,
  planTimeline: PlanResponse["bestPlan"]["timeline"],
): ItineraryStop {
  const activityItem = planTimeline.find((item) => item.kind === "activity" && timelineIndex === 0);
  const mealItem = planTimeline.find((item) => item.kind === "meal");
  const time =
    timelineIndex === 0
      ? activityItem?.time ?? stop.startTime ?? "TBD"
      : mealItem?.time ?? stop.startTime ?? "TBD";

  return {
    time,
    activity: stop.kind === "food" ? `Meal at ${stop.title}` : stop.title,
    duration: formatDuration(stop.durationMinutes),
    locationName: stop.title,
    address: stop.address,
    lat: stop.location?.lat,
    lng: stop.location?.lng,
  };
}

function buildTimelineFromPlan(plan: PlanOption): ItineraryStop[] {
  const stops = plan.stops.filter((stop) => stop.kind !== "food" || plan.stops.length === 1);
  const items: ItineraryStop[] = [];

  for (const item of plan.timeline) {
    const matchingStop =
      item.kind === "activity"
        ? plan.stops.find((s) => s.kind !== "food")
        : item.kind === "meal"
          ? plan.stops.find((s) => s.kind === "food")
          : undefined;

    if (item.kind === "travel" || item.kind === "buffer" || item.kind === "return") {
      items.push({
        time: item.time,
        activity: item.label,
        duration: item.kind === "travel" ? "15 mins" : "10 mins",
        locationName: item.label,
      });
      continue;
    }

    items.push({
      time: item.time,
      activity: item.label,
      duration: matchingStop ? formatDuration(matchingStop.durationMinutes) : "1 hour",
      locationName: matchingStop?.title ?? item.label.replace(/^Arrive at |^.* at /, ""),
      address: matchingStop?.address,
      lat: matchingStop?.location?.lat,
      lng: matchingStop?.location?.lng,
    });
  }

  if (items.length === 0) {
    return plan.stops.map((stop, index) => stopToTimelineItem(stop, index, plan.timeline));
  }

  return items;
}

function findAlternative(
  alternatives: PlanOption[],
  kind: "cheaper" | "rain_or_low_effort",
): PlanOption | undefined {
  return alternatives.find((alt) => alt.kind === kind);
}

function findFoodStop(plan: PlanOption): PlanStop | undefined {
  return plan.stops.find((stop) => stop.kind === "food");
}

function buildDirectionsLink(plan: PlanOption): string | undefined {
  const firstStop = plan.stops.find((s) => s.location);
  if (!firstStop?.location) return undefined;
  return `https://www.google.com/maps/dir/?api=1&destination=${firstStop.location.lat},${firstStop.location.lng}`;
}

function buildBookingLink(plan: PlanOption): string | undefined {
  return plan.actions.find((a) => a.type === "tickets" || a.type === "reserve")?.url;
}

export function planResponseToItinerary(response: PlanResponse): ItineraryData {
  const plan = response.bestPlan;
  const cheaper = findAlternative(response.alternatives, "cheaper");
  const rainBackup = findAlternative(response.alternatives, "rain_or_low_effort");
  const foodStop = findFoodStop(plan);
  const activityStop = plan.stops.find((s) => s.kind !== "food") ?? plan.stops[0];

  const cost = plan.estimatedTotalCost;
  const ticketsStop = plan.stops.find((s) => s.kind === "event" || s.kind === "place" || s.kind === "park");
  const ticketsCost = ticketsStop?.cost
    ? formatCostRange(ticketsStop.cost.min, ticketsStop.cost.max, ticketsStop.cost.currency)
    : "Varies";

  return {
    title: plan.title,
    description: plan.summary,
    whyThisPlan: [plan.whyThisPlan.headline, ...plan.whyThisPlan.reasons].join(" "),
    totalCostEstimate: formatCostRange(cost.min, cost.max, cost.currency),
    costBreakdown: {
      tickets: ticketsCost,
      food: foodStop?.cost
        ? formatCostRange(foodStop.cost.min, foodStop.cost.max, foodStop.cost.currency)
        : plan.planType.includes("food")
          ? formatCostRange(cost.min, cost.max, cost.currency)
          : "Not included",
      parking: "$0 - $15",
      other: cost.note ?? "None",
    },
    timeline: buildTimelineFromPlan(plan),
    cheaperAlternative: cheaper
      ? {
          title: cheaper.title,
          description: cheaper.summary,
          cost: formatCostRange(
            cheaper.estimatedTotalCost.min,
            cheaper.estimatedTotalCost.max,
            cheaper.estimatedTotalCost.currency,
          ),
        }
      : {
          title: "Free local park or playground",
          description: "Browse a nearby public park if you want a zero-cost backup.",
          cost: "Free",
        },
    rainBackup: rainBackup
      ? {
          title: rainBackup.title,
          description: rainBackup.summary,
        }
      : {
          title: "Indoor museum or library",
          description: "Switch to an indoor venue if weather turns unfavorable.",
        },
    foodNearby: foodStop
      ? {
          title: foodStop.title,
          cuisine: foodStop.kind === "food" ? "Restaurant" : "Dining",
          distance: `${plan.travel.totalDriveMinutes} min total travel`,
          rating: undefined,
        }
      : {
          title: activityStop?.title ?? "Nearby dining",
          cuisine: "Local options",
          distance: "Near main stop",
        },
    bookingLink: buildBookingLink(plan),
    directionsLink: buildDirectionsLink(plan),
  };
}
