import { SAMPLE_BUILDING, SAMPLE_TOTAL_AREA_M2 } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { FURNITURE_KIND_BY_LIBRARY_GROUP } from '../schemas/library';
import type { Result } from '@/lib/http';
import type { FeatureFlagKey } from '@/lib/telemetry/flags';
import type { ProjectRole } from '@/types/project';
import { MOCK_SPATIAL_PROJECT } from '../../mocks/spatial';
import type {
  ApiClient,
  Drawing,
  FloorImageQuality,
  Floor,
  FloorWriteBody,
  ImageQualityAssessment,
  ImageQualityFinding,
  LibraryGroup,
  LibraryItem,
  Progress,
  Project,
  ProjectWriteBody,
  PropertyTemplate,
  Version,
} from '../client';

const ok = <T>(data: T): Result<T, never> => ({ ok: true, data });
const clone = <T>(value: T): T => structuredClone(value);

const makeDrawing = (id: string): Drawing => ({
  heightMm: 2200,
  id,
  name: `Drawing ${id}`,
  scale: 1,
  uploadedAt: '2026-08-03T08:00:00.000Z',
  uploaderId: 'user-1',
  url: `https://example.com/${id}.png`,
  widthMm: 1200,
});

const makeProgress = (overrides: Partial<Progress> = {}): Progress => ({
  id: 'upload-1',
  progressPercent: 50,
  startedAt: '2026-08-03T08:20:00.000Z',
  status: 'running',
  step: 'Upload drawing',
  ...overrides,
});

/**
 * One heavy feature switched on for the mock group, the rest off.
 *
 * Typed against the whole key union rather than left partial, so a flag added
 * to the table stops this file from compiling instead of quietly never being
 * exercised by anything that runs against the mock.
 */
const MOCK_SERVER_FEATURE_FLAGS: Readonly<Record<FeatureFlagKey, boolean>> = {
  'scene.instanced-walls': true,
  'scene.soft-shadows': false,
  'rules.parallel-run': false,
  'export.pdf-vector': false,
  'qc.live-collaboration': false,
};

const makeVersion = (): Version => ({
  createdAt: '2026-08-03T08:00:00.000Z',
  creatorId: 'user-1',
  id: 'version-1',
  note: 'Mock snapshot',
  projectId: 'project-1',
  sequence: 1,
});

const makeFloor = (levelId: string, name: string, elevationM: number, heightM: number, order: number): Floor => ({
  // The standard sample total, read from the one fixture that owns it (A14).
  ...(levelId === 'L1' ? { areaM2: SAMPLE_TOTAL_AREA_M2 } : {}),
  drawings: levelId === 'L1' ? [makeDrawing('L1-drawing-1')] : [],
  elevationMm: Math.round(elevationM * 1000),
  heightMm: Math.round(heightM * 1000),
  id: levelId,
  name,
  order,
});

const makeFallbackFloor = (floorId: string): Floor => ({
  drawings: [],
  elevationMm: 0,
  heightMm: 3900,
  id: floorId,
  name: floorId,
  order: 0,
});

const buildProject = (): Project => {
  const floors = MOCK_SPATIAL_PROJECT.levels.map((level, index) =>
    makeFloor(level.level_id, level.name, level.elevation_m, level.height_m, index),
  );

  // Name and address come from the domain sample building, so the project the
  // mock API serves is the same project every other sample dataset describes.
  const { building } = SAMPLE_BUILDING;

  return {
    ...(building.address === undefined ? {} : { address: building.address }),
    createdAt: '2026-08-03T08:00:00.000Z',
    currentVersion: makeVersion(),
    floors,
    id: 'project-1',
    members: [
      { email: 'admin@example.com', id: 'user-1', name: 'Admin', role: 'admin' },
      { email: 'engineer@example.com', id: 'user-2', name: 'Engineer', role: 'engineer' },
      // Vai chỉ-xem có mặt để nhánh "không có quyền" của A11 CHẠY ĐƯỢC ở dev:
      // đăng nhập bằng địa chỉ này là cách quan sát nó, không phải một cờ.
      { email: 'viewer@example.com', id: 'user-3', name: 'Viewer', role: 'viewer' },
    ],
    name: building.name,
    progress: makeProgress({ id: 'ai-1', progressPercent: 100, status: 'completed' }),
    status: 'approved',
    updatedAt: '2026-08-03T08:30:00.000Z',
  };
};

