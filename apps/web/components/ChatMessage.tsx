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
        className={`max-w-[85%] rounded-3xl px-5 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-ink text-equi-50 dark:bg-equi-100 dark:text-ink"
            : "border border-equi-300/50 bg-equi-50 text-ink dark:border-equi-800/50 dark:bg-equi-950"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
