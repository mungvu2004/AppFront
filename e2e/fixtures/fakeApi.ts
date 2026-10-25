/**
 * Máy chủ giả cho trang 3D riêng (`public/editor3d.html`), chặn ở tầng Playwright.
 *
 * Vì sao không dùng bộ mẫu `VITE_USE_MOCK_API`: trang 3D chạy gói dựng sẵn
 * `/assets/pascal/pascal-page.js`, trong đó `resolveUseMockApi()` đã biên dịch
 * thành `return false` — trang luôn gọi HTTP thật (P4.md "Blocker"). Nên giả ở
 * mạng: `page.route` trả lời ĐÚNG các lượt gọi mà cầu `bridge/index.ts` và bộ
 * tự lưu N16 cần, còn lại 404 và ghi vào `unexpected` để bài khẳng định rỗng.
 *
 * Luật ghi lấy từ `src/api/__mocks__/client.ts` (`writeLayer`): thân sai → 422,
 * `baseVersion` vượt revision → 422, `baseVersion` cũ → 409, đúng → lưu lớp,
 * tăng revision, và N15 dựng lại từ lớp đã lưu nên tải lại trang thấy bản mới.
 *
 * Phần xử lý (`createFakeBackend`) không chạm Playwright để vitest kiểm được
 * mọi thân trả về bằng zod thật (`scripts/__tests__/fakeApi.test.mjs`).
 */
import type { Page } from '@playwright/test';

import { FloorLayerWriteSchema } from '../../src/api/schemas/spatialLayer';

type Wire = Readonly<Record<string, unknown>>;

/** Đồ thị N15 dạng dây — đúng thứ `GET /api/projects/:id/spatial` trả về. */
export interface WireGraphDocument {
  readonly floorRevisions: readonly { readonly floorId: string; readonly revision: number }[];
  readonly graph: Wire & {
    readonly axes: readonly Wire[];
    readonly dimensions: readonly Wire[];
    readonly furniture: readonly Wire[];
    readonly levels: readonly Wire[];
    readonly openings: readonly Wire[];
    readonly rooms: readonly Wire[];
    readonly walls: readonly Wire[];
    readonly roofs?: readonly Wire[];
  };
}

export interface FakeApiOptions {
  readonly projectId: string;
  readonly graphDoc: WireGraphDocument;
  /** Khoá ghép đè lên tài liệu N16 của từng tầng (theo mã tầng), ví dụ `{ scaleStatus: 'unresolved' }`. */
  readonly layers?: Readonly<Record<string, Wire>>;
  /** `true` = để hướng dẫn thao tác trang 3D tự bật (mặc định tắt để không che giao diện). */
  readonly tour?: boolean;
  /** Vai của người đăng nhập giả; mặc định `engineer` (sửa được). `viewer` để kiểm nhánh chỉ xem. */
  readonly role?: 'engineer' | 'viewer';
}

export interface FakeResponse {
  readonly status: number;
  readonly body: unknown;
}

const LAYER_KEYS = ['furniture', 'openings', 'rooms', 'walls'] as const;
type WireLayer = Record<(typeof LAYER_KEYS)[number], readonly Wire[]> & { readonly roofs?: readonly Wire[] };

/** Như máy chủ (roof-contract.md): khoá `roofs` vắng khi rỗng. */
const roofsKey = (roofs: readonly Wire[]): { roofs?: readonly Wire[] } => (roofs.length === 0 ? {} : { roofs });

/** Người đăng nhập giả: vai `engineer` để trình soạn thảo được sửa và tự lưu. */
export const FAKE_USER = { email: 'ky-su@example.com', id: 'U-FAKEENGINEER', name: 'Kỹ sư thử', role: 'engineer' } as const;

const STAMP = '2026-10-01T00:00:00.000Z';

const errorBody = (code: string, extra: Wire = {}): Wire => ({ code, requestId: 'req-fake-api', ...extra });

