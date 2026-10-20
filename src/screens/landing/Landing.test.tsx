/**
 * /welcome: hàm thuần của chữ, bản cuộn và bản tĩnh. Stage, nhà và timeline được
 * giả — bài này kiểm cấu trúc trang, không kiểm WebGL.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PUBLIC_ROUTE_PATTERNS, ROUTES } from '@/routes/paths';

import { copyPhase } from './landing.copy';

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => reduced.value }));
vi.mock('@/lib/landing/timeline', () => ({
  SCENES: Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, start: i / 9, end: (i + 1) / 9, title: '' })),
  stateAt: () => ({ p: 0, exports: 0, labels: {} }),
}));
vi.mock('@/lib/landing/stage', () => ({
  createStage: () => Promise.reject(new Error('NoWebGL2Error')),
}));
vi.mock('@/lib/landing/house', () => ({ LANDING_HOUSE: { checks: [] }, planSvg: () => '<svg></svg>' }));
vi.mock('lenis', () => ({
  default: class {
    on() {}
    off() {}
    raf() {}
    destroy() {}
    scrollTo() {}
  },
}));

const { LandingRoute } = await import('./Landing.container');

const renderRoute = () =>
  render(
    <MemoryRouter>
      <LandingRoute />
    </MemoryRouter>,
  );

afterEach(() => {
  reduced.value = false;
});

describe('copyPhase', () => {
  it('là 0 ngoài cảnh và 1 giữa cảnh', () => {
    expect(copyPhase(0.05, 0.1, 0.2).opacity).toBe(0);
    expect(copyPhase(0.25, 0.1, 0.2).opacity).toBe(0);
    expect(copyPhase(0.15, 0.1, 0.2)).toEqual({ opacity: 1, y: 0 });
  });

  it('dòng phụ vào sau dòng chính, và vào bằng cách trượt lên', () => {
    const head = copyPhase(0.11, 0.1, 0.2, 0);
    const sub = copyPhase(0.11, 0.1, 0.2, 0.12);
    expect(sub.opacity).toBeLessThan(head.opacity);
    expect(head.y).toBeGreaterThan(0);
  });

  it('cảnh cuối giữ nguyên thay vì rời đi', () => {
    expect(copyPhase(0.99, 0.9, 1, 0, true).opacity).toBe(1);
  });
});

describe('/welcome', () => {
  it('là đường công khai', () => {
    expect(PUBLIC_ROUTE_PATTERNS).toContain(ROUTES.welcome);
  });

  it('bản cuộn có tiêu đề, "Bỏ qua" và nút bắt đầu tới /login', () => {
    const { container } = renderRoute();

    expect(container.querySelector('h1')?.textContent).toBe('Bản vẽ biết trở thành ngôi nhà.');
    expect(container.querySelectorAll('h2').length).toBeGreaterThan(5);
    expect(screen.getAllByRole('link', { name: 'Bỏ qua' })).toHaveLength(1);
    expect(container.querySelector('#bat-dau')?.getAttribute('href')).toBe(ROUTES.login);
    expect(container.querySelector('[data-mode="pinned"]')).not.toBeNull();
  });

  it('giảm chuyển động: bản tĩnh với đủ sáu bước và nút bắt đầu', () => {
    reduced.value = true;
    const { container } = renderRoute();

    expect(container.querySelector('[data-mode="static"]')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bản vẽ biết trở thành ngôi nhà.');
    expect(container.querySelectorAll('.landing-steps li')).toHaveLength(6);
    expect(container.querySelector('#bat-dau')?.getAttribute('href')).toBe(ROUTES.login);
  });

  it('chuyển sang bản tĩnh khi không dựng được stage', async () => {
    const { container } = renderRoute();

    await vi.waitFor(() => expect(container.querySelector('[data-mode="static"]')).not.toBeNull());
  });
});
