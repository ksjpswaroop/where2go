import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Escalation tests share a single Postgres database and seed/clean rows by
    // unique user id; run files serially to avoid cross-file interference.
    fileParallelism: false,
  },
});
