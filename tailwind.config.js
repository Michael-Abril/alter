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
          bg: '#09090B',
          surface: '#12120F',
          'surface-elevated': '#1C1A15',
          text: '#FAFAF9',
          'text-secondary': '#A8A29E',
          muted: '#78716C',
          border: 'rgba(212, 167, 68, 0.12)',
          'border-strong': 'rgba(212, 167, 68, 0.25)',
          primary: '#D4A744',
          cyan: '#F5C952',
          violet: '#B8860B',
          success: '#10B981',
          gold: '#D4A744',
          'gold-light': '#F5C952',
          'gold-dark': '#96752F',
          amber: '#F59E0B',
        },
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
          'linear-gradient(rgba(212,167,68,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(212,167,68,0.06) 1px, transparent 1px)',
        'alter-radial':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(212, 167, 68, 0.18), transparent 50%)',
        'alter-radial-cyan':
          'radial-gradient(ellipse 60% 40% at 100% 0%, rgba(245, 201, 82, 0.08), transparent 45%)',
        'alter-radial-warm':
          'radial-gradient(ellipse 50% 50% at 20% 80%, rgba(184, 134, 11, 0.1), transparent 50%)',
      },
      boxShadow: {
        'alter-glow': '0 0 0 1px rgba(212, 167, 68, 0.2), 0 24px 48px -12px rgba(0, 0, 0, 0.55), 0 0 40px -8px rgba(212, 167, 68, 0.15)',
        'alter-card': '0 1px 0 0 rgba(212, 167, 68, 0.04) inset, 0 12px 40px -16px rgba(0, 0, 0, 0.6)',
        'alter-gold-sm': '0 0 20px -4px rgba(212, 167, 68, 0.2)',
        'alter-gold-lg': '0 0 60px -12px rgba(212, 167, 68, 0.3)',
      },
      keyframes: {
        'alter-fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px) rotateX(8deg)' },
          '100%': { opacity: '1', transform: 'translateY(0) rotateX(0deg)' },
        },
        'alter-gradient': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'alter-pulse-soft': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.85' },
        },
        'alter-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'alter-float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'alter-glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px -4px rgba(212, 167, 68, 0.15)' },
          '50%': { boxShadow: '0 0 40px -4px rgba(212, 167, 68, 0.3)' },
        },
        'alter-marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'alter-particle-drift': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-100vh) translateX(20px)', opacity: '0' },
        },
        'alter-border-shimmer': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      animation: {
        'alter-fade-up': 'alter-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'alter-gradient': 'alter-gradient 8s ease infinite',
        'alter-pulse-soft': 'alter-pulse-soft 4s ease-in-out infinite',
        'alter-shimmer': 'alter-shimmer 3s ease-in-out infinite',
        'alter-float': 'alter-float 6s ease-in-out infinite',
        'alter-glow-pulse': 'alter-glow-pulse 4s ease-in-out infinite',
        'alter-marquee': 'alter-marquee 30s linear infinite',
        'alter-border-shimmer': 'alter-border-shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
};
