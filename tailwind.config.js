/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        background: { DEFAULT: 'var(--background)' },
        foreground: { DEFAULT: 'var(--foreground)' },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        border: { DEFAULT: 'var(--border)' },
        input: { DEFAULT: 'var(--input)' },
        ring: { DEFAULT: 'var(--ring)' },
        navy: {
          DEFAULT: 'var(--navy)',
          light: 'var(--navy-light)',
        },
        saffron: {
          DEFAULT: 'var(--saffron)',
          light: 'var(--saffron-light)',
        },
        gold: { DEFAULT: 'var(--gold)' },
        cream: {
          DEFAULT: 'var(--cream)',
          dark: 'var(--cream-dark)',
        },
        success: { DEFAULT: 'var(--success)' },
        warning: { DEFAULT: 'var(--warning)' },
        error: { DEFAULT: 'var(--error)' },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'calc(var(--radius) - 4px)',
        md: 'var(--radius)',
        lg: 'calc(var(--radius) + 4px)',
        xl: 'calc(var(--radius) + 8px)',
        '2xl': 'calc(var(--radius) + 16px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        display: ['var(--font-sans)', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-in-right': 'slideInRight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'shimmer': 'shimmer 1.5s infinite',
        'spin-slow': 'spin-slow 8s linear infinite',
        'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      boxShadow: {
        card: '0 2px 8px rgba(28, 43, 94, 0.08), 0 1px 3px rgba(28, 43, 94, 0.04)',
        'card-hover': '0 8px 32px rgba(28, 43, 94, 0.14), 0 2px 8px rgba(28, 43, 94, 0.08)',
        'card-lg': '0 16px 48px rgba(28, 43, 94, 0.16), 0 4px 16px rgba(28, 43, 94, 0.08)',
        'saffron': '0 4px 16px rgba(200, 96, 10, 0.35)',
        'navy': '0 4px 16px rgba(27, 43, 94, 0.35)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};