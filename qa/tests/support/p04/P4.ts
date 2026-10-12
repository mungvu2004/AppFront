/**
 * QA-04c agent P4 helpers (SCR-19 axes / grids, SCR-21 thickness). Used by `phase04_grids_*` and `phase04_thickness_*`
 * only; the shared seeds stay in `../phase03Seed.ts`, `../layerSeed.ts` (re-used, not edited).
 *
 * - Layer builders (all through the REAL #35 `PUT …/spatial/layer`, like `layerSeed.ts`): `gridsRect`, `gridsRules`,
 *   `gridsTwoFloors`, `gridsUiProject`, `thkMix`, `thkTol`, `thkSpread`, `thkReapply`, `thkEntries`, `thkUiProject`.
 *   Each returns the project + the wall ids in order, so a flow reads the screen's own codes (`displayCodesOf`).
 * - `canvasMm` / `dragAxis`: the SCR-19 canvas is an SVG whose viewBox is fitted to the grid; mm -> screen goes through
 *   `getScreenCTM()` (px = mm / 50, the fixture scale, AGG:331), so a drag lands on a millimetre, not on a guess.
 * - Small readers: `viNumber` ("1.000 mm" -> 1000), `fieldText` (FieldRow value), `optionNames`, `wallCode`.
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { displayCodesOf } from '../../../../src/domain/spatial/ids';
import { createStackProject, type FloorDraft } from '../p03/P5';
import { layerPathOf, writeLayer, type LayerApi } from '../layerSeed';
import type { SeededProject } from '../phase03Seed';

export type Json = Record<string, unknown>;
export type Pt = readonly [number, number];

export const DESKTOP = { width: 1440, height: 900 } as const;

/* ---------------------------------------------------------------- walls */

export interface WallSpec {
  readonly from: Pt;
  readonly to: Pt;
  readonly kind?: 'loadBearing' | 'partition' | 'envelope';
  readonly thicknessMm?: number;
  /** A5: only a human reviews (`source: 'human'`, `confidence: 1`). */
  readonly reviewed?: boolean;
  readonly confidence?: number;
  readonly heightMm?: number;
}

