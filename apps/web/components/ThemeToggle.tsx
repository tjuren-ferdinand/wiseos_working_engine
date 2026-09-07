"use client";

import { useTheme } from "@/lib/theme";
import LineIcon from "./LineIcon";

const NEXT_LABEL: Record<string, string> = {
  light: "Växla till cream-läge",
  cream: "Växla till mörkt läge",
  dark: "Växla till ljust läge",
};

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={NEXT_LABEL[theme] ?? "Växla tema"}
      className="flex h-10 w-10 items-center justify-center rounded-2xl text-ink-secondary transition-colors hover:bg-equi-100 active:scale-95 dark:hover:bg-equi-900"
    >
      {theme === "cream" ? (
        <span
          className="h-5 w-5 rounded-full border border-ink-hairline"
          style={{ backgroundColor: "#FAF5EC" }}
        />
      ) : (
        <LineIcon name={theme === "dark" ? "sun" : "moon"} className="h-5 w-5" />
      )}
    </button>
  );
}
