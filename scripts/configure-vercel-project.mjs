#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = findRepoRoot(process.cwd());
const env = {
  ...loadEnvFiles(root, [".env", ".env.development", ".env.local", ".env.development.local"]),
  ...process.env,
};
const project = readVercelProject(root);
const expected = {
  rootDirectory: "apps/web",
  framework: "nextjs",
};

if (!project) {
  fail("Missing .vercel/project.json. Run `pnpm vercel:link` or `pnpm vercel:link:repo` first.");
}

if (!hasValue(env.VERCEL_TOKEN)) {
  fail("Missing VERCEL_TOKEN. Set it locally or run `pnpm vercel:login` and configure settings in the dashboard.");
}

const current = await getProject(project, env.VERCEL_TOKEN);
const mismatches = projectMismatches(current, expected);

if (!args.apply) {
  printProjectReport("dry-run", current, mismatches);
  if (mismatches.length > 0) {
    process.exitCode = 1;
  }
} else {
  if (mismatches.length === 0) {
    printProjectReport("already-configured", current, mismatches);
  } else {
    const updated = await updateProject(project, env.VERCEL_TOKEN, expected);
    printProjectReport("updated", updated, projectMismatches(updated, expected));
  }
}

function parseArgs(argv) {
  const parsed = { apply: false };
  for (const arg of argv) {
    if (arg === "--apply") {
      parsed.apply = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/configure-vercel-project.mjs [--apply]

Checks the linked Vercel project settings expected by Milestone 0.
Without --apply, exits non-zero when settings differ.
With --apply, patches rootDirectory=apps/web and framework=nextjs.
`);
      process.exit(0);
    }
  }
  return parsed;
}

async function getProject(project, token) {
  const url = projectUrl(project);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Vercel project lookup failed with ${response.status}.`);
  }
  return payload;
}

async function updateProject(project, token, settings) {
  const url = projectUrl(project);
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
    throw new Error(payload.error?.message ?? `Vercel project update failed with ${response.status}.`);
  }
  return payload;
}

function projectUrl(project) {
  const url = new URL(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(project.projectId)}`,
  );
  url.searchParams.set("teamId", project.orgId);
  return url;
}

function projectMismatches(project, settings) {
  const rootDirectory = project.rootDirectory ?? "";
  const framework = project.framework ?? "";
  const mismatches = [];
  if (rootDirectory !== settings.rootDirectory) {
    mismatches.push(`rootDirectory=${rootDirectory || "(empty)"} expected ${settings.rootDirectory}`);
  }
  if (framework !== settings.framework) {
    mismatches.push(`framework=${framework || "(empty)"} expected ${settings.framework}`);
  }
  return mismatches;
}

function printProjectReport(mode, project, mismatches) {
  console.log("Vercel Project Settings");
  console.log(`Mode: ${mode}`);
  console.log(`Project: ${project.name ?? "(unknown)"}`);
  console.log(`rootDirectory: ${project.rootDirectory ?? "(empty)"}`);
  console.log(`framework: ${project.framework ?? "(empty)"}`);
  console.log(`buildCommand: ${project.buildCommand ?? "(default)"}`);
  console.log(`installCommand: ${project.installCommand ?? "(default)"}`);
  console.log(`outputDirectory: ${project.outputDirectory ?? "(default)"}`);
  if (mismatches.length > 0) {
    console.log(`Mismatches: ${mismatches.join("; ")}`);
  } else {
    console.log("Status: ok");
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
