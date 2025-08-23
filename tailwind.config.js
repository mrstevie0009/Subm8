/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        foreground: 'var(--fg)',
        'muted-foreground': 'var(--muted)',
        ring: 'var(--purple)',
        // praktisch für bg/border Utilities:
        card: 'var(--card)',
        border: 'var(--border)',
        subm8: { purple: 'var(--purple)' },
      },
      borderRadius: { app: 'var(--radius)' },
      boxShadow: { app: 'var(--shadow)' },
    },
  },
  plugins: [],
};