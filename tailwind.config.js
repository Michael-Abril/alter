/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nightshift: {
          navy: '#0F3460',
          accent: '#E94560',
          bg: '#0A0A12',
          'bg-light': '#12122A',
          'bg-card': '#1A1A3E',
          'text-primary': '#E8E8F0',
          'text-secondary': '#9999BB',
          'text-muted': '#666688',
          border: '#2A2A4E',
          success: '#4ADE80',
          warning: '#FBBF24',
          error: '#F87171',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
