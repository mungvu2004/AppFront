/**
 * QA-04c pack P1 helpers (SCR-16 walls flows + X journeys). Owned by P1 only; the shared seeds stay in
 * `../layerSeed.ts`, `../drawingSeed.ts`, `../phase03Seed.ts` (re-used, not edited).
 *
 * - Seeds: {@link seedWalls} (QC:<name>: one project, a crafted wall layer per floor), {@link seedQc} (Q1/Q2/Q3, wraps
 *   `layerSeed.createQcProject`), {@link readWalls} (ids of the saved layer, in graph order, with their list codes).
 * - Session: {@link openWallsRun} (one signed-in context with the page, the request/response logs, a PUT log and an
 *   installed `page.clock` so "quiet" claims and timers are deterministic), {@link closeWallsRun}.
 * - Page: locators and actions of SCR-16 ({@link openWalls}, {@link wallOption}, {@link inspector}, ...).
 *
 * Wall ids are `W-<TAG><NNN>`: the tag is unique per call, NNN is the index, so `displayCodesOf` (sorted ids) gives
 * `#W-001`, `#W-002`, ... in creation order (src/domain/spatial/ids.ts:188-202).
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';

import { displayCodesOf } from '../../../../src/domain/spatial/ids';
import { ROUTES } from '../../../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../../../e2e/fixtures/tour';
import { navigateThenWaitForApi, waitForApiWhere, type ApiResult } from '../../../../e2e/fullstack/apiWatch';
import { AUTOSAVE_TIMEOUT_MS } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX, captureEvidence } from '../evidence';
import { createQcProject, writeLayer, type LayerApi } from '../layerSeed';
import { createStackProject, closeFlow, openFlow, type Credentials, type Flow } from '../p03/P5';
import { deleteSeededProject, listFloors, type SeededProject } from '../phase03Seed';

export type Json = Record<string, unknown>;
export const DESKTOP = { width: 1440, height: 900 } as const;
export const PROJECTS_API = '/api/projects';
/** Autosave fires 800 ms after the last change and at most 5 s after the first (createAutosave.ts DEFAULT_*). */
export const DEBOUNCE_MS = 800;
export const MAX_WAIT_MS = 5_000;
/** Longer than debounce + one round trip: "nothing was sent" claims run the clock this far, then wait for the network. */
export const QUIET_MS = 2_500;

export const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const pathOf = (page: Page): string => new URL(page.url()).pathname;
export const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};
export const asRecords = (value: unknown, what: string): Json[] => {
  if (!Array.isArray(value)) throw new Error(`${what}: not an array`);
  return value.map((item, index) => asRecord(item, `${what}[${String(index)}]`));
};

export const layerRe = (projectId: string, floorId: string): RegExp =>
  new RegExp(`^/api/projects/${esc(projectId)}/floors/${esc(floorId)}/spatial/layer$`, 'u');
export const layerPath = (projectId: string, floorId: string): string => `${PROJECTS_API}/${projectId}/floors/${floorId}/spatial/layer`;

/* ---------------------------------------------------------------- wall seeds */

export interface WallSpec {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly thicknessMm?: number;
  readonly kind?: 'loadBearing' | 'partition' | 'envelope';
  readonly confidence?: number;
  /** A5: `reviewed: true` only comes with `source: 'human'` (schemas/spatial.ts humanOnlyReview). */
  readonly reviewed?: boolean;
  /** Index (into the same spec list) of the opening ids this wall hosts: set by {@link wallsLayer}'s `openings`. */
  readonly openingIds?: readonly string[];
}

/** 10 upper-case alphanumerics, unique per call (the random part of an id body, BE packages/core/ids.py:92-94). */
export const idTag = (): string => randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 10);
/**
 * Counter-led ids (`W-` + 6-digit counter + 10 random chars, createId's own shape): the list code is the counter, so it
 * does not shift when a wall is deleted or added (ids.ts:187-201). Counters start at 100 so the ids the page creates
 * itself (`createId`: counters 1, 2, ...) never collide with a seeded one. Wall `index` n is `#W-${100 + n}`.
 */
