import React from "react";
import { Linking, Pressable, View } from "react-native";

import type { HiddenGem } from "@/lib/hiddenGems";

import { Button, Card, Txt } from "@/components/ui";
import { spacing } from "@/constants/spacing";
import { useColors } from "@/hooks/useColors";
import { mapsUrl } from "@/lib/location";

type Props = {
  gem: HiddenGem | null;
  onClose: () => void;
  onAddToPlan?: (gem: HiddenGem) => void;
};

export function GemDetailSheet({ gem, onClose, onAddToPlan }: Props) {
  const c = useColors();
  if (!gem) return null;

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: c.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderColor: c.border,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <Txt weight="semibold" size={17}>
        {gem.title}
      </Txt>
      {gem.description ? (
        <Txt size={14} color={c.mutedForeground}>
          {gem.description}
        </Txt>
      ) : null}
      {gem.rating != null ? (
        <Txt size={13} color={c.mutedForeground}>
          ★ {gem.rating.toFixed(1)}
          {gem.userReviewsCount ? ` · ${gem.userReviewsCount} reviews` : ""}
        </Txt>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          title="Navigate"
          variant="secondary"
          onPress={() => void Linking.openURL(mapsUrl(gem.lat, gem.lng))}
        />
        {onAddToPlan ? (
          <Button title="Add to plan" onPress={() => onAddToPlan(gem)} />
        ) : null}
      </View>
      <Pressable onPress={onClose}>
        <Txt size={13} color={c.mutedForeground} style={{ textAlign: "center" }}>
          Close
        </Txt>
      </Pressable>
    </View>
  );
}
