/**
 * QA-06b P1 helpers for `phase06_rules_edge.spec.ts` (SCR-28 rule report + the "Chi tiết vi phạm" sheet).
 *
 * - `createRuleProject(admin, slug, opts)` : run-unique project through the real API; the "rules layer" is written per floor
 *   through #35 (`layerSeed.writeLayer`). Seeds of flows-C1.md: R1 (default) · R2 (`floors` with EQUAL elevation, layered 2)
 *   · R3 (`shortWall: false`) · R5 (equal elevation, `layered: 1`) · M0 (`floors: []`).
 * - `ruleLayer(levelId, opts)` : qcLayer plus the findings the flows pin (see the function doc).
 * - `putRuleConfig` : N22 by API, reading the revision from N21 first.
 * - `openRules / settledInt / summaryValue / groupHeaders / headerInfos / ruleSection / openSheet` : screen helpers.
 * Source abbreviations: RR src/screens/rules/RuleReport/*, VD src/screens/rules/ViolationDetail/*.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext, Locator, Page } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { navigateThenWaitForApi, watchApi } from '../../../../e2e/fullstack/apiWatch';
import type { ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { ensureAdminSession, readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX } from '../evidence';
import { deleteProject, layerApiOf, layerPathOf, qcLayer, writeLayer } from '../layerSeed';
import type { LayerApi, SeededFloor } from '../layerSeed';
import { signInPoolUser } from '../phase03Seed';
import type { PoolUser } from '../phase03Seed';
import { ADMIN_STATE_FILE as ADMIN_STORAGE_STATE_FILE } from './adminState';

type Json = Record<string, unknown>;
type Viewport = { readonly width: number; readonly height: number };

export const DESKTOP: Viewport = { width: 1440, height: 900 };
export const AT_1024: Viewport = { width: 1024, height: 900 };
export const BELOW_1024: Viewport = { width: 1023, height: 900 };
export const NARROW: Viewport = { width: 768, height: 1024 };
/** A "no request" claim waits past autosave (800 ms) plus a round trip. */
const QUIET_MS = 2_500;
export const REFRESH_API = '/api/auth/refresh';
const PROJECTS_API = '/api/projects';
const FLOOR_HEIGHT_MM = 3_000;

/** 25 codes of BE `apps/api/rules/catalog.py` RULE_CODES (N22 accepts exactly these). */
export const ALL_RULE_CODES = [
  'WALL-THICKNESS', 'WALL-LENGTH', 'OPENING-IN-WALL', 'DOOR-WIDTH', 'ROOM-MIN-AREA', 'ROOM-HAS-DOOR', 'ROOM-UNNAMED',
  'LEVEL-ELEVATION', 'WALL-OVERLAP', 'WALL-DANGLING-END', 'ROOM-NOT-CLOSED', 'DOOR-SWING-BLOCKED', 'OPENING-OVERLAP',
  'WALL-UNSUPPORTED', 'STAIR-ALIGNMENT', 'ROOM-NO-DOOR', 'CORRIDOR-WIDTH', 'ROOM-NO-WINDOW', 'ESCAPE-DISTANCE',
  'DOOR-BLOCKS-PATH', 'ROOM-AREA-BELOW-MINIMUM', 'FURNITURE-CLASH', 'ROOM-FURNITURE-MISMATCH', 'FIXTURE-OFF-WALL',
  'WINDOW-ON-INNER-WALL',
] as const;

/** Rule names (registry.ts / function/index.ts) as they head a group. */
export const RULE_NAMES = {
  wallLength: 'Tường đủ dài để dựng', // registry.ts:481
  wallThickness: 'Bề dày tường nằm trong khoảng dựng được', // registry.ts:447
  doorWidth: 'Cửa đi đủ rộng để lọt người', // registry.ts:550
  roomArea: /^Phòng đủ diện tích/u, // S5-confirm: ROOM-MIN-AREA (registry.ts:578) is superseded by ROOM-AREA-BELOW-MINIMUM
  furnitureClash: 'Đồ đạc không chồng lên tường hay lên nhau', // function/index.ts furnitureClashRule
  levelElevation: 'Cao độ các tầng tăng dần từ dưới lên', // registry.ts:670
} as const;

