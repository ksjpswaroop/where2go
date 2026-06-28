import { describe, expect, it } from "vitest";

import {
  CAUTION_THRESHOLD,
  SAFE_THRESHOLD,
  formatScore,
  scoreBand,
  scoreBarWidth,
} from "./scannerScore";

describe("hotel scanner score rendering (0-100 scale)", () => {
  it("renders scores on the 0-100 scale, never /10", () => {
    expect(formatScore(82)).toBe("82/100");
    expect(formatScore(0)).toBe("0/100");
    expect(formatScore(100)).toBe("100/100");
    // Guard against the past regression that rendered scores as "N/10".
    expect(formatScore(7)).toBe("7/100");
    expect(formatScore(7).endsWith("/10")).toBe(false);
  });

  it("colors thresholds correctly across the 0-100 range", () => {
    // Safe band: >= 70
    expect(scoreBand(SAFE_THRESHOLD)).toBe("success");
    expect(scoreBand(85)).toBe("success");
    expect(scoreBand(100)).toBe("success");

    // Caution band: 40-69
    expect(scoreBand(SAFE_THRESHOLD - 1)).toBe("warning");
    expect(scoreBand(CAUTION_THRESHOLD)).toBe("warning");
    expect(scoreBand(55)).toBe("warning");

    // Danger band: < 40
    expect(scoreBand(CAUTION_THRESHOLD - 1)).toBe("destructive");
    expect(scoreBand(10)).toBe("destructive");
    expect(scoreBand(0)).toBe("destructive");
  });

  it("does not misclassify a 0-100 score as if it were on a 0-10 scale", () => {
    // A genuinely dangerous 35/100 must read as danger, not as a safe "3.5".
    expect(scoreBand(35)).toBe("destructive");
    // A strong 90/100 must read as safe.
    expect(scoreBand(90)).toBe("success");
  });

  it("clamps the progress-bar width to 0-100", () => {
    expect(scoreBarWidth(50)).toBe(50);
    expect(scoreBarWidth(-20)).toBe(0);
    expect(scoreBarWidth(140)).toBe(100);
  });
});
