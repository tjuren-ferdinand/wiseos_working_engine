import type { ChatMessage } from "./ai-provider";

export interface ChatServiceResponse {
  response: string;
  error?: string;
}

export async function sendChatMessage(messages: ChatMessage[]): Promise<ChatServiceResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const data = await res.json().catch(() => ({ error: "Oväntat svar från servern." }));

  if (!res.ok) {
    return { response: "", error: data.error ?? "Något gick fel." };
  }

  return { response: data.response ?? "" };
}
