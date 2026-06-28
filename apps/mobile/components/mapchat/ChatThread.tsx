import React from "react";
import { FlatList, View } from "react-native";

import type { ChatMessage } from "@where2go/api-client/chat";

import { Card, Txt } from "@/components/ui";
import { spacing } from "@/constants/spacing";
import { useColors } from "@/hooks/useColors";

export function ChatThread({ messages }: { messages: ChatMessage[] }) {
  const c = useColors();

  return (
    <FlatList
      data={messages}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
      renderItem={({ item }) => (
        <View
          style={{
            alignSelf: item.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "88%",
          }}
        >
          <Card
            style={{
              backgroundColor: item.role === "user" ? c.primary : c.card,
              borderColor: item.role === "user" ? c.primary : c.border,
            }}
          >
            <Txt
              size={15}
              color={item.role === "user" ? c.primaryForeground : c.foreground}
            >
              {item.content}
            </Txt>
          </Card>
        </View>
      )}
    />
  );
}
