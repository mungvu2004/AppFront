/**
 * Phase 4: QC layers (E2E-TEST-PLAN.md v2, §4 Phase 4), Track A, admin.
 * SCR-16 → SCR-17 → SCR-18 → SCR-19 → SCR-20 → SCR-21 → SCR-14 → SCR-22, matrix row order.
 *
 * Needs (runtime-session.json): project.projectId, floors.workFloorId, checkpoints.pipelineComplete (CP-5).
 * Produces: checkpoints.restorableVersion (CP-6) after the SCR-16 approve PUT returns 200.
 *
 * Contracts verified in source (c4978eb4):
 * - Layer read/write: `GET|PUT /api/projects/:p/floors/:f/spatial/layer` (`api/endpoints.ts` spatial.layer).
 *   PUT body `{baseVersion, body: {layer?, scaleMillimetresPerPixel?}}` (`schemas/spatialLayer.ts`
 *   FloorLayerWriteSchema), response `FloorLayerWriteResultSchema`. Autosave 800 ms after the last
 *   change (`hooks/useAutosave.ts`); Ctrl+S = `global.save` → `flushAutosaves()` (`router.tsx`).
 * - Walls: listbox "Danh sách đoạn tường" is VIRTUALISED (`WallLayerList.tsx`); option name
 *   `${codeLabel} — ${status}`. codeLabel = `#${displayCodesOf(ids).get(id)}` (`wallLayerReviewGateway.ts`
 *   wallLabelOf, `domain/spatial/ids.ts`), order-independent, so it is derived here from the GET body.
 *   Keys J/K/Backspace/Mod+Z are `canvas` scope (`useWallLayerReview.ts`). Merge = ctrl-click a 2nd row
 *   (`onToggleSelect`), rail button "nối đoạn" (disabled name "nối đoạn — Chọn hai đoạn tường để gộp").
 *   Merge rules (`domain/walls/edit.ts` mergeWalls): same kind, thickness, elevations; angle < 2°;
 *   off-axis stray ≤ thickness/2. Delete toast "Đã xoá tường {code}." + "Hoàn tác" (region "Thông báo").
 * - Objects: subtype/swing commands only for openings (`useObjectLayerReview.ts`: `'wallId' in before`),
 *   subtype not for orphans. Canvas `<g aria-label={codeLabel}>` has the context menu ("Xoá").
 * - Dimensions (F-08) and axes: no persistence path; the hooks still say "saved".
 * - Scale: "Áp cho mọi tầng" is a scope option; "Áp dụng tỷ lệ" then reads #12 floors + N15 graph and
 *   opens the A9 dialog "Áp tỉ lệ này cho N tầng có bản vẽ?" (`useScaleCalibration.ts` onApply).
 * - Checkbox/Radio.Item are `sr-only` inputs under a drawn box: driven by focus + Space, the proven
 *   path of `e2e/v7/thickness-standardization.spec.ts`.
 */
import { expect, test, type BrowserContext, type Locator, type Page, type Response } from '@playwright/test';

