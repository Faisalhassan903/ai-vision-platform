/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom security theme colors
        'dark-bg': '#0a0e27',
        'dark-card': '#1a1f3a',
        'dark-border': '#2a3150',
        'primary-blue': '#60a5fa',
        'accent-green': '#10b981',
      },
    },
  },
  plugins: [],
}