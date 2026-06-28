import * as SMS from "expo-sms";
import { Alert, Linking, Platform } from "react-native";

import { Coords, directionsUrl, getCurrentCoords, mapsUrl } from "./location";

export type SafetyContext = {
  /** Traveler's display name, included in the alert greeting. */
  name?: string | null;
  /** Battery charge as a 0–1 fraction (as reported by expo-battery). */
  batteryLevel?: number | null;
  isCharging?: boolean | null;
  /** Active trip destination, if any. */
  destination?: string | null;
};

export type SafetyPackageOptions = {
  /**
   * Whether to fetch and include the traveler's live location. Defaults to
   * true. Set to false to honor a safety timer whose `shareLocation` is off —
   * the alert is still sent, but without coordinates, a map link, or a route.
   */
  includeLocation?: boolean;
};

export async function buildSafetyMessage(
  ctx: SafetyContext = {},
  options: SafetyPackageOptions = {},
): Promise<{ message: string; coords: Coords | null }> {
  const includeLocation = options.includeLocation ?? true;
  const coords = includeLocation ? await getCurrentCoords() : null;
  const who = ctx.name?.trim();

  const lines: string[] = [
    `🆘 Where2Go alert${who ? ` from ${who}` : ""}. I may need help and wanted to share my current status with you.`,
    "",
  ];

  if (typeof ctx.batteryLevel === "number") {
    const pct = Math.round(ctx.batteryLevel * 100);
    lines.push(`Battery: ${pct}%${ctx.isCharging ? " (charging)" : ""}`);
  }

  if (!includeLocation) {
    lines.push("Location sharing is off for this alert.");
  } else if (coords) {
    lines.push(
      `Last known location: ${
        coords.locationName ? coords.locationName + " — " : ""
      }${mapsUrl(coords.latitude, coords.longitude)}`,
    );
  } else {
    lines.push("Last known location: currently unavailable");
  }

  const destination = ctx.destination?.trim();
  if (destination) {
    lines.push(`Destination: ${destination}`);
    if (includeLocation) {
      lines.push(`Route: ${directionsUrl(destination, coords)}`);
    }
  }

  lines.push("");
  lines.push("Sent via Where2Go.");

  return { message: lines.join("\n"), coords };
}

/**
 * Opens the native SMS composer addressed to the given phone numbers with a
 * pre-filled safety message containing battery level, last known location,
 * destination and route. The user must press send themselves — SafeTrip never
 * sends messages silently.
 */
export async function sendSafetyPackage(
  phones: string[],
  ctx: SafetyContext = {},
  options: SafetyPackageOptions = {},
): Promise<{ sent: boolean; coords: Coords | null }> {
  if (phones.length === 0) {
    Alert.alert("No contacts", "Add at least one emergency contact first.");
    return { sent: false, coords: null };
  }

  const { message, coords } = await buildSafetyMessage(ctx, options);

  if (Platform.OS !== "web") {
    try {
      const available = await SMS.isAvailableAsync();
      if (available) {
        await SMS.sendSMSAsync(phones, message);
        return { sent: true, coords };
      }
    } catch {
      // fall through to sms: deep link
    }
  }

  const url = `sms:${phones.join(",")}?body=${encodeURIComponent(message)}`;
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return { sent: true, coords };
    }
  } catch {
    // ignore
  }

  Alert.alert(
    "SMS unavailable",
    "This device can't open the messaging app. Your location was still recorded.",
  );
  return { sent: false, coords };
}