import { FloorLayerWriteResultSchema } from '../../src/api/schemas/spatialLayer';
import { displayCodesOf } from '../../src/domain/spatial/ids';
import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import {
  navigateThenWaitForApi,
  waitForApi,
  waitForApiWhere,
  watchApi,
  type ApiResult,
} from '../../e2e/fullstack/apiWatch';
import { ACTION_TIMEOUT_MS, AUTOSAVE_TIMEOUT_MS, NAVIGATION_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { readState, requireState, updateState } from './support/state';

test.describe.configure({ mode: 'serial' });

const VIEWPORT = { width: 1440, height: 900 } as const;

/**
 * "Nothing was written" has no network signal: wait past the 800 ms autosave debounce (G5) plus a
 * round trip, then count the write requests. Used ONLY by the no-PUT assertions.
 */
const NO_WRITE_SETTLE_MS = 1_500;

/** `domain/walls/edit.ts` MAX_MERGE_ANGLE_DEG (2°); a tighter margin here so the pick is unambiguous. */
const MERGE_MAX_ANGLE_DEG = 1;
const ENDPOINT_TOLERANCE_MM = 1;

const WALL_NO_MATCH =
  'Không có đoạn tường nào khớp bộ lọc đang bật. Bỏ bớt một bộ lọc để thấy lại danh sách.';
const SCALE_HANDLE_START = 'Đầu đoạn tham chiếu, dùng phím mũi tên để nhích';
const SCALE_HANDLE_END = 'Cuối đoạn tham chiếu, dùng phím mũi tên để nhích';
const OVERLAY_DIVIDER = 'Đường chia đôi, dùng phím mũi tên trái và phải để dịch';
const RENAMED_ROOM = 'Phòng E2E QA';

/* ---- phase-local helpers (minimal copies of chain.fullstack.ts) ---- */

type Json = Record<string, unknown>;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what}: body is not a JSON object`);
  }
  return value as Json;
};

const arrayOf = (value: unknown, what: string): Json[] => {
  if (!Array.isArray(value)) throw new Error(`${what}: not an array`);
  return value.map((item, index) => asRecord(item, `${what}[${String(index)}]`));
};

const layerOf = (body: unknown, what: string): Json => asRecord(asRecord(body, what).layer, `${what}.layer`);
const wallsOf = (body: unknown, what: string): Json[] => arrayOf(layerOf(body, what).walls, `${what}.layer.walls`);

const wallById = (walls: readonly Json[], id: string, what: string): Json => {
  const wall = walls.find((candidate) => candidate.id === id);

  if (wall === undefined) throw new Error(`${what}: no wall ${id}`);
  return wall;
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const pathnameOf = (page: Page): string => new URL(page.url()).pathname;

/** `${code} — ${status}` (walls, objects): the code part. */
async function codeOfOption(option: Locator): Promise<string> {
  const code = ((await option.getAttribute('aria-label')) ?? '').split(' — ')[0]?.trim() ?? '';

  if (code === '') throw new Error('option has no "<code> — <status>" aria-label');
  return code;
}

/** Checkbox / Radio.Item: focus + Space (sr-only input under a drawn box). */
async function pressSpaceOn(control: Locator): Promise<void> {
  await control.focus();
  await control.page().keyboard.press('Space');
}

/** Custom `Select` (`components/ui/Select.tsx`): the open listbox is the trigger's `aria-controls`. */
async function openSelect(page: Page, trigger: Locator): Promise<Locator> {
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const id = await trigger.getAttribute('aria-controls');

  if (id === null || id === '') throw new Error('select trigger has no aria-controls once open');
  return page.locator(`[id="${id}"]`);
}

/* ---- shared session ---- */

interface WriteRequest {
  readonly method: string;
  readonly path: string;
}

let context: BrowserContext;
let page: Page;
let projectId: string;
let workFloorId: string;
/** Every non-GET request under `/api/projects/` (request time, not response time). */
const writes: WriteRequest[] = [];
let tourPending = true;

test.beforeAll(async ({ browser }) => {
  projectId = requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2 (SCR-05)');
  workFloorId = requireState((s) => s.floors.workFloorId, 'floors.workFloorId', 'Phase 3 (SCR-09)');
  requireState((s) => s.checkpoints.pipelineComplete, 'checkpoints.pipelineComplete (CP-5)', 'Phase 3 (SCR-12)');

  context = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  page = await context.newPage();
  // Before the first goto: bodies are read on arrival (apiWatch), writes are counted on request.
  watchApi(page);
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;

    if (request.method() !== 'GET' && path.startsWith('/api/projects/')) {
      writes.push({ method: request.method(), path });
    }
  });
  await signInAdmin(page);
});

test.afterAll(async () => {
  await context?.close();
});

const layerPath = (floorId: string = workFloorId): RegExp =>
  new RegExp(`^/api/projects/${projectId}/floors/${floorId}/spatial/layer$`, 'u');

const isLayerPut = (response: Response): boolean =>
  response.request().method() === 'PUT' && layerPath().test(new URL(response.url()).pathname);

/** Next `PUT …/spatial/layer` (any status) whose sent `body` passes `sent`. Register BEFORE the action. */
function waitForLayerPut(sent?: (body: Json) => boolean): Promise<ApiResult> {
  return waitForApiWhere(
    page,
    (response) => {
      if (!isLayerPut(response)) return false;
      if (sent === undefined) return true;
      try {
        return sent(asRecord(asRecord(response.request().postDataJSON(), '#35').body, '#35.body'));
      } catch {
        return false;
      }
    },
    AUTOSAVE_TIMEOUT_MS,
    'PUT …/spatial/layer',
  );
}

/** 200 + (optionally) the write-result schema; returns the sent `body`. */
function expectLayerWrite(result: ApiResult, { parseResult = true }: { readonly parseResult?: boolean } = {}): Json {
  expect(result.response.status(), 'PUT …/spatial/layer').toBe(200);
  if (parseResult) FloorLayerWriteResultSchema.parse(result.json);
  return asRecord(asRecord(result.response.request().postDataJSON(), '#35').body, '#35.body');
}

async function expectNoProjectWritesSince(mark: number, what: string): Promise<void> {
  // G5 exception: no network signal exists for "nothing sent"; see NO_WRITE_SETTLE_MS.
  await page.waitForTimeout(NO_WRITE_SETTLE_MS);
  const sent = writes.slice(mark).map((entry) => `${entry.method} ${entry.path}`);

  expect(sent, `${what}: no write request (PUT/POST/PATCH/DELETE) expected`).toEqual([]);
}

/** Opens a layer screen with a fresh page load and returns the N16 body it read. */
async function openLayerScreen(url: string): Promise<unknown> {
  const read = await navigateThenWaitForApi(
    page,
    () => page.goto(url, { waitUntil: 'commit' }),
    'GET',
    layerPath(),
    [200],
  );

  return read.json;
}

/* ======================================================================== */
/* SCR-16 Wall Layer Review                                                  */
/* ======================================================================== */

const wallList = (): Locator => page.getByRole('listbox', { name: 'Danh sách đoạn tường', exact: true });
const selectedWall = (): Locator => wallList().getByRole('option', { selected: true });
const wallOption = (code: string): Locator =>
  wallList().getByRole('option', { name: new RegExp(`^${escapeRegExp(code)} — `, 'u') });
/** `WallLayerInspector.tsx`: root > div.h-14 > h3 "Đoạn tường". */
const wallInspector = (): Locator =>
  page.getByRole('heading', { name: 'Đoạn tường', exact: true, level: 3 }).locator('xpath=../..');
const approveWallButton = (): Locator => page.getByRole('button', { name: 'Duyệt đoạn này', exact: true });
const thicknessGroup = (): Locator => page.getByRole('radiogroup', { name: 'Độ dày tường', exact: true });
const wallRail = (): Locator => page.getByRole('toolbar', { name: 'Công cụ lớp tường', exact: true });

/** GET body of the last walls load, and its code ↔ id tables. */
let walls: Json[] = [];
let wallIdByCode = new Map<string, string>();
let wallCodeById = new Map<string, string>();
let approvedWallId: string | null = null;
let thicknessEdit: { code: string; id: string; originalMm: unknown; targetLabel: string } | null = null;

function indexWalls(next: Json[]): void {
  walls = next;
  const ids = next.map((wall, index) => {
    if (typeof wall.id !== 'string') throw new Error(`N16 walls[${String(index)}] has no id`);
    return wall.id;
  });
  const codes = displayCodesOf(ids);

  wallCodeById = new Map(ids.map((id) => [id, `#${codes.get(id) ?? id}`] as const));
  wallIdByCode = new Map([...wallCodeById].map(([id, code]) => [code, id] as const));
}

const wallIdOf = (code: string): string => {
  const id = wallIdByCode.get(code);

  if (id === undefined) throw new Error(`no wall in the N16 body has the list code ${code}`);
  return id;
};

async function openWalls(floorId: string = workFloorId): Promise<Json[]> {
  const read = await navigateThenWaitForApi(
    page,
    () => page.goto(ROUTES.project.walls(projectId, floorId), { waitUntil: 'commit' }),
    'GET',
    layerPath(floorId),
    [200],
  );
  const loaded = wallsOf(read.json, 'N16');

  await expect(page.getByRole('region', { name: 'Duyệt lớp tường', exact: true })).toBeVisible();
  if (loaded.length > 0) await expect(wallList().getByRole('option').first()).toBeVisible();
  // G6: the tour mounts lazily on the first visit; later visits only re-check.
  await dismissTour(page, { waitMs: tourPending ? TOUR_APPEAR_TIMEOUT_MS : 0 });
  tourPending = false;
  if (floorId === workFloorId) indexWalls(loaded);
  return loaded;
}

