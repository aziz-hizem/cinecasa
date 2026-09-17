/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0a0f',
          elevated: '#12121a',
          card: '#1a1a24',
          hover: '#22222e',
        },
        border: {
          subtle: '#2a2a36',
        },
        text: {
          primary: '#f5f5f7',
          secondary: '#a8a8b3',
          muted: '#6b6b78',
        },
        accent: {
          DEFAULT: '#e50914',
          hover: '#f6121d',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '8px',
        btn: '12px',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
