import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        card: '#161616',
        line: '#262626',
        // text : rouge éclairci pour le PETIT texte (contraste AA ≥ 4,5 sur fond noir).
        accent: { DEFAULT: '#E10600', text: '#FF4136' },
        sub: '#9A9A9A',
      },
      fontFamily: {
        // Même polices que RepCore : Bebas Neue pour les chiffres, Montserrat pour le texte.
        display: ['"Bebas Neue"', '"Arial Narrow"', 'Impact', 'sans-serif'],
        sans: ['Montserrat', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
