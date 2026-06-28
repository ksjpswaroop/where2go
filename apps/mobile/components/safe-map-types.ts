export type MapMarkerKind = "plan_stop" | "gem" | "checkin" | "journal" | "trip";

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  kind: MapMarkerKind;
  index?: number;
  data?: Record<string, unknown>;
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type SafeMapProps = {
  region: MapRegion | null;
  markers: MapMarker[];
  onMarkerPress?: (marker: MapMarker) => void;
  onRegionChange?: (region: MapRegion) => void;
  height?: number;
};

export const MARKER_COLORS: Record<MapMarkerKind, string> = {
  plan_stop: "#0EA5E9",
  gem: "#F59E0B",
  checkin: "#10B981",
  journal: "#A855F7",
  trip: "#F43F5E",
};
