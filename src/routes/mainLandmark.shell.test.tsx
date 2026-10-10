/**
 * FIX-381 — phần vỏ ứng dụng: đăng nhập, trang chủ, lỗi/onboarding, tài khoản,
 * thông báo, 404. Tách khỏi `mainLandmark.test.tsx` cũ để collect/chạy song
 * song theo nhóm (PERF-01 FE-6). Logic và bối cảnh test giống nguyên bản —
 * xem đầu tệp cũ (git history) cho phần mô tả đầy đủ.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import type { ComponentProps } from 'react';
import type * as ScreenErrorBoundaryModule from '@/components/feedback/ScreenErrorBoundary';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ALL_GROUP_PATHS,
  concretePath,
  outsideRoutes,
  productRoutes,
  SHELL_PATHS,
} from './mainLandmarkHarness';

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

const GROUP_PATHS = SHELL_PATHS;
const groupRoutes = productRoutes.filter(({ path }) => GROUP_PATHS.includes(path));
const groupOutside = outsideRoutes.filter(({ path }) => GROUP_PATHS.includes(path));

beforeAll(() => {
  /* jsdom không có hai thứ này; thiếu chúng màn ném lỗi và rơi vào phần dự phòng,
     tức là chế độ "bình thường" thật ra đo trạng thái sập. */
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

    /* Đo đồng bộ, ngay lượt vẽ đầu: chunk lazy chưa kịp xong nên vỏ chờ còn đó. */
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
    /* Một lượt nhả cho effect/lazy con còn treo, rồi đếm MỘT lần ngoài `waitFor`:
       một `main` dựng muộn sẽ làm số đếm thành hai thay vì lọt qua lúc đếm đầu. */
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelectorAll('main, [role="main"]')).toHaveLength(1);
  });
});

/* Không màn nào trong nhóm `ScreenMain` được tự dựng `<main>` (sẽ lồng hai). Danh
   sách dưới đây là toàn bộ nơi `src/screens` có `<main`: tất cả thuộc màn NGOÀI
   nhóm. Thêm một nơi mới là một quyết định phải đọc lại cả nhóm. */
const MAIN_OWNERS = [
  'auth/AuthScreen/AuthScreen.tsx',
  'auth/RecoveryShell.tsx',
  'dashboard/ProjectDashboard/ProjectDashboard.tsx',
  'system/MobileViewer/MobileViewer.tsx',
  'viewer/ViewerShell/ViewerViewport.tsx',
];
/* Phần dự phòng thay cả màn (sập, cổng, tải chunk) cũng là `<main>` — chỉ ở màn ngoài nhóm. */
const FALLBACK_MAIN_OWNERS = [
  'auth/AuthScreen/AuthScreen.container.tsx',
  'auth/RecoveryRoute.tsx',
  'dashboard/ProjectDashboard/ProjectDashboard.container.tsx',
  'system/MobileViewer/MobileViewer.container.tsx',
  'viewer/ExplodedView/ExplodedView.container.tsx',
  'viewer/MeasurementTool/MeasurementTool.container.tsx',
  'viewer/Viewer3D/Viewer3D.container.tsx',
  'viewer/ViewerShell/ViewerShell.container.tsx',
];

/* Component dùng chung cũng dựng được `<main>`: mọi nơi trong `src/components`. */
const COMPONENT_MAIN_OWNERS = ['feedback/ProjectSpatialGate.tsx', 'shell/AppShell.tsx', 'shell/ScreenMain.tsx'];

describe('[router] nơi dựng <main> trong src/components', () => {
  it('chỉ có cổng, vỏ ứng dụng và ScreenMain', () => {
    const sources = import.meta.glob<string>(
      ['/src/components/**/*.tsx', '!/src/components/**/*.{test,stories}.tsx'],
      { eager: true, query: '?raw', import: 'default' },
    );
    const owners = Object.entries(sources)
      .filter(([, source]) => /(?<!`)<main[\s>]/u.test(source))
      .map(([file]) => file.replace('/src/components/', ''))
      .sort();

    expect(owners).toEqual([...COMPONENT_MAIN_OWNERS].sort());
  });
});

describe('[router] nơi dựng <main> trong src/screens', () => {
  it('chỉ có các màn ngoài nhóm ScreenMain', () => {
    const sources = import.meta.glob<string>(
      [
        '/src/screens/**/*.tsx',
        '!/src/screens/**/*.{test,stories}.tsx',
        '!/src/screens/system/StateGallery/**',
        '!/src/screens/*.tsx',
      ],
      { eager: true, query: '?raw', import: 'default' },
    );
    const owners = Object.entries(sources)
      .filter(([, source]) => /(?<!`)<main[\s>]/u.test(source))
      .map(([file]) => file.replace('/src/screens/', ''))
      .sort();

    expect(owners).toEqual([...MAIN_OWNERS, ...FALLBACK_MAIN_OWNERS].sort());
  });
});

describe('[router] bốn tệp mainLandmark phủ đủ route', () => {
  it('hợp bốn nhóm đúng bằng tập route sản phẩm, không trùng', () => {
    expect(new Set(ALL_GROUP_PATHS).size).toBe(ALL_GROUP_PATHS.length);
    expect(productRoutes.map(({ path }) => path).sort()).toEqual([...ALL_GROUP_PATHS].sort());
  });
});
