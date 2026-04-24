/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        navy: {
          700: '#1e3a5f',
          800: '#1e293b',
          900: '#0f172a',
          950: '#080e1c',
        },
        sapphire: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':      'fadeIn .3s ease-in-out',
        'shimmer':      'shimmer 2.5s linear infinite',
        'dot-bounce':   'dotBounce 1.4s ease-in-out infinite',
        'sparkle-spin': 'sparkleSpin 4s linear infinite',
        'confetti-fall':'confettiFall 3s ease-in forwards',
        'slide-up':     'slideUp 0.45s ease-out both',
        'success-pop':  'successPop 0.5s cubic-bezier(.34,1.56,.64,1) both',
        'ai-glow':      'aiGlow 2s ease-in-out infinite',
        'toast-in':     'toastIn 0.4s cubic-bezier(0.34,1.20,0.64,1) both',
        'float':        'float 3s ease-in-out infinite',
        'float-slow':   'float 4.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        dotBounce: {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '40%':           { transform: 'translateY(-8px)', opacity: '1' },
        },
        sparkleSpin: {
          '0%':   { transform: 'rotate(0deg) scale(1)',   opacity: '1'   },
          '25%':  { transform: 'rotate(90deg) scale(1.3)', opacity: '0.8' },
          '50%':  { transform: 'rotate(180deg) scale(1)', opacity: '1'   },
          '75%':  { transform: 'rotate(270deg) scale(1.3)', opacity: '0.8' },
          '100%': { transform: 'rotate(360deg) scale(1)', opacity: '1'   },
        },
        confettiFall: {
          '0%':   { transform: 'translateY(-10px) rotate(0deg)',   opacity: '1' },
          '80%':  { opacity: '1' },
          '100%': { transform: 'translateY(500px) rotate(720deg)', opacity: '0' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
        successPop: {
          '0%':   { opacity: '0', transform: 'scale(0.5)' },
          '100%': { opacity: '1', transform: 'scale(1)'   },
        },
        aiGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(59,130,246,0)' },
          '50%':      { boxShadow: '0 0 20px 4px rgba(59,130,246,0.25)' },
        },
        toastIn: {
          '0%':   { opacity: '0', transform: 'translateX(110%) scale(0.92)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-7px)' },
        },
      },
    },
  },
  plugins: [],
};
