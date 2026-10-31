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
        ok: v('ok'),
        // Metric colours, used by the phone design
        'm-debt': v('m-debt'),
        'm-plan': v('m-plan'),
        'm-interest': v('m-interest'),
        'm-free': v('m-free'),
        'm-limit': v('m-limit'),
        'm-spend': v('m-spend'),
        'm-space': v('m-space'),
        'm-offer': v('m-offer'),
        'm-slate': v('m-slate')
      },
      boxShadow: {
        pop: '0 12px 32px -8px rgb(0 0 0 / 0.18), 0 2px 6px rgb(0 0 0 / 0.06)',
        card: '0 1px 2px rgb(0 0 0 / 0.04)'
      }
    }
  },
  plugins: [
    // Phone and iPad designs (lib/layout.ts sets <html data-layout>): phone:, tablet:, and compact: for both
    function ({ addVariant }) {
      addVariant('phone', '[data-layout=phone] &');
      addVariant('tablet', '[data-layout=tablet] &');
      addVariant('compact', ':is([data-layout=phone], [data-layout=tablet]) &');
    }
  ]
};
