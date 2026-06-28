import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useProductMode } from "./ProductModeContext";

export type MapLayer = "plan" | "gems" | "safety" | "journal";

type MapLayersContextValue = {
  layers: Set<MapLayer>;
  toggleLayer: (layer: MapLayer) => void;
  setLayer: (layer: MapLayer, on: boolean) => void;
  showAll: () => void;
  focusMarkerId: string | null;
  setFocusMarkerId: (id: string | null) => void;
  mapCenter: { lat: number; lng: number } | null;
  setMapCenter: (center: { lat: number; lng: number } | null) => void;
};

const MapLayersContext = createContext<MapLayersContextValue | null>(null);

const DEFAULT_FAMILY: MapLayer[] = ["plan", "gems"];
const DEFAULT_SOLO: MapLayer[] = ["plan", "gems", "safety"];

export function MapLayersProvider({ children }: { children: React.ReactNode }) {
  const { isSoloTravel } = useProductMode();
  const [layers, setLayers] = useState<Set<MapLayer>>(
    () => new Set(isSoloTravel ? DEFAULT_SOLO : DEFAULT_FAMILY),
  );
  const [focusMarkerId, setFocusMarkerId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    setLayers(new Set(isSoloTravel ? DEFAULT_SOLO : DEFAULT_FAMILY));
  }, [isSoloTravel]);

  const toggleLayer = useCallback((layer: MapLayer) => {
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }, []);

  const setLayer = useCallback((layer: MapLayer, on: boolean) => {
    setLayers((prev) => {
      const next = new Set(prev);
      if (on) next.add(layer);
      else next.delete(layer);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setLayers(new Set(["plan", "gems", "safety", "journal"]));
  }, []);

  const value = useMemo(
    () => ({
      layers,
      toggleLayer,
      setLayer,
      showAll,
      focusMarkerId,
      setFocusMarkerId,
      mapCenter,
      setMapCenter,
    }),
    [layers, toggleLayer, setLayer, showAll, focusMarkerId, mapCenter],
  );

  return <MapLayersContext.Provider value={value}>{children}</MapLayersContext.Provider>;
}

export function useMapLayers() {
  const ctx = useContext(MapLayersContext);
  if (!ctx) throw new Error("useMapLayers must be used within MapLayersProvider");
  return ctx;
}
