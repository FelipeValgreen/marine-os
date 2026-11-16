import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "var(--font-jetbrains-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      colors: {
        daylight: {
          bg: "#F0F4F8",
          surface: "#E1E7EE",
          text: "#0A192F",
          accent: "#D94A1A",
        },
        ocean: {
          bg: "#040B16",
          surface: "#0A192F",
          lifebuoy: "#FF5722",
          aqua: "#00E5FF",
          starboard: "#00E676",
          amber: "#FF9F0A",
          port: "#FF2D55",
        },
        night: {
          bg: "#000000",
          red: "#FF0000",
          crimson: "#FF1E1E",
          dim: "#990000",
          border: "#4D0000",
        },
      },
      minHeight: {
        touch: "64px",
        tactile: "56px",
      },
      keyframes: {
        shaStampDrop: {
          "0%": {
            opacity: "0",
            transform: "scale(2.35) rotate(-12deg) translateY(-48px)",
          },
          "65%": {
            opacity: "1",
            transform: "scale(0.94) rotate(-4deg) translateY(4px)",
          },
          "82%": {
            transform: "scale(1.03) rotate(-5deg) translateY(0px)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1) rotate(-4deg) translateY(0px)",
          },
        },
      },
      animation: {
        "sha-stamp": "shaStampDrop 0.48s cubic-bezier(0.22, 1, 0.36, 1) forwards",
      },
    },
  },
  plugins: [],
};
export default config;
