/**
 * QA-03d P8 (SCR-12 processing: real flows, failed runs, roles) — helpers for `phase03_processing_edge.spec.ts`,
 * `phase03_processing_failure_edge.spec.ts` and `phase03_processing_roles_edge.spec.ts` only. Real API only.
 *
 *   const admin = await mainAdminApi();                         // 1 login (pool lookups)
 *   const owner = await poolUser(admin, 'engineer', P8_SLOT);   // own drawings_init bucket for every P8 upload
 *   const ownerApi = await signedInApi(owner.email, owner.password);
 *   const p = await createProject(ownerApi, '12-x', 3);
 *   const ids = await uploadAndSettle(ownerApi, p.projectId, [[p.floors[0], envDrawingPng()]]); // #5-#7 + #8 final
 *   const s = await openSession(browser, owner);                // 1 login (browser) + API log
 */
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { watchApi, type ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { totalArea } from '../../../../src/domain/rooms/area';
import type { PointMm } from '../../../../src/domain/units/compare';
import { millimetres } from '../../../../src/domain/units/types';
import { formatNumber } from '../../../../src/lib/format/number';
import { apiBaseUrl, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import {
  createProject,
  deleteSeededProject,
  poolUser,
  uploadDrawing,
  waitForRunOutcome,
  type PoolUser,
  type RunOutcome,
  type SeededFloorRow,
  type SeededProject,
} from '../phase03Seed';

type Json = Record<string, unknown>;

/** Pool slot of the engineer that owns every P8 project (own `drawings_init` bucket, never role-changed). */
export const P8_SLOT = 'p8-processing';
/** An engineer that is never added to a P8 project (FL-12-11 non-member); an existing slot, so no invitation. */
export const P8_OUTSIDER_SLOT = 'p06';

export const DESKTOP = { width: 1440, height: 900 } as const;
export const COMPACT = { width: 375, height: 812 } as const;

/** Main admin API client (1 login): `poolUser` lookups. */
export function mainAdminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

export interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Every `/api/` response of the page (method, path, status). */
  readonly log: ApiEntry[];
  /** Every request URL path the page sent (including held / never answered ones such as SSE). */
  readonly sent: string[];
}

/** Browser context signed in as `user` (one `POST /api/auth/login` through its own cookie jar) with an API log. */
export async function openSession(
  browser: Browser,
  user: { readonly email: string; readonly password: string },
  options: { readonly viewport?: { readonly width: number; readonly height: number }; readonly clipboard?: boolean } = {},
): Promise<Session> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport: options.viewport ?? DESKTOP,
    ...(options.clipboard === true ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}),
  });
  try {
    const res = await context.request.post('/api/auth/login', {
      data: { email: user.email, password: user.password, rememberMe: false },
      headers: { Origin: apiBaseUrl() },
    });
    expect(res.status(), 'setup: POST /api/auth/login (browser session)').toBe(204);
    const page = await context.newPage();
    const sent: string[] = [];
    page.on('request', (request) => sent.push(new URL(request.url()).pathname));
    return { context, page, log: watchApi(page), sent };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** Main admin as a browser session (FL-12-01). */
export function openAdminSession(browser: Browser): Promise<Session> {
  return openSession(browser, readAdminCredentials());
}

/**
 * Uploads each `[floor, png]` through the API (#5 → #6 → #7) and waits until every run is final (#8). Returns the
 * upload ids and outcomes in the given order.
 */
export async function uploadAndSettle(
  api: APIRequestContext,
  projectId: string,
  drawings: readonly (readonly [SeededFloorRow, Buffer])[],
): Promise<{ readonly uploadIds: string[]; readonly outcomes: RunOutcome[] }> {
  const uploadIds: string[] = [];
  for (const [floor, png] of drawings) uploadIds.push(await uploadDrawing(api, projectId, floor.id, png, `p8-${floor.id}.png`));
  const outcomes: RunOutcome[] = [];
  for (const id of uploadIds) outcomes.push(await waitForRunOutcome(api, projectId, id));
  return { uploadIds, outcomes };
}

/** Floor rename through #34 `PATCH /api/projects/:id/floors/:fid/spatial {name}` (BE floors/router.py:67-78). */
export async function renameFloor(api: APIRequestContext, projectId: string, floorId: string, name: string): Promise<void> {
  const res = await api.patch(`/api/projects/${projectId}/floors/${floorId}/spatial`, { data: { name } });
  expect(res.status(), `setup: PATCH floor ${floorId} name`).toBe(200);
}

/* ---- flow harness ------------------------------------------------------------------------------ */

export interface Flow {
  readonly admin: APIRequestContext;
  /** Pool engineer `P8_SLOT`: owner of every project of the flow. */
  readonly owner: PoolUser;
  readonly ownerApi: APIRequestContext;
  /** Project ids to delete (as the owner) in `finally`. */
  readonly projects: string[];
  readonly sessions: Session[];
}

/** Runs `body` with the main admin API, the P8 owner (API) and cleans projects / sessions up afterwards. */
export async function flow(body: (f: Flow) => Promise<void>): Promise<void> {
  const admin = await mainAdminApi();
  const projects: string[] = [];
  const sessions: Session[] = [];
  let ownerApi: APIRequestContext | undefined;
  try {
    const owner = await poolUser(admin, 'engineer', P8_SLOT);
    ownerApi = await signedInApi(owner.email, owner.password);
    await body({ admin, owner, ownerApi, projects, sessions });
  } finally {
    for (const s of sessions) await s.context.close().catch(() => undefined);
    for (const id of projects) if (ownerApi !== undefined) await deleteSeededProject(ownerApi, id);
    await ownerApi?.dispose();
    await admin.dispose();
  }
}

/** A browser session that `flow` closes. */
export async function session(
  f: Flow,
  browser: Browser,
  user: { readonly email: string; readonly password: string } = f.owner,
  options: Parameters<typeof openSession>[2] = {},
): Promise<Session> {
  const s = await openSession(browser, user, options);
  f.sessions.push(s);
  return s;
}

/** Own project of the owner, deleted by `flow`. */
export async function ownProject(f: Flow, slug: string, floors: number | readonly string[]): Promise<SeededProject> {
  const p = await createProject(f.ownerApi, slug, floors);
  f.projects.push(p.projectId);
  return p;
}

/* ---- copy (each cites its FE source; paths under src/screens/pipeline/) -------------------------- */

export const STAGES = [
  'Tiền xử lý',
  'Tách lớp tường',
  'Nhận diện cửa và đồ đạc',
  'Đọc kích thước',
  'Dựng dữ liệu không gian',
  'Kiểm tra chất lượng',
] as const; // src/i18n/vi.json `pipeline`, order of getPipelineStages (lib/realtime/pipeline.ts)

export const PR = {
  nav: 'Xử lý', // ProcessingScreen.tsx BREADCRUMB_PIPELINE (nav aria-label)
  emptyTitle: 'Chưa có bước nào để theo dõi', // ProcessingScreen.tsx EMPTY_TITLE
  emptyDescription: 'Khi bản vẽ được đưa vào hàng đợi, các bước xử lý sẽ hiện ở đây.', // EMPTY_DESCRIPTION
  emptyAction: 'Tải bản vẽ', // EMPTY_ACTION_LABEL
  noRun: 'Chưa có lượt xử lý nào đang chạy.', // useProcessingScreen.ts NO_RUN_SENTENCE
  background: 'Để chạy nền và thông báo cho tôi', // RUN_IN_BACKGROUND_LABEL
  cancel: 'Huỷ xử lý', // CANCEL_LABEL
  retry: 'Thử lại', // RETRY_LABEL
  support: 'Liên hệ hỗ trợ', // SUPPORT_LABEL
  tabs: 'Xem trước hoặc nhật ký', // TABS_ARIA_LABEL
  tabPreview: 'Xem trước',
  tabLog: 'Nhật ký',
  chips: 'Tiến độ theo tầng', // ProcessingFloorChips.tsx FLOORS_ARIA_LABEL
  objects: 'Số đối tượng đã nhận theo tầng', // ProcessingScreen.tsx FLOOR_OBJECTS_ARIA_LABEL
  steps: 'Các bước xử lý', // ProcessingStepList.tsx STEPS_ARIA_LABEL
  stepBar: 'Bước đang xử lý', // ProcessingStepBar.tsx COMPACT_ARIA_LABEL
  allSteps: 'Xem tất cả các bước', // ProcessingScreen.tsx ALL_STEPS_LABEL
  copyLog: 'Sao chép nhật ký', // ProcessingLogPanel.tsx COPY_LOG_LABEL
  logCopied: 'Đã chép nhật ký', // useProcessingScreen.ts COPY.logCopied
  logPanel: 'Nhật ký xử lý', // ProcessingLogPanel.tsx PANEL_LABEL
  logEmpty: 'Chưa có dòng nhật ký nào', // ProcessingLogPanel.tsx EMPTY_TITLE
  logEmptyDescription: 'Nhật ký xử lý sẽ xuất hiện tại đây khi hệ thống bắt đầu ghi lại.',
  previewPanel: 'Xem trước bản vẽ đang xử lý', // ProcessingPreviewPanel.tsx PANEL_LABEL
  previewEmpty: 'Chưa có tầng nào để xem trước', // NO_FLOOR_TITLE
  previewEmptyDescription: 'Panel sẽ hiện bản vẽ ngay khi có tầng bắt đầu xử lý.', // NO_FLOOR_DESCRIPTION
  summary: 'Báo cáo tổng kết', // ProcessingSummary.tsx SUMMARY_ARIA_LABEL
  reviewWalls: 'Duyệt lớp tường', // REVIEW_WALLS_LABEL
  calibrate: 'Hiệu chỉnh tỷ lệ', // CALIBRATE_SCALE_LABEL
} as const;

/**
 * "Đã xong {done}/{total} tầng" (useProcessingScreen.ts doneFloorsSentence). Since QA-03e R1-03 (FIX-2342) it is its own
 * `<span role="status">` (ProcessingScreen.tsx:289 on fix/qa03e-int); "· Còn lại khoảng …" (remainingLine, :290) is outside it.
 */
export const doneLine = (done: number, total: number): RegExp => new RegExp(`^Đã xong ${String(done)}/${String(total)} tầng`, 'u');

export const PF = {
  retry: 'Thử lại bước này', // pipelineFailureText.ts retryLabel
  copy: 'Sao chép', // copyLabel
  copied: 'Đã sao chép', // copiedLabel
  copyCode: 'Sao chép mã lỗi', // copyCodeAriaLabel
  copyLog: 'Sao chép nhật ký kỹ thuật', // copyLogAriaLabel
  copyAll: 'Sao chép toàn bộ nhật ký', // copyAllLogsAriaLabel
  technical: 'Chi tiết kỹ thuật', // technicalToggleLabel
  collapse: 'Thu gọn', // collapseLabel
  expand: 'Mở lại', // expandLabel
  supportLink: 'Báo lỗi cho hỗ trợ', // supportLinkLabel
  lower: 'Thử lại với ngưỡng thấp hơn', // retryLowerThresholdLabel
  upload: 'Tải lên bản vẽ rõ hơn', // uploadClearerLabel
  skip: 'Bỏ qua tầng đó', // skipFloorLabel
  lowerWarning: 'Ngưỡng thấp hơn nhận ra nhiều tường hơn, nhưng cũng nhận nhầm nhiều hơn.',
  skipWarning:
    'Mô hình sẽ thiếu tầng này. Các tầng còn lại vẫn dựng đủ. Hệ thống chưa bỏ qua được một tầng, nên hướng này chưa dùng được.', // skipFloorWarning + skipFloorUnsupportedWarning
  kept: 'Bản vẽ gốc và các thiết lập của bạn vẫn được giữ.', // keptWorkLine
  keptTitle: 'Kết quả đã có', // PipelineFailureProgress.tsx KEPT_WORK_TITLE
  logLine: 'Máy chủ chưa có phần trả nhật ký kỹ thuật của một bước.', // logUnsupportedLine
  logList: 'Nhật ký kỹ thuật', // PipelineFailureDetails.tsx LOG_ARIA_LABEL
  supportUnsupported:
    'Hệ thống chưa chạy lại được riêng một bước. Bộ phận hỗ trợ chạy lại giúp cả lượt sẽ nhanh hơn.', // supportRetryUnsupported
  nextSteps: 'Hướng đi tiếp', // PipelineFailureAlert.tsx NEXT_STEPS_ARIA_LABEL
  bodyId: 'pipeline-failure-body', // PipelineFailure.tsx BODY_ID
  detailsId: 'pipeline-failure-technical-details', // PipelineFailureDetails.tsx PANEL_ID
  fileCorrupt: 'Tệp bản vẽ bị hỏng nên không mở được.', // pipelineErrorText.ts FILE_CORRUPT
  imageTooLarge: 'Ảnh bản vẽ lớn hơn kích thước hệ thống nhận.', // pipelineErrorText.ts IMAGE_TOO_LARGE
} as const;

/** "Bước {stage} ở {floor} không hoàn tất được." (pipelineFailureText.ts summarySentence). */
export const failureTitle = (stage: string, floor: string): string => `Bước ${stage} ở ${floor} không hoàn tất được.`;

export const NOT_FOUND_TITLE = 'Không tìm thấy dự án này'; // components/feedback/ProjectSpatialGate.tsx:36
export const NOT_FOUND_SENTENCE = 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.'; // :37-38
export const BACK_TO_PROJECTS = 'Về danh sách dự án'; // :39

/* ---- N16 counts (what the summary must show) --------------------------------------------------- */

export interface LayerItem {
  readonly id: string;
  readonly confidence: number;
  readonly reviewed: boolean;
}

export interface LayerCounts {
  readonly walls: readonly LayerItem[];
  readonly openings: number;
  readonly rooms: number;
  readonly dimensions: number;
  /** Room outlines (mm); the area is `totalArea` over every floor's outlines, rounded once (K5). */
  readonly roomOutlines: readonly (readonly PointMm[])[];
  /** Items (walls + openings + rooms) not reviewed and below a threshold, per threshold asked. */
  readonly lowBelow: (threshold: number) => number;
}

const items = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);

