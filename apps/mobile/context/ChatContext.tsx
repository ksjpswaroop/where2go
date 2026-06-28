import { useAuth } from "@clerk/expo";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { createChatClient, type ChatMessage, type ChatSearchMode } from "@where2go/api-client/chat";
import type { PlanResponse } from "@where2go/schemas";

import { useActivePlan } from "./ActivePlanContext";

const planningBase = process.env.EXPO_PUBLIC_PLANNING_API_URL ?? "http://localhost:3000";

type ChatContextValue = {
  messages: ChatMessage[];
  isSending: boolean;
  searchMode: ChatSearchMode;
  setSearchMode: (mode: ChatSearchMode) => void;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { setPlan } = useActivePlan();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [searchMode, setSearchMode] = useState<ChatSearchMode>("maps");

  const client = useMemo(
    () => createChatClient({ baseUrl: planningBase, getAuthToken: getToken }),
    [getToken],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages(nextMessages);
      setIsSending(true);

      try {
        const res = await client.sendChat({
          messages: nextMessages,
          searchMode,
        });
        const reply = res.text ?? res.message ?? "No response received.";
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        const plan = res.plan ?? res.planResponse;
        if (plan) setPlan(plan as PlanResponse);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Chat failed";
        setMessages((prev) => [...prev, { role: "assistant", content: `Sorry — ${msg}` }]);
      } finally {
        setIsSending(false);
      }
    },
    [messages, isSending, searchMode, client, setPlan],
  );

  const clearChat = useCallback(() => setMessages([]), []);

  const value = useMemo(
    () => ({ messages, isSending, searchMode, setSearchMode, sendMessage, clearChat }),
    [messages, isSending, searchMode, sendMessage, clearChat],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
