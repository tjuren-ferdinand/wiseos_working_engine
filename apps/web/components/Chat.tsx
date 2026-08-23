"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/ai/ai-provider";
import { sendChatMessage } from "@/lib/ai/chat-service";
import ChatMessageItem from "./ChatMessage";
import ChatInput from "./ChatInput";
import LoadingState from "./ui/LoadingState";
import ErrorState from "./ui/ErrorState";

const welcomeMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hej! Jag är WiseOS AI-assistent. Just nu använder jag tillfälligt Gemini. Ställ en fråga om ett ämne, en övning eller be mig förklara ett rättningsförslag.",
  },
];

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(welcomeMessages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (text: string) => {
    const userMessage: ChatMessage = { role: "user", content: text };
    const history = [...messages, userMessage];
    setMessages(history);
    setLoading(true);
    setError(null);

    try {
      const { response, error: err } = await sendChatMessage(history);
      if (err) {
        setError(err);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      }
    } catch {
      setError("Något gick fel när meddelandet skickades.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col gap-4">
      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-equi-300/50 bg-equi-50 p-4 dark:border-equi-800/50 dark:bg-equi-950">
        {messages.map((message, index) => (
          <ChatMessageItem key={index} message={message} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <LoadingState title="AI tänker..." description="Detta kan ta några sekunder." />
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <ErrorState title="Kunde inte skicka" description={error} onRetry={() => setError(null)} />
          </div>
        )}
      </div>

      <ChatInput onSend={sendMessage} disabled={loading} />
    </div>
  );
}
