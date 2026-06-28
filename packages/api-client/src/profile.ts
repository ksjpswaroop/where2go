import type { FeedbackRequest, Profile, ShareRequest } from "@where2go/schemas";

import type { PlanningClientConfig } from "./planning";

export function createProfileClient(config: PlanningClientConfig) {
  const headers = async (): Promise<Record<string, string>> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const token = config.getAuthToken ? await config.getAuthToken() : null;
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };

  return {
    async getProfile(): Promise<Profile> {
      const res = await fetch(`${config.baseUrl}/api/profiles/me`, {
        headers: await headers(),
      });
      if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`);
      return res.json() as Promise<Profile>;
    },

    async updateProfile(body: Partial<Profile>): Promise<Profile> {
      const res = await fetch(`${config.baseUrl}/api/profiles/me`, {
        method: "PUT",
        headers: await headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Profile update failed (${res.status})`);
      return res.json() as Promise<Profile>;
    },

    async submitFeedback(planId: string, body: FeedbackRequest): Promise<void> {
      const res = await fetch(`${config.baseUrl}/api/plans/${planId}/feedback`, {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Feedback failed (${res.status})`);
    },

    async sharePlan(planId: string, body: ShareRequest): Promise<{ token: string; url: string }> {
      const res = await fetch(`${config.baseUrl}/api/plans/${planId}/share`, {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Share failed (${res.status})`);
      return res.json() as Promise<{ token: string; url: string }>;
    },
  };
}
