/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#e3f2fd', 100: '#bbdefb', 200: '#90caf9', 500: '#1976d2', 600: '#1565c0', 700: '#0d47a1' },
        secondary: { 50: '#e8f5e9', 100: '#c8e6c9', 500: '#388e3c', 600: '#2e7d32', 700: '#1b5e20' },
        accent: { 50: '#fff3e0', 100: '#ffe0b2', 500: '#f57c00', 600: '#e65100', 700: '#bf360c' },
      },
    },
  },
  plugins: [],
};
