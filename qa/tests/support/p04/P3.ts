/**
 * QA-04c P3 helpers — SCR-18 "Đọc kích thước OCR" flows (`phase04_dimensions_{edge,mocked_edge,ui}.spec.ts`). Owned by P3.
 *
 * Why a mock at all (catalog C2 summary, flow-plan seed `mocked N16 dims`): #35 cannot write `dimensions` (the FE body is
 * layer + scale only, BE spatial_write/router.py:58-62) and the fake-ML OCR reads none, so SCR-18 rows only exist when
 * GET N16 (`…/floors/:f/spatial/layer`) is answered with a `dimensions` array. {@link routeDims} fetches the REAL N16 of
 * the flow's own seeded floor (`layerSeed.createQcProject`) and adds the array; the level, walls and revision stay real.
 * The page must open with a full load (store empty, DG:1110) for SCR-18 to read N16 at all.
 *
 * - {@link dimsFixture}: wire `Dimension` rows (src/api/schemas/spatial.ts DimensionSchema): counter-led ids
 *   `M-00000NDIMS` so the display code is `#M-00N` (src/domain/spatial/ids.ts displayCodesOf), `reviewed` rows carry
 *   `source: 'human'` (A5 humanOnlyReview), `referenceIds` point at real walls of the floor by index.
 * - {@link routeDims}: per-floor answer that the flow changes between steps (rows, scale, fail status, abort, hold).
 * - {@link routeDrawing}: #33 `GET …/floors/:f/spatial` with a `drawings[0]` (DrawingSchema) whose url serves the env
 *   PNG, for background / crop steps (DG:1091-1108); or a failing #33.
 * - Copy (`DIM`) cites src/screens/qc/DimensionOcrReview/dimensionOcrText.ts (DT) and the views.
 */
import { expect, test, type APIRequestContext, type Locator, type Page, type Route } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';

type Json = Record<string, unknown>;

/* ---- copy ------------------------------------------------------------------------------------- */

export const DIM = {
  screen: 'Đọc kích thước OCR', // DT:209, DV:76
  panel: 'Kích thước đọc được', // DT:215, DV:259
  canvas: 'Bản vẽ lớp kích thước OCR', // DT:113
  list: 'Danh sách kích thước đọc được', // DT:116, DL:124
  filter: 'Lọc theo trạng thái duyệt', // DT:219
  all: 'Tất cả', // DT:97
  low: 'Độ tin cậy thấp', // DT:100
  unreviewed: 'Chưa duyệt', // DT:103
  compareBar: 'Thanh so sánh với hình học', // DT:123
  approve: 'Duyệt kích thước', // DT:51
  keyboardOn: 'Bật chế độ duyệt bàn phím', // DT:57
  keyboardOff: 'Tắt chế độ duyệt bàn phím', // DT:60
  keyboardHint: 'Hoặc bấm R để bật', // DT:63
  keyboardCaption: 'Chế độ duyệt bàn phím — đường nhanh nhất để đi qua danh sách kích thước', // DT:66-67
  emptyTitle: 'Chưa đọc được chuỗi kích thước nào', // DT:140
  emptyDescription:
    'Chuỗi kích thước trên bản vẽ có nét mảnh hoặc không rõ, nên OCR không tách được số. Hiệu chỉnh tỷ lệ bằng tay để đo độ dài từ bản vẽ.', // DT:141-142
  toScale: 'Đặt tỷ lệ', // DT:143
  errorTitle: 'Không đọc được kích thước', // DT:174
  errorDescription: 'Hệ thống gặp lỗi khi xử lý bản vẽ. Thử lại để chạy lại bước này.', // DT:175
  retry: 'Thử lại', // DT:176
  doneTitle: 'Tất cả kích thước đã duyệt', // DT:183 (never rendered, 18-B-010)
  forbiddenTitle: 'Không có quyền duyệt kích thước', // DT:191 (never rendered, 18-D-010)
  forbiddenDescription:
    'Vai trò hiện tại chỉ được xem, không được chỉnh sửa lớp kích thước OCR. Liên hệ quản trị dự án nếu cần.', // DT:192-193
  undo: 'Hoàn tác', // Toast.tsx:175
  toasts: 'Thông báo', // Toast.tsx:203
  zoomIn: 'Phóng to', // components/canvas/ZoomCluster.tsx:108
} as const;

