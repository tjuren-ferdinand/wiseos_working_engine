"use client";

import { useTheme } from "@/lib/theme";
import LineIcon from "./LineIcon";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Växla till ljust läge" : "Växla till mörkt läge"}
      className="flex h-10 w-10 items-center justify-center rounded-2xl text-muted transition-colors hover:bg-equi-100 active:scale-95 dark:hover:bg-equi-900"
    >
      <LineIcon name={theme === "dark" ? "sun" : "moon"} className="h-5 w-5" />
    </button>
  );
}
