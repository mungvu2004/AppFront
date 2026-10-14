/**
 * QA-06b pack P2 helpers: the rule-report screen (SCR-28) plus the shared pipeline project of `phase06_pipeline.spec.ts`.
 * Owned by P2 only. Functions that another pack also needs are copied here, marked `// dup-of:` (merged at S4).
 *
 * Budget: none of these helpers logs in; `seedMainPipeline` costs 1 `drawings_init` (60 / 600 s per user), 1 project, one
 * #35 layer PUT, 1 DELETE (`deleteSeededProject`). `createRuleProject` costs 1 project + 1 #35 PUT per layered floor.
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { navigateThenWaitForApi, type ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { createPipelineProject, type SeededDrawing } from '../drawingSeed';
import { TEST_DATA_PREFIX } from '../evidence';
import { qcLayer, writeLayer, type LayerApi } from '../layerSeed';

export type Json = Record<string, unknown>;

export const VIEWPORT = { width: 1440, height: 900 } as const;
/** react-query / HTTP ladder retry a failed read before the error state paints (cachePolicy.ts:74-82). */
export const ERROR_PAINT_TIMEOUT_MS = 30_000;
const REFRESH_API = '/api/auth/refresh';

export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const pathOf = (page: Page): string => new URL(page.url()).pathname;
export const ruleConfigRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/rule-config$`, 'u');
export const spatialRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/spatial$`, 'u');
export const layerRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/floors/[^/]+/spatial/layer$`, 'u');

/** Requests the page sent since `mark`, minus session / telemetry chatter. */
export const requestsSince = (log: readonly ApiEntry[], mark: number): ApiEntry[] =>
  log.slice(mark).filter((entry) => entry.path !== REFRESH_API && !entry.path.startsWith('/api/telemetry'));

/* ---- SCR-28 copy (each from RuleReport*.tsx / ViolationDetail*.tsx / ProjectSpatialGate.tsx) ---- */
export const RR = {
  heading: 'Kiểm tra luật không gian',
  trail: 'Đường dẫn trang',
  rerun: 'Chạy kiểm tra lại',
  settingsLink: 'Cài đặt bộ luật',
  confirm: 'Xác nhận đã xử lý',
  doneText: 'Không phát hiện vi phạm nào.',
  errorTitle: 'Không chạy được lượt kiểm tra',
  configFailed: 'Không tải được cấu hình bộ luật của dự án.',
  retry: 'Thử lại',
  noMatch: 'Không có mục nào khớp bộ lọc đang đặt. Nới bộ lọc để xem thêm.',
  levelFilter: 'Lọc theo mức độ',
  view: 'Xem',
  columns: ['Mức độ', 'Mô tả', 'Tầng', 'Mã đối tượng'],
  sheet: 'Chi tiết vi phạm',
  sheetClose: 'Đóng tấm trượt chi tiết vi phạm',
  deleteAction: 'Xoá đối tượng này',
  resolved: 'Đã xử lý',
  refreshFailed: 'Không tải lại được mô hình.',
  addFloorLink: 'Thêm tầng cho mô hình',
  backToProjects: 'Về danh sách dự án',
  noAutoFix: 'Chưa có cách sửa tự động nào cho vi phạm này. Phần căn cứ ở trên đủ để sửa tay trên Bản vẽ.',
  unnamedRoom: 'Có phòng chưa đặt tên nên chưa lưu được tầng này. Đặt tên cho phòng đó rồi lưu lại.',
  saveUnknown: 'Không lưu được thay đổi của tầng này.',
  offline: 'Ngoại tuyến — sẽ lưu khi có mạng',
} as const;
/** Rule names (domain/rules registry + function group) the seeded R1 layer fires. */
export const RULE_NAME = {
  furnitureClash: 'Đồ đạc không chồng lên tường hay lên nhau',
  wallLength: 'Tường đủ dài để dựng',
} as const;

/* ---- SCR-28 locators ---- */
export const levelFilter = (page: Page): Locator => page.getByRole('radiogroup', { name: RR.levelFilter, exact: true });
export const rerunButton = (page: Page): Locator => page.getByRole('button', { name: RR.rerun, exact: true });
/** RuleReportGroups: the group toggle is a button inside an `<h3>`. */
export const groupExpanders = (page: Page): Locator => page.getByRole('heading', { level: 3 }).getByRole('button');
export const summaryValue = (page: Page, label: string): Locator =>
  page
    .locator('dl > div')
    .filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${label}$`, 'u') }) })
    .locator('dd');
export const sheetOf = (page: Page): Locator => page.getByRole('complementary', { name: RR.sheet });
/** A table row (>= 1024) or a card (below). */
export const findingRows = (section: Locator): Locator => section.getByRole('row').or(section.getByRole('listitem'));

