import type { Config } from 'tailwindcss';

import { AMBIENT_LOOP_MS, MOTION_DURATIONS_MS, MOTION_EASINGS } from './src/lib/motion/tokens';

/**
 * Motion durations come from `src/lib/motion/tokens.ts` — this file no longer
 * writes any of them down.
 *
 * The four interaction speeds are the ladder rule B allows. The looping
 * animations below are paced in whole {@link AMBIENT_LOOP_MS} beats instead:
 * a skeleton sweep is not a transition, nothing arrives at the end of it, and
 * the previous 600 / 1400 / 1600 ms were three numbers off the ladder that no
 * rule and no token justified.
 */
const beats = (count: number): string => `${AMBIENT_LOOP_MS * count}ms`;
const speed = (name: keyof typeof MOTION_DURATIONS_MS): string =>
  `${MOTION_DURATIONS_MS[name]}ms`;

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: 'var(--white)',
      black: 'var(--black)',
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
        // The numeric names the existing views already use.
        '120': speed('instant'),
        '180': speed('fast'),
        '260': speed('standard'),
        '340': speed('slow'),
        '700': beats(1),
        // The semantic names, for new work: `duration-standard`.
        instant: speed('instant'),
        fast: speed('fast'),
        standard: speed('standard'),
        slow: speed('slow'),
      },
      transitionTimingFunction: {
        enter: MOTION_EASINGS.enter.css,
        exit: MOTION_EASINGS.exit.css,
        'in-out': MOTION_EASINGS.inOut.css,
      },
      boxShadow: {
        'rest': '0 1px 3px var(--shadow-color-rest)',
        'float': '0 4px 12px var(--shadow-color-float)',
        'overlay': '0 8px 24px var(--shadow-color-overlay)',
        'panel': '0 1px 2px var(--shadow-color-panel)',
        'modal': '0 12px 32px var(--shadow-color-modal)',
      },
      keyframes: {
        'focus-ring': {
          '0%': { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
        },
        /**
         * Một vòng quay đầy của khối mô hình trên màn đăng nhập.
         *
         * Nghiêng sẵn `rotateX` để nhìn thấy mặt trên — không có nó thì khối
         * hộp dẹt thành hình chữ nhật lúc đi qua 0° và 180°.
         */
        'model-spin': {
          '0%': { transform: 'rotateX(-24deg) rotateY(0deg)' },
          '100%': { transform: 'rotateX(-24deg) rotateY(360deg)' },
        },
        /** Khối nội dung trồi lên khi màn vừa mở. Cùng hình dạng toast-enter, đi chậm hơn. */
        'panel-rise': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'dropdown-open': {
          '0%': { opacity: '0', transform: 'scale(0.98) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'skeleton-scan': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        'toast-enter': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'empty-icon-draw': {
          '0%': { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' },
        },
        'progress-overlay-scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        // PipelineStepper named this in an arbitrary value for a long time while
        // it was never declared here, so the sweep it asks for had never once
        // run. Declaring it is what makes that element do anything at all.
        'pipeline-sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        'focus-ring': `focus-ring ${speed('instant')} ease-out forwards`,
        'dropdown-open': `dropdown-open ${speed('fast')} ease-out forwards`,
        // The same shape at the instant speed, for a selection halo appearing
        // under the pointer. Replaces an arbitrary value in SelectionHalo.
        'selection-enter': `dropdown-open ${speed('instant')} ease-out forwards`,
        'toast-enter': `toast-enter ${speed('standard')} ease-out forwards`,
        'empty-icon-draw': `empty-icon-draw ${beats(1)} ease-out forwards`,
        // The same stroke draw at the standard speed, for a pipeline step tick.
        // Replaces an arbitrary value in PipelineStepper.
        'step-icon-draw': `empty-icon-draw ${speed('standard')} ease-out forwards`,
        /**
         * Tailwind's own pulse, brought onto the ladder.
         *
         * `animate-pulse` is how every loading state in the design system is
         * drawn — some fifteen components — so its 2000 ms default was the one
         * live breach of rule B, not a dead config entry like the three above.
         *
         * Three beats rather than two: 2100 ms is the legal value nearest the
         * 2000 ms that ships today, so a calm loader stays calm. Two beats would
         * be 1400 ms, thirty per cent faster, which is a design change to every
         * loading screen and not one anybody asked for.
         *
         * The curve is unchanged in substance — Tailwind's default pulse easing
         * is `cubic-bezier(0.4, 0, 0.6, 1)`, which is precisely this repository's
         * `inOut`, so it is now written as the token rather than as four numbers.
         */
        pulse: `pulse ${beats(3)} ${MOTION_EASINGS.inOut.css} infinite`,
        // Loops, paced in ambient beats rather than on the interaction ladder.
        'skeleton-scan': `skeleton-scan ${beats(2)} linear infinite`,
        'progress-overlay-scan': `progress-overlay-scan ${beats(2)} linear infinite`,
        'pipeline-sweep': `pipeline-sweep ${beats(2)} linear infinite`,
        // Xoay nền: 30 nhịp = 21 giây một vòng. Chậm tới mức đọc chữ bên cạnh
        // không thấy vướng, nhưng nhìn kỹ thì biết nó đang sống. `linear` vì một
        // vòng quay đều không có điểm bắt đầu hay kết thúc để mà gia tốc.
        'model-spin': `model-spin ${beats(30)} linear infinite`,
        'panel-rise': `panel-rise ${speed('slow')} ease-out forwards`,
      }
    },
  },
  plugins: [],
};

export default config;

