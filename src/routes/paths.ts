/**
 * Every URL the application has, in one table. (R-65, R-66)
 *
 * The counterpart to `src/api/endpoints.ts`: that file owns where the *server*
 * lives, this one owns where the *screens* live. Both exist for the same reason
 * — a path written at the call site is a string nothing checks, and it fails at
 * runtime, in the one environment you did not click through.
 *
 * ## Why this is its own file, not part of the router
 *
 * R-65 names `src/routes.tsx` as the home for these constants, and `@/routes`
 * still answers for them — `./index.ts` re-exports this module. But a screen
 * cannot import the *router*: that module lazily imports every screen, so a
 * screen reaching back for a constant closes an import cycle, and `pnpm cycles`
 * runs `import/no-cycle` at unlimited depth with dynamic imports counted. Tried
 * it: three cycle points. The remedy is the one the cycle gate prints in its own
 * failure message — move the shared part down to a lower module. This file
 * imports nothing at all, so nothing can cycle through it, and that is why
 * **screens import `@/routes/paths`** rather than `@/routes`.
 *
 * ## Two tables, because a route is written twice
 *
 * `ROUTE_PATTERNS` is what `createBrowserRouter` registers: `:projectId` is a hole
 * the router fills. `ROUTES` is what `navigate()` is given: the hole is already
 * filled. Keeping them apart means a screen cannot accidentally navigate to the
 * literal string `/projects/:projectId/export`, which renders a page that looks almost
 * right and is entirely wrong.
 */

const PROJECTS_ROOT = '/projects';
const LAYERS_ROOT = '/layers';
const ADMIN_ROOT = '/admin';
const DESIGN_SYSTEM_ROOT = '/design-system';
/**
 * Gốc của các màn dựng riêng cho điện thoại.
 *
 * `/m` chứ không phải một tham số hay một tên miền phụ: màn di động là một màn
 * *khác*, không phải cùng màn thu nhỏ lại, nên nó có đường dẫn riêng để chia sẻ
 * được thẳng cho người đang ở công trường.
 */
const MOBILE_ROOT = '/m';

/**
 * What `createBrowserRouter` registers. `:projectId` and `:floorId` are the
 * router's holes.
 *
 * **Đúng một quy ước đặt tên tham số, không phải hai.** Cho tới 14-09-2026 bảng
 * này đặt lỗ cấp dự án tên cộc lốc là `id` nhưng lỗ cấp tầng là `:floorId` — hai
 * quy ước trong một cây route, và mỗi `useParams` phải nhớ mình đang đứng ở
 * nhánh nào. Nay mọi lỗ đều mang tên đầy đủ của thứ nó giữ: `:projectId`,
 * `:floorId`. `/m/du-an/:projectId` vốn đã đúng nên không đổi.
 *
 * **Năm khoá không còn ở đây, và đó là chủ ý:** `floors`, `layerDimensions`,
 * `layerGrids`, `layerObjects`, `layerRooms` — năm đường dẫn cũ ở gốc
 * (`/floors`, `/layers/*`) không mang mã dự án lẫn mã tầng, nên không màn nào
 * mở nổi dữ liệu nào từ chúng: ba cái đầu render một `<div>Canvas</div>` rỗng,
 * hai cái sau trỏ trùng đích với bản đã có `:projectId`. Đường thật của năm
 * việc đó là `projectFloors` và bốn builder `ROUTES.project.{dimensions,grids,
 * objects,rooms}(projectId, floorId)`.
 */
