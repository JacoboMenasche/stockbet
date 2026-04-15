import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0E1012",
          nav: "rgba(14,16,18,0.75)",
          surface: "rgba(255,255,255,0.04)",
          border: "rgba(255,255,255,0.08)",
        },
        yes: {
          DEFAULT: "#94E484",
          muted: "rgba(148,228,132,0.12)",
          border: "rgba(148,228,132,0.3)",
        },
        no: {
          DEFAULT: "#D84838",
          muted: "rgba(216,72,56,0.12)",
          border: "rgba(216,72,56,0.3)",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "SF Pro Text", "SF Pro Display", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
