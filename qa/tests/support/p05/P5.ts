/**
 * QA-05c pack P5 helpers: SCR-25 measure (mocked edge + ui) and SCR-27 / SCR-X5 roles (`phase05_measure_mocked_edge`,
 * `phase05_measure_ui`, `phase05_roles_edge`). Only these three specs import it. Functions that P4 (`measure.ts`) or P1
 * (`viewer.ts`) own are re-written here and carry `// dup-of:`; the coordinator merges them at S4.
 *
 * Reused as they are (not copied): `../p03/P4` (adminApi, openAdminPage, openPoolPage, closePage, holdFirst, errorBody,
 * unknownProjectId, escapeRegExp), `../layerSeed`, `../phase03Seed`.
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type Browser, type Locator, type Page, type Route } from '@playwright/test';
import sharp from 'sharp';

import { ROUTES, pathOf } from '../../../../e2e/fixtures/routes';
import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../../../../e2e/fixtures/session';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../../../e2e/fixtures/tour';
import { navigateThenWaitForApi, watchApi } from '../../../../e2e/fullstack/apiWatch';
import { PASCAL_RENDER_TIMEOUT_MS, readBaseUrl } from '../../../../e2e/fullstack/env';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX } from '../evidence';
import { createQcProject, writeLayer, type LayerApi } from '../layerSeed';
import { createProject, signInPoolUser, type PoolUser } from '../phase03Seed';
import { errorBody, escapeRegExp, type OpenPage } from '../p03/P4';

export const DESKTOP = { width: 1440, height: 900 } as const;
export const PHONE = { width: 375, height: 812 } as const;
/** Scene build under the real BE. */
export const SCENE_TIMEOUT_MS = 60_000;
/** react-query retries a failed read before the error state paints. */
export const ERROR_PAINT_TIMEOUT_MS = 30_000;
/** One raycast + one paint before the product reacts to a canvas click. */
const PICK_SETTLE_MS = 2_000;
const MAX_PICK_ATTEMPTS = 15;

type Json = Record<string, unknown>;
export type Point = readonly [number, number];

/* ---------------------------------------------------------------- copy (each cites its FE source) */

export const MT = {
  list: 'Phép đo', // MTL:60,201
  emptyHint: 'Chưa có phép đo nào. Nhấn M rồi chọn hai điểm trên mô hình.', // MTL:61, MTV:83
  unit: 'Đơn vị', // MTL:62
  collapse: 'Thu gọn mục Phép đo', // MTL:63
  modes: 'Chọn chế độ đo', // MTV:162
  p2p: 'Điểm đến điểm', // MTT:45
  pin: 'Ghim phép đo (phím Enter)', // MTV:195
  drop: 'Bỏ phần đo dở (phím Esc)', // MTV:202
  toggle: 'Bật tắt công cụ đo (phím M)', // MTV:208
  railTool: 'Đo (M)', // UVS:173-177
  loadError: 'Chưa tải được danh sách phép đo của dự án. Kiểm tra kết nối rồi thử lại.', // UMT:195
  retry: 'Thử lại', // MTV:229
  pinFailed: 'Chưa ghim được phép đo, hãy thử lại', // UMT:214
  idTaken: 'Mã phép đo vừa bị một phiên khác dùng; hãy ghim lại', // UMT:211
  deleteFailed: 'Chưa xoá được phép đo, hãy thử lại', // UMT:215
  undoFailed: 'Chưa hoàn tác được việc xoá phép đo', // UMT:218
  undo: 'Hoàn tác', // I18N common.undo
  pinBlocked: 'Bạn chỉ có quyền xem dự án này, nên chưa ghim được phép đo. vẫn đo và đọc số bình thường.', // UMT:228
  viewOnlyTitle: 'Chỉ xem', // VIN:84
  partialHint: 'Chuỗi đo chưa đóng. Chọn thêm điểm để đóng chuỗi, hoặc nhấn Esc để bỏ.', // MTV:86
  building: 'Đang dựng mô hình…', // UVS:208
  refreshFailed: 'Không tải lại được mô hình.', // PSG:98
} as const;
export const GATE = {
  notFoundTitle: 'Không tìm thấy dự án này', // PSG:37
  notFoundDescription: 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.', // PSG:38-39
  backToProjects: 'Về danh sách dự án', // PSG:40
  unknownTitle: 'Có trục trặc', // I18N errors.unknown.title
  unknownText: 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.', // I18N errors.unknown.description
  networkTitle: 'Mất kết nối', // I18N errors.network.title
  networkText: 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.', // I18N errors.network.description
} as const;
export const MV = {
  region: 'Xem mô hình 3D trên điện thoại', // MVV:208
  tools: 'Công cụ xem mô hình', // MVB:195
  built: 'Mô hình đã dựng xong.', // MVV:152
  partial: /^Mô hình mới có một phần/u, // MVV:143
  forbidden: 'Bạn chưa có quyền xem mô hình này', // MVV:123
  empty: 'Chưa có mô hình để xem', // MVV:111
  sheet: 'Thông tin đối tượng đang chọn', // MVI:202
  invite: 'Sửa trên máy tính để chính xác hơn', // MVI:270
  sendLink: 'Gửi liên kết sang máy tính', // MVI:278
  loginPrompt: 'Hãy đăng nhập để tiếp tục.', // vi.json:201 / SessionBootstrap.tsx:406
} as const;
const PASCAL_RENDERED = /^(Đã dựng xong toàn bộ bản vẽ\.|Đã dựng xong, nhưng một số đối tượng chưa chuyển sang được\.)$/u; // PVT:93-94