/* ---------------------------------------------------------------- small utilities */

export const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const pathOf = (page: Page): string => new URL(page.url()).pathname;
/** Quiet window for "nothing was sent" claims — only after the request that must have gone out has answered. */
export const quiet = (page: Page): Promise<void> => page.waitForTimeout(QUIET_MS); // fixed-wait-ok: no-request window past the 800 ms autosave
export const spatialRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/spatial$`, 'u');
export const ruleConfigRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/rule-config$`, 'u');
export const layerPutRe = /^\/api\/projects\/[^/]+\/floors\/[^/]+\/spatial\/layer$/u;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

/** Writes (non-GET) the page sent since `mark`, minus session/telemetry chatter. */
export const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.path !== REFRESH_API && !entry.path.startsWith('/api/telemetry'))
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

/** Text of `locator` once two reads 400 ms apart agree (count-up, `useCountUp`). */
export async function settledText(locator: Locator): Promise<string> {
  let last = '';
  await expect
    .poll(
      async () => {
        const now = (await locator.innerText()).trim();
        const same = now === last && now !== '';
        last = now;
        return same;
      },
      { message: 'text never settled', intervals: [400] },
    )
    .toBe(true);
  return last;
}

/** A count-up figure once settled; vi grouping "." removed. */
export async function settledInt(locator: Locator): Promise<number> {
  return Number((await settledText(locator)).replace(/\./gu, ''));
}

/** The toast (role=status) carrying `message`. */
export const toast = (page: Page, message: string | RegExp): Locator => page.getByRole('status').filter({ hasText: message });

/* ---------------------------------------------------------------- admin context + fixtures */

export interface FloorRef {
  readonly id: string;
  readonly name: string;
}

export interface RuleProject {
  readonly id: string;
  readonly name: string;
  readonly floors: readonly FloorRef[];
}

export interface Admin {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
  /** Fixture calls with this context's own access token. */
  readonly fx: LayerApi;
  /** Project ids this test owns; deleted when the context closes. */
  readonly cleanup: string[];
}

// dup-of: phase06_rules_export_versions_edge.spec.ts openAdmin
export async function openAdmin(browser: Browser, viewport: Viewport = DESKTOP): Promise<Admin> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport,
    ...(existsSync(ADMIN_STORAGE_STATE_FILE) ? { storageState: ADMIN_STORAGE_STATE_FILE } : {}),
  });
  try {
    await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    const fx = await layerApiOf(context);
    const page = await context.newPage();
    return { context, page, api: watchApi(page), fx, cleanup: [] };
  } catch (error) {
    await context.close();
    throw error;
  }
}

// dup-of: phase06_rules_export_versions_edge.spec.ts closeAdmin
export async function closeAdmin(admin: Admin): Promise<void> {
  const failures: string[] = [];
  for (const id of admin.cleanup) {
    const failed = await deleteProject(admin.fx, id);
    if (failed !== null) failures.push(failed);
  }
  if (failures.length > 0) test.info().annotations.push({ type: 'cleanup', description: failures.join('; ') });
  await admin.context.storageState({ path: ADMIN_STORAGE_STATE_FILE }).catch(() => undefined);
  await admin.context.close().catch(() => undefined);
}

export async function withAdmin(browser: Browser, body: (admin: Admin) => Promise<void>, viewport: Viewport = DESKTOP): Promise<void> {
  const admin = await openAdmin(browser, viewport);
  try {
    await body(admin);
  } finally {
    await closeAdmin(admin);
  }
}

/* ---------------------------------------------------------------- the rules layer */

const sid = (letter: 'W' | 'D' | 'R' | 'F'): string => `${letter}-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`; // dup-of: layerSeed.ts sid
const ai = (confidence = 0.9): Json => ({ confidence, reviewed: false, source: 'ai' }); // dup-of: layerSeed.ts ai

