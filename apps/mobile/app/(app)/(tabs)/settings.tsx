import { useAuth, useUser } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Pressable,
  Switch,
  View,
} from "react-native";

import { useGetMe, useUpdateMe } from "@where2go/safety-api-client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Field,
  IconCircle,
  Screen,
  SectionTitle,
  Txt,
} from "@/components/ui";
import { useProductMode, type ProductMode } from "@/context/ProductModeContext";
import { useColors } from "@/hooks/useColors";
import {
  type PermissionState,
  getLocationPermissionStatus,
  requestLocationPermission,
} from "@/lib/location";
import {
  ensureNotificationPermissions,
  getNotificationPermissionStatus,
} from "@/lib/notifications";

export default function SettingsScreen() {
  const c = useColors();
  const { mode, setMode } = useProductMode();
  const { user } = useUser();
  const { signOut, getToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useGetMe();
  const updateMe = useUpdateMe();

  const [displayName, setDisplayName] = useState("");
  const [threshold, setThreshold] = useState(20);
  const [lowBatterySos, setLowBatterySos] = useState(true);
  const [shareLocation, setShareLocation] = useState(true);

  const [notifStatus, setNotifStatus] = useState<PermissionState | null>(null);
  const [locStatus, setLocStatus] = useState<PermissionState | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setThreshold(profile.batteryThreshold);
      setLowBatterySos(profile.lowBatterySos);
      setShareLocation(profile.shareLocationDefault);
    }
  }, [profile]);

  const checkPermissions = useCallback(async () => {
    const [notif, loc] = await Promise.all([
      getNotificationPermissionStatus(),
      getLocationPermissionStatus(),
    ]);
    setNotifStatus(notif);
    setLocStatus(loc);
  }, []);

  useEffect(() => {
    void checkPermissions();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkPermissions();
    });
    return () => sub.remove();
  }, [checkPermissions]);

  const handleEnableNotifications = async () => {
    await ensureNotificationPermissions();
    await checkPermissions();
  };

  const handleEnableLocation = async () => {
    await requestLocationPermission();
    await checkPermissions();
  };

  const refresh = () => queryClient.invalidateQueries();

  const persist = async (patch: Parameters<typeof updateMe.mutateAsync>[0]["data"]) => {
    try {
      await updateMe.mutateAsync({ data: patch });
      refresh();
    } catch {
      Alert.alert("Could not save", "Please try again.");
    }
  };

  const adjustThreshold = (delta: number) => {
    const next = Math.min(100, Math.max(5, threshold + delta));
    setThreshold(next);
    void persist({ batteryThreshold: next });
  };

  const handleSaveName = () => {
    void persist({ displayName: displayName.trim() });
    Alert.alert("Saved", "Your display name was updated.");
  };

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const renderPermissionRow = (opts: {
    icon: React.ComponentProps<typeof IconCircle>["icon"];
    title: string;
    description: string;
    status: PermissionState | null;
    onEnable: () => void;
  }) => {
    const { icon, title, description, status, onEnable } = opts;
    const meta: Record<PermissionState, { label: string; color: string }> = {
      granted: { label: "Enabled", color: c.success },
      denied: { label: "Blocked", color: c.destructive },
      undetermined: { label: "Not set", color: c.warning },
      unsupported: { label: "Unavailable", color: c.mutedForeground },
    };
    const m = status ? meta[status] : null;
    return (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IconCircle icon={icon} color={c.primaryLight} bg={c.secondary} size={40} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" size={15}>
              {title}
            </Txt>
            <Txt size={13} color={c.mutedForeground}>
              {description}
            </Txt>
          </View>
          {m ? <Badge label={m.label} color={m.color} bg={c.secondary} /> : null}
        </View>
        {status === "undetermined" ? (
          <Button title="Enable" variant="secondary" onPress={onEnable} />
        ) : status === "denied" ? (
          <Button
            title="Open device settings"
            icon="open-outline"
            variant="secondary"
            onPress={() => void Linking.openSettings()}
          />
        ) : null}
      </View>
    );
  };

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <ActivityIndicator color={c.primary} style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt weight="extrabold" size={26} style={{ marginBottom: 20 }}>
        Profile
      </Txt>

      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <IconCircle icon="person-circle" color={c.primaryLight} bg={c.secondary} size={52} />
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" size={17}>
            {profile?.displayName || user?.fullName || "Traveler"}
          </Txt>
          <Txt size={13} color={c.mutedForeground}>
            {profile?.email || user?.primaryEmailAddress?.emailAddress || ""}
          </Txt>
        </View>
      </Card>

      <SectionTitle>Product mode</SectionTitle>
      <Card style={{ gap: 10, marginBottom: 22 }}>
        {(["family_day", "solo_travel"] as ProductMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={{
              padding: 12,
              borderRadius: 10,
              backgroundColor: mode === m ? c.secondary : "transparent",
            }}
          >
            <Txt weight="semibold">{m === "family_day" ? "Family Day" : "Solo Travel"}</Txt>
            <Txt size={13} color={c.mutedForeground}>
              {m === "family_day"
                ? "Planning-first with Chat, Map, and Plan tabs."
                : "Safety-first with expanded Safe tab defaults."}
            </Txt>
          </Pressable>
        ))}
      </Card>

      <SectionTitle>Permissions</SectionTitle>
      <Card style={{ marginBottom: 22 }}>
        <Txt size={13} color={c.mutedForeground} style={{ marginBottom: 14 }}>
          These power Where2Go safety alerts. If one is blocked, re-enable it
          from your device settings.
        </Txt>
        {renderPermissionRow({
          icon: "notifications",
          title: "Notifications",
          description: "Alert you when a safety timer runs out, even if Where2Go is closed",
          status: notifStatus,
          onEnable: () => void handleEnableNotifications(),
        })}
        <Divider />
        {renderPermissionRow({
          icon: "location",
          title: "Location",
          description: "Share where you are in safety packages and on the map",
          status: locStatus,
          onEnable: () => void handleEnableLocation(),
        })}
      </Card>

      <SectionTitle>Profile</SectionTitle>
      <Card style={{ gap: 14, marginBottom: 22 }}>
        <Field
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="How contacts will see you"
        />
        <Button
          title="Save name"
          variant="secondary"
          onPress={handleSaveName}
          loading={updateMe.isPending}
        />
      </Card>

      <SectionTitle>Battery safety</SectionTitle>
      <Card style={{ marginBottom: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Txt weight="semibold" size={15}>
              Low battery threshold
            </Txt>
            <Txt size={13} color={c.mutedForeground}>
              Alert me when battery drops below this
            </Txt>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => adjustThreshold(-5)} hitSlop={8}>
              <IconCircle icon="remove" color={c.foreground} bg={c.secondary} size={34} />
            </Pressable>
            <Txt weight="bold" size={18} style={{ minWidth: 44, textAlign: "center" }}>
              {threshold}%
            </Txt>
            <Pressable onPress={() => adjustThreshold(5)} hitSlop={8}>
              <IconCircle icon="add" color={c.foreground} bg={c.secondary} size={34} />
            </Pressable>
          </View>
        </View>
        <Divider />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Txt weight="semibold" size={15}>
              Low-battery SOS prompt
            </Txt>
            <Txt size={13} color={c.mutedForeground}>
              Offer to alert contacts before your phone dies
            </Txt>
          </View>
          <Switch
            value={lowBatterySos}
            onValueChange={(v) => {
              setLowBatterySos(v);
              void persist({ lowBatterySos: v });
            }}
            trackColor={{ false: c.secondary, true: c.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card style={{ marginBottom: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Txt weight="semibold" size={15}>
              Share location by default
            </Txt>
            <Txt size={13} color={c.mutedForeground}>
              Include your location in safety packages and timers
            </Txt>
          </View>
          <Switch
            value={shareLocation}
            onValueChange={(v) => {
              setShareLocation(v);
              void persist({ shareLocationDefault: v });
            }}
            trackColor={{ false: c.secondary, true: c.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Card>

      <Button title="Sign out" icon="log-out-outline" variant="ghost" onPress={handleSignOut} />

      {(process.env.EXPO_PUBLIC_PRIVACY_URL || process.env.EXPO_PUBLIC_TERMS_URL) ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          {process.env.EXPO_PUBLIC_PRIVACY_URL ? (
            <Button
              title="Privacy policy"
              variant="ghost"
              icon="document-text-outline"
              onPress={() => void Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL!)}
            />
          ) : null}
          {process.env.EXPO_PUBLIC_TERMS_URL ? (
            <Button
              title="Terms of service"
              variant="ghost"
              icon="document-outline"
              onPress={() => void Linking.openURL(process.env.EXPO_PUBLIC_TERMS_URL!)}
            />
          ) : null}
        </View>
      ) : null}

      <Button
        title="Delete account"
        variant="danger"
        style={{ marginTop: 12 }}
        onPress={() => {
          Alert.alert(
            "Delete account",
            "This permanently deletes your safety data and Clerk account.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    const base = process.env.EXPO_PUBLIC_SAFETY_API_URL ?? "";
                    const token = await getToken();
                    await fetch(`${base.replace(/\/$/, "")}/api/me`, {
                      method: "DELETE",
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                    await signOut();
                  } catch {
                    Alert.alert("Delete failed", "Please try again or contact support.");
                  }
                },
              },
            ],
          );
        }}
      />
    </Screen>
  );
}
