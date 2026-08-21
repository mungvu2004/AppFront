/* eslint-disable react-refresh/only-export-components -- file này KHÔNG xuất component
 * nào: nó xuất `router` và hai bảng đường dẫn re-export từ `./routePaths`. Luật hiểu
 * nhầm vì trong file có định nghĩa `Placeholder`. Xoá được dòng này ngay khi
 * `Placeholder` chuyển đi nơi khác. */
import React, { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { ROUTES, ROUTE_PATTERNS } from './routePaths';

/**
 * Đường dẫn khai ở `./routePaths`, không khai ở đây — xem đầu file đó: màn hình phải
 * đọc được hằng này, mà file này lazy-import mọi màn, nên khai ở đây là tạo vòng
 * import và `pnpm cycles` sẽ bắt. Re-export để R-65 vẫn tra được tại `@/routes`.
 */
export { ROUTES, ROUTE_PATTERNS };

// Placeholder components
const Placeholder = ({ name }: { name: string }) => <div>{name}</div>;

// Lazy load 3D and canvas routes
const Route3D = lazy(() => Promise.resolve({ default: () => <Placeholder name="3D View" /> }));
const RouteCanvas = lazy(() => Promise.resolve({ default: () => <Placeholder name="Canvas" /> }));
const RouteDesignSystem = lazy(() => import('./screens/DesignSystem').then(m => ({ default: m.DesignSystem })));
const RouteDataEntryDemo = lazy(() => import('./screens/DataEntryDemo').then(m => ({ default: m.DataEntryDemo })));
const RouteListReviewDemo = lazy(() => import('./screens/ListReviewDemo').then(m => ({ default: m.ListReviewDemo })));
const RouteShellDemo = lazy(() => import('./screens/ShellDemo').then(m => ({ default: m.ShellDemo })));
const RouteCanvasOverlaysDemo = lazy(() => import('./screens/CanvasOverlaysDemo').then(m => ({ default: m.CanvasOverlaysDemo })));
const RouteFeedbackDemo = lazy(() => import('./screens/FeedbackDemo').then(m => ({ default: m.FeedbackDemo })));
const RouteShare = lazy(() => import('./screens/project/ShareRoute').then(m => ({ default: m.ShareRoute })));
const RouteAuth = lazy(() => import('./screens/auth/AuthScreen').then(m => ({ default: m.AuthRoute })));

export const router = createBrowserRouter([
  { path: ROUTE_PATTERNS.login, element: <React.Suspense fallback={<div>Loading...</div>}><RouteAuth /></React.Suspense> },
  { path: ROUTE_PATTERNS.dashboard, element: <Placeholder name="dashboard" /> },
  { path: ROUTE_PATTERNS.projectSettings, element: <Placeholder name="/projects/:id/settings" /> },
  { path: ROUTE_PATTERNS.projectUpload, element: <Placeholder name="/projects/:id/upload" /> },
  { path: ROUTE_PATTERNS.projectPipeline, element: <Placeholder name="/projects/:id/pipeline" /> },
  { path: ROUTE_PATTERNS.projectScale, element: <Placeholder name="/projects/:id/scale" /> },
  { path: ROUTE_PATTERNS.projectWalls, element: <RouteCanvas /> },
  { path: ROUTE_PATTERNS.layerObjects, element: <RouteCanvas /> },
  { path: ROUTE_PATTERNS.layerDimensions, element: <RouteCanvas /> },
  { path: ROUTE_PATTERNS.layerGrids, element: <RouteCanvas /> },
  { path: ROUTE_PATTERNS.floors, element: <RouteCanvas /> },
  { path: ROUTE_PATTERNS.layerRooms, element: <RouteCanvas /> },
  { path: ROUTE_PATTERNS.projectViewer, element: <Route3D /> },
  { path: ROUTE_PATTERNS.projectRules, element: <Placeholder name="/projects/:id/rules" /> },
  { path: ROUTE_PATTERNS.projectExport, element: <Placeholder name="/projects/:id/export" /> },
  { path: ROUTE_PATTERNS.projectShare, element: <React.Suspense fallback={<div>Loading...</div>}><RouteShare /></React.Suspense> },
  { path: ROUTE_PATTERNS.adminModels, element: <Placeholder name="/admin/models" /> },
  { path: ROUTE_PATTERNS.adminUsers, element: <Placeholder name="/admin/users" /> },
  { path: ROUTE_PATTERNS.account, element: <Placeholder name="/account" /> },
  { path: ROUTE_PATTERNS.billing, element: <Placeholder name="/billing" /> },
  { path: ROUTE_PATTERNS.designSystem, element: <React.Suspense fallback={<div>Loading...</div>}><RouteDesignSystem /></React.Suspense> },
  { path: ROUTE_PATTERNS.designSystemStates, element: <Placeholder name="/design-system/states" /> },
  { path: ROUTE_PATTERNS.dataEntryDemo, element: <React.Suspense fallback={<div>Loading...</div>}><RouteDataEntryDemo /></React.Suspense> },
  { path: ROUTE_PATTERNS.listReviewDemo, element: <React.Suspense fallback={<div>Loading...</div>}><RouteListReviewDemo /></React.Suspense> },
  { path: ROUTE_PATTERNS.shellDemo, element: <React.Suspense fallback={<div>Loading...</div>}><RouteShellDemo /></React.Suspense> },
  { path: ROUTE_PATTERNS.canvasOverlaysDemo, element: <React.Suspense fallback={<div>Loading...</div>}><RouteCanvasOverlaysDemo /></React.Suspense> },
  { path: ROUTE_PATTERNS.feedbackDemo, element: <React.Suspense fallback={<div>Loading...</div>}><RouteFeedbackDemo /></React.Suspense> },
  { path: ROUTE_PATTERNS.notFound, element: <Placeholder name="404" /> }
]);