/** W4 id `W-<base36 UPPER 20>` (BE packages/core/ids.py:23-31). */
export const newWallId = (): string => `W-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;

const wallJson = (levelId: string, id: string, spec: WallSpec): Json => ({
  ...(spec.reviewed === true
    ? { confidence: 1, reviewed: true, source: 'human' }
    : { confidence: spec.confidence ?? 0.9, reviewed: false, source: 'ai' }),
  centreline: { start: { x: spec.from[0], y: spec.from[1] }, end: { x: spec.to[0], y: spec.to[1] } },
  heightMm: spec.heightMm ?? 3_000,
  id,
  kind: spec.kind ?? 'loadBearing',
  levelId,
  openingIds: [],
  thicknessMm: spec.thicknessMm ?? 220,
});

/** Adapter: fixture calls of a signed-in API context (`signedInApi` carries the Bearer already). */
export const layerApiOf = (api: APIRequestContext): LayerApi => ({ request: api, headers: {} });

/** Replaces the whole layer of a floor by `specs` (walls only); returns the wall ids in `specs` order. */
export async function seedWalls(api: APIRequestContext, projectId: string, floorId: string, specs: readonly WallSpec[]): Promise<string[]> {
  const ids = specs.map(() => newWallId());
  await writeLayer(layerApiOf(api), projectId, floorId, (levelId) => ({
    walls: specs.map((spec, index) => wallJson(levelId, ids[index] as string, spec)),
    openings: [],
    rooms: [],
    furniture: [],
  }));
  return ids;
}

/** `PUT` of a floor scale alone (written BEFORE the walls: a scale change re-converts unreviewed entities). */
export async function seedScale(api: APIRequestContext, projectId: string, floorId: string, mmPerPx: number): Promise<void> {
  const path = layerPathOf(projectId, floorId);
  const read = await api.get(path);
  expect(read.status(), `setup: GET ${path}`).toBe(200);
  const revision = ((await read.json()) as { revision: number }).revision;
  const put = await api.put(path, { data: { baseVersion: revision, body: { scaleMillimetresPerPixel: mmPerPx } } });
  expect(put.status(), `setup: PUT ${path} (scale): ${(await put.text()).slice(0, 300)}`).toBe(200);
}

/** Eight load-bearing segments of the rectangle `w` x `h` at (x0, y0): two collinear walls per side. */
export function rectSegments(x0: number, y0: number, w: number, h: number, extra: Partial<WallSpec> = {}): WallSpec[] {
  const xm = x0 + w / 2;
  const ym = y0 + h / 2;
  const x1 = x0 + w;
  const y1 = y0 + h;
  const seg = (from: Pt, to: Pt): WallSpec => ({ from, to, ...extra });
  return [
    seg([x0, y0], [xm, y0]),
    seg([xm, y0], [x1, y0]),
    seg([x0, y1], [xm, y1]),
    seg([xm, y1], [x1, y1]),
    seg([x0, y0], [x0, ym]),
    seg([x0, ym], [x0, y1]),
    seg([x1, y0], [x1, ym]),
    seg([x1, ym], [x1, y1]),
  ];
}

/** A `cols` x `rows` grid of lines, each line two collinear walls (every line is an axis; the lines cross). */
export function gridSegments(cols: number, rows: number, pitch: number): WallSpec[] {
  const specs: WallSpec[] = [];
  const spanX = (cols - 1) * pitch;
  const spanY = (rows - 1) * pitch;
  for (let row = 0; row < rows; row += 1) {
    specs.push({ from: [0, row * pitch], to: [spanX / 2, row * pitch] }, { from: [spanX / 2, row * pitch], to: [spanX, row * pitch] });
  }
  for (let col = 0; col < cols; col += 1) {
    specs.push({ from: [col * pitch, 0], to: [col * pitch, spanY / 2] }, { from: [col * pitch, spanY / 2], to: [col * pitch, spanY] });
  }
  return specs;
}

/** The slug-named project of this run with `floors` drafts; floor names "Tầng 1..n" unless given. */
const floorDrafts = (names: readonly string[], heights: readonly number[] = []): FloorDraft[] =>
  names.map((name, index) => ({ name, elevationMm: index * 3_000, heightMm: heights[index] ?? 3_000 }));

export interface Built {
  readonly project: SeededProject;
  /** Floor ids in floor order. */
  readonly floorIds: readonly string[];
  /** Wall ids per floor, in the order of the specs written. */
  readonly walls: readonly (readonly string[])[];
  /** The specs written per floor (`null` = floor left without a layer), for {@link reseed}. */
  readonly specs: readonly (readonly WallSpec[] | null)[];
}

async function build(
  api: APIRequestContext,
  slug: string,
  names: readonly string[],
  specsPerFloor: readonly (readonly WallSpec[] | null)[],
  options: { readonly heights?: readonly number[]; readonly scaleMmPerPx?: number } = {},
): Promise<Built> {
  const project = await createStackProject(api, slug, floorDrafts(names, options.heights));
  const walls: string[][] = [];
  for (const [index, floor] of project.floors.entries()) {
    const specs = specsPerFloor[index] ?? null;
    if (options.scaleMmPerPx !== undefined) await seedScale(api, project.projectId, floor.id, options.scaleMmPerPx);
    walls.push(specs === null ? [] : await seedWalls(api, project.projectId, floor.id, specs));
  }
  return { project, floorIds: project.floors.map((floor) => floor.id), walls, specs: specsPerFloor };
}

/** Writes the floor's original specs again (new wall ids, higher revision): resets a floor a state has changed. */
export async function reseed(api: APIRequestContext, built: Built, index: number): Promise<string[]> {
  const specs = built.specs[index];
  if (specs === null || specs === undefined) return [];
  return seedWalls(api, built.project.projectId, built.floorIds[index] as string, specs);
}

/* ---------------------------------------------------------------- SCR-19 builders */

/** Rectangle origin used by every SCR-19 seed: the plan origin (0, 0) is NOT on an axis, so the offsets are not 0. */
export const RECT = { x0: 1_000, y0: 500, w: 8_000, h: 6_000 } as const;

/** Snap stubs of FL-19-03 (vertices on the axis start line y = 500; D1 / D2 are parallel diagonals, never axes). */
export const STUBS: readonly WallSpec[] = [
  { from: [13_000, 500], to: [18_000, 500] },
  { from: [9_100, 500], to: [11_000, 1_500] },
  { from: [9_199, 500], to: [11_099, 1_500] },
];

/** `QC:grids-rect`: rectangle 8000 x 6000 at (1000, 500), 8 segments; `stubs` adds {@link STUBS}; `scaleMmPerPx` sets the floor scale first. */
export function gridsRect(
  api: APIRequestContext,
  slug: string,
  options: { readonly stubs?: boolean; readonly scaleMmPerPx?: number } = {},
): Promise<Built> {
  const walls = [...rectSegments(RECT.x0, RECT.y0, RECT.w, RECT.h), ...(options.stubs === true ? STUBS : [])];
  return build(api, slug, ['Tầng 1'], [walls], options.scaleMmPerPx === undefined ? {} : { scaleMmPerPx: options.scaleMmPerPx });
}

/**
 * `QX:grids-rules`, one floor per detection rule: [0] empty, [1] horizontal lines only, [2] one wall per side,
 * [3] partition rectangle, [4] a 10 x 10 grid.
 */
export function gridsRules(api: APIRequestContext, slug: string): Promise<Built> {
  const horizontalOnly: WallSpec[] = [
    { from: [1_000, 500], to: [5_000, 500] },
    { from: [5_000, 500], to: [9_000, 500] },
    { from: [1_000, 3_500], to: [5_000, 3_500] },
    { from: [5_000, 3_500], to: [9_000, 3_500] },
  ];
  const singles: WallSpec[] = [
    { from: [1_000, 500], to: [9_000, 500] },
    { from: [9_000, 500], to: [9_000, 6_500] },
    { from: [9_000, 6_500], to: [1_000, 6_500] },
    { from: [1_000, 6_500], to: [1_000, 500] },
  ];
  return build(
    api,
    slug,
    ['Tầng trống', 'Tầng một hướng', 'Tầng mỗi cạnh một tường', 'Tầng tường ngăn', 'Tầng lưới 10x10'],
    [null, horizontalOnly, singles, rectSegments(RECT.x0, RECT.y0, RECT.w, RECT.h, { kind: 'partition' }), gridSegments(10, 10, 3_000)],
  );
}

/**
 * `QX:grids-2floors`: F1 = rectangle, F2 = the same rectangle moved by `shiftMm` in x (alignment may translate, so a pure
 * shift leaves a residual of 0) and / or made `widenMm` wider (a non-rigid difference: the residual is `widenMm / 2`);
 * F2 `heightMm` 2000 when `lowF2`.
 */
export function gridsTwoFloors(
  api: APIRequestContext,
  slug: string,
  options: { readonly shiftMm?: number; readonly widenMm?: number; readonly lowF2?: boolean } = {},
): Promise<Built> {
  const shift = options.shiftMm ?? 200;
  return build(
    api,
    slug,
    ['Tầng 1', 'Tầng 2'],
    [rectSegments(RECT.x0, RECT.y0, RECT.w, RECT.h), rectSegments(RECT.x0 + shift, RECT.y0, RECT.w + (options.widenMm ?? 0), RECT.h)],
    options.lowF2 === true ? { heights: [3_000, 2_000] } : {},
  );
}

/** `QX:grids-ui`: [0] rectangle floor, [1] / [2] a 2-floor pair is the project itself, [3] empty floor. */
export function gridsUiProject(api: APIRequestContext, slug: string): Promise<Built> {
  return build(
    api,
    slug,
    ['Tầng 1', 'Tầng 2', 'Tầng trống'],
    [rectSegments(RECT.x0, RECT.y0, RECT.w, RECT.h), rectSegments(RECT.x0 + 200, RECT.y0, RECT.w, RECT.h), null],
  );
}

/* ---------------------------------------------------------------- SCR-21 builders */

/** A horizontal 4 m wall per entry of `specs`, 1.5 m apart (no wall touches another; no axis matters on SCR-21). */
const thkWalls = (specs: readonly Pick<WallSpec, 'thicknessMm' | 'reviewed' | 'confidence' | 'kind'>[], row0 = 0): WallSpec[] =>
  specs.map((spec, index) => ({ from: [0, (row0 + index) * 1_500], to: [4_000, (row0 + index) * 1_500], kind: 'partition', ...spec }));

/** `QC:thk-mix`: 5 x 200 mm, one 150 mm, one 220 mm. */
export const thkMix = (api: APIRequestContext, slug: string): Promise<Built> =>
  build(api, slug, ['Tầng 1'], [thkWalls([...[200, 200, 200, 200, 200, 150, 220].map((thicknessMm) => ({ thicknessMm }))])]);

/**
 * `QX:thk-tol`: floor A 150 / 189 / 190 / 200 mm (+ a 220 mm wall and a reviewed 200 mm wall, so the four row badges
 * "Trung tính" / "Đã duyệt" exist), floor B 200 mm only.
 */
export const thkTol = (api: APIRequestContext, slug: string): Promise<Built> =>
  build(
    api,
    slug,
    ['Tầng A', 'Tầng B'],
    [
      thkWalls([...[150, 189, 190, 200, 220].map((thicknessMm) => ({ thicknessMm })), { thicknessMm: 200, reviewed: true }]),
      thkWalls([{ thicknessMm: 200 }]),
    ],
  );

/** `QC:thk-spread`: 164 / 165 / 180 / 200 / 240 / 275 / 350 / 400 mm. */
export const thkSpread = (api: APIRequestContext, slug: string): Promise<Built> =>
  build(api, slug, ['Tầng 1'], [thkWalls([164, 165, 180, 200, 240, 275, 350, 400].map((thicknessMm) => ({ thicknessMm })))]);

/** `QX:thk-reapply`: [0] reviewed + unreviewed 200 mm, [1] unreviewed 200 mm only, [2] all 220 mm. */
export const thkReapply = (api: APIRequestContext, slug: string): Promise<Built> =>
  build(
    api,
    slug,
    ['Tầng duyệt một phần', 'Tầng chưa duyệt', 'Tầng chuẩn'],
    [
      thkWalls([{ thicknessMm: 200, reviewed: true }, { thicknessMm: 200 }]),
      thkWalls([{ thicknessMm: 200 }, { thicknessMm: 200 }]),
      thkWalls([{ thicknessMm: 220 }, { thicknessMm: 220 }]),
    ],
  );

/** `QX:thk-entries`: [0] no wall, [1] all 220 mm. */
export const thkEntries = (api: APIRequestContext, slug: string): Promise<Built> =>
  build(api, slug, ['Tầng không tường', 'Tầng chuẩn'], [null, thkWalls([{ thicknessMm: 220 }, { thicknessMm: 220 }])]);

/** `QX:thk-ui`: [0] mix, [1] 150 mm, [2] reviewed 200, [3] all 220, [4] no wall. */
export const thkUiProject = (api: APIRequestContext, slug: string): Promise<Built> =>
  build(
    api,
    slug,
    ['Tầng hỗn hợp', 'Tầng 150', 'Tầng đã duyệt', 'Tầng chuẩn', 'Tầng trống'],
    [
      thkWalls([200, 200, 200, 150, 220].map((thicknessMm) => ({ thicknessMm }))),
      thkWalls([{ thicknessMm: 150 }, { thicknessMm: 150 }]),
      thkWalls([{ thicknessMm: 200, reviewed: true }, { thicknessMm: 200 }]),
      thkWalls([{ thicknessMm: 220 }, { thicknessMm: 220 }]),
      null,
    ],
  );

/** The code the SCR-21 table shows for `id` among the floor's walls ("#W-…", `displayCodesOf`). */
export function wallCode(id: string, allIds: readonly string[]): string {
  return `#${displayCodesOf(allIds).get(id) ?? id}`;
}

