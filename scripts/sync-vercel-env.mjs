#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const requiredKeys = [
  "GOOGLE_MAPS_API_KEY",
  "GOOGLE_SEARCH_API_KEY",
  "GOOGLE_SEARCH_ENGINE_ID",
  "GOOGLE_AI_API_KEY",
  "GOOGLE_AI_MODEL",
  "TICKETMASTER_API_KEY",
  "DATABASE_URL",
];
const targets = ["production", "preview", "development"];
const args = parseArgs(process.argv.slice(2));
const root = findRepoRoot(process.cwd());
const env = {
  ...loadEnvFiles(root, [".env", ".env.development", ".env.local", ".env.development.local"]),
  ...process.env,
};
const project = readVercelProject(root);

if (!project) {
  fail("Missing .vercel/project.json. Run `pnpm vercel:link` or `pnpm vercel:link:repo` first.");
}

if (!hasValue(env.VERCEL_TOKEN)) {
  fail("Missing VERCEL_TOKEN. Set it before syncing environment variables through the REST API.");
}

const missing = requiredKeys.filter((key) => !hasValue(env[key]));
if (missing.length > 0) {
  printPlan({ status: "missing-local-values", missing, synced: [] });
  process.exit(1);
}

if (!args.apply) {
  printPlan({
    status: "dry-run",
    missing: [],
    synced: requiredKeys.map((key) => ({ key, targets })),
  });
} else {
  const synced = [];
  for (const key of requiredKeys) {
    await upsertProjectEnv(project, env.VERCEL_TOKEN, {
      key,
      value: env[key],
      type: "encrypted",
      target: targets,
      comment: "Where2Go Milestone 0 provider configuration",
    });
    synced.push({ key, targets });
  }
  printPlan({ status: "synced", missing: [], synced });
}

function parseArgs(argv) {
  const parsed = { apply: false };
  for (const arg of argv) {
    if (arg === "--apply") {
      parsed.apply = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/sync-vercel-env.mjs [--apply]

Reads Milestone 0 P0 values from local env files/process env and upserts them
to the linked Vercel project for production, preview, and development.

Without --apply, validates local values and prints the intended sync plan.
With --apply, requires .vercel/project.json and VERCEL_TOKEN, then writes envs.
`);
      process.exit(0);
    }
  }
  return parsed;
}

async function upsertProjectEnv(project, token, body) {
  const url = new URL(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(project.projectId)}/env`,
  );
  url.searchParams.set("teamId", project.orgId);
  url.searchParams.set("upsert", "true");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Failed syncing ${body.key} to Vercel.`);
  }
}

function printPlan(plan) {
  console.log("Vercel Environment Sync");
  console.log(`Status: ${plan.status}`);
  if (plan.missing.length > 0) {
    console.log(`Missing local values: ${plan.missing.join(", ")}`);
  }
  for (const item of plan.synced) {
    console.log(`  ${item.key} -> ${item.targets.join(", ")}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readVercelProject(repoRoot) {
  const file = path.join(repoRoot, ".vercel", "project.json");
  if (!fs.existsSync(file)) {
    return undefined;
  }

  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    projectId: parsed.projectId,
    orgId: parsed.orgId,
  };
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