/** Brings a row of the virtualised list into the DOM by scrolling its scroll parent. */
async function revealWallOption(code: string): Promise<Locator> {
  const option = wallOption(code);
  const scrollTo = (top: number): Promise<{ height: number; step: number } | null> =>
    wallList().evaluate(async (node, value) => {
      let parent: HTMLElement | null = node.parentElement;

      while (parent !== null && !/(auto|scroll)/u.test(getComputedStyle(parent).overflowY)) {
        parent = parent.parentElement;
      }
      if (parent === null) return null;
      parent.scrollTop = value;
      // Two frames: the virtualiser re-renders on the scroll event.
      await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      return { height: parent.scrollHeight, step: Math.max(40, Math.floor(parent.clientHeight / 2)) };
    }, top);

  const metrics = await scrollTo(0);

  if (metrics === null) throw new Error('wall list has no scroll parent');
  for (let top = 0; top <= metrics.height; top += metrics.step) {
    if (top > 0) await scrollTo(top);
    if ((await option.count()) > 0) return option;
  }
  throw new Error(`wall row ${code} never rendered while scrolling the list`);
}

interface Point {
  readonly x: number;
  readonly y: number;
}
interface WireWall {
  readonly id: string;
  readonly kind: string;
  readonly thicknessMm: number;
  readonly heightMm: number;
  readonly start: Point;
  readonly end: Point;
  readonly openings: number;
}

const pointOf = (value: unknown): Point | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { x, y } = value as Json;

  return typeof x === 'number' && typeof y === 'number' ? { x, y } : null;
};

/** Wire `Wall` (`schemas/spatial.ts` WallSchema) → the fields the merge rule reads. */
function toWireWall(wall: Json): WireWall | null {
  const centreline = wall.centreline as Json | undefined;
  const start = pointOf(centreline?.start);
  const end = pointOf(centreline?.end);

  if (
    typeof wall.id !== 'string' ||
    typeof wall.kind !== 'string' ||
    typeof wall.thicknessMm !== 'number' ||
    typeof wall.heightMm !== 'number' ||
    start === null ||
    end === null
  ) {
    return null;
  }
  return {
    id: wall.id,
    kind: wall.kind,
    thicknessMm: wall.thicknessMm,
    heightMm: wall.heightMm,
    start,
    end,
    openings: Array.isArray(wall.openingIds) ? wall.openingIds.length : 0,
  };
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Two collinear walls that share an endpoint and pass `mergeWalls` (`domain/walls/edit.ts`). */
function findMergePair(all: readonly Json[]): readonly [WireWall, WireWall] | null {
  const candidates = all.map(toWireWall).filter((wall): wall is WireWall => wall !== null);
  const pairs: [WireWall, WireWall][] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];

      if (a === undefined || b === undefined) continue;
      if (a.kind !== b.kind || a.thicknessMm !== b.thicknessMm || a.heightMm !== b.heightMm) continue;
      const shared = [a.start, a.end].some((p) => [b.start, b.end].some((q) => distance(p, q) <= ENDPOINT_TOLERANCE_MM));

      if (!shared) continue;
      const ax = a.end.x - a.start.x;
      const ay = a.end.y - a.start.y;
      const bx = b.end.x - b.start.x;
      const by = b.end.y - b.start.y;
      const cos = Math.abs(ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
      const angleDeg = (Math.acos(Math.min(1, cos)) * 180) / Math.PI;

      if (angleDeg >= MERGE_MAX_ANGLE_DEG) continue;
      // Off-axis distance of b's endpoints from a's line ≤ thickness/4 (rule allows thickness/2).
      const length = Math.hypot(ax, ay);
      const offAxis = (p: Point): number => Math.abs((p.x - a.start.x) * ay - (p.y - a.start.y) * ax) / length;

      if (Math.max(offAxis(b.start), offAxis(b.end)) > a.thicknessMm / 4) continue;
      pairs.push([a, b]);
    }
  }
  // Prefer walls without openings: fewer moving parts in the merge command.
  pairs.sort((p, q) => p[0].openings + p[1].openings - (q[0].openings + q[1].openings));
  return pairs[0] ?? null;
}

