import * as Location from "expo-location";
import { Platform } from "react-native";

/**
 * Coarse permission state used by the settings screen to show travelers
 * whether a safety-critical permission is granted, blocked, or still
 * undecided. "unsupported" covers web, where these native permissions
 * don't apply.
 */
export type PermissionState = "granted" | "denied" | "undetermined" | "unsupported";

export type Coords = {
  latitude: number;
  longitude: number;
  locationName?: string;
};

export async function getCurrentCoords(): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
    let locationName: string | undefined;
    try {
      const places = await Location.reverseGeocodeAsync(coords);
      const p = places?.[0];
      if (p) {
        locationName = [p.name, p.city, p.region].filter(Boolean).join(", ");
      }
    } catch {
      // reverse geocode is best-effort
    }
    return { ...coords, locationName };
  } catch {
    return null;
  }
}

/** Current foreground-location permission state, without prompting. */
export async function getLocationPermissionStatus(): Promise<PermissionState> {
  if (Platform.OS === "web") return "unsupported";
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status === "granted") return "granted";
    if (perm.canAskAgain) return "undetermined";
    return "denied";
  } catch {
    return "undetermined";
  }
}

/**
 * Prompts for foreground-location permission if it hasn't been decided yet,
 * returning the resulting state. Used by the settings screen's "Enable" action.
 */
export async function requestLocationPermission(): Promise<PermissionState> {
  if (Platform.OS === "web") return "unsupported";
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status === "granted") return "granted";
    if (perm.canAskAgain) return "undetermined";
    return "denied";
  } catch {
    return "undetermined";
  }
}

export function mapsUrl(latitude: number, longitude: number) {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

/**
 * A Google Maps directions URL from the traveler's current position to their
 * trip destination — i.e. the route they're expected to be on.
 */
export function directionsUrl(
  destination: string,
  from?: { latitude: number; longitude: number } | null,
) {
  const dest = encodeURIComponent(destination);
  if (from) {
    return `https://maps.google.com/?saddr=${from.latitude},${from.longitude}&daddr=${dest}`;
  }
  return `https://maps.google.com/?daddr=${dest}`;
}
