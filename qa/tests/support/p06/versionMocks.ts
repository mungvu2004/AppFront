/**
 * QA-06b P7 — SCR-32 (version history) mocked-response helpers + the screen's copy/selectors, shared by
 * `phase06_versions_mocked_edge.spec.ts` and `phase06_versions_ui.spec.ts`. Owned by P7 only.
 *
 * Wire shapes are copied from the FE schemas, so a mocked answer is a body the FE itself would decode:
 *   N17 `{items: FloorVersionSummary[], nextCursor?}`  (src/api/schemas/versions.ts FloorVersionSummarySchema `.strict()`)
 *   N18 `{dimensions, layer, versionId}`                (FloorVersionSnapshotSchema)
 *   N19 201 FloorVersionSummary, N20 200 FloorVersionSummary
 *   errors `{code, message, requestId, ...extra}`        (BE envelope, `readWireError` reads status/code/raw.field/raw.resource)
 * Paths: src/api/endpoints.ts:331-339.
 *
 * {@link installVersionMocks} routes ONLY the four version endpoints of one project; every other call (gate #24, N15
 * spatial, N16 layer) stays real. Each answer is a function of the call, held with a promise (`hold`) when a state must be
 * kept still (no fixed waits), and every call is logged in `calls`.
 */
import { expect, type Locator, type Page, type Route } from '@playwright/test';

type Json = Record<string, unknown>;

/* ---------------------------------------------------------------- copy (each cites its source) */

export const VH = {
  heading: 'Lịch sử phiên bản', // VH:44
  floorSelect: 'Tầng', // UVH:604
  narrowSelect: 'Phiên bản', // VH:119
  list: 'Danh sách phiên bản', // VL:364
  checkbox: (label: string): string => `Chọn phiên bản ${label} để so sánh`, // VL:307
  leftSelect: 'Phiên bản gốc', // VC:184
  rightSelect: 'Phiên bản đối chiếu', // VC:192
  tabs: 'Cách xem khác biệt', // VC:205
  current: 'Hiện tại', // VL:94
  loadMore: 'Xem thêm phiên bản', // VH:134
  retention: 'Chỉ 50 phiên bản gần nhất còn giữ đủ nội dung; bản này chỉ còn siêu dữ liệu nên không so sánh và không phục hồi được', // VHG:54
  noNote: 'Không có ghi chú cho phiên bản này', // VHM:205
  today: 'Hôm nay', // VHM:237-259 TODAY_HEADING
  emptyDescription: 'Phiên bản được lưu khi AI ghi kết quả và khi phục hồi một bản cũ.', // VH:72
  listErrorTitle: 'Không tải được lịch sử phiên bản', // VH:93
  listErrorReason: 'Máy chủ chưa trả được lịch sử phiên bản của tầng này', // VHG:57
  retry: 'Thử lại', // VH:98
  forbiddenTitle: 'Không đủ quyền xem', // VH:84
  forbiddenText: 'Bạn không có quyền xem lịch sử phiên bản của bản vẽ này.', // VH:85
  projectLoading: 'Dự án chưa nạp xong', // VHC:73
  teaching: 'Mới có một phiên bản nên chưa có gì để so sánh — mỗi lần bạn sửa bản vẽ, hệ thống tự lưu thêm một phiên bản vào đây', // VHP:33-34
  notEnough: 'Chưa có đủ hai phiên bản còn nội dung để so sánh — các bản còn lại chỉ còn siêu dữ liệu', // VHP:44-45
  loadingSentence: 'Đang nạp nội dung phiên bản…', // VHP:352
  buildingLabel: 'Đang dựng mô hình', // VV:25
  snapshotFailed: 'Chưa tải được nội dung bản này', // VHM:SNAPSHOT_FAILED_NOTICE
  snapshotStatus: 'Trạng thái nạp nội dung phiên bản', // VL:255
  webglTitle: 'Máy này không dựng được 3D', // VV:23
  webglBody: 'Trình duyệt không bật WebGL nên khối 3D không hiện. Hai tab còn lại vẫn mô tả đủ khác biệt.', // VV:24-25
  restore: 'Phục hồi phiên bản này', // VH:186
  restoreConfirm: 'Phục hồi', // VHM:541
  restoreTitle: (label: string, floor: string): string => `Phục hồi phiên bản ${label} của ${floor}?`, // VHM:539
  restoredToast: (label: string, floor: string): string =>
    `Đã phục hồi phiên bản ${label} của ${floor}; hoàn tác được trong 8 giây`, // UVH:443
  undoneToast: 'Đã hoàn tác lượt phục hồi', // UVH:390
  undo: 'Hoàn tác', // Toast.tsx:149
  undoRetryToast: 'Chưa hoàn tác được lượt phục hồi; bấm "Hoàn tác" để thử lại', // VHM UNDO_RETRY_TOAST
  tag: 'Gắn nhãn phiên bản này', // VH:173
  labelField: 'Nhãn', // VD:41
  labelSubmit: 'Gắn nhãn', // VD:51
  conflictTitle: 'Tầng vừa đổi ở nơi khác', // VHG:86
  conflictDismiss: 'Tải lại', // VHG:94
  gotIt: 'Đã hiểu', // VHM writeErrorNotice dismissLabel
  reloadFailedTitle: 'Chưa tải lại được tầng', // VHM RELOAD_FAILED_NOTICE
  reloadFailedMessage: 'Máy chủ đã nhận thay đổi nhưng chưa trả lại lớp mới của tầng. Tải lại để xem bản mới nhất.', // VHM
  undoExpiredTitle: 'Đã hết thời gian hoàn tác', // VHG:99
  undoExpiredMessage: 'Lượt phục hồi này không còn hoàn tác được. Tải lại để xem bản mới nhất của tầng.', // VHG:100
  restoreErrorTitle: 'Chưa phục hồi được', // VHM:WRITE_ERROR_TITLES
  undoErrorTitle: 'Chưa hoàn tác được',
  labelErrorTitle: 'Chưa gắn được nhãn',
  forbiddenWrite: 'Vai của bạn trên dự án này không được sửa lớp của tầng.', // VHM:431
  forbiddenLabel: 'Vai của bạn trên dự án này không được gắn nhãn phiên bản.', // VHM:447
  viewerReason: 'Vai trò của bạn trên dự án này chỉ đọc được lịch sử, nên nút phục hồi không hiện', // VHM:493
} as const;