export const wallIdOf = (tag: string, index: number): string => `W-${String(100 + index).padStart(6, '0')}${tag}`;
export const openingIdOf = (tag: string, index: number): string => `D-${String(100 + index).padStart(6, '0')}${tag}`;
/** List code of the seeded wall `index`. */
export const wallCodeOf = (index: number): string => `#W-${String(100 + index)}`;

const AI = (confidence: number): Json => ({ confidence, reviewed: false, source: 'ai' });
const HUMAN: Json = { confidence: 1, reviewed: true, source: 'human' };

/** Wire layer of `specs` (walls get ids `W-<tag>000..`), plus optional openings; no rooms / furniture. */
export function wallsLayer(tag: string, specs: readonly WallSpec[], openings: readonly Json[] = []): (levelId: string) => Json {
  return (levelId) => ({
    walls: specs.map((spec, index) => ({
      ...(spec.reviewed === true ? HUMAN : AI(spec.confidence ?? 0.9)),
      centreline: { start: { x: spec.from[0], y: spec.from[1] }, end: { x: spec.to[0], y: spec.to[1] } },
      heightMm: 3_000,
      id: wallIdOf(tag, index),
      kind: spec.kind ?? 'loadBearing',
      levelId,
      openingIds: [...(spec.openingIds ?? [])],
      thicknessMm: spec.thicknessMm ?? 220,
    })),
    openings: [...openings],
    rooms: [],
    furniture: [],
  });
}

/** A row of `n` collinear 4 m walls at y = 0, 1 m apart in y so the polygons never overlap (draw order = index). */
export const stackOfWalls = (n: number, over: (i: number) => Partial<WallSpec> = () => ({})): WallSpec[] =>
  Array.from({ length: n }, (_, i) => ({ from: [0, i * 1_000] as const, to: [4_000, i * 1_000] as const, ...over(i) }));

/** A 900 mm door (swing left, AI, unreviewed) hosted by wall `wallIndex`: pass its id in that wall's `openingIds`. */
export const doorOn = (tag: string, wallIndex: number, openingIndex = 0): Json => ({
  ...AI(0.9),
  heightMm: 2_100,
  id: openingIdOf(tag, openingIndex),
  kind: 'door',
  offsetMm: 1_000,
  sillHeightMm: 0,
  swing: 'left',
  wallId: wallIdOf(tag, wallIndex),
  widthMm: 900,
});

export interface SeededWalls {
  readonly project: SeededProject;
  readonly tag: string;
  /** Wall ids by creation index. */
  readonly ids: readonly string[];
  /** `#W-001`-style list code by wall id. */
  readonly codes: ReadonlyMap<string, string>;
}

/** Display code (`#W-001`) of every id, as the list derives it. */
export const codesOf = (ids: readonly string[]): Map<string, string> => {
  const codes = displayCodesOf(ids);
  return new Map(ids.map((id) => [id, `#${codes.get(id) ?? id}`] as const));
};

export const layerApiOf = (api: APIRequestContext): LayerApi => ({ request: api, headers: {} });

/**
 * QC:<name>: own project with `floorNames` (default one floor "Tầng 1"); the first floor gets the layer `specs` (the
 * others stay empty). `extra` writes more floors' layers (QX). Returns the project and the walls of the first floor.
 */
export async function seedWalls(
  api: APIRequestContext,
  slug: string,
  specs: readonly WallSpec[],
  options: { readonly floorNames?: readonly string[]; readonly openings?: readonly Json[]; readonly tag?: string } = {},
): Promise<SeededWalls> {
  const names = options.floorNames ?? ['Tầng 1'];
  const project = await createStackProject(
    api,
    slug,
    names.map((name, index) => ({ name, elevationMm: index * 3_000, heightMm: 3_000 })),
  );
  try {
    const first = project.floors[0];
    if (first === undefined) throw new Error('setup: seeded project has no floor');
    const tag = options.tag ?? idTag();
    if (specs.length > 0) await writeLayer(layerApiOf(api), project.projectId, first.id, wallsLayer(tag, specs, options.openings));
    const ids = specs.map((_, index) => wallIdOf(tag, index));
    return { project, tag, ids, codes: codesOf(ids) };
  } catch (error) {
    await deleteSeededProject(api, project.projectId);
    throw error;
  }
}

