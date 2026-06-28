#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = process.cwd();
const envFiles = args.envFile
  ? [args.envFile]
  : [".env", ".env.development", ".env.local", ".env.development.local"];
const fileEnv = loadEnvFiles(root, envFiles);
const mergedEnv = { ...fileEnv, ...process.env };

const requiredGroups = [
  {
    id: "google-maps-platform",
    label: "Google Maps/Places",
    priority: "P0",
    keys: ["GOOGLE_MAPS_API_KEY"],
    providerNames: ["google-maps-platform", "google-places"],
  },
  {
    id: "google-web-search",
    label: "Google Web Search",
    priority: "P0",
    keys: ["GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID"],
    providerNames: ["google-web-search"],
  },
  {
    id: "google-ai",
    label: "Google AI / Gemini",
    priority: "P0",
    keys: ["GOOGLE_AI_API_KEY", "GOOGLE_AI_MODEL"],
    providerNames: ["google-ai"],
  },
  {
    id: "ticketmaster",
    label: "Ticketmaster",
    priority: "P0",
    keys: ["TICKETMASTER_API_KEY"],
    providerNames: ["ticketmaster"],
  },
  {
    id: "postgres-storage",
    label: "Durable database",
    priority: "P0",
    keys: ["DATABASE_URL"],
    providerNames: ["postgres-storage"],
  },
  {
    id: "fallback-ai",
    label: "Fallback AI provider",
    priority: "P1",
    alternatives: [
      ["OPENROUTER_API_KEY", "OPENROUTER_MODEL"],
      ["OPENAI_API_KEY", "OPENAI_MODEL"],
      ["OLLAMA_BASE_URL", "OLLAMA_MODEL"],
    ],
    providerNames: ["openrouter", "openai", "ollama"],
  },
];

const p0ProviderNames = requiredGroups
  .filter((group) => group.priority === "P0")
  .flatMap((group) => group.providerNames);
const expectedVercelProject = {
  rootDirectory: "apps/web",
  framework: "nextjs",
};
const expectedVercelTargets = ["production", "preview", "development"];

const localChecks = requiredGroups.map((group) => {
  const missing = missingKeys(group, mergedEnv);
  return {
    id: group.id,
    label: group.label,
    priority: group.priority,
    status: missing.length === 0 ? "ok" : "missing",
    missing,
  };
});

const vercelLink = readVercelProject(root);
const output = {
  generatedAt: new Date().toISOString(),
  root,
  envFilesChecked: envFiles.filter((file) => fs.existsSync(path.join(root, file))),
  local: localChecks,
  runtime: undefined,
  vercel: {
    linked: Boolean(vercelLink),
    projectId: vercelLink?.projectId,
    orgId: vercelLink?.orgId,
    project: undefined,
    env: undefined,
  },
};

if (args.url) {
  output.runtime = await checkRuntimeProviderHealth(args.url);
}

if (args.vercel) {
  output.vercel.project = await checkVercelProjectSettings(vercelLink, mergedEnv);
  output.vercel.env = await checkVercelEnv(vercelLink, mergedEnv);
}

if (args.json) {
  console.log(JSON.stringify(output, null, 2));
} else {
  printHumanReport(output);
}

const p0Missing = output.local.some((check) => check.priority === "P0" && check.status !== "ok");
const runtimeFailed = args.url && output.runtime?.status !== "ok";
const p0RuntimeMissing =
  output.runtime?.providers?.some(
    (provider) => p0ProviderNames.includes(provider.name) && provider.status !== "configured",
  ) ?? false;
const vercelMissing = args.vercel && (!output.vercel.linked || output.vercel.env?.status !== "ok");
const vercelProjectMisconfigured =
  args.vercel && output.vercel.project?.status !== "ok";

if (p0Missing || runtimeFailed || p0RuntimeMissing || vercelMissing || vercelProjectMisconfigured) {
  process.exitCode = 1;
}

function parseArgs(argv) {
  const parsed = {
    url: undefined,
    envFile: undefined,
    vercel: false,
    json: false,
  };

  for (const arg of argv) {
    if (arg.startsWith("--url=")) {
      parsed.url = arg.slice("--url=".length).replace(/\/$/, "");
    } else if (arg.startsWith("--env-file=")) {
      parsed.envFile = arg.slice("--env-file=".length);
    } else if (arg === "--vercel") {
      parsed.vercel = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/verify-milestone-0.mjs [options]

Options:
  --url=http://127.0.0.1:3000   Check live /api/provider-health
  --env-file=.env.local         Check one specific env file plus process.env
  --vercel                      Check Vercel link and env names via VERCEL_TOKEN
  --json                        Print machine-readable JSON
`);
}

function loadEnvFiles(cwd, files) {
  const env = {};
  for (const file of files) {
    const absolute = path.join(cwd, file);
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
      env[match[1]] = unquote(match[2]);
    }
  }
  return env;
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

function missingKeys(group, env) {
  if (group.keys) {
    return group.keys.filter((key) => !hasValue(env[key]));
  }

  const bestAlternative = group.alternatives.find((keys) => keys.every((key) => hasValue(env[key])));
  if (bestAlternative) {
    return [];
  }

  return group.alternatives.map((keys) => keys.join(" + "));
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readVercelProject(cwd) {
  const file = path.join(cwd, ".vercel", "project.json");
  if (!fs.existsSync(file)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      projectId: parsed.projectId,
      orgId: parsed.orgId,
    };
  } catch {
    return undefined;
  }
}

async function checkRuntimeProviderHealth(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/provider-health`);
    const payload = await response.json();
    return {
      status: response.ok ? "ok" : "failed",
      httpStatus: response.status,
      storage: payload.storage,
      providers: payload.providers ?? [],
    };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
      providers: [],
    };
  }
}