/* -------------------------------------------------------------------------- */
/* Chất lượng ảnh đầu vào.                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Bốn tầng, hai đã đo — đúng bậc thang mà màn `InputQualityGate` cần để dựng
 * được cả bảy trạng thái của A11.
 *
 * Hai tầng đo xong trên bốn là cách trạng thái `'partial'` có gì để nói ("2/4
 * tầng đã đo xong"); tầng 1 mang đúng ba phát hiện đặc tả nêu đích danh nên
 * `'ready'` có nội dung thật để vẽ; tầng 2 sạch nên `'empty'` — không phát hiện
 * nào — cũng dựng được mà không phải bịa thêm dữ liệu tại chỗ trong story.
 *
 * Mọi con số ở đây là **số đo thô**, chưa phân loại. Mức ba bậc của chúng do
 * `src/domain/quality` quyết; mock mà tự dán nhãn `'poor'` thì test của màn sẽ
 * xanh cả khi ngưỡng thật đã đổi.
 */
const QUALITY_IMAGE_ROOT = 'https://example.com/quality';

const makeRegion = (
  xRatio: number,
  yRatio: number,
  widthRatio: number,
  heightRatio: number,
): ImageQualityFinding['region'] => ({ heightRatio, widthRatio, xRatio, yRatio });

/** Ba phát hiện của tầng 1, đúng ba thứ đặc tả kể ra. */
const makeActiveFloorFindings = (): ImageQualityFinding[] => [
  {
    // 1.240 x 900 px: cạnh ngắn 900 px, tường 110 mm chỉ còn ~3,3 px.
    code: 'RESOLUTION_TOO_LOW',
    id: 'finding-resolution',
    region: makeRegion(0, 0, 1, 1),
    severity: 'poor',
  },
  {
    // 3,4 độ — nắn tự động xử lý được, nên phát hiện này có lối sửa.
    code: 'SKEW_DETECTED',
    id: 'finding-skew',
    region: makeRegion(0.08, 0.12, 0.84, 0.72),
    severity: 'attention',
  },
  {
    // Không tìm thấy khung bản vẽ: máy chịu, người chỉ bốn góc.
    code: 'FRAME_NOT_FOUND',
    id: 'finding-frame',
    region: makeRegion(0.02, 0.02, 0.96, 0.96),
    severity: 'attention',
  },
];

const makeMeasuredFloors = (): FloorImageQuality[] => [
  {
    floorId: 'L-1',
    floorName: 'Tầng hầm',
    findings: [],
    isMeasured: false,
    sourceUrl: `${QUALITY_IMAGE_ROOT}/L-1.png`,
  },
  {
    expectedConfidence: 0.82,
    findings: makeActiveFloorFindings(),
    floorId: 'L1',
    floorName: 'Tầng 1',
    frame: { isFound: false },
    isMeasured: true,
    measurement: {
      contrastScore: 0.81,
      heightPx: 900,
      noiseScore: 0.14,
      skewDeg: 3.4,
      widthPx: 1240,
    },
    sourceUrl: `${QUALITY_IMAGE_ROOT}/L1.png`,
  },
  {
    expectedConfidence: 0.94,
    findings: [],
    floorId: 'L2',
    floorName: 'Tầng 2',
    frame: {
      corners: [
        { xRatio: 0.04, yRatio: 0.05 },
        { xRatio: 0.96, yRatio: 0.05 },
        { xRatio: 0.96, yRatio: 0.95 },
        { xRatio: 0.04, yRatio: 0.95 },
      ],
      isFound: true,
    },
    isMeasured: true,
    measurement: {
      contrastScore: 0.88,
      heightPx: 2400,
      noiseScore: 0.07,
      skewDeg: 0.2,
      widthPx: 3200,
    },
    sourceUrl: `${QUALITY_IMAGE_ROOT}/L2.png`,
  },
  {
    floorId: 'L3',
    floorName: 'Tầng 3',
    findings: [],
    isMeasured: false,
    sourceUrl: `${QUALITY_IMAGE_ROOT}/L3.png`,
  },
];

