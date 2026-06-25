import type { Config } from "tailwindcss";

/**
 * Design tokens — §12.1 of the build spec. These are the only colors and the
 * only type scale anything in the UI is allowed to reach for.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FBFAF8",
        surface: "#FFFFFF",
        ink: "#16151A",
        muted: "#6B6A73",
        line: "#ECE9E3",
        accent: {
          DEFAULT: "#5B4BE6",
          soft: "#EEEBFB",
        },
        sealed: {
          DEFAULT: "#0F9D6B",
          soft: "#E4F4EE",
        },
        alert: {
          DEFAULT: "#E2562B",
          soft: "#FBE9E2",
        },
      },
      fontFamily: {
        display: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Geist Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        // §12.1 type scale.
        display: ["3rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        h1: ["2rem", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        h2: ["1.5rem", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        h3: ["1.125rem", { lineHeight: "1.4" }],
        body: ["1rem", { lineHeight: "1.6" }],
        small: ["0.875rem", { lineHeight: "1.55" }],
      },
      fontWeight: {
        normal: "400",
        medium: "500",
      },
      borderRadius: {
        card: "12px",
      },
      borderColor: {
        DEFAULT: "#ECE9E3",
      },
      boxShadow: {
        // The single soft-elevation token — for the active draft capsule card.
        elevated: "0 1px 2px rgba(22,21,26,0.04), 0 8px 24px rgba(22,21,26,0.06)",
      },
      transitionTimingFunction: {
        seal: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
