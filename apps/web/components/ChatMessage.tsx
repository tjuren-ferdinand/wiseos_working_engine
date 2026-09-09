"use client";

import type { ChatMessage } from "@/lib/ai/ai-provider";

export interface ChatMessageProps {
  message: ChatMessage;
}

export default function ChatMessageItem({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}>
      <div
        className={`max-w-[85%] rounded-[16px] px-5 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-ink text-paper"
            : "border border-ink-hairline bg-paper-raised text-ink"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
