/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        canvas: "#F4F6FA",
        surface: "#FFFFFF",
        primary: "#3F5BD9",
        "primary-dark": "#2D46B8",
        profit: "#0B9D58",
        loss: "#E53935",
        ink: "#0F172A",
        muted: "#64748B",
        hairline: "#E2E8F0",
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)",
        nav: "0 -2px 10px rgba(15, 23, 42, 0.05)",
      },
    },
  },
  plugins: [],
};