export interface SeededQc {
  readonly projectId: string;
  /** Project name (what its dashboard card is called). */
  readonly name: string;
  readonly floors: readonly { readonly id: string; readonly name: string }[];
  /** Walls of the first floor from the saved layer (random ids), in graph order. */
  readonly walls: readonly Json[];
  readonly codes: ReadonlyMap<string, string>;
}

/** Q1 / Q2 / Q3: `layerSeed.createQcProject` plus a read of the first floor's saved walls. */
export async function seedQc(
  api: APIRequestContext,
  slug: string,
  floorNames: readonly string[] = ['Tầng 1'],
  layered = 1,
): Promise<SeededQc> {
  const floors = await createQcProject(layerApiOf(api), slug, floorNames, layered);
  const projectId = floors[0]?.projectId;
  if (projectId === undefined) throw new Error('setup: createQcProject returned no floor');
  try {
    const walls = await readWalls(api, projectId, floors[0]?.floorId ?? '');
    const project = await api.get(`${PROJECTS_API}/${projectId}`);
    return {
      projectId,
      name: String(asRecord(await project.json(), 'GET /api/projects/:id').name),
      floors: floors.map((floor) => ({ id: floor.floorId, name: floor.floorName })),
      walls,
      codes: codesOf(walls.map((wall) => String(wall.id))),
    };
  } catch (error) {
    await deleteSeededProject(api, projectId);
    throw error;
  }
}

/** N16 `layer.walls` of a floor, as the server holds them. */
export async function readWalls(api: APIRequestContext, projectId: string, floorId: string): Promise<Json[]> {
  const doc = await readLayer(api, projectId, floorId);
  return asRecords(asRecord(doc.layer, 'N16.layer').walls, 'N16.layer.walls');
}

/** Whole N16 document (`revision`, `level`, `layer`). */
export async function readLayer(api: APIRequestContext, projectId: string, floorId: string): Promise<Json> {
  const res = await api.get(layerPath(projectId, floorId));
  expect(res.status(), `setup: GET ${layerPath(projectId, floorId)} (N16)`).toBe(200);
  return asRecord(await res.json(), 'N16');
}

/**
 * +W2: a second writer. Reads N16 and PUTs the same layer back with `mutate` applied to its walls, at the revision it
 * read — the page that opened earlier now holds a stale `baseVersion` and its next save is a 409 (W20).
 */
export async function secondWriter(
  api: APIRequestContext,
  projectId: string,
  floorId: string,
  mutate: (walls: Json[]) => Json[],
): Promise<number> {
  const doc = await readLayer(api, projectId, floorId);
  const layer = asRecord(doc.layer, 'N16.layer');
  const walls = mutate(asRecords(layer.walls, 'N16.layer.walls'));
  const put = await api.put(layerPath(projectId, floorId), { data: { baseVersion: doc.revision, body: { layer: { ...layer, walls } } } });
  expect(put.status(), `setup: second writer PUT (${(await put.text()).slice(0, 200)})`).toBe(200);
  return Number(asRecord(await put.json(), '#35').revision);
}

/** First wall at 330 mm: a change any second writer can make. */
export const thickenFirst = (walls: Json[]): Json[] => walls.map((wall, index) => (index === 0 ? { ...wall, thicknessMm: 330 } : wall));

/* ---------------------------------------------------------------- sessions */

export interface PutRecord {
  readonly path: string;
  /** Parsed `body.layer.walls` ids of the PUT (null when the body had no layer). */
  readonly wallIds: readonly string[] | null;
  readonly walls: readonly Json[] | null;
  /** Ids of `body.layer.openings` (null when the body had no layer). */
  readonly openingIds: readonly string[] | null;
  readonly scale: number | null;
  readonly baseVersion: number | null;
  readonly at: number;
}

export interface WallsRun {
  readonly flow: Flow;
  readonly page: Page;
  /** Every layer PUT the page sent, in order. */
  readonly puts: PutRecord[];
  /** Every N16 GET the page sent, in order (path). */
  readonly reads: string[];
}

