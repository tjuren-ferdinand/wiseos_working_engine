import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Equi design system — exact palette requested for 2026-08-16-v1.0
        equi: {
          50: "#fbfaf9",
          100: "#f5f3f0",
          200: "#e6e2dc",
          300: "#d1ccc4",
          400: "#a8a199",
          500: "#8a837b",
          600: "#6d6860",
          700: "#545049",
          800: "#3b3834",
          900: "#252421",
          950: "#151412",
        },
        sand: {
          50: "#faf9f6",
          100: "#f3f1ec",
          200: "#e6e1d8",
          300: "#d4ccc0",
          400: "#b9afa2",
          500: "#a09486",
          600: "#857a6e",
          700: "#6d645a",
          800: "#575049",
          900: "#45413b",
        },
        // Semantic tokens driven by CSS variables
        paper: {
          DEFAULT: "rgb(var(--background))",
          raised: "rgb(var(--surface))",
          secondary: "rgb(var(--surface-2))",
          elevated: "rgb(var(--surface-elevated))",
        },
        surface: {
          DEFAULT: "rgb(var(--surface))",
          2: "rgb(var(--surface-2))",
        },
        ink: {
          DEFAULT: "rgb(var(--foreground))",
          secondary: "rgb(var(--muted))",
          muted: "rgb(var(--muted-2))",
          hairline: "rgb(var(--hairline) / 0.08)",
          // Equi ink scale
          50: "#f6f6f7",
          100: "#e4e4e6",
          200: "#c8c9cd",
          300: "#a4a6ad",
          400: "#7b7e87",
          500: "#5f636c",
          600: "#4b4e57",
          700: "#3c3f46",
          800: "#303239",
          900: "#1c1d20",
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
        // Legacy aliases kept for older components
        wise: {
          50: "#faf8f9",
          100: "#f5f1f3",
          200: "#ebe4e8",
          300: "#d4c4d0",
          400: "#b9a3b3",
          500: "#9B5A97",
          600: "#875085",
          700: "#6d4169",
          800: "#553352",
          900: "#3d253a",
          950: "#251822",
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
      },
      borderRadius: {
        control: "10px",
        panel: "18px",
        "2.5xl": "1.25rem",
        "3xl": "1.5rem",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 2px 20px -4px rgba(0,0,0,0.06)",
        card: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -6px rgba(0,0,0,0.06)",
        float: "0 12px 40px -8px rgba(0,0,0,0.12)",
        // legacy aliases
        elevated: "0 12px 48px rgba(0,0,0,0.12)",
        glow: "0 0 0 1px rgba(0,0,0,0.05), 0 12px 48px rgba(0,0,0,0.10)",
      },
      borderColor: {
        subtle: "rgb(var(--hairline) / 0.08)",
      },
      backdropBlur: {
        xs: "6px",
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out forwards",
        "slide-up": "slide-up 0.35s ease-out forwards",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