/* ---------------------------------------------------------------- readers */

/** "1.000 mm" / "-1.000" / "4,5 px" -> number (vi-VN: "." groups, "," decimal). `NaN` when there is no number. */
export function viNumber(text: string): number {
  const found = /-?\d[\d.]*(?:,\d+)?/u.exec(text.replace(/[−–]/gu, '-'));
  if (found === null) return Number.NaN;
  return Number(found[0].replace(/\./gu, '').replace(',', '.'));
}

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** Accessible names of every option in a listbox. */
export async function optionNames(listbox: Locator): Promise<string[]> {
  return listbox.getByRole('option').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''));
}

/* ---------------------------------------------------------------- SCR-19 canvas */

export const CANVAS_LABEL = 'Khung xem bản vẽ quản lý trục và gốc toạ độ';
/** AXIS_GRID_FIXTURE_SCALE (axisGridFixture.ts:331): one canvas unit = 50 mm. */
const MM_PER_CANVAS_UNIT = 50;

export const canvasSvg = (page: Page): Locator => page.locator(`svg[aria-label="${CANVAS_LABEL}"]`);
export const axisGroup = (page: Page, label: string): Locator => canvasSvg(page).locator(`> g[aria-label="${label}"]`);

/** Screen position (CSS px) of the plan point (xMm, yMm) on the canvas, through the svg's own screen matrix. */
export async function canvasPoint(page: Page, xMm: number, yMm: number): Promise<{ x: number; y: number }> {
  return canvasSvg(page).evaluate(
    (svg, [x, y, unit]) => {
      const graphic = svg as unknown as SVGSVGElement;
      const matrix = graphic.getScreenCTM();
      if (matrix === null) throw new Error('canvas has no screen matrix');
      const point = new DOMPoint((x as number) / (unit as number), (y as number) / (unit as number)).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    },
    [xMm, yMm, MM_PER_CANVAS_UNIT] as const,
  );
}

