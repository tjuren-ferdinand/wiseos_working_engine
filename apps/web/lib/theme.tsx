"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

export type AccentTheme = "mono" | "alabaster" | "slate" | "violet" | "mint" | "ice";

export const ACCENT_THEMES: { id: AccentTheme; label: string; swatch: string }[] = [
  { id: "mono", label: "Mono", swatch: "#8a837b" },
  { id: "slate", label: "Slate", swatch: "#64748B" },
  { id: "violet", label: "Violet", swatch: "#8B6FB0" },
  { id: "alabaster", label: "Alabaster", swatch: "#B08A4E" },
  { id: "mint", label: "Mint", swatch: "#4F9E82" },
  { id: "ice", label: "Ice", swatch: "#4E92A8" },
];

/** De två huvudvalen (utöver Mono) som visas direkt i inställningarna.
 *  Resten är mindre detalj-/accentnyanser under "Fler nyanser". */
export const PRIMARY_ACCENT_THEMES = [ACCENT_THEMES[0], ACCENT_THEMES[1], ACCENT_THEMES[5]];
export const DETAIL_ACCENT_THEMES = [ACCENT_THEMES[2], ACCENT_THEMES[3], ACCENT_THEMES[4]];

export type ReviewLayout = "split" | "stacked" | "compact";

export const REVIEW_LAYOUTS: { id: ReviewLayout; label: string; description: string }[] = [
  {
    id: "split",
    label: "Delad vy",
    description: "Skanning och uppgifter sida vid sida.",
  },
  {
    id: "stacked",
    label: "Staplad vy",
    description: "Skanning högst upp, uppgifter i fullbredd under.",
  },
  {
    id: "compact",
    label: "Kompakt vy",
    description: "Endast uppgiftslista utan skanning — snabbast att granska.",
  },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  accentTheme: AccentTheme;
  setAccentTheme: (accentTheme: AccentTheme) => void;
  reviewLayout: ReviewLayout;
  setReviewLayout: (layout: ReviewLayout) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [accentTheme, setAccentThemeState] = useState<AccentTheme>("ice");
  const [reviewLayout, setReviewLayoutState] = useState<ReviewLayout>("split");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("wiseos-theme") as Theme | null;
    if (stored) {
      setThemeState(stored);
    }
    const storedAccent = localStorage.getItem("wiseos-accent-theme") as AccentTheme | null;
    if (storedAccent) {
      setAccentThemeState(storedAccent);
    }
    const storedReviewLayout = localStorage.getItem("wiseos-review-layout") as ReviewLayout | null;
    if (storedReviewLayout) {
      setReviewLayoutState(storedReviewLayout);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("wiseos-theme", theme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(theme);
    }
  }, [theme, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("wiseos-accent-theme", accentTheme);
      document.documentElement.setAttribute("data-theme", accentTheme);
    }
  }, [accentTheme, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("wiseos-review-layout", reviewLayout);
    }
  }, [reviewLayout, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const setAccentTheme = (newAccentTheme: AccentTheme) => {
    setAccentThemeState(newAccentTheme);
  };

  const setReviewLayout = (newReviewLayout: ReviewLayout) => {
    setReviewLayoutState(newReviewLayout);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme, accentTheme, setAccentTheme, reviewLayout, setReviewLayout }}
    >
      {mounted ? children : <div style={{ visibility: "hidden" }}>{children}</div>}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
