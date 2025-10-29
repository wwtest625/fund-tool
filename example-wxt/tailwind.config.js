/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './entrypoints/**/*.{html,js,ts,jsx,tsx,vue}',
    './components/**/*.{js,ts,jsx,tsx,vue}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff'
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f5f5f5',
          dark: '#111827'
        },
        accent: {
          DEFAULT: '#f97316'
        }
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

