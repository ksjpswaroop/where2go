import type { PlanRequest } from "@where2go/schemas";
import type { ProfileData } from "@/components/mapchat/components/FamilyProfile";

const BUDGET_MAP: Record<string, number> = {
  "Free Outings Only": 0,
  "Under $50": 50,
  "Under $120": 120,
  "Premium / Flexible": 500,
};

const DRIVE_MAP: Record<string, number> = {
  "15 minutes": 15,
  "30 minutes": 30,
  "45 minutes": 45,
  "60 minutes+": 60,
};

const KID_AGES: Record<string, number[]> = {
  "Toddlers (0-4 years)": [3],
  "Kids (5-11 years)": [8],
  "Teens (12+ years)": [14],
  "No Kids / Adults Only": [],
};

const WEATHER_INDOOR: Record<string, "indoor" | "outdoor" | "either"> = {
  "Sunshine / Outdoors": "outdoor",
  "Rainy / Indoor Friendly": "indoor",
  "Flexible / Any Weather": "either",
};

const STYLE_INTERESTS: Record<string, string[]> = {
  "Parks & Playgrounds": ["parks", "playgrounds", "outdoors"],
  "Museums & Culture": ["museums", "culture", "indoor"],
  "Active Adventure": ["hiking", "adventure", "active"],
  "Scenic & Relaxing": ["scenic", "nature", "relaxing"],
  "Indoor Entertainment": ["indoor", "entertainment", "arcade"],
};

export type QuickPlanForm = {
  mood: string;
  costLevel: string;
  driveTime: string;
  kidAgeGroup: string;
  weatherPrep: string;
};

export function buildPlanRequestFromQuickForm(
  form: QuickPlanForm,
  profile: ProfileData,
  mapCenter: { lat: number; lng: number },
  queryText?: string,
): PlanRequest {
  const today = new Date().toISOString().slice(0, 10);
  const budget = BUDGET_MAP[form.costLevel] ?? profile.maxBudget;
  const driveMinutes = DRIVE_MAP[form.driveTime] ?? profile.maxDriveTime;
  const kidsAges = KID_AGES[form.kidAgeGroup] ?? [];
  const indoorOutdoor = WEATHER_INDOOR[form.weatherPrep] ?? "either";
  const interests = STYLE_INTERESTS[form.mood] ?? profile.preferences;

  return {
    queryText:
      queryText ??
      `Plan a ${form.mood.toLowerCase()} outing within ${form.driveTime} under ${form.costLevel} for ${form.kidAgeGroup}.`,
    location: {
      label: "Current map center",
      lat: mapCenter.lat,
      lng: mapCenter.lng,
    },
    date: today,
    party: {
      adults: profile.adultsCount,
      kidsAges: kidsAges.length ? kidsAges : profile.kidsCount > 0 ? [8] : [],
    },
    budgetMax: budget || profile.maxBudget,
    driveTimeMaxMinutes: driveMinutes,
    indoorOutdoorPreference: indoorOutdoor,
    mealNeeded: form.mood.includes("Food") ? "lunch" : "snack",
    accessibilityNeeds: [],
    interests,
    avoid: profile.avoidHighWind ? ["high wind", "exposed coastline"] : [],
  };
}

export function buildPlanRequestFromProfileAndText(
  text: string,
  profile: ProfileData,
  mapCenter: { lat: number; lng: number },
): PlanRequest {
  const today = new Date().toISOString().slice(0, 10);
  const kidsAges =
    profile.kidAgeGroup === "toddler"
      ? [3]
      : profile.kidAgeGroup === "kid"
        ? [8]
        : profile.kidAgeGroup === "teen"
          ? [14]
          : [];

  return {
    queryText: text,
    location: {
      label: "Current map center",
      lat: mapCenter.lat,
      lng: mapCenter.lng,
    },
    date: today,
    party: {
      adults: profile.adultsCount,
      kidsAges: kidsAges.length ? kidsAges : profile.kidsCount > 0 ? [8] : [],
    },
    budgetMax: profile.maxBudget,
    driveTimeMaxMinutes: profile.maxDriveTime,
    indoorOutdoorPreference: profile.preferSunny ? "either" : "indoor",
    mealNeeded: "snack",
    accessibilityNeeds: [],
    interests: profile.preferences,
    avoid: profile.warnAboutRain ? ["rain", "outdoor only"] : [],
  };
}