/* ---------------------------------------------------------------- paths */

export const measurementsRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/measurements$`, 'u');
export const measurementRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/measurements/[^/]+$`, 'u');
export const spatialRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/spatial$`, 'u');
export const projectRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}$`, 'u');

/** Fixture calls of an admin `APIRequestContext` that already carries its Bearer (`signedInApi`). */
export const layerApiOfAdmin = (admin: APIRequestContext): LayerApi => ({ request: admin, headers: {} });

/** Admin-owned QC project (M1 by default: one layered floor); returns its id. */
export async function seedProject(admin: APIRequestContext, slug: string, floorNames?: readonly string[], layered?: number): Promise<string> {
  const [floor] = await createQcProject(layerApiOfAdmin(admin), slug, floorNames, layered);
  if (floor === undefined) throw new Error('setup: createQcProject returned no floor');
  return floor.projectId;
}

/* ---------------------------------------------------------------- small utilities */

/** `true` when `target` becomes visible within `timeout` ms (a probe, not an assertion). */
export const visibleWithin = (target: Locator, timeout: number): Promise<boolean> =>
  target.waitFor({ state: 'visible', timeout }).then(
    () => true,
    () => false,
  );

/** `null` when Playwright's trial click passes on `target`; else the reason (an overlay in the way is an app bug, BUG-474). */
export async function trialClickBlocker(target: Locator): Promise<string | null> {
  const plain = (text: string): string => text.replace(/\u001b\[[0-9;]*m/gu, '').trim();
  return target.click({ trial: true, timeout: 5_000 }).then(
    () => null,
    (error: unknown) => {
      const lines = error instanceof Error ? error.message.split('\n') : [];
      return plain(lines.find((line) => line.includes('intercepts')) ?? lines[0] ?? 'not clickable');
    },
  );
}

/** Same-document move to `url` (the router reads `popstate`), so no new document and the query cache survives. */
export async function spaGo(page: Page, url: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, url);
}

/** One-line page text of the first match, whitespace collapsed (for "same text on three routes"). */
export async function textOf(target: Locator): Promise<string> {
  return ((await target.first().textContent()) ?? '').replace(/\s+/gu, ' ').trim();
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export const intersects = (a: Box | null, b: Box | null): boolean =>
  a !== null && b !== null && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
/** `true` when the box lies inside the page viewport (1 px slack). */
export const insideViewport = (page: Page, box: Box | null): boolean => {
  const vp = page.viewportSize();
  return box !== null && vp !== null && box.x >= -1 && box.y >= -1 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1;
};

/* ---------------------------------------------------------------- API interception */

export interface Intercept {
  /** Requests of `method` on the path seen so far. */
  readonly calls: () => number;
  readonly off: () => Promise<void>;
}

/** Answers every `method` request on `re` through `answer(route, n)` (n = 1-based count); everything else falls through. */
export async function interceptApi(
  page: Page,
  re: RegExp,
  method: string,
  answer: (route: Route, n: number) => Promise<void>,
): Promise<Intercept> {
  let n = 0;
  const match = (url: URL): boolean => re.test(url.pathname);
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== method) {
      await route.fallback();
      return;
    }
    n += 1;
    await answer(route, n);
  };
  await page.route(match, handler);
  return { calls: () => n, off: () => page.unroute(match, handler) };
}

