"use client";

import type {
  CostEstimate,
  PlanOption,
  PlanRequest,
  PlanResponse,
  ProviderStatus,
} from "@where2go/schemas";
import {
  AlertTriangle,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronRight,
  CloudSun,
  DollarSign,
  ExternalLink,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Navigation,
  Share2,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Utensils,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import Image from "next/image";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type HealthResponse = {
  generatedAt: string;
  storage: "postgres" | "memory";
  providers: ProviderStatus[];
};

type FormState = {
  queryText: string;
  locationLabel: string;
  lat: string;
  lng: string;
  date: string;
  startTime: string;
  homeByTime: string;
  adults: string;
  kidsAges: string;
  budgetMax: string;
  driveTimeMaxMinutes: string;
  indoorOutdoorPreference: "indoor" | "outdoor" | "either";
  mealNeeded: "none" | "snack" | "lunch" | "dinner";
  interests: string;
  avoid: string;
};

type ApiError = {
  message: string;
  details?: unknown;
};

const initialForm: FormState = {
  queryText:
    "Family outing today, under $120, outdoors if possible, drive under 30 minutes, home by 7 PM.",
  locationLabel: "",
  lat: "",
  lng: "",
  date: localDate(),
  startTime: localDateTime(14, 0),
  homeByTime: localDateTime(19, 0),
  adults: "2",
  kidsAges: "8, 11",
  budgetMax: "120",
  driveTimeMaxMinutes: "30",
  indoorOutdoorPreference: "outdoor",
  mealNeeded: "dinner",
  interests: "parks, festivals, animals",
  avoid: "crowded bars",
};

export function Where2GoApp() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [health, setHealth] = useState<HealthResponse | undefined>();
  const [plan, setPlan] = useState<PlanResponse | undefined>();
  const [error, setError] = useState<ApiError | undefined>();
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | undefined>();
  const [feedbackStatus, setFeedbackStatus] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/provider-health")
      .then((response) => response.json())
      .then((payload: HealthResponse) => setHealth(payload))
      .catch(() => setHealth(undefined));
  }, []);

  const missingProviderCount = useMemo(
    () => health?.providers.filter((provider) => provider.status === "not_configured").length ?? 0,
    [health],
  );

  async function generatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    setPlan(undefined);
    setShareUrl(undefined);
    setFeedbackStatus(undefined);

    try {
      const requestBody = buildRequest(form);
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError({
          message: payload?.error?.message ?? "Plan generation failed.",
          details: payload?.error?.details,
        });
        return;
      }
      setPlan(payload as PlanResponse);
    } catch (caught) {
      setError({
        message: caught instanceof Error ? caught.message : "Plan generation failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError({ message: "Browser geolocation is not available." });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          lat: position.coords.latitude.toFixed(5),
          lng: position.coords.longitude.toFixed(5),
          locationLabel: "Current location",
        }));
        setLocating(false);
      },
      (geoError) => {
        setError({ message: geoError.message });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function sharePlan() {
    if (!plan) {
      return;
    }
    const response = await fetch(`/api/plans/${plan.planId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInDays: 14, includeCost: true, includeHomeLocation: false }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError({ message: payload?.error?.message ?? "Share failed." });
      return;
    }
    const absoluteUrl = `${window.location.origin}${payload.url}`;
    setShareUrl(absoluteUrl);
    await navigator.clipboard?.writeText(absoluteUrl).catch(() => undefined);
  }

  async function sendFeedback(action: "accepted" | "rejected" | "saved") {
    if (!plan) {
      return;
    }
    const response = await fetch(`/api/plans/${plan.planId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, target: "bestPlan" }),
    });
    setFeedbackStatus(response.ok ? `Feedback saved: ${action}` : "Feedback failed.");
  }

  const canGenerate = Boolean(form.lat.trim() && form.lng.trim() && form.locationLabel.trim());

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center overflow-hidden rounded-[8px] border border-[var(--border)] bg-white">
              <Image
                src="/where2go-logo.png"
                alt="Where2Go family logo"
                width={48}
                height={48}
                className="size-full scale-[1.35] object-cover"
                priority
              />
            </div>
            <div>
              <div className="text-lg font-semibold">Where2Go</div>
              <div className="text-sm text-[var(--text-secondary)]">
                {form.locationLabel || "Location needed"}
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <span className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
              Today
            </span>
            <span className="rounded-[8px] border border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]">
              Saved
            </span>
            <span className="rounded-[8px] border border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]">
              Profile
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
          <form onSubmit={generatePlan} className="grid gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
                  What should we do today?
                </h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Real places, events, weather, AI explanation, and explicit provider status.
                </p>
              </div>
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm">
                {missingProviderCount === 0
                  ? "Providers ready"
                  : `${missingProviderCount} provider settings missing`}
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Request</span>
              <textarea
                value={form.queryText}
                onChange={(event) => setForm({ ...form, queryText: event.target.value })}
                rows={4}
                className="focus-ring min-h-28 w-full resize-y rounded-[8px] border border-[var(--border)] bg-white px-3 py-3 text-base leading-6"
                placeholder="Family outing today, under $120, outdoors if possible..."
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Location label</span>
                <input
                  value={form.locationLabel}
                  onChange={(event) => setForm({ ...form, locationLabel: event.target.value })}
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                  placeholder="Current location, Dallas, Naperville..."
                />
              </label>
              <button
                type="button"
                onClick={useCurrentLocation}
                className="focus-ring mt-0 inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[var(--border)] px-3 text-sm font-medium sm:mt-7"
              >
                {locating ? (
                  <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
                ) : (
                  <LocateFixed size={17} aria-hidden="true" />
                )}
                Locate
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Latitude">
                <input
                  value={form.lat}
                  onChange={(event) => setForm({ ...form, lat: event.target.value })}
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                  inputMode="decimal"
                  placeholder="32.7767"
                />
              </Field>
              <Field label="Longitude">
                <input
                  value={form.lng}
                  onChange={(event) => setForm({ ...form, lng: event.target.value })}
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                  inputMode="decimal"
                  placeholder="-96.7970"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Date" icon={<CalendarDays size={16} />}>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                />
              </Field>
              <Field label="Start" icon={<Navigation size={16} />}>
                <input
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(event) => setForm({ ...form, startTime: event.target.value })}
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                />
              </Field>
              <Field label="Home by" icon={<Car size={16} />}>
                <input
                  type="datetime-local"
                  value={form.homeByTime}
                  onChange={(event) => setForm({ ...form, homeByTime: event.target.value })}
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Budget" icon={<Wallet size={16} />}>
                <input
                  value={form.budgetMax}
                  onChange={(event) => setForm({ ...form, budgetMax: event.target.value })}
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Drive min" icon={<Car size={16} />}>
                <input
                  value={form.driveTimeMaxMinutes}
                  onChange={(event) =>
                    setForm({ ...form, driveTimeMaxMinutes: event.target.value })
                  }
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Adults" icon={<Users size={16} />}>
                <input
                  value={form.adults}
                  onChange={(event) => setForm({ ...form, adults: event.target.value })}
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Kids ages">
                <input
                  value={form.kidsAges}
                  onChange={(event) => setForm({ ...form, kidsAges: event.target.value })}
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                  placeholder="8, 11"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Indoor/outdoor">
                <select
                  value={form.indoorOutdoorPreference}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      indoorOutdoorPreference: event.target
                        .value as FormState["indoorOutdoorPreference"],
                    })
                  }
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                >
                  <option value="either">Either</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="indoor">Indoor</option>
                </select>
              </Field>
              <Field label="Meal" icon={<Utensils size={16} />}>
                <select
                  value={form.mealNeeded}
                  onChange={(event) =>
                    setForm({ ...form, mealNeeded: event.target.value as FormState["mealNeeded"] })
                  }
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                >
                  <option value="none">No meal</option>
                  <option value="snack">Snack</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Interests">
                <input
                  value={form.interests}
                  onChange={(event) => setForm({ ...form, interests: event.target.value })}
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                  placeholder="parks, museums, festivals"
                />
              </Field>
              <Field label="Avoid">
                <input
                  value={form.avoid}
                  onChange={(event) => setForm({ ...form, avoid: event.target.value })}
                  className="focus-ring h-11 rounded-[8px] border border-[var(--border)] px-3"
                  placeholder="crowded bars, late nights"
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <PresetButton
                icon={<CloudSun size={16} />}
                label="Outdoor"
                onClick={() => setForm({ ...form, indoorOutdoorPreference: "outdoor" })}
              />
              <PresetButton
                icon={<DollarSign size={16} />}
                label="Under $100"
                onClick={() => setForm({ ...form, budgetMax: "100" })}
              />
              <PresetButton
                icon={<Car size={16} />}
                label="Low effort"
                onClick={() => setForm({ ...form, driveTimeMaxMinutes: "15" })}
              />
              <PresetButton
                icon={<Utensils size={16} />}
                label="Dinner"
                onClick={() => setForm({ ...form, mealNeeded: "dinner" })}
              />
            </div>

            <button
              type="submit"
              disabled={!canGenerate || loading}
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-[var(--primary)] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[var(--primary-hover)] disabled:bg-[#8cb7e6]"
            >
              {loading ? (
                <LoaderCircle size={19} className="animate-spin" aria-hidden="true" />
              ) : (
                <SlidersHorizontal size={19} aria-hidden="true" />
              )}
              Generate plan
            </button>
          </form>
        </section>

        <aside className="grid content-start gap-5">
          <ProviderPanel health={health} />
          {plan?.weather ? (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CloudSun size={17} aria-hidden="true" />
                Weather
              </div>
              <div className="mt-3 text-2xl font-semibold">{plan.weather.summary}</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">
                {plan.weather.temperatureF !== undefined
                  ? `${Math.round(plan.weather.temperatureF)}°F`
                  : "Temperature unavailable"}{" "}
                · {plan.weather.source}
              </div>
            </div>
          ) : null}
          {error ? <ErrorPanel error={error} /> : null}
        </aside>

        {loading ? <GeneratingPanel /> : null}

        {plan ? (
          <section className="lg:col-span-2">
            <PlanResults
              plan={plan}
              shareUrl={shareUrl}
              feedbackStatus={feedbackStatus}
              onShare={sharePlan}
              onFeedback={sendFeedback}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}

function PlanResults({
  plan,
  shareUrl,
  feedbackStatus,
  onShare,
  onFeedback,
}: {
  plan: PlanResponse;
  shareUrl?: string;
  feedbackStatus?: string;
  onShare: () => void;
  onFeedback: (action: "accepted" | "rejected" | "saved") => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase text-[var(--primary)]">
              Today&apos;s best plan
            </div>
            <h2 className="mt-1 text-2xl font-semibold leading-tight">{plan.bestPlan.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              {plan.bestPlan.summary}
            </p>
          </div>
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold">
            {plan.bestPlan.score}/100
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric
            icon={<Wallet size={18} />}
            label="Cost"
            value={formatCost(plan.bestPlan.estimatedTotalCost)}
          />
          <Metric
            icon={<Car size={18} />}
            label="Driving"
            value={`${plan.bestPlan.travel.totalDriveMinutes} min`}
          />
          <Metric icon={<MapPin size={18} />} label="Stops" value={`${plan.bestPlan.stops.length}`} />
        </div>

        <div className="mt-5 grid gap-3">
          {plan.bestPlan.stops.map((stop) => (
            <div
              key={stop.id}
              className="rounded-[8px] border border-[var(--border)] bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{stop.title}</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">
                    {[stop.kind, stop.address].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {stop.cost ? (
                  <div className="rounded-[8px] bg-[var(--surface-muted)] px-2 py-1 font-mono text-sm">
                    {formatCost(stop.cost)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <div className="text-sm font-semibold">{plan.bestPlan.whyThisPlan.headline}</div>
          <ul className="mt-3 grid gap-2 text-sm leading-6">
            {plan.bestPlan.whyThisPlan.reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <CheckCircle2
                  className="mt-1 shrink-0 text-[var(--positive)]"
                  size={16}
                  aria-hidden="true"
                />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
          {plan.bestPlan.whyThisPlan.caveats.length > 0 ? (
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--warning)]">
              {plan.bestPlan.whyThisPlan.caveats.map((caveat) => (
                <li key={caveat} className="flex gap-2">
                  <AlertTriangle className="mt-1 shrink-0" size={16} aria-hidden="true" />
                  <span>{caveat}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {plan.bestPlan.actions.map((action) => (
            <a
              key={`${action.type}-${action.url}`}
              href={action.url}
              target="_blank"
              rel="noreferrer"
              className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white"
            >
              <ExternalLink size={16} aria-hidden="true" />
              {action.label}
            </a>
          ))}
          <button
            type="button"
            onClick={onShare}
            className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--border)] px-3 py-2 text-sm font-semibold"
          >
            <Share2 size={16} aria-hidden="true" />
            Share
          </button>
          <button
            type="button"
            onClick={() => onFeedback("accepted")}
            className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--border)] px-3 py-2 text-sm font-semibold"
            aria-label="Accept plan"
          >
            <ThumbsUp size={16} aria-hidden="true" />
            Accept
          </button>
          <button
            type="button"
            onClick={() => onFeedback("rejected")}
            className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--border)] px-3 py-2 text-sm font-semibold"
            aria-label="Reject plan"
          >
            <ThumbsDown size={16} aria-hidden="true" />
            Reject
          </button>
        </div>

        {shareUrl ? (
          <div className="mt-3 break-all rounded-[8px] border border-[var(--border)] bg-white p-3 font-mono text-sm">
            {shareUrl}
          </div>
        ) : null}
        {feedbackStatus ? (
          <div className="mt-3 text-sm text-[var(--text-secondary)]">{feedbackStatus}</div>
        ) : null}
      </div>

      <div className="grid content-start gap-5">
        <TimelinePanel plan={plan.bestPlan} />
        <AlternativesPanel alternatives={plan.alternatives} />
        <DebugPanel plan={plan} />
      </div>
    </div>
  );
}

function TimelinePanel({ plan }: { plan: PlanOption }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Navigation size={17} aria-hidden="true" />
        Route timeline
      </div>
      <div className="route-board relative mt-4 min-h-52 overflow-hidden rounded-[8px] border border-[var(--border)] p-4">
        <div className="absolute left-8 top-7 h-[calc(100%-56px)] w-px bg-[var(--primary)]" />
        <div className="relative grid gap-4">
          {plan.timeline.map((item) => (
            <div key={`${item.time}-${item.label}`} className="grid grid-cols-[48px_1fr] gap-3">
              <div className="font-mono text-sm font-semibold">{item.time}</div>
              <div className="flex gap-3">
                <span className="relative z-10 mt-1 flex size-4 shrink-0 rounded-full border-2 border-white bg-[var(--primary)] shadow" />
                <div>
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-xs uppercase text-[var(--text-secondary)]">{item.kind}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlternativesPanel({ alternatives }: { alternatives: PlanOption[] }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="text-sm font-semibold">Backups</div>
      <div className="mt-3 grid gap-3">
        {alternatives.length === 0 ? (
          <div className="text-sm text-[var(--text-secondary)]">No backup plans from configured providers.</div>
        ) : (
          alternatives.map((alternative) => (
            <div
              key={alternative.id}
              className="rounded-[8px] border border-[var(--border)] bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{alternative.title}</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">
                    {formatCost(alternative.estimatedTotalCost)} ·{" "}
                    {alternative.travel.totalDriveMinutes} min driving
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-[var(--text-secondary)]" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProviderPanel({ health }: { health?: HealthResponse }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <WifiOff size={17} aria-hidden="true" />
          Provider health
        </div>
        <span className="rounded-[8px] bg-[var(--surface-muted)] px-2 py-1 text-xs">
          {health?.storage ?? "checking"}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {(health?.providers ?? []).map((provider) => (
          <ProviderRow key={provider.name} provider={provider} />
        ))}
        {!health ? <div className="text-sm text-[var(--text-secondary)]">Checking providers...</div> : null}
      </div>
    </div>
  );
}

function ProviderRow({ provider }: { provider: ProviderStatus }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[8px] border border-[var(--border)] p-3">
      <div>
        <div className="text-sm font-medium">{provider.name}</div>
        <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{provider.message}</div>
      </div>
      <span
        className={`shrink-0 rounded-[8px] px-2 py-1 text-xs font-semibold ${statusClass(
          provider.status,
        )}`}
      >
        {provider.status}
      </span>
    </div>
  );
}

function ErrorPanel({ error }: { error: ApiError }) {
  const statuses = providerStatusesFromDetails(error.details);
  return (
    <div className="rounded-[8px] border border-[var(--danger)] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-[var(--danger)]">
        <AlertTriangle size={18} aria-hidden="true" />
        {error.message}
      </div>
      {statuses.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {statuses.map((provider) => (
            <ProviderRow key={`${provider.name}-${provider.status}`} provider={provider} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GeneratingPanel() {
  const steps = [
    "Understanding request",
    "Finding places and events",
    "Checking weather",
    "Estimating cost",
    "Building best plan and backups",
  ];
  return (
    <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm lg:col-span-2">
      <div className="flex items-center gap-2 font-semibold">
        <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
        Generating
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {steps.map((step) => (
          <div key={step} className="rounded-[8px] border border-[var(--border)] px-3 py-2 text-sm">
            {step}
          </div>
        ))}
      </div>
    </section>
  );
}

function DebugPanel({ plan }: { plan: PlanResponse }) {
  return (
    <details className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold">Run details</summary>
      <div className="mt-3 grid gap-2 text-sm">
        <div>Candidates: {plan.debug.candidateCount}</div>
        <div>Filtered: {plan.debug.filteredCount}</div>
        <div>Storage: {plan.debug.storage ?? "unknown"}</div>
        <div>Status: {plan.status}</div>
      </div>
    </details>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {icon ? <span className="text-[var(--text-secondary)]">{icon}</span> : null}
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-white p-3">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}

function PresetButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium"
    >
      {icon}
      {label}
    </button>
  );
}

function buildRequest(form: FormState): PlanRequest {
  const lat = Number(form.lat);
  const lng = Number(form.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Latitude and longitude are required.");
  }

  return {
    queryText: form.queryText,
    location: {
      lat,
      lng,
      label: form.locationLabel,
    },
    date: form.date,
    startTime: form.startTime || undefined,
    homeByTime: form.homeByTime || undefined,
    party: {
      adults: Number(form.adults) || 1,
      kidsAges: parseNumberList(form.kidsAges),
    },
    budgetMax: Number(form.budgetMax) || 0,
    driveTimeMaxMinutes: Number(form.driveTimeMaxMinutes) || 30,
    indoorOutdoorPreference: form.indoorOutdoorPreference,
    mealNeeded: form.mealNeeded,
    accessibilityNeeds: [],
    interests: parseTextList(form.interests),
    avoid: parseTextList(form.avoid),
  };
}

function parseTextList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberList(value: string) {
  return parseTextList(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function formatCost(cost: CostEstimate) {
  const prefix = cost.currency === "USD" ? "$" : `${cost.currency} `;
  if (cost.min === cost.max) {
    return `${prefix}${Math.round(cost.max)}`;
  }
  return `${prefix}${Math.round(cost.min)}-${Math.round(cost.max)}`;
}

function statusClass(status: ProviderStatus["status"]) {
  if (status === "ok" || status === "configured") {
    return "bg-[#e8f3ec] text-[var(--positive)]";
  }
  if (status === "failed") {
    return "bg-[#fcebea] text-[var(--danger)]";
  }
  if (status === "not_configured" || status === "degraded") {
    return "bg-[#fff4d8] text-[var(--warning)]";
  }
  return "bg-[var(--surface-muted)] text-[var(--text-secondary)]";
}

function providerStatusesFromDetails(details: unknown): ProviderStatus[] {
  if (
    details &&
    typeof details === "object" &&
    "providerStatus" in details &&
    Array.isArray((details as { providerStatus?: unknown }).providerStatus)
  ) {
    return (details as { providerStatus: ProviderStatus[] }).providerStatus;
  }
  return [];
}

function localDate() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function localDateTime(hours: number, minutes: number) {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return [
    localDate(),
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  ].join("T");
}
