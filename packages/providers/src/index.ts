import type {
  Action,
  Candidate,
  PlanOption,
  PlanRequest,
  ProviderStatus,
  WeatherSnapshot,
  WhyThisPlan,
} from "@where2go/schemas";

type SearchResult = {
  candidates: Candidate[];
  weather?: WeatherSnapshot;
  providerStatus: ProviderStatus[];
};

type JsonObject = Record<string, unknown>;

type AiProviderName = "google-ai" | "ollama" | "openrouter" | "openai";

type OpenAICompatibleConfig = {
  kind: "openai-compatible";
  name: AiProviderName;
  baseUrl: string;
  model: string;
  apiKey?: string;
  headers?: Record<string, string>;
};

type GoogleAiConfig = {
  kind: "google-ai";
  name: "google-ai";
  apiKey: string;
  model: string;
};

type AiProviderConfig = OpenAICompatibleConfig | GoogleAiConfig;

type AiNarrative = {
  summary?: string;
  whyThisPlan?: WhyThisPlan;
  providerStatus: ProviderStatus[];
};

export async function searchRealWorldCandidates(request: PlanRequest): Promise<SearchResult> {
  const jobs = await Promise.allSettled([
    fetchWeather(request),
    searchTicketmaster(request),
    searchGooglePlaces(request, "activity"),
    searchGooglePlaces(request, "food"),
    searchGoogleWeb(request),
  ]);

  const candidates: Candidate[] = [];
  const providerStatus: ProviderStatus[] = [];
  let weather: WeatherSnapshot | undefined;

  for (const job of jobs) {
    if (job.status === "fulfilled") {
      candidates.push(...job.value.candidates);
      providerStatus.push(...job.value.providerStatus);
      weather = weather ?? job.value.weather;
    } else {
      providerStatus.push({
        name: "provider-orchestrator",
        status: "failed",
        message: job.reason instanceof Error ? job.reason.message : "Provider task failed.",
      });
    }
  }

  return {
    candidates: dedupeCandidates(candidates),
    weather,
    providerStatus,
  };
}

export function getProviderHealth(): ProviderStatus[] {
  return [
    configuredStatus("google-maps-platform", Boolean(googleApiKey()), "GOOGLE_MAPS_API_KEY"),
    configuredStatus("google-places", Boolean(googleApiKey()), "GOOGLE_MAPS_API_KEY"),
    configuredStatus(
      "google-web-search",
      Boolean(googleSearchApiKey() && googleSearchEngineId()),
      "GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID",
    ),
    configuredStatus("ticketmaster", Boolean(process.env.TICKETMASTER_API_KEY), "TICKETMASTER_API_KEY"),
    {
      name: "open-meteo-weather",
      status: "configured",
      message: "Keyless real weather fallback is enabled.",
    },
    aiConfigStatus("google-ai"),
    aiConfigStatus("ollama"),
    aiConfigStatus("openrouter"),
    aiConfigStatus("openai"),
    configuredStatus("postgres-storage", Boolean(process.env.DATABASE_URL), "DATABASE_URL"),
  ];
}