export function createFakeBackend({ projectId, graphDoc, layers: overrides = {}, role = FAKE_USER.role }: FakeApiOptions) {
  const user = { ...FAKE_USER, role };
  const { graph } = graphDoc;
  const levels = graph.levels;
  const levelIds = new Set(levels.map((level) => String(level.id)));
  const revisions = new Map(graphDoc.floorRevisions.map((row) => [row.floorId, row.revision]));
  const wallLevel = new Map(graph.walls.map((wall) => [wall.id, wall.levelId]));
  const levelOf = (key: (typeof LAYER_KEYS)[number], entity: Wire): unknown =>
    key === 'openings' ? wallLevel.get(entity.wallId) : entity.levelId;
  const onLevel = (key: (typeof LAYER_KEYS)[number], levelId: unknown): readonly Wire[] =>
    graph[key].filter((entity) => levelOf(key, entity) === levelId);
  // Lớp của từng tầng ở dạng dây; PUT thay nguyên lớp của đúng một tầng.
  const stored = new Map<string, WireLayer>(
    levels.map((level) => [
      String(level.id),
      {
        furniture: onLevel('furniture', level.id),
        openings: onLevel('openings', level.id),
        rooms: onLevel('rooms', level.id),
        walls: onLevel('walls', level.id),
        ...roofsKey((graph.roofs ?? []).filter((roof) => roof.levelId === level.id)),
      },
    ]),
  );
  const unexpected: string[] = [];
  const puts: unknown[] = [];

  const floorOf = (level: Wire): Wire => ({
    drawings: [],
    elevationMm: level.elevationMm,
    heightMm: level.heightMm,
    id: level.id,
    name: level.name,
    order: level.order,
    // J-v3: tầng ẩn trong 3D — chỉ trả lại khi bộ mẫu có, như máy chủ thật.
    ...(level.hiddenIn3d === undefined ? {} : { hiddenIn3d: level.hiddenIn3d }),
  });

  const graphNow = (): Wire => ({
    floorRevisions: levels.map((level) => ({ floorId: level.id, revision: revisions.get(String(level.id)) ?? 0 })),
    graph: {
      ...graph,
      ...Object.fromEntries(LAYER_KEYS.map((key) => [key, levels.flatMap((level) => stored.get(String(level.id))![key])])),
      ...roofsKey(levels.flatMap((level) => stored.get(String(level.id))!.roofs ?? [])),
    },
  });

  const layerDocument = (floorId: string): Wire => ({
    axes: graph.axes.filter((axis) => axis.levelId === floorId),
    dimensions: graph.dimensions.filter((dimension) => dimension.levelId === floorId),
    layer: stored.get(floorId),
    level: levels.find((level) => level.id === floorId),
    revision: revisions.get(floorId) ?? 0,
    ...overrides[floorId],
  });

  const writeLayer = (floorId: string, body: unknown): FakeResponse => {
    puts.push(body);
    const parsed = FloorLayerWriteSchema.safeParse(body);
    if (!parsed.success) return { status: 422, body: errorBody('VALIDATION') };

    const current = revisions.get(floorId) ?? 0;
    if (parsed.data.baseVersion > current) {
      return { status: 422, body: errorBody('VALIDATION', { field: 'baseVersion' }) };
    }
    if (parsed.data.baseVersion < current) {
      return { status: 409, body: { code: 'VERSION_CONFLICT', currentVersion: current, remoteChanges: [], requestId: 'req-fake-api' } };
    }

    // Lưu thân DÂY (chưa qua transform) để N15/N16 trả lại đúng hình dạng máy chủ gửi.
    const wireLayer = (body as { body: { layer?: WireLayer } }).body.layer;
    if (wireLayer !== undefined) stored.set(floorId, wireLayer);
    revisions.set(floorId, current + 1);

    return { status: 200, body: { layer: stored.get(floorId), revision: current + 1 } };
  };

  const preferences: Record<string, unknown> = {};

  const handle = (method: string, pathname: string, body?: unknown): FakeResponse => {
    const project = `/api/projects/${projectId}`;
    const layerMatch = pathname.match(new RegExp(`^${project}/floors/([^/]+)/spatial/layer$`, 'u'));
    const floorId = layerMatch?.[1] !== undefined ? decodeURIComponent(layerMatch[1]) : undefined;

    if (method === 'POST' && pathname === '/api/auth/refresh') {
      return {
        status: 200,
        body: {
          accessToken: 'fake-access-token',
          expiresIn: 3600,
          roles: [user.role],
          user: { email: user.email, id: user.id, name: user.name, roles: [user.role] },
        },
      };
    }
    if (method === 'GET' && pathname === project) {
      return {
        status: 200,
        body: {
          createdAt: STAMP,
          floors: levels.map(floorOf),
          id: projectId,
          members: [user],
          name: 'Dự án thử 3D',
          status: 'draft',
          updatedAt: STAMP,
        },
      };
    }
    /* Thư viện nội thất máy chủ (a592a003): trang Pascal đọc trước lượt dựng đầu. Rỗng = chỉ danh mục
       đóng gói — đúng thứ spec tính cảnh mong đợi trong Node (không gọi `registerServerLibrary`). */
    if (method === 'GET' && pathname === '/api/library') return { status: 200, body: [] };
    // N5 — thân tối thiểu hợp lệ (trang Pascal đọc kiểu cảnh của dự án, FE3D-FIX-003).
    if (method === 'GET' && pathname === `${project}/settings`) {
      return {
        status: 200,
        body: {
          buildingType: 'residential',
          confidenceThreshold: 0.5,
          defaultScaleMmPerPx: 1,
          lengthUnit: 'mm',
          revision: 1,
          snapToleranceMm: 20,
        },
      };
    }
    // N11/N12 — cờ "đã xem" của lớp dạy việc đọc/ghi `preferences.seen` (gộp nông từng khối là đủ ở đây).
    if (pathname === '/api/me' && (method === 'GET' || method === 'PATCH')) {
      const patch = (body as { preferences?: Record<string, Wire | null> } | undefined)?.preferences ?? {};
      if (method === 'PATCH') {
        for (const [section, value] of Object.entries(patch)) {
          preferences[section] = { ...(preferences[section] as Wire | undefined), ...value };
        }
      }
      return {
        status: 200,
        body: { email: FAKE_USER.email, fullName: FAKE_USER.name, language: 'vi', preferences },
      };
    }
    if (method === 'GET' && pathname === `${project}/spatial`) return { status: 200, body: graphNow() };
    if (method === 'GET' && pathname === `${project}/floors`) return { status: 200, body: levels.map(floorOf) };
    if (floorId !== undefined && levelIds.has(floorId)) {
      if (method === 'GET') return { status: 200, body: layerDocument(floorId) };
      if (method === 'PUT') return writeLayer(floorId, body);
    }

    unexpected.push(`${method} ${pathname}`);

    return { status: 404, body: errorBody('NOT_FOUND', { resource: 'project' }) };
  };

  return { handle, puts, unexpected };
}

/**
 * Gắn máy chủ giả vào trang. Gọi TRƯỚC lượt `goto` đầu tiên.
 *
 * Lọc theo `pathname` bắt đầu bằng `/api/` chứ không theo glob `**\/api/**`: trên
 * máy chủ dev glob ấy khớp cả mô-đun `/src/api/*.ts` của chính ứng dụng.
 */
export async function installFakeApi(
  page: Page,
  options: FakeApiOptions,
): Promise<{ unexpected: string[]; puts: unknown[] }> {
  const backend = createFakeBackend(options);
  if (!options.tour) {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('appfront.pascal.tour.v1', 'done');
      } catch {
        /* bộ nhớ bị chặn */
      }
    });
  }

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const raw = request.postData();
      let body: unknown;
      try {
        body = raw === null ? undefined : JSON.parse(raw);
      } catch {
        body = raw;
      }
      const response = backend.handle(request.method(), new URL(request.url()).pathname, body);
      await route.fulfill({ status: response.status, json: response.body });
    },
  );

  return { unexpected: backend.unexpected, puts: backend.puts };
}
