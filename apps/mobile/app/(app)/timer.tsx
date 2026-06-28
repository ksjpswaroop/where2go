import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, Switch, View } from "react-native";

import { useCreateSafetyTimer } from "@where2go/safety-api-client";

import {
  Button,
  Card,
  Field,
  IconCircle,
  Screen,
  SectionTitle,
  Txt,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import {
  ensureNotificationPermissions,
  scheduleTimerExpiryNotification,
} from "@/lib/notifications";

const PRESETS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
  { label: "8 hours", minutes: 480 },
];

export default function TimerScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const createTimer = useCreateSafetyTimer();

  const [minutes, setMinutes] = useState(60);
  const [label, setLabel] = useState("");
  const [shareLocation, setShareLocation] = useState(true);
  const [notifyContacts, setNotifyContacts] = useState(true);

  const handleStart = async () => {
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    let timer;
    try {
      timer = await createTimer.mutateAsync({
        data: {
          expiresAt,
          label: label.trim() || undefined,
          shareLocation,
          notifyContacts,
        },
      });
      queryClient.invalidateQueries();
    } catch {
      Alert.alert("Could not start timer", "Please try again.");
      return;
    }

    // Schedule an OS-level alert so the traveler is notified the moment the
    // timer runs out — even if SafeTrip is closed or the phone is locked.
    const granted = await ensureNotificationPermissions();
    if (granted) {
      await scheduleTimerExpiryNotification({
        id: timer.id,
        label: timer.label,
        expiresAt: timer.expiresAt,
        notifyContacts: timer.notifyContacts,
        shareLocation: timer.shareLocation,
      });
      router.back();
    } else {
      Alert.alert(
        "Timer started",
        "Heads up: notifications are off, so we can only alert you if SafeTrip is open when the timer ends. Enable notifications in Settings so we can reach you even when the app is closed.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    }
  };

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <Txt weight="extrabold" size={24}>
          Safety Timer
        </Txt>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconCircle icon="close" color={c.foreground} bg={c.card} size={38} />
        </Pressable>
      </View>
      <Txt size={14} color={c.mutedForeground} style={{ marginBottom: 20 }}>
        If you don&apos;t check in before time runs out, we&apos;ll prompt you to
        alert your contacts.
      </Txt>

      <SectionTitle>Duration</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        {PRESETS.map((p) => {
          const active = p.minutes === minutes;
          return (
            <Pressable
              key={p.minutes}
              onPress={() => setMinutes(p.minutes)}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: 999,
                backgroundColor: active ? c.primary : c.card,
                borderWidth: 1,
                borderColor: active ? c.primary : c.border,
              }}
            >
              <Txt weight="semibold" size={14} color={active ? "#FFFFFF" : c.foreground}>
                {p.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <Card style={{ gap: 16, marginBottom: 22 }}>
        <Field
          label="Label (optional)"
          value={label}
          onChangeText={setLabel}
          placeholder="Hike to the waterfall"
        />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Txt size={15}>Share my location</Txt>
          <Switch
            value={shareLocation}
            onValueChange={setShareLocation}
            trackColor={{ false: c.secondary, true: c.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Txt size={15}>Notify contacts if I miss it</Txt>
          <Switch
            value={notifyContacts}
            onValueChange={setNotifyContacts}
            trackColor={{ false: c.secondary, true: c.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Card>

      <Button
        title="Start timer"
        icon="timer"
        onPress={handleStart}
        loading={createTimer.isPending}
      />
    </Screen>
  );
}
