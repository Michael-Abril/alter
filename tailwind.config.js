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
        alter: {
          bg: '#0B0F19',
          surface: '#111827',
          'surface-elevated': '#1E293B',
          text: '#E5E7EB',
          'text-secondary': '#94A3B8',
          muted: '#64748B',
          border: 'rgba(148, 163, 184, 0.12)',
          'border-strong': 'rgba(148, 163, 184, 0.22)',
          primary: '#4F46E5',
          cyan: '#06B6D4',
          violet: '#8B5CF6',
          success: '#10B981',
        },
        /* In-app shell (authenticated) — Alter product UI */
        nightshift: {
          bg: '#080d18',
          'bg-light': '#0f172a',
          'bg-card': '#111827',
          elevated: '#1e293b',
          surface: '#0f172a',
          accent: '#2563eb',
          navy: '#7c3aed',
          highlight: '#06b6d4',
          warm: '#fb7185',
          coral: '#f97316',
          'text-primary': '#f8fafc',
          'text-secondary': '#94a3b8',
          'text-muted': '#64748b',
          border: 'rgba(148, 163, 184, 0.14)',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'alter-grid':
          'linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)',
        'alter-radial':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(79, 70, 229, 0.25), transparent 50%)',
        'alter-radial-cyan':
          'radial-gradient(ellipse 60% 40% at 100% 0%, rgba(6, 182, 212, 0.12), transparent 45%)',
      },
      boxShadow: {
        'alter-glow': '0 0 0 1px rgba(79, 70, 229, 0.15), 0 24px 48px -12px rgba(0, 0, 0, 0.45)',
        'alter-card': '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -16px rgba(0, 0, 0, 0.5)',
      },
      keyframes: {
        'alter-fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'alter-gradient': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'alter-pulse-soft': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.85' },
        },
      },
      animation: {
        'alter-fade-up': 'alter-fade-up 0.7s ease-out forwards',
        'alter-gradient': 'alter-gradient 8s ease infinite',
        'alter-pulse-soft': 'alter-pulse-soft 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