/** N16 `GET …/floors/:fid/spatial/layer` read raw (wire field names, spatialLayer.ts / spatial.ts). */
export async function readLayerCounts(api: APIRequestContext, projectId: string, floorId: string): Promise<LayerCounts> {
  const res = await api.get(`/api/projects/${projectId}/floors/${floorId}/spatial/layer`);
  expect(res.status(), `setup: N16 GET spatial/layer of ${floorId}`).toBe(200);
  const doc = (await res.json()) as Json;
  const layer = (doc.layer ?? {}) as Json;
  const all = [...items(layer.walls), ...items(layer.openings), ...items(layer.rooms)];
  return {
    walls: items(layer.walls).map((w) => ({ id: String(w.id), confidence: Number(w.confidence), reviewed: w.reviewed === true })),
    openings: items(layer.openings).length,
    rooms: items(layer.rooms).length,
    dimensions: items(doc.dimensions).length,
    roomOutlines: items(layer.rooms).map((room) =>
      items(room.outline).map((point) => ({ x: millimetres(Number(point.x)), y: millimetres(Number(point.y)) })),
    ),
    lowBelow: (threshold) => all.filter((item) => item.reviewed !== true && Number(item.confidence) < threshold).length,
  };
}

/** The five metric labels the summary builds from summed counts (useProcessingScreen.ts:1282-1288, countLabel, formatArea). */
export function metricLabelsOf(parts: readonly LayerCounts[]): string[] {
  const sum = (pick: (c: LayerCounts) => number): number => parts.reduce((total, part) => total + pick(part), 0);
  const n = (value: number): string => formatNumber(value, { fractionDigits: 0 });
  const walls = sum((c) => c.walls.length);
  return [
    `${n(walls)} tường`,
    `${n(walls + sum((c) => c.openings) + sum((c) => c.rooms))} đối tượng`,
    `${n(sum((c) => c.dimensions))} chuỗi kích thước`,
    `${n(sum((c) => c.rooms))} phòng`,
    `${formatNumber(totalArea(parts.flatMap((c) => c.roomOutlines)), { fractionDigits: 2 })} m²`,
  ];
}