export interface RuleLayerOpts {
  /** false = R3: no isolated 80 mm wall, so no critical rule fires. */
  readonly shortWall?: boolean;
  /** false = leave out the two 50 mm walls: `resolveWallShapes` throws on thickness outside 60-600 (domain/walls/joints.ts:20), which blanks the sheet's 2D figure. */
  readonly thinWalls?: boolean;
  /** true = R0: also a 900 mm first door, kitchen 12 m2, no clashing tables (nothing from the R1 list is left to fire). */
  readonly clean?: boolean;
}

/**
 * The "rules layer" of flows-C1 `### Seeds` R1 = `qcLayer` plus
 * (a) isolated wall (0,7000)→(80,7000) confidence 0.5 → WALL-LENGTH critical (80 < 100 mm, registry.ts:398);
 * (b) two walls `thicknessMm 50` → WALL-THICKNESS warning ×2 (50 < 60, registry.ts:391; passes the N22 threshold 45);
 * (c) the door `widthMm 600` → DOOR-WIDTH warning (600 < 700);
 * (d) kitchen room "Phòng 1" `areaM2 3` → room-area warning (kitchen minimum 5 m², registry.ts:412), rename action offered;
 * (e) three tables whose boxes cross the partition wall y = 2000 → FURNITURE-CLASH suggestion ×3 (delete action resolves).
 * S5-confirm: which extra rules (WALL-DANGLING-END, ROOM-NO-DOOR…) also fire is pinned by one real run; the flows use formulas.
 */
export function ruleLayer(levelId: string, { shortWall = true, thinWalls = true, clean = false }: RuleLayerOpts = {}): Json {
  const base = qcLayer(levelId) as { walls: Json[]; openings: Json[]; rooms: Json[]; furniture: Json[] };
  const wall = (from: readonly [number, number], to: readonly [number, number], extra: Json = {}): Json => ({
    ...ai(),
    centreline: { start: { x: from[0], y: from[1] }, end: { x: to[0], y: to[1] } },
    heightMm: FLOOR_HEIGHT_MM,
    id: sid('W'),
    kind: 'partition',
    levelId,
    openingIds: [],
    thicknessMm: 220,
    ...extra,
  });
  const idOf = (items: readonly Json[], index: number): string => String(items[index]?.id);
  // The qcLayer partitions stop 1 m short of the outer walls (a dangling end); here they span wall to wall so that, without
  // the short wall, no critical rule is expected (S5-confirm: R3 is "done with warnings").
  const spanned = base.walls.map((item, index) =>
    index === 8 || index === 9
      ? { ...item, centreline: { start: { x: 0, y: (item.centreline as { start: { y: number } }).start.y }, end: { x: 8000, y: (item.centreline as { start: { y: number } }).start.y } } }
      : item,
  );
  const secondDoor = {
    ...ai(), heightMm: 2100, id: sid('D'), kind: 'door', offsetMm: 1000, sillHeightMm: 0, swing: 'left', wallId: idOf(spanned, 5), widthMm: 900,
  };
  const walls = [
    ...spanned.map((item, index) => (index === 5 ? { ...item, openingIds: [secondDoor.id] } : item)),
    ...(thinWalls
      ? [wall([0, 5000], [8000, 5000], { thicknessMm: 50 }), wall([0, 5500], [8000, 5500], { thicknessMm: 50 })]
      : []),
    ...(shortWall ? [wall([0, 7000], [80, 7000], { confidence: 0.5 })] : []),
  ];
  const openings = [...base.openings.map((opening, index) => (index === 0 && !clean ? { ...opening, widthMm: 600 } : opening)), secondDoor];
  const rooms = base.rooms.map((room, index): Json =>
    index === 0
      ? { ...room, name: 'Phòng 1', areaM2: clean ? 12 : 3, wallIds: [idOf(spanned, 0), idOf(spanned, 1), idOf(spanned, 4), idOf(spanned, 8)] }
      : { ...room, wallIds: [idOf(spanned, 2), idOf(spanned, 3), idOf(spanned, 5), idOf(spanned, 9)] },
  );
  const kitchenId = rooms[0]?.id;
  const table = (cx: number): Json => ({
    ...ai(),
    boundingBox: { min: { x: cx - 300, y: 1700 }, max: { x: cx + 300, y: 2300 } },
    centre: { x: cx, y: 2000 },
    id: sid('F'),
    kind: 'table',
    levelId,
    roomId: kitchenId,
    rotationDeg: 0,
  });
  return { walls, openings, rooms, furniture: clean ? base.furniture : [...base.furniture, table(2000), table(4000), table(6000)] };
}

