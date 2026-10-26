// Colours are CSS variables (see src/index.css) so light and dark share every class.
// The values are the phone app's design tokens: the same teal brand, surfaces and text colours.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Newsreader"', 'Georgia', 'serif']
      },
      colors: {
        canvas: v('canvas'),
        panel: v('panel'),
        sunken: v('sunken'),
        line: v('line'),
        'line-strong': v('line-strong'),
        ink: v('ink'),
        muted: v('muted'),
        faint: v('faint'),
        brand: v('brand'),
        'brand-ink': v('brand-ink'),
        danger: v('danger'),
        warn: v('warn'),
        ok: v('ok')
      },
      boxShadow: {
        pop: '0 12px 32px -8px rgb(0 0 0 / 0.18), 0 2px 6px rgb(0 0 0 / 0.06)',
        card: '0 1px 2px rgb(0 0 0 / 0.04)'
      }
    }
  },
  plugins: []
};
