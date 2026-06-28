import { z } from "zod";

export const CoordinatesSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const LocationInputSchema = CoordinatesSchema.extend({
  label: z.string().trim().min(1).max(160).default("Selected location"),
});

export const PartySchema = z.object({
  adults: z.coerce.number().int().min(1).max(12).default(2),
  kidsAges: z.array(z.coerce.number().int().min(0).max(17)).max(12).default([]),
});

export const IndoorOutdoorPreferenceSchema = z.enum([
  "indoor",
  "outdoor",
  "either",
]);

export const MealNeededSchema = z.enum(["none", "snack", "lunch", "dinner"]);

export const ProductModeSchema = z.enum(["family_day", "solo_travel"]);
export const SubscriptionTierSchema = z.enum(["free", "plus", "pro"]);

export const VenueSafetyBadgeSchema = z.object({
  overallScore: z.number().min(0).max(100),
  label: z.enum(["safe", "caution", "risk"]),
  soloFemaleScore: z.number().min(0).max(100).optional(),
});

export const PlanRequestSchema = z.object({
  queryText: z.string().trim().min(3).max(900),
  location: LocationInputSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().trim().optional(),
  homeByTime: z.string().trim().optional(),
  party: PartySchema,
  budgetMax: z.coerce.number().min(0).max(5000).default(120),
  driveTimeMaxMinutes: z.coerce.number().int().min(5).max(240).default(30),
  indoorOutdoorPreference: IndoorOutdoorPreferenceSchema.default("either"),
  mealNeeded: MealNeededSchema.default("none"),
  accessibilityNeeds: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  interests: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  avoid: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

export const CostEstimateSchema = z.object({
  min: z.number().min(0),
  max: z.number().min(0),
  currency: z.string().length(3).default("USD"),
  confidence: z.enum(["high", "medium", "low", "unknown"]).default("unknown"),
  note: z.string().max(240).optional(),
});

export const ProviderStatusSchema = z.object({
  name: z.string(),
  status: z.enum([
    "configured",
    "not_configured",
    "ok",
    "degraded",
    "failed",
    "skipped",
  ]),
  message: z.string().optional(),
  latencyMs: z.number().int().min(0).optional(),
  candidateCount: z.number().int().min(0).optional(),
});

export const ActionSchema = z.object({
  type: z.enum(["directions", "tickets", "website", "call", "share", "reserve"]),
  label: z.string(),
  url: z.string().url(),
});

export const CandidateKindSchema = z.enum(["event", "place", "food", "park"]);

export const CandidateSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceId: z.string().optional(),
  kind: CandidateKindSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  location: CoordinatesSchema.optional(),
  address: z.string().optional(),
  startDateTime: z.string().optional(),
  endDateTime: z.string().optional(),
  durationMinutes: z.number().int().min(15).max(720).default(90),
  price: CostEstimateSchema.optional(),
  url: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  rating: z.number().min(0).max(5).optional(),
  ratingCount: z.number().int().min(0).optional(),
  distanceMiles: z.number().min(0).optional(),
  driveMinutes: z.number().int().min(0).optional(),
  tags: z.array(z.string()).default([]),
  indoorOutdoor: IndoorOutdoorPreferenceSchema.default("either"),
  ageMin: z.number().int().min(0).optional(),
  ageMax: z.number().int().min(0).optional(),
  actions: z.array(ActionSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const WeatherSnapshotSchema = z.object({
  source: z.string(),
  summary: z.string(),
  temperatureF: z.number().optional(),
  precipitationProbability: z.number().min(0).max(100).optional(),
  isOutdoorFriendly: z.boolean(),
  observedAt: z.string(),
});

export const TimelineItemSchema = z.object({
  time: z.string(),
  label: z.string(),
  kind: z.enum(["travel", "activity", "meal", "buffer", "return"]),
});

export const PlanStopSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: CandidateKindSchema,
  address: z.string().optional(),
  location: CoordinatesSchema.optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationMinutes: z.number().int().min(0).optional(),
  cost: CostEstimateSchema.optional(),
  url: z.string().url().optional(),
  notes: z.string().optional(),
  safetyBadge: VenueSafetyBadgeSchema.optional(),
});

export const WhyThisPlanSchema = z.object({
  headline: z.string(),
  reasons: z.array(z.string()).min(1),
  caveats: z.array(z.string()).default([]),
});

export const PlanOptionSchema = z.object({
  id: z.string(),
  kind: z.enum(["best", "cheaper", "rain_or_low_effort", "alternative"]),
  title: z.string(),
  planType: z.enum(["event", "place", "place_plus_food", "park", "food"]),
  summary: z.string(),
  estimatedTotalCost: CostEstimateSchema,
  travel: z.object({
    totalDriveMinutes: z.number().int().min(0),
    driveLimitSatisfied: z.boolean(),
  }),
  timeline: z.array(TimelineItemSchema),
  stops: z.array(PlanStopSchema),
  actions: z.array(ActionSchema).default([]),
  whyThisPlan: WhyThisPlanSchema,
  score: z.number().min(0).max(100),
  providerSources: z.array(z.string()).default([]),
});

export const PlanResponseSchema = z.object({
  requestId: z.string(),
  planId: z.string(),
  generatedAt: z.string(),
  status: z.enum(["ready", "partial", "failed"]),
  bestPlan: PlanOptionSchema,
  alternatives: z.array(PlanOptionSchema).default([]),
  weather: WeatherSnapshotSchema.optional(),
  debug: z.object({
    candidateCount: z.number().int().min(0),
    filteredCount: z.number().int().min(0),
    providerStatus: z.array(ProviderStatusSchema),
    aiStatus: z.array(ProviderStatusSchema).default([]),
    storage: z.enum(["postgres", "memory"]).optional(),
  }),
});

export const FeedbackRequestSchema = z.object({
  action: z.enum(["accepted", "rejected", "saved", "attended"]),
  target: z.enum(["bestPlan", "alternative"]).default("bestPlan"),
  reason: z.string().max(120).optional(),
  freeText: z.string().max(1000).optional(),
  attended: z.boolean().default(false),
});

export const ShareRequestSchema = z.object({
  expiresInDays: z.coerce.number().int().min(1).max(90).default(14),
  includeCost: z.boolean().default(true),
  includeHomeLocation: z.boolean().default(false),
});

export const ProfileSchema = z.object({
  defaultLocation: LocationInputSchema.optional(),
  party: PartySchema.default({ adults: 2, kidsAges: [] }),
  budgetDefault: z.number().min(0).max(5000).default(120),
  driveTimeDefaultMinutes: z.number().int().min(5).max(240).default(30),
  interests: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
});

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type LocationInput = z.infer<typeof LocationInputSchema>;
export type Party = z.infer<typeof PartySchema>;
export type IndoorOutdoorPreference = z.infer<typeof IndoorOutdoorPreferenceSchema>;
export type MealNeeded = z.infer<typeof MealNeededSchema>;
export type ProductMode = z.infer<typeof ProductModeSchema>;
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;
export type VenueSafetyBadge = z.infer<typeof VenueSafetyBadgeSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type CostEstimate = z.infer<typeof CostEstimateSchema>;
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type CandidateKind = z.infer<typeof CandidateKindSchema>;
export type Candidate = z.infer<typeof CandidateSchema>;
export type WeatherSnapshot = z.infer<typeof WeatherSnapshotSchema>;
export type TimelineItem = z.infer<typeof TimelineItemSchema>;
export type PlanStop = z.infer<typeof PlanStopSchema>;
export type WhyThisPlan = z.infer<typeof WhyThisPlanSchema>;
export type PlanOption = z.infer<typeof PlanOptionSchema>;
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;
export type ShareRequest = z.infer<typeof ShareRequestSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
