/* eslint-disable react-refresh/only-export-components -- file này KHÔNG xuất component
 * nào: nó chỉ xuất `router`, tức bảng route. Luật hiểu nhầm vì trong file có định
 * nghĩa `Placeholder`. Xoá được dòng này ngay khi `Placeholder` chuyển đi nơi khác. */
import React, { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { ROUTE_PATTERNS } from './paths';

// Placeholder components
const Placeholder = ({ name }: { name: string }) => <div>{name}</div>;

/** Vỏ chờ dùng chung, để hai mươi mấy route không mỗi chỗ viết một kiểu. */
const suspended = (node: React.ReactNode) => (
  <React.Suspense fallback={<div>Loading...</div>}>{node}</React.Suspense>
);

// Lazy load 3D and canvas routes
const Route3D = lazy(() => Promise.resolve({ default: () => <Placeholder name="3D View" /> }));
const RouteCanvas = lazy(() => Promise.resolve({ default: () => <Placeholder name="Canvas" /> }));
const RouteShare = lazy(() => import('../screens/project/ShareRoute').then(m => ({ default: m.ShareRoute })));
const RouteAuth = lazy(() => import('../screens/auth/AuthScreen').then(m => ({ default: m.AuthRoute })));
const RouteDashboard = lazy(() => import('../screens/dashboard/ProjectDashboard').then(m => ({ default: m.ProjectDashboardRoute })));
const RouteProjectSettings = lazy(() => import('../screens/project/ProjectSettings').then(m => ({ default: m.ProjectSettingsRoute })));
const RouteAccountSettings = lazy(() => import('../screens/account/AccountSettings').then(m => ({ default: m.AccountSettingsRoute })));
const RouteOnboarding = lazy(() => import('../screens/onboarding/WelcomeScreen').then(m => ({ default: m.WelcomeRoute })));
const RouteBilling = lazy(() => import('../screens/billing/BillingScreen').then(m => ({ default: m.BillingRoute })));
const RouteFloorUpload = lazy(() => import('../screens/upload/FloorUploadScreen').then(m => ({ default: m.FloorUploadRoute })));
const RouteInputQualityGate = lazy(() => import('../screens/upload/InputQualityGate').then(m => ({ default: m.InputQualityGateRoute })));
const RouteProcessing = lazy(() => import('../screens/pipeline/ProcessingScreen').then(m => ({ default: m.ProcessingScreenRoute })));
const RouteScaleCalibration = lazy(() => import('../screens/pipeline/ScaleCalibration').then(m => ({ default: m.ScaleCalibrationRoute })));
const RoutePipelineGraph = lazy(() => import('../screens/pipeline/PipelineGraph').then(m => ({ default: m.PipelineGraphRoute })));
const RouteCadBranchConfirm = lazy(() => import('../screens/pipeline/CadBranchConfirm').then(m => ({ default: m.CadBranchConfirmRoute })));
const RouteWallLayerReview = lazy(() => import('../screens/qc/WallLayerReview').then(m => ({ default: m.WallLayerReviewRoute })));
const RouteObjectLayerReview = lazy(() => import('../screens/qc/ObjectLayerReview').then(m => ({ default: m.ObjectLayerReviewRoute })));
const RouteDimensionOcrReview = lazy(() => import('../screens/qc/DimensionOcrReview').then(m => ({ default: m.DimensionOcrReviewRoute })));
const RouteAxisGridManager = lazy(() => import('../screens/qc/AxisGridManager').then(m => ({ default: m.AxisGridManagerRoute })));

/**
 * Bảy màn demo, và **chỉ trong bản dev**.
 *
 * Không phải chuyện gọn gàng. Trước lượt này `routes.tsx` chưa nơi nào import,
 * nên Vite không dựng route nào cả. Vừa gắn `RouterProvider` là bảy màn demo —
 * bảng chọn, design system, bốn màn demo tính năng — đi thẳng vào gói người dùng
 * tải về: gần 50 KiB gzip điều khiển dành cho lập trình viên, đúng thứ mục B nói
 * không được xuất hiện trên màn sản phẩm.
 *
 * `lazy(...)` nằm **trong** hàm này chứ không ở cấp module, và đó là điểm mấu
 * chốt: Rollup coi một lời gọi hàm ở cấp module là có thể có tác dụng phụ nên
 * không dám bỏ, và bảy chunk vẫn được dựng dù không route nào trỏ tới — đã đo,
 * đúng như vậy. Nằm trong hàm thì khi `import.meta.env.DEV` bị Vite thay bằng
 * `false`, cả hàm thành mã không ai gọi và bảy chunk biến mất cùng nó.
 */
function buildDevOnlyRoutes(): RouteObject[] {
  const RouteDemoGallery = lazy(() => import('../App').then(m => ({ default: m.App })));
  const RouteDesignSystem = lazy(() => import('../screens/DesignSystem').then(m => ({ default: m.DesignSystem })));
  const RouteDataEntryDemo = lazy(() => import('../screens/DataEntryDemo').then(m => ({ default: m.DataEntryDemo })));
  const RouteListReviewDemo = lazy(() => import('../screens/ListReviewDemo').then(m => ({ default: m.ListReviewDemo })));
  const RouteShellDemo = lazy(() => import('../screens/ShellDemo').then(m => ({ default: m.ShellDemo })));
  const RouteCanvasOverlaysDemo = lazy(() => import('../screens/CanvasOverlaysDemo').then(m => ({ default: m.CanvasOverlaysDemo })));
  const RouteFeedbackDemo = lazy(() => import('../screens/FeedbackDemo').then(m => ({ default: m.FeedbackDemo })));

  return [
    { path: ROUTE_PATTERNS.demoGallery, element: suspended(<RouteDemoGallery />) },
    { path: ROUTE_PATTERNS.designSystem, element: suspended(<RouteDesignSystem />) },
    { path: ROUTE_PATTERNS.dataEntryDemo, element: suspended(<RouteDataEntryDemo />) },
    { path: ROUTE_PATTERNS.listReviewDemo, element: suspended(<RouteListReviewDemo />) },
    { path: ROUTE_PATTERNS.shellDemo, element: suspended(<RouteShellDemo />) },
    { path: ROUTE_PATTERNS.canvasOverlaysDemo, element: suspended(<RouteCanvasOverlaysDemo />) },
    { path: ROUTE_PATTERNS.feedbackDemo, element: suspended(<RouteFeedbackDemo />) },
  ];
}

const DEV_ONLY_ROUTES: RouteObject[] = import.meta.env.DEV ? buildDevOnlyRoutes() : [];

export const router = createBrowserRouter([
  ...DEV_ONLY_ROUTES,
  { path: ROUTE_PATTERNS.onboarding, element: suspended(<RouteOnboarding />) },
  { path: ROUTE_PATTERNS.login, element: suspended(<RouteAuth />) },
  { path: ROUTE_PATTERNS.dashboard, element: suspended(<RouteDashboard />) },
  { path: ROUTE_PATTERNS.projectSettings, element: suspended(<RouteProjectSettings />) },
  { path: ROUTE_PATTERNS.projectUpload, element: suspended(<RouteFloorUpload />) },
  { path: ROUTE_PATTERNS.projectQuality, element: suspended(<RouteInputQualityGate />) },
  { path: ROUTE_PATTERNS.projectPipeline, element: suspended(<RouteProcessing />) },
  { path: ROUTE_PATTERNS.projectPipelineGraph, element: suspended(<RoutePipelineGraph />) },
  { path: ROUTE_PATTERNS.projectScale, element: suspended(<RouteScaleCalibration />) },
  { path: ROUTE_PATTERNS.projectCadConfirm, element: suspended(<RouteCadBranchConfirm />) },
  { path: ROUTE_PATTERNS.projectWalls, element: suspended(<RouteWallLayerReview />) },
  { path: ROUTE_PATTERNS.projectObjects, element: suspended(<RouteObjectLayerReview />) },
  { path: ROUTE_PATTERNS.projectDimensions, element: suspended(<RouteDimensionOcrReview />) },
  { path: ROUTE_PATTERNS.projectGrids, element: suspended(<RouteAxisGridManager />) },
  { path: ROUTE_PATTERNS.layerObjects, element: <RouteCanvas /> },
  { path: ROUTE_PATTERNS.layerDimensions, element: <RouteCanvas /> },
  { path: ROUTE_PATTERNS.layerGrids, element: suspended(<RouteAxisGridManager />) },
  { path: ROUTE_PATTERNS.floors, element: <RouteCanvas /> },
  { path: ROUTE_PATTERNS.layerRooms, element: <RouteCanvas /> },
  { path: ROUTE_PATTERNS.projectViewer, element: <Route3D /> },
  { path: ROUTE_PATTERNS.projectRules, element: <Placeholder name="/projects/:id/rules" /> },
  { path: ROUTE_PATTERNS.projectExport, element: <Placeholder name="/projects/:id/export" /> },
  { path: ROUTE_PATTERNS.projectShare, element: suspended(<RouteShare />) },
  { path: ROUTE_PATTERNS.adminModels, element: <Placeholder name="/admin/models" /> },
  { path: ROUTE_PATTERNS.adminUsers, element: <Placeholder name="/admin/users" /> },
  { path: ROUTE_PATTERNS.account, element: suspended(<RouteAccountSettings />) },
  { path: ROUTE_PATTERNS.billing, element: suspended(<RouteBilling />) },
  { path: ROUTE_PATTERNS.designSystemStates, element: <Placeholder name="/design-system/states" /> },
  { path: ROUTE_PATTERNS.notFound, element: <Placeholder name="404" /> }
]);
