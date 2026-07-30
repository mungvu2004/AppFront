import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',
      accent: {
        DEFAULT: 'var(--accent)',
        hover: 'var(--accent-hover)',
        active: 'var(--accent-active)',
        wash: 'var(--accent-wash)',
      },
      bg: {
        app: 'var(--bg-app)',
        surface: 'var(--bg-surface)',
        sunken: 'var(--bg-sunken)',
        hover: 'var(--bg-hover)',
        overlay: 'var(--bg-overlay)',
        selected: 'var(--bg-selected)',
        flash: 'var(--bg-flash)',
      },
      border: {
        default: 'var(--border-default)',
      },
      text: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
      },
      danger: {
        tint: 'var(--danger-tint)',
        border: 'var(--danger-border)',
      },
      state: {
        'verified': 'var(--state-verified)',
        'verified-text': 'var(--state-verified-text)',
        'verified-tint': 'var(--state-verified-tint)',
        'attention': 'var(--state-attention)',
        'attention-text': 'var(--state-attention-text)',
        'attention-tint': 'var(--state-attention-tint)',
        'violation': 'var(--state-violation)',
        'violation-text': 'var(--state-violation-text)',
        'violation-tint': 'var(--state-violation-tint)',
      },
      wall: {
        110: 'var(--wall-110)',
        220: 'var(--wall-220)',
        330: 'var(--wall-330)',
        idle: 'var(--wall-idle)',
      },
      canvas: {
        '2d': 'var(--canvas-2d)',
        '2d-grid': 'var(--canvas-2d-grid)',
        '3d': 'var(--canvas-3d)',
        '3d-ground': 'var(--canvas-3d-ground)',
        '3d-horizon': 'var(--canvas-3d-horizon)',
      },
    },
    extend: {
      transitionDuration: {
        '120': '120ms',
        '180': '180ms',
        '260': '260ms',
        '340': '340ms',
        '700': '700ms',
      },
      boxShadow: {
        'rest': '0 1px 3px rgba(0,0,0,0.1)',
        'float': '0 4px 12px rgba(0,0,0,0.15)',
        'overlay': '0 8px 24px rgba(43,42,40,0.07)',
        'panel': '0 1px 2px rgba(43,42,40,0.04)',
        'modal': '0 12px 32px rgba(0,0,0,0.15)',
      },
      keyframes: {
        'focus-ring': {
          '0%': { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
        },
        'dropdown-open': {
          '0%': { opacity: '0', transform: 'scale(0.98) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        }
      },
      animation: {
        'focus-ring': 'focus-ring 120ms ease-out forwards',
        'dropdown-open': 'dropdown-open 180ms ease-out forwards',
      }
    },
  },
  plugins: [],
};

export default config;