/* ---- network holds (a delay, never a mock) ----------------------------------------------------- */

export interface Hold {
  /** Resolves once the first matching request is being held. */
  readonly seen: Promise<void>;
  /** Lets the held request (and every later one) go to the real backend. */
  readonly release: () => Promise<void>;
}

/** Holds the FIRST request whose path matches `re` until `release()`, then continues it unchanged. */
export async function holdFirst(page: Page, re: RegExp): Promise<Hold> {
  let open: () => void = () => undefined;
  let markSeen: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const seen = new Promise<void>((resolve) => (markSeen = resolve));
  let held = false;
  const matcher = (url: URL): boolean => re.test(url.pathname);
  const handler = async (route: Route): Promise<void> => {
    if (held) {
      await route.fallback();
      return;
    }
    held = true;
    markSeen();
    await gate;
    await route.continue().catch(() => undefined);
  };
  await page.route(matcher, handler);
  return {
    seen,
    release: async () => {
      open();
      await page.unroute(matcher, handler).catch(() => undefined);
    },
  };
}

/* ---- keyboard ---------------------------------------------------------------------------------- */

/** Presses Tab until the focused element's accessible-ish label (aria-label or text) equals `label`; presses used, or -1. */
export async function tabTo(page: Page, label: string, max = 60): Promise<number> {
  for (let i = 1; i <= max; i += 1) {
    await page.keyboard.press('Tab');
    const now = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return (el?.getAttribute('aria-label') ?? el?.innerText ?? '').trim();
    });
    if (now === label) return i;
  }
  return -1;
}

/** `true` when the focused element shows a focus ring (`:focus-visible` and a visible outline or box shadow). */
export const focusRingShown = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el === null || !el.matches(':focus-visible')) return false;
    const style = getComputedStyle(el);
    return (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none';
  });

/** Page wider than the viewport = a horizontal scroll bar. */
export const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
