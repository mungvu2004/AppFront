import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';
import {
  findPositiveTabIndexes,
  FOCUS_ORDER,
  FOCUS_REGIONS,
  SKIP_LINK,
} from '../../lib/input/focusOrder';

beforeAll(() => {
  // jsdom has no matchMedia; matches: false renders the desktop layout,
  // which is the one with all five focus regions on screen.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('AppShell focus route', () => {
  it('renders every focus region in traversal order', () => {
    const { container } = render(<AppShell />);

    const regions = Array.from(container.querySelectorAll('[data-region]')).map(
      (element) => element.getAttribute('data-region'),
    );

    expect(regions).toEqual([...FOCUS_ORDER]);
  });

  it('labels each region with its Vietnamese landmark name', () => {
    const { container } = render(<AppShell />);

    for (const region of FOCUS_ORDER) {
      const host = container.querySelector(`[data-region="${region}"]`);

      expect(host?.getAttribute('aria-label')).toBe(FOCUS_REGIONS[region].label);
      expect(host?.id).toBe(FOCUS_REGIONS[region].domId);
    }
  });

  it('puts the skip link first and points it at the main content', () => {
    const { container } = render(<AppShell />);

    const skipLink = container.querySelector('a');

    expect(skipLink?.getAttribute('href')).toBe(`#${SKIP_LINK.targetDomId}`);
    expect(skipLink?.textContent).toBe(SKIP_LINK.label);

    const target = container.querySelector(`#${SKIP_LINK.targetDomId}`);

    expect(target).not.toBeNull();
    expect(target?.getAttribute('tabindex')).toBe('-1');
    expect(target?.tagName).toBe('MAIN');
  });

  it('has no positive tab index anywhere on the shell', () => {
    const { container } = render(<AppShell />);

    expect(findPositiveTabIndexes(container)).toEqual([]);
  });
});
