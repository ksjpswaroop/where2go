import { useAuth } from "@clerk/expo";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { Button, Card, EmptyState, Field, Screen, SectionTitle, Txt } from "@/components/ui";
import { spacing } from "@/constants/spacing";
import { useColors } from "@/hooks/useColors";
import { createJournalEntry, listJournalEntries, type JournalEntry } from "@/lib/journal";
import { getCurrentCoords } from "@/lib/location";

export default function JournalScreen() {
  const c = useColors();
  const router = useRouter();
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try {
      setEntries(await listJournalEntries(getToken));
    } catch {
      // offline — keep local list empty
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!body.trim()) {
      Alert.alert("Add a note", "Write something about this moment.");
      return;
    }
    setLoading(true);
    try {
      const coords = await getCurrentCoords();
      await createJournalEntry(getToken, {
        title: title.trim() || undefined,
        body: body.trim(),
        photoUri: photoUri ?? undefined,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        locationName: coords?.locationName,
      });
      setTitle("");
      setBody("");
      setPhotoUri(null);
      await refresh();
      Alert.alert("Saved", "Journal entry synced.");
    } catch {
      Alert.alert("Save failed", "Entry queued locally — will retry when online.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Journal" />
      <SectionTitle>New entry</SectionTitle>
      <View style={{ gap: spacing.md, marginBottom: spacing.xxl }}>
        <Field label="Title (optional)" value={title} onChangeText={setTitle} />
        <Field label="Note" value={body} onChangeText={setBody} multiline placeholder="What happened?" />
        <Button title={photoUri ? "Photo attached ✓" : "Add photo"} variant="secondary" onPress={() => void pickPhoto()} />
        <Button title="Save entry" onPress={() => void handleSave()} loading={loading} />
      </View>

      <SectionTitle>Recent</SectionTitle>
      {entries.length === 0 ? (
        <EmptyState icon="book-outline" title="No entries yet" subtitle="Capture moments from your trip with notes and photos." />
      ) : (
        <View style={{ gap: 10 }}>
          {entries.map((e) => (
            <Card key={e.id} style={{ gap: 6 }}>
              {e.title ? <Txt weight="semibold">{e.title}</Txt> : null}
              <Txt size={14}>{e.body}</Txt>
              {e.locationName ? (
                <Txt size={12} color={c.mutedForeground}>
                  {e.locationName}
                </Txt>
              ) : null}
            </Card>
          ))}
        </View>
      )}
      <Button title="Back to map" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}
