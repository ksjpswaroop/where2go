import * as Sentry from "@sentry/node";
import { logger } from "./logger";

let initialized = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });
  initialized = true;
  logger.info("Sentry initialized for safety-api");
}

export function captureSafetyError(error: unknown, context?: Record<string, unknown>) {
  if (initialized) {
    Sentry.captureException(error, { extra: context });
  }
  logger.error({ err: error, ...context }, "Safety API error");
}
