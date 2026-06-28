import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { Modal, View } from "react-native";

import { createProfileClient } from "@where2go/api-client/profile";
import type { Profile } from "@where2go/schemas";

import { Button, Field, Screen, SectionTitle, Txt } from "@/components/ui";
import { spacing } from "@/constants/spacing";
import { useColors } from "@/hooks/useColors";

const baseUrl = process.env.EXPO_PUBLIC_PLANNING_API_URL ?? "http://localhost:3000";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ProfileSheet({ visible, onClose }: Props) {
  const c = useColors();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const client = createProfileClient({ baseUrl, getAuthToken: getToken });

  const { data: profile } = useQuery({
    queryKey: ["planning-profile"],
    queryFn: () => client.getProfile(),
    enabled: visible,
  });

  const [budget, setBudget] = useState("120");
  const [driveTime, setDriveTime] = useState("30");
  const [interests, setInterests] = useState("parks, museums");

  useEffect(() => {
    if (profile) {
      setBudget(String(profile.budgetDefault ?? 120));
      setDriveTime(String(profile.driveTimeDefaultMinutes ?? 30));
      setInterests((profile.interests ?? []).join(", "));
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: (body: Partial<Profile>) => client.updateProfile(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["planning-profile"] });
      onClose();
    },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <Screen>
        <SectionTitle>Group profile</SectionTitle>
        <Txt size={13} color={c.mutedForeground} style={{ marginBottom: spacing.lg }}>
          Synced with your Where2Go planning preferences.
        </Txt>
        <View style={{ gap: spacing.md }}>
          <Field label="Default budget ($)" value={budget} onChangeText={setBudget} keyboardType="numeric" />
          <Field label="Max drive (minutes)" value={driveTime} onChangeText={setDriveTime} keyboardType="numeric" />
          <Field label="Interests (comma-separated)" value={interests} onChangeText={setInterests} />
          <Button
            title="Save profile"
            loading={saveMutation.isPending}
            onPress={() =>
              saveMutation.mutate({
                budgetDefault: Number(budget) || 120,
                driveTimeDefaultMinutes: Number(driveTime) || 30,
                interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
          <Button title="Cancel" variant="ghost" onPress={onClose} />
        </View>
      </Screen>
    </Modal>
  );
}
