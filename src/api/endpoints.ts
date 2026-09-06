const PROJECTS_ROOT = '/projects';
const FLOORS_ROOT = '/floors';
const DRAWINGS_ROOT = '/drawings';
const FEATURE_FLAGS_ROOT = '/feature-flags';
const LIBRARY_ROOT = '/library';
const AUTH_ROOT = '/auth';
const PROPERTY_TEMPLATES_ROOT = 'property-templates';

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
  /**
   * Thư viện model — D-01/D-02/D-03.
   *
   * Đường TOÀN CỤC, không lồng dưới `PROJECTS_ROOT` như `propertyTemplates`:
   * một chiếc ghế trong danh mục là cùng một chiếc ghế ở mọi dự án, và
   * `queryKeys.library.list()` (`src/lib/query/queryKeys.ts`) — khoá có sẵn từ
   * trước, đây là lượt đầu tiên có người tiêu thụ nó — cũng không nhận
   * `projectId`. Bộ lọc "Của tôi" đi theo phiên đăng nhập, không theo dự án, nên
   * nó là một trường trên từng mục (`LibraryItem.source`) chứ không phải một
   * đoạn đường dẫn.
   *
   * `list` là hằng phẳng vì nó không nhận tham số nào — cùng khuôn với
   * `floors.list` và `projects.list`; lọc theo chip và theo ô tìm xảy ra trên
   * danh sách đã tải, không phải bằng một lượt gọi khác (danh mục gần như tĩnh,
   * `CACHE_POLICY.branches.static`).
   */
  library: {
    detail: (libraryItemId: string): string => `${LIBRARY_ROOT}/${libraryItemId}`,
    list: LIBRARY_ROOT,
  },
  projects: {
    create: PROJECTS_ROOT,
    delete: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}`,
    list: PROJECTS_ROOT,
    read: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}`,
    update: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}`,
  },
  /**
   * Khuôn mẫu thuộc tính — bộ giá trị đặt tên, sao chép từ một tường/ô
   * mở/phòng/nội thất để áp lại cho đối tượng khác cùng loại (nút "khuôn" ở
   * đầu `PropertyInspector`) — lỗ hổng #4, U4.
   *
   * Thuộc VỀ DỰ ÁN, không phải người dùng — quyết định của điều phối viên: mọi
   * dữ liệu không gian khác trong repo đều khoá theo `projectId`/`floorId`, và
   * "thuộc về người dùng" đòi một trục dữ liệu mới (kho theo người dùng) mà
   * repo chưa có ở bất cứ đâu. Xem `PropertyTemplate.scope`
   * (`src/api/client.ts`) cho lý do đầy đủ và đường mở rộng sau này.
   */
  propertyTemplates: {
    create: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/${PROPERTY_TEMPLATES_ROOT}`,
    list: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/${PROPERTY_TEMPLATES_ROOT}`,
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
    /**
     * Lớp không gian của một tầng: tường, ô mở, phòng, nội thất — lỗ hổng #4,
     * U4. `spatial.floor` ở trên chỉ mang siêu dữ liệu tầng (`Floor`, không có
     * chỗ cho bốn thứ này — xem `FloorWriteBody`, `src/api/client.ts`), nên đây
     * là đường RIÊNG, cùng khuôn "một path dùng chung cho đọc lẫn ghi" mà
     * `spatial.floor` đã đặt.
     */
    layer: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/spatial/layer`,
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
