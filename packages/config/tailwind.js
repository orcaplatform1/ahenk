/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        bg: '#121212',
        surface: '#222222',
        border: '#1f1f1f',
        primary: '#c0392b',
        'primary-hover': '#e74c3c',
        accent: '#ff6b6b',
        text: '#f5f5f5',
        muted: '#888888',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
