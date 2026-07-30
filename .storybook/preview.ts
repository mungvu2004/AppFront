import type { Preview } from '@storybook/react';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      viewports: {
        desktop1024: { name: 'Desktop 1024', styles: { width: '1024px', height: '768px' } },
        desktop1280: { name: 'Desktop 1280', styles: { width: '1280px', height: '800px' } },
        desktop1440: { name: 'Desktop 1440', styles: { width: '1440px', height: '900px' } },
        desktop1920: { name: 'Desktop 1920', styles: { width: '1920px', height: '1080px' } },
      },
      defaultViewport: 'desktop1440',
    },
  },
};

export default preview;
