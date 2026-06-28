import { createHiddenGemsClient, type HiddenGem } from "@where2go/api-client/hiddenGems";

const baseUrl = process.env.EXPO_PUBLIC_PLANNING_API_URL ?? "http://localhost:3000";

export function getHiddenGemsClient(getAuthToken?: () => Promise<string | null>) {
  return createHiddenGemsClient({ baseUrl, getAuthToken });
}

export type { HiddenGem };

export async function fetchHiddenGems(
  lat: number,
  lng: number,
  cityName?: string,
  getAuthToken?: () => Promise<string | null>,
): Promise<HiddenGem[]> {
  const client = getHiddenGemsClient(getAuthToken);
  return client.fetchGems({ lat, lng, cityName });
}
