import React from "react";

import { Card, IconCircle, Txt } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import type { SafeMapProps } from "@/components/safe-map-types";

export default function SafeMap(_props: SafeMapProps) {
  const c = useColors();
  return (
    <Card style={{ alignItems: "center", paddingVertical: 30 }}>
      <IconCircle icon="map" color={c.primaryLight} bg={c.secondary} size={56} />
      <Txt weight="semibold" size={16} style={{ marginTop: 12 }}>
        Map preview is on device
      </Txt>
      <Txt
        size={13}
        color={c.mutedForeground}
        style={{ textAlign: "center", marginTop: 6 }}
      >
        Open SafeTrip on your phone to see the live map. Your recent check-in
        locations are listed below.
      </Txt>
    </Card>
  );
}
