import type { PlanRequest, PlanResponse } from "@where2go/schemas";

export type PlanningClientConfig = {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null>;
};

export function createPlanningClient(config: PlanningClientConfig) {
  const headers = async (): Promise<Record<string, string>> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const token = config.getAuthToken ? await config.getAuthToken() : null;
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };

  return {
    async generatePlan(body: PlanRequest): Promise<PlanResponse> {
      const res = await fetch(`${config.baseUrl}/api/plans/generate`, {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Plan generation failed (${res.status}): ${err}`);
      }
      return res.json() as Promise<PlanResponse>;
    },
  };
}
