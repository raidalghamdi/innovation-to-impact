import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        brand: {
          // Competition Innovation Program — OFFICIAL guideline palette only
          // (Style Guide p.8). Moon Raker is the single strong color; Swans Down
          // and Humming Bird are soft supporting tints; Shark is body text.
          'moon-raker': '#1C4854', // primary — dark surfaces, headers, big numbers
          'swans-down': '#D8EFE5', // soft accent tint — rules, labels, KPI top rule
          'humming-bird': '#CFEDF8', // support tint — alt table rows, hairlines
          shark: '#232529', // body text
          // Deprecated aliases retained so existing class names keep compiling;
          // all remapped onto the guideline palette (no gold/cream/#0F2D36 hex).
          teal: '#1C4854', // Moon Raker
          'teal-dark': '#1C4854', // was #0F2D36 → Moon Raker
          'teal-light': '#D8EFE5', // Swans Down
          moon: '#1C4854',
          'moon-dark': '#1C4854', // was #0F2D36 → Moon Raker
          cyan: '#CFEDF8', // was #3FBAC8 → Humming Bird
          'cyan-alt': '#CFEDF8',
          'cyan-light': '#D8EFE5',
          gold: '#1C4854', // was #E0A82E → Moon Raker (accents become the strong color)
          'gold-light': '#D8EFE5', // was #F5EDD6 → Swans Down
          cream: '#FFFFFF', // was #F7F5EF → white content background
          ink: '#232529', // Shark
          'muted-dark': '#5C5F66',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'var(--font-inter)', 'var(--font-arabic)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