/**
 * One signed-in browser context of `who` (default: the env admin; one `POST /api/auth/login`), its page with the logs
 * attached and `page.clock` installed (time keeps flowing; {@link quiet} and the timer steps move it on purpose).
 */
export async function openWallsRun(
  browser: Browser,
  options: {
    readonly who?: Credentials;
    readonly viewport?: { width: number; height: number };
    readonly reducedMotion?: boolean;
    readonly clock?: boolean;
    /** Accept `beforeunload` prompts (a UI case that leaves a dirty floor at the next width). */
    readonly acceptDialogs?: boolean;
  } = {},
): Promise<WallsRun> {
  const flow = await openFlow(browser, options.who ?? readAdminCredentials(), {
    viewport: options.viewport ?? DESKTOP,
    ...(options.reducedMotion === undefined ? {} : { reducedMotion: options.reducedMotion }),
  });
  const puts: PutRecord[] = [];
  const reads: string[] = [];
  flow.page.on('request', (request) => {
    const url = new URL(request.url());
    if (!/^\/api\/projects\/[^/]+\/floors\/[^/]+\/spatial\/layer$/u.test(url.pathname)) return;
    if (request.method() === 'GET') reads.push(url.pathname);
    if (request.method() !== 'PUT') return;
    let walls: Json[] | null = null;
    let openingIds: string[] | null = null;
    let scale: number | null = null;
    let baseVersion: number | null = null;
    try {
      const sent = asRecord(request.postDataJSON(), '#35');
      const body = asRecord(sent.body, '#35.body');
      baseVersion = typeof sent.baseVersion === 'number' ? sent.baseVersion : null;
      scale = typeof body.scaleMillimetresPerPixel === 'number' ? body.scaleMillimetresPerPixel : null;
      walls = body.layer === undefined ? null : asRecords(asRecord(body.layer, '#35.layer').walls, '#35.layer.walls');
      openingIds = body.layer === undefined ? null : asRecords(asRecord(body.layer, '#35.layer').openings, '#35.layer.openings').map((opening) => String(opening.id));
    } catch {
      /* an unparsable body is recorded with nulls */
    }
    puts.push({ path: url.pathname, wallIds: walls === null ? null : walls.map((wall) => String(wall.id)), walls, openingIds, scale, baseVersion, at: Date.now() });
  });
  if (options.acceptDialogs === true) flow.page.on('dialog', (dialog) => void dialog.accept().catch(() => undefined));
  if (options.clock !== false) await flow.page.clock.install();
  return { flow, page: flow.page, puts, reads };
}

export const closeWallsRun = (run: WallsRun | undefined): Promise<void> => (run === undefined ? Promise.resolve() : closeFlow(run.flow));

/** Layer PUTs sent since `mark` (an index into `run.puts`), optionally for one floor. */
export const putsSince = (run: WallsRun, mark: number, floorId?: string): PutRecord[] =>
  run.puts.slice(mark).filter((put) => floorId === undefined || put.path.includes(`/floors/${floorId}/`));

/** Non-GET requests the page sent since `mark` (index into `run.flow.sent`), minus session / telemetry chatter. */
export const writesSince = (run: WallsRun, mark: number): string[] =>
  run.flow.sent
    .slice(mark)
    .filter((r) => r.method !== 'GET' && r.path !== '/api/auth/refresh' && !r.path.startsWith('/api/telemetry'))
    .map((r) => `${r.method} ${r.path}`);

/**
 * "Nothing more will be sent": runs the page clock past the debounce + max wait, then waits for the network to be idle.
 * Needs the clock installed (the default of {@link openWallsRun}).
 */
export async function quiet(page: Page): Promise<void> {
  await page.clock.runFor(QUIET_MS);
  await page.waitForLoadState('networkidle');
}

/* ---------------------------------------------------------------- SCR-16 locators and actions */