/* ---------------------------------------------------------------- locators */

export const heading = (page: Page): Locator => page.getByRole('heading', { level: 1, name: VH.heading, exact: true });
export const floorSelect = (page: Page): Locator => page.getByRole('combobox', { name: VH.floorSelect, exact: true });
export const versionList = (page: Page): Locator => page.getByRole('navigation', { name: VH.list, exact: true });
export const versionRow = (page: Page, label: string): Locator =>
  versionList(page).getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: VH.checkbox(label), exact: true }) });
export const diffTab = (page: Page, label: string): Locator =>
  page.getByRole('tablist', { name: VH.tabs, exact: true }).getByRole('tab', { name: label, exact: true });
/** The `InlineAlert` banner (role alert) carrying `title`. */
export const banner = (page: Page, title: string): Locator => page.getByRole('alert').filter({ hasText: title });
/** The toast (role=status, Toast.tsx:120) carrying `message`. */
export const toast = (page: Page, message: string | RegExp): Locator => page.getByRole('status').filter({ hasText: message });
/** Table-row skeleton of the loading state (VH:61-68). */
export const listSkeleton = (page: Page): Locator => page.locator('div.flex.items-center.gap-4.p-3:has(> .animate-pulse)');

/** `Checkbox.tsx:40-75`: the `<input>` is `sr-only` under a drawn box inside its `<label>`; a person clicks the label. */
export async function setBox(box: Locator, checked: boolean): Promise<void> {
  if ((await box.isChecked()) !== checked) await box.locator('xpath=ancestor::label[1]').click();
  await expect(box).toBeChecked({ checked });
}

/** Opens `/projects/:id/versions` (fresh document load) and waits for the page heading. */
export async function openVersionsPage(page: Page, projectId: string, query = ''): Promise<void> {
  await page.goto(`/projects/${projectId}/versions${query}`); // ROUTES.project.versions
  await expect(heading(page)).toBeVisible();
}