export const failWith = (status: number, code: string) => (route: Route): Promise<void> =>
  route.fulfill({ status, contentType: 'application/json', body: errorBody(code) });
export const abortRoute = (route: Route): Promise<void> => route.abort('failed');

/** Fetches the real answer, lets `patch` change its JSON, fulfils with the result (a mock of the DATA, not the status). */
export async function fulfillPatched(route: Route, patch: (body: unknown) => unknown): Promise<void> {
  const response = await route.fetch();
  const body: unknown = await response.json();
  await route.fulfill({ status: response.status(), contentType: 'application/json', body: JSON.stringify(patch(body)) });
}

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** N15 answer with two axes added (BE v1 never sends any, spatialGraph.ts:78): vertical x = 2000, horizontal y = 3000. */
export function withAxes(body: unknown): unknown {
  const root = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (!isRecord(root)) return body;
  const levels = Array.isArray(root.levels) ? root.levels : [];
  const level = levels[0];
  const levelId = isRecord(level) && typeof level.id === 'string' ? level.id : '';
  const meta = { confidence: 0.9, reviewed: false, source: 'ai' };
  const axis = (direction: string, label: string, start: Json, end: Json): Json => ({
    ...meta,
    direction,
    id: `A-QA05${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 12)}`,
    label,
    levelId,
    line: { start, end },
  });
  root.axes = [
    axis('vertical', 'A', { x: 2000, y: 0 }, { x: 2000, y: 6000 }),
    axis('horizontal', '1', { x: 0, y: 3000 }, { x: 8000, y: 3000 }),
  ];
  return body;
}

/** #16 answer whose first record has the id `M-1` (the strict schema refuses it → contract-drift branch). */
export function withBadRecordId(body: unknown): unknown {
  const bad = (record: unknown): unknown => (isRecord(record) ? { ...record, id: 'M-1' } : record);
  if (Array.isArray(body)) return body.length === 0 ? [bad({ name: 'x', mode: 'pointToPoint', points: [], rawValueMm: 1 })] : [bad(body[0]), ...body.slice(1)];
  if (isRecord(body)) {
    for (const [key, value] of Object.entries(body)) {
      if (Array.isArray(value)) return { ...body, [key]: value.map((record, index) => (index === 0 ? bad(record) : record)) };
    }
  }
  return body;
}

/* ---------------------------------------------------------------- measurements seed (#17) */

export interface MeasurementSeed {
  readonly id: string;
  readonly name: string;
  readonly mode: 'pointToPoint' | 'floorArea';
  readonly points: readonly { x: number; y: number; z?: number }[];
  readonly rawValueMm: number;
}

const p2p = (id: string, slug: string, x1: number, raw: number): MeasurementSeed => ({
  id,
  name: `${TEST_DATA_PREFIX}do-${slug}`,
  mode: 'pointToPoint',
  points: [{ x: 0, y: 0, z: 0 }, { x: x1, y: 0, z: 0 }],
  rawValueMm: raw,
});

/** R1: MS-0003 point-to-point (0,0)-(4000,0) raw 4000. */
export const seedR1 = (): MeasurementSeed[] => [p2p('MS-0003', 'r1', 4000, 4000)];
/** R3: MS-0002 p2p 4 000 · MS-9999 floorArea rectangle 3000×2000 raw 1 · MS-10000 p2p (0,0)-(12345.6,0). */
export const seedR3 = (): MeasurementSeed[] => [
  p2p('MS-0002', 'r3-a', 4000, 4000),
  {
    id: 'MS-9999',
    name: `${TEST_DATA_PREFIX}do-r3-area`,
    mode: 'floorArea',
    points: [{ x: 0, y: 0, z: 0 }, { x: 3000, y: 0, z: 0 }, { x: 3000, y: 2000, z: 0 }, { x: 0, y: 2000, z: 0 }],
    rawValueMm: 1,
  },
  p2p('MS-10000', 'r3-c', 12345.6, 12345.6),
];