export async function explainPlanWithAI(
  request: PlanRequest,
  plan: PlanOption,
): Promise<AiNarrative> {
  const providerStatus: ProviderStatus[] = [];
  const payload = {
    request: {
      queryText: request.queryText,
      date: request.date,
      location: request.location.label,
      budgetMax: request.budgetMax,
      driveTimeMaxMinutes: request.driveTimeMaxMinutes,
      party: request.party,
      mealNeeded: request.mealNeeded,
      interests: request.interests,
      avoid: request.avoid,
    },
    deterministicPlan: {
      title: plan.title,
      summary: plan.summary,
      cost: plan.estimatedTotalCost,
      travel: plan.travel,
      timeline: plan.timeline,
      stops: plan.stops.map((stop) => ({
        title: stop.title,
        kind: stop.kind,
        address: stop.address,
        cost: stop.cost,
      })),
      reasons: plan.whyThisPlan.reasons,
      caveats: plan.whyThisPlan.caveats,
      providerSources: plan.providerSources,
      score: plan.score,
    },
  };

  for (const provider of aiProviderOrder()) {
    const config = aiProviderConfig(provider);
    if (!config) {
      providerStatus.push(aiConfigStatus(provider));
      continue;
    }

    const started = Date.now();
    try {
      const content = await callAiChat(config, [
        {
          role: "system",
          content:
            "You explain family outing recommendations. Use only facts in the JSON payload. Do not invent venues, prices, ratings, hours, discounts, parking, or availability. Return strict JSON with keys summary, headline, reasons, caveats. Reasons and caveats must be short arrays.",
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ]);
      const parsed = parseAiJson(content);
      providerStatus.push({
        name: provider,
        status: "ok",
        latencyMs: Date.now() - started,
      });

      return {
        summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
        whyThisPlan: {
          headline:
            typeof parsed.headline === "string" ? parsed.headline : plan.whyThisPlan.headline,
          reasons: stringArray(parsed.reasons).slice(0, 5),
          caveats: stringArray(parsed.caveats).slice(0, 5),
        },
        providerStatus,
      };
    } catch (error) {
      providerStatus.push({
        name: provider,
        status: "failed",
        message: error instanceof Error ? error.message : "AI provider call failed.",
        latencyMs: Date.now() - started,
      });
    }
  }

  return { providerStatus };
}

export async function parseRequestWithAI(queryText: string): Promise<{
  parsed?: Partial<PlanRequest>;
  providerStatus: ProviderStatus[];
}> {
  const providerStatus: ProviderStatus[] = [];
  for (const provider of aiProviderOrder()) {
    const config = aiProviderConfig(provider);
    if (!config) {
      providerStatus.push(aiConfigStatus(provider));
      continue;
    }
    const started = Date.now();
    try {
      const content = await callAiChat(config, [
        {
          role: "system",
          content:
            "Extract outing planning constraints. Return strict JSON only. Include budgetMax, driveTimeMaxMinutes, indoorOutdoorPreference, mealNeeded, interests, avoid when explicit. Do not invent location coordinates.",
        },
        { role: "user", content: queryText },
      ]);
      providerStatus.push({ name: provider, status: "ok", latencyMs: Date.now() - started });
      return { parsed: parseAiJson(content) as Partial<PlanRequest>, providerStatus };
    } catch (error) {
      providerStatus.push({
        name: provider,
        status: "failed",
        message: error instanceof Error ? error.message : "AI parsing failed.",
        latencyMs: Date.now() - started,
      });
    }
  }

  return { providerStatus };
}

async function fetchWeather(request: PlanRequest): Promise<SearchResult> {
  const started = Date.now();
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(request.location.lat));
  url.searchParams.set("longitude", String(request.location.lng));
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "3");

  try {
    const data = await fetchJson<JsonObject>(url.toString(), {}, 5000);
    const hourly = data.hourly as JsonObject | undefined;
    const times = arrayOf<string>(hourly?.time);
    const temperatures = arrayOf<number>(hourly?.temperature_2m);
    const precipitation = arrayOf<number>(hourly?.precipitation_probability);
    const weatherCodes = arrayOf<number>(hourly?.weather_code);
    const target = new Date(request.startTime ?? `${request.date}T12:00:00`).getTime();
    const index = nearestTimeIndex(times, target);
    const precip = precipitation[index] ?? 0;
    const weatherCode = weatherCodes[index] ?? 0;
    const summary = weatherSummary(weatherCode, precip);

    return {
      candidates: [],
      weather: {
        source: "open-meteo",
        summary,
        temperatureF: temperatures[index],
        precipitationProbability: precip,
        isOutdoorFriendly: precip < 45 && !isSevereWeatherCode(weatherCode),
        observedAt: new Date().toISOString(),
      },
      providerStatus: [
        {
          name: "open-meteo-weather",
          status: "ok",
          latencyMs: Date.now() - started,
        },
      ],
    };
  } catch (error) {
    return {
      candidates: [],
      providerStatus: [
        {
          name: "open-meteo-weather",
          status: "failed",
          message: error instanceof Error ? error.message : "Weather lookup failed.",
          latencyMs: Date.now() - started,
        },
      ],
    };
  }
}