export function isPlanIntentMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("plan a") ||
    lower.includes("plan an") ||
    lower.includes("itinerary") ||
    lower.includes("day out") ||
    lower.includes("outing") ||
    lower.includes("weekend schedule") ||
    lower.includes("where2go outing") ||
    lower.includes("generate decision plan") ||
    lower.includes("structured display itinerary")
  );
}

export type FreeformParsedChoices = {
  style: string;
  budgetLimit: string;
  driveTime: string;
  kidAgeGroup: string;
  weatherPrep: string;
  customNotes: string;
};

function nearestBudgetLabel(budgetMax?: number): string {
  if (budgetMax == null) return "Under $120";
  if (budgetMax <= 0) return "Free Outings Only";
  if (budgetMax <= 50) return "Under $50";
  if (budgetMax <= 120) return "Under $120";
  return "Premium / Flexible";
}

function nearestDriveLabel(minutes?: number): string {
  if (minutes == null) return "30 minutes";
  if (minutes <= 15) return "15 minutes";
  if (minutes <= 30) return "30 minutes";
  if (minutes <= 45) return "45 minutes";
  return "60 minutes+";
}

function kidAgeGroupFromParty(kidsAges?: number[]): string {
  if (!kidsAges?.length) return "No Kids / Adults Only";
  const maxAge = Math.max(...kidsAges);
  if (maxAge <= 4) return "Toddlers (0-4 years)";
  if (maxAge <= 11) return "Kids (5-11 years)";
  return "Teens (12+ years)";
}

function weatherPrepFromPreference(pref?: "indoor" | "outdoor" | "either"): string {
  if (pref === "indoor") return "Rainy / Indoor Friendly";
  if (pref === "outdoor") return "Sunshine / Outdoors";
  return "Flexible / Any Weather";
}

function styleFromInterests(interests?: string[]): string {
  if (!interests?.length) return "Scenic & Relaxing";
  const joined = interests.join(" ").toLowerCase();
  if (/(museum|culture|art|gallery)/.test(joined)) return "Museums & Culture";
  if (/(park|playground|outdoor)/.test(joined)) return "Parks & Playgrounds";
  if (/(hike|adventure|active|sport)/.test(joined)) return "Active Adventure";
  if (/(indoor|arcade|entertainment|movie)/.test(joined)) return "Indoor Entertainment";
  return "Scenic & Relaxing";
}

export function mapParsedPlanToFreeformChoices(
  parsed: Partial<PlanRequest>,
  queryText?: string,
): FreeformParsedChoices {
  const notes: string[] = [];
  if (parsed.avoid?.length) notes.push(`Avoid: ${parsed.avoid.join(", ")}`);
  if (parsed.interests?.length) notes.push(`Interests: ${parsed.interests.join(", ")}`);
  if (parsed.mealNeeded && parsed.mealNeeded !== "none") {
    notes.push(`Meal: ${parsed.mealNeeded}`);
  }
  if (queryText?.trim()) notes.push(queryText.trim());

  return {
    style: styleFromInterests(parsed.interests),
    budgetLimit: nearestBudgetLabel(parsed.budgetMax),
    driveTime: nearestDriveLabel(parsed.driveTimeMaxMinutes),
    kidAgeGroup: kidAgeGroupFromParty(parsed.party?.kidsAges),
    weatherPrep: weatherPrepFromPreference(parsed.indoorOutdoorPreference),
    customNotes: notes.join(". "),
  };
}
