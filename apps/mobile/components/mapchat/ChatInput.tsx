import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";

import type { ChatSearchMode } from "@where2go/api-client/chat";

import { Button, Field, Txt } from "@/components/ui";
import { spacing } from "@/constants/spacing";
import { useProductMode } from "@/context/ProductModeContext";
import { useColors } from "@/hooks/useColors";

const FAMILY_PROMPTS = [
  "Plan a family afternoon within 30 min under $100",
  "Rainy day indoor museum outing with a snack stop",
  "Find a quiet park and nearby ice cream for toddlers",
];

const SOLO_PROMPTS = [
  "Safe solo outing near my hotel tonight, well-lit and easy to reach",
  "Well-lit evening walk with a coffee stop nearby",
  "Quiet museum or cafe within 20 minutes",
];

type Props = {
  onSend: (text: string) => void;
  isSending: boolean;
  searchMode: ChatSearchMode;
  onSearchModeChange: (mode: ChatSearchMode) => void;
  onClear: () => void;
};

export function ChatInput({ onSend, isSending, searchMode, onSearchModeChange, onClear }: Props) {
  const c = useColors();
  const { isSoloTravel } = useProductMode();
  const [text, setText] = useState("");
  const prompts = isSoloTravel ? SOLO_PROMPTS : FAMILY_PROMPTS;

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <View style={{ gap: spacing.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {prompts.map((p) => (
          <Pressable
            key={p}
            onPress={() => onSend(p)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: c.secondary,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Txt size={13}>{p}</Txt>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["maps", "web", "none"] as ChatSearchMode[]).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => onSearchModeChange(mode)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: searchMode === mode ? c.primary : c.secondary,
            }}
          >
            <Txt size={12} color={searchMode === mode ? c.primaryForeground : c.foreground}>
              {mode}
            </Txt>
          </Pressable>
        ))}
        <Pressable onPress={() => Alert.alert("Clear chat?", "Remove all messages?", [
          { text: "Cancel", style: "cancel" },
          { text: "Clear", style: "destructive", onPress: onClear },
        ])} style={{ marginLeft: "auto", padding: 6 }}>
          <Ionicons name="refresh" size={20} color={c.mutedForeground} />
        </Pressable>
      </View>

      <Field
        value={text}
        onChangeText={setText}
        placeholder="Ask Where2Go anything…"
        multiline
        onSubmitEditing={handleSend}
      />
      <Button title={isSending ? "Sending…" : "Send"} onPress={handleSend} disabled={isSending} loading={isSending} />
    </View>
  );
}