async function checkVercelEnv(vercelLink, env) {
  if (!vercelLink) {
    return {
      status: "missing_link",
      message: "Run `vercel link` or deploy once to create .vercel/project.json.",
    };
  }

  if (!hasValue(env.VERCEL_TOKEN)) {
    return {
      status: "missing_token",
      message:
        "Set VERCEL_TOKEN to verify Vercel environment variable names through the REST API.",
    };
  }

  try {
    const url = new URL(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(vercelLink.projectId)}/env`,
    );
    url.searchParams.set("teamId", vercelLink.orgId);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.VERCEL_TOKEN}`,
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      return {
        status: "failed",
        httpStatus: response.status,
        message: payload.error?.message ?? "Vercel env lookup failed.",
      };
    }

    const envs = Array.isArray(payload.envs) ? payload.envs : [];
    const targetsByKey = new Map();
    for (const item of envs) {
      if (!item.key) {
        continue;
      }
      const current = targetsByKey.get(item.key) ?? new Set();
      for (const target of Array.isArray(item.target) ? item.target : []) {
        current.add(target);
      }
      targetsByKey.set(item.key, current);
    }
    const requiredKeys = requiredGroups
      .filter((group) => group.priority === "P0")
      .flatMap((group) => group.keys ?? []);
    const missing = requiredKeys.filter((key) => !targetsByKey.has(key));
    const missingTargets = requiredKeys
      .filter((key) => targetsByKey.has(key))
      .flatMap((key) =>
        expectedVercelTargets
          .filter((target) => !targetsByKey.get(key).has(target))
          .map((target) => `${key}:${target}`),
      );

    return {
      status: missing.length === 0 && missingTargets.length === 0 ? "ok" : "missing",
      checkedKeys: requiredKeys,
      checkedTargets: expectedVercelTargets,
      missing,
      missingTargets,
      present: requiredKeys.filter((key) => targetsByKey.has(key)),
    };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkVercelProjectSettings(vercelLink, env) {
  if (!vercelLink) {
    return {
      status: "missing_link",
      message: "Run `vercel link` or deploy once to create .vercel/project.json.",
    };
  }

  if (!hasValue(env.VERCEL_TOKEN)) {
    return {
      status: "missing_token",
      message:
        "Set VERCEL_TOKEN to verify Vercel project settings through the REST API.",
    };
  }

  try {
    const url = new URL(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(vercelLink.projectId)}`,
    );
    url.searchParams.set("teamId", vercelLink.orgId);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.VERCEL_TOKEN}`,
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      return {
        status: "failed",
        httpStatus: response.status,
        message: payload.error?.message ?? "Vercel project lookup failed.",
      };
    }

    const rootDirectory = payload.rootDirectory ?? "";
    const framework = payload.framework ?? "";
    const mismatches = [];
    if (rootDirectory !== expectedVercelProject.rootDirectory) {
      mismatches.push(
        `rootDirectory=${rootDirectory || "(empty)"} expected ${expectedVercelProject.rootDirectory}`,
      );
    }
    if (framework !== expectedVercelProject.framework) {
      mismatches.push(
        `framework=${framework || "(empty)"} expected ${expectedVercelProject.framework}`,
      );
    }

    return {
      status: mismatches.length === 0 ? "ok" : "misconfigured",
      checked: expectedVercelProject,
      actual: {
        name: payload.name,
        rootDirectory,
        framework,
        buildCommand: payload.buildCommand,
        installCommand: payload.installCommand,
        outputDirectory: payload.outputDirectory,
      },
      mismatches,
    };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function printHumanReport(result) {
  console.log("Milestone 0 Environment Verification");
  console.log(`Generated: ${result.generatedAt}`);
  console.log(`Root: ${result.root}`);
  console.log("");

  console.log("Local env files checked:");
  console.log(result.envFilesChecked.length ? `  ${result.envFilesChecked.join(", ")}` : "  none");
  console.log("");

  console.log("Local required configuration:");
  for (const check of result.local) {
    const icon = check.status === "ok" ? "OK" : "MISSING";
    const missing = check.missing.length ? ` Missing: ${check.missing.join(", ")}` : "";
    console.log(`  [${icon}] ${check.priority} ${check.label}.${missing}`);
  }
  console.log("");

  if (result.runtime) {
    console.log(`Runtime provider health: ${result.runtime.status}`);
    if (result.runtime.message) {
      console.log(`  ${result.runtime.message}`);
    }
    for (const provider of result.runtime.providers) {
      console.log(`  [${provider.status}] ${provider.name}: ${provider.message ?? ""}`);
    }
    console.log("");
  }

  console.log("Vercel link:");
  if (result.vercel.linked) {
    console.log(`  linked to project ${result.vercel.projectId} in org ${result.vercel.orgId}`);
  } else {
    console.log("  not linked. Missing .vercel/project.json");
  }
  if (result.vercel.env) {
    console.log(`Vercel project settings check: ${result.vercel.project?.status}`);
    if (result.vercel.project?.message) {
      console.log(`  ${result.vercel.project.message}`);
    }
    if (result.vercel.project?.mismatches?.length) {
      console.log(`  Mismatches: ${result.vercel.project.mismatches.join("; ")}`);
    }

    console.log(`Vercel env check: ${result.vercel.env.status}`);
    if (result.vercel.env.message) {
      console.log(`  ${result.vercel.env.message}`);
    }
    if (result.vercel.env.missing?.length) {
      console.log(`  Missing: ${result.vercel.env.missing.join(", ")}`);
    }
    if (result.vercel.env.missingTargets?.length) {
      console.log(`  Missing targets: ${result.vercel.env.missingTargets.join(", ")}`);
    }
  }
}
