/**
 * FIX-381 — mỗi route sản phẩm render đúng một landmark `<main>`.
 *
 * Dựng từng route của bảng thật (bỏ phần demo và `SessionBootstrap`, vốn chỉ
 * chờ phiên) trên `createMemoryRouter`, đợi chunk lazy xong rồi đếm. Đếm sau
 * khi vỏ chờ biến mất: trước đó `<main>` của nhóm bọc có sẵn nên số đếm đúng
 * một cách vô nghĩa, còn lỗi lồng `<main>` chỉ lộ khi màn thật đã dựng.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ROUTE_PATTERNS } from './paths';
import { routes } from './router';

vi.setConfig({ testTimeout: 30_000 });

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

afterEach(cleanup);

describe('[router] landmark main', () => {
  it.each(productRoutes)('$path có đúng một main', async ({ path: pattern, leaf, parent }) => {
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
      {
        timeout: 20_000,
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(container.querySelectorAll('main, [role="main"]')).toHaveLength(1);
  });
});
