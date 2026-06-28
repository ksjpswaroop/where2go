import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createPlanningClient } from "@where2go/api-client/planning";
import { suggestTimersForItinerary } from "@where2go/safety-core/itinerary-timers";

import { Button, Card, Screen, SectionTitle, Txt } from "@/components/ui";
import { useProductMode } from "@/context/ProductModeContext";
import { useColors } from "@/hooks/useColors";

const planningClient = createPlanningClient({
  baseUrl: process.env.EXPO_PUBLIC_PLANNING_API_URL ?? "http://localhost:3000",
});

export default function ExploreScreen() {
  const c = useColors();
  const { mode } = useProductMode();
  const [suggestedTimers, setSuggestedTimers] = useState<
    ReturnType<typeof suggestTimersForItinerary>
  >([]);

  const planMutation = useMutation({
    mutationFn: () =>
      planningClient.generatePlan({
        queryText:
          mode === "solo_travel"
            ? "Safe solo outing near my hotel tonight, well-lit and easy to reach"
            : "Family-friendly outing today under budget with indoor backup",
        location: { lat: 30.2672, lng: -97.7431, label: "Austin, TX" },
        date: new Date().toISOString().slice(0, 10),
        party: { adults: mode === "solo_travel" ? 1 : 2, kidsAges: [] },
        budgetMax: 80,
        driveTimeMaxMinutes: 25,
        indoorOutdoorPreference: "either",
        mealNeeded: "none",
        accessibilityNeeds: [],
        interests: mode === "solo_travel" ? ["museums", "cafes"] : ["parks", "museums"],
        avoid: ["bars"],
      }),
    onSuccess: (plan) => {
      const stops = plan.bestPlan.stops.map((s) => ({
        id: s.id,
        title: s.title,
        durationMinutes: s.durationMinutes,
        arriveBy: s.startTime,
        lat: s.location?.lat,
        lng: s.location?.lng,
      }));
      setSuggestedTimers(suggestTimersForItinerary(stops));
    },
  });

  return (
    <Screen>
      <Txt weight="extrabold" size={26} style={{ marginBottom: 8 }}>
        Explore
      </Txt>
      <Txt size={14} color={c.mutedForeground} style={{ marginBottom: 16 }}>
        {mode === "solo_travel"
          ? "Generate safe plans near your trip and arm check-in timers at each stop."
          : "Generate a Family Day plan with venue safety badges."}
      </Txt>

      <Button
        title={planMutation.isPending ? "Planning…" : "Generate plan"}
        onPress={() => planMutation.mutate()}
        disabled={planMutation.isPending}
        loading={planMutation.isPending}
      />

      {planMutation.isPending && (
        <ActivityIndicator color={c.primary} style={{ marginTop: 16 }} />
      )}

      {planMutation.data && (
        <Card style={{ marginTop: 20, gap: 8 }}>
          <Txt weight="semibold" size={17}>
            {planMutation.data.bestPlan.title}
          </Txt>
          {planMutation.data.bestPlan.stops.map((stop) => (
            <View key={stop.id} style={{ gap: 4 }}>
              <Txt weight="medium">{stop.title}</Txt>
              {stop.safetyBadge && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons
                    name={
                      stop.safetyBadge.label === "safe"
                        ? "shield-checkmark"
                        : stop.safetyBadge.label === "caution"
                          ? "alert-circle"
                          : "warning"
                    }
                    size={14}
                    color={
                      stop.safetyBadge.label === "safe"
                        ? c.success
                        : stop.safetyBadge.label === "caution"
                          ? c.warning
                          : c.destructive
                    }
                  />
                  <Txt size={12} color={c.mutedForeground}>
                    Safety {stop.safetyBadge.overallScore}/100
                  </Txt>
                </View>
              )}
            </View>
          ))}
        </Card>
      )}

      {suggestedTimers.length > 0 && mode === "solo_travel" && (
        <>
          <SectionTitle>Suggested safety timers</SectionTitle>
          <Card style={{ gap: 8 }}>
            {suggestedTimers.map((t) => (
              <Txt key={t.stopId} size={13} color={c.mutedForeground}>
                • {t.label}
              </Txt>
            ))}
          </Card>
        </>
      )}

      {planMutation.error && (
        <Txt color={c.destructive} style={{ marginTop: 16 }}>
          {planMutation.error instanceof Error
            ? planMutation.error.message
            : "Plan generation failed"}
        </Txt>
      )}
    </Screen>
  );
}
