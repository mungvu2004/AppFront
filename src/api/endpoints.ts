const PROJECTS_ROOT = '/projects';
const FLOORS_ROOT = '/floors';
const DRAWINGS_ROOT = '/drawings';
const FEATURE_FLAGS_ROOT = '/feature-flags';
const AUTH_ROOT = '/auth';

/**
 * Where the API lives when the build does not say.
 *
 * `createHttpClient` resolves each path with `new URL(path, baseUrl)`, which
 * needs an absolute base — so a caller with no `VITE_API_BASE_URL` resolves this
 * against the page's own origin rather than passing `/api` through as-is. It
 * sits here because it is the same kind of thing as the paths below: API
 * routing, owned by `src/api`, not retyped at each call site (R-07, R-65).
 */
export const API_BASE_PATH = '/api';

export const ENDPOINTS = {
  /**
   * The credential exchange, and the only two paths a signed-out visitor posts to.
   *
   * Flat strings rather than functions because neither takes a parameter: the
   * address and password travel in the body, never in the path.
   */
  auth: {
    login: `${AUTH_ROOT}/login`,
    register: `${AUTH_ROOT}/register`,
  },
  drawings: {
    chunk: (projectId: string, uploadId: string): string =>
      `${PROJECTS_ROOT}/${projectId}${DRAWINGS_ROOT}/uploads/${uploadId}/chunks`,
    complete: (projectId: string, uploadId: string): string =>
      `${PROJECTS_ROOT}/${projectId}${DRAWINGS_ROOT}/uploads/${uploadId}/complete`,
    initUpload: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}${DRAWINGS_ROOT}/uploads`,
    progress: (projectId: string, uploadId: string): string =>
      `${PROJECTS_ROOT}/${projectId}${DRAWINGS_ROOT}/uploads/${uploadId}/progress`,
  },
  featureFlags: {
    read: FEATURE_FLAGS_ROOT,
  },
  floors: {
    create: FLOORS_ROOT,
    delete: (floorId: string): string => `${FLOORS_ROOT}/${floorId}`,
    list: FLOORS_ROOT,
    reorder: `${FLOORS_ROOT}/reorder`,
  },
  projects: {
    create: PROJECTS_ROOT,
    delete: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}`,
    list: PROJECTS_ROOT,
    read: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}`,
    update: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}`,
  },
  /**
   * Phép đo chất lượng của bản vẽ một tầng, và hai cách sửa nó — T-05.
   *
   * Cả ba đều nhận `(projectId, floorId)` chứ không `uploadId`: cái màn hỏi là
   * "bản vẽ đang dùng của tầng này tốt tới đâu", một câu hỏi sống lâu hơn lượt
   * tải lên đã sinh ra nó. Khoá cache `queryKeys.quality.assessment(floorId)`
   * theo đúng cách đọc đó.
   *
   * `straighten` và `corners` là hai lối sửa cho hai phát hiện khác nhau — ảnh
   * nghiêng thì máy nắn được, khung bản vẽ không tìm ra thì phải người chỉ. Cả
   * hai trả về chính phép đo đã chạy lại, nên nơi gọi có ngay kết quả mới thay
   * vì phải đọc lại một lượt nữa.
   */
  quality: {
    assess: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/quality`,
    corners: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/quality/corners`,
    straighten: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/quality/straighten`,
  },
  spatial: {
    floor: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/spatial`,
    version: (projectId: string, versionId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/versions/${versionId}`,
  },
  /**
   * Đường dẫn ĐÃ GHÉP với `API_BASE_PATH`, khác khuôn tương đối của mọi mục
   * khác trong `ENDPOINTS` — có chủ ý, không phải sơ suất.
   *
   * `createBeaconTransport` (`src/lib/telemetry/sender.ts`) gọi thẳng
   * `navigator.sendBeacon(url, ...)`, không đi qua `createHttpClient` — nên
   * không có bước nào tự ghép `API_BASE_PATH` vào một đường dẫn tương đối như
   * `new URL(path, baseUrl)` làm cho các mục khác. Nếu để `telemetry` là chuỗi
   * tương đối theo khuôn chung, bốn nơi gọi vẫn phải tự nhớ ghép — đúng cái lỗi
   * N1 đang dọn. Xuất sẵn đường dẫn đầy đủ ở đây thay vì lặp lại phép ghép ở cả
   * bốn màn.
   */
  telemetry: `${API_BASE_PATH}/telemetry`,
} as const;
