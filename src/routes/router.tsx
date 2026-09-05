/* eslint-disable react-refresh/only-export-components -- file này xuất `router`,
 * tức bảng route, nên fast refresh không có gì để làm mới ở đây dù trong file có
 * định nghĩa `Placeholder` và `UndoShortcuts`. `UndoShortcuts` được xuất có chủ
 * đích: xem docblock của nó — một binding không test được là một binding không ai
 * chứng minh được. */
import React, { lazy } from 'react';
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom';

import { useShortcut } from '@/hooks/useShortcut';
import {
  buildGlobalShortcuts,
  type GlobalShortcutHandlers,
  type ShortcutDefinition,
} from '@/lib/input/shortcutRegistry';
import { useStore } from '@/store';

import { ROUTE_PATTERNS } from './paths';

// Placeholder components
const Placeholder = ({ name }: { name: string }) => <div>{name}</div>;

/** Vỏ chờ dùng chung, để hai mươi mấy route không mỗi chỗ viết một kiểu. */
const suspended = (node: React.ReactNode) => (
  <React.Suspense fallback={<div>Loading...</div>}>{node}</React.Suspense>
);

// Lazy load 3D and canvas routes
const RouteViewer3D = lazy(() => import('../screens/viewer/Viewer3D').then(m => ({ default: m.Viewer3DRoute })));
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
const RouteRoomLabelReview = lazy(() => import('../screens/qc/RoomLabelReview').then(m => ({ default: m.RoomLabelReviewRoute })));
const RouteFloorManager = lazy(() => import('../screens/qc/FloorManager').then(m => ({ default: m.FloorManagerRoute })));
const RouteThicknessStandardization = lazy(() => import('../screens/qc/ThicknessStandardization').then(m => ({ default: m.ThicknessStandardizationRoute })));

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

/* -------------------------------------------------------------------------- */
/* Ctrl+Z — bàn phím của vỏ ứng dụng.                                          */
/* -------------------------------------------------------------------------- */

/**
 * Sáu tay cầm không bao giờ được gọi tới, chỉ để **đếm được**.
 *
 * `buildGlobalShortcuts` là bảng DUY NHẤT đánh vần các tổ hợp toàn cục, và nó
 * đòi đủ sáu tay cầm trước khi đưa ra bất cứ định nghĩa nào. Dưới đây chỉ hai
 * trong sáu định nghĩa được lấy, và cả hai đều bị thay `onTrigger` trên đường
 * ra, nên không hàm nào trong đối tượng này có đường chạy tới. Đúng kiểu mượn
 * mà `buildShortcutRows` dùng ở `useAccountTables.ts:236` để dựng bảng phím tắt
 * của màn tài khoản: một chuỗi `'Ctrl+Z'` viết tay ở đây là một nguồn thứ hai,
 * và nguồn thứ hai thì lệch.
 */
const UNREACHABLE_HANDLERS: GlobalShortcutHandlers = {
  undo: (): void => undefined,
  redo: (): void => undefined,
  save: (): void => undefined,
  openSearch: (): void => undefined,
  openShortcutHelp: (): void => undefined,
  closeTopLayer: (): void => undefined,
};

/** Một binding lấy từ bảng toàn cục, gắn tay cầm thật của vỏ vào. */
function globalShortcut(id: string, onTrigger: () => void): ShortcutDefinition {
  const definition = buildGlobalShortcuts(UNREACHABLE_HANDLERS).find((entry) => entry.id === id);

  if (definition === undefined) {
    throw new Error(`không có phím tắt toàn cục nào mang id ${id}`);
  }

  return { ...definition, onTrigger };
}

/**
 * Hai phím vỏ ứng dụng nhận, dựng đúng một lần: định nghĩa không mang state của
 * component nào, nên một đối tượng đứng yên cũng là một lượt đăng ký đứng yên.
 */
const UNDO_SHORTCUT = globalShortcut('global.undo', (): void => {
  useStore.temporal.getState().undo();
});

const REDO_SHORTCUT = globalShortcut('global.redo', (): void => {
  useStore.temporal.getState().redo();
});