/** A count-up number once two reads 400 ms apart agree; vi grouping "." removed (`useCountUp`). */
export async function settledInt(locator: Locator): Promise<number> {
  let last = '';
  await expect
    .poll(
      async () => {
        const now = (await locator.innerText()).trim();
        const same = now === last && now !== '';
        last = now;
        return same;
      },
      { message: 'count-up never settled', intervals: [400] },
    )
    .toBe(true);
  return Number(last.replace(/\./gu, ''));
}

/** dup-of: rules.ts openRules (P1). Opens `/rules` with a fresh document and waits for the N15 read + the heading + a settled run. */
export async function openRules(page: Page, projectId: string): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.rules(projectId), { waitUntil: 'commit' }), 'GET', spatialRe(projectId), [200]);
  await expect(page.getByRole('heading', { name: RR.heading, level: 2 })).toBeVisible();
  await expect(rerunButton(page)).toBeEnabled();
  await expect(levelFilter(page).or(page.getByText(RR.doneText, { exact: true })).first()).toBeVisible();
}

/** Expands the group whose header contains `ruleName` (or the first collapsed one); returns its `<section>`. */
export async function expandGroup(page: Page, ruleName?: string): Promise<Locator> {
  const expander =
    ruleName === undefined
      ? groupExpanders(page).and(page.locator('[aria-expanded="false"]')).first()
      : groupExpanders(page).filter({ hasText: ruleName }).first();
  await expect(expander).toBeVisible();
  if ((await expander.getAttribute('aria-expanded')) !== 'true') await expander.click();
  await expect(expander).toHaveAttribute('aria-expanded', 'true');
  return page.locator('section').filter({ has: expander });
}

/** A row of `section` that has a floor (the sheet needs one: RuleReport.container `activeFloorId ?? row.levelId`). */
export function rowWithFloor(page: Page, section: Locator): Locator {
  return findingRows(section)
    .filter({ has: page.getByRole('button', { name: RR.view, exact: true }) })
    .filter({ hasNot: page.getByText('—', { exact: true }) });
}

/** Clicks the message of the `index`-th row with a floor and waits for the sheet. */
export async function openSheetOnRow(page: Page, section: Locator, index = 0): Promise<Locator> {
  await rowWithFloor(page, section).nth(index).getByRole('button').first().click();
  const sheet = sheetOf(page);
  await expect(sheet).toBeVisible();
  return sheet;
}

/** Opens `/rules`, the group of `ruleName`, and the sheet on its first row with a floor. */
export async function openRuleSheet(page: Page, projectId: string, ruleName: string, index = 0): Promise<Locator> {
  await openRules(page, projectId);
  const section = await expandGroup(page, ruleName);
  return openSheetOnRow(page, section, index);
}

/** A JSON 500 for one GET path (other requests fall through). `counter.served` counts the answers given. */
export function failGet(matcher: RegExp, counter: { served: number }): (route: Route) => Promise<void> {
  return async (route) => {
    if (route.request().method() !== 'GET' || !matcher.test(new URL(route.request().url()).pathname)) {
      await route.fallback();
      return;
    }
    counter.served += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-06b mocked 500' }) });
  };
}

/** A promise a route handler awaits: `release()` lets every held request through. */
export function makeGate(): { readonly open: Promise<void>; readonly release: () => void } {
  let release: () => void = () => undefined;
  const open = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { open, release };
}

/* ---- seeds ---- */

