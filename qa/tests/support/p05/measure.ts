/**
 * QA-05c P4 helpers — SCR-25 Công cụ đo (`/projects/:id/3d/measure`). Owned by P4; the other measure files (mocked / ui /
 * roles, P5) import from here and do NOT edit it. Source of the selectors: src/screens/viewer/MeasurementTool/* and
 * ViewerShell/* @ master d50bb248 (file:line next to each constant).
 *
 * - Seeds: `seedMeasurements` (#17 POST, expects 201), the record sets R1 / R2 / R3 / RF of flows-C4 "Seeds",
 *   `fillPointBudget` (RL: 100 floorArea records x 200 points = the 20 000-point cap).
 * - Screen: `openMeasure`, `topView`, `startMeasuring`, locators (`overlay`, `list`, `pillTexts`, ...).
 * - Canvas: `canvasOnlyShot` / `settledCanvas` / `expectCanvasChanged` / `geometryOf` / `clickableGeometry` copied from
 *   phase05_3d_viewer.spec.ts:201-330 (that file is not edited; S4 deletes it). No fixed waits: a change is proven by pixels,
 *   a hover by the snap chip, a pick by the next rendered frame.
 * - Picks: the top view is ORTHOGRAPHIC and straight down (src/lib/three/camera/modes.ts, TopMode), so the model's pixel
 *   bounding box gives the whole world -> pixel map. The qcLayer vertex / midpoint sets are symmetric under both flips, so the
 *   map needs no orientation: `hoverUntilSnap` tries the expected pixel of every target of the wanted kind, then a local
 *   spiral, then (fallback) a dense scan, and returns the pixel where the chip really says the label.
 *
 * Budget per flow: 1 admin API login (`adminApi`) + 1 browser login (`openAdminPage`); #17 POSTs of the seeds (no rate limit).
 */
import { inflateSync } from 'node:zlib';

import { expect, type APIRequestContext, type Locator, type Page, type Request } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { navigateThenWaitForApi, waitForApiWhere } from '../../../../e2e/fullstack/apiWatch';
import { TEST_DATA_PREFIX } from '../evidence';
import type { LayerApi } from '../layerSeed';

export { adminApi, closePage, openAdminPage, openPoolPage, DESKTOP, type OpenPage } from '../p03/P4';

export type Json = Record<string, unknown>;
export type Point = readonly [number, number];

/** Slow 3D work under the real BE: scene build, scans over click points. */
export const SCENE_TIMEOUT_MS = 60_000;
/** `UNDO_WINDOW_MS` of the undo ticket (src/lib/mutations/undoTicket.ts:18). */
export const UNDO_WINDOW_MS = 8_000;

/* ---- copy (each verified in src/, file:line) ---- */

export const MT = {
  viewport: 'Khung nhìn mô hình', // VVP:91
  shell: 'Vỏ khung nhìn 3D', // VS:65
  inspector: 'Thanh tra đối tượng', // VIN:55
  overlay: 'Lớp phủ công cụ đo', // MTV:151
  list: 'Phép đo', // MTL:60,201
  emptyHint: 'Chưa có phép đo nào. Nhấn M rồi chọn hai điểm trên mô hình.', // MTV:83, MTL:61
  partialHint: 'Chuỗi đo chưa đóng. Chọn thêm điểm để đóng chuỗi, hoặc nhấn Esc để bỏ.', // MTV:86
  unit: 'Đơn vị', // MTL:62
  collapse: 'Thu gọn mục Phép đo', // MTL:63
  modes: 'Chọn chế độ đo', // MTV:178
  pin: 'Ghim phép đo (phím Enter)', // MTV:200
  drop: 'Bỏ phần đo dở (phím Esc)', // MTV:208
  toggle: 'Bật tắt công cụ đo (phím M)', // MTV:215
  tools: 'Công cụ khung nhìn', // VTR:49
  railMeasure: 'Đo (M)', // UVS:173-177
  railOrbit: 'Quay quanh mô hình (R)', // UVS:167
  preset: 'Góc nhìn sẵn', // VTB:72
  cube: 'Khối định hướng', // VOV:45
  zoomGroup: 'Cụm thu phóng', // VCH:134
  zoomLabel: /^Mức thu phóng (.+), bấm để về mức chuẩn$/u, // VCH:146
  retry: 'Thử lại', // MTV:274
  undo: 'Hoàn tác', // common.undo
  chipSnapNone: 'Chưa bắt vào đâu', // MTT:75-79
  vertex: 'Đỉnh',
  midpoint: 'Trung điểm',
} as const;

