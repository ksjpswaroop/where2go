import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import type { PlanResponse } from "@where2go/schemas";

import { Card, Txt } from "@/components/ui";
import { spacing } from "@/constants/spacing";
import { useColors } from "@/hooks/useColors";
import { useMapLayers } from "@/context/MapLayersContext";

type Props = {
  plan: PlanResponse;
  onRate?: (positive: boolean) => void;
};

export function ItineraryTimeline({ plan, onRate }: Props) {
  const c = useColors();
  const router = useRouter();
  const { setFocusMarkerId } = useMapLayers();
  const { bestPlan } = plan;

  const focusStop = (stopId: string) => {
    setFocusMarkerId(`plan-${stopId}`);
    router.push("/map");
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: 8 }}>
        <Txt weight="semibold" size={17}>
          {bestPlan.title}
        </Txt>
        {bestPlan.summary ? (
          <Txt size={13} color={c.mutedForeground}>
            {bestPlan.summary}
          </Txt>
        ) : null}
        {bestPlan.estimatedTotalCost ? (
          <Txt size={13} color={c.mutedForeground}>
            Est. ${bestPlan.estimatedTotalCost.min}–${bestPlan.estimatedTotalCost.max}
          </Txt>
        ) : null}
      </Card>

      {bestPlan.stops.map((stop, idx) => (
        <Pressable key={stop.id} onPress={() => focusStop(stop.id)}>
          <Card style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: c.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt weight="bold" size={13} color={c.primaryForeground}>
                {idx + 1}
              </Txt>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt weight="semibold">{stop.title}</Txt>
              {stop.startTime ? (
                <Txt size={12} color={c.mutedForeground}>
                  {stop.startTime}
                  {stop.durationMinutes ? ` · ${stop.durationMinutes} min` : ""}
                </Txt>
              ) : null}
              {stop.safetyBadge ? (
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
              ) : null}
            </View>
            <Ionicons name="map-outline" size={18} color={c.primaryLight} />
          </Card>
        </Pressable>
      ))}

      {onRate ? (
        <View style={{ flexDirection: "row", gap: 12, justifyContent: "center" }}>
          <Pressable onPress={() => onRate(true)}>
            <Ionicons name="thumbs-up-outline" size={24} color={c.success} />
          </Pressable>
          <Pressable onPress={() => onRate(false)}>
            <Ionicons name="thumbs-down-outline" size={24} color={c.destructive} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