async function searchTicketmaster(request: PlanRequest): Promise<SearchResult> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    return {
      candidates: [],
      providerStatus: [
        {
          name: "ticketmaster",
          status: "not_configured",
          message: "Set TICKETMASTER_API_KEY to fetch concerts, sports, theater, comedy, and family shows.",
        },
      ],
    };
  }

  const started = Date.now();
  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("latlong", `${request.location.lat},${request.location.lng}`);
  url.searchParams.set("radius", String(Math.max(5, request.driveTimeMaxMinutes)));
  url.searchParams.set("unit", "miles");
  url.searchParams.set("size", "20");
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("startDateTime", toUtcIsoStart(request.date));
  url.searchParams.set("endDateTime", toUtcIsoEnd(request.date));
  if (request.interests.length > 0) {
    url.searchParams.set("keyword", request.interests.slice(0, 4).join(" "));
  }

  try {
    const data = await fetchJson<JsonObject>(url.toString(), {}, 8000);
    const embedded = data._embedded as JsonObject | undefined;
    const events = arrayOf<JsonObject>(embedded?.events);
    const candidates = events.map((event) => ticketmasterEventToCandidate(event, request));
    return {
      candidates,
      providerStatus: [
        {
          name: "ticketmaster",
          status: "ok",
          candidateCount: candidates.length,
          latencyMs: Date.now() - started,
        },
      ],
    };
  } catch (error) {
    return {
      candidates: [],
      providerStatus: [
        {
          name: "ticketmaster",
          status: "failed",
          message: error instanceof Error ? error.message : "Ticketmaster lookup failed.",
          latencyMs: Date.now() - started,
        },
      ],
    };
  }
}

async function searchGooglePlaces(
  request: PlanRequest,
  mode: "activity" | "food",
): Promise<SearchResult> {
  const apiKey = googleApiKey();
  if (!apiKey) {
    return {
      candidates: [],
      providerStatus: [
        {
          name: mode === "food" ? "google-places-food" : "google-places-activities",
          status: "not_configured",
          message: "Set GOOGLE_MAPS_API_KEY to fetch live places, ratings, hours, and map links.",
        },
      ],
    };
  }

  if (mode === "food" && request.mealNeeded === "none") {
    return {
      candidates: [],
      providerStatus: [
        {
          name: "google-places-food",
          status: "skipped",
          message: "Meal stop was not requested.",
        },
      ],
    };
  }

  const started = Date.now();
  const query =
    mode === "food"
      ? `family friendly ${request.mealNeeded} restaurants near ${request.location.label}`
      : `${request.interests.join(" ") || "family activities parks museums events"} near ${
          request.location.label
        }`;

  try {
    const data = await fetchJson<JsonObject>(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri,places.regularOpeningHours,places.types",
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 12,
          locationBias: {
            circle: {
              center: {
                latitude: request.location.lat,
                longitude: request.location.lng,
              },
              radius: Math.min(50000, Math.max(5000, request.driveTimeMaxMinutes * 1200)),
            },
          },
        }),
      },
      8000,
    );
    const places = arrayOf<JsonObject>(data.places);
    const candidates = places.map((place) => googlePlaceToCandidate(place, request, mode));
    return {
      candidates,
      providerStatus: [
        {
          name: mode === "food" ? "google-places-food" : "google-places-activities",
          status: "ok",
          candidateCount: candidates.length,
          latencyMs: Date.now() - started,
        },
      ],
    };
  } catch (error) {
    return {
      candidates: [],
      providerStatus: [
        {
          name: mode === "food" ? "google-places-food" : "google-places-activities",
          status: "failed",
          message: error instanceof Error ? error.message : "Google Places lookup failed.",
          latencyMs: Date.now() - started,
        },
      ],
    };
  }
}