/** #17 POST of every record, each expected 201 (BE measurements/router.py:30-38). */
export async function seedMeasurements(admin: APIRequestContext, projectId: string, records: readonly MeasurementSeed[]): Promise<void> {
  for (const record of records) {
    const res = await admin.post(`/api/projects/${projectId}/measurements`, { data: record });
    expect(res.status(), `setup: POST measurements ${record.id}: ${(await res.text()).slice(0, 200)}`).toBe(201);
  }
}

/* ---------------------------------------------------------------- measure screen */

// dup-of: measure.ts openMeasure
export const viewportOf = (page: Page): Locator => page.getByRole('main', { name: 'Khung nhìn mô hình', exact: true });
export const measureList = (page: Page): Locator => page.getByRole('region', { name: MT.list, exact: true });
export const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });
export const pinButton = (page: Page): Locator => page.getByRole('button', { name: MT.pin, exact: true });
export const rowLabel = (name: string): RegExp => new RegExp(`^(Ẩn|Hiện) ${escapeRegExp(name)}$`, 'u');

/** `/3d/measure` after its #16 read answered 200 and the scene stopped being busy (no EditorTour on this route). */
export async function openMeasure(page: Page, projectId: string): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.measure(projectId), { waitUntil: 'commit' }), 'GET', measurementsRe(projectId), [200]);
  await expect(viewportOf(page)).toBeVisible();
  await expect(viewportOf(page)).toHaveAttribute('aria-busy', 'false', { timeout: SCENE_TIMEOUT_MS });
}

// dup-of: measure.ts topView
export async function topView(page: Page): Promise<void> {
  const select = page.getByRole('combobox', { name: 'Góc nhìn sẵn', exact: true });
  await select.click();
  await page.getByRole('option', { name: 'Trên xuống', exact: true }).click();
  await expect(select).toHaveText('Trên xuống');
}

/** Point-to-point mode with the rail tool "Đo (M)" pressed (key M only when it is not, M toggles). */
export async function armMeasure(page: Page): Promise<void> {
  const radio = page.getByRole('radiogroup', { name: MT.modes }).getByRole('radio', { name: MT.p2p, exact: true });
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
  const tool = page.getByRole('toolbar', { name: 'Công cụ khung nhìn' }).getByRole('button', { name: MT.railTool });
  if ((await tool.getAttribute('aria-pressed')) !== 'true') {
    await viewportOf(page).focus();
    await page.keyboard.press('m');
    await expect(tool).toHaveAttribute('aria-pressed', 'true');
  }
}

/* ---- canvas pixels (sharp) ---- */

interface CanvasShot {
  readonly png: Buffer;
  readonly box: Box;
}

// dup-of: measure.ts canvasOnlyShot
/** Screenshot of the viewport canvas with every DOM overlay of the viewport hidden (CSSOM only, restored after). */
export async function canvasOnlyShot(page: Page): Promise<CanvasShot> {
  const main = viewportOf(page);
  const box = await main.locator('canvas').first().boundingBox();
  if (box === null) throw new Error('viewport canvas has no bounding box');
  // A handle, not the role locator: `visibility: hidden` drops <main> from the accessibility tree while hidden (BUG-494).
  const handle = await main.elementHandle();
  if (handle === null) throw new Error('viewport <main> not found');
  const toggle = (only: boolean): Promise<void> =>
    handle.evaluate((element, canvasOnly) => {
      const root = element as HTMLElement;
      const canvas = root.querySelector('canvas');
      root.style.visibility = canvasOnly ? 'hidden' : '';
      if (canvas !== null) canvas.style.visibility = canvasOnly ? 'visible' : '';
    }, only);
  await toggle(true);
  try {
    return { png: await page.screenshot({ clip: box }), box };
  } finally {
    await toggle(false);
    await handle.dispose();
  }
}

