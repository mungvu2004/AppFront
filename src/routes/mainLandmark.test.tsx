/**
 * FIX-381 — mỗi route sản phẩm render đúng một landmark `<main>`.
 *
 * Dựng từng route của bảng thật (bỏ phần demo và `SessionBootstrap`, vốn chỉ
 * chờ phiên) trên `createMemoryRouter`, đợi chunk lazy xong rồi đếm. Hai chế độ:
 * bình thường (mọi route ở trạng thái không phiên, không dữ liệu của jsdom) và
 * sập — `ScreenErrorBoundary` bị ép bắt một lỗi, để phần dự phòng của từng màn
 * thay màn thật. Trạng thái có dữ liệu KHÔNG được dựng ở đây; phần đó do bài kiểm
 * tĩnh cuối tệp giữ: `<main` chỉ được xuất hiện ở đúng các màn ngoài nhóm bọc.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router-dom';
import type { ComponentProps } from 'react';
import type * as ScreenErrorBoundaryModule from '@/components/feedback/ScreenErrorBoundary';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ROUTE_PATTERNS } from './paths';
import { routes } from './router';

vi.setConfig({ testTimeout: 30_000 });

/* `'all'`: mọi ranh giới sập; một `screenId`: chỉ ranh giới mang id đó (ranh giới lồng của /3d). */
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

const DEMO_PATHS: readonly string[] = [
  ROUTE_PATTERNS.demoGallery,
  ROUTE_PATTERNS.designSystem,
  ROUTE_PATTERNS.designSystemStates,
  ROUTE_PATTERNS.dataEntryDemo,
  ROUTE_PATTERNS.listReviewDemo,
  ROUTE_PATTERNS.shellDemo,
  ROUTE_PATTERNS.canvasOverlaysDemo,
  ROUTE_PATTERNS.feedbackDemo,
];

interface ProductRoute {
  readonly path: string;
  readonly leaf: RouteObject;
  readonly parent: RouteObject | undefined;
}

const rootChildren: RouteObject[] = routes[0]?.children ?? [];
/* Phẳng hoá nhóm bọc `<main>` để lấy lại từng route lá cùng với cha của nó. */
const productRoutes: ProductRoute[] = [];
for (const route of rootChildren) {
  const group = route.path === undefined ? route : undefined;
  for (const leaf of group?.children ?? [route]) {
    if (leaf.path !== undefined && !DEMO_PATHS.includes(leaf.path)) {
      productRoutes.push({ path: leaf.path, leaf, parent: group });
    }
  }
}

const concretePath = (pattern: string): string =>
  pattern === '*'
    ? '/khong-co-trang-nay'
    : pattern.replace(':projectId', 'p1').replace(':floorId', 'f1');

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

/* `lazy()` ở cấp module chỉ treo đúng một lần. Để bài không phụ thuộc thứ tự chạy (kể cả
   `--sequence.shuffle`), mỗi ca xoá bộ nhớ module rồi nhập lại `./router`: bảng route mới có
   `lazy()` mới, chưa từng được ai giải. React là gói ngoài nên vẫn là một bản. */
describe('[router] vỏ chờ chunk của route ngoài nhóm', () => {
  const outside = productRoutes.filter(({ parent }) => parent === undefined);

  it.each(outside)('$path: lúc chờ chunk vẫn đúng một main', async ({ path: pattern }) => {
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
  it.each(productRoutes)('$path có đúng một main', async ({ path: pattern, leaf, parent }) => {
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
const COMPONENT_MAIN_OWNERS = [
  'feedback/ProjectSpatialGate.tsx',
  'shell/AppShell.tsx',
  'shell/ScreenMain.tsx',
];

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
