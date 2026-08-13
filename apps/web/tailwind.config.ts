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
        arc: {
          bg: "#FAF7F2",
          surface: "#FFFFFF",
          text: "#2B2620",
          muted: "#8A8377",
          subtle: "rgba(43, 38, 32, 0.08)",
          gold: "#C9A24B",
          copper: "#B87A4B",
        },
        // WiseOS design system — "Graphite" — theme-agnostic tokens tied to CSS variables
        paper: {
          DEFAULT: "rgb(var(--background))",
          raised: "rgb(var(--surface))",
          secondary: "rgb(var(--surface-2))",
          elevated: "rgb(var(--surface-elevated))",
        },
        ink: {
          DEFAULT: "rgb(var(--foreground))",
          secondary: "rgb(var(--muted))",
          muted: "rgb(var(--muted-2))",
          hairline: "rgb(var(--hairline) / 0.08)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent))",
          soft: "rgb(var(--accent-soft))",
          tint: "rgb(var(--accent) / 0.12)",
        },
        state: {
          success: "rgb(var(--state-success))",
          warning: "rgb(var(--state-warning))",
          danger: "rgb(var(--state-danger))",
        },
      },
      borderRadius: {
        control: "10px",
        panel: "18px",
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
        // Extremely soft — "light floating in space", barely visible in dark, gentle in light
        soft: "0 1px 2px rgba(0,0,0,0.08)",
        card: "0 4px 24px rgba(0,0,0,0.08)",
        elevated: "0 12px 48px rgba(0,0,0,0.12)",
        glow: "0 0 0 1px rgba(0,0,0,0.05), 0 12px 48px rgba(0,0,0,0.10)",
      },
      borderColor: {
        subtle: "rgb(var(--hairline) / 0.08)",
      },
      backdropBlur: {
        xs: "6px",
      },
    },
  },
  plugins: [],
};
export default config;