const makeFallbackQualityFloor = (floorId: string): FloorImageQuality => ({
  findings: [],
  floorId,
  floorName: floorId,
  isMeasured: false,
  sourceUrl: `${QUALITY_IMAGE_ROOT}/${floorId}.png`,
});

const uploadKey = (projectId: string, uploadId: string): string => `${projectId}::${uploadId}`;

const applyProjectBody = (project: Project, body: Partial<ProjectWriteBody>): Project => ({
  ...project,
  ...(body.address !== undefined ? { address: body.address } : {}),
  ...(body.code !== undefined ? { code: body.code } : {}),
  ...(body.currentVersion !== undefined ? { currentVersion: body.currentVersion } : {}),
  ...(body.floors !== undefined ? { floors: body.floors } : {}),
  ...(body.members !== undefined ? { members: body.members } : {}),
  ...(body.name !== undefined ? { name: body.name } : {}),
  ...(body.progress !== undefined ? { progress: body.progress } : {}),
  ...(body.status !== undefined ? { status: body.status } : {}),
});

/* -------------------------------------------------------------------------- */
/* Phiên: vai của người vừa đăng nhập.                                         */
/* -------------------------------------------------------------------------- */

/**
 * Vai của một địa chỉ chưa có trong danh sách thành viên của bộ mẫu.
 *
 * `engineer` chứ không phải `viewer`, và đó là một lựa chọn có hệ quả: vai này
 * là thứ `pnpm dev` chạy vào khi gõ đại một địa chỉ, nên nó phải là vai LÀM
 * ĐƯỢC VIỆC — `layer.edit` bật, `canEdit` đúng, `viewer3dScene` gắn được bộ
 * bắt tia và bấm chuột trong khung nhìn chọn được đối tượng. Nhánh "không có
 * quyền" của A11 không mất đi vì thế: đăng nhập bằng `viewer@example.com` (một
 * thành viên THẬT của bộ mẫu, xem `buildProject`) cho đúng `['viewer']`, và
 * `useViewer3D` chuyển sang trạng thái `forbidden`. Hai nhánh, hai địa chỉ,
 * không cờ môi trường nào ở giữa.
 */
const MOCK_FALLBACK_ROLES: readonly ProjectRole[] = ['engineer'];

/** Bao lâu thì token của bộ mẫu hết hạn — đủ dài để không lượt gia hạn nào chen vào một bài kiểm. */
const MOCK_SESSION_TTL_SECONDS = 3600;

/**
 * Địa chỉ của lượt đăng nhập gần nhất, ở cấp module chứ không trong closure của
 * `createMockApiClient()`.
 *
 * Một trang chỉ có MỘT phiên, còn `createMockApiClient()` thì mỗi nơi gọi dựng
 * một bản. Giữ ở closure nghĩa là lượt `signIn` của màn đăng nhập và lượt gia
 * hạn mà `bootstrapSession()` chạy sau đó đọc hai ô nhớ khác nhau, và vai lại
 * rơi mất đúng chỗ nó vừa được đặt.
 */
let lastSignedInEmail: string | null = null;

/** Thành viên của bộ mẫu mang địa chỉ này, nếu có. */
const roleOfEmail = (email: string | null): readonly ProjectRole[] => {
  if (email === null) {
    return MOCK_FALLBACK_ROLES;
  }

  const member = buildProject().members.find(
    (candidate) => candidate.email?.toLowerCase() === email.trim().toLowerCase(),
  );

  return member === undefined ? MOCK_FALLBACK_ROLES : [member.role];
};

/**
 * Thân của một lượt `POST /auth/refresh` do bộ mẫu trả lời.
 *
 * Đúng hình dạng `defaultParseRefreshResponse` (`src/lib/auth/refresh.ts`) đọc
 * được: `expiresIn` tính bằng giây, `roles` ở gốc, `user` mang lại chính vai ấy.
 */
const makeRefreshPayload = (): Record<string, unknown> => {
  const email = lastSignedInEmail;
  const roles = roleOfEmail(email);
  const member = buildProject().members.find(
    (candidate) => candidate.email?.toLowerCase() === email?.trim().toLowerCase(),
  );

  return {
    accessToken: 'mock-access-token',
    expiresIn: MOCK_SESSION_TTL_SECONDS,
    roles,
    user: {
      email: email ?? 'nguoi-dung@example.com',
      id: member?.id ?? 'user-mock',
      name: member?.name ?? 'Người dùng thử',
      roles,
    },
  };
};