export const WALL = {
  screen: 'Duyệt lớp tường',
  list: 'Danh sách đoạn tường',
  emptyTitle: 'Chưa có đoạn tường nào',
  emptyNotice:
    'Chưa phát hiện được đoạn tường nào ở tầng này. Bạn có thể vẽ tường thủ công bằng phím W, hoặc chạy lại với ngưỡng thấp hơn.',
  noMatch: 'Không có đoạn tường nào khớp bộ lọc đang bật. Bỏ bớt một bộ lọc để thấy lại danh sách.',
  /** L23: không còn thẻ trống — chưa chọn gì thì thẻ hỏi ({@link inspector}) không hiện. */
  inspectorEmpty: 'Chọn một đoạn tường trên bản vẽ hoặc trong danh sách để duyệt.',
  approve: 'Duyệt đoạn này',
  skip: 'Để sau',
  thickness: 'Độ dày tường',
  advanced: 'Thông số nâng cao',
  onlyUnreviewed: 'Chỉ hiện chưa duyệt',
  onlyLow: 'Chỉ hiện độ tin cậy thấp',
  onlyNonStandard: 'Chỉ hiện độ dày không chuẩn',
  centrelines: 'Tim tường', // L23: checkbox trong popover "Hiển thị" ({@link displayCheckbox})
  wallLayer: 'Lớp tường', // như trên
  step: 'Tường', // QcStepColumn: <section aria-label="Tường"> của bước đang làm
  continue: 'Tiếp: Cửa',
  rail: 'Công cụ lớp tường',
  merge: 'nối đoạn',
  mergeHint: 'nối đoạn — Chọn hai đoạn tường để gộp',
  reviewed: 'Đã duyệt',
  conflict: 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.',
  reload: 'Tải lại',
  confirmTitle: 'Bỏ thay đổi chưa lưu của tầng này?',
  confirmReload: 'Tải lại và bỏ thay đổi',
  cancel: 'Huỷ',
  collapse: 'Thu gọn hai panel',
  expand: 'Mở lại hai panel',
  statusBar: 'Thanh trạng thái',
  tree: 'Cây lớp',
  floorNav: 'Tầng của bản vẽ',
  toasts: 'Thông báo',
} as const;

export const wallList = (page: Page): Locator => page.getByRole('listbox', { name: WALL.list, exact: true });
export const wallRows = (page: Page): Locator => wallList(page).getByRole('option');
export const wallOption = (page: Page, code: string): Locator =>
  wallList(page).getByRole('option', { name: new RegExp(`^${esc(code)} — `, 'u') });
export const selectedRows = (page: Page): Locator => wallList(page).getByRole('option', { selected: true });
/** L23 (QcAskCard): chi tiết mục đang chọn nằm trong thẻ hỏi neo trên bản vẽ; chưa chọn gì thì thẻ không hiện. */
export const ASK_CARD = 'Thẻ hỏi của mục đang chọn';
export const inspector = (page: Page): Locator => page.getByRole('region', { name: ASK_CARD, exact: true });
export const rail = (page: Page): Locator => page.getByRole('toolbar', { name: WALL.rail, exact: true });
export const railButton = (page: Page, name: string | RegExp): Locator => rail(page).getByRole('button', { name });
export const thicknessGroup = (page: Page): Locator => page.getByRole('radiogroup', { name: WALL.thickness, exact: true });
export const approveButton = (page: Page): Locator => page.getByRole('button', { name: WALL.approve, exact: true });
export const toasts = (page: Page): Locator => page.getByRole('region', { name: WALL.toasts, exact: true });
export const statusBar = (page: Page): Locator => page.getByRole('status', { name: WALL.statusBar, exact: true });
/** `<g aria-label="#W-001" role="presentation">` of a wall on the canvas (WallLayerShapeFigure.tsx). */
export const wallShape = (page: Page, code: string): Locator => page.locator(`svg g[aria-label="${code}"]`).first();
/** The wall's filled polygon: the first child of its `<g>`. */
export const wallPolygon = (page: Page, code: string): Locator => wallShape(page, code).locator('polygon').first();
export const canvasFrame = (page: Page): Locator => page.locator('div[role="group"][aria-label^="Mặt bằng "]');
/** L23: tiến độ là chip ở dòng bước Tường của cột việc ("N cần xem", xong thì "N đoạn · đã duyệt"); bộ đếm a/b đã bỏ. */
export const counter = (page: Page): Locator =>
  page.getByRole('region', { name: WALL.step, exact: true }).getByText(/^(\d+ cần xem|\d+ đoạn · đã duyệt)$/u).first();
