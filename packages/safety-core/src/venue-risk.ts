export type VenueRiskSignal = {
  venueId: string;
  feltUnsafe?: boolean;
  tooCrowded?: boolean;
  checkInCount?: number;
  hotelScanScore?: number;
};

const UNSAFE_PENALTY = 15;
const CROWDED_PENALTY = 5;
const CHECKIN_BONUS = 2;

/** Merge plan feedback + safety telemetry into a venue risk adjustment (-30..+10). */
export function computeVenueRiskAdjustment(signal: VenueRiskSignal): number {
  let delta = 0;
  if (signal.feltUnsafe) delta -= UNSAFE_PENALTY;
  if (signal.tooCrowded) delta -= CROWDED_PENALTY;
  if (signal.checkInCount && signal.checkInCount > 0) {
    delta += Math.min(10, signal.checkInCount * CHECKIN_BONUS);
  }
  if (signal.hotelScanScore != null && signal.hotelScanScore < 45) {
    delta -= 10;
  }
  return Math.max(-30, Math.min(10, delta));
}

export function applyVenueRiskToScore(baseScore: number, adjustment: number): number {
  return Math.max(0, Math.min(100, Math.round(baseScore + adjustment)));
}
