import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — Navy
        primary: '#0f172a',
        'primary-fg': '#ffffff',
        'primary-dim': '#1e293b',
        'primary-container': '#131b2e',
        'primary-container-fg': '#7c839b',

        // Secondary — Teal ("you are owed")
        owed: '#14b8a6',
        'owed-bg': '#f0fdfa',
        'owed-border': '#99f6e4',
        'owed-dim': '#0d9488',

        // Tertiary — Coral ("you owe")
        owing: '#f07167',
        'owing-bg': '#fff4f3',
        'owing-border': '#fca5a5',
        'owing-dim': '#e05a52',

        // Surfaces
        surface: '#f7f9fb',
        'surface-card': '#ffffff',
        'surface-low': '#f2f4f6',
        'surface-variant': '#e0e3e5',
        'surface-high': '#e6e8ea',

        // On-surface content
        'on-surface': '#191c1e',
        'on-surface-muted': '#45464d',

        // Borders
        'outline': '#76777d',
        'outline-variant': '#c6c6cd',

        // Error
        'error': '#ba1a1a',
        'error-bg': '#ffdad6',
        'error-border': '#f99',
        'error-text': '#93000a',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'amount-display': ['28px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
        'headline': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em' }],
        'headline-sm': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
        'subheading': ['20px', { lineHeight: '28px' }],
        'label': ['12px', { lineHeight: '16px', letterSpacing: '0.05em' }],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        '2xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 4px rgba(15, 23, 42, 0.06), 0 4px 16px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 4px 20px rgba(15, 23, 42, 0.10)',
        modal: '0 8px 32px rgba(15, 23, 42, 0.14)',
        focus: '0 0 0 3px rgba(15, 23, 42, 0.10)',
      },
      spacing: {
        'card': '20px',
        'container': '24px',
      },
    },
  },
  plugins: [],
} satisfies Config