/** `${count} mục dưới ngưỡng tin cậy, đã lọc sẵn` (DT:109-110, never rendered: 18-B-011). */
export const lowNotice = (count: number): string => `${String(count)} mục dưới ngưỡng tin cậy, đã lọc sẵn`;
/** `${reviewed}/${total} kích thước đã duyệt` (DT:12-13). */
export const progressText = (reviewed: number, total: number): string => `${String(reviewed)}/${String(total)} kích thước đã duyệt`;
/** DT:43-44 with the value formatted `formatLength(v, { unit: 'mm' })` (vi-VN dot thousands). */
export const outlierText = (valueMm: number): string =>
  `Giá trị này hàm ý phòng dài bất thường: ${mm(valueMm)}. Kiểm tra lại sao cho phù hợp với bản vẽ.`;
/** DT:32-37. */
export const compareText = (read: string, measured: string, deviation: string): string =>
  `So sánh với hình học: chuỗi đọc được ${read} · đo từ bản vẽ ${measured} · lệch ${deviation}`;
/** `formatLength(v, { unit: 'mm' })` → "3.000 mm" (src/lib/format/measure.ts:121-130, vi-VN). */
export const mm = (valueMm: number): string => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(valueMm)} mm`;
/** What `NumericField` shows for an integer value when not focused (useNumericField.ts:79-80, maxFractionDigits 2). */
export const fieldText = (valueMm: number): string => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(valueMm);

/* ---- ids -------------------------------------------------------------------------------------- */

/** Machine id, counter-led (body `00000N` + `DIMS`, 10 chars): displayCodesOf reads the counter (ids.ts:150-160). */
export const dimId = (n: number): string => `M-${String(n).padStart(6, '0')}DIMS`;
/** Display code with `#` (DG:265 dimensionCodeLabel). */
export const dimCode = (n: number): string => `#M-${String(n).padStart(3, '0')}`;

/* ---- fixture ---------------------------------------------------------------------------------- */

export interface DimRow {
  readonly n: number;
  readonly valueMm: number;
  readonly confidence: number;
  /** Line in floor millimetres: [x1, y1, x2, y2]. */
  readonly line: readonly [number, number, number, number];
  readonly reviewed?: boolean;
  readonly overrideValueMm?: number;
  /** Indices into the floor's REAL `layer.walls` (resolved by {@link routeDims}). */
  readonly walls?: readonly number[];
}

/** Wire `dimensions` for `levelId` (DimensionSchema: strict, integer mm, A5, valueMm > 0). */
export function dimsFixture(levelId: string, rows: readonly DimRow[], wallIds: readonly string[] = []): Json[] {
  return rows.map((row) => ({
    confidence: row.confidence,
    id: dimId(row.n),
    kind: 'linear',
    levelId,
    line: { start: { x: row.line[0], y: row.line[1] }, end: { x: row.line[2], y: row.line[3] } },
    ...(row.overrideValueMm === undefined ? {} : { overrideValueMm: row.overrideValueMm }),
    referenceIds: (row.walls ?? []).map((index) => {
      const id = wallIds[index];
      if (id === undefined) throw new Error(`dimsFixture: wall #${String(index)} missing on the floor`);
      return id;
    }),
    reviewed: row.reviewed === true,
    source: row.reviewed === true ? 'human' : 'ai',
    valueMm: row.valueMm,
  }));
}

/** Resolves when `release()` is called — holds a mocked response until the held state is asserted (FL-11-09 pattern). */
export interface Gate {
  readonly promise: Promise<void>;
  readonly release: () => void;
}