/** Canvas pixels once two consecutive shots are identical (the scene renders on demand). */
export async function settledCanvas(page: Page): Promise<CanvasShot> {
  let last = await canvasOnlyShot(page);
  await expect
    .poll(
      async () => {
        const now = await canvasOnlyShot(page);
        const same = now.png.equals(last.png);
        last = now;
        return same;
      },
      { message: 'canvas never settled (two identical frames)', intervals: [400], timeout: SCENE_TIMEOUT_MS },
    )
    .toBe(true);
  return last;
}

/**
 * Page points of non-background pixels (background = dominant colour, geometry = |ΔR|+|ΔG|+|ΔB| > 30), farthest from the
 * canvas centre first: in the top view of the seed the walls are the outer ring.
 */
export async function geometryPoints(shot: CanvasShot): Promise<Point[]> {
  const { data, info } = await sharp(shot.png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / shot.box.width;
  const step = Math.max(1, Math.round(6 * scale));
  const rgbAt = (x: number, y: number): readonly [number, number, number] => {
    const at = (y * info.width + x) * info.channels;
    return [data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0];
  };
  const counts = new Map<number, { n: number; rgb: readonly [number, number, number] }>();
  const samples: { x: number; y: number; rgb: readonly [number, number, number] }[] = [];
  for (let y = 0; y < info.height; y += step) {
    for (let x = 0; x < info.width; x += step) {
      const rgb = rgbAt(x, y);
      const key = ((rgb[0] >> 3) << 10) | ((rgb[1] >> 3) << 5) | (rgb[2] >> 3);
      const entry = counts.get(key);
      if (entry === undefined) counts.set(key, { n: 1, rgb });
      else entry.n += 1;
      samples.push({ x, y, rgb });
    }
  }
  const background = [...counts.values()].sort((left, right) => right.n - left.n)[0]?.rgb ?? [0, 0, 0];
  const centre: Point = [shot.box.x + shot.box.width / 2, shot.box.y + shot.box.height / 2];
  return samples
    .filter(({ rgb }) => Math.abs(rgb[0] - background[0]) + Math.abs(rgb[1] - background[1]) + Math.abs(rgb[2] - background[2]) > 30)
    .map(({ x, y }): Point => [shot.box.x + x / scale, shot.box.y + y / scale])
    .filter(([x, y]) => x > shot.box.x + 24 && x < shot.box.x + shot.box.width - 24 && y > shot.box.y + 24 && y < shot.box.y + shot.box.height - 24)
    .sort((p, q) => Math.hypot(q[0] - centre[0], q[1] - centre[1]) - Math.hypot(p[0] - centre[0], p[1] - centre[1]));
}

/** `null` when a click at (x, y) reaches the canvas itself (the picker listens on the canvas). */
async function blockerAt(page: Page, [x, y]: Point): Promise<string | null> {
  return page.evaluate(([px, py]) => {
    const hit = document.elementFromPoint(px ?? 0, py ?? 0);
    if (hit === null) return 'nothing';
    return hit.tagName === 'CANVAS' ? null : hit.tagName.toLowerCase();
  }, [x, y]);
}

/** Geometry points a click really delivers to the canvas (at most {@link MAX_PICK_ATTEMPTS}). */
export async function clickablePoints(page: Page, points: readonly Point[]): Promise<Point[]> {
  const out: Point[] = [];
  for (const point of points) {
    if (out.length >= MAX_PICK_ATTEMPTS) break;
    if ((await blockerAt(page, point)) === null) out.push(point);
  }
  return out;
}

/**
 * Starts a measurement draft by clicking model pixels until the pin button exists. `complete` also clicks a second,
 * distant point until the pin is enabled (a viewer's pin stays disabled: call with `complete: false`).
 * UNKNOWN — NEED VERIFICATION: canvas picks were never run against this build (no stack in S3); it throws when no click lands.
 */
export async function makeDraft(page: Page, { complete }: { readonly complete: boolean }): Promise<Point> {
  await page.mouse.move(5, 5);
  const points = await clickablePoints(page, await geometryPoints(await settledCanvas(page)));
  const pin = pinButton(page);
  let first: Point | null = null;
  for (const point of points) {
    await page.mouse.click(point[0], point[1]);
    if (await visibleWithin(pin, PICK_SETTLE_MS)) {
      first = point;
      break;
    }
  }
  if (first === null) throw new Error(`UNKNOWN — NEED VERIFICATION: no canvas click produced a measurement draft (${String(points.length)} reachable model pixels)`);
  if (!complete) return first;
  const origin = first;
  for (const [x, y] of points.filter((p) => Math.hypot(p[0] - origin[0], p[1] - origin[1]) >= 60).slice(0, 4)) {
    await page.mouse.click(x, y);
    if ((await pin.click({ trial: true, timeout: PICK_SETTLE_MS }).then(() => true, () => false))) return first;
  }
  throw new Error('UNKNOWN — NEED VERIFICATION: no second canvas click enabled the pin button');
}

// dup-of: measure.ts hoverUntilSnap
/** Hovers a small grid around each `centres` entry until the snap chip (role=status) reads `label`; returns the point or null. */
export async function hoverUntilSnap(page: Page, label: string, centres: readonly Point[], radius = 16, step = 4): Promise<Point | null> {
  const chip = page.getByRole('status').filter({ hasText: label });
  for (const [cx, cy] of centres) {
    for (let dy = -radius; dy <= radius; dy += step) {
      for (let dx = -radius; dx <= radius; dx += step) {
        await page.mouse.move(cx + dx, cy + dy);
        if (await visibleWithin(chip, 250)) return [cx + dx, cy + dy];
      }
    }
  }
  return null;
}

/** Screen guesses for a model point (mx, my) from the on-screen extent of the 8 × 6 m seed, both y orientations. */
export function screenGuesses(points: readonly Point[], mx: number, my: number): Point[] {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const x = x0 + (mx / 8000) * (x1 - x0);
  return [
    [x, y0 + (my / 6000) * (y1 - y0)],
    [x, y1 - (my / 6000) * (y1 - y0)],
  ];
}

/* ---------------------------------------------------------------- sessions (admin / pool user / anonymous) */

/**
 * Own browser context: `who` = 'admin' (one real login), a pool user (one login) or `null` (anonymous). `mobile` adds
 * `isMobile` + `hasTouch` (taps). One context per role, never the stored session (files run in parallel).
 */
export async function openAs(
  browser: Browser,
  who: 'admin' | PoolUser | null,
  viewport: { readonly width: number; readonly height: number } = DESKTOP,
  mobile = false,
): Promise<OpenPage> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  try {
    if (who === 'admin') {
      const { email, password } = readAdminCredentials();
      const res = await context.request.post('/api/auth/login', { data: { email, password, rememberMe: false }, headers: { Origin: readBaseUrl() } });
      expect(res.status(), 'setup: POST /api/auth/login as admin').toBe(204);
    } else if (who !== null) {
      await signInPoolUser(context, who);
    }
    const page = await context.newPage();
    return { context, page, api: watchApi(page) };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** #41 `PATCH /api/users/:id/role` as admin (body `{userId, role}`); returns the status. */
export async function setUserRole(admin: APIRequestContext, user: PoolUser, role: 'admin' | 'engineer' | 'viewer'): Promise<number> {
  return (await admin.patch(`/api/users/${user.id}/role`, { data: { userId: user.id, role } })).status();
}

/* ---------------------------------------------------------------- one-wall layer + mobile viewer + Pascal */

/** QC:wall-one: one 220 mm load-bearing wall (0,0)→(6000,0), h 3000, no rooms (SCR-27 partial; a centre tap hits the wall). */
export function wallOne(levelId: string): Json {
  return {
    walls: [
      {
        confidence: 0.9,
        reviewed: false,
        source: 'ai',
        centreline: { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } },
        heightMm: 3000,
        id: `W-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`,
        kind: 'loadBearing',
        levelId,
        openingIds: [],
        thicknessMm: 220,
      },
    ],
    openings: [],
    rooms: [],
    furniture: [],
  };
}

/** QC:wall-one project (1 floor, {@link wallOne} written through #35); returns the project id. */
export async function seedWallOne(admin: APIRequestContext, slug: string): Promise<string> {
  const project = await createProject(admin, slug, 1);
  const floor = project.floors[0];
  if (floor === undefined) throw new Error('setup: project has no floor');
  await writeLayer(layerApiOfAdmin(admin), project.projectId, floor.id, wallOne);
  return project.projectId;
}

/** On the login page: fills the form as `user` and waits until the URL is `destination` (path + search). */
export async function signInViaForm(page: Page, user: PoolUser, destination: string): Promise<void> {
  await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(user.email);
  await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(user.password);
  const login = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/login');
  await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();
  expect((await login).status(), 'POST /api/auth/login').toBe(204);
  await expect.poll(() => pathOf(page.url())).toBe(destination);
}

export const mobileRegion = (page: Page): Locator => page.getByRole('region', { name: MV.region, exact: true });
const mobileSheet = (page: Page): Locator => page.getByRole('dialog', { name: MV.sheet, exact: true });
const wallTitle = (page: Page): Locator => mobileSheet(page).getByRole('heading', { name: /^Tường / });
/** Anything that ends the mobile load: built / partial note, or a covering state (forbidden, empty, not found). */
const mobileSettled = (page: Page): Locator =>
  page
    .getByText(MV.built, { exact: true })
    .or(page.getByText(MV.partial))
    .or(page.getByText(MV.forbidden, { exact: true }))
    .or(page.getByText(MV.empty, { exact: true }))
    .or(page.getByText(GATE.notFoundTitle, { exact: true }));

/** `/m/du-an/:p` until the state layer says something final (the mobile build of a wall-only model is "partial"). */
export async function openMobile(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.mobileViewer(projectId));
  await expect(mobileSettled(page).first()).toBeAttached({ timeout: SCENE_TIMEOUT_MS });
}

