"use client";

import { useState } from "react";
import LineIcon from "./LineIcon";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded-[16px] border border-ink-hairline bg-paper-raised p-2 shadow-card"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Fråga AI:n om ett ämne, en övning eller en rättning..."
        aria-label="Meddelande till AI"
        disabled={disabled}
        className="min-h-12 min-w-0 flex-1 rounded-[10px] bg-transparent px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="submit"
        aria-label="Skicka meddelande"
        disabled={disabled || !value.trim()}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-ink text-paper transition-all enabled:hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50 enabled:active:scale-[0.98]"
      >
        <LineIcon name="send" className="h-5 w-5" />
      </button>
    </form>
  );
}