/** Centre of the first end badge of the axis `label` (a filled circle, the grip the pointer takes). */
export async function axisGrip(page: Page, label: string): Promise<{ x: number; y: number }> {
  const box = await axisGroup(page, label).locator('circle').first().boundingBox();
  if (box === null) throw new Error(`axis "${label}" has no badge on the canvas`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Drags axis `label` to the plan coordinate `toMm` (x for a vertical axis, y for a horizontal one) with the real mouse.
 * The canvas viewBox follows the grid extent, so the screen target is recomputed after every move until it stops
 * moving (the axis snaps, the extent settles); then the button is released. `overshootMm` aims past the target so the
 * snap (120 mm capture, grid off) does the final placement.
 */
export async function dragAxis(page: Page, label: string, direction: 'vertical' | 'horizontal', toMm: number, overshootMm = 0): Promise<void> {
  const grip = await axisGrip(page, label);
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  let last = Number.NaN;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const target = await canvasPoint(page, direction === 'vertical' ? toMm + overshootMm : 0, direction === 'horizontal' ? toMm + overshootMm : 0);
    const at = direction === 'vertical' ? target.x : target.y;
    if (Math.abs(at - last) < 0.5) break;
    last = at;
    await page.mouse.move(direction === 'vertical' ? at : grip.x, direction === 'horizontal' ? at : grip.y, { steps: attempt === 0 ? 24 : 2 });
    // one frame so React re-fits the viewBox before the next reading
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  }
  await page.mouse.up();
}

/** The value text of a FieldRow ("Lệch X (mm)") on the origin panel. */
export async function fieldText(page: Page, label: string): Promise<string> {
  const row = page.getByText(label, { exact: true }).locator('xpath=ancestor::div[contains(@class,"min-h-[36px]")][1]');
  return (await row.innerText()).replace(label, '').replace(/\s+/gu, ' ').trim();
}
