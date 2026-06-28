import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";

import {
  CreateCheckInType,
  useCreateCheckIn,
  useGetDashboardSummary,
  useListContacts,
  useUpdateSafetyTimer,
} from "@where2go/safety-api-client";

import { Button, Card, IconCircle, Screen, SectionTitle, Txt } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useBatterySafety } from "@/context/BatterySafetyContext";
import { getCurrentCoords } from "@/lib/location";
import {
  cancelTimerExpiryNotification,
  ensureNotificationPermissions,
  rearmTimerExpiryNotification,
  scheduleTimerExpiryNotification,
} from "@/lib/notifications";
import { sendSafetyPackage } from "@/lib/safetyPackage";
import {
  formatRemaining,
  getRemainingMs,
  isTimerExpired,
  offersSafetyPackage,
  shouldEscalateExpiry,
} from "@/lib/safetyTimer";

const QUICK_CHECKINS: {
  type: CreateCheckInType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { type: "landed", label: "Landed", icon: "airplane" },
  { type: "reached_hotel", label: "At hotel", icon: "bed" },
  { type: "leaving_hotel", label: "Leaving", icon: "walk" },
  { type: "custom", label: "I'm safe", icon: "checkmark-done" },
];

export default function HomeScreen() {
  const c = useColors();
  const router = useRouter();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const battery = useBatterySafety();

  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: contacts } = useListContacts();
  const createCheckIn = useCreateCheckIn();
  const updateTimer = useUpdateSafetyTimer();

  const [now, setNow] = useState(Date.now());
  const [pendingType, setPendingType] = useState<CreateCheckInType | null>(null);
  const [sending, setSending] = useState(false);
  const [expiredHandledId, setExpiredHandledId] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const refresh = () => queryClient.invalidateQueries();

  const timer = summary?.activeTimer ?? null;
  const remaining = timer ? getRemainingMs(timer.expiresAt, now) : 0;
  const expired = isTimerExpired(timer, now);

  const greeting = (() => {
    const h = new Date().getHours();
    const name = user?.firstName || summary?.primaryContact ? user?.firstName : null;
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    return name ? `${part}, ${name}` : part;
  })();

  const handleCheckIn = async (type: CreateCheckInType) => {
    setPendingType(type);
    try {
      const coords = await getCurrentCoords();
      await createCheckIn.mutateAsync({
        data: {
          type,
          ...(coords
            ? {
                latitude: coords.latitude,
                longitude: coords.longitude,
                ...(coords.locationName ? { locationName: coords.locationName } : {}),
              }
            : {}),
        },
      });
      refresh();
    } catch {
      Alert.alert("Check-in failed", "Please try again.");
    } finally {
      setPendingType(null);
    }
  };

  const handleImSafe = async () => {
    if (!timer) return;
    try {
      await updateTimer.mutateAsync({ id: timer.id, data: { status: "completed" } });
      await cancelTimerExpiryNotification(timer.id);
      refresh();
    } catch {
      Alert.alert("Could not stop timer", "Please try again.");
    }
  };

  const handleExtend = async () => {
    if (!timer) return;
    const base = Math.max(new Date(timer.expiresAt).getTime(), Date.now());
    const next = new Date(base + 15 * 60 * 1000).toISOString();
    try {
      await updateTimer.mutateAsync({ id: timer.id, data: { expiresAt: next } });
      // Move the scheduled expiry alert to the new deadline.
      const granted = await ensureNotificationPermissions();
      if (granted) {
        await scheduleTimerExpiryNotification({
          id: timer.id,
          label: timer.label,
          expiresAt: next,
          notifyContacts: timer.notifyContacts,
          shareLocation: timer.shareLocation,
        });
      }
      refresh();
    } catch {
      Alert.alert("Could not extend timer", "Please try again.");
    }
  };

  const handleSendPackage = async ({
    shareLocation = true,
  }: { shareLocation?: boolean } = {}) => {
    const phones = (contacts ?? []).map((ct) => ct.phone);
    if (phones.length === 0) {
      Alert.alert("No contacts", "Add an emergency contact first.", [
        { text: "Later", style: "cancel" },
        { text: "Add now", onPress: () => router.push("/contacts") },
      ]);
      return;
    }
    setSending(true);
    try {
      await sendSafetyPackage(
        phones,
        {
          name: user?.fullName ?? null,
          batteryLevel: battery.level,
          isCharging: battery.isCharging,
          destination: summary?.activeTrip?.destination ?? null,
        },
        { includeLocation: shareLocation },
      );
    } finally {
      setSending(false);
    }
  };

  // Keep an OS-level expiry alert armed for the active timer while the app is
  // open, so it fires even after SafeTrip is later backgrounded or killed.
  // Silent: never prompts here (handled when the timer is created/extended).
  useEffect(() => {
    if (!timer || expired) return;
    void rearmTimerExpiryNotification({
      id: timer.id,
      label: timer.label,
      expiresAt: timer.expiresAt,
      notifyContacts: timer.notifyContacts,
      shareLocation: timer.shareLocation,
    });
  }, [timer, expired]);

  // When an active timer crosses zero, escalate exactly once: mark it expired and
  // prompt the traveler to confirm safety or send their safety package.
  useEffect(() => {
    if (!timer || !shouldEscalateExpiry(timer, now, expiredHandledId)) return;
    setExpiredHandledId(timer.id);
    // The scheduled notification has now done its job (fired or about to); the
    // in-app prompt below takes over, so clear any pending schedule.
    void cancelTimerExpiryNotification(timer.id);
    updateTimer.mutate(
      { id: timer.id, data: { status: "expired" } },
      { onSettled: () => refresh() },
    );
    const offerPackage = offersSafetyPackage(timer);
    const buttons = [
      { text: "I'm safe", onPress: () => void handleImSafe() },
    ];
    if (offerPackage) {
      buttons.push({
        text: "Send safety package",
        onPress: () =>
          void handleSendPackage({ shareLocation: timer.shareLocation }),
      });
    }
    Alert.alert(
      "Safety timer expired",
      offerPackage
        ? "You didn't check in. Let your contacts know you're safe, or send your safety package now."
        : "You didn't check in. Let your contacts know you're safe.",
      buttons,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, expired, expiredHandledId]);

  return (
    <Screen>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 22,
        }}
      >
        <View style={{ flex: 1 }}>
          <Txt size={14} color={c.mutedForeground}>
            {greeting}
          </Txt>
          <Txt weight="extrabold" size={26}>
            Safety dashboard
          </Txt>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: c.card,
            borderColor: c.border,
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          <Ionicons
            name={battery.isCharging ? "battery-charging" : "battery-half"}
            size={18}
            color={
              battery.level != null && battery.level <= 0.2 && !battery.isCharging
                ? c.warning
                : c.success
            }
          />
          <Txt weight="semibold" size={13}>
            {battery.level != null ? `${Math.round(battery.level * 100)}%` : "—"}
          </Txt>
        </View>
      </View>

      {/* Safety timer */}
      {isLoading ? (
        <Card style={{ alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator color={c.primary} />
        </Card>
      ) : timer ? (
        <Card
          style={{
            borderColor: expired ? c.destructive : c.primary,
            borderWidth: 1.5,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <IconCircle
              icon={expired ? "alert-circle" : "timer"}
              color={expired ? c.destructive : c.primaryLight}
              bg={c.secondary}
            />
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" size={16}>
                {timer.label || "Safety timer"}
              </Txt>
              <Txt size={13} color={c.mutedForeground}>
                {expired ? "Timer expired — check in now" : "Active countdown"}
              </Txt>
            </View>
          </View>
          <Txt
            weight="extrabold"
            size={48}
            color={expired ? c.destructive : c.foreground}
            style={{ textAlign: "center", marginVertical: 16, letterSpacing: 1 }}
          >
            {formatRemaining(remaining)}
          </Txt>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              title="I'm safe"
              icon="checkmark-circle"
              variant="success"
              onPress={handleImSafe}
              loading={updateTimer.isPending}
              style={{ flex: 1 }}
            />
            <Button
              title="+15 min"
              variant="secondary"
              onPress={handleExtend}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : (
        <Pressable onPress={() => router.push("/timer")}>
          <LinearGradient
            colors={[c.primary, c.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: c.radius, padding: 22 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Ionicons name="timer-outline" size={34} color="#FFFFFF" />
              <View style={{ flex: 1 }}>
                <Txt weight="bold" size={18} color="#FFFFFF">
                  Start a Safety Timer
                </Txt>
                <Txt size={13} color="rgba(255,255,255,0.85)">
                  We alert your contacts if you don&apos;t check in
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </Pressable>
      )}

      {/* Escalation delivery status — who was reached when a timer lapsed */}
      {summary?.escalation ? (
        <Card
          style={{
            marginTop: 18,
            borderColor:
              summary.escalation.failed > 0
                ? c.destructive
                : summary.escalation.pending > 0
                  ? c.warning
                  : c.success,
            borderWidth: 1.5,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <IconCircle
              icon={
                summary.escalation.failed > 0
                  ? "alert-circle"
                  : summary.escalation.pending > 0
                    ? "time"
                    : "shield-checkmark"
              }
              color={
                summary.escalation.failed > 0
                  ? c.destructive
                  : summary.escalation.pending > 0
                    ? c.warning
                    : c.success
              }
              bg={c.secondary}
            />
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" size={16}>
                Emergency alert {summary.escalation.sent}/
                {summary.escalation.total} delivered
              </Txt>
              <Txt size={13} color={c.mutedForeground}>
                {`Sent ${new Date(
                  summary.escalation.escalatedAt,
                ).toLocaleString()}`}
              </Txt>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {summary.escalation.contacts.map((ct, i) => {
              const color =
                ct.status === "sent"
                  ? c.success
                  : ct.status === "failed"
                    ? c.destructive
                    : c.warning;
              const icon =
                ct.status === "sent"
                  ? "checkmark-circle"
                  : ct.status === "failed"
                    ? "close-circle"
                    : "time";
              const statusLabel =
                ct.status === "sent"
                  ? "Reached"
                  : ct.status === "failed"
                    ? "Failed"
                    : "Retrying";
              return (
                <View
                  key={`${ct.name ?? "contact"}-${i}`}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Ionicons name={icon} size={16} color={color} />
                  <Txt size={14} style={{ flex: 1 }}>
                    {ct.name || "Contact"}
                  </Txt>
                  <Txt size={13} weight="medium" color={color}>
                    {statusLabel}
                    {ct.status !== "sent" && ct.attempts > 0
                      ? ` · ${ct.attempts}×`
                      : ""}
                  </Txt>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      {/* Quick check-ins */}
      <View style={{ marginTop: 26 }}>
        <SectionTitle>Quick check-in</SectionTitle>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {QUICK_CHECKINS.map((q) => (
            <Pressable
              key={q.type + q.label}
              onPress={() => handleCheckIn(q.type)}
              disabled={pendingType !== null}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: c.card,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: c.radius,
                paddingVertical: 14,
                alignItems: "center",
                gap: 8,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {pendingType === q.type ? (
                <ActivityIndicator color={c.primaryLight} />
              ) : (
                <Ionicons name={q.icon} size={22} color={c.primaryLight} />
              )}
              <Txt size={12} weight="medium" color={c.mutedForeground}>
                {q.label}
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Status */}
      <View style={{ marginTop: 26 }}>
        <SectionTitle>Status</SectionTitle>
        <View style={{ gap: 12 }}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <IconCircle icon="person" color={c.primaryLight} bg={c.secondary} />
            <View style={{ flex: 1 }}>
              <Txt size={13} color={c.mutedForeground}>
                Primary contact
              </Txt>
              <Txt weight="semibold" size={16}>
                {summary?.primaryContact
                  ? summary.primaryContact.name
                  : "Not set yet"}
              </Txt>
            </View>
            <Pressable onPress={() => router.push("/contacts")}>
              <Ionicons name="chevron-forward" size={20} color={c.mutedForeground} />
            </Pressable>
          </Card>

          <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <IconCircle icon="location" color={c.success} bg={c.secondary} />
            <View style={{ flex: 1 }}>
              <Txt size={13} color={c.mutedForeground}>
                Last check-in
              </Txt>
              <Txt weight="semibold" size={16}>
                {summary?.lastCheckIn
                  ? new Date(summary.lastCheckIn.createdAt).toLocaleString()
                  : "No check-ins yet"}
              </Txt>
            </View>
          </Card>

          <Pressable onPress={() => router.push("/trips")}>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <IconCircle icon="airplane" color={c.primaryLight} bg={c.secondary} />
              <View style={{ flex: 1 }}>
                <Txt size={13} color={c.mutedForeground}>
                  {summary?.activeTrip ? "Active trip" : "Trips"}
                </Txt>
                <Txt weight="semibold" size={16}>
                  {summary?.activeTrip
                    ? summary.activeTrip.destination ?? summary.activeTrip.title
                    : "Plan a trip"}
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.mutedForeground} />
            </Card>
          </Pressable>
        </View>
      </View>

      {/* Hotel scanner */}
      <Pressable onPress={() => router.push("/scanner")} style={{ marginTop: 26 }}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <IconCircle icon="sparkles" color={c.primaryLight} bg={c.secondary} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" size={16}>
              AI Hotel Safety Scanner
            </Txt>
            <Txt size={13} color={c.mutedForeground}>
              Check any hotel before you book
            </Txt>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.mutedForeground} />
        </Card>
      </Pressable>

      {/* Emergency */}
      <View style={{ marginTop: 26 }}>
        <Button
          title={sending ? "Opening messages…" : "Send Safety Package"}
          icon="warning"
          variant="danger"
          onPress={handleSendPackage}
          loading={sending}
        />
        <Txt
          size={12}
          color={c.mutedForeground}
          style={{ textAlign: "center", marginTop: 10 }}
        >
          Shares your live location with your emergency contacts
        </Txt>
      </View>
    </Screen>
  );
}
