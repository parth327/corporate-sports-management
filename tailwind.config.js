/** @type {import('tailwindcss').Config} */

/**
 * Design tokens for the Corporate Sports Events Management portal.
 *
 * The palette is a three-colour triad — magenta, blue and yellow — plus a green
 * accent, set in DM Sans. Re-skin the portal for a new client by changing the
 * values below.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}', '!./src/_superseded/**'],
  theme: {
    extend: {
      screens: {
        '3xl': '1920px',
        '4xl': '2560px',
      },

      colors: {
        /* Arena base. Warm-shifted slate so it never reads cold against magenta —
           a blue-grey dark would fight the brand colour.

           Lifted off near-black deliberately: at #07060B the console's hairline
           borders and muted labels fell below the 4.5:1 contrast floor, and long
           data-entry sessions on a pure-black field are fatiguing. Starting at a
           mid slate gives every tint above it somewhere to sit. */
        ink: {
          900: '#1A1826',
          800: '#232130',
          700: '#2D2A3C',
          600: '#3A3649',
          500: '#4A4559',
        },

        /* #C72D86 — Primary brand magenta. */
        magenta: {
          200: '#F4C4E1',
          300: '#E888C0',
          400: '#DB55A5',
          500: '#C72D86',
          600: '#A01F6B',
          700: '#7A1550',
        },

        /* #2475B7 — Brand blue. */
        azure: {
          200: '#BEDCF3',
          300: '#7FB6E4',
          400: '#4A96D1',
          500: '#2475B7',
          600: '#1A5B92',
          700: '#12436E',
        },

        /* #FFCB00 — Brand yellow. Carries trophies, CTAs and celebration. */
        solar: {
          200: '#FFEDA3',
          300: '#FFE066',
          400: '#FFD633',
          500: '#FFCB00',
          600: '#D9AC00',
          700: '#A88500',
        },

        /* Emerald green — supporting accent.
           Carries the wellness and "pass/clear" states. */
        phthalo: {
          200: '#A8E8D0',
          300: '#5FD4AC',
          400: '#22BC8A',
          500: '#00A170',
          600: '#00815A',
          700: '#006244',
        },

        /*
         * Theme-reactive semantic tokens. Every call site that used to read
         * `text-white/NN`, `border-white/NN` or `bg-ink-900` now reads
         * `text-fg/NN`, `border-fg/NN` or `bg-surface` instead — same opacity
         * ladder, same call sites, but the RGB channel underneath swaps when
         * `[data-theme="light"]` lands on <html>. `text-ink-900` is left alone
         * on purpose: it is only ever used as fixed dark text on a saturated
         * brand-colour badge (solar/phthalo/azure), which does not change
         * across themes, so it stays a literal colour rather than a token.
         */
        fg: 'rgb(var(--fg-rgb) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised-rgb) / <alpha-value>)',
        },

        /*
         * Accent TEXT tokens. The 200/300/400 tiers of each brand hue were
         * validated for contrast against the dark ink surface only — on a
         * light surface, e.g. azure-300 measures ~2:1 (needs 4.5:1) and
         * solar-400 measures ~1.3:1. These four tokens carry the same hue as
         * eyebrow labels, inline links and "current/leader" highlights, but
         * step to a darker, light-mode-safe tier under [data-theme="light"]
         * (see index.css). Only literal TEXT color uses this — borders,
         * translucent badge fills and icon dots stay on the raw palette,
         * since those only need the 3:1 non-text floor and already sit on
         * their own tinted chip rather than the bare page surface.
         */
        accent: {
          magenta: 'rgb(var(--accent-magenta-rgb) / <alpha-value>)',
          azure: 'rgb(var(--accent-azure-rgb) / <alpha-value>)',
          solar: 'rgb(var(--accent-solar-rgb) / <alpha-value>)',
          phthalo: 'rgb(var(--accent-phthalo-rgb) / <alpha-value>)',
        },
      },

      /**
       * One typeface, four voices. The tuple syntax lets a single class carry
       * family, weight and tracking together, so `font-display` is genuinely
       * display-weight without every call site restating it.
       */
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: [
          ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          { fontWeight: '800', letterSpacing: '-0.035em' },
        ],
        cond: [
          ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          { fontWeight: '600', letterSpacing: '-0.01em' },
        ],
        mono: [
          ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          { fontWeight: '500' },
        ],
      },

      /**
       * Every whole percent, not just the default multiples of five.
       *
       * The console's text tiers are tuned one or two percent apart to clear
       * the contrast floor without flattening the hierarchy — `text-white/86`
       * for body and `/82` for a secondary line are deliberately distinct, and
       * snapping both to /85 would merge them. JIT only emits what is used, so
       * the extra steps cost nothing in the bundle.
       */
      opacity: Object.fromEntries(
        Array.from({ length: 101 }, (_, i) => [String(i), String(i / 100)]),
      ),

      letterSpacing: {
        hud: '0.22em',
        wider2: '0.1em',
        tightest: '-0.04em',
      },

      maxWidth: {
        shell: '1320px',
      },

      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px)',
        /* The brand triad as a single sweep — used for rules, bars and the
           scroll progress indicator. */
        spectrum: 'linear-gradient(90deg, #C72D86 0%, #2475B7 50%, #FFCB00 100%)',
        'spectrum-y': 'linear-gradient(180deg, #C72D86 0%, #2475B7 50%, #FFCB00 100%)',
      },

      backgroundSize: {
        grid: '64px 64px',
      },

      keyframes: {
        marquee: {
          from: { transform: 'translate3d(0,0,0)' },
          to: { transform: 'translate3d(-50%,0,0)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.5)', opacity: '0' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
      },

      animation: {
        marquee: 'marquee 38s linear infinite',
        'marquee-slow': 'marquee 70s linear infinite',
        'pulse-ring': 'pulseRing 2.4s cubic-bezier(0.22,1,0.36,1) infinite',
      },
    },
  },
  plugins: [
    /* `coarse:` applies only on touch screens, so tap targets can grow there without touching the desktop layout. */
    ({ addVariant }) => addVariant('coarse', '@media (pointer: coarse)'),
  ],
};