export interface RuleFloorSpec {
  readonly name: string;
  readonly elevationMm: number;
}

export interface RuleProjectOpts {
  /** Default one floor "Tầng 1" at 0. `[]` = M0 (a project with no floor). */
  readonly floors?: readonly RuleFloorSpec[];
  /** How many leading floors get the rules layer (default 1, 0 when there is no floor). */
  readonly layered?: number;
  readonly shortWall?: boolean;
  /** false = no 50 mm walls (see {@link RuleLayerOpts}). */
  readonly thinWalls?: boolean;
  /** R0, see {@link RuleLayerOpts.clean}. */
  readonly clean?: boolean;
}

/** Run-unique project + rules layer; the id is queued in `admin.cleanup`. S5-confirm: BE accepts two floors of equal elevation. */
export async function createRuleProject(admin: Admin, slug: string, opts: RuleProjectOpts = {}): Promise<RuleProject> {
  const floors = opts.floors ?? [{ name: 'Tầng 1', elevationMm: 0 }];
  const layered = opts.layered ?? (floors.length > 0 ? 1 : 0);
  const name = `${TEST_DATA_PREFIX}${slug}-${uniq()}`;
  expect(name.length, `fixture name "${name}" fits NAME_MAX 80`).toBeLessThanOrEqual(80);
  const created = await admin.fx.request.post(PROJECTS_API, {
    headers: admin.fx.headers,
    data: {
      name,
      ...(floors.length > 0
        ? { floors: floors.map((floor, order) => ({ name: floor.name, order, elevationMm: floor.elevationMm, heightMm: FLOOR_HEIGHT_MM })) }
        : {}),
    },
  });
  expect(created.status(), `setup: POST ${PROJECTS_API} "${name}": ${(await created.text()).slice(0, 200)}`).toBe(201);
  const id = asRecord(await created.json(), 'POST /api/projects').id;
  if (typeof id !== 'string') throw new Error('setup: POST /api/projects without id');
  admin.cleanup.push(id);
  const read = await admin.fx.request.get(`${PROJECTS_API}/${id}`, { headers: admin.fx.headers });
  expect(read.status(), `setup: GET ${PROJECTS_API}/${id}`).toBe(200);
  const rows = asRecord(await read.json(), 'GET /api/projects/:id').floors;
  const refs: FloorRef[] = floors.map((floor) => {
    const row = (Array.isArray(rows) ? rows : []).map((item) => asRecord(item, 'floor')).find((item) => item.name === floor.name);
    if (row === undefined || typeof row.id !== 'string') throw new Error(`setup: floor "${floor.name}" was not created`);
    return { id: row.id, name: floor.name };
  });
  for (const floor of refs.slice(0, layered)) {
    await writeLayer(admin.fx, id, floor.id, (levelId) => ruleLayer(levelId, { ...(opts.shortWall === undefined ? {} : { shortWall: opts.shortWall }), ...(opts.thinWalls === undefined ? {} : { thinWalls: opts.thinWalls }), ...(opts.clean === undefined ? {} : { clean: opts.clean }) }));
  }
  return { id, name, floors: refs };
}

/** Floors of a project as {@link SeededFloor} (for `layerSeed.writeLayer` mid-flow). */
export const seededOf = (project: RuleProject): SeededFloor[] =>
  project.floors.map((floor) => ({ projectId: project.id, floorId: floor.id, floorName: floor.name }));

/** N21 → `{revision, overrides}`. */
export async function readRuleConfig(admin: Admin, projectId: string): Promise<{ revision: number; overrides: Json }> {
  const res = await admin.fx.request.get(`${PROJECTS_API}/${projectId}/rule-config`, { headers: admin.fx.headers });
  expect(res.status(), 'setup: GET rule-config (N21)').toBe(200);
  const body = asRecord(await res.json(), 'N21');
  return { revision: Number(body.revision), overrides: asRecord(body.overrides, 'N21.overrides') };
}