/** W4 id `<letter>-<20 UPPER>` (dup-of: layerSeed.ts sid, not exported). */
const sid = (letter: 'W' | 'D' | 'R' | 'F'): string => `${letter}-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;

const aiMeta = (confidence = 0.9): Json => ({ confidence, reviewed: false, source: 'ai' });

/**
 * R1 layer (flows-C1 Seeds): the QC layer plus (a) an isolated 80 mm wall (WALL-LENGTH critical, `shortWall`), (b) two
 * 50 mm walls (WALL-THICKNESS warning x2), (c) a 600 mm door (DOOR-WIDTH warning), (d) a 3 m2 room "Phòng 1", (e) three
 * tables whose boxes cross the partition at y = 2000 (FURNITURE-CLASH suggestion x3; the delete action resolves one).
 * // S5-confirm: the exact groups and counts of this layer (pin an EXPECT after one real run).
 */
export function ruleLayer(levelId: string, opts: { readonly shortWall?: boolean } = {}): Json {
  const base = qcLayer(levelId);
  const walls = [...(base.walls as Json[])];
  const openings = [...(base.openings as Json[])];
  const rooms = [...(base.rooms as Json[])];
  const furniture = [...(base.furniture as Json[])];
  const wall = (from: readonly [number, number], to: readonly [number, number], extra: Json = {}): Json => ({
    ...aiMeta(),
    centreline: { start: { x: from[0], y: from[1] }, end: { x: to[0], y: to[1] } },
    heightMm: 3000,
    id: sid('W'),
    kind: 'partition',
    levelId,
    openingIds: [],
    thicknessMm: 200,
    ...extra,
  });
  if (opts.shortWall !== false) walls.push(wall([0, 7000], [80, 7000], { confidence: 0.5 }));
  const doorWall = wall([9000, 0], [9000, 3000], { thicknessMm: 50 });
  walls.push(doorWall, wall([9000, 3000], [9000, 6000], { thicknessMm: 50 }));
  const narrowDoor = sid('D');
  doorWall.openingIds = [narrowDoor];
  openings.push({ ...aiMeta(), heightMm: 2100, id: narrowDoor, kind: 'door', offsetMm: 500, sillHeightMm: 0, swing: 'left', wallId: doorWall.id, widthMm: 600 });
  rooms.push({
    ...aiMeta(),
    areaM2: 3,
    id: sid('R'),
    levelId,
    name: 'Phòng 1',
    outline: [
      { x: 10000, y: 0 },
      { x: 11500, y: 0 },
      { x: 11500, y: 2000 },
      { x: 10000, y: 2000 },
    ],
    usage: 'kitchen',
    wallIds: [],
  });
  for (const [x0, x1] of [
    [1500, 2300],
    [3000, 3800],
    [4500, 5300],
  ] as const) {
    furniture.push({
      ...aiMeta(),
      boundingBox: { min: { x: x0, y: 1700 }, max: { x: x1, y: 2300 } },
      centre: { x: (x0 + x1) / 2, y: 2000 },
      id: sid('F'),
      kind: 'table',
      levelId,
      roomId: (rooms[0] as Json).id,
      rotationDeg: 0,
    });
  }
  return { walls, openings, rooms, furniture };
}

export interface RuleProjectOptions {
  readonly floors?: readonly { readonly name: string; readonly elevationMm: number }[];
  readonly layered?: number;
  readonly shortWall?: boolean;
}

/**
 * dup-of: rules.ts createRuleProject (P1). Project `qa-<runId>-<slug>-<uniq>` whose first `layered` floors carry
 * {@link ruleLayer}; floors default to one "Tầng 1" at elevation 0.
 */
export async function createRuleProject(api: LayerApi, slug: string, opts: RuleProjectOptions = {}): Promise<{ projectId: string; floors: { id: string; name: string }[] }> {
  const floors = opts.floors ?? [{ name: 'Tầng 1', elevationMm: 0 }];
  const name = `${TEST_DATA_PREFIX}${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  expect(name.length, `fixture name "${name}" fits NAME_MAX 80`).toBeLessThanOrEqual(80);
  const created = await api.request.post('/api/projects', {
    headers: api.headers,
    data: { name, floors: floors.map((floor, order) => ({ name: floor.name, order, elevationMm: floor.elevationMm, heightMm: 3000 })) },
  });
  expect(created.status(), `setup: POST /api/projects "${name}"`).toBe(201);
  const projectId = String(asRecord(await created.json(), 'POST /api/projects').id);
  const read = await api.request.get(`/api/projects/${projectId}`, { headers: api.headers });
  expect(read.status(), 'setup: GET /api/projects/:id').toBe(200);
  const rows = (asRecord(await read.json(), 'GET project').floors as unknown[]).map((row) => asRecord(row, 'floor'));
  const seeded = floors.map((floor) => {
    const row = rows.find((item) => item.name === floor.name);
    if (row === undefined) throw new Error(`setup: floor "${floor.name}" was not created`);
    return { id: String(row.id), name: floor.name };
  });
  for (const floor of seeded.slice(0, opts.layered ?? 1)) {
    await writeLayer(api, projectId, floor.id, (levelId) => ruleLayer(levelId, opts.shortWall === undefined ? {} : { shortWall: opts.shortWall }));
  }
  return { projectId, floors: seeded };
}

/**
 * The shared pipeline project of `phase06_pipeline.spec.ts` (flows-C5 Seeds `MP`): the fake-ML run with its "before" +
 * "after" versions, then ONE qcLayer write so no row is "Hiện tại" and v2 is restorable. Needs `E2E_DRAWING_PNG`.
 */
export async function seedMainPipeline(fixtureApi: APIRequestContext, png: Buffer): Promise<SeededDrawing> {
  const seeded = await createPipelineProject(fixtureApi, 'm06', png);
  await writeLayer({ request: fixtureApi, headers: {} }, seeded.projectId, seeded.floorId, qcLayer);
  return seeded;
}
