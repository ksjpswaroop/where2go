import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";

import {
  Trip,
  useCreateTrip,
  useListTrips,
  useUpdateTrip,
} from "@where2go/safety-api-client";

import {
  Button,
  Card,
  EmptyState,
  Field,
  IconCircle,
  Screen,
  SectionTitle,
  Txt,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

type FormState = {
  title: string;
  destination: string;
};

const EMPTY_FORM: FormState = { title: "", destination: "" };

export default function TripsScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: trips, isLoading } = useListTrips();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const refresh = () => queryClient.invalidateQueries();
  const saving = createTrip.isPending || updateTrip.isPending;

  const sorted = [...(trips ?? [])].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (t: Trip) => {
    setEditingId(t.id);
    setForm({ title: t.title, destination: t.destination ?? "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert("Missing info", "Give your trip a title.");
      return;
    }
    const data = {
      title: form.title.trim(),
      destination: form.destination.trim() || undefined,
    };
    try {
      if (editingId != null) {
        await updateTrip.mutateAsync({ id: editingId, data });
      } else {
        await createTrip.mutateAsync({ data: { ...data, status: "active" } });
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      refresh();
    } catch {
      Alert.alert("Could not save", "Please try again.");
    }
  };

  const handleEnd = (t: Trip) => {
    Alert.alert("End trip", `Mark "${t.title}" as ended?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "End trip",
        onPress: async () => {
          try {
            await updateTrip.mutateAsync({ id: t.id, data: { status: "ended" } });
            refresh();
          } catch {
            Alert.alert("Could not update", "Please try again.");
          }
        },
      },
    ]);
  };

  const handleReactivate = async (t: Trip) => {
    try {
      await updateTrip.mutateAsync({ id: t.id, data: { status: "active" } });
      refresh();
    } catch {
      Alert.alert("Could not update", "Please try again.");
    }
  };

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={c.foreground} />
          </Pressable>
          <Txt weight="extrabold" size={26}>
            Trips
          </Txt>
        </View>
        <Pressable onPress={openCreate}>
          <IconCircle icon="add" color="#FFFFFF" bg={c.primary} size={40} />
        </Pressable>
      </View>

      {showForm ? (
        <Card style={{ marginBottom: 18, gap: 14 }}>
          <Txt weight="semibold" size={17}>
            {editingId != null ? "Edit trip" : "New trip"}
          </Txt>
          <Field
            label="Title"
            value={form.title}
            onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
            placeholder="Weekend in Lisbon"
          />
          <Field
            label="Destination"
            value={form.destination}
            onChangeText={(t) => setForm((f) => ({ ...f, destination: t }))}
            placeholder="Lisbon, Portugal"
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
              style={{ flex: 1 }}
            />
            <Button
              title="Save"
              onPress={handleSave}
              loading={saving}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : null}

      <SectionTitle>Your trips</SectionTitle>
      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon="airplane-outline"
          title="No trips yet"
          subtitle="Add a trip so your safety alerts can share where you're headed."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {sorted.map((t) => {
            const active = t.status === "active";
            return (
              <Card
                key={t.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <IconCircle
                  icon={active ? "airplane" : "checkmark-done"}
                  color={active ? c.primaryLight : c.success}
                  bg={c.secondary}
                />
                <View style={{ flex: 1 }}>
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <Txt weight="semibold" size={16}>
                      {t.title}
                    </Txt>
                    {active ? (
                      <Txt size={11} weight="semibold" color={c.primaryLight}>
                        ACTIVE
                      </Txt>
                    ) : null}
                  </View>
                  <Txt size={13} color={c.mutedForeground}>
                    {t.destination ? t.destination : "No destination set"}
                  </Txt>
                </View>
                <Pressable onPress={() => openEdit(t)} hitSlop={8}>
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={c.mutedForeground}
                  />
                </Pressable>
                {active ? (
                  <Pressable onPress={() => handleEnd(t)} hitSlop={8}>
                    <Ionicons name="stop-circle-outline" size={22} color={c.warning} />
                  </Pressable>
                ) : (
                  <Pressable onPress={() => handleReactivate(t)} hitSlop={8}>
                    <Ionicons name="refresh-outline" size={20} color={c.primaryLight} />
                  </Pressable>
                )}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
