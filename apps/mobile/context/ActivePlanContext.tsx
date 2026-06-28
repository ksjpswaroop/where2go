import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { PlanResponse } from "@where2go/schemas";
import { planResponseToItinerary, type ItineraryData } from "@where2go/core";

type ActivePlanContextValue = {
  plan: PlanResponse | null;
  itinerary: ItineraryData | null;
  setPlan: (plan: PlanResponse | null) => void;
  clearPlan: () => void;
};

const ActivePlanContext = createContext<ActivePlanContextValue | null>(null);

export function ActivePlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlanState] = useState<PlanResponse | null>(null);

  const setPlan = useCallback((next: PlanResponse | null) => {
    setPlanState(next);
  }, []);

  const clearPlan = useCallback(() => setPlanState(null), []);

  const itinerary = useMemo(
    () => (plan ? planResponseToItinerary(plan) : null),
    [plan],
  );

  const value = useMemo(
    () => ({ plan, itinerary, setPlan, clearPlan }),
    [plan, itinerary, setPlan, clearPlan],
  );

  return <ActivePlanContext.Provider value={value}>{children}</ActivePlanContext.Provider>;
}

export function useActivePlan() {
  const ctx = useContext(ActivePlanContext);
  if (!ctx) throw new Error("useActivePlan must be used within ActivePlanProvider");
  return ctx;
}
