export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      colors: { brand: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95' } },
      boxShadow: { soft: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)', pop: '0 12px 32px -8px rgba(16,24,40,.18)' },
      keyframes: { 'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } }, 'scale-in': { from: { opacity: 0, transform: 'scale(.97)' }, to: { opacity: 1, transform: 'none' } } },
      animation: { 'fade-in': 'fade-in .25s ease-out', 'scale-in': 'scale-in .18s ease-out' },
    },
  },
  plugins: [],
};
