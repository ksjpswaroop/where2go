import type { PlanResponse } from "@where2go/schemas";

import type { PlanningClientConfig } from "./planning";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatSearchMode = "maps" | "web" | "none";

export type ChatRequest = {
  messages: ChatMessage[];
  mapCenter?: { lat: number; lng: number };
  searchMode?: ChatSearchMode;
  profile?: Record<string, unknown>;
};

export type ChatResponse = {
  text?: string;
  message?: string;
  markers?: Array<{ lat: number; lng: number; title: string; description?: string }>;
  route?: { points: Array<{ lat: number; lng: number }> };
  plan?: PlanResponse;
  planResponse?: PlanResponse;
  itinerary?: unknown;
  functionCalls?: unknown[];
  groundingChunks?: unknown[];
};

export function createChatClient(config: PlanningClientConfig) {
  const headers = async (): Promise<Record<string, string>> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const token = config.getAuthToken ? await config.getAuthToken() : null;
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };

  return {
    async sendChat(body: ChatRequest): Promise<ChatResponse> {
      const res = await fetch(`${config.baseUrl}/api/chat`, {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Chat failed (${res.status}): ${err}`);
      }
      return res.json() as Promise<ChatResponse>;
    },
  };
}
