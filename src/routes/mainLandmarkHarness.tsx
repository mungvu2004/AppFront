/**
 * Phần dùng chung của `mainLandmark.*.test.tsx` (FIX-381): bảng route lá đã
 * phẳng hoá cùng cha của nó, và đường cụ thể hoá tham số. Tách ra đây để mỗi
 * tệp test chỉ còn phần dựng/kiểm của nhóm mình — xem PERF-01 FE-6.
 */
import type { RouteObject } from 'react-router-dom';

import { ROUTE_PATTERNS } from './paths';
import { routes } from './router';

export const DEMO_PATHS: readonly string[] = [
  ROUTE_PATTERNS.demoGallery,
  ROUTE_PATTERNS.designSystem,
  ROUTE_PATTERNS.designSystemStates,
  ROUTE_PATTERNS.dataEntryDemo,
  ROUTE_PATTERNS.listReviewDemo,
  ROUTE_PATTERNS.shellDemo,
  ROUTE_PATTERNS.canvasOverlaysDemo,
  ROUTE_PATTERNS.feedbackDemo,
];

export interface ProductRoute {
  readonly path: string;
  readonly leaf: RouteObject;
  readonly parent: RouteObject | undefined;
}

const rootChildren: RouteObject[] = routes[0]?.children ?? [];
/* Phẳng hoá nhóm bọc `<main>` để lấy lại từng route lá cùng với cha của nó. */
export const productRoutes: ProductRoute[] = [];
for (const route of rootChildren) {
  const group = route.path === undefined ? route : undefined;
  for (const leaf of group?.children ?? [route]) {
    if (leaf.path !== undefined && !DEMO_PATHS.includes(leaf.path)) {
      productRoutes.push({ path: leaf.path, leaf, parent: group });
    }
  }
}

export const outsideRoutes: ProductRoute[] = productRoutes.filter(
  ({ parent }) => parent === undefined,
);

export const concretePath = (pattern: string): string =>
  pattern === '*'
    ? '/khong-co-trang-nay'
    : pattern.replace(':projectId', 'p1').replace(':floorId', 'f1');

/**
 * Bốn nhóm route, mỗi nhóm một tệp `mainLandmark.<nhóm>.test.tsx`. Hợp bốn nhóm phải
 * bằng đúng tập `productRoutes` — `mainLandmark.shell.test.tsx` khoá điều đó, nên route
 * mới chưa xếp nhóm làm đỏ thay vì lặng lẽ không được kiểm.
 */
export const SHELL_PATHS: readonly string[] = [
  '/login',
  '/login/invitation',
  '/login/reset-password',
  '/',
  '/khong-co-quyen',
  '/onboarding',
  '/tai-khoan',
  '/thong-bao',
  '*',
];

export const PROJECT_PATHS: readonly string[] = [
  '/projects/:projectId/settings',
  '/projects/:projectId/upload',
  '/projects/:projectId/quality',
  '/projects/:projectId/pipeline',
  '/projects/:projectId/pipeline/graph',
  '/projects/:projectId/rules',
  '/projects/:projectId/rules/settings',
  '/projects/:projectId/export',
  '/projects/:projectId/data',
  '/projects/:projectId/versions',
];

export const FLOORS_ADMIN_PATHS: readonly string[] = [
  '/projects/:projectId/floors/:floorId/scale',
  '/projects/:projectId/floors/:floorId/overlay',
  '/projects/:projectId/floors/:floorId/cad-confirm',
  '/projects/:projectId/floors/:floorId/layers/walls',
  '/projects/:projectId/floors/:floorId/layers/objects',
  '/projects/:projectId/floors/:floorId/layers/dimensions',
  '/projects/:projectId/floors/:floorId/layers/grids',
  '/projects/:projectId/floors/:floorId/layers/rooms',
  '/projects/:projectId/floors',
  '/projects/:projectId/floors/:floorId/layers/thickness',
  '/admin/models',
  '/admin/training/jobs',
  '/admin/training/models',
  '/admin/users',
];

export const VIEWER_PATHS: readonly string[] = [
  ROUTE_PATTERNS.projectViewer,
  '/projects/:projectId/3d/exploded',
  '/projects/:projectId/3d/measure',
  '/projects/:projectId/3d/pascal',
  '/m/du-an/:projectId',
];

export const ALL_GROUP_PATHS: readonly string[] = [
  ...SHELL_PATHS,
  ...PROJECT_PATHS,
  ...FLOORS_ADMIN_PATHS,
  ...VIEWER_PATHS,
];
