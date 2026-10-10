/**
 * FIX-381 — nhóm khung nhìn mô hình: `/3d`, `/3d/exploded`, `/3d/measure`,
 * `/3d/pascal`, màn di động `/m/du-an/:projectId`. Tách khỏi `mainLandmark.test.tsx`
 * cũ để collect/chạy song song theo nhóm (PERF-01 FE-6).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import type { ComponentProps } from 'react';
import type * as ScreenErrorBoundaryModule from '@/components/feedback/ScreenErrorBoundary';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ROUTE_PATTERNS } from './paths';
import { concretePath, outsideRoutes, productRoutes, VIEWER_PATHS } from './mainLandmarkHarness';

vi.setConfig({ testTimeout: 30_000 });

const crash = vi.hoisted(() => ({ target: null as string | null }));

vi.mock('@/components/feedback/ScreenErrorBoundary', async (importOriginal) => {
  const actual = await importOriginal<typeof ScreenErrorBoundaryModule>();
  const Boom = (): never => {
    throw new Error('FIX-381: ép sập để soát phần dự phòng');
  };

  return {
    ...actual,
    ScreenErrorBoundary: (props: ComponentProps<typeof actual.ScreenErrorBoundary>) => (
      <actual.ScreenErrorBoundary {...props}>
        {crash.target === 'all' || crash.target === props.screenId ? <Boom /> : props.children}
      </actual.ScreenErrorBoundary>
    ),
  };
});

const GROUP_PATHS = VIEWER_PATHS;
const groupRoutes = productRoutes.filter(({ path }) => GROUP_PATHS.includes(path));
const groupOutside = outsideRoutes.filter(({ path }) => GROUP_PATHS.includes(path));

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  vi.stubGlobal(
    'EventSource',
    class {
      close(): void {}
      addEventListener(): void {}
      removeEventListener(): void {}
    },
  );
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  crash.target = null;
});

describe('[router] vỏ chờ chunk của route ngoài nhóm', () => {
  it.each(groupOutside)('$path: lúc chờ chunk vẫn đúng một main', async ({ path: pattern }) => {
    vi.resetModules();
    const fresh = await import('./router');
    const leaf = (fresh.routes[0]?.children ?? []).find((route) => route.path === pattern);
    if (leaf === undefined) throw new Error(`thiếu route ${pattern}`);
    const router = createMemoryRouter([{ element: <Outlet />, children: [leaf] }], {
      initialEntries: [concretePath(pattern)],
    });
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText('Đang tải màn hình')).toBeInTheDocument();
    expect(container.querySelectorAll('main, [role="main"]')).toHaveLength(1);
  });
});

describe.each([
  { mode: 'bình thường', isCrash: false },
  { mode: 'sập', isCrash: true },
])('[router] landmark main, chế độ $mode', ({ isCrash }) => {
  it.each(groupRoutes)('$path có đúng một main', async ({ path: pattern, leaf, parent }) => {
    crash.target = isCrash ? 'all' : null;
    const router = createMemoryRouter(
      [
        {
          element: <Outlet />,
          children: [parent === undefined ? leaf : { element: parent.element, children: [leaf] }],
        },
      ],
      { initialEntries: [concretePath(pattern)] },
    );
    const { container } = render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    await waitFor(
      () => expect(screen.queryByLabelText('Đang tải màn hình')).not.toBeInTheDocument(),
      { timeout: 20_000 },
    );
    await waitFor(() =>
      expect(container.querySelectorAll('main, [role="main"]').length).toBeGreaterThan(0),
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelectorAll('main, [role="main"]')).toHaveLength(1);
  });
});

describe('[router] ranh giới lồng của /3d', () => {
  it('chỉ lớp trong (ViewerShell) sập: phần dự phòng của nó là main duy nhất', async () => {
    crash.target = 'viewer-shell';
    const leaf = productRoutes.find(({ path }) => path === ROUTE_PATTERNS.projectViewer)?.leaf;
    if (leaf === undefined) throw new Error('thiếu route /3d');
    const router = createMemoryRouter([{ element: <Outlet />, children: [leaf] }], {
      initialEntries: [concretePath(ROUTE_PATTERNS.projectViewer)],
    });
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    await waitFor(
      () => expect(screen.queryByLabelText('Đang tải màn hình')).not.toBeInTheDocument(),
      { timeout: 20_000 },
    );
    await waitFor(() => expect(container.querySelectorAll('main, [role="main"]')).toHaveLength(1));
    expect(screen.queryByRole('main', { name: 'Khung nhìn mô hình' })).not.toBeInTheDocument();
  });
});