export const ROUTE_PATTERNS = {
  // Ngoại lệ duy nhất của quy ước "đường dẫn viết bằng tiếng Anh": đường dẫn của
  // màn cài đặt tài khoản là thứ người dùng đọc và gõ, nên nó là tiếng Việt.
  // Khoá vẫn là định danh tiếng Anh `account` — mục E.11 nói về mã, không nói về
  // URL, và mọi nơi gọi vẫn viết `ROUTES.account`.
  accessDenied: '/khong-co-quyen',
  account: '/tai-khoan',
  adminModels: `${ADMIN_ROOT}/models`,
  adminUsers: `${ADMIN_ROOT}/users`,
  billing: '/billing',
  canvasOverlaysDemo: '/demo/canvas-overlays',
  dashboard: '/',
  dataEntryDemo: '/data-entry-demo',
  demoGallery: '/demo',
  designSystem: DESIGN_SYSTEM_ROOT,
  designSystemStates: `${DESIGN_SYSTEM_ROOT}/states`,
  feedbackDemo: '/feedback-demo',
  listReviewDemo: '/list-review-demo',
  login: '/login',
  // Đường dẫn tiếng Việt, cùng ngoại lệ đã ghi ở `accessDenied` và `account`:
  // đây là thứ người dùng đọc và gõ, còn khoá vẫn là định danh tiếng Anh.
  mobileViewer: `${MOBILE_ROOT}/du-an/:projectId`,
  notFound: '*',
  notifications: '/thong-bao',
  onboarding: '/onboarding',
  projectCadConfirm: `${PROJECTS_ROOT}/:projectId/floors/:floorId/cad-confirm`,
  projectData: `${PROJECTS_ROOT}/:projectId/data`,
  projectDimensions: `${PROJECTS_ROOT}/:projectId/floors/:floorId${LAYERS_ROOT}/dimensions`,
  projectExploded: `${PROJECTS_ROOT}/:projectId/3d/exploded`,
  projectExport: `${PROJECTS_ROOT}/:projectId/export`,
  projectFloors: `${PROJECTS_ROOT}/:projectId/floors`,
  projectGrids: `${PROJECTS_ROOT}/:projectId/floors/:floorId${LAYERS_ROOT}/grids`,
  projectMeasure: `${PROJECTS_ROOT}/:projectId/3d/measure`,
  projectObjects: `${PROJECTS_ROOT}/:projectId/floors/:floorId/layers/objects`,
  projectOverlay: `${PROJECTS_ROOT}/:projectId/floors/:floorId/overlay`,
  projectPipeline: `${PROJECTS_ROOT}/:projectId/pipeline`,
  projectPipelineGraph: `${PROJECTS_ROOT}/:projectId/pipeline/graph`,
  projectQuality: `${PROJECTS_ROOT}/:projectId/quality`,
  projectRooms: `${PROJECTS_ROOT}/:projectId/floors/:floorId/layers/rooms`,
  projectRules: `${PROJECTS_ROOT}/:projectId/rules`,
  projectRuleSettings: `${PROJECTS_ROOT}/:projectId/rules/settings`,
  projectScale: `${PROJECTS_ROOT}/:projectId/floors/:floorId/scale`,
  projectSettings: `${PROJECTS_ROOT}/:projectId/settings`,
  projectThickness: `${PROJECTS_ROOT}/:projectId/floors/:floorId${LAYERS_ROOT}/thickness`,
  projectUpload: `${PROJECTS_ROOT}/:projectId/upload`,
  projectVersions: `${PROJECTS_ROOT}/:projectId/versions`,
  projectViewer: `${PROJECTS_ROOT}/:projectId/3d`,
  projectWalls: `${PROJECTS_ROOT}/:projectId/floors/:floorId/layers/walls`,
  shellDemo: '/shell-demo',
} as const;

/**
 * What `navigate()` is given.
 *
 * Parameterised routes are functions, exactly as in `ENDPOINTS` — a function
 * cannot be handed to `navigate` by mistake, whereas a template string can.
 */
export const ROUTES = {
  accessDenied: ROUTE_PATTERNS.accessDenied,
  account: ROUTE_PATTERNS.account,
  adminModels: ROUTE_PATTERNS.adminModels,
  adminUsers: ROUTE_PATTERNS.adminUsers,
  billing: ROUTE_PATTERNS.billing,
  /** Where a visitor lands when nothing more specific was asked for. */
  dashboard: ROUTE_PATTERNS.dashboard,
  demoGallery: ROUTE_PATTERNS.demoGallery,
  designSystem: ROUTE_PATTERNS.designSystem,
  designSystemStates: ROUTE_PATTERNS.designSystemStates,
  login: ROUTE_PATTERNS.login,
  mobileViewer: (projectId: string): string => `${MOBILE_ROOT}/du-an/${projectId}`,
  notifications: ROUTE_PATTERNS.notifications,
  onboarding: ROUTE_PATTERNS.onboarding,
  project: {
    cadConfirm: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/cad-confirm`,
    /** S-36 — Spatial JSON chỉ đọc của dự án. */
    data: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/data`,
    dimensions: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}${LAYERS_ROOT}/dimensions`,
    exploded: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/3d/exploded`,
    export: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/export`,
    floors: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/floors`,
    grids: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}${LAYERS_ROOT}/grids`,
    measure: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/3d/measure`,
    objects: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}${LAYERS_ROOT}/objects`,
    overlay: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/overlay`,
    pipeline: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/pipeline`,
    pipelineGraph: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/pipeline/graph`,
    quality: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/quality`,
    rooms: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/layers/rooms`,
    rules: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/rules`,
    ruleSettings: (projectId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/rules/settings`,
    scale: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/scale`,
    settings: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/settings`,
    thickness: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}${LAYERS_ROOT}/thickness`,
    upload: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/upload`,
    versions: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/versions`,
    viewer: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/3d`,
    walls: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}${LAYERS_ROOT}/walls`,
  },
} as const;
