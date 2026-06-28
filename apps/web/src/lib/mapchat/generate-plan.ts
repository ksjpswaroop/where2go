import { buildPlanResponse, NoPlanCandidatesError } from "@where2go/core";
import { PlanRequestSchema } from "@where2go/schemas";
import { explainPlanWithAI, searchRealWorldCandidates } from "@where2go/providers";
import { savePlan } from "@/lib/plan-store";
import { enrichPlanWithVenueSafety } from "@/lib/venue-safety";

export async function generatePlanFromRequest(body: unknown) {
  const parsed = PlanRequestSchema.parse(body);
  const providerResult = await searchRealWorldCandidates(parsed);
  let response = buildPlanResponse({
    request: parsed,
    candidates: providerResult.candidates,
    weather: providerResult.weather,
    providerStatus: providerResult.providerStatus,
  });

  const ai = await explainPlanWithAI(parsed, response.bestPlan);
  response.debug.aiStatus = ai.providerStatus;
  if (ai.summary) {
    response.bestPlan.summary = ai.summary;
  }
  if (ai.whyThisPlan && ai.whyThisPlan.reasons.length > 0) {
    response.bestPlan.whyThisPlan = ai.whyThisPlan;
  }

  response = enrichPlanWithVenueSafety(response);
  response.debug.storage = await savePlan(response);
  return response;
}

export { NoPlanCandidatesError };