export function gate(): Gate {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/** Answer of one floor's N16. `rows: null` = the real response untouched (pass-through). */
export interface DimsAnswer {
  rows: readonly DimRow[] | null;
  /** `level.scaleMillimetresPerPixel` to set (a calibrated floor); absent = whatever the real level has. */
  scale?: number | undefined;
  /** HTTP status of a faked error body (W7 `{code, requestId}`), or 'abort' for a dropped connection. */
  fail?: number | 'abort' | undefined;
  /** Held until released. */
  hold?: Promise<void> | undefined;
}

export interface DimsRoute {
  /** Mutable per floor; a floor not listed passes through. */
  readonly floors: Record<string, DimsAnswer>;
  /** Floor id of every GET N16 the page made, in order (mocked or not). */
  readonly hits: string[];
  /** Last real N16 body per floor (before the injection). */
  readonly bodies: Record<string, Json>;
}

const N16_RE = /^\/api\/projects\/[^/]+\/floors\/([^/]+)\/spatial\/layer$/u;
const FLOOR_RE = /^\/api\/projects\/[^/]+\/floors\/([^/]+)\/spatial$/u;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

const errorCode = (status: number): string =>
  status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';

/** Fulfils, ignoring a page / request that went away while the answer was held. */
async function settle(route: Route, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    /* the request was cancelled (navigation / context closed) while held */
  }
}

/** Faked W7 error body. */
export const failWith = (route: Route, status: number): Promise<void> =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code: errorCode(status), requestId: 'qa-p3-mock' }) });

/** GET N16 answered per {@link DimsAnswer}; install before the first `goto`. */
export async function routeDims(page: Page, floors: Record<string, DimsAnswer>): Promise<DimsRoute> {
  const state: DimsRoute = { floors, hits: [], bodies: {} };
  await page.route(
    (url) => N16_RE.test(url.pathname),
    async (route) => {
      const request = route.request();
      const floorId = N16_RE.exec(new URL(request.url()).pathname)?.[1] ?? '';
      if (request.method() !== 'GET') {
        await route.fallback();
        return;
      }
      state.hits.push(floorId);
      const answer = state.floors[floorId];
      if (answer === undefined) {
        await route.fallback();
        return;
      }
      if (answer.hold !== undefined) await answer.hold;
      await settle(route, async () => {
        if (answer.fail === 'abort') {
          await route.abort('failed');
          return;
        }
        if (typeof answer.fail === 'number') {
          await failWith(route, answer.fail);
          return;
        }
        const response = await route.fetch();
        const body = asRecord(await response.json(), 'N16');
        state.bodies[floorId] = body;
        if (answer.rows === null) {
          await route.fulfill({ response, json: body });
          return;
        }
        const level = asRecord(body.level, 'N16.level');
        const walls = (asRecord(body.layer, 'N16.layer').walls as Json[]).map((wall) => String(wall.id));
        const json = {
          ...body,
          dimensions: dimsFixture(String(level.id), answer.rows, walls),
          ...(answer.scale === undefined ? {} : { level: { ...level, scaleMillimetresPerPixel: answer.scale } }),
        };
        await route.fulfill({ response, json });
      });
    },
  );
  return state;
}

/** `#W-NNN` of the floor's wall `index` as the screen labels it: walls are not counter-led, so the display code is the
 *  rank of the id among the level's wall ids sorted ascending (ids.ts displayCodesOf rule 2). */
export function wallCode(body: Json, index: number): string {
  const ids = (asRecord(body.layer, 'N16.layer').walls as Json[]).map((wall) => String(wall.id));
  const id = ids[index];
  if (id === undefined) throw new Error(`wallCode: wall #${String(index)} missing`);
  return `#W-${String([...ids].sort().indexOf(id) + 1).padStart(3, '0')}`;
}

/* ---- #33 drawing ------------------------------------------------------------------------------ */

