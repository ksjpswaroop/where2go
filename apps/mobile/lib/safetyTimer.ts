/**
 * Pure helpers for the safety-timer expiry / escalation flow.
 *
 * When an active safety timer crosses zero the dashboard must escalate exactly
 * once: mark the timer expired and prompt the traveler to confirm safety (and,
 * if the timer notifies contacts, offer to send the safety package). This logic
 * is safety-critical, so it lives here as pure functions that can be unit-tested
 * without rendering the screen.
 */

export interface TimerLike {
  id: number;
  expiresAt: string;
  notifyContacts: boolean;
}

/** Milliseconds left until the timer expires (negative once it has passed). */
export function getRemainingMs(expiresAt: string, now: number): number {
  return new Date(expiresAt).getTime() - now;
}

/** True once an active timer has reached or passed its expiry time. */
export function isTimerExpired(
  timer: Pick<TimerLike, "expiresAt"> | null | undefined,
  now: number,
): boolean {
  if (!timer) return false;
  return getRemainingMs(timer.expiresAt, now) <= 0;
}

/**
 * Whether the dashboard should run the expiry escalation right now.
 *
 * Returns true only when an active timer is expired AND its escalation has not
 * already been handled (tracked by the id of the last-handled timer). This guard
 * is what guarantees the escalation fires exactly once per timer.
 */
export function shouldEscalateExpiry(
  timer: TimerLike | null | undefined,
  now: number,
  handledTimerId: number | null,
): boolean {
  if (!timer) return false;
  if (!isTimerExpired(timer, now)) return false;
  return handledTimerId !== timer.id;
}

/** Whether expiry should offer to send the safety package to contacts. */
export function offersSafetyPackage(
  timer: Pick<TimerLike, "notifyContacts"> | null | undefined,
): boolean {
  return !!timer?.notifyContacts;
}

/** Format a remaining-millisecond value as MM:SS (or HH:MM:SS past an hour). */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
