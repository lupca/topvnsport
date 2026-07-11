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
        sans: ["Be Vietnam Pro", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        brand: {
          primary: "#005eb8",
          secondary: "#003a70",
          accent: "#000000",
          light: "#f5f7fa",
        },
        surface: {
          DEFAULT: "#ffffff",
          hover: "#f9f9f9",
        },
        primary: {
          50: "#e8f2ff",
          100: "#d1e4ff",
          200: "#a8cbff",
          300: "#78adff",
          400: "#488eff",
          500: "#246fe8",
          600: "#005eb8",
          700: "#003a70",
          800: "#0a315d",
          900: "#102f4f",
        },
      },
      boxShadow: {
        soft: "0 8px 24px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
// Add Next.js env file reference
