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
          // GUIDELINE palette — used by reports (Style Guide p.8). Do NOT change
          // these keys: Moon Raker is the single strong color; Swans Down and
          // Humming Bird are soft supporting tints; Shark is body text.
          'moon-raker': '#1C4854', // primary — dark surfaces, headers, big numbers
          'swans-down': '#D8EFE5', // soft accent tint — rules, labels, KPI top rule
          'humming-bird': '#CFEDF8', // support tint — alt table rows, hairlines
          shark: '#232529', // body text
          // WEBSITE vibrant accent palette — restored to pre-Round-7 values.
          // These drive the hero gradient, CTA buttons, slogan pills, glows, and
          // eyebrow chip. Reports embed hex directly and do NOT consume these.
          teal: '#1C4854', // Moon Raker — primary dark surface
          'teal-dark': '#0F2D36', // deep navy for hero backdrop layering
          'teal-light': '#D8EFE5', // Swans Down
          moon: '#1C4854',
          'moon-dark': '#0F2D36',
          cyan: '#3FBAC8', // vibrant teal-cyan
          'cyan-alt': '#4ABFCD',
          'cyan-light': '#7ED5DE', // bright cyan (used by "نافس" word)
          gold: '#E0A82E', // vibrant gold (CTA button + "أثر" word)
          'gold-light': '#F5EDD6', // light gold tint
          cream: '#F7F5EF', // warm off-white
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