async function searchGoogleWeb(request: PlanRequest): Promise<SearchResult> {
  const apiKey = googleSearchApiKey();
  const searchEngineId = googleSearchEngineId();
  if (!apiKey || !searchEngineId) {
    return {
      candidates: [],
      providerStatus: [
        {
          name: "google-web-search",
          status: "not_configured",
          message:
            "Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID to fetch web-discovered local event pages.",
        },
      ],
    };
  }

  const started = Date.now();
  const url = new URL("https://customsearch.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", searchEngineId);
  url.searchParams.set("num", "8");
  url.searchParams.set("q", googleWebSearchQuery(request));

  try {
    const data = await fetchJson<JsonObject>(url.toString(), {}, 8000);
    const items = arrayOf<JsonObject>(data.items);
    const candidates = items.map((item) => googleWebResultToCandidate(item, request));
    return {
      candidates,
      providerStatus: [
        {
          name: "google-web-search",
          status: "ok",
          candidateCount: candidates.length,
          latencyMs: Date.now() - started,
        },
      ],
    };
  } catch (error) {
    return {
      candidates: [],
      providerStatus: [
        {
          name: "google-web-search",
          status: "failed",
          message: error instanceof Error ? error.message : "Google web search lookup failed.",
          latencyMs: Date.now() - started,
        },
      ],
    };
  }
}

function ticketmasterEventToCandidate(event: JsonObject, request: PlanRequest): Candidate {
  const eventId = text(event.id) || cryptoId("tm");
  const embedded = event._embedded as JsonObject | undefined;
  const venue = arrayOf<JsonObject>(embedded?.venues)[0];
  const venueLocation = venue?.location as JsonObject | undefined;
  const classifications = arrayOf<JsonObject>(event.classifications);
  const tags = classifications.flatMap((classification) =>
    ["segment", "genre", "subGenre", "type", "subType"]
      .map((key) => text((classification[key] as JsonObject | undefined)?.name))
      .filter((tag): tag is string => Boolean(tag)),
  );
  const priceRanges = arrayOf<JsonObject>(event.priceRanges);
  const prices = priceRanges
    .flatMap((range) => [number(range.min), number(range.max)])
    .filter((value): value is number => value !== undefined);
  const partySize = request.party.adults + request.party.kidsAges.length;
  const minTicket = prices.length ? Math.min(...prices) : undefined;
  const maxTicket = prices.length ? Math.max(...prices) : undefined;
  const start = event.dates as JsonObject | undefined;
  const startDetails = start?.start as JsonObject | undefined;
  const startDateTime =
    text(startDetails?.dateTime) ??
    [text(startDetails?.localDate), text(startDetails?.localTime)].filter(Boolean).join("T") ??
    undefined;
  const venueName = text(venue?.name);

  return {
    id: `ticketmaster_${eventId}`,
    source: "ticketmaster",
    sourceId: eventId,
    kind: "event",
    title: text(event.name) ?? "Ticketmaster event",
    description: venueName ? `Live event at ${venueName}.` : "Live event from Ticketmaster.",
    location:
      venueLocation && text(venueLocation.latitude) && text(venueLocation.longitude)
        ? {
            lat: Number(venueLocation.latitude),
            lng: Number(venueLocation.longitude),
          }
        : undefined,
    address: venueAddress(venue),
    startDateTime,
    durationMinutes: 120,
    price:
      minTicket !== undefined && maxTicket !== undefined
        ? {
            min: Math.round(minTicket * partySize),
            max: Math.round(maxTicket * partySize),
            currency: text(priceRanges[0]?.currency) ?? "USD",
            confidence: "medium",
            note: "Ticketmaster prices are ticket estimates before fees.",
          }
        : undefined,
    url: text(event.url),
    imageUrl: largestImageUrl(arrayOf<JsonObject>(event.images)),
    distanceMiles: number(event.distance),
    tags: unique(tags),
    indoorOutdoor: inferIndoorOutdoor(tags),
    actions: text(event.url)
      ? [{ type: "tickets" as const, label: "View tickets", url: text(event.url)! }]
      : [],
  };
}

