import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { Txt } from "@/components/ui";
import { spacing, typography } from "@/constants/spacing";
import { useColors } from "@/hooks/useColors";

export function AppHeader({ title = "Where2Go" }: { title?: string }) {
  const c = useColors();
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.lg,
      }}
    >
      <Txt weight="extrabold" size={typography.headline}>
        {title}
      </Txt>
      <Pressable
        onPress={() => router.push("/profile")}
        accessibilityLabel="Profile and settings"
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="person-circle-outline" size={24} color={c.primaryLight} />
      </Pressable>
    </View>
  );
}
