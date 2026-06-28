import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import SettingsScreen from "./(tabs)/settings";
import { Txt } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

function ProfileHeader() {
  const c = useColors();
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        gap: 12,
      }}
    >
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={24} color={c.foreground} />
      </Pressable>
      <Txt weight="extrabold" size={22}>
        Profile
      </Txt>
    </View>
  );
}

export default function ProfileScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileHeader />
      <SettingsScreen />
    </>
  );
}
