/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0B0E14",
          surface: "#121722",
          card: "#182030",
          border: "#253048",
          bull: "#00E676",
          bear: "#FF1744",
          accent: "#3B82F6",
          gold: "#F59E0B",
          text: "#F3F4F6",
          muted: "#9CA3AF"
        }
      }
    },
  },
  plugins: [],
}