/** Chip của bước khi còn `pending` mục, hoặc "`total` đoạn · đã duyệt" khi `pending` = 0. */
export const counterText = (pending: number, total: number): string => (pending === 0 ? `${String(total)} đoạn · đã duyệt` : `${String(pending)} cần xem`);
export const checkbox = (page: Page, name: string): Locator => page.getByRole('checkbox', { name, exact: true });
export const reviewRegion = (page: Page): Locator => page.getByRole('region', { name: WALL.screen, exact: true });

/** L23: công tắc lớp (vd. "Lớp tường", "Tim tường", "Cửa đi") là checkbox trong popover "Hiển thị" ở góc trên phải bản vẽ. */
export async function displayCheckbox(page: Page, name: string): Promise<Locator> {
  const button = page.getByRole('button', { name: 'Hiển thị', exact: true });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  return checkbox(page, name);
}

/** Checkbox: focus + Space (sr-only input under a drawn box). */
export async function toggleCheckbox(page: Page, name: string): Promise<void> {
  const box = checkbox(page, name);
  await box.focus();
  await page.keyboard.press('Space');
}

/** Opens SCR-16 with a fresh document load and waits for its N16 read (200); `tour` closes the editor tour. */
export async function openWalls(page: Page, projectId: string, floorId: string, options: { readonly tour?: boolean } = {}): Promise<ApiResult> {
  const read = await navigateThenWaitForApi(
    page,
    () => page.goto(ROUTES.project.walls(projectId, floorId), { waitUntil: 'commit' }),
    'GET',
    layerRe(projectId, floorId),
    [200],
  );
  await expect(reviewRegion(page)).toBeVisible();
  if (options.tour !== false) await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
  return read;
}

/** Next `PUT …/spatial/layer` (any status) of the floor whose sent `body` passes `sent`. Register BEFORE the action. */
export function waitForLayerPut(page: Page, projectId: string, floorId: string, sent?: (body: Json) => boolean): Promise<ApiResult> {
  const re = layerRe(projectId, floorId);
  return waitForApiWhere(
    page,
    (response) => {
      if (response.request().method() !== 'PUT' || !re.test(new URL(response.url()).pathname)) return false;
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

export const sentBody = (result: ApiResult): Json => asRecord(asRecord(result.response.request().postDataJSON(), '#35').body, '#35.body');
export const sentWalls = (result: ApiResult): Json[] => asRecords(asRecord(sentBody(result).layer, '#35.layer').walls, '#35.layer.walls');

/** Selects the row by clicking it and waits for the inspector to show its code. */
export async function selectRow(page: Page, code: string): Promise<void> {
  await wallOption(page, code).click();
  await expect(wallOption(page, code)).toHaveAttribute('aria-selected', 'true');
}

/** Row's label parts `{ code, status }` of every row in the list, in DOM order (virtualised list: rendered rows only). */
export async function rowLabels(page: Page): Promise<string[]> {
  return wallRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));
}

export const codeOfLabel = (label: string): string => label.replace(/ — .*$/u, '');

/** Seeded floor (by index) of a {@link SeededProject}. */
export function floorOf(project: SeededProject, index = 0): { id: string; name: string } {
  const floor = project.floors[index];
  if (floor === undefined) throw new Error(`setup: ${project.name} has no floor #${String(index)}`);
  return floor;
}

/** Project with a project name of exactly `length` chars and `floors` named drafts (BE NAME_MAX 80). */
export async function createNamedProject(
  api: APIRequestContext,
  slug: string,
  length: number,
  floorNames: readonly string[],
): Promise<SeededProject> {
  const head = `${TEST_DATA_PREFIX}${slug}-${uniq()}-`;
  const name = head.length >= length ? head.slice(0, length) : `${head}${'n'.repeat(length - head.length)}`;
  const created = await api.post(PROJECTS_API, {
    data: { name, floors: floorNames.map((floor, order) => ({ name: floor, order, elevationMm: order * 3_000, heightMm: 3_000 })) },
  });
  expect(created.status(), `setup: POST ${PROJECTS_API} "${name}": ${(await created.text()).slice(0, 300)}`).toBe(201);
  const projectId = String(asRecord(await created.json(), 'POST /api/projects').id);
  return { projectId, name, floors: await listFloors(api, projectId) };
}

/** Env admin API client (1 login); caller disposes. */
export const adminClient = (): Promise<APIRequestContext> => {
  const admin = readAdminCredentials();
  return signedInApi(admin.email, admin.password);
};

/* ---------------------------------------------------------------- small page helpers */

/** Evidence of one catalog row: `E04_<row>_<slug>.png` (edge layer). */
export const ev = (page: Page, row: string, slug: string): Promise<string> => captureEvidence(page, `E04_${row}_${slug}.png`);
/** Evidence of one UI-verify state: `verifyUi` adds `_<width>.png`. */
export const uiName = (row: string, slug: string): string => `U04_${row}_${slug}`;

/** One macrotask round trip in the page (MessageChannel is not faked by `page.clock`): lets a just-fired timer's fetch go out. */
export function tick(page: Page, rounds = 3): Promise<void> {
  return page.evaluate(async (n) => {
    for (let i = 0; i < n; i += 1) {
      await new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(0);
      });
    }
  }, rounds);
}

