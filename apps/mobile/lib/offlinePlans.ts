import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PlanResponse } from "@where2go/schemas";

const KEY = "where2go.offlinePlans";

export type SavedPlan = {
  id: string;
  savedAt: string;
  plan: PlanResponse;
};

export async function savePlanOffline(plan: PlanResponse): Promise<void> {
  const existing = await listOfflinePlans();
  const entry: SavedPlan = {
    id: plan.planId,
    savedAt: new Date().toISOString(),
    plan,
  };
  const next = [entry, ...existing.filter((p) => p.id !== plan.planId)].slice(0, 20);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function listOfflinePlans(): Promise<SavedPlan[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedPlan[];
  } catch {
    return [];
  }
}

export async function removeOfflinePlan(planId: string): Promise<void> {
  const existing = await listOfflinePlans();
  await AsyncStorage.setItem(KEY, JSON.stringify(existing.filter((p) => p.id !== planId)));
}