/** N22 by the admin API at the current revision (BE apps/api/rules/router.py:29-37); returns the HTTP status. */
export async function putRuleConfig(admin: Admin, projectId: string, overrides: Json): Promise<number> {
  const { revision } = await readRuleConfig(admin, projectId);
  const res = await admin.fx.request.put(`${PROJECTS_API}/${projectId}/rule-config`, {
    headers: admin.fx.headers,
    data: { baseVersion: revision, body: { overrides } },
  });
  return res.status();
}

/**
 * R0 "clean run": the clean layer plus N22 switching off the rules whose verdict depends on fit-out/egress geometry the seed does not model
 * (no window, escape distance, corridor width, door path, fixtures, furniture-room fit, room-without-door) - real data, real N15 run.
 */
export async function createCleanProject(admin: Admin, slug: string): Promise<RuleProject> {
  const project = await createRuleProject(admin, slug, { shortWall: false, thinWalls: false, clean: true });
  const off = ['ROOM-NO-WINDOW', 'ESCAPE-DISTANCE', 'CORRIDOR-WIDTH', 'DOOR-BLOCKS-PATH', 'FIXTURE-OFF-WALL', 'ROOM-FURNITURE-MISMATCH', 'ROOM-NO-DOOR', 'WINDOW-ON-INNER-WALL'];
  const status = await putRuleConfig(admin, project.id, Object.fromEntries(off.map((code) => [code, { enabled: false }])));
  expect(status, 'setup: PUT rule-config (R0)').toBeLessThan(300);
  return project;
}

/** Overrides that disable every rule except `keep`. */
export const onlyRule = (keep: string): Json =>
  Object.fromEntries(ALL_RULE_CODES.filter((code) => code !== keep).map((code) => [code, { enabled: false }]));

/* ---------------------------------------------------------------- screen helpers */

export const reportHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Kiểm tra quy chuẩn', level: 1 });
export const rerunButton = (page: Page): Locator => page.getByRole('button', { name: 'Kiểm tra lại', exact: true });
export const confirmButton = (page: Page): Locator => page.getByRole('button', { name: 'Sang Xuất', exact: true });
/** Cổng ở thanh bước (FlowGate): còn vi phạm nghiêm trọng thì nút phụ "Xem vi phạm kế" thay cho nút chính "Sang Xuất". */
export const flowGate = (page: Page): Locator => page.getByTestId('flow-gate');
export const nextViolationButton = (page: Page): Locator => flowGate(page).getByRole('button', { name: 'Xem vi phạm kế', exact: true });
/** Hết vi phạm nghiêm trọng nhưng còn cảnh báo chưa xem: cổng mời "Xem cảnh báo" trước khi cho "Sang Xuất". */
export const seeWarningsButton = (page: Page): Locator => flowGate(page).getByRole('button', { name: 'Xem cảnh báo', exact: true });
export const levelFilter = (page: Page): Locator => page.getByRole('radiogroup', { name: 'Lọc theo mức độ', exact: true });
export const groupSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Nhóm luật', exact: true });
export const floorSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Tầng', exact: true });
export const levelRadio = (page: Page, label: string): Locator => levelFilter(page).getByRole('radio', { name: label, exact: true });
export const sheet = (page: Page): Locator => page.getByRole('complementary', { name: 'Chi tiết vi phạm', exact: true }); // VD aside

/** RuleReportGroups.tsx RuleReportSection: the toggle is a button inside an `<h3>` (rule groups AND "Đã xử lý"). */
export const allHeaders = (page: Page): Locator => page.getByRole('heading', { level: 3 }).getByRole('button');
/** Rule-group toggles only (the resolved section is titled "Đã xử lý"). */
export const groupHeaders = (page: Page): Locator => allHeaders(page).filter({ hasNotText: /^Đã xử lý/u });
export const resolvedHeader = (page: Page): Locator => allHeaders(page).filter({ hasText: /^Đã xử lý/u });

