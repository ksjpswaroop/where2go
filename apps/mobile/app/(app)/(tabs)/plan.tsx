import { useAuth } from "@clerk/expo";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Share, View } from "react-native";
import { createPlanningClient } from "@where2go/api-client/planning";
import { createProfileClient } from "@where2go/api-client/profile";
import type { PlanRequest } from "@where2go/schemas";
import { suggestTimersForItinerary } from "@where2go/safety-core/itinerary-timers";

import { AppHeader } from "@/components/AppHeader";
import { ItineraryTimeline } from "@/components/planner/ItineraryTimeline";
import { ProfileSheet } from "@/components/planner/ProfileSheet";
import { QuickPlanForm } from "@/components/planner/QuickPlanForm";
import { Button, Card, EmptyState, Screen, SectionTitle, Txt } from "@/components/ui";
import { spacing } from "@/constants/spacing";
import { useActivePlan } from "@/context/ActivePlanContext";
import { useProductMode } from "@/context/ProductModeContext";
import { useColors } from "@/hooks/useColors";
import { savePlanOffline } from "@/lib/offlinePlans";
import { resolvePlanLocation } from "@/lib/planLocation";
import { useGetDashboardSummary } from "@where2go/safety-api-client";

const baseUrl = process.env.EXPO_PUBLIC_PLANNING_API_URL ?? "http://localhost:3000";

export default function PlanScreen() {
  const c = useColors();
  const router = useRouter();
  const { getToken } = useAuth();
  const { mode, isSoloTravel } = useProductMode();
  const { plan, setPlan } = useActivePlan();
  const { data: summary } = useGetDashboardSummary();
  const [profileOpen, setProfileOpen] = useState(false);

  const planningClient = createPlanningClient({ baseUrl, getAuthToken: getToken });
  const profileClient = createProfileClient({ baseUrl, getAuthToken: getToken });

  const planMutation = useMutation({
    mutationFn: async (partial: Partial<PlanRequest>) => {
      const location = await resolvePlanLocation(summary?.activeTrip?.destination);
      return planningClient.generatePlan({
        queryText: partial.queryText ?? "Family-friendly outing today",
        location,
        date: new Date().toISOString().slice(0, 10),
        party: { adults: mode === "solo_travel" ? 1 : 2, kidsAges: [] },
        budgetMax: partial.budgetMax ?? 100,
        driveTimeMaxMinutes: partial.driveTimeMaxMinutes ?? 30,
        indoorOutdoorPreference: "either",
        mealNeeded: "none",
        accessibilityNeeds: [],
        interests: mode === "solo_travel" ? ["cafes", "museums"] : ["parks", "museums"],
        avoid: mode === "solo_travel" ? ["bars"] : [],
      });
    },
    onSuccess: (result) => setPlan(result),
  });

  const suggestedTimers =
    plan && isSoloTravel
      ? suggestTimersForItinerary(
          plan.bestPlan.stops.map((s) => ({
            id: s.id,
            title: s.title,
            durationMinutes: s.durationMinutes,
            arriveBy: s.startTime,
            lat: s.location?.lat,
            lng: s.location?.lng,
          })),
        )
      : [];

  const handleShare = async () => {
    if (!plan) return;
    try {
      const { url } = await profileClient.sharePlan(plan.planId, {
        expiresInDays: 14,
        includeCost: true,
        includeHomeLocation: false,
      });
      await Share.share({ message: url, url });
    } catch {
      Alert.alert("Share failed", "Could not create share link.");
    }
  };

  const handleSave = async () => {
    if (!plan) return;
    await savePlanOffline(plan);
    Alert.alert("Saved", "Plan saved for offline viewing.");
  };

  const handleRate = async (positive: boolean) => {
    if (!plan) return;
    try {
      await profileClient.submitFeedback(plan.planId, {
        action: positive ? "accepted" : "rejected",
        target: "bestPlan",
        attended: false,
      });
      Alert.alert("Thanks", "Your feedback helps improve plans.");
    } catch {
      Alert.alert("Feedback failed", "Please try again.");
    }
  };

  return (
    <Screen>
      <AppHeader title="Plan" />
      <View style={{ flexDirection: "row", gap: 10, marginBottom: spacing.lg }}>
        <Button title="Profile" variant="secondary" onPress={() => setProfileOpen(true)} />
        {plan ? (
          <>
            <Button title="Share" variant="secondary" onPress={() => void handleShare()} />
            <Button title="Save" variant="secondary" onPress={() => void handleSave()} />
          </>
        ) : null}
      </View>

      {!plan ? (
        <>
          <QuickPlanForm onGenerate={(p) => planMutation.mutate(p)} isLoading={planMutation.isPending} />
          {planMutation.error ? (
            <Txt color={c.destructive} style={{ marginTop: spacing.md }}>
              {planMutation.error instanceof Error ? planMutation.error.message : "Plan failed"}
            </Txt>
          ) : null}
          <EmptyState
            icon="calendar-outline"
            title="No active plan"
            subtitle="Generate a plan above or ask MapChat on the Chat tab."
          />
        </>
      ) : (
        <>
          <ItineraryTimeline plan={plan} onRate={(v) => void handleRate(v)} />
          {suggestedTimers.length > 0 && (
            <>
              <SectionTitle>Suggested safety timers</SectionTitle>
              <Card style={{ gap: 8 }}>
                {suggestedTimers.map((t) => (
                  <Txt key={t.stopId} size={13} color={c.mutedForeground}>
                    • {t.label}
                  </Txt>
                ))}
                <Button title="Arm timer in Safe tab" variant="secondary" onPress={() => router.push("/timer")} />
              </Card>
            </>
          )}
          <Button title="New plan" variant="ghost" onPress={() => setPlan(null)} style={{ marginTop: spacing.lg }} />
        </>
      )}

      <ProfileSheet visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </Screen>
  );
}
