/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#060a13',
        'dark-card': '#0d1321',
        'dark-card-hover': '#111827',
        'dark-border': '#1e293b',
        'dark-border-hover': '#334155',
        'primary-blue': '#3b82f6',
        'primary-blue-hover': '#60a5fa',
        'accent-green': '#10b981',
        'accent-cyan': '#06b6d4',
        'accent-red': '#ef4444',
        'accent-amber': '#f59e0b',
        'surface': '#0f172a',
        'surface-light': '#1e293b',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glow-red': 'radial-gradient(ellipse at center, rgba(239,68,68,0.15), transparent 70%)',
        'glow-blue': 'radial-gradient(ellipse at center, rgba(59,130,246,0.1), transparent 70%)',
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(59, 130, 246, 0.15)',
        'glow-red': '0 0 15px -3px rgba(239, 68, 68, 0.2)',
        'glow-green': '0 0 15px -3px rgba(16, 185, 129, 0.2)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