export const MODE = {
  p2p: 'Điểm đến điểm',
  perpendicular: 'Vuông góc với bề mặt',
  height: 'Chiều cao',
  floorArea: 'Diện tích mặt sàn',
} as const;

/* ---- small utilities ---- */

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};
export const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;
const VI = (digits: number): Intl.NumberFormat => new Intl.NumberFormat('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** `src/lib/format/measure.ts:121-139`: m 2 decimals, cm 1, mm 0; Vietnamese separators. */
export const formatLength = (rawMm: number, unit: 'm' | 'cm' | 'mm'): string =>
  unit === 'm' ? `${VI(2).format(rawMm / 1000)} m` : unit === 'cm' ? `${VI(1).format(rawMm / 10)} cm` : `${VI(0).format(rawMm)} mm`;
export const formatArea = (rawMm2: number): string => `${VI(2).format(rawMm2 / 1e6)} m²`;
/** "Phép đo 1.235" — `formatNumber(seq)` with vi grouping (MTG:455). */
export const measureName = (sequence: number): string => `Phép đo ${VI(0).format(sequence)}`;
/** `125%` / `87,5%` -> number (VCH:146). */
export const percentOf = (text: string): number => Number.parseFloat(text.replace(/[^\d,]/gu, '').replace(',', '.'));
export const uniqueSlug = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** A project id that is not `prj_<ULID>`: BE answers 404 `project` before any DB read. */
export const unknownProjectId = (): string => `prj_qa-p05m-${uniqueSlug()}`;

export const measurementsRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/measurements$`, 'u');
export const measurementRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/measurements/[^/]+$`, 'u');
export const projectRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}$`, 'u');
export const spatialRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/spatial$`, 'u');
export const ruleConfigRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/rule-config$`, 'u');

/** Fixture calls through an admin `signedInApi` context (Bearer already on the context). */
export const layerOf = (request: APIRequestContext): LayerApi => ({ request, headers: {} });

/* ---- seeds: measurement records (#17) ---- */

export interface MeasurePointWire {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}
export interface MeasureRecord {
  readonly id: string;
  readonly name: string;
  readonly mode: 'pointToPoint' | 'perpendicular' | 'height' | 'floorArea';
  readonly points: readonly MeasurePointWire[];
  readonly rawValueMm: number;
}

/** Run-prefixed record name (cleanup sweeps match the prefix); `id` MS-0003 -> "<prefix>do-0003". */
export const seedName = (id: string): string => `${TEST_DATA_PREFIX}do-${id.slice(3)}`;

const p2p = (id: string, from: MeasurePointWire, to: MeasurePointWire, rawValueMm: number): MeasureRecord => ({
  id,
  name: seedName(id),
  mode: 'pointToPoint',
  points: [from, to],
  rawValueMm,
});

/** R1: MS-0003 p2p (0,0)-(4000,0), raw 4000. */
export const R1: readonly MeasureRecord[] = [p2p('MS-0003', { x: 0, y: 0, z: 0 }, { x: 4000, y: 0, z: 0 }, 4000)];
/** R2: R1 + MS-1234 p2p (the next name groups thousands: "Phép đo 1.235"). */
export const R2: readonly MeasureRecord[] = [...R1, p2p('MS-1234', { x: 0, y: 6000, z: 0 }, { x: 4000, y: 6000, z: 0 }, 4000)];
/** R3: MS-0002 p2p 4 000 · MS-9999 floorArea 3000x2000 with a stored raw of 1 · MS-10000 p2p 12 345,6. */
export const R3: readonly MeasureRecord[] = [
  p2p('MS-0002', { x: 0, y: 0, z: 0 }, { x: 4000, y: 0, z: 0 }, 4000),
  {
    id: 'MS-9999',
    name: seedName('MS-9999'),
    mode: 'floorArea',
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 3000, y: 0, z: 0 },
      { x: 3000, y: 2000, z: 0 },
      { x: 0, y: 2000, z: 0 },
    ],
    rawValueMm: 1,
  },
  p2p('MS-10000', { x: 0, y: 0, z: 0 }, { x: 12345.6, y: 0, z: 0 }, 12345.6),
];
/** RF: one record without `z` (B-024) and one far outside the model (B-025). */
export const RF: readonly MeasureRecord[] = [
  p2p('MS-0001', { x: 1000, y: 1000 }, { x: 3000, y: 1000 }, 2000),
  p2p('MS-0002', { x: 500000, y: 500000 }, { x: 504000, y: 500000 }, 4000),
];

/** #17 POST of every record in order; each must answer 201 (BE measurements/router.py:30-38). */
export async function seedMeasurements(api: APIRequestContext, projectId: string, records: readonly MeasureRecord[]): Promise<void> {
  for (const record of records) {
    const res = await api.post(`/api/projects/${projectId}/measurements`, { data: record });
    expect(res.status(), `setup: POST measurements ${record.id}: ${(await res.text()).slice(0, 200)}`).toBe(201);
  }
}

/** One #17 record by hand — "another session" (`+X`) and the A/B bodies of the id-taken flows. */
export async function postMeasurement(api: APIRequestContext, projectId: string, record: MeasureRecord): Promise<number> {
  return (await api.post(`/api/projects/${projectId}/measurements`, { data: record })).status();
}

/** Area of a polygon, mm² (shoelace) — the raw value of a seeded floorArea record. */
function shoelace(points: readonly MeasurePointWire[]): number {
  let sum = 0;
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length] ?? a;
    sum += a.x * b.y - b.x * a.y;
  });
  return Math.abs(sum) / 2;
}

/**
 * RL: 100 floorArea records of 200 points = 20 000 points, the project cap (BE measurements/settings.py:
 * measurement_points_total_max); 8 parallel POSTs. Ids MS-0001..MS-0100, names `<prefix>do-NNNN`.
 */
export async function fillPointBudget(api: APIRequestContext, projectId: string): Promise<void> {
  const records: MeasureRecord[] = Array.from({ length: 100 }, (_, index) => {
    const id = `MS-${String(index + 1).padStart(4, '0')}`;
    const points = Array.from({ length: 200 }, (_, k) => ({
      x: round6(1000 + 900 * Math.cos((2 * Math.PI * k) / 200)),
      y: round6(1000 + 900 * Math.sin((2 * Math.PI * k) / 200)),
      z: 0,
    }));
    return { id, name: seedName(id), mode: 'floorArea', points, rawValueMm: round6(shoelace(points)) };
  });
  for (let at = 0; at < records.length; at += 8) {
    await Promise.all(records.slice(at, at + 8).map((record) => seedMeasurements(api, projectId, [record])));
  }
}

/* ---- screen: locators ---- */

export const viewport = (page: Page): Locator => page.getByRole('main', { name: MT.viewport, exact: true });
export const overlay = (page: Page): Locator => page.getByRole('region', { name: MT.overlay, exact: true });
export const list = (page: Page): Locator => page.getByRole('region', { name: MT.list, exact: true });
export const toolRail = (page: Page): Locator => page.getByRole('toolbar', { name: MT.tools, exact: true });
export const railTool = (page: Page, label: string): Locator => toolRail(page).getByRole('button', { name: label, exact: true });
export const pinButton = (page: Page): Locator => page.getByRole('button', { name: MT.pin, exact: true });
export const dropButton = (page: Page): Locator => page.getByRole('button', { name: MT.drop, exact: true });
export const toggleButton = (page: Page): Locator => page.getByRole('button', { name: MT.toggle, exact: true });
export const modeRadio = (page: Page, label: string): Locator =>
  page.getByRole('radiogroup', { name: MT.modes, exact: true }).getByRole('radio', { name: label, exact: true });
export const unitSelect = (page: Page): Locator => page.getByRole('combobox', { name: MT.unit, exact: true });
export const snapChip = (page: Page): Locator => overlay(page).getByRole('status');
/** `<li>` of a seeded / pinned row (its eye button is "Ẩn {name}" or "Hiện {name}"). */
export const rowOf = (page: Page, name: string): Locator =>
  list(page).getByRole('listitem').filter({ has: page.getByRole('button', { name: new RegExp(`^(Ẩn|Hiện) ${escapeRegExp(name)}$`, 'u') }) });
export const eye = (page: Page, name: string): Locator => page.getByRole('button', { name: new RegExp(`^(Ẩn|Hiện) ${escapeRegExp(name)}$`, 'u') });
/** Value pills of the overlay (MTO:262-286: `div.font-mono` inside the overlay region). */
export const pills = (page: Page): Locator => overlay(page).locator('div.font-mono');
export const pillWith = (page: Page, text: string): Locator => pills(page).filter({ hasText: text });
export const toastWith = (page: Page, text: string | RegExp): Locator => page.getByRole('status').filter({ hasText: text });
export const dialogs = (page: Page): Locator => page.getByRole('dialog');

/** Every pill's text, in DOM order (the draft pill, when any, comes last: MTO:421-430). */
export const pillTexts = async (page: Page): Promise<string[]> =>
  (await pills(page).allInnerTexts()).map((text) => text.trim());
/** Text of the snap chip. */
export const chipText = async (page: Page): Promise<string> => ((await snapChip(page).first().textContent()) ?? '').trim();

/** `Mức thu phóng X%, ...` -> X (VCH:146). */
export async function zoomPercent(page: Page): Promise<number> {
  const label = await page.getByRole('group', { name: MT.zoomGroup, exact: true }).getByRole('button', { name: MT.zoomLabel }).getAttribute('aria-label');
  return percentOf(MT.zoomLabel.exec(label ?? '')?.[1] ?? '');
}

/** The next frame the browser renders after the page's React state had a chance to commit (two rAFs; not a time wait). */
export const nextFrames = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

/** Writes (not GET, not session / telemetry chatter) in an `ApiEntry` log since `mark`. */
export const writesSince = (log: readonly { method: string; path: string; status: number }[], mark: number): string[] =>
  log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.path !== '/api/auth/refresh' && !entry.path.startsWith('/api/telemetry'))
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

/** `null` when Playwright's actionability check (trial click) passes on `target`; else why not (BUG-495). */
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

/* ---- screen: open, tool, view ---- */

/** Deep link with a fresh document load; waits for the #16 read (200) and for the viewport to stop being busy. */
export async function openMeasure(page: Page, projectId: string): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.measure(projectId), { waitUntil: 'commit' }), 'GET', measurementsRe(projectId), [200]);
  await expect(viewport(page)).toHaveAttribute('aria-busy', 'false', { timeout: SCENE_TIMEOUT_MS });
}

/** Select "Góc nhìn sẵn" -> "Trên xuống" (VTB:66-86); resolves when the select shows it. */
export async function topView(page: Page): Promise<void> {
  const select = page.getByRole('combobox', { name: MT.preset, exact: true });
  await select.click();
  await page.getByRole('option', { name: 'Trên xuống', exact: true }).click();
  await expect(select).toHaveText('Trên xuống');
  await settledCanvas(page);
}

/** Focus the viewport and press `key` (canvas-scope shortcuts need focus: VVP:116 `tabIndex=-1`). */
export async function pressOnCanvas(page: Page, key: string): Promise<void> {
  await viewport(page).focus();
  await page.keyboard.press(key);
}

/** Key M with the viewport focused; "Đo (M)" is then pressed. */
export async function startMeasuring(page: Page): Promise<void> {
  if ((await railTool(page, MT.railMeasure).getAttribute('aria-pressed')) !== 'true') await pressOnCanvas(page, 'm');
  await expect(railTool(page, MT.railMeasure)).toHaveAttribute('aria-pressed', 'true');
}

/** Pointer well off the canvas (no hover highlight in the next frames). */
export const pointerAway = async (page: Page): Promise<void> => {
  await page.mouse.move(5, 5);
};

/* ---- canvas pixels (minimal PNG decoder, node:zlib) ---- */

interface Raster {
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly data: Uint8Array;
}

/** 8-bit RGB / RGBA, non-interlaced — what Chromium screenshots produce. Throws otherwise. */
function decodePng(png: Buffer): Raster {
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (pos + 8 <= png.length) {
    const length = png.readUInt32BE(pos);
    const type = png.toString('latin1', pos + 4, pos + 8);
    const body = png.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const bitDepth = body[8];
      const colorType = body[9];
      const interlace = body[12];
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
        throw new Error(`PNG not supported: depth ${String(bitDepth)}, colour ${String(colorType)}, interlace ${String(interlace)}`);
      }
      channels = colorType === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + length;
  }
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? (out[dst + x - channels] ?? 0) : 0;
      const b = y > 0 ? (out[dst - stride + x] ?? 0) : 0;
      const c = x >= channels && y > 0 ? (out[dst - stride + x - channels] ?? 0) : 0;
      const v = raw[src + x] ?? 0;
      let predicted: number;
      if (filter === 0) predicted = 0;
      else if (filter === 1) predicted = a;
      else if (filter === 2) predicted = b;
      else if (filter === 3) predicted = (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else throw new Error(`PNG filter ${String(filter)} unknown`);
      out[dst + x] = (v + predicted) & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

export interface CanvasShot {
  readonly png: Buffer;
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

/** Screenshot of the viewport canvas with every DOM overlay of the viewport hidden (CSSOM only, restored right after). */
export async function canvasOnlyShot(page: Page): Promise<CanvasShot> {
  const main = viewport(page);
  const box = await main.locator('canvas').first().boundingBox();
  if (box === null) throw new Error('viewport canvas has no bounding box');
  // A handle, not the role locator: `visibility: hidden` drops <main> from the accessibility tree (BUG-494).
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

/** Fails unless the canvas pixels change from `before`; returns the settled new frame. */
export async function expectCanvasChanged(page: Page, before: CanvasShot, what: string): Promise<CanvasShot> {
  await expect
    .poll(async () => !(await canvasOnlyShot(page)).png.equals(before.png), {
      message: `${what}: canvas pixels identical (the camera / scene did not change)`,
      timeout: SCENE_TIMEOUT_MS,
    })
    .toBe(true);
  return settledCanvas(page);
}

/** True when the canvas pixels still equal `before` after the next frames (used for "nothing moved"). */
export async function canvasUnchanged(page: Page, before: CanvasShot): Promise<boolean> {
  await nextFrames(page);
  return (await canvasOnlyShot(page)).png.equals(before.png);
}

export interface Geometry {
  /** Share of sampled pixels that are not the background colour. */
  readonly fraction: number;
  /** Page coordinates of sampled geometry pixels, on a 24 px lattice, nearest to the canvas centre first. */
  readonly points: readonly Point[];
  /** Page-coordinate bounding box of every geometry sample (null when none). */
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
}

/** Background = dominant colour of a 4 px sample grid; geometry = |dR|+|dG|+|dB| > 30 from it. */
export function geometryOf(shot: CanvasShot): Geometry {
  const raster = decodePng(shot.png);
  const scale = raster.width / shot.box.width;
  const step = Math.max(1, Math.round(4 * scale));
  const pixel = (x: number, y: number): readonly [number, number, number] => {
    const at = (y * raster.width + x) * raster.channels;
    return [raster.data[at] ?? 0, raster.data[at + 1] ?? 0, raster.data[at + 2] ?? 0];
  };
  const counts = new Map<number, { n: number; rgb: readonly [number, number, number] }>();
  const samples: { x: number; y: number; rgb: readonly [number, number, number] }[] = [];
  for (let y = 0; y < raster.height; y += step) {
    for (let x = 0; x < raster.width; x += step) {
      const rgb = pixel(x, y);
      const key = ((rgb[0] >> 3) << 10) | ((rgb[1] >> 3) << 5) | (rgb[2] >> 3);
      const entry = counts.get(key);
      if (entry === undefined) counts.set(key, { n: 1, rgb });
      else entry.n += 1;
      samples.push({ x, y, rgb });
    }
  }
  const background = [...counts.values()].sort((left, right) => right.n - left.n)[0]?.rgb ?? [0, 0, 0];
  const isGeometry = (rgb: readonly [number, number, number]): boolean =>
    Math.abs(rgb[0] - background[0]) + Math.abs(rgb[1] - background[1]) + Math.abs(rgb[2] - background[2]) > 30;
  const geometry = samples.filter((sample) => isGeometry(sample.rgb));
  const centre: Point = [shot.box.x + shot.box.width / 2, shot.box.y + shot.box.height / 2];
  const inside = ([x, y]: Point): boolean =>
    x > shot.box.x + 24 && x < shot.box.x + shot.box.width - 24 && y > shot.box.y + 24 && y < shot.box.y + shot.box.height - 24;
  const points = geometry
    .map((sample): Point => [shot.box.x + sample.x / scale, shot.box.y + sample.y / scale])
    .filter(inside)
    .filter(([x, y]) => Math.round(x - shot.box.x) % 24 < 4 && Math.round(y - shot.box.y) % 24 < 4)
    .sort((p, q) => Math.hypot(p[0] - centre[0], p[1] - centre[1]) - Math.hypot(q[0] - centre[0], q[1] - centre[1]));
  const all = geometry.map((sample): Point => [shot.box.x + sample.x / scale, shot.box.y + sample.y / scale]);
  const bounds =
    all.length === 0
      ? null
      : (() => {
          const xs = all.map((p) => p[0]);
          const ys = all.map((p) => p[1]);
          const x = Math.min(...xs);
          const y = Math.min(...ys);
          return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
        })();
  return { fraction: samples.length === 0 ? 0 : geometry.length / samples.length, points, bounds };
}

/** The element a click at (x, y) would reach, or `null` when it is the canvas itself. */
async function blockerAt(page: Page, [x, y]: Point): Promise<string | null> {
  return page.evaluate(
    ([px, py]) => {
      const hit = document.elementFromPoint(px ?? 0, py ?? 0);
      if (hit === null) return 'nothing';
      if (hit.tagName === 'CANVAS') return null;
      const label = hit.getAttribute('aria-label');
      return `${hit.tagName.toLowerCase()}${label === null ? '' : `[aria-label="${label}"]`}`;
    },
    [x, y],
  );
}

/** Geometry points that a click really delivers to the canvas (at most 15), plus what blocked the others. */
export async function clickableGeometry(page: Page, geometry: Geometry): Promise<{ points: Point[]; blockers: Set<string> }> {
  const points: Point[] = [];
  const blockers = new Set<string>();
  for (const point of geometry.points) {
    if (points.length >= 15) break;
    const blocker = await blockerAt(page, point);
    if (blocker === null) points.push(point);
    else blockers.add(blocker);
  }
  return { points, blockers };
}

/* ---- picks on the seeded layer (top view, orthographic) ---- */

/** qcLayer wall ends (support/layerSeed.ts qcLayer): the 12 "Đỉnh" targets of the 8 x 6 m model, mm. */
export const SEED_VERTICES: readonly Point[] = [
  [0, 0], [4000, 0], [8000, 0], [0, 3000], [0, 6000], [4000, 6000], [8000, 6000], [8000, 3000],
  [1000, 2000], [7000, 2000], [1000, 4000], [7000, 4000],
];
/** Midpoints of the 10 walls ("Trung điểm"). */
export const SEED_MIDPOINTS: readonly Point[] = [
  [2000, 0], [6000, 0], [2000, 6000], [6000, 6000], [0, 1500], [0, 4500], [8000, 1500], [8000, 4500], [4000, 2000], [4000, 4000],
];
/** The four outer corners, in perimeter order. */
export const SEED_CORNERS: readonly Point[] = [[0, 0], [8000, 0], [8000, 6000], [0, 6000]];
const MODEL_WIDTH_MM = 8_000 + 220;
const MODEL_DEPTH_MM = 6_000 + 220;

/** A sampled point is "on" a target when this close (mm) — `SNAP` capture radius is 120 mm (src/domain/units/snap.ts:65). */
export const CAPTURE_MM = 120;

type Bounds = NonNullable<Geometry['bounds']>;

/**
 * Pixel of each world target, from the model's pixel bounds. The 8 x 6 m rectangle is wider than deep, so a bounds
 * width/height < 1 means the plan is turned a quarter; the vertex / midpoint sets are symmetric under every flip, so the
 * returned pixels cover the real ones whatever the mirroring.
 */
export function targetPixels(bounds: Bounds, targets: readonly Point[]): Point[] {
  const swap = bounds.width / bounds.height < 1;
  const scale = bounds.width / (swap ? MODEL_DEPTH_MM : MODEL_WIDTH_MM);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  return targets.map(([wx, wy]): Point => {
    const dx = wx - 4_000;
    const dy = wy - 3_000;
    return swap ? [cx + dy * scale, cy + dx * scale] : [cx + dx * scale, cy + dy * scale];
  });
}

/** The pixel size of one mm in the plan (for spiral radii). */
export const pxPerMm = (bounds: Bounds): number => bounds.width / (bounds.width / bounds.height < 1 ? MODEL_DEPTH_MM : MODEL_WIDTH_MM);

/** Model bounds in page pixels from a settled canvas (throws when the canvas is blank). */
export async function modelBounds(page: Page): Promise<Bounds> {
  const bounds = geometryOf(await settledCanvas(page)).bounds;
  if (bounds === null) throw new Error('canvas shows only its background colour (no model pixels)');
  return bounds;
}

/** Spiral of offsets around (0,0): ring r = 0, step, 2 step ... up to `radius`, 8 points per ring step. */
function* spiral(radius: number, step: number): Generator<Point> {
  yield [0, 0];
  for (let r = step; r <= radius; r += step) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / step));
    for (let k = 0; k < n; k += 1) yield [Math.cos((2 * Math.PI * k) / n) * r, Math.sin((2 * Math.PI * k) / n) * r];
  }
}

/** Moves to (x, y) and waits (event, not time) until the metered hover cast (raycast.ts, 34 ms) has settled on `label`. */
async function hoverShows(page: Page, [x, y]: Point, label: string): Promise<boolean> {
  await page.mouse.move(x, y);
  return page
    .waitForFunction(
      ([text, region]) =>
        (document.querySelector(`[aria-label="${region ?? ''}"] [role="status"]`)?.textContent ?? '').trim() === text,
      [label, MT.overlay] as const,
      { timeout: 250 },
    )
    .then(
      () => true,
      () => false,
    );
}

export interface HoverOptions {
  /** Pixels already used; a candidate closer than `minDistPx` to any of them is skipped (a second, different vertex). */
  readonly avoid?: readonly Point[];
  readonly minDistPx?: number;
  /** Only try the spiral around these pixels instead of every target of the kind. */
  readonly near?: readonly Point[];
}

/**
 * Hovers until the snap chip says `label` ("Đỉnh" / "Trung điểm") and returns the pixel. Order: the expected pixel of each
 * target of that kind (+ a 16 px spiral around it), then a dense scan of the model bounds. Throws when nothing snaps.
 */
export async function hoverUntilSnap(page: Page, label: typeof MT.vertex | typeof MT.midpoint, options: HoverOptions = {}): Promise<Point> {
  const bounds = await modelBounds(page);
  const targets = options.near ?? targetPixels(bounds, label === MT.vertex ? SEED_VERTICES : SEED_MIDPOINTS);
  const minDist = options.minDistPx ?? 24;
  const apart = (p: Point): boolean => (options.avoid ?? []).every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= minDist);
  const step = Math.max(2, pxPerMm(bounds) * 50);
  for (const target of targets) {
    if (!apart(target)) continue;
    for (const [dx, dy] of spiral(Math.max(12, pxPerMm(bounds) * 110), step)) {
      const candidate: Point = [target[0] + dx, target[1] + dy];
      if (apart(candidate) && (await hoverShows(page, candidate, label))) return candidate;
    }
  }
  const dense = Math.max(4, Math.round(pxPerMm(bounds) * 100));
  for (let y = bounds.y; y <= bounds.y + bounds.height; y += dense) {
    for (let x = bounds.x; x <= bounds.x + bounds.width; x += dense) {
      if (apart([x, y]) && (await hoverShows(page, [x, y], label))) return [x, y];
    }
  }
  throw new Error(`no hover over the model made the snap chip say "${label}" (bounds ${JSON.stringify(bounds)})`);
}

/** Hover near `pixel` until the chip says `label`; returns the pixel that snapped. */
export const hoverNear = (page: Page, label: typeof MT.vertex | typeof MT.midpoint, pixel: Point): Promise<Point> =>
  hoverUntilSnap(page, label, { near: [pixel] });

/** The four outer corners of the model as snap pixels, in perimeter order (each a "Đỉnh"; unique by construction). */
export async function cornerPixels(page: Page): Promise<Point[]> {
  const bounds = await modelBounds(page);
  return targetPixels(bounds, SEED_CORNERS);
}

/** A click at a pixel, then the next frames so the pick has been committed to React state. */
export async function clickAt(page: Page, [x, y]: Point): Promise<void> {
  await page.mouse.click(x, y);
  await nextFrames(page);
}

/** Hover until `label`, click there, return the pixel. */
export async function pickSnap(page: Page, label: typeof MT.vertex | typeof MT.midpoint, options: HoverOptions = {}): Promise<Point> {
  const point = await hoverUntilSnap(page, label, options);
  await clickAt(page, point);
  return point;
}

/** A model pixel farther than 3 capture radii from every target (a wall face / slab): for unsnapped picks. */
export async function offTargetPixel(page: Page): Promise<Point> {
  const bounds = await modelBounds(page);
  const targets = [...targetPixels(bounds, SEED_VERTICES), ...targetPixels(bounds, SEED_MIDPOINTS)];
  const minPx = 3 * CAPTURE_MM * pxPerMm(bounds);
  const geometry = geometryOf(await settledCanvas(page));
  const far = geometry.points.filter((p) => targets.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) > minPx));
  const { points } = await clickableGeometry(page, { ...geometry, points: far });
  const first = points[0];
  if (first === undefined) throw new Error('no model pixel farther than 3 capture radii from every target');
  return first;
}

/* ---- request capture ---- */

export interface Sent {
  readonly status: number;
  /** The JSON the page sent. */
  readonly sent: Json;
  /** The JSON answered. */
  readonly answer: unknown;
  readonly request: Request;
}

/** Waits for the next `method` request to #17 / #18 paths whose status is in `statuses`; call BEFORE the click. */
export function nextSent(page: Page, method: 'POST' | 'DELETE', pattern: RegExp, statuses: readonly number[]): Promise<Sent> {
  return waitForApiWhere(
    page,
    (response) => response.request().method() === method && pattern.test(new URL(response.url()).pathname) && statuses.includes(response.status()),
    30_000,
    `${method} ${pattern.source}`,
  ).then(({ response, json }) => ({
    status: response.status(),
    sent: method === 'POST' ? asRecord(response.request().postDataJSON(), `${method} body`) : {},
    answer: json,
    request: response.request(),
  }));
}

/** The record the page sent in a #17 POST body, typed (points as [x, y, z?]). */
export function sentPoints(sent: Json): { x: number; y: number; z: number | undefined }[] {
  const points = sent.points;
  if (!Array.isArray(points)) throw new Error('sent body has no points array');
  return points.map((point) => {
    const p = asRecord(point, 'point');
    return { x: Number(p.x), y: Number(p.y), z: typeof p.z === 'number' ? p.z : undefined };
  });
}

/** Euclidean distance of a sent p2p body, with absent z as 0 — the oracle of 25-C-013. */
export function distanceOf(points: readonly { x: number; y: number; z: number | undefined }[]): number {
  const [a, b] = points;
  if (a === undefined || b === undefined) throw new Error('need two points');
  return round6(Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0)));
}
