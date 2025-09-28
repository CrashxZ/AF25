// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan these folders for class names
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: "class", // enable dark mode via `class` on <html>
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px" // keep dashboards comfortably narrow
      }
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0ea5e9", // accent for links/active tabs
          dark: "#0369a1"
        }
      },
      boxShadow: {
        card: "0 2px 20px rgba(0,0,0,0.06)" // soft card shadow
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem"
      }
    }
  },
  plugins: []
};