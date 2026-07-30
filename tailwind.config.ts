import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    colors: {}, // XOÁ TOÀN BỘ palette mặc định
    extend: {},
  },
  plugins: [],
};

export default config;
