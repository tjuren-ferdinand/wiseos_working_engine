import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Premium muted rose palette - Notion/Linear enterprise feel
        wise: {
          50: "#faf8f9",   // Almost white, subtle warmth
          100: "#f5f1f3",  // Soft muted rose - premium cards
          200: "#ebe4e8",  // Refined, less saturated
          300: "#d4c4d0",  // Sophisticated midtone
          400: "#b9a3b3",  // Elegant muted
          500: "#9B5A97",  // Brand purple - primary
          600: "#875085",  // Hover state
          700: "#6d4169",  // Active/pressed
          800: "#553352",  // Dark accent
          900: "#3d253a",  // Very dark
          950: "#251822",  // Near black
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
