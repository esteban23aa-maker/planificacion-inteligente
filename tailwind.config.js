/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}", // analiza templates Angular y TS
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#E6F2F9",
          100: "#CFE7F5",
          200: "#A9D6EF",
          300: "#78BEE6",
          400: "#49A6DD",
          500: "#238FD2",
          600: "#0477BF", // protagonista
          700: "#0366A3",
          800: "#034F7D",
          900: "#023757",
        },
        neutral: {
          50: "#f6f7f9",
          100: "#eff1f4",
          200: "#e2e6eb",
          300: "#ccd3dc",
          400: "#a8b1bd",
          500: "#8692a3",
          600: "#677386",
          700: "#4d5668",
          800: "#394250",
          900: "#242b36",
        },
      },
      borderRadius: {
        xl: "20px",
      },
      boxShadow: {
        elev1: "0 4px 12px rgba(0,0,0,.06)",
        elev2: "0 10px 24px rgba(0,0,0,.08)",
      },
    },
  },
  plugins: [],
};
