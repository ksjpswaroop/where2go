#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = parseArgs(process.argv.slice(2));
const root = findRepoRoot(process.cwd());
const env = {
  ...loadEnvFiles(root, [".env", ".env.development", ".env.local", ".env.development.local"]),
  ...process.env,
};

const target = {
  label: args.location,
  lat: args.lat,
  lng: args.lng,
};

const checks = [
  {
    name: "google-places",
    keys: ["GOOGLE_MAPS_API_KEY"],
    run: () => smokeGooglePlaces(env, target, args.timeoutMs),
  },
  {
    name: "google-web-search",
    keys: ["GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID"],
    run: () => smokeGoogleWebSearch(env, target, args.timeoutMs),
  },
  {
    name: "google-ai",
    keys: ["GOOGLE_AI_API_KEY", "GOOGLE_AI_MODEL"],
    run: () => smokeGoogleAi(env, args.timeoutMs),
  },
  {
    name: "ticketmaster",
    keys: ["TICKETMASTER_API_KEY"],
    run: () => smokeTicketmaster(env, target, args.timeoutMs),
  },
  {
    name: "postgres-storage",
    keys: ["DATABASE_URL"],
    run: () => smokePostgres(env, root),
  },
];

const results = [];
for (const check of checks) {
  const missing = check.keys.filter((key) => !hasValue(env[key]));
  if (missing.length > 0) {
    results.push({
      name: check.name,
      status: "missing",
      message: `Missing ${missing.join(", ")}.`,
    });
    continue;
  }

  const started = Date.now();
  try {
    const detail = await check.run();
    results.push({
      name: check.name,
      status: "ok",
      latencyMs: Date.now() - started,
      message: detail,
    });
  } catch (error) {
    results.push({
      name: check.name,
      status: "failed",
      latencyMs: Date.now() - started,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  root,
  target,
  envFilesChecked: [".env", ".env.development", ".env.local", ".env.development.local"].filter(
    (file) => fs.existsSync(path.join(root, file)),
  ),
  results,
};

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHumanReport(report);
}

if (results.some((result) => result.status !== "ok")) {
  process.exitCode = 1;
}

function parseArgs(argv) {
  const parsed = {
    json: false,
    timeoutMs: 10000,
    location: "Dallas, TX",
    lat: 32.7767,
    lng: -96.797,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      parsed.json = true;
    } else if (arg.startsWith("--timeout-ms=")) {
      parsed.timeoutMs = Number(arg.slice("--timeout-ms=".length));
    } else if (arg.startsWith("--location=")) {
      parsed.location = arg.slice("--location=".length);
    } else if (arg.startsWith("--lat=")) {
      parsed.lat = Number(arg.slice("--lat=".length));
    } else if (arg.startsWith("--lng=")) {
      parsed.lng = Number(arg.slice("--lng=".length));
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number.");
  }
  if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) {
    throw new Error("--lat and --lng must be numbers.");
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/smoke-providers.mjs [options]

Options:
  --location="Dallas, TX"       Label used in smoke queries
  --lat=32.7767                 Latitude used for local provider smoke tests
  --lng=-96.797                 Longitude used for local provider smoke tests
  --timeout-ms=10000            Per-provider HTTP timeout
  --json                        Print machine-readable JSON
`);
}

function printHumanReport(report) {
  console.log("Provider Smoke Verification");
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Root: ${report.root}`);
  console.log(`Target: ${report.target.label} (${report.target.lat}, ${report.target.lng})`);
  console.log("");
  console.log("Env files checked:");
  console.log(report.envFilesChecked.length ? `  ${report.envFilesChecked.join(", ")}` : "  none");
  console.log("");
  for (const result of report.results) {
    const latency = result.latencyMs === undefined ? "" : ` (${result.latencyMs}ms)`;
    console.log(`  [${result.status}] ${result.name}${latency}: ${result.message}`);
  }
}

async function smokeGooglePlaces(currentEnv, currentTarget, timeoutMs) {
  const response = await fetchJson(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": currentEnv.GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName",
      },
      body: JSON.stringify({
        textQuery: `family activities near ${currentTarget.label}`,
        maxResultCount: 1,
        locationBias: {
          circle: {
            center: {
              latitude: currentTarget.lat,
              longitude: currentTarget.lng,
            },
            radius: 25000,
          },
        },
      }),
    },
    timeoutMs,
  );
  const count = Array.isArray(response.places) ? response.places.length : 0;
  return `Places Text Search returned ${count} place(s).`;
}

