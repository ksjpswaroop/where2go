#!/usr/bin/env node
/**
 * Verifies mobile clients can reach planning + safety APIs.
 * Usage: node scripts/verify-mobile-api.mjs [--planning-url=URL] [--safety-url=URL]
 */
const args = parseArgs(process.argv.slice(2));
const planningUrl = (args.planningUrl ?? process.env.EXPO_PUBLIC_PLANNING_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const safetyUrl = (args.safetyUrl ?? process.env.EXPO_PUBLIC_SAFETY_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

const results = [];

results.push(await checkPlanningHealth(planningUrl));
results.push(await checkPlanningGenerate(planningUrl));
results.push(await checkSafetyHealth(safetyUrl));

if (args.json) {
  console.log(JSON.stringify({ planningUrl, safetyUrl, results }, null, 2));
} else {
  console.log("Mobile API Connectivity Check");
  console.log(`Planning: ${planningUrl}`);
  console.log(`Safety:   ${safetyUrl}`);
  console.log("");
  for (const r of results) {
    const icon = r.ok ? "OK" : "FAIL";
    console.log(`  [${icon}] ${r.name}: ${r.message}`);
  }
}

const failed = results.some((r) => !r.ok);
if (failed) process.exitCode = 1;

function parseArgs(argv) {
  const parsed = { planningUrl: undefined, safetyUrl: undefined, json: false };
  for (const arg of argv) {
    if (arg.startsWith("--planning-url=")) parsed.planningUrl = arg.slice(15);
    else if (arg.startsWith("--safety-url=")) parsed.safetyUrl = arg.slice(13);
    else if (arg === "--json") parsed.json = true;
  }
  return parsed;
}

async function checkPlanningHealth(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/provider-health`);
    if (!res.ok) return { name: "planning-health", ok: false, message: `HTTP ${res.status}` };
    const data = await res.json();
    const configured = (data.providers ?? []).filter((p) => p.status === "configured").length;
    return { name: "planning-health", ok: true, message: `${configured} providers configured, storage=${data.storage ?? "unknown"}` };
  } catch (e) {
    return { name: "planning-health", ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

async function checkPlanningGenerate(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/plans/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queryText: "Quick mobile smoke test — coffee shop nearby",
        location: { lat: 30.2672, lng: -97.7431, label: "Austin, TX" },
        date: new Date().toISOString().slice(0, 10),
        party: { adults: 1, kidsAges: [] },
        budgetMax: 30,
        driveTimeMaxMinutes: 15,
        indoorOutdoorPreference: "either",
        mealNeeded: "none",
        accessibilityNeeds: [],
        interests: ["cafes"],
        avoid: [],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { name: "planning-generate", ok: false, message: `HTTP ${res.status}: ${text.slice(0, 120)}` };
    }
    const plan = await res.json();
    const stops = plan.bestPlan?.stops?.length ?? 0;
    return { name: "planning-generate", ok: stops > 0, message: stops > 0 ? `planId=${plan.planId}, ${stops} stops` : "No stops returned" };
  } catch (e) {
    return { name: "planning-generate", ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

async function checkSafetyHealth(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/healthz`);
    if (!res.ok) {
      return {
        name: "safety-health",
        ok: false,
        message: `HTTP ${res.status} — is safety-api running? (pnpm dev:safety-api)`,
      };
    }
    const data = await res.json();
    return { name: "safety-health", ok: data.status === "ok", message: data.status ?? "unknown" };
  } catch (e) {
    return {
      name: "safety-health",
      ok: false,
      message: `${e instanceof Error ? e.message : String(e)} — start with pnpm dev:safety-api`,
    };
  }
}
