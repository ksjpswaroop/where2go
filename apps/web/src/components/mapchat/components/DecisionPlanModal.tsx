"use client";

import { useEffect, useState } from "react";
import { Calendar, Loader2, MapPin, Sparkles, X } from "lucide-react";
import type { PlanRequest } from "@where2go/schemas";
import type { ProfileData } from "./FamilyProfile";

export type DecisionPlanForm = {
  date: string;
  stayLocation: string;
  interests: string[];
  customInterests: string;
  budget: string;
  driveTime: string;
  kidAgeGroup: string;
  adults: number;
  weatherPrep: string;
  mealNeeded: "none" | "snack" | "lunch" | "dinner";
  avoid: string;
  notes: string;
};

const INTEREST_OPTIONS = [
  "Parks & nature",
  "Museums & culture",
  "Food & cafes",
  "Active & hiking",
  "Family activities",
  "Events & shows",
  "Shopping",
  "Scenic views",
];

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

const WEATHER_MAP: Record<string, "indoor" | "outdoor" | "either"> = {
  "Sunshine / Outdoors": "outdoor",
  "Rainy / Indoor Friendly": "indoor",
  "Flexible / Any Weather": "either",
};

export function buildPlanRequestFromDecisionForm(
  form: DecisionPlanForm,
  profile: ProfileData,
  mapCenter: { lat: number; lng: number },
  locationLabel = "Current map center",
): PlanRequest {
  const interests = [
    ...form.interests,
    ...form.customInterests
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  const kidsAges = KID_AGES[form.kidAgeGroup] ?? [];
  const avoid = [
    ...form.avoid
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    ...(profile.warnAboutRain ? ["rain", "outdoor only"] : []),
    ...(profile.avoidHighWind ? ["high wind"] : []),
  ];

  const queryParts = [
    `Plan a day out on ${form.date}`,
    form.stayLocation ? `near ${form.stayLocation}` : "",
    interests.length ? `focused on ${interests.join(", ")}` : "",
    form.notes,
  ].filter(Boolean);

  return {
    queryText: queryParts.join(". ").slice(0, 900),
    location: {
      label: form.stayLocation.trim() || locationLabel,
      lat: mapCenter.lat,
      lng: mapCenter.lng,
    },
    date: form.date,
    party: {
      adults: form.adults,
      kidsAges: kidsAges.length ? kidsAges : profile.kidsCount > 0 ? [8] : [],
    },
    budgetMax: BUDGET_MAP[form.budget] ?? profile.maxBudget,
    driveTimeMaxMinutes: DRIVE_MAP[form.driveTime] ?? profile.maxDriveTime,
    indoorOutdoorPreference: WEATHER_MAP[form.weatherPrep] ?? "either",
    mealNeeded: form.mealNeeded,
    accessibilityNeeds: [],
    interests: interests.length ? interests : profile.preferences,
    avoid,
  };
}

function defaultForm(profile: ProfileData, seedNotes = ""): DecisionPlanForm {
  const kidLabel =
    profile.kidAgeGroup === "toddler"
      ? "Toddlers (0-4 years)"
      : profile.kidAgeGroup === "kid"
        ? "Kids (5-11 years)"
        : profile.kidAgeGroup === "teen"
          ? "Teens (12+ years)"
          : "No Kids / Adults Only";

  return {
    date: new Date().toISOString().slice(0, 10),
    stayLocation: "",
    interests: [],
    customInterests: profile.preferences.join(", "),
    budget: profile.maxBudget <= 50 ? "Under $50" : "Under $120",
    driveTime:
      profile.maxDriveTime <= 15
        ? "15 minutes"
        : profile.maxDriveTime <= 30
          ? "30 minutes"
          : profile.maxDriveTime <= 45
            ? "45 minutes"
            : "60 minutes+",
    kidAgeGroup: kidLabel,
    adults: profile.adultsCount,
    weatherPrep: profile.preferSunny ? "Sunshine / Outdoors" : "Flexible / Any Weather",
    mealNeeded: "snack",
    avoid: "",
    notes: seedNotes,
  };
}

type DecisionPlanModalProps = {
  open: boolean;
  onClose: () => void;
  profile: ProfileData;
  mapCenter: { lat: number; lng: number };
  seedNotes?: string;
  onGenerate: (request: PlanRequest) => Promise<void>;
};

export function DecisionPlanModal({
  open,
  onClose,
  profile,
  mapCenter,
  seedNotes = "",
  onGenerate,
}: DecisionPlanModalProps) {
  const [form, setForm] = useState<DecisionPlanForm>(() => defaultForm(profile, seedNotes));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(defaultForm(profile, seedNotes));
      setError(null);
    }
  }, [open, profile, seedNotes]);

  if (!open) return null;

  function toggleInterest(interest: string) {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let center = mapCenter;
      let label = "Current map center";

      if (form.stayLocation.trim() && typeof window !== "undefined" && window.google?.maps) {
        const geocoded = await new Promise<{ lat: number; lng: number; label: string } | null>(
          (resolve) => {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: form.stayLocation.trim() }, (results, status) => {
              if (status === "OK" && results?.[0]?.geometry?.location) {
                resolve({
                  lat: results[0].geometry.location.lat(),
                  lng: results[0].geometry.location.lng(),
                  label: results[0].formatted_address || form.stayLocation.trim(),
                });
              } else {
                resolve(null);
              }
            });
          },
        );
        if (geocoded) {
          center = { lat: geocoded.lat, lng: geocoded.lng };
          label = geocoded.label;
        }
      }

      const request = buildPlanRequestFromDecisionForm(form, profile, center, label);
      await onGenerate(request);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-plan-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <div>
            <h2 id="decision-plan-title" className="text-sm font-bold text-slate-900">
              Decision Plan Generator
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Answer a few questions — we&apos;ll build a real provider-backed plan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date
              </label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Adults
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={form.adults}
                onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Stay / base location
            </label>
            <input
              type="text"
              value={form.stayLocation}
              onChange={(e) => setForm({ ...form, stayLocation: e.target.value })}
              placeholder="Hotel, neighborhood, or address (optional — uses map center)"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
              Interests
            </label>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_OPTIONS.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                    form.interests.includes(interest)
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={form.customInterests}
              onChange={(e) => setForm({ ...form, customInterests: e.target.value })}
              placeholder="Other interests, comma-separated"
              className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Budget
              </label>
              <select
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:outline-none"
              >
                <option value="Free Outings Only">Free</option>
                <option value="Under $50">Under $50</option>
                <option value="Under $120">Under $120</option>
                <option value="Premium / Flexible">Flexible</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Max drive
              </label>
              <select
                value={form.driveTime}
                onChange={(e) => setForm({ ...form, driveTime: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:outline-none"
              >
                <option value="15 minutes">15 min</option>
                <option value="30 minutes">30 min</option>
                <option value="45 minutes">45 min</option>
                <option value="60 minutes+">60+ min</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Kids
              </label>
              <select
                value={form.kidAgeGroup}
                onChange={(e) => setForm({ ...form, kidAgeGroup: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:outline-none"
              >
                <option value="No Kids / Adults Only">Adults only</option>
                <option value="Toddlers (0-4 years)">Toddlers</option>
                <option value="Kids (5-11 years)">Kids 5–11</option>
                <option value="Teens (12+ years)">Teens</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Weather
              </label>
              <select
                value={form.weatherPrep}
                onChange={(e) => setForm({ ...form, weatherPrep: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:outline-none"
              >
                <option value="Sunshine / Outdoors">Outdoors</option>
                <option value="Rainy / Indoor Friendly">Indoor</option>
                <option value="Flexible / Any Weather">Flexible</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Meal
              </label>
              <select
                value={form.mealNeeded}
                onChange={(e) =>
                  setForm({ ...form, mealNeeded: e.target.value as DecisionPlanForm["mealNeeded"] })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:outline-none"
              >
                <option value="none">None</option>
                <option value="snack">Snack stop</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Avoid
              </label>
              <input
                type="text"
                value={form.avoid}
                onChange={(e) => setForm({ ...form, avoid: e.target.value })}
                placeholder="crowds, long hikes…"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
              Anything else?
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Special requests, timing, accessibility…"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {error ? (
            <div className="p-2 bg-red-50 border border-red-100 text-red-600 rounded-lg text-[11px] whitespace-pre-line leading-relaxed">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating plan…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Decision Plan
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
