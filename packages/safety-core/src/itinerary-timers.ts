export type ItineraryStop = {
  id: string;
  title: string;
  arriveBy?: string;
  durationMinutes?: number;
  lat?: number;
  lng?: number;
};

export type SuggestedSafetyTimer = {
  stopId: string;
  stopTitle: string;
  durationMinutes: number;
  label: string;
};

const DEFAULT_STOP_TIMER_MINUTES = 90;

/** Suggest safety timers for each itinerary stop in Solo Travel mode. */
export function suggestTimersForItinerary(stops: ItineraryStop[]): SuggestedSafetyTimer[] {
  return stops.map((stop) => {
    const duration = stop.durationMinutes ?? DEFAULT_STOP_TIMER_MINUTES;
    const arrive = stop.arriveBy ? ` by ${stop.arriveBy}` : "";
    return {
      stopId: stop.id,
      stopTitle: stop.title,
      durationMinutes: duration,
      label: `Check in at ${stop.title}${arrive} (${duration} min timer)`,
    };
  });
}
