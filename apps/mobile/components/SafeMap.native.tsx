import React, { useRef } from "react";
import { Platform, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { IconCircle, Txt } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import type { MapMarker, SafeMapProps } from "@/components/safe-map-types";
import { MARKER_COLORS } from "@/components/safe-map-types";

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

function markerPinColor(kind: MapMarker["kind"]) {
  return MARKER_COLORS[kind] ?? MARKER_COLORS.plan_stop;
}

export default function SafeMap({
  region,
  markers,
  onMarkerPress,
  onRegionChange,
  height = 360,
}: SafeMapProps) {
  const c = useColors();
  const mapRef = useRef<MapView>(null);

  if (!region) {
    return (
      <View
        style={{
          height,
          borderRadius: c.radius,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <IconCircle icon="navigate" color={c.primaryLight} bg={c.secondary} size={52} />
        <Txt size={14} color={c.mutedForeground}>
          Finding your location…
        </Txt>
      </View>
    );
  }

  return (
    <View
      style={{
        height,
        borderRadius: c.radius,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS !== "web" && GOOGLE_KEY ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
        onRegionChangeComplete={(r) =>
          onRegionChange?.({
            latitude: r.latitude,
            longitude: r.longitude,
            latitudeDelta: r.latitudeDelta,
            longitudeDelta: r.longitudeDelta,
          })
        }
      >
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.title}
            description={m.description}
            pinColor={markerPinColor(m.kind)}
            onPress={() => onMarkerPress?.(m)}
          />
        ))}
      </MapView>
    </View>
  );
}
