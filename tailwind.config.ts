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
          DEFAULT: "#0D1B2A",
          nav: "#0B1622",
          surface: "#111F2E",
          border: "rgba(255,255,255,0.08)",
        },
        yes: {
          DEFAULT: "#00C2A8",
          muted: "rgba(0,194,168,0.12)",
          border: "rgba(0,194,168,0.3)",
        },
        no: {
          DEFAULT: "#F5A623",
          muted: "rgba(245,166,35,0.12)",
          border: "rgba(245,166,35,0.3)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
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
