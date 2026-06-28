import colors from "@/constants/colors";

/**
 * Returns the SafeTrip design tokens.
 *
 * SafeTrip is dark-only by design ("battery life is a safety feature"), so the
 * `light` and `dark` palettes are identical and the device appearance setting
 * does not change the look. The `dark` palette is always used.
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
