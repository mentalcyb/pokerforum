/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e8fdf5',
          100: '#c3f8e3',
          200: '#8df2c9',
          300: '#4de6a8',
          400: '#1fd18a',
          500: '#0fb876',
          600: '#0a9560',
          700: '#0c7550',
          800: '#0e5d41',
          900: '#0d4d37',
        }
      }
    },
  },
  plugins: [],
}