async function smokeGoogleWebSearch(currentEnv, currentTarget, timeoutMs) {
  const url = new URL("https://customsearch.googleapis.com/customsearch/v1");
  url.searchParams.set("key", currentEnv.GOOGLE_SEARCH_API_KEY);
  url.searchParams.set("cx", currentEnv.GOOGLE_SEARCH_ENGINE_ID);
  url.searchParams.set("num", "1");
  url.searchParams.set("q", `family events ${currentTarget.label}`);
  const response = await fetchJson(url.toString(), {}, timeoutMs);
  const count = Array.isArray(response.items) ? response.items.length : 0;
  return `Programmable Search returned ${count} result(s).`;
}

async function smokeGoogleAi(currentEnv, timeoutMs) {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/${googleAiModelPath(
      currentEnv.GOOGLE_AI_MODEL,
    )}:generateContent`,
  );
  url.searchParams.set("key", currentEnv.GOOGLE_AI_API_KEY);
  const response = await fetchJson(
    url.toString(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: 'Return only this JSON: {"ok":true}' }],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 32,
          responseMimeType: "application/json",
        },
      }),
    },
    timeoutMs,
  );
  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  if (candidates.length === 0) {
    throw new Error("Gemini returned no candidates.");
  }
  return `Gemini ${currentEnv.GOOGLE_AI_MODEL} returned content.`;
}

async function smokeTicketmaster(currentEnv, currentTarget, timeoutMs) {
  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", currentEnv.TICKETMASTER_API_KEY);
  url.searchParams.set("latlong", `${currentTarget.lat},${currentTarget.lng}`);
  url.searchParams.set("radius", "25");
  url.searchParams.set("unit", "miles");
  url.searchParams.set("size", "1");
  url.searchParams.set("sort", "date,asc");
  const response = await fetchJson(url.toString(), {}, timeoutMs);
  const embedded = response._embedded;
  const events = embedded && Array.isArray(embedded.events) ? embedded.events.length : 0;
  return `Discovery API returned ${events} event(s).`;
}

async function smokePostgres(currentEnv, repoRoot) {
  const postgresEntry = path.join(repoRoot, "apps/web/node_modules/postgres/src/index.js");
  if (!fs.existsSync(postgresEntry)) {
    throw new Error("postgres package was not found under apps/web. Run pnpm install.");
  }

  const { default: postgres } = await import(pathToFileURL(postgresEntry).href);
  const sql = postgres(currentEnv.DATABASE_URL, {
    max: 1,
    idle_timeout: 2,
    connect_timeout: 5,
  });

  try {
    const rows = await sql`select 1 as ok`;
    return `Postgres connection returned ${rows[0]?.ok}.`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function fetchJson(url, init = {}, timeoutMs = 10000) {
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
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${providerError(payload)}`);
    }
    return payload;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Provider returned non-JSON response.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function providerError(payload) {
  if (typeof payload?.error?.message === "string") {
    return payload.error.message;
  }
  if (typeof payload?.fault?.faultstring === "string") {
    return payload.fault.faultstring;
  }
  if (typeof payload?.errors?.[0]?.detail === "string") {
    return payload.errors[0].detail;
  }
  return "Provider request failed.";
}

function googleAiModelPath(model) {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function loadEnvFiles(repoRoot, files) {
  const loaded = {};
  for (const file of files) {
    const absolute = path.join(repoRoot, file);
    if (!fs.existsSync(absolute)) {
      continue;
    }
    const text = fs.readFileSync(absolute, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) {
        continue;
      }
      loaded[match[1]] = unquote(match[2]);
    }
  }
  return loaded;
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function findRepoRoot(start) {
  let current = start;
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    current = path.dirname(current);
  }
  return start;
}