export interface DrawingRoute {
  /** Absolute url the injected `drawings[0]` points at (served from the env PNG). */
  readonly url: string;
  /** Mutable: a status to fail #33 with instead of injecting. */
  fail: number | undefined;
  readonly hits: string[];
}

/**
 * #33 `GET …/floors/:f/spatial` with one drawing (`DrawingSchema`, strict) of `widthMm` × `heightMm`, its url served by
 * a second route from `png`. Install before the first `goto`.
 */
export async function routeDrawing(page: Page, png: Buffer, size = { widthMm: 16_000, heightMm: 12_000 }): Promise<DrawingRoute> {
  const url = `${readBaseUrl()}/qa-p3/drawing.png`;
  const state: DrawingRoute = { url, fail: undefined, hits: [] };
  await page.route(url, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await page.route(
    (u) => FLOOR_RE.test(u.pathname),
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      state.hits.push(FLOOR_RE.exec(new URL(route.request().url()).pathname)?.[1] ?? '');
      await settle(route, async () => {
        if (state.fail !== undefined) {
          await failWith(route, state.fail);
          return;
        }
        const response = await route.fetch();
        const body = asRecord(await response.json(), '#33');
        const drawing = {
          heightMm: size.heightMm,
          id: 'drw_qap3mockeddrawing0001',
          name: 'qa-p3-drawing.png',
          uploadedAt: new Date().toISOString(),
          uploaderId: 'usr_qap3mockeduploader01',
          url,
          widthMm: size.widthMm,
        };
        await route.fulfill({ response, json: { ...body, drawings: [drawing] } });
      });
    },
  );
  return state;
}

/* ---- settings --------------------------------------------------------------------------------- */

/** N6 `PUT /api/projects/:p/settings` (BE project_settings/schemas.py:103-111) at revision 0 with `confidenceThreshold`. */
export async function putThreshold(api: APIRequestContext, projectId: string, threshold: number, baseVersion = 0): Promise<void> {
  const res = await api.put(`/api/projects/${projectId}/settings`, {
    data: {
      baseVersion,
      body: { buildingType: 'residential', lengthUnit: 'mm', snapToleranceMm: 50, confidenceThreshold: threshold, defaultScaleMmPerPx: 1 },
    },
  });
  expect(res.status(), `setup: PUT settings confidenceThreshold ${String(threshold)}: ${(await res.text()).slice(0, 200)}`).toBe(200);
}

/* ---- locators --------------------------------------------------------------------------------- */

export const region = (page: Page): Locator => page.getByRole('region', { name: DIM.screen, exact: true });
export const panel = (page: Page): Locator => page.getByRole('complementary', { name: DIM.panel, exact: true });
export const listGroup = (page: Page): Locator => page.getByRole('group', { name: DIM.list, exact: true });
export const options = (page: Page): Locator => listGroup(page).getByRole('option');
export const option = (page: Page, n: number): Locator => listGroup(page).getByRole('option', { name: dimCode(n), exact: true });
export const field = (page: Page, n: number): Locator => page.getByRole('textbox', { name: `Giá trị kích thước ${dimCode(n)}`, exact: true });
/**
 * P5 `openFlow` registers a `dialog` listener that only records, so a `beforeunload` raised by a dirty previous step is never
 * answered and the next `goto`/`reload` hangs for 30 s. Leave the page (accept) on `beforeunload`; other dialogs stay recorded only.
 */
export const leaveOnBeforeUnload = (page: Page): void => {
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'beforeunload') void dialog.accept().catch(() => undefined);
  });
};