function googlePlaceToCandidate(
  place: JsonObject,
  request: PlanRequest,
  mode: "activity" | "food",
): Candidate {
  const displayName = place.displayName as JsonObject | undefined;
  const location = place.location as JsonObject | undefined;
  const lat = number(location?.latitude);
  const lng = number(location?.longitude);
  const tags = arrayOf<string>(place.types);
  const kind = mode === "food" ? "food" : tags.includes("park") ? "park" : "place";
  const distanceMiles =
    lat !== undefined && lng !== undefined
      ? haversineMiles(request.location.lat, request.location.lng, lat, lng)
      : undefined;
  const openNow = (place.regularOpeningHours as JsonObject | undefined)?.openNow;
  const googleMapsUri = text(place.googleMapsUri);
  const websiteUri = text(place.websiteUri);
  const actions: Action[] = [];
  if (googleMapsUri) {
    actions.push({ type: "directions", label: "Open map", url: googleMapsUri });
  }
  if (websiteUri) {
    actions.push({ type: "website", label: "Open website", url: websiteUri });
  }

  return {
    id: `google_${text(place.id) ?? cryptoId("place")}`,
    source: "google-places",
    sourceId: text(place.id),
    kind,
    title: text(displayName?.text) ?? "Google Places result",
    description:
      typeof openNow === "boolean"
        ? openNow
          ? "Google Places reports this location is open now."
          : "Google Places reports this location may be closed now."
        : "Place result from Google Places.",
    location: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
    address: text(place.formattedAddress),
    durationMinutes: mode === "food" ? 60 : kind === "park" ? 90 : 105,
    url: websiteUri ?? googleMapsUri,
    rating: number(place.rating),
    ratingCount: number(place.userRatingCount),
    distanceMiles,
    driveMinutes: distanceMiles !== undefined ? Math.max(5, Math.round(distanceMiles * 2.6)) : undefined,
    tags,
    indoorOutdoor: mode === "food" ? "indoor" : inferIndoorOutdoor(tags),
    actions,
    metadata: {
      openNow,
    },
  };
}

function googleWebResultToCandidate(item: JsonObject, request: PlanRequest): Candidate {
  const link = text(item.link);
  const title = text(item.title) ?? "Google web search result";
  const snippet = text(item.snippet);
  const pagemap = item.pagemap as JsonObject | undefined;
  const cseImage = arrayOf<JsonObject>(pagemap?.cse_image)[0];
  const imageUrl = text(cseImage?.src);

  return {
    id: `google_web_${cryptoId("result")}`,
    source: "google-web-search",
    sourceId: link,
    kind: "event",
    title,
    description:
      snippet ??
      "Web-discovered local activity. Confirm details on the linked page before going.",
    durationMinutes: 90,
    url: link,
    imageUrl,
    tags: unique(["web-search", ...request.interests]),
    indoorOutdoor: request.indoorOutdoorPreference,
    actions: link ? [{ type: "website", label: "Open source", url: link }] : [],
    metadata: {
      caveat:
        "Google web search results may not include structured location, price, hours, or availability.",
    },
  };
}

