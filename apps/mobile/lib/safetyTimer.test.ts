import { describe, expect, it } from "vitest";

import {
  TimerLike,
  formatRemaining,
  getRemainingMs,
  isTimerExpired,
  offersSafetyPackage,
  shouldEscalateExpiry,
} from "./safetyTimer";

const NOW = Date.UTC(2026, 5, 18, 12, 0, 0);

function timerExpiringIn(ms: number, overrides: Partial<TimerLike> = {}): TimerLike {
  return {
    id: 1,
    expiresAt: new Date(NOW + ms).toISOString(),
    notifyContacts: true,
    ...overrides,
  };
}

describe("safety timer expiry escalation", () => {
  it("treats a timer as expired exactly when it crosses zero", () => {
    expect(isTimerExpired(timerExpiringIn(1000), NOW)).toBe(false);
    // Exactly at zero counts as expired.
    expect(isTimerExpired(timerExpiringIn(0), NOW)).toBe(true);
    expect(isTimerExpired(timerExpiringIn(-1000), NOW)).toBe(true);
    expect(isTimerExpired(null, NOW)).toBe(false);
  });

  it("computes remaining milliseconds relative to now", () => {
    expect(getRemainingMs(timerExpiringIn(5000).expiresAt, NOW)).toBe(5000);
    expect(getRemainingMs(timerExpiringIn(-5000).expiresAt, NOW)).toBe(-5000);
  });

  it("escalates only once when a timer crosses zero", () => {
    const timer = timerExpiringIn(-1);
    let handledId: number | null = null;

    // Before zero: no escalation.
    expect(shouldEscalateExpiry(timerExpiringIn(1000), NOW, handledId)).toBe(false);

    // First crossing: escalate, then record that we handled this timer.
    expect(shouldEscalateExpiry(timer, NOW, handledId)).toBe(true);
    handledId = timer.id;

    // Subsequent renders (timer still expired) must NOT escalate again.
    expect(shouldEscalateExpiry(timer, NOW + 1000, handledId)).toBe(false);
    expect(shouldEscalateExpiry(timer, NOW + 60_000, handledId)).toBe(false);
  });

  it("re-escalates for a different timer id", () => {
    const first = timerExpiringIn(-1, { id: 1 });
    const second = timerExpiringIn(-1, { id: 2 });
    const handledId = first.id;

    expect(shouldEscalateExpiry(first, NOW, handledId)).toBe(false);
    // A brand-new expired timer should still escalate.
    expect(shouldEscalateExpiry(second, NOW, handledId)).toBe(true);
  });

  it("offers the safety package only when the timer notifies contacts", () => {
    expect(offersSafetyPackage(timerExpiringIn(-1, { notifyContacts: true }))).toBe(true);
    expect(offersSafetyPackage(timerExpiringIn(-1, { notifyContacts: false }))).toBe(false);
    expect(offersSafetyPackage(null)).toBe(false);
  });

  it("formats the remaining countdown, flooring at zero", () => {
    expect(formatRemaining(-5000)).toBe("00:00");
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(65_000)).toBe("01:05");
    expect(formatRemaining(3_661_000)).toBe("01:01:01");
  });
});
