import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { useListCheckIns } from "@where2go/safety-api-client";

import { AppHeader } from "@/components/AppHeader";
import { GemDetailSheet } from "@/components/map/GemDetailSheet";
import SafeMap from "@/components/SafeMap";
import type { MapMarker, MapRegion } from "@/components/safe-map-types";
import { Button, Card, EmptyState, Screen, Txt } from "@/components/ui";
import { spacing } from "@/constants/spacing";
import { useActivePlan } from "@/context/ActivePlanContext";
import { useMapLayers, type MapLayer } from "@/context/MapLayersContext";
import { useColors } from "@/hooks/useColors";
import { fetchHiddenGems, type HiddenGem } from "@/lib/hiddenGems";
import { listJournalEntries, type JournalEntry } from "@/lib/journal";
import { getCurrentCoords } from "@/lib/location";

const LAYER_LABELS: Record<MapLayer, string> = {
  plan: "Plan",
  gems: "Gems",
  safety: "Safety",
  journal: "Journal",
};

const CHECKIN_LABEL: Record<string, string> = {
  landed: "Landed",
  reached_hotel: "Reached hotel",
  leaving_hotel: "Leaving hotel",
  custom: "Check-in",
};

export default function MapScreen() {
  const c = useColors();
  const router = useRouter();
  const { getToken } = useAuth();
  const { plan } = useActivePlan();
  const { layers, toggleLayer, setMapCenter, focusMarkerId } = useMapLayers();
  const { data: checkIns } = useListCheckIns();

  const [region, setRegion] = useState<MapRegion | null>(null);
  const [gems, setGems] = useState<HiddenGem[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [selectedGem, setSelectedGem] = useState<HiddenGem | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    void getCurrentCoords().then((coords) => {
      if (!coords) return;
      setRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      setMapCenter({ lat: coords.latitude, lng: coords.longitude });
    });
  }, [setMapCenter]);

  useEffect(() => {
    if (!layers.has("journal")) return;
    void listJournalEntries(getToken).then(setJournalEntries).catch(() => {});
  }, [layers, getToken]);

  const scanGems = useCallback(async () => {
    if (!region) return;
    setScanning(true);
    try {
      const results = await fetchHiddenGems(
        region.latitude,
        region.longitude,
        undefined,
        getToken,
      );
      setGems(results);
    } finally {
      setScanning(false);
    }
  }, [region, getToken]);

  const markers: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = [];

    if (layers.has("plan") && plan) {
      plan.bestPlan.stops.forEach((stop, idx) => {
        if (stop.location?.lat == null || stop.location?.lng == null) return;
        out.push({
          id: `plan-${stop.id}`,
          latitude: stop.location.lat,
          longitude: stop.location.lng,
          title: stop.title,
          description: stop.startTime,
          kind: "plan_stop",
          index: idx + 1,
        });
      });
    }

    if (layers.has("gems")) {
      gems.forEach((g, i) => {
        out.push({
          id: `gem-${i}-${g.title}`,
          latitude: g.lat,
          longitude: g.lng,
          title: g.title,
          description: g.description,
          kind: "gem",
          data: g as unknown as Record<string, unknown>,
        });
      });
    }

    if (layers.has("safety")) {
      (checkIns ?? [])
        .filter((ci) => ci.latitude != null && ci.longitude != null)
        .forEach((ci) => {
          out.push({
            id: `checkin-${ci.id}`,
            latitude: ci.latitude!,
            longitude: ci.longitude!,
            title: CHECKIN_LABEL[ci.type] ?? "Check-in",
            description: ci.locationName ?? undefined,
            kind: "checkin",
          });
        });
    }

    if (layers.has("journal")) {
      journalEntries
        .filter((j) => j.latitude != null && j.longitude != null)
        .forEach((j) => {
          out.push({
            id: `journal-${j.id}`,
            latitude: j.latitude!,
            longitude: j.longitude!,
            title: j.title ?? "Journal note",
            description: j.body.slice(0, 80),
            kind: "journal",
          });
        });
    }

    return out;
  }, [layers, plan, gems, checkIns, journalEntries]);

  const handleMarkerPress = (marker: MapMarker) => {
    if (marker.kind === "gem" && marker.data) {
      setSelectedGem(marker.data as unknown as HiddenGem);
    }
  };

  return (
    <Screen scroll={false}>
      <AppHeader title="Map" />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md }}>
        {(Object.keys(LAYER_LABELS) as MapLayer[]).map((layer) => (
          <Pressable
            key={layer}
            onPress={() => toggleLayer(layer)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: layers.has(layer) ? c.primary : c.secondary,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Txt size={12} color={layers.has(layer) ? c.primaryForeground : c.foreground}>
              {LAYER_LABELS[layer]}
            </Txt>
          </Pressable>
        ))}
        {layers.has("gems") ? (
          <Button
            title={scanning ? "Scanning…" : "Scan area"}
            variant="secondary"
            onPress={() => void scanGems()}
            loading={scanning}
          />
        ) : null}
        {layers.has("journal") ? (
          <Button title="Add note" variant="secondary" onPress={() => router.push("/journal")} />
        ) : null}
      </View>

      <SafeMap
        region={region}
        markers={markers}
        onMarkerPress={handleMarkerPress}
        onRegionChange={(r) => {
          setRegion(r);
          setMapCenter({ lat: r.latitude, lng: r.longitude });
        }}
        height={420}
      />

      {focusMarkerId ? (
        <Card style={{ marginTop: spacing.md }}>
          <Txt size={13} color={c.mutedForeground}>
            Focused marker: {focusMarkerId}
          </Txt>
        </Card>
      ) : null}

      {markers.length === 0 ? (
        <EmptyState
          icon="map-outline"
          title="No pins yet"
          subtitle="Generate a plan, scan for gems, or check in from the Safe tab."
        />
      ) : null}

      <GemDetailSheet
        gem={selectedGem}
        onClose={() => setSelectedGem(null)}
        onAddToPlan={() => {
          setSelectedGem(null);
          router.push("/plan");
        }}
      />
    </Screen>
  );
}