function googleWebSearchQuery(request: PlanRequest) {
  const interests = request.interests.length > 0 ? request.interests.join(" OR ") : "family activities";
  return [
    `(${interests})`,
    "events OR activities",
    request.location.label,
    request.date,
    request.party.kidsAges.length > 0 ? "kids family" : "adults",
    request.budgetMax <= 100 ? "free OR cheap OR affordable" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

async function callAiChat(
  config: AiProviderConfig,
  messages: Array<{ role: "system" | "user"; content: string }>,
) {
  if (config.kind === "google-ai") {
    return callGoogleAiGenerateContent(config, messages);
  }
  return callOpenAICompatibleChat(config, messages);
}

async function callGoogleAiGenerateContent(
  config: GoogleAiConfig,
  messages: Array<{ role: "system" | "user"; content: string }>,
) {
  const system = messages.find((message) => message.role === "system")?.content;
  const userText = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/${googleAiModelPath(
      config.model,
    )}:generateContent`,
  );
  url.searchParams.set("key", config.apiKey);

  const response = await fetchJson<JsonObject>(
    url.toString(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: system
          ? {
              parts: [{ text: system }],
            }
          : undefined,
        contents: [
          {
            role: "user",
            parts: [{ text: userText }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
    20000,
  );
  const candidates = arrayOf<JsonObject>(response.candidates);
  const content = candidates[0]?.content as JsonObject | undefined;
  const parts = arrayOf<JsonObject>(content?.parts);
  const textParts = parts.map((part) => text(part.text)).filter(Boolean);
  const contentText = textParts.join("\n").trim();
  if (!contentText) {
    throw new Error(`${config.name} returned no assistant content.`);
  }
  return contentText;
}

async function callOpenAICompatibleChat(
  config: OpenAICompatibleConfig,
  messages: Array<{ role: "system" | "user"; content: string }>,
) {
  const response = await fetchJson<JsonObject>(
    chatCompletionsUrl(config.baseUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        ...config.headers,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.2,
      }),
    },
    20000,
  );
  const choices = arrayOf<JsonObject>(response.choices);
  const message = choices[0]?.message as JsonObject | undefined;
  const content = text(message?.content);
  if (!content) {
    throw new Error(`${config.name} returned no assistant content.`);
  }
  return content;
}

function aiProviderOrder(): AiProviderName[] {
  const raw = process.env.AI_PROVIDER_ORDER ?? "google-ai,ollama,openrouter,openai";
  return raw
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider): provider is AiProviderName =>
      ["google-ai", "ollama", "openrouter", "openai"].includes(provider),
    );
}

function aiProviderConfig(provider: AiProviderName): AiProviderConfig | undefined {
  if (provider === "google-ai") {
    if (!process.env.GOOGLE_AI_API_KEY || !process.env.GOOGLE_AI_MODEL) {
      return undefined;
    }
    return {
      kind: "google-ai",
      name: provider,
      apiKey: process.env.GOOGLE_AI_API_KEY,
      model: process.env.GOOGLE_AI_MODEL,
    };
  }

  if (provider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? (process.env.VERCEL ? undefined : "http://localhost:11434");
    const model = process.env.OLLAMA_MODEL ?? "llama3.1";
    return baseUrl ? { kind: "openai-compatible", name: provider, baseUrl, model } : undefined;
  }

  if (provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY || !process.env.OPENROUTER_MODEL) {
      return undefined;
    }
    return {
      kind: "openai-compatible",
      name: provider,
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL,
      headers: {
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
        "X-Title": "Where2Go",
      },
    };
  }

  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
    return undefined;
  }
  return {
    kind: "openai-compatible",
    name: provider,
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
  };
}

function aiConfigStatus(provider: AiProviderName): ProviderStatus {
  const config = aiProviderConfig(provider);
  if (config) {
    return {
      name: provider,
      status: "configured",
      message: `Configured with model ${config.model}.`,
    };
  }

  if (provider === "google-ai") {
    return {
      name: provider,
      status: "not_configured",
      message: "Set GOOGLE_AI_API_KEY and GOOGLE_AI_MODEL for Gemini model calls.",
    };
  }

  if (provider === "ollama") {
    return {
      name: provider,
      status: "not_configured",
      message: "Set OLLAMA_BASE_URL and OLLAMA_MODEL for local or remote Ollama calls.",
    };
  }

  if (provider === "openrouter") {
    return {
      name: provider,
      status: "not_configured",
      message: "Set OPENROUTER_API_KEY and OPENROUTER_MODEL.",
    };
  }

  return {
    name: provider,
    status: "not_configured",
    message: "Set OPENAI_API_KEY and OPENAI_MODEL.",
  };
}

function configuredStatus(name: string, configured: boolean, envName: string): ProviderStatus {
  return configured
    ? { name, status: "configured", message: `${envName} is present.` }
    : { name, status: "not_configured", message: `Set ${envName}.` };
}

async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
    });
    const textBody = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${textBody.slice(0, 240)}`);
    }
    return JSON.parse(textBody) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function parseAiJson(content: string): JsonObject {
  try {
    return JSON.parse(content) as JsonObject;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI response was not valid JSON.");
    }
    return JSON.parse(match[0]) as JsonObject;
  }
}