/**
 * Bàn phím hoàn tác của vỏ ứng dụng — và đúng chừng đó.
 *
 * Hoàn tác đã có sẵn cả một tầng lệnh, một cửa sổ gộp và ngăn xếp một trăm bước
 * đứng sau, nhưng cho tới lượt này KHÔNG phím nào chạm tới được: `useGlobalShortcuts`
 * (`hooks/useShortcut.ts:172`) được xuất mà không nơi nào gọi, nên không màn nào
 * trong repo có hoàn tác bằng bàn phím. Component này là chỗ đứng cho `useShortcut`,
 * vì `useShortcut` là hook nên nối một phím thì buộc phải có một component.
 *
 * Nó nằm ở **bảng route** chứ không ở `src/main.tsx` vì hai lý do, và lý do thứ
 * hai mới là lý do quyết định:
 *
 * 1. Ở đây "mọi route đều có" là một sự thật CẤU TRÚC: bảng route bên dưới có
 *    đúng một route gốc không path, ba mươi route kia là con của nó. Thêm một
 *    route mới không thể quên phím tắt được.
 * 2. `src/main.tsx` gọi `createRoot(...).render(...)` ở cấp module, nên không
 *    bài kiểm nào import được nó. Đặt binding ở đó thì phép nghiệm thu chỉ còn
 *    cách tự dựng lại một bản sao của binding rồi kiểm bản sao — tức là không
 *    chứng minh gì cả (R-70). Ở đây thì `PropertyInspector.test.tsx` mount đúng
 *    component sản phẩm này, gõ Ctrl+Z thật, và đo độ dày trong store.
 *
 * `src/main.tsx` vì thế KHÔNG đổi một dòng nào: thứ tự provider mà docblock của
 * nó lập luận rất kỹ — `QueryClientProvider` ngoài cùng, `MotionProvider` bọc cả
 * vỏ, `RouterProvider` trong cùng, `NotificationHost` là anh em chứ không phải
 * cha hay con — được giữ nguyên vẹn theo cách an toàn nhất: không đụng vào.
 *
 * **Chỉ** hai phím đó. `useGlobalShortcuts` đăng ký cả sáu phím toàn cục một
 * lượt, mà registry gọi `preventDefault()` cho mọi lượt khớp không xin miễn
 * (`shortcutRegistry.ts:466`) — nên nối Ctrl+F và Ctrl+S vào những tay cầm rỗng
 * không phải là để dành chỗ, nó là lấy mất tìm-trong-trang của trình duyệt và
 * không trả lại gì. Không có lệnh xả tự lưu để gọi (bộ hẹn giờ của A7 nằm trong
 * `useAutosave` và hook đó không xuất ra lệnh xả nào), không có màn tìm kiếm,
 * không có màn bảng phím tắt toàn cục. Escape cũng để yên: A12 là lời hứa các
 * màn đang tự giữ, và thêm một tay bắt Escape ở tầng vỏ thuộc về lượt thay đổi
 * kiểm được cả hai bốn màn, không phải lượt này. Bốn lỗ hổng, ghi ra chứ không
 * lấp liếm.
 */
export function UndoShortcuts({ children }: { children: React.ReactNode }): React.ReactElement {
  useShortcut(UNDO_SHORTCUT);
  useShortcut(REDO_SHORTCUT);

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    element: (
      <UndoShortcuts>
        <Outlet />
      </UndoShortcuts>
    ),
    children: [
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
      { path: ROUTE_PATTERNS.projectRooms, element: suspended(<RouteRoomLabelReview />) },
      { path: ROUTE_PATTERNS.projectFloors, element: suspended(<RouteFloorManager />) },
      { path: ROUTE_PATTERNS.projectThickness, element: suspended(<RouteThicknessStandardization />) },
      { path: ROUTE_PATTERNS.layerObjects, element: <RouteCanvas /> },
      { path: ROUTE_PATTERNS.layerDimensions, element: <RouteCanvas /> },
      { path: ROUTE_PATTERNS.layerGrids, element: suspended(<RouteAxisGridManager />) },
      { path: ROUTE_PATTERNS.floors, element: <RouteCanvas /> },
      { path: ROUTE_PATTERNS.layerRooms, element: suspended(<RouteRoomLabelReview />) },
      { path: ROUTE_PATTERNS.projectViewer, element: suspended(<RouteViewer3D />) },
      { path: ROUTE_PATTERNS.projectRules, element: <Placeholder name="/projects/:id/rules" /> },
      { path: ROUTE_PATTERNS.projectExport, element: <Placeholder name="/projects/:id/export" /> },
      { path: ROUTE_PATTERNS.projectShare, element: suspended(<RouteShare />) },
      { path: ROUTE_PATTERNS.adminModels, element: <Placeholder name="/admin/models" /> },
      { path: ROUTE_PATTERNS.adminUsers, element: <Placeholder name="/admin/users" /> },
      { path: ROUTE_PATTERNS.account, element: suspended(<RouteAccountSettings />) },
      { path: ROUTE_PATTERNS.billing, element: suspended(<RouteBilling />) },
      { path: ROUTE_PATTERNS.designSystemStates, element: <Placeholder name="/design-system/states" /> },
      { path: ROUTE_PATTERNS.notFound, element: <Placeholder name="404" /> },
    ],
  },
]);