export const summaryValue = (page: Page, label: string): Locator =>
  page
    .locator('dl > div')
    .filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`, 'u') }) })
    .locator('dd'); // RuleReportSummary.tsx SummaryStat

/** Opens `/projects/:id/rules` with a fresh document load; waits for its N15 read and for the report to be usable. */
export async function openRules(page: Page, projectId: string): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.rules(projectId), { waitUntil: 'commit' }), 'GET', spatialRe(projectId), [200]);
  await expect(reportHeading(page)).toBeVisible();
  await expect(rerunButton(page)).toBeEnabled();
}

export interface HeaderInfo {
  readonly title: string;
  readonly ruleName: string;
  readonly groupLabel: string;
  readonly summary: string;
  readonly severity: string;
  readonly open: number;
  readonly resolved: number;
  readonly expanded: boolean;
  readonly controls: string;
}

const SUMMARY_RE = /^(Nghiêm trọng|Cảnh báo|Gợi ý) · (\d[\d.]*) mục chưa xử lý(?: · (\d[\d.]*) đã xử lý)?$/u;

/** Title / summary / state of every rule-group header, in report order. */
export async function headerInfos(page: Page): Promise<HeaderInfo[]> {
  const raw = await groupHeaders(page).evaluateAll((buttons) =>
    buttons.map((button) => {
      const spans = Array.from(button.querySelectorAll(':scope > span'));
      // The severity is now a badge leading the title (first span of the left cluster); the right span has only "N mục chưa xử lý ...".
      const left = Array.from(spans[0]?.querySelectorAll(':scope > span') ?? []);
      const badge = (left.length > 1 ? left[0]?.textContent : '') ?? '';
      return {
        title: (left.at(-1)?.textContent ?? '').trim(),
        summary: `${badge.trim()} · ${(spans[1]?.textContent ?? '').trim()}`,
        expanded: button.getAttribute('aria-expanded') === 'true',
        controls: button.getAttribute('aria-controls') ?? '',
      };
    }),
  );
  return raw.map((item) => {
    const cut = item.title.lastIndexOf(' · ');
    const parsed = SUMMARY_RE.exec(item.summary);
    return {
      ...item,
      ruleName: cut < 0 ? item.title : item.title.slice(0, cut),
      groupLabel: cut < 0 ? '' : item.title.slice(cut + 3),
      severity: parsed?.[1] ?? '',
      open: Number((parsed?.[2] ?? '0').replace(/\./gu, '')),
      resolved: Number((parsed?.[3] ?? '0').replace(/\./gu, '')),
    };
  });
}

/** Severity rank for ordering claims: critical 0 < warning 1 < suggestion 2. */
export const SEVERITY_RANK: Readonly<Record<string, number>> = { 'Nghiêm trọng': 0, 'Cảnh báo': 1, 'Gợi ý': 2 };

/** The `<section>` of the group whose title starts with / matches `ruleName`. */
export const ruleSection = (page: Page, ruleName: string | RegExp): Locator =>
  page.locator('section').filter({ has: page.getByRole('heading', { level: 3 }).getByRole('button', { name: ruleName }) });

/** Expands every rule group still collapsed. */
export async function expandAll(page: Page): Promise<void> {
  const buttons = groupHeaders(page);
  const count = await buttons.count();
  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i);
    if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  }
}

/** Expands (if needed) and returns the section of `ruleName`. */
export async function expandRule(page: Page, ruleName: string | RegExp): Promise<Locator> {
  const section = ruleSection(page, ruleName);
  const button = section.getByRole('heading', { level: 3 }).getByRole('button');
  await expect(button).toBeVisible();
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  return section;
}

/** Table rows (desktop) of a section; at < 1024 px the rows are `li` cards. */
export const rowsOf = (section: Locator): Locator => section.locator('tbody tr, ul > li');
/** RuleReportGroups.tsx RowMessage: the message is a button in the "Mô tả" cell / card. */
export const rowMessage = (row: Locator): Locator => row.getByRole('button').filter({ hasNotText: /^Xem$/u }).first();
export const rowView = (row: Locator): Locator => row.getByRole('button', { name: 'Sửa', exact: true });
export const rowCode = (row: Locator): Locator => row.locator('code');

/** Clicks the message of `row` (or the button `from` itself) and waits for the sheet. */
export async function openSheet(page: Page, from: Locator): Promise<Locator> {
  const tag = await from.evaluate((el) => el.tagName);
  await (tag === 'TR' || tag === 'LI' ? rowMessage(from) : from).click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole('heading', { level: 2 })).toBeVisible();
  return sheet(page);
}

/** Opens the first row of the group `ruleName` in the sheet. */
export async function openFirstRowOf(page: Page, ruleName: string | RegExp): Promise<Locator> {
  const section = await expandRule(page, ruleName);
  return openSheet(page, rowsOf(section).first());
}

export const sheetTitle = (page: Page): Locator => sheet(page).getByRole('heading', { level: 2 });

/* ---------------------------------------------------------------- sessions, observers, layer reads */

/** Admin API client (one login) for pool-user fixtures; dispose it when done. */
export async function adminRequest(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

export interface PoolSession {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
}

/** A second browser session signed in as a pool user (one `POST /api/auth/login`). */
export async function poolSession(browser: Browser, user: PoolUser, viewport: Viewport = DESKTOP): Promise<PoolSession> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  try {
    await signInPoolUser(context, user);
    const page = await context.newPage();
    return { context, page, api: watchApi(page) };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** Starts watching the page body for `text` (a transient banner); the returned reader says whether it ever appeared. */
export async function watchText(page: Page, text: string): Promise<() => Promise<boolean>> {
  await page.evaluate((needle) => {
    const w = window as unknown as { __p06w?: Record<string, boolean> };
    const seen = (w.__p06w ??= {});
    seen[needle] = (document.body.textContent ?? '').includes(needle);
    new MutationObserver(() => {
      if ((document.body.textContent ?? '').includes(needle)) seen[needle] = true;
    }).observe(document.body, { characterData: true, childList: true, subtree: true });
  }, text);
  return () => page.evaluate((needle) => (window as unknown as { __p06w?: Record<string, boolean> }).__p06w?.[needle] === true, text);
}

export interface LayerPut {
  readonly path: string;
  readonly status: number;
  readonly baseVersion: number;
  readonly furnitureCount: number;
  revision: number | null;
}

/** Every `PUT …/floors/:f/spatial/layer` the page sends (request body + answer), in order. */
export function trackLayerPuts(page: Page): LayerPut[] {
  const puts: LayerPut[] = [];
  page.on('response', (response) => {
    const request = response.request();
    const path = new URL(response.url()).pathname;
    if (request.method() !== 'PUT' || !layerPutRe.test(path)) return;
    const sent = request.postDataJSON() as { baseVersion?: number; body?: { layer?: { furniture?: unknown[] } } } | null;
    const entry: LayerPut = {
      path,
      status: response.status(),
      baseVersion: sent?.baseVersion ?? -1,
      furnitureCount: sent?.body?.layer?.furniture?.length ?? -1,
      revision: null,
    };
    puts.push(entry);
    void response
      .json()
      .then((json: { revision?: number }) => {
        entry.revision = typeof json.revision === 'number' ? json.revision : null;
      })
      .catch(() => undefined);
  });
  return puts;
}

/** N16 of a floor by the admin fixture API: revision + furniture ids. */
export async function readFloorLayer(admin: Admin, projectId: string, floorId: string): Promise<{ revision: number; furnitureIds: string[] }> {
  const res = await admin.fx.request.get(layerPathOf(projectId, floorId), { headers: admin.fx.headers });
  expect(res.status(), 'setup: GET …/spatial/layer (N16)').toBe(200);
  const doc = asRecord(await res.json(), 'N16');
  const layer = asRecord(doc.layer, 'N16.layer');
  const furniture = Array.isArray(layer.furniture) ? layer.furniture.map((item) => String(asRecord(item, 'furniture').id)) : [];
  return { revision: Number(doc.revision), furnitureIds: furniture };
}
