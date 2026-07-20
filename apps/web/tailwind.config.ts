import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Premium soft pink palette - Linear/Notion inspired
        wise: {
          50: "#fdf6fc",   // Subtle background accent
          100: "#fbf0fa",
          200: "#f5e0f3",
          300: "#e8b0e4",  // Primary accent
          400: "#d89dd3",  // Hover accent
          500: "#c78bbf",
          600: "#b077a8",
          700: "#8f5f8a",
          800: "#6e4a6b",
          900: "#4d3549",
          950: "#2d1f2b",
        },
        // Neutral ink colors for text
        ink: {
          DEFAULT: "#1e293b",
          light: "#475569",
          muted: "#64748b",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        // Ultra-soft shadows for premium feel
        soft: "0 1px 2px 0 rgb(15 23 42 / 0.03), 0 1px 3px 0 rgb(15 23 42 / 0.04)",
        card: "0 1px 3px 0 rgb(15 23 42 / 0.04), 0 4px 8px -2px rgb(15 23 42 / 0.06)",
        elevated: "0 4px 12px -2px rgb(15 23 42 / 0.08), 0 8px 24px -4px rgb(15 23 42 / 0.06)",
        glow: "0 0 0 1px rgb(232 176 228 / 0.12), 0 4px 16px -4px rgb(232 176 228 / 0.15)",
      },
      borderColor: {
        subtle: "#eef2f7",
      },
    },
  },
  plugins: [],
};
export default config;
