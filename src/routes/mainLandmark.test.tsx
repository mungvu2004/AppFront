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
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router-dom';
import type { ComponentProps } from 'react';
import type * as ScreenErrorBoundaryModule from '@/components/feedback/ScreenErrorBoundary';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ROUTE_PATTERNS } from './paths';
import { routes } from './router';

vi.setConfig({ testTimeout: 30_000 });

const crash = vi.hoisted(() => ({ on: false }));

vi.mock('@/components/feedback/ScreenErrorBoundary', async (importOriginal) => {
  const actual = await importOriginal<typeof ScreenErrorBoundaryModule>();
  const Boom = (): never => {
    throw new Error('FIX-381: ép sập để soát phần dự phòng');
  };

  return {
    ...actual,
    ScreenErrorBoundary: (props: ComponentProps<typeof actual.ScreenErrorBoundary>) => (
      <actual.ScreenErrorBoundary {...props}>
        {crash.on ? <Boom /> : props.children}
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
  crash.on = false;
});

describe.each([
  { mode: 'bình thường', isCrash: false },
  { mode: 'sập', isCrash: true },
])('[router] landmark main, chế độ $mode', ({ isCrash }) => {
  it.each(productRoutes)('$path có đúng một main', async ({ path: pattern, leaf, parent }) => {
    crash.on = isCrash;
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
      () => {
        expect(screen.queryByLabelText('Đang tải màn hình')).not.toBeInTheDocument();
        expect(container.querySelectorAll('main, [role="main"]')).toHaveLength(1);
      },
      { timeout: 20_000 },
    );
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
