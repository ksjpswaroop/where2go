import * as Location from "expo-location";

import type { LocationInput } from "@where2go/schemas";

import { getCurrentCoords } from "./location";

/** Priority: active trip destination → GPS → Austin fallback */
export async function resolvePlanLocation(activeTripDestination?: string | null): Promise<LocationInput> {
  const coords = await getCurrentCoords();
  if (coords) {
    return {
      lat: coords.latitude,
      lng: coords.longitude,
      label: activeTripDestination ?? coords.locationName ?? "Current location",
    };
  }

  if (activeTripDestination) {
    try {
      const results = await Location.geocodeAsync(activeTripDestination);
      const first = results[0];
      if (first) {
        return {
          lat: first.latitude,
          lng: first.longitude,
          label: activeTripDestination,
        };
      }
    } catch {
      // fall through
    }
  }

  return { lat: 30.2672, lng: -97.7431, label: "Austin, TX" };
}
