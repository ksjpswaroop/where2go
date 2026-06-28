#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = findRepoRoot(process.cwd());
const env = {
  ...loadEnvFiles(root, [".env", ".env.development", ".env.local", ".env.development.local"]),
  ...process.env,
};
const teamId = env.VERCEL_TEAM_ID || "team_JTWka4o5nYjLqU40kYSdPLf6";
const projectName = args.name;
const expected = {
  name: projectName,
  framework: "nextjs",
  rootDirectory: "apps/web",
};

if (!hasValue(env.VERCEL_TOKEN)) {
  fail("Missing VERCEL_TOKEN. Set it before creating or linking a Vercel project through the REST API.");
}

const existing = await findProjectByName(projectName, teamId, env.VERCEL_TOKEN);
if (!args.apply) {
  print({
    status: existing ? "would-link-existing" : "would-create",
    projectId: existing?.id ?? "(new)",
    orgId: teamId,
    name: existing?.name ?? projectName,
    wroteProjectJson: false,
  });
  process.exit(0);
}

const project = existing ?? await createProject(projectName, teamId, env.VERCEL_TOKEN);
await ensureProjectSettings(project.id, teamId, env.VERCEL_TOKEN, expected);
writeProjectJson(root, {
  projectId: project.id,
  orgId: teamId,
});
print({
  status: existing ? "linked-existing" : "created-and-linked",
  projectId: project.id,
  orgId: teamId,
  name: project.name,
  wroteProjectJson: true,
});

function parseArgs(argv) {
  const parsed = { apply: false, name: "where2go" };
  for (const arg of argv) {
    if (arg === "--apply") {
      parsed.apply = true;
    } else if (arg.startsWith("--name=")) {
      parsed.name = arg.slice("--name=".length);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/bootstrap-vercel-project.mjs [--apply] [--name=where2go]

Checks for a Vercel project and can create/reuse/configure it.
Requires VERCEL_TOKEN. Uses VERCEL_TEAM_ID when set, otherwise ScholarIT.

Without --apply, prints the intended action without mutating Vercel or local files.
With --apply, creates/reuses/configures the project and writes .vercel/project.json.
`);
      process.exit(0);
    }
  }
  if (!parsed.name.trim()) {
    throw new Error("--name must not be empty.");
  }
  return parsed;
}

async function findProjectByName(name, currentTeamId, token) {
  const url = new URL("https://api.vercel.com/v9/projects");
  url.searchParams.set("teamId", currentTeamId);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Vercel project list failed.");
  }
  const projects = Array.isArray(payload.projects) ? payload.projects : [];
  return projects.find((project) => project.name === name);
}

async function createProject(name, currentTeamId, token) {
  const url = new URL("https://api.vercel.com/v11/projects");
  url.searchParams.set("teamId", currentTeamId);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      framework: "nextjs",
      rootDirectory: "apps/web",
      skipGitConnectDuringLink: true,
      enableAffectedProjectsDeployments: true,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Vercel project creation failed.");
  }
  return payload;
}

async function ensureProjectSettings(projectId, currentTeamId, token, settings) {
  const url = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}`);
  url.searchParams.set("teamId", currentTeamId);
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Vercel project settings update failed.");
  }
}

function writeProjectJson(repoRoot, contents) {
  const dir = path.join(repoRoot, ".vercel");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "project.json"), `${JSON.stringify(contents, null, 2)}\n`);
}

function print(result) {
  console.log("Vercel Project Bootstrap");
  console.log(`Status: ${result.status}`);
  console.log(`Project: ${result.name}`);
  console.log(`Project ID: ${result.projectId}`);
  console.log(`Org ID: ${result.orgId}`);
  console.log(`Wrote .vercel/project.json: ${result.wroteProjectJson ? "yes" : "no"}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
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