/* ---------------------------------------------------------------- wire builders */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const pad26 = (n: number): string => {
  let rest = n;
  let out = '';
  while (out.length < 26) {
    out = `${CROCKFORD[rest % 32] ?? '0'}${out}`;
    rest = Math.floor(rest / 32);
  }
  return out;
};
/** `ver_` + 26 Crockford characters (versionIdSchema); `n` makes it unique. */
export const versionIdOf = (n: number): string => `ver_${pad26(n)}`;
const actorUser = `usr_${pad26(7)}`;

export interface SummaryInput {
  readonly sequence: number;
  readonly floorRevision: number;
  readonly note?: string;
  readonly label?: string;
  /** Default true. */
  readonly hasSnapshot?: boolean;
  /** `createdAt` = now − this many ms (default sequence-spaced seconds so order is stable). */
  readonly agoMs?: number;
  /** Default true: creator "hệ thống AI" (`system:pipeline`). */
  readonly system?: boolean;
}

/** One N17 item (keys exactly as the strict schema allows; `note`/`label` only when given). */
export function summaryOf(input: SummaryInput): Json {
  const system = input.system ?? true;
  return {
    createdAt: new Date(Date.now() - (input.agoMs ?? input.sequence * 1_000)).toISOString(),
    creatorId: system ? 'system:pipeline' : actorUser,
    creatorName: system ? 'hệ thống AI' : 'Kỹ sư thử',
    floorRevision: input.floorRevision,
    hasSnapshot: input.hasSnapshot ?? true,
    id: versionIdOf(input.sequence),
    ...(input.label === undefined ? {} : { label: input.label }),
    ...(input.note === undefined ? {} : { note: input.note }),
    sequence: input.sequence,
  };
}

export const pageOf = (items: readonly Json[], nextCursor?: string): Json => ({ items, ...(nextCursor === undefined ? {} : { nextCursor }) });

/** `seq` distinct valid walls on `levelId` (id `W-` + 20 upper hex, AI metadata as qcLayer) — v(n+1) differs from v(n) by one wall. */
export function wallsOf(levelId: string, seq: number): Json[] {
  return Array.from({ length: seq }, (_, i) => ({
    centreline: { start: { x: (i + 1) * 1_500, y: 0 }, end: { x: (i + 1) * 1_500, y: 3_000 } },
    confidence: 0.9,
    heightMm: 3_000,
    id: `W-${(i + 1).toString(16).toUpperCase().padStart(20, '0')}`,
    kind: 'loadBearing',
    levelId,
    openingIds: [],
    reviewed: false,
    source: 'ai',
    thicknessMm: 220,
  }));
}

/** N18 body of `versionId` holding `walls`. */
export const snapshotBody = (versionId: string, walls: readonly Json[]): Json => ({
  dimensions: [],
  layer: { furniture: [], openings: [], rooms: [], walls },
  versionId,
});

/* ---------------------------------------------------------------- mock answers */

export interface Answer {
  readonly status?: number;
  readonly body?: unknown;
  /** Resolves when the route may answer (a held response). */
  readonly hold?: Promise<unknown>;
  /** Network failure instead of an answer. */
  readonly abort?: boolean;
}

export const ok = (body: unknown, status = 200): Answer => ({ status, body });

/** BE error envelope `{code, message, requestId}` (+ `extra`, e.g. `field`, `resource`, `currentVersion`). */
export const wireError = (status: number, code: string, extra: Json = {}): Answer => ({
  status,
  body: { code, message: `qa mocked ${code}`, requestId: `qa-${code.toLowerCase()}`, ...extra },
});

