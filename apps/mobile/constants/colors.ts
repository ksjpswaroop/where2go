/**
 * SafeTrip design tokens — deep-navy theme with ocean-blue accents.
 *
 * The app is dark-only by design ("battery life is a safety feature"),
 * so the `light` and `dark` palettes are identical. This keeps the
 * useColors() hook working regardless of the device appearance setting.
 */

const palette = {
  // Legacy aliases
  text: "#F1F5F9",
  tint: "#0EA5E9",

  // Core surfaces
  background: "#0B1120",
  foreground: "#F1F5F9",

  // Cards / elevated surfaces (glass)
  card: "#141E33",
  cardForeground: "#F1F5F9",
  glass: "rgba(20,30,51,0.72)",

  // Primary action (ocean blue)
  primary: "#0EA5E9",
  primaryLight: "#38BDF8",
  primaryForeground: "#FFFFFF",

  // Secondary surfaces
  secondary: "#1E293B",
  secondaryForeground: "#F1F5F9",

  // Muted elements
  muted: "#1E293B",
  mutedForeground: "#94A3B8",

  // Accent
  accent: "#0EA5E9",
  accentForeground: "#FFFFFF",

  // Emergencies only (rose red)
  destructive: "#F43F5E",
  destructiveForeground: "#FFFFFF",

  // Status
  success: "#10B981",
  warning: "#F59E0B",

  // Borders and inputs
  border: "rgba(255,255,255,0.08)",
  input: "rgba(255,255,255,0.12)",
};

const colors = {
  light: palette,
  dark: palette,
  radius: 18,
};

export default colors;