/**
 * Chuyến đi mà `configureAuth({ fetchImpl })` cần, khi sau lưng không có máy chủ nào.
 *
 * Đây KHÔNG phải một đường đăng nhập thứ hai. `src/lib/auth` chỉ nhận phiên qua
 * đúng một cửa — `bootstrapSession()` gọi `POST /auth/refresh` rồi đưa thân trả
 * lời cho `setAuthenticatedSession` — và `ConfigureAuthOptions.fetchImpl` là chỗ
 * tiêm mà chính cửa ấy khai ra cho một máy chủ giả. Hàm dưới đây chỉ trả lời
 * đúng lượt gia hạn; mọi đường khác nhận `204`, vì bộ mẫu không mô phỏng thêm
 * hành vi nào của máy chủ (`/auth/logout` là lượt duy nhất còn lại đi qua đây).
 */
export const createMockAuthTransport =
  () =>
  async (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    void init;
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (!url.includes('/auth/refresh')) {
      return new Response(null, { status: 204 });
    }

    return new Response(JSON.stringify(makeRefreshPayload()), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  };

/** Vai mà bộ mẫu cấp cho một địa chỉ — xuất ra để bài kiểm khỏi chép lại bảng. */
export const mockRolesForEmail = (email: string): readonly ProjectRole[] => roleOfEmail(email);

/** Quên lượt đăng nhập gần nhất. Bài kiểm gọi giữa hai ca để không rò vai sang nhau. */
export const resetMockAuthSession = (): void => {
  lastSignedInEmail = null;
};

/* -------------------------------------------------------------------------- */
/* Thư viện model.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Mười sáu model, đủ để dựng cả bảy trạng thái của panel thư viện — D-01/D-02/D-03.
 *
 * Bộ này không phải một danh sách cho có: từng đặc điểm dưới đây có mặt vì một
 * trạng thái cụ thể cần nó, và bỏ một cái đi là một story mất chỗ dựa.
 *
 * - **Cả tám nhóm đều có mặt, mỗi nhóm ít nhất hai mục.** Bấm một chip bất kỳ
 *   cũng còn thứ để vẽ, nên `'empty'` không bao giờ là kết quả của "chip này
 *   tình cờ rỗng".
 * - **Ba mục `source: 'mine'`, nằm ở ba nhóm KHÁC nhau** (`table`, `chair`,
 *   `technical`). Đây là cái chứng minh hai trục thật sự độc lập: chip `Ghế`
 *   phải tìm thấy chiếc ghế của tôi, và chip `Của tôi` phải tìm thấy cả ba —
 *   xem `matchesLibraryFilter` (`../schemas/library.ts`).
 * - **Một mục nặng bất thường** (`library-technical-2`, 1.240.000 tam giác).
 *   Nó một mình đã vượt `SCENE_BUDGET.maxTriangles` (900.000,
 *   `src/lib/three/perf/budget.ts`), nên `checkBudget()` cảnh báo KỂ CẢ khi
 *   cảnh đang rỗng — cảnh báo trước khi cho kéo của R-04 có đường chạy mà
 *   không ai phải bịa một ngưỡng thứ hai.
 * - **Hai mục thiếu `previewUrl`** (`library-storage-2`, `library-sanitary-2`).
 *   Đây là cái cho trạng thái `'partial'` của A11 có nội dung thật: 14/16 mục
 *   có ảnh xem trước.
 *
 * `furnitureKind` KHÔNG gõ tay ở đây. Nó suy ra từ `group` qua
 * `FURNITURE_KIND_BY_LIBRARY_GROUP`, đúng một phép suy mà `LibraryItemSchema`
 * chạy khi giải mã một payload thật — mock gõ tay một loại khác thì bài kiểm
 * của màn xanh với dữ liệu mà máy chủ thật không bao giờ gửi.
 */
const LIBRARY_ASSET_ROOT = 'https://example.com/library';

interface MockLibraryItemInput {
  depthMm: number;
  fileSizeBytes: number;
  group: LibraryGroup;
  /** Vắng mặt có chủ đích: xem mục "hai mục thiếu previewUrl" ở trên. */
  hasPreview?: false;
  heightMm: number;
  id: string;
  name: string;
  source?: LibraryItem['source'];
  triangleCount: number;
  widthMm: number;
}

const makeLibraryItem = (input: MockLibraryItemInput): LibraryItem => ({
  depthMm: input.depthMm,
  fileSizeBytes: input.fileSizeBytes,
  furnitureKind: FURNITURE_KIND_BY_LIBRARY_GROUP[input.group],
  group: input.group,
  heightMm: input.heightMm,
  id: input.id,
  modelUrl: `${LIBRARY_ASSET_ROOT}/${input.id}.glb`,
  name: input.name,
  ...(input.hasPreview === false ? {} : { previewUrl: `${LIBRARY_ASSET_ROOT}/${input.id}.png` }),
  source: input.source ?? 'catalogue',
  triangleCount: input.triangleCount,
  widthMm: input.widthMm,
});

const MOCK_LIBRARY_ITEMS: readonly LibraryItem[] = [
  makeLibraryItem({
    depthMm: 900,
    fileSizeBytes: 412_000,
    group: 'table',
    heightMm: 750,
    id: 'library-table-1',
    name: 'bàn ăn sáu chỗ',
    triangleCount: 8_400,
    widthMm: 1_800,
  }),
  makeLibraryItem({
    depthMm: 600,
    fileSizeBytes: 268_000,
    group: 'table',
    heightMm: 750,
    id: 'library-table-2',
    name: 'bàn làm việc chữ l',
    source: 'mine',
    triangleCount: 6_100,
    widthMm: 1_400,
  }),
  makeLibraryItem({
    depthMm: 520,
    fileSizeBytes: 184_000,
    group: 'chair',
    heightMm: 880,
    id: 'library-chair-1',
    name: 'ghế tựa gỗ sồi',
    triangleCount: 12_600,
    widthMm: 460,
  }),
  makeLibraryItem({
    depthMm: 620,
    fileSizeBytes: 226_000,
    group: 'chair',
    heightMm: 1_120,
    id: 'library-chair-2',
    name: 'ghế xoay văn phòng',
    source: 'mine',
    triangleCount: 24_800,
    widthMm: 640,
  }),
  makeLibraryItem({
    depthMm: 2_000,
    fileSizeBytes: 520_000,
    group: 'bed',
    heightMm: 420,
    id: 'library-bed-1',
    name: 'giường đôi 1m6',
    triangleCount: 9_800,
    widthMm: 1_600,
  }),
  makeLibraryItem({
    depthMm: 1_900,
    fileSizeBytes: 388_000,
    group: 'bed',
    heightMm: 400,
    id: 'library-bed-2',
    name: 'giường đơn có hộc kéo',
    triangleCount: 11_200,
    widthMm: 1_000,
  }),
  makeLibraryItem({
    depthMm: 880,
    fileSizeBytes: 742_000,
    group: 'sofa',
    heightMm: 820,
    id: 'library-sofa-1',
    name: 'sô pha ba chỗ bọc nỉ',
    triangleCount: 46_500,
    widthMm: 2_100,
  }),
  makeLibraryItem({
    depthMm: 1_600,
    fileSizeBytes: 964_000,
    group: 'sofa',
    heightMm: 820,
    id: 'library-sofa-2',
    name: 'sô pha góc chữ l',
    triangleCount: 61_300,
    widthMm: 2_600,
  }),
  makeLibraryItem({
    depthMm: 600,
    fileSizeBytes: 296_000,
    group: 'storage',
    heightMm: 2_200,
    id: 'library-storage-1',
    name: 'tủ quần áo ba cánh',
    triangleCount: 7_400,
    widthMm: 1_800,
  }),
  makeLibraryItem({
    depthMm: 320,
    fileSizeBytes: 158_000,
    group: 'storage',
    hasPreview: false,
    heightMm: 1_800,
    id: 'library-storage-2',
    name: 'kệ sách năm tầng',
    triangleCount: 5_200,
    widthMm: 800,
  }),
  makeLibraryItem({
    depthMm: 700,
    fileSizeBytes: 344_000,
    group: 'sanitary',
    heightMm: 780,
    id: 'library-sanitary-1',
    name: 'bệt liền khối',
    triangleCount: 18_900,
    widthMm: 380,
  }),
  makeLibraryItem({
    depthMm: 480,
    fileSizeBytes: 212_000,
    group: 'sanitary',
    hasPreview: false,
    heightMm: 850,
    id: 'library-sanitary-2',
    name: 'chậu rửa đặt bàn',
    triangleCount: 14_300,
    widthMm: 600,
  }),
  makeLibraryItem({
    depthMm: 600,
    fileSizeBytes: 486_000,
    group: 'kitchen',
    heightMm: 850,
    id: 'library-kitchen-1',
    name: 'tủ bếp dưới có chậu',
    triangleCount: 10_700,
    widthMm: 1_200,
  }),
  makeLibraryItem({
    depthMm: 350,
    fileSizeBytes: 238_000,
    group: 'kitchen',
    heightMm: 700,
    id: 'library-kitchen-2',
    name: 'tủ bếp trên cánh lật',
    triangleCount: 6_900,
    widthMm: 1_200,
  }),
  makeLibraryItem({
    depthMm: 300,
    fileSizeBytes: 176_000,
    group: 'technical',
    heightMm: 300,
    id: 'library-technical-1',
    name: 'cục nóng điều hòa',
    source: 'mine',
    triangleCount: 21_400,
    widthMm: 800,
  }),
  makeLibraryItem({
    depthMm: 900,
    fileSizeBytes: 24_800_000,
    group: 'technical',
    heightMm: 2_000,
    id: 'library-technical-2',
    name: 'cụm thông gió tầng hầm',
    triangleCount: 1_240_000,
    widthMm: 2_400,
  }),
];

/**
 * Một mục thay thế khi id không có trong bộ mẫu — cùng khuôn với
 * `makeFallbackFloor` ở trên: mock của file này không bao giờ trả về thất bại,
 * vì nhánh lỗi của màn được lái qua cổng của nó chứ không qua đây.
 */
const makeFallbackLibraryItem = (libraryItemId: string): LibraryItem =>
  makeLibraryItem({
    depthMm: 600,
    fileSizeBytes: 120_000,
    group: 'technical',
    heightMm: 600,
    id: libraryItemId,
    name: 'model chưa đặt tên',
    triangleCount: 4_000,
    widthMm: 600,
  });

const applyFloorBody = (floor: Floor, body: Partial<FloorWriteBody>): Floor => ({
  ...floor,
  ...(body.areaM2 !== undefined ? { areaM2: body.areaM2 } : {}),
  ...(body.drawings !== undefined ? { drawings: body.drawings } : {}),
  ...(body.elevationMm !== undefined ? { elevationMm: body.elevationMm } : {}),
  ...(body.heightMm !== undefined ? { heightMm: body.heightMm } : {}),
  ...(body.name !== undefined ? { name: body.name } : {}),
  ...(body.order !== undefined ? { order: body.order } : {}),
});

export const createMockApiClient = (): ApiClient => {
  let project = buildProject();
  let floors = clone(project.floors);
  const uploads = new Map<string, Progress>();
  let qualityFloors = makeMeasuredFloors();
  const propertyTemplates: PropertyTemplate[] = [];

  const readQualityFloor = (floorId: string): FloorImageQuality =>
    qualityFloors.find((item) => item.floorId === floorId) ?? makeFallbackQualityFloor(floorId);

  const writeQualityFloor = (floorId: string, next: FloorImageQuality): void => {
    qualityFloors = qualityFloors.some((item) => item.floorId === floorId)
      ? qualityFloors.map((item) => (item.floorId === floorId ? next : item))
      : [...qualityFloors, next];
  };

  const readAssessment = (projectId: string, floorId: string): ImageQualityAssessment => ({
    floorId,
    floors: clone(qualityFloors),
    projectId,
  });

  return {
    /**
     * Accepts whatever it is given, like every other group in this file.
     *
     * A mock that refused some passwords would be modelling a policy no test
     * here asserts, and the screen's own failure paths are driven through its
     * gateway port instead — see `AuthScreen.test.tsx`. `undefined` rather than
     * a token because the real client returns none either: the session arrives
     * through `bootstrapSession()`, not through this response.
     *
     * Cái GHI LẠI địa chỉ vừa gửi là phần mới, và nó không đổi hình dạng trả về
     * một chút nào — `ApiResult<void>` vẫn là `ApiResult<void>`. Vai không thể
     * đi ra bằng đường này: `AuthApi.signIn` khai `void`, đúng vì máy chủ thật
     * cũng không trả vai ở đây. Vai đi ra ở lượt gia hạn ngay sau đó, và
     * {@link createMockAuthTransport} là bên trả lời lượt ấy — nó đọc đúng địa
     * chỉ ghi ở đây để biết cấp vai nào.
     */
    auth: {
      register: async ({ body }) => {
        lastSignedInEmail = body.email;
        return ok(undefined);
      },
      signIn: async ({ body }) => {
        lastSignedInEmail = body.email;
        return ok(undefined);
      },
    },
    drawings: {
      complete: async ({ body, projectId }) => {
        const completed = makeProgress({ id: body.uploadId, progressPercent: 100, status: 'completed' });
        uploads.set(uploadKey(projectId, body.uploadId), completed);
        return ok(completed);
      },
      initUpload: async ({ body }) => {
        const progress = makeProgress({ id: `${body.projectId}-${body.floorId}`, step: 'Initialize upload' });
        uploads.set(uploadKey(body.projectId, body.floorId), progress);
        return ok(progress);
      },
      progress: async ({ projectId, uploadId }) =>
        ok(uploads.get(uploadKey(projectId, uploadId)) ?? makeProgress({ id: uploadId, progressPercent: 0 })),
      sendChunk: async ({ body, projectId, uploadId }) => {
        const key = uploadKey(projectId, uploadId);
        const current = uploads.get(key) ?? makeProgress({ id: uploadId, progressPercent: 0 });
        const next = clone(current);
        next.step = 'Send chunk';
        next.progressPercent = Math.min(99, next.progressPercent + 25 + body.chunkIndex);
        uploads.set(key, next);
        return ok(next);
      },
    },
    featureFlags: {
      read: async () => ok({ flags: { ...MOCK_SERVER_FEATURE_FLAGS } }),
    },
    floors: {
      create: async ({ body }) => {
        const next: Floor = {
          ...(body.areaM2 !== undefined ? { areaM2: body.areaM2 } : {}),
          drawings: body.drawings ?? [],
          elevationMm: body.elevationMm,
          heightMm: body.heightMm,
          id: `floor-${floors.length + 1}`,
          name: body.name,
          order: body.order,
        };
        floors = [...floors, next];
        project = { ...project, floors: clone(floors) };
        return ok(next);
      },
      delete: async ({ floorId }) => {
        const removed = floors.find((item) => item.id === floorId) ?? makeFallbackFloor(floorId);
        floors = floors.filter((item) => item.id !== floorId);
        project = { ...project, floors: clone(floors) };
        return ok(clone(removed));
      },
      list: async () => ok(clone(floors)),
      reorder: async ({ body }) => {
        const ordered = body.floorIds
          .map((floorId) => floors.find((item) => item.id === floorId))
          .filter((item): item is Floor => item !== undefined);
        if (ordered.length > 0) {
          floors = ordered;
          project = { ...project, floors: clone(floors) };
        }
        return ok(clone(floors));
      },
    },
    /**
     * Cùng mười sáu mục cho mọi lượt gọi, và `read` không bao giờ trượt.
     *
     * Không có trạng thái ghi nào ở đây, khác `quality` và `propertyTemplates`:
     * `LibraryApi` chỉ đọc, nên không thao tác nào của màn làm danh mục đổi đi.
     */
    library: {
      list: async () => ok(MOCK_LIBRARY_ITEMS.map(clone)),
      read: async ({ libraryItemId }) =>
        ok(
          clone(
            MOCK_LIBRARY_ITEMS.find((item) => item.id === libraryItemId) ??
              makeFallbackLibraryItem(libraryItemId),
          ),
        ),
    },
    projects: {
      create: async ({ body }) => {
        project = applyProjectBody(
          {
            ...buildProject(),
            floors: clone(floors),
          },
          body,
        );
        project = {
          ...project,
          createdAt: '2026-08-03T08:35:00.000Z',
          id: `project-${body.name.replace(/\s+/g, '-').toLowerCase()}`,
          floors: clone(floors),
          updatedAt: '2026-08-03T08:35:00.000Z',
        };
        return ok(clone(project));
      },
      delete: async ({ projectId }) => {
        const removed = clone(project);
        project = buildProject();
        floors = clone(project.floors);
        return ok({ ...removed, id: projectId });
      },
      list: async () => ok([clone(project)]),
      read: async ({ projectId }) => ok({ ...clone(project), id: projectId }),
      update: async ({ body, projectId }) => {
        project = {
          ...applyProjectBody(project, body),
          id: projectId,
          floors: clone(floors),
          updatedAt: '2026-08-03T08:40:00.000Z',
        };
        return ok(clone(project));
      },
    },
    /**
     * Khuôn mẫu thuộc tính, giữ trong bộ nhớ của MỘT lượt `createMockApiClient()`
     * — cùng vòng đời với `floors`/`project` ở trên, không phải một bảng dữ
     * liệu toàn cục (`mockApiClient` module-level vẫn dùng chung một bản, đúng
     * như mọi nhóm khác của file này).
     */
    propertyTemplates: {
      create: async ({ body, projectId }) => {
        const next: PropertyTemplate = {
          createdAt: '2026-08-03T08:00:00.000Z',
          fields: clone(body.fields),
          id: `template-${propertyTemplates.length + 1}`,
          name: body.name,
          objectKind: body.objectKind,
          projectId,
          scope: 'project',
        };

        propertyTemplates.push(next);
        return ok(clone(next));
      },
      list: async ({ projectId }) =>
        ok(propertyTemplates.filter((template) => template.projectId === projectId).map(clone)),
    },
    /**
     * Cùng bốn tầng cho mọi lượt gọi, và hai lối sửa thật sự đổi dữ liệu.
     *
     * `straighten` và `setCorners` ghi lại vào `qualityFloors` chứ không trả
     * một bản dựng sẵn: story và test của màn cần thấy phát hiện tương ứng biến
     * mất sau khi bấm, và một mock trả mãi cùng một câu trả lời thì không phân
     * biệt được "đã sửa" với "chưa bấm".
     */
    quality: {
      assess: async ({ floorId, projectId }) => ok(readAssessment(projectId, floorId)),
      setCorners: async ({ body, floorId, projectId }) => {
        const current = readQualityFloor(floorId);

        writeQualityFloor(floorId, {
          ...current,
          expectedConfidence: 0.88,
          findings: current.findings.filter((finding) => finding.code !== 'FRAME_NOT_FOUND'),
          frame: { corners: clone(body.corners), isFound: true },
          isMeasured: true,
        });

        return ok(readAssessment(projectId, floorId));
      },
      straighten: async ({ floorId, projectId }) => {
        const current = readQualityFloor(floorId);
        const measurement = current.measurement;

        writeQualityFloor(floorId, {
          ...current,
          expectedConfidence: 0.86,
          findings: current.findings.filter((finding) => finding.code !== 'SKEW_DETECTED'),
          isMeasured: true,
          ...(measurement !== undefined ? { measurement: { ...measurement, skewDeg: 0.2 } } : {}),
        });

        return ok(readAssessment(projectId, floorId));
      },
    },
    spatial: {
      patchFloor: async ({ body, floorId }) => {
        const current = floors.find((item) => item.id === floorId) ?? makeFallbackFloor(floorId);
        const next = applyFloorBody({ ...current, id: floorId }, body);
        floors = floors.map((item) => (item.id === floorId ? next : item));
        project = { ...project, floors: clone(floors) };
        return ok(next);
      },
      readFloor: async ({ floorId }) => ok(clone(floors.find((item) => item.id === floorId) ?? makeFallbackFloor(floorId))),
      readVersion: async ({ projectId, versionId }) => ok({ ...makeVersion(), projectId, id: versionId }),
      /** Echoes the layer back, like every other write in this file that has no separate read endpoint to reconcile with (see `auth.signIn`, `drawings.complete`). */
      writeLayer: async ({ body }) => ok(clone(body)),
    },
  };
};

export const mockApiClient = createMockApiClient();
export const createApiClientMock = createMockApiClient;

