import type { Config } from "tailwindcss";

// TailwindCSS v4: cores e design tokens são definidos via @theme no globals.css
// Este arquivo é mantido apenas para compatibilidade do editor / plugins
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // — Paleta principal: Azul/Verde Saúde Mental (tons pastel acolhedores)
        primary: {
          50:  "#edf7f6",
          100: "#d1eeec",
          200: "#a6dcd9",
          300: "#74c5c0",
          400: "#45aba5",
          500: "#2d9e97",   // Verde-azul principal
          600: "#247d77",
          700: "#1e6560",
          800: "#1a5250",
          900: "#163f3e",
          950: "#0a2524",
        },
        secondary: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#4a8fe0",   // Azul suave
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        // — Tons pastel de apoio
        lavender: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
        },
        peach: {
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
        },
        // — Semânticos
        success:  "#22c55e",
        warning:  "#f59e0b",
        danger:   "#ef4444",
        info:     "#3b82f6",
        // — Background suaves
        surface: {
          DEFAULT: "#f8fffe",
          card:    "#ffffff",
          muted:   "#f1f5f4",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Plus Jakarta Sans", "Inter", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        card:  "0 1px 3px 0 rgba(45,158,151,.08), 0 1px 2px -1px rgba(45,158,151,.06)",
        hover: "0 4px 20px 0 rgba(45,158,151,.15), 0 2px 8px -2px rgba(45,158,151,.10)",
        modal: "0 20px 60px -10px rgba(0,0,0,.18)",
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease-out",
        "slide-up":   "slideUp 0.3s ease-out",
        "slide-left": "slideLeft 0.25s ease-out",
        pulse_slow:   "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn:    { from: { opacity: "0" },                   to: { opacity: "1" } },
        slideUp:   { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideLeft: { from: { opacity: "0", transform: "translateX(-12px)" }, to: { opacity: "1", transform: "translateX(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