function chatCompletionsUrl(baseUrl: string) {
  const cleaned = baseUrl.replace(/\/$/, "");
  return cleaned.endsWith("/v1")
    ? `${cleaned}/chat/completions`
    : `${cleaned}/v1/chat/completions`;
}

function googleApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
}

function googleSearchApiKey() {
  return process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
}

function googleSearchEngineId() {
  return process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
}

function googleAiModelPath(model: string) {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function toUtcIsoStart(date: string) {
  return new Date(`${date}T00:00:00`).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function toUtcIsoEnd(date: string) {
  return new Date(`${date}T23:59:59`).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function nearestTimeIndex(times: string[], target: number) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  times.forEach((time, index) => {
    const distance = Math.abs(new Date(time).getTime() - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function weatherSummary(code: number, precipitationProbability: number) {
  const base =
    code >= 95
      ? "thunderstorms possible"
      : code >= 71
        ? "snow possible"
        : code >= 61
          ? "rain possible"
          : code >= 45
            ? "foggy"
            : code >= 2
              ? "partly cloudy"
              : "clear";
  return `${base}, ${Math.round(precipitationProbability)}% precipitation chance`;
}

function isSevereWeatherCode(code: number) {
  return code >= 61;
}

function venueAddress(venue?: JsonObject) {
  if (!venue) {
    return undefined;
  }
  const address = venue.address as JsonObject | undefined;
  const city = venue.city as JsonObject | undefined;
  const state = venue.state as JsonObject | undefined;
  return [text(address?.line1), text(city?.name), text(state?.stateCode)].filter(Boolean).join(", ");
}

function largestImageUrl(images: JsonObject[]) {
  const sorted = [...images].sort((a, b) => (number(b.width) ?? 0) - (number(a.width) ?? 0));
  return text(sorted[0]?.url);
}

function inferIndoorOutdoor(tags: string[]): "indoor" | "outdoor" | "either" {
  const textTags = tags.join(" ").toLowerCase();
  if (
    ["park", "zoo", "amusement", "campground", "tourist_attraction", "stadium"].some((term) =>
      textTags.includes(term),
    )
  ) {
    return "outdoor";
  }
  if (
    ["museum", "library", "movie", "restaurant", "cafe", "shopping", "theater", "aquarium"].some(
      (term) => textTags.includes(term),
    )
  ) {
    return "indoor";
  }
  return "either";
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function dedupeCandidates(candidates: Candidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.source}:${candidate.sourceId ?? candidate.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function text(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function stringArray(value: unknown) {
  return arrayOf<unknown>(value)
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function cryptoId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${random.replaceAll("-", "").slice(0, 14)}`;
}