test.describe('SCR-16 Wall Layer Review', () => {
  test('SCR-16 select: option in "Danh sách đoạn tường", then J / K with focus on the list → inspector "Đoạn tường" follows', async () => {
    await openWalls();
    expect(walls.length, 'N16 layer.walls of the work floor (CP-5)').toBeGreaterThan(0);

    const first = wallList().getByRole('option').first();

    await first.click();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    const firstCode = await codeOfOption(first);

    await expect(wallInspector().getByText(firstCode, { exact: true })).toBeVisible();

    if (walls.length > 1) {
      // Focus is on the clicked row (tabIndex 0), not an input: canvas-scope J/K are live (G5).
      await page.keyboard.press('j');
      await expect(wallOption(firstCode)).toHaveAttribute('aria-selected', 'false');
      const nextCode = await codeOfOption(selectedWall());

      expect(nextCode).not.toBe(firstCode);
      await expect(wallInspector().getByText(nextCode, { exact: true })).toBeVisible();

      await page.keyboard.press('k');
      await expect(wallOption(firstCode)).toHaveAttribute('aria-selected', 'true');
      await expect(wallInspector().getByText(firstCode, { exact: true })).toBeVisible();
    } else {
      test.info().annotations.push({ type: 'branch', description: 'one wall only: J/K have no neighbour' });
    }
    await captureEvidence(page, '16_walls_select.png');
  });

  test('SCR-16 approve: "Duyệt đoạn này" on an unapproved wall → PUT …/spatial/layer 200, status changes, auto-advances, no "Lưu" (CP-6)', async () => {
    const unreviewed = walls.filter((wall) => wall.reviewed !== true).length;

    expect(unreviewed, 'an unapproved wall in the N16 body').toBeGreaterThan(0);
    if ((await selectedWall().count()) === 0) await wallList().getByRole('option').first().click();
    for (let step = 0; await approveWallButton().isDisabled(); step += 1) {
      if (step > walls.length) throw new Error('J never reached an unapproved wall');
      await selectedWall().focus();
      await page.keyboard.press('j');
    }

    const code = await codeOfOption(selectedWall());
    const id = wallIdOf(code);
    const put = waitForLayerPut();

    await approveWallButton().click();
    // A7 — no save button.
    await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0);
    const sent = expectLayerWrite(await put);

    expect(wallById(wallsOf(sent, '#35'), id, '#35').reviewed, `#35 wall ${code} reviewed`).toBe(true);
    approvedWallId = id;
    updateState((draft) => {
      draft.checkpoints.restorableVersion = true;
    });

    await expect(wallOption(code)).toHaveAccessibleName(`${code} — Đã duyệt`);
    if (unreviewed > 1) await expect(wallOption(code)).toHaveAttribute('aria-selected', 'false');
    await captureEvidence(page, '16_walls_approved.png');
  });

  test('SCR-16 thickness: first radio{checked:false} in "Độ dày tường" → PUT, thickness updates', async () => {
    const code = await codeOfOption(selectedWall());
    const id = wallIdOf(code);
    const target = thicknessGroup().getByRole('radio', { checked: false }).first();
    const targetLabel = (await target.innerText()).trim();
    const targetMm = Number.parseInt(targetLabel, 10);

    expect(Number.isFinite(targetMm), `thickness option "${targetLabel}"`).toBe(true);
    const put = waitForLayerPut((body) => wallById(wallsOf(body, '#35'), id, '#35').thicknessMm === targetMm);

    await target.click();
    expectLayerWrite(await put);
    await expect(thicknessGroup().getByRole('radio', { name: targetLabel, exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    thicknessEdit = { code, id, originalMm: wallById(walls, id, 'N16').thicknessMm, targetLabel };
    await captureEvidence(page, '16_walls_thickness.png');
  });

  test('SCR-16 undo + flush: Mod+Z (canvas focus), then Ctrl+S → edit reverted, PUT flushed', async () => {
    if (thicknessEdit === null) throw new Error('needs the SCR-16 thickness row');
    const edit = thicknessEdit;

    // Canvas-scope Mod+Z is inert inside inputs: focus the selected row (G5).
    await wallOption(edit.code).focus();
    const put = waitForLayerPut(
      (body) => wallById(wallsOf(body, '#35'), edit.id, '#35').thicknessMm === edit.originalMm,
    );

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+s');
    expectLayerWrite(await put);
    await expect(thicknessGroup().getByRole('radio', { name: edit.targetLabel, exact: true })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await captureEvidence(page, '16_walls_undo_flush.png');
  });

  test('SCR-16 view controls: filters, "Hiện tim tường", "Ẩn lớp tường", "Thu gọn hai panel", "Bỏ qua" (no PUT)', async () => {
    const toggle = async (name: string): Promise<void> => {
      const box = page.getByRole('checkbox', { name, exact: true });
      const was = await box.isChecked();

      await pressSpaceOn(box);
      await expect(box).toBeChecked({ checked: !was });
    };

    await toggle('Chỉ hiện chưa duyệt');
    await expect(wallList().getByRole('option', { name: / — Đã duyệt$/u })).toHaveCount(0);
    await toggle('Chỉ hiện chưa duyệt');

    await toggle('Chỉ hiện độ tin cậy thấp');
    await expect(wallList().or(page.getByText(WALL_NO_MATCH, { exact: true })).first()).toBeVisible();
    await toggle('Chỉ hiện độ tin cậy thấp');

    await toggle('Hiện tim tường');
    await toggle('Hiện tim tường');

    await page.getByRole('button', { name: 'Ẩn lớp tường', exact: true }).click();
    const showLayer = page.getByRole('button', { name: 'Hiện lớp tường', exact: true });

    await expect(showLayer).toHaveAttribute('aria-pressed', 'false');
    await showLayer.click();
    await expect(page.getByRole('button', { name: 'Ẩn lớp tường', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Thu gọn hai panel', exact: true }).click();
    await expect(wallList()).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Đoạn tường', exact: true })).toHaveCount(0);
    await captureEvidence(page, '16_walls_view_controls.png');
    await page.getByRole('button', { name: 'Mở lại hai panel', exact: true }).click();
    await expect(wallList()).toBeVisible();

    if ((await selectedWall().count()) === 0) await wallList().getByRole('option').first().click();
    const before = await codeOfOption(selectedWall());
    const beforeId = wallIdOf(before);
    const isUnreviewed = (wall: Json): boolean => wall.reviewed !== true && wall.id !== approvedWallId;
    const remaining = walls.filter(isUnreviewed).length;
    const selectedIsUnreviewed = isUnreviewed(wallById(walls, beforeId, 'N16'));
    const moves = selectedIsUnreviewed ? remaining >= 2 : remaining >= 1;
    const mark = writes.length;

    // Exact: the tour's own skip is "Bỏ qua hướng dẫn" (G6).
    await page.getByRole('button', { name: 'Bỏ qua', exact: true }).click();
    if (moves) await expect(wallOption(before)).toHaveAttribute('aria-selected', 'false');
    await expectNoProjectWritesSince(mark, 'SCR-16 "Bỏ qua"');
  });

  test('SCR-16 merge: two collinear walls sharing an endpoint (from the GET body), ctrl-click both, "nối đoạn" → merge + PUT', async () => {
    const current = await openWalls();
    const pair = findMergePair(current);

    await wallList().getByRole('option').first().click();
    await expect(
      wallRail().getByRole('button', { name: 'nối đoạn — Chọn hai đoạn tường để gộp', exact: true }),
    ).toBeDisabled();

    if (pair === null) {
      await captureEvidence(page, '16_walls_merge.png');
      test.skip(true, 'data-dependent: the real N16 layer has no collinear same-kind/thickness walls sharing an endpoint');
      return;
    }
    const [a, b] = pair;
    const codeA = wallCodeById.get(a.id);
    const codeB = wallCodeById.get(b.id);

    if (codeA === undefined || codeB === undefined) throw new Error('merge pair has no list code');
    test.info().annotations.push({ type: 'merge-pair', description: `${codeA} + ${codeB}` });

    await (await revealWallOption(codeA)).click();
    await (await revealWallOption(codeB)).click({ modifiers: ['Control'] });
    const merge = wallRail().getByRole('button', { name: 'nối đoạn', exact: true });

    await expect(merge).toBeEnabled();
    const put = waitForLayerPut((body) => wallsOf(body, '#35').length === current.length - 1);

    await merge.click();
    const sent = expectLayerWrite(await put);

    expect(wallsOf(sent, '#35').length, 'one wall fewer after the merge').toBe(current.length - 1);
    await captureEvidence(page, '16_walls_merge.png');
  });

  test('SCR-16 delete + undo: select a wall, Backspace (canvas focus), then "Hoàn tác" → removed, then restored', async () => {
    await openWalls();
    const first = wallList().getByRole('option').first();

    await first.click();
    const code = await codeOfOption(first);
    const id = wallIdOf(code);

    await page.keyboard.press('Backspace');
    await expect(wallOption(code)).toHaveCount(0);
    const toasts = page.getByRole('region', { name: 'Thông báo', exact: true });

    await expect(toasts.getByText(`Đã xoá tường ${code}.`, { exact: true })).toBeVisible();
    // The restored layer reaches the server: Ctrl+S flushes it (the delete's own PUT lacks the wall).
    const restored = waitForLayerPut((body) => wallsOf(body, '#35').some((wall) => wall.id === id));

    await toasts.getByRole('button', { name: 'Hoàn tác', exact: true }).last().click();
    await expect(wallOption(code)).toHaveCount(1);
    await page.keyboard.press('Control+s');
    expectLayerWrite(await restored);
    await captureEvidence(page, '16_walls_delete_undo.png');
  });

  test('SCR-16 layer nav: "Cây lớp" Cửa và nội thất / Kích thước / Trục / Phòng, then floor nav', async () => {
    test.setTimeout(240_000);
    const current = await openWalls();

    // `WallLayerLeftPanel.tsx`: the button only renders in state `success` (every wall approved).
    if (!current.every((wall) => wall.reviewed === true)) {
      await expect(page.getByRole('button', { name: 'Sang lớp cửa và nội thất', exact: true })).toHaveCount(0);
    }

    const targets: readonly (readonly [string, string])[] = [
      ['Cửa và nội thất', ROUTES.project.objects(projectId, workFloorId)],
      ['Kích thước', ROUTES.project.dimensions(projectId, workFloorId)],
      ['Trục', ROUTES.project.grids(projectId, workFloorId)],
      ['Phòng', ROUTES.project.rooms(projectId, workFloorId)],
    ];

    for (const [label, target] of targets) {
      if (pathnameOf(page) !== ROUTES.project.walls(projectId, workFloorId)) await openWalls();
      await page
        .getByRole('tree', { name: 'Cây lớp', exact: true })
        .getByRole('treeitem', { name: label, exact: true })
        .click();
      await expect.poll(() => pathnameOf(page), { message: `"Cây lớp" ${label}` }).toBe(target);
    }

    await openWalls();
    const floorNav = page.getByRole('navigation', { name: 'Tầng của bản vẽ', exact: true });
    const others = floorNav.locator('button:not([aria-current="page"])');
    const scratchName = readState().floors.scratchFloorName;
    const scratch = scratchName === null ? null : others.filter({ hasText: scratchName });
    const other = scratch !== null && (await scratch.count()) > 0 ? scratch.first() : others.first();

    if ((await floorNav.count()) === 0 || (await others.count()) === 0) {
      test.info().annotations.push({
        type: 'branch',
        description: 'floor nav lists no other floor (graph holds only the work floor level)',
      });
      await captureEvidence(page, '16_walls_layer_nav.png');
      return;
    }
    await other.click();
    await expect
      .poll(() => pathnameOf(page), { message: 'floor nav opens another floor’s walls' })
      .toMatch(new RegExp(`^/projects/${projectId}/floors/(?!${workFloorId}/)[^/]+/layers/walls$`, 'u'));
    await dismissTour(page);
    await captureEvidence(page, '16_walls_layer_nav.png');
  });
});

/* ======================================================================== */
/* SCR-17 Object Layer Review                                                */
/* ======================================================================== */

const objectGroup = (): Locator => page.getByRole('group', { name: 'Danh sách đối tượng', exact: true });
const objectOptions = (): Locator => objectGroup().getByRole('option');
const objectOption = (code: string): Locator =>
  objectGroup().getByRole('option', { name: new RegExp(`^${escapeRegExp(code)} — `, 'u') });
/** `ObjectLayerInspector.tsx`: root > div.h-14 > h3 "Đối tượng". */
const objectInspector = (): Locator =>
  page.getByRole('heading', { name: 'Đối tượng', exact: true, level: 3 }).locator('xpath=../..');
const OBJECTS_EMPTY = 'Chưa nhận ra đối tượng nào';

let objectCount = 0;

async function openObjects(): Promise<void> {
  const body = await openLayerScreen(ROUTES.project.objects(projectId, workFloorId));
  const layer = layerOf(body, 'N16');

  objectCount = arrayOf(layer.openings, 'N16.layer.openings').length + arrayOf(layer.furniture, 'N16.layer.furniture').length;
  await expect(page.getByRole('region', { name: 'Lớp đối tượng', exact: true })).toBeVisible();
  await dismissTour(page);
  if (objectCount > 0) await expect(objectOptions().first()).toBeVisible();
}

test.describe('SCR-17 Object Layer Review', () => {
  test('SCR-17 filter: "Lọc theo loại" chips, "Mở nhóm …", list option → inspector "Đối tượng"', async () => {
    await openObjects();
    if (objectCount === 0) {
      await expect(page.getByText(OBJECTS_EMPTY, { exact: true })).toBeVisible();
      await captureEvidence(page, '17_objects_filter.png');
      test.skip(true, 'data-dependent: N16 has no openings/furniture (fake ML); empty state asserted');
      return;
    }
    const total = await objectOptions().count();
    const chip = page.getByRole('group', { name: 'Lọc theo loại', exact: true }).getByRole('button').first();

    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => objectOptions().count()).toBeLessThanOrEqual(total);
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(objectOptions()).toHaveCount(total);

    const collapse = objectGroup().getByRole('button', { name: /^Gấp nhóm /u }).first();
    const groupName = ((await collapse.getAttribute('aria-label')) ?? '').replace(/^Gấp nhóm /u, '');

    await collapse.click();
    const expand = objectGroup().getByRole('button', { name: `Mở nhóm ${groupName}`, exact: true });

    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expand.click();
    await expect(objectGroup().getByRole('button', { name: `Gấp nhóm ${groupName}`, exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    const first = objectOptions().first();

    await first.click();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(objectInspector().getByText(await codeOfOption(first), { exact: true })).toBeVisible();
    await captureEvidence(page, '17_objects_filter.png');
  });

  test('SCR-17 edit: "Duyệt đối tượng này"; "hướng mở" → mở trái; "Loại đối tượng" → PUT per change', async () => {
    if (objectCount === 0) {
      await captureEvidence(page, '17_objects_edit.png');
      test.skip(true, 'data-dependent: no objects on the work floor');
      return;
    }
    const doors = page.getByRole('listbox', { name: 'Cửa đi', exact: true }).getByRole('option');
    const windows = page.getByRole('listbox', { name: 'Cửa sổ', exact: true }).getByRole('option');
    const isDoor = (await doors.count()) > 0;
    const isWindow = !isDoor && (await windows.count()) > 0;
    const target = isDoor ? doors.first() : isWindow ? windows.first() : objectOptions().first();

    await target.click();
    await expect(target).toHaveAttribute('aria-selected', 'true');

    const approve = objectInspector().getByRole('button', { name: 'Duyệt đối tượng này', exact: true });

    if (await approve.isEnabled()) {
      const put = waitForLayerPut();

      await approve.click();
      expectLayerWrite(await put);
      await expect(approve).toBeDisabled();
    } else {
      test.info().annotations.push({ type: 'branch', description: 'selected object was already approved' });
    }

    if (!isDoor && !isWindow) {
      test.info().annotations.push({
        type: 'branch',
        description: 'data-dependent: no door/window; swing and type are opening-only commands',
      });
      await captureEvidence(page, '17_objects_edit.png');
      return;
    }

    // Swing first, while the opening is still a door (`buildChangeObjectSwingCommand`); windows are skipped.
    if (isDoor) {
      const left = objectInspector().getByRole('radio', { name: 'mở trái', exact: true });
      const swing = (await left.isChecked())
        ? objectInspector().getByRole('radio', { name: 'mở phải', exact: true })
        : left;

      if (swing !== left) test.info().annotations.push({ type: 'branch', description: 'already "mở trái": set "mở phải"' });
      const put = waitForLayerPut();

      await pressSpaceOn(swing);
      expectLayerWrite(await put);
      await expect(swing).toBeChecked();
    }

    if ((await objectInspector().getByText('Chưa gắn vào tường nào', { exact: true }).count()) > 0) {
      test.info().annotations.push({ type: 'branch', description: 'orphan opening: subtype change is blocked' });
    } else {
      const typeBox = objectInspector().getByRole('combobox', { name: 'Loại đối tượng', exact: true });
      // The two conversions the canvas menu offers (`objectLayerSymbols.ts`): door → window, window → single door.
      const next = (await typeBox.innerText()).trim() === 'Cửa sổ' ? 'Cửa đơn' : 'Cửa sổ';
      const listbox = await openSelect(page, typeBox);
      const put = waitForLayerPut();

      await listbox.getByRole('option', { name: next, exact: true }).click();
      expectLayerWrite(await put);
      await expect(typeBox).toContainText(next);
    }
    await captureEvidence(page, '17_objects_edit.png');
  });

  test('SCR-17 delete + undo: right-click g[aria-label="<code>"], "Xoá", then status bar "Hoàn tác"', async () => {
    if (objectCount === 0) {
      await captureEvidence(page, '17_objects_delete_undo.png');
      test.skip(true, 'data-dependent: no objects on the work floor');
      return;
    }
    const code = await codeOfOption(objectOptions().first());

    await page.locator(`g[aria-label="${code}"]`).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Xoá', exact: true }).click();
    await expect(objectOption(code)).toHaveCount(0);

    await page
      .getByRole('status', { name: 'Thanh trạng thái', exact: true })
      .getByRole('button', { name: 'Hoàn tác', exact: true })
      .click();
    await expect(objectOption(code)).toHaveCount(1);
    await captureEvidence(page, '17_objects_delete_undo.png');
  });
});

/* ======================================================================== */
/* SCR-18 Dimension OCR Review                                               */
/* ======================================================================== */

test.describe('SCR-18 Dimension OCR Review', () => {
  test('SCR-18 local only: "Chưa duyệt"; "Giá trị kích thước <code>" + Enter; "Duyệt kích thước <code>" → saved, NO PUT (F-08)', async () => {
    await page.goto(ROUTES.project.dimensions(projectId, workFloorId));
    await dismissTour(page);
    const rows = page.getByRole('group', { name: 'Danh sách kích thước đọc được', exact: true }).getByRole('option');
    const empty = page.getByText('Chưa đọc được chuỗi kích thước nào', { exact: true });

    await expect(rows.first().or(empty).first()).toBeVisible();
    if (await empty.isVisible()) {
      await captureEvidence(page, '18_dims_local_only.png');
      test.skip(true, 'data-dependent: OCR read no dimension string (fake ML); empty state asserted');
      return;
    }

    await page
      .getByRole('radiogroup', { name: 'Lọc theo trạng thái duyệt', exact: true })
      .getByRole('radio', { name: 'Chưa duyệt', exact: true })
      .click();
    if ((await rows.count()) === 0) {
      await captureEvidence(page, '18_dims_local_only.png');
      test.skip(true, 'data-dependent: every dimension is already approved');
      return;
    }

    const mark = writes.length;
    const code = (await rows.first().getAttribute('aria-label')) ?? '';

    expect(code, 'dimension row code').not.toBe('');
    const value = page.getByLabel(`Giá trị kích thước ${code}`, { exact: true });
    const next = (await value.inputValue()).replace(/\D/gu, '') === '1234' ? '1235' : '1234';

    await value.fill(next);
    // Enter = blur + commit + approve (`DimensionOcrRow.tsx` DimensionValueField).
    await value.press('Enter');
    await expect(page.getByRole('button', { name: `Duyệt kích thước ${code}`, exact: true })).toHaveCount(0);

    const approveNext = page.getByRole('button', { name: /^Duyệt kích thước /u }).first();

    if ((await approveNext.count()) > 0) {
      const label = (await approveNext.getAttribute('aria-label')) ?? '';

      await approveNext.click();
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole('status').filter({ hasText: /^Đã lưu lúc \d{2}:\d{2}$/u })).toHaveCount(1);
    await expectNoProjectWritesSince(mark, 'SCR-18 dimensions (F-08)');
    await captureEvidence(page, '18_dims_local_only.png');
  });
});

/* ======================================================================== */
/* SCR-19 Axis Grid Manager                                                  */
/* ======================================================================== */

const AXIS_LABEL_PATTERN = /^Trục (.+?), cách trục kế là /u;

test.describe('SCR-19 Axis Grid Manager', () => {
  test('SCR-19 local only: "Thêm trục ngang"; "Ẩn trục X"; "Xoá trục X", then undo → in memory, NO PUT', async () => {
    await page.goto(ROUTES.project.grids(projectId, workFloorId));
    await dismissTour(page);
    const add = page.getByRole('button', { name: 'Thêm trục ngang', exact: true });
    const empty = page.getByText('Chưa có trục nào', { exact: true });

    await expect(add.or(empty).first()).toBeVisible();
    const mark = writes.length;

    if (await empty.isVisible()) {
      await expectNoProjectWritesSince(mark, 'SCR-19 empty grid');
      await captureEvidence(page, '19_grids_local_only.png');
      test.skip(true, 'data-dependent: no axis on the work floor; empty state asserted');
      return;
    }
    const axisRows = page.getByRole('option', { name: AXIS_LABEL_PATTERN });
    const labels = async (): Promise<string[]> =>
      (await axisRows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''))).map(
        (name) => AXIS_LABEL_PATTERN.exec(name)?.[1] ?? '',
      );
    const before = await labels();

    await add.click();
    await expect(axisRows).toHaveCount(before.length + 1);
    const added = (await labels()).find((label) => label !== '' && !before.includes(label));

    if (added === undefined) throw new Error('"Thêm trục ngang" added no new axis label');

    await page.getByRole('button', { name: `Ẩn trục ${added}`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Hiện trục ${added}`, exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await page.getByRole('button', { name: `Xoá trục ${added}`, exact: true }).click();
    await expect(axisRows).toHaveCount(before.length);
    await page
      .getByRole('region', { name: 'Thông báo', exact: true })
      .getByRole('button', { name: 'Hoàn tác', exact: true })
      .last()
      .click();
    await expect(axisRows).toHaveCount(before.length + 1);

    await expectNoProjectWritesSince(mark, 'SCR-19 axes');
    await captureEvidence(page, '19_grids_local_only.png');
  });
});

/* ======================================================================== */
/* SCR-20 Room Label Review                                                  */
/* ======================================================================== */

const roomOptions = (): Locator => page.getByRole('listbox', { name: 'Danh sách phòng', exact: true }).getByRole('option');
const roomsOf = (body: Json): Json[] => arrayOf(layerOf(body, '#35').rooms, '#35.layer.rooms');

let roomCount = 0;

test.describe('SCR-20 Room Label Review', () => {
  test('SCR-20 edit: option in "Danh sách phòng"; "Tên phòng"; "Công năng"; "Duyệt phòng này" → PUT layer', async () => {
    const body = await openLayerScreen(ROUTES.project.rooms(projectId, workFloorId));

    roomCount = arrayOf(layerOf(body, 'N16').rooms, 'N16.layer.rooms').length;
    await expect(page.getByRole('region', { name: 'Duyệt tên phòng', exact: true })).toBeVisible();
    await dismissTour(page);
    if (roomCount === 0) {
      await expect(page.getByRole('heading', { name: 'Chưa dò ra phòng nào' })).toBeVisible();
      await captureEvidence(page, '20_rooms_edit.png');
      test.skip(true, 'data-dependent: no room detected on the work floor (fake ML); empty state asserted');
      return;
    }

    await roomOptions().first().click();
    // Same locator as e2e/v7/room-label-review.spec.ts (getByLabel matches several nodes).
    const name = page.getByRole('textbox', { name: 'Tên phòng' });
    const newName = (await name.inputValue()) === RENAMED_ROOM ? `${RENAMED_ROOM} 2` : RENAMED_ROOM;
    const renamed = waitForLayerPut((sent) => roomsOf(sent).some((room) => room.name === newName));

    await name.fill(newName);
    await name.press('Enter');
    expectLayerWrite(await renamed);

    const usage = page.getByRole('combobox', { name: 'Công năng', exact: true });
    const currentUsage = (await usage.innerText()).trim();
    const listbox = await openSelect(page, usage);
    const nextUsage = (await listbox.getByRole('option').allInnerTexts())
      .map((text) => text.trim())
      .find((text) => text !== '' && text !== currentUsage);

    if (nextUsage === undefined) throw new Error('"Công năng" offers no other option');
    const usagePut = waitForLayerPut();

    await listbox.getByRole('option', { name: nextUsage, exact: true }).click();
    expectLayerWrite(await usagePut);
    await expect(usage).toContainText(nextUsage);

    const approve = page.getByRole('button', { name: 'Duyệt phòng này', exact: true });

    if (await approve.isEnabled()) {
      const put = waitForLayerPut();

      await approve.click();
      expectLayerWrite(await put);
      await expect(approve).toBeDisabled();
    } else {
      test.info().annotations.push({ type: 'branch', description: 'room already confirmed: approve disabled' });
    }
    await captureEvidence(page, '20_rooms_edit.png');
  });

  test('SCR-20 modals: "Chuẩn hoá tên" then "Huỷ"/"Đóng"; "Gộp phòng" then cancel → closed, NO PUT', async () => {
    if (roomCount === 0) {
      await captureEvidence(page, '20_rooms_modals_cancel.png');
      test.skip(true, 'data-dependent: no room on the work floor');
      return;
    }
    const mark = writes.length;

    await page.getByRole('button', { name: 'Chuẩn hoá tên', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Xem trước chuẩn hoá tên', exact: true });

    await expect(preview).toBeVisible();
    // "Huỷ" when names would change, "Đóng" otherwise (`RoomLabelNormalizePreview.tsx`).
    await preview.getByRole('button', { name: /^(Huỷ|Đóng)$/u }).click();
    await expect(preview).toHaveCount(0);

    const mergeButton = page.getByRole('button', { name: 'Gộp phòng', exact: true });

    if ((await mergeButton.count()) === 0) await roomOptions().first().click();
    await mergeButton.click();
    const merge = page.getByRole('dialog', { name: 'Gộp hai phòng', exact: true });

    await expect(merge).toBeVisible();
    await merge.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await expect(merge).toHaveCount(0);

    await expectNoProjectWritesSince(mark, 'SCR-20 modals');
    await captureEvidence(page, '20_rooms_modals_cancel.png');
  });
});

/* ======================================================================== */
/* SCR-21 Thickness Standardization                                          */
/* ======================================================================== */

test.describe('SCR-21 Thickness Standardization', () => {
  test('SCR-21 apply: slider "Ngưỡng giữa 110 mm và 220 mm"; tick "Đồng ý chuẩn hoá …"; "Xem trước" → "Áp dụng" → bulk PUT, "Hoàn tác"', async () => {
    // Group rows are `motion.tr` with layoutId: no click on a sliding row (as e2e/v7).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    try {
      await openLayerScreen(ROUTES.project.thickness(projectId, workFloorId));
      await expect(page.getByRole('heading', { name: 'Chuẩn hoá độ dày tường' })).toBeVisible();
      await dismissTour(page);

      const accept = page.getByRole('checkbox', { name: /^Đồng ý chuẩn hoá \d+ tường /u }).first();
      const noGroups = page.getByText('Chưa có nhóm nào để chuẩn hoá.', { exact: true });
      const noWalls = page.getByRole('heading', { name: 'Chưa có đoạn tường nào để chuẩn hoá' });

      await expect(accept.or(noGroups).or(noWalls).first()).toBeVisible();

      // Keyboard drag (A12): one bin right, one bin left; moving a threshold writes nothing.
      const slider = page.getByRole('slider', { name: 'Ngưỡng giữa 110 mm và 220 mm', exact: true });

      if ((await slider.count()) > 0) {
        const start = (await slider.getAttribute('aria-valuenow')) ?? '';

        await slider.focus();
        await page.keyboard.press('ArrowRight');
        await expect(slider).not.toHaveAttribute('aria-valuenow', start);
        await page.keyboard.press('ArrowLeft');
        await expect(slider).toHaveAttribute('aria-valuenow', start);
      }

      if ((await accept.count()) === 0) {
        await captureEvidence(page, '21_thickness_apply.png');
        test.skip(true, 'data-dependent: no non-standard wall group; empty state asserted');
        return;
      }

      await pressSpaceOn(accept);
      await expect(accept).toBeChecked();
      await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
      const put = waitForLayerPut();

      await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
      expectLayerWrite(await put);
      await expect(
        page.getByRole('region', { name: 'Thông báo', exact: true }).getByRole('button', { name: 'Hoàn tác', exact: true }).first(),
      ).toBeVisible();
      await captureEvidence(page, '21_thickness_apply.png');
    } finally {
      await page.emulateMedia({ reducedMotion: null });
    }
  });
});

/* ======================================================================== */
/* SCR-14 Scale Calibration                                                  */
/* ======================================================================== */

const scaleCanvas = (): Locator =>
  page.getByRole('group', { name: 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu', exact: true });
const scaleScope = (name: string): Locator =>
  page.getByRole('radiogroup', { name: 'Phạm vi áp tỷ lệ', exact: true }).getByRole('radio', { name, exact: true });
const applyScale = (): Locator => page.getByRole('button', { name: 'Áp dụng tỷ lệ', exact: true });

/** Fresh load, method "Vẽ đường tham chiếu", box-relative drag 20 % → 80 % at 50 %, 5000 mm + Enter. */
async function openScaleAndDraw(): Promise<void> {
  await openLayerScreen(ROUTES.project.scale(projectId, workFloorId));
  await dismissTour(page);
  await expect(scaleCanvas()).toBeVisible();
  await page
    .getByRole('radiogroup', { name: 'Chọn cách xác định tỷ lệ', exact: true })
    .getByRole('radio', { name: 'Vẽ đường tham chiếu', exact: true })
    .click();

  const box = await scaleCanvas().boundingBox();

  if (box === null) throw new Error('scale canvas has no bounding box');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: SCALE_HANDLE_START, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: SCALE_HANDLE_END, exact: true })).toBeVisible();

  const realLength = page.getByLabel('Chiều dài thật', { exact: true });

  await realLength.fill('5000');
  await realLength.press('Enter');
  await expect(page.getByLabel('Phép tính ra tỷ lệ', { exact: true })).toContainText('mm/px');
}

test.describe('SCR-14 Scale Calibration', () => {
  test('SCR-14 refline: "Vẽ đường tham chiếu"; drag 20 % → 80 % at 50 %; "Chiều dài thật" = 5000 + Enter → two handles, scale computed', async () => {
    await openScaleAndDraw();
    await expect(applyScale()).toBeEnabled();
    await captureEvidence(page, '14_scale_refline.png');
  });

  test('SCR-14 apply: "Chỉ áp cho tầng này", then "Áp dụng tỷ lệ" → PUT …/spatial/layer, "Đã áp tỷ lệ cho bản vẽ"', async () => {
    await scaleScope('Chỉ áp cho tầng này').click();
    await expect(scaleScope('Chỉ áp cho tầng này')).toHaveAttribute('aria-checked', 'true');
    const put = waitForLayerPut((body) => typeof body.scaleMillimetresPerPixel === 'number');

    await applyScale().click();
    // Scale-only body (`FloorLayerWriteBodySchema`); the result schema is only proven for layer writes.
    const sent = expectLayerWrite(await put, { parseResult: false });

    expect(sent.scaleMillimetresPerPixel as number).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: 'Đã áp tỷ lệ cho bản vẽ' })).toBeVisible();
    await captureEvidence(page, '14_scale_applied.png');
  });

  test('SCR-14 all floors: "Áp cho mọi tầng", then "Huỷ" in "Áp tỉ lệ này cho N tầng có bản vẽ?" → GET floors + spatial, NO PUT', async () => {
    await openScaleAndDraw();
    await scaleScope('Áp cho mọi tầng').click();
    await expect(scaleScope('Áp cho mọi tầng')).toHaveAttribute('aria-checked', 'true');

    const mark = writes.length;
    const floorsRead = waitForApi(page, 'GET', new RegExp(`^/api/projects/${projectId}/floors$`, 'u'), [200]);
    const graphRead = waitForApi(page, 'GET', new RegExp(`^/api/projects/${projectId}/spatial$`, 'u'), [200]);

    await applyScale().click();
    await floorsRead;
    await graphRead;
    const dialog = page.getByRole('dialog', { name: /^Áp tỉ lệ này cho \d+ tầng có bản vẽ\?$/u });

    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    await expectNoProjectWritesSince(mark, 'SCR-14 "Áp cho mọi tầng" → "Huỷ"');
    await captureEvidence(page, '14_scale_all_cancel.png');
  });
});

/* ======================================================================== */
/* SCR-22 Overlay Comparison                                                 */
/* ======================================================================== */

test.describe('SCR-22 Overlay Comparison', () => {
  test('SCR-22 swipe: "Kiểu đối chiếu" → "Trượt"; divider slider + arrows; "Độ mờ ảnh nguồn" → divider moves, "Chưa đo được vùng lệch nào."', async () => {
    await page.goto(ROUTES.project.overlay(projectId, workFloorId));
    await dismissTour(page);
    await expect(page.getByRole('region', { name: 'Màn đối chiếu bản vẽ', exact: true })).toBeVisible();

    const swipe = page
      .getByRole('radiogroup', { name: 'Kiểu đối chiếu', exact: true })
      .getByRole('radio', { name: 'Trượt', exact: true });

    await expect(swipe).toBeVisible();
    if (await swipe.isDisabled()) {
      // `OverlayComparisonToolbar.tsx`: a disabled mode prints "<mode> — <reason>".
      await expect(page.getByText(/^Trượt — /u)).toBeVisible();
      await captureEvidence(page, '22_overlay_swipe.png');
      test.skip(true, 'data-dependent: swipe mode disabled for this floor; reason asserted');
      return;
    }
    await swipe.click();
    await expect(swipe).toHaveAttribute('aria-checked', 'true');

    const divider = page.getByRole('slider', { name: OVERLAY_DIVIDER, exact: true });

    await expect(divider).toBeVisible();
    const dividerStart = (await divider.getAttribute('aria-valuenow')) ?? '';

    await divider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(divider).not.toHaveAttribute('aria-valuenow', dividerStart);
    await page.keyboard.press('ArrowLeft');
    await expect(divider).toHaveAttribute('aria-valuenow', dividerStart);

    const opacity = page.getByRole('slider', { name: 'Độ mờ ảnh nguồn', exact: true });
    const opacityStart = (await opacity.getAttribute('aria-valuenow')) ?? '';

    await opacity.focus();
    await page.keyboard.press(Number(opacityStart) > 0 ? 'ArrowLeft' : 'ArrowRight');
    await expect(opacity).not.toHaveAttribute('aria-valuenow', opacityStart);

    await expect(page.getByText('Chưa đo được vùng lệch nào.', { exact: true })).toBeVisible();
    await captureEvidence(page, '22_overlay_swipe.png');
  });
});
