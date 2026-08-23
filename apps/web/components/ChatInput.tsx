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
      className="flex items-end gap-2 rounded-2xl border border-equi-300/50 bg-equi-50 p-2 shadow-card dark:border-equi-800/50 dark:bg-equi-950"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Fråga AI:n om ett ämne, en övning eller en rättning..."
        disabled={disabled}
        className="min-h-12 flex-1 resize-none bg-transparent px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-equi-50 transition-all disabled:opacity-50 active:scale-95 dark:bg-equi-100 dark:text-ink"
      >
        <LineIcon name="send" className="h-5 w-5" />
      </button>
    </form>
  );
}
