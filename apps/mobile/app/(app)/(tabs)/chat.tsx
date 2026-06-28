import React, { useState } from "react";
import { View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { ChatInput } from "@/components/mapchat/ChatInput";
import { ChatThread } from "@/components/mapchat/ChatThread";
import { EmptyState, Screen } from "@/components/ui";
import { spacing } from "@/constants/spacing";
import { useChat } from "@/context/ChatContext";

export default function ChatScreen() {
  const { messages, isSending, searchMode, setSearchMode, sendMessage, clearChat } = useChat();

  return (
    <Screen scroll={false}>
      <AppHeader title="Chat" />
      <View style={{ flex: 1, marginBottom: spacing.md }}>
        {messages.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="MapChat"
            subtitle="Ask for places, routes, or a full plan. Quick prompts below get you started."
          />
        ) : (
          <ChatThread messages={messages} />
        )}
      </View>
      <ChatInput
        onSend={(t) => void sendMessage(t)}
        isSending={isSending}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        onClear={clearChat}
      />
    </Screen>
  );
}