/** Freezes `page.clock` now: only `runFor` / `fastForward` / `resume` move time until `resume()`. */
export async function freezeClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 1_000));
}

/**
 * Records every text a node matching `selector` shows from now on (MutationObserver, set up in the next documents too):
 * the save label goes dirty → saving → saved within tens of ms, which a poll would miss. Call BEFORE `goto`.
 */
export async function recordTexts(page: Page, selector: string): Promise<() => Promise<string[]>> {
  const key = `__qaTexts_${Math.random().toString(36).slice(2, 8)}`;
  await page.addInitScript(
    ({ sel, store }) => {
      const seen: string[] = [];
      (window as unknown as Record<string, string[]>)[store] = seen;
      const read = (): void => {
        const text = document.querySelector(sel)?.textContent?.trim() ?? '';
        if (text !== '' && seen[seen.length - 1] !== text) seen.push(text);
      };
      new MutationObserver(read).observe(document, { subtree: true, childList: true, characterData: true });
    },
    { sel: selector, store: key },
  );
  return () => page.evaluate((store) => (window as unknown as Record<string, string[]>)[store] ?? [], key);
}

export const SAVE_LABEL = '[aria-label="Thanh trạng thái"] [aria-live="polite"]';

/* ---------------------------------------------------------------- canvas geometry */

/** The plan's own <svg> (a direct child of the frame; the mini map keeps its own <svg> deeper in the tree). */
export const canvasSvg = (page: Page): Locator => canvasFrame(page).locator(':scope > svg[role="img"]');

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Page-space bounding box of the wall's polygon. */
export async function polygonBox(page: Page, code: string): Promise<Box> {
  const box = await wallPolygon(page, code).boundingBox();
  if (box === null) throw new Error(`no box for the polygon of ${code}`);
  return box;
}

/**
 * A page point in the empty band between two walls drawn one above the other: horizontally `fx` (0..1) of the upper
 * wall's width, vertically halfway between the upper wall's bottom edge and the lower wall's top edge.
 */
export async function gapPoint(page: Page, upper: string, lower: string, fx = 0.5): Promise<{ x: number; y: number }> {
  const [a, b] = [await polygonBox(page, upper), await polygonBox(page, lower)];
  return { x: a.x + a.width * fx, y: (a.y + a.height + b.y) / 2 };
}

/** Click at a page point (the SVG's own click handler reads it back through getScreenCTM). */
export async function clickAt(page: Page, point: { x: number; y: number }, options: { modifiers?: ('Control')[] } = {}): Promise<void> {
  await page.mouse.move(point.x, point.y);
  if (options.modifiers?.includes('Control')) await page.keyboard.down('Control');
  await page.mouse.click(point.x, point.y);
  if (options.modifiers?.includes('Control')) await page.keyboard.up('Control');
}
