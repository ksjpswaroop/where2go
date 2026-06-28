import type { PlanningClientConfig } from "./planning";

export type HiddenGem = {
  title: string;
  address?: string;
  lat: number;
  lng: number;
  category?: string;
  rating?: number;
  userRatingAverage?: number;
  userReviewsCount?: number;
  description?: string;
  reviews?: Array<{ username: string; rating: number; comment: string }>;
};

export type HiddenGemsRequest = {
  lat: number;
  lng: number;
  cityName?: string;
};

export function createHiddenGemsClient(config: PlanningClientConfig) {
  const headers = async (): Promise<Record<string, string>> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const token = config.getAuthToken ? await config.getAuthToken() : null;
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };

  return {
    async fetchGems(body: HiddenGemsRequest): Promise<HiddenGem[]> {
      const res = await fetch(`${config.baseUrl}/api/hidden-gems`, {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Hidden gems failed (${res.status}): ${err}`);
      }
      const data = (await res.json()) as { gems?: HiddenGem[] };
      return data.gems ?? [];
    },
  };
}