/**
 * Taps the middle of the mobile region, then rows above/below it, until the info sheet shows a "Tường …" title.
 * UNKNOWN — NEED VERIFICATION: tap geometry of the one-wall model on the phone camera was not run in S3.
 */
export async function tapWall(page: Page): Promise<void> {
  const box = await mobileRegion(page).boundingBox();
  if (box === null) throw new Error('mobile region has no bounding box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (const dy of [0, -8, 8, -16, 16, -32, 32, -48, 48, -64, 64]) {
    await page.touchscreen.tap(cx, cy + dy);
    if (await visibleWithin(wallTitle(page), 1_500)) return;
  }
  throw new Error('UNKNOWN — NEED VERIFICATION: no tap near the centre selected the wall');
}

export const inviteText = (page: Page): Locator => mobileSheet(page).getByText(MV.invite, { exact: true });
export const sendLinkButton = (page: Page): Locator => page.getByRole('button', { name: MV.sendLink, exact: true });
export const sheetRow = (page: Page, label: string): Locator => mobileSheet(page).locator('dt').filter({ hasText: label });

// dup-of: viewer.ts openPascal
/** `/3d` (Pascal) until its caption says the drawing is built; the lazy EditorTour is dismissed afterwards. */
export async function openPascal(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.project.viewer(projectId));
  await expect(page.locator('section[aria-label="Mô hình 3D"] > p[role="status"]')).toHaveText(PASCAL_RENDERED, { timeout: PASCAL_RENDER_TIMEOUT_MS });
  await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
}

/** Pascal's bottom action menu mounts its "Select" button only for an editor (`readOnly` hides the menu): vendor action-menu/index.tsx:38, control-modes.tsx:117. */
export const pascalEditCue = (page: Page): Locator => page.locator('[data-guide-target="mode-select"]');

/** No request of the page since `mark` other than GET/HEAD, refresh and telemetry (what a reader may never send). */
export function writesSince(log: readonly { method: string; path: string; status: number }[], mark: number): string[] {
  return log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.method !== 'HEAD' && entry.path !== '/api/auth/refresh' && !entry.path.startsWith('/api/telemetry'))
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);
}
