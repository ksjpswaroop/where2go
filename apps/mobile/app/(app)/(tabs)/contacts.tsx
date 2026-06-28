import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, View } from "react-native";

import {
  EmergencyContact,
  useCreateContact,
  useDeleteContact,
  useGetDashboardSummary,
  useListContacts,
  useUpdateContact,
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
import { useBatterySafety } from "@/context/BatterySafetyContext";
import { useColors } from "@/hooks/useColors";
import { sendSafetyPackage } from "@/lib/safetyPackage";

type FormState = {
  name: string;
  relation: string;
  phone: string;
  isPrimary: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  relation: "",
  phone: "",
  isPrimary: false,
};

export default function ContactsScreen() {
  const c = useColors();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data: contacts, isLoading } = useListContacts();
  const { data: summary } = useGetDashboardSummary();
  const battery = useBatterySafety();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [sending, setSending] = useState(false);

  const refresh = () => queryClient.invalidateQueries();
  const saving = createContact.isPending || updateContact.isPending;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (ct: EmergencyContact) => {
    setEditingId(ct.id);
    setForm({
      name: ct.name,
      relation: ct.relation ?? "",
      phone: ct.phone,
      isPrimary: ct.isPrimary,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert("Missing info", "Name and phone are required.");
      return;
    }
    const data = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      relation: form.relation.trim() || undefined,
      isPrimary: form.isPrimary,
    };
    try {
      if (editingId != null) {
        await updateContact.mutateAsync({ id: editingId, data });
      } else {
        await createContact.mutateAsync({ data });
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      refresh();
    } catch {
      Alert.alert("Could not save", "Please try again.");
    }
  };

  const handleDelete = (ct: EmergencyContact) => {
    Alert.alert("Delete contact", `Remove ${ct.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteContact.mutateAsync({ id: ct.id });
            refresh();
          } catch {
            Alert.alert("Could not delete", "Please try again.");
          }
        },
      },
    ]);
  };

  const handleSendPackage = async () => {
    const phones = (contacts ?? []).map((ct) => ct.phone);
    setSending(true);
    try {
      await sendSafetyPackage(phones, {
        name: user?.fullName ?? null,
        batteryLevel: battery.level,
        isCharging: battery.isCharging,
        destination: summary?.activeTrip?.destination ?? null,
      });
    } finally {
      setSending(false);
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
        <Txt weight="extrabold" size={26}>
          Emergency contacts
        </Txt>
        <Pressable onPress={openCreate}>
          <IconCircle icon="add" color="#FFFFFF" bg={c.primary} size={40} />
        </Pressable>
      </View>

      {showForm ? (
        <Card style={{ marginBottom: 18, gap: 14 }}>
          <Txt weight="semibold" size={17}>
            {editingId != null ? "Edit contact" : "New contact"}
          </Txt>
          <Field
            label="Name"
            value={form.name}
            onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
            placeholder="Jane Doe"
          />
          <Field
            label="Relationship"
            value={form.relation}
            onChangeText={(t) => setForm((f) => ({ ...f, relation: t }))}
            placeholder="Sister, friend…"
          />
          <Field
            label="Phone number"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))}
            placeholder="+1 555 000 1234"
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Txt size={15}>Primary contact</Txt>
            <Switch
              value={form.isPrimary}
              onValueChange={(v) => setForm((f) => ({ ...f, isPrimary: v }))}
              trackColor={{ false: c.secondary, true: c.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
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

      <SectionTitle>Your circle</SectionTitle>
      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
      ) : (contacts ?? []).length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No contacts yet"
          subtitle="Add the people SafeTrip should alert in an emergency."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {(contacts ?? []).map((ct) => (
            <Card
              key={ct.id}
              style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <IconCircle
                icon={ct.isPrimary ? "star" : "person"}
                color={ct.isPrimary ? c.warning : c.primaryLight}
                bg={c.secondary}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Txt weight="semibold" size={16}>
                    {ct.name}
                  </Txt>
                  {ct.isPrimary ? (
                    <Txt size={11} weight="semibold" color={c.warning}>
                      PRIMARY
                    </Txt>
                  ) : null}
                </View>
                <Txt size={13} color={c.mutedForeground}>
                  {ct.relation ? `${ct.relation} · ` : ""}
                  {ct.phone}
                </Txt>
              </View>
              <Pressable onPress={() => openEdit(ct)} hitSlop={8}>
                <Ionicons name="create-outline" size={20} color={c.mutedForeground} />
              </Pressable>
              <Pressable onPress={() => handleDelete(ct)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={c.destructive} />
              </Pressable>
            </Card>
          ))}
        </View>
      )}

      {(contacts ?? []).length > 0 ? (
        <View style={{ marginTop: 24 }}>
          <Button
            title={sending ? "Opening messages…" : "Send Safety Package to all"}
            icon="warning"
            variant="danger"
            onPress={handleSendPackage}
            loading={sending}
          />
        </View>
      ) : null}
    </Screen>
  );
}
