#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = findRepoRoot(process.cwd());
const env = {
  ...loadEnvFiles(root, [".env", ".env.development", ".env.local", ".env.development.local"]),
  ...process.env,
};
const tokenSource = vercelToken(env);

if (!tokenSource) {
  print({
    status: "missing",
    message:
      "No VERCEL_TOKEN or readable Vercel CLI auth token found. Run `pnpm vercel:login` or set VERCEL_TOKEN.",
  });
  process.exit(1);
}

try {
  const response = await fetch("https://api.vercel.com/v2/user", {
    headers: {
      Authorization: `Bearer ${tokenSource.token}`,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    print({
      status: "failed",
      tokenSource: tokenSource.source,
      message: payload.error?.message ?? `Vercel auth check failed with ${response.status}.`,
    });
    process.exit(1);
  }

  print({
    status: "ok",
    tokenSource: tokenSource.source,
    user: {
      id: payload.user?.id,
      username: payload.user?.username,
      email: payload.user?.email,
    },
  });
} catch (error) {
  print({
    status: "failed",
    tokenSource: tokenSource.source,
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = { json: false };
  for (const arg of argv) {
    if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/check-vercel-auth.mjs [--json]

Checks Vercel auth without starting an interactive device-login flow.
Uses VERCEL_TOKEN first, then ~/.vercel/auth.json if present.
`);
      process.exit(0);
    }
  }
  return parsed;
}

function print(result) {
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("Vercel Auth Check");
  console.log(`Status: ${result.status}`);
  if (result.tokenSource) {
    console.log(`Token source: ${result.tokenSource}`);
  }
  if (result.user) {
    console.log(`User: ${result.user.username ?? result.user.email ?? result.user.id ?? "(unknown)"}`);
  }
  if (result.message) {
    console.log(result.message);
  }
}

function vercelToken(env) {
  if (hasValue(env.VERCEL_TOKEN)) {
    return { source: "VERCEL_TOKEN", token: env.VERCEL_TOKEN };
  }

  const cliAuthPath = path.join(os.homedir(), ".vercel", "auth.json");
  if (!fs.existsSync(cliAuthPath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(cliAuthPath, "utf8"));
    if (hasValue(parsed.token)) {
      return { source: "~/.vercel/auth.json", token: parsed.token };
    }
  } catch {
    return undefined;
  }

  return undefined;
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
