module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        lavender: 'var(--color-primary-2)',
        bg: 'var(--color-bg)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        danger: 'var(--color-danger)',
        donut1: 'var(--donut-1)',
        donut2: 'var(--donut-2)',
        donut3: 'var(--donut-3)',
        donut4: 'var(--donut-4)'
      },
    },
  },
  plugins: [],
};