/** Visible label of a `Button` (src/components/ui/Button.tsx:78-96 renders the children twice: a hidden sizing copy + the visible `span.absolute`): `toHaveText` on the button itself reads both. */
export const buttonText = (button: Locator): Locator => button.locator('span.absolute');
export const approveButton = (page: Page, n: number): Locator => page.getByRole('button', { name: `${DIM.approve} ${dimCode(n)}`, exact: true });
export const compareBar = (page: Page): Locator => page.getByRole('group', { name: DIM.compareBar, exact: true });
export const filterGroup = (page: Page): Locator => page.getByRole('radiogroup', { name: DIM.filter, exact: true });
export const radio = (page: Page, name: string): Locator => filterGroup(page).getByRole('radio', { name, exact: true });
/** Vòng 6 (Z/S-17): the counter moved from the list header to the panel status line (DimensionOcrReview.tsx). */
export const progress = (page: Page): Locator => page.getByTestId('dimension-ocr-progress');
export const canvasFrame = (page: Page): Locator => page.getByRole('group', { name: DIM.canvas, exact: true });
/** A chain on the canvas: `<g aria-label="<machine id>" role="presentation">` (DCV:95-110). */
export const chain = (page: Page, n: number): Locator => page.locator(`svg g[aria-label="${dimId(n)}"]`);
export const keyboardSection = (page: Page): Locator => page.getByRole('region', { name: DIM.keyboardCaption, exact: true });
export const toast = (page: Page, text: string): Locator =>
  page.getByRole('region', { name: DIM.toasts, exact: true }).getByRole('status').filter({ hasText: text });
export const savedStatus = (page: Page): Locator => page.getByRole('status').filter({ hasText: /^Đã lưu lúc \d{2}:\d{2}$/u });
export const errorAlert = (page: Page): Locator => page.getByRole('alert').filter({ hasText: DIM.errorTitle });
/** The four `Skeleton preset="table-row"` rows of the panel (DV:127-135, components/feedback/Skeleton.tsx:25-32). */
export const skeletonRows = (page: Page): Locator => panel(page).locator('div.flex.items-center.gap-4.p-3:has(> .animate-pulse)');

/** Codes of the rows the list shows, in order. */
export const shownCodes = async (page: Page): Promise<string[]> =>
  (await options(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''))).filter((c) => c !== '');

/** Full load of SCR-18 (store empty → N16 read, DG:1110) and wait for the screen region. */
export async function openDims(page: Page, projectId: string, floorId: string, path: string): Promise<void> {
  await page.goto(path);
  await expect(region(page), `SCR-18 of ${projectId}/${floorId} rendered`).toBeVisible();
}

/** Selects a row the way a person does: a click on its crop (not on the field or the approve button inside it). */
export async function selectRow(page: Page, n: number): Promise<void> {
  await option(page, n).getByRole('img').click();
}

/**
 * Bounded negative wait for a project write (`PUT/PATCH/POST/DELETE /api/projects/…`), past the 800 ms autosave debounce
 * (A7, useAutosave AUTOSAVE_DEBOUNCE_MS): resolves at once with the write when one is sent, else `null` after `ms`.
 */
export async function writeWithin(page: Page, ms = 2_500): Promise<string | null> {
  // fixed-wait-ok: "nothing was sent" has no event to wait for; the waitForRequest timeout is the observation window.
  const request = await page
    .waitForRequest((r) => r.method() !== 'GET' && new URL(r.url()).pathname.startsWith('/api/projects/'), { timeout: ms })
    .catch(() => null);
  return request === null ? null : `${request.method()} ${new URL(request.url()).pathname}`;
}

/** Two animation frames: React has painted whatever the last key press scheduled. */
export const painted = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

/** The box of `inner` lies inside the box of `outer` (scroll box, not a child narrowed by its scrollbar). */
export async function insideBox(inner: Locator, outer: Locator): Promise<boolean> {
  const [a, b] = [await inner.boundingBox(), await outer.boundingBox()];
  if (a === null || b === null) return false;
  return a.y >= b.y - 1 && a.y + a.height <= b.y + b.height + 1 && a.x >= b.x - 1 && a.x + a.width <= b.x + b.width + 1;
}

/** A soft note in the report (branch taken, row moved, data-dependent outcome). */
export const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};