/** A held answer: `release()` lets it through. */
export function deferred(): { readonly promise: Promise<void>; release: () => void } {
  let release = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

export interface Call {
  readonly kind: 'list' | 'snapshot' | 'restore' | 'label';
  readonly method: string;
  readonly versionId?: string;
  readonly query: Record<string, string>;
  readonly body: Json | null;
}

export interface VersionMock {
  /** Versions answered by the default handlers (newest first). Replace with {@link VersionMock.setHistory}. */
  history: readonly Json[];
  /** Default: the whole `history` in one page. */
  list: (call: Call) => Answer;
  /** Default: `wallsOf(levelId, sequence)` for a version with content, 422 `VERSION_SNAPSHOT_PURGED` otherwise. */
  snapshot: (versionId: string, call: Call) => Answer;
  /** Default: 201 summary of a new "after" version (sequence = newest + 2) at floorRevision = baseVersion + 1. */
  restore: (versionId: string, call: Call) => Answer;
  /** Default: 200 summary of the version with the label from the body. */
  label: (versionId: string, call: Call) => Answer;
  setHistory: (items: readonly Json[]) => void;
  readonly calls: Call[];
  /** Calls of `kind` (and `versionId` when given) logged after index `since`. */
  count: (kind: Call['kind'], since?: number, versionId?: string) => number;
}

/**
 * Routes N17..N20 of `projectId` to the mock. Install BEFORE `page.goto`. `levelId` = the floor's real level id
 * (`readLevelId` in P7.ts) so a snapshot can build a scene from the project's graph.
 */
export async function installVersionMocks(page: Page, projectId: string, levelId: string): Promise<VersionMock> {
  const calls: Call[] = [];
  const sequenceOf = (versionId: string): number => Number(((mock.history.find((v) => v.id === versionId) ?? {}) as Json).sequence ?? 0);
  const mock: VersionMock = {
    history: [],
    list: () => ok(pageOf(mock.history)),
    snapshot: (versionId) => {
      const item = mock.history.find((v) => v.id === versionId);
      if (item?.hasSnapshot === false) return wireError(422, 'VERSION_SNAPSHOT_PURGED');
      return ok(snapshotBody(versionId, wallsOf(levelId, sequenceOf(versionId))));
    },
    restore: (_versionId, call) => {
      const newest = Math.max(0, ...mock.history.map((v) => Number(v.sequence)));
      const base = Number(call.body?.baseVersion ?? 0);
      return ok(summaryOf({ sequence: newest + 2, floorRevision: base + 1, note: 'phục hồi (mock)' }), 201);
    },
    label: (versionId, call) => {
      const item = mock.history.find((v) => v.id === versionId) ?? summaryOf({ sequence: 1, floorRevision: 1 });
      const text = String(call.body?.label ?? '').trim();
      const { label: _old, ...rest } = item;
      return ok(text === '' ? rest : { ...rest, label: text });
    },
    setHistory: (items) => {
      mock.history = items;
    },
    calls,
    count: (kind, since = 0, versionId) =>
      calls.slice(since).filter((c) => c.kind === kind && (versionId === undefined || c.versionId === versionId)).length,
  };

  const root = new RegExp(`/api/projects/${projectId}/versions(?:/([^/?]+)/(snapshot|restore|label))?(?:\\?.*)?$`, 'u');
  await page.route(root, async (route: Route) => {
    const request = route.request();
    const found = root.exec(request.url());
    const versionId = found?.[1];
    const tail = found?.[2];
    const method = request.method();
    const kind: Call['kind'] | null =
      versionId === undefined
        ? method === 'GET'
          ? 'list'
          : null
        : tail === 'snapshot' && method === 'GET'
          ? 'snapshot'
          : tail === 'restore' && method === 'POST'
            ? 'restore'
            : tail === 'label' && method === 'PATCH'
              ? 'label'
              : null;
    if (kind === null) {
      await route.fallback();
      return;
    }
    const call: Call = {
      kind,
      method,
      ...(versionId === undefined ? {} : { versionId }),
      query: Object.fromEntries(new URL(request.url()).searchParams.entries()),
      body: (request.postDataJSON() as Json | null) ?? null,
    };
    calls.push(call);
    const answer =
      kind === 'list' ? mock.list(call) : kind === 'snapshot' ? mock.snapshot(versionId ?? '', call) : kind === 'restore' ? mock.restore(versionId ?? '', call) : mock.label(versionId ?? '', call);
    if (answer.hold !== undefined) await answer.hold;
    if (answer.abort === true) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({ status: answer.status ?? 200, contentType: 'application/json', body: JSON.stringify(answer.body ?? {}) });
  });
  return mock;
}

/** `dd/mm/yyyy` of `date` as `formatCalendarDate` prints it (vi-VN, local time zone; datetime.ts:153). */
export const calendarDate = (date: Date): string =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear())}`;
