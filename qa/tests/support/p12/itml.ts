/**
 * Phase 12 = IT-ML: integration of the two trained models (walls SegFormer-B2, objects yolo11m) on the f14 stack,
 * plan `F:/App/docs/it-ml/IT-PLAN.md`. Read-only towards shared state: tests upload into their own `qa-<runId>-itml-…`
 * projects and delete them, never write a layer (`PUT …/spatial/layer`) and never touch the model registry.
 *
 * Docker / psql are read through `docker exec` (no host ports for api/ml): the run that a model used lives only in
 * `pipeline_run_models.used` (AppBack apps/worker/pipeline_orchestrate/pins.py:27), there is no endpoint for it.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { expect, test, type APIRequestContext } from '@playwright/test';

import { FloorLayerDocumentSchema, type FloorLayerDocument } from '../../../../src/api/schemas/spatialLayer';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { createDrawingProject } from '../drawingSeed';
import { EVIDENCE_DIR, repName } from '../evidence';

type Json = Record<string, unknown>;

export const GOLDEN_DIR = fileURLToPath(new URL('./golden/', import.meta.url));

/** Active versions the plan was written against (IT-PLAN §3.1); override when the registry moves on. */
export const ACTIVE = {
  walls: process.env.IT_ML_WALLS_ID ?? 'mdl_01M5J43T070F2HMC2F11817E8K',
  objects: process.env.IT_ML_OBJECTS_ID ?? 'mdl_01M5J3Q46YV6RBYDB8TK86PDV8',
} as const;

export const FAMILY = { walls: 'wallSegmentation', objects: 'openingAndFurnitureDetection' } as const;
export const ML_CONTAINER = process.env.IT_ML_ML_CONTAINER ?? 'f14-ml-1';
export const PG_CONTAINER = process.env.IT_ML_PG_CONTAINER ?? 'f14-postgres-1';

/** Fake ML finishes drawing.png in ~1 s (memory trained-models-f14); real B2 on CPU takes ≥ 3 s. */
export const REAL_ML_MIN_MS = 3_000;
/** CPU warning threshold per page (IT-PLAN F): recorded, never failed. */
export const SLOW_PAGE_MS = 5 * 60_000;
/** One run of a large page on CPU: B2 ~14 s + YOLO tiles + OCR, × queue of 1. */
export const RUN_TIMEOUT_MS = 10 * 60_000;

/** Pipeline step order (AppBack packages/core/pipeline.py:9-25). */
export const STEP_ORDER = [
  'preprocess',
  'wallSegmentation',
  'openingAndFurnitureDetection',
  'dimensionReading',
  'spatialDataBuild',
  'qualityCheck',
] as const;

/* ---- docker -------------------------------------------------------------------------------------- */

export function docker(args: readonly string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 30_000 }).trim();
}

const RUN_ID = /^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$/u;

/** One-value read from the f14 database (`-At`: no header, no padding). */
export function psql(sql: string): string {
  return docker(['exec', PG_CONTAINER, 'psql', '-U', 'appback', '-d', 'appback', '-At', '-c', sql]);
}

/** `pipeline_run_models.used` of one run: family → version id | "classic" | "none". */
export function modelsUsed(runId: string): Record<string, string> {
  if (!RUN_ID.test(runId)) throw new Error(`modelsUsed: "${runId}" is not a run id`);
  const raw = psql(`select used::text from pipeline_run_models where run_id = '${runId}'`);
  return raw === '' ? {} : (JSON.parse(raw) as Record<string, string>);
}

/** Peak-free snapshot of the ml container memory in MiB (`docker stats --no-stream`). */
export function mlMemoryMiB(): number {
  const used = docker(['stats', '--no-stream', '--format', '{{.MemUsage}}', ML_CONTAINER]).split('/')[0]?.trim() ?? '';
  const match = /^([\d.]+)\s*([KMG]i?B)$/u.exec(used);
  if (!match) return Number.NaN;
  const unit = { KiB: 1 / 1024, KB: 1 / 1024, MiB: 1, MB: 1, GiB: 1024, GB: 1024 }[match[2] ?? 'MiB'] ?? 1;
  return Number(match[1]) * unit;
}

/** Evidence JSON on disk (`<EVIDENCE_DIR>/I12_<id>_<slug>.json`) + attached: traces, docker reads, counts. */
export async function saveJson(name: string, data: unknown): Promise<void> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const file = repName(`I12_${name}.json`);
  const path = join(EVIDENCE_DIR, file);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  await test.info().attach(file, { path, contentType: 'application/json' });
}

/* ---- golden set ---------------------------------------------------------------------------------- */

export type Range = readonly [number, number] | null;
export interface GoldenSample {
  readonly source: string;
  readonly px: readonly [number, number];
  readonly expect: { readonly walls: Range; readonly doors: Range; readonly windows: Range; readonly furniture: Range };
}
export interface Golden {
  readonly maxWindowMm: number | null;
  readonly samples: Readonly<Record<string, GoldenSample>>;
}

export const golden = (): Golden => JSON.parse(readFileSync(`${GOLDEN_DIR}golden.json`, 'utf8')) as Golden;
export const goldenPng = (name: string): Buffer => readFileSync(`${GOLDEN_DIR}${name}.png`);

/** White `width` x `height` 8-bit gray PNG (N2: nothing to segment). */
export function blankPng(width = 1600, height = 1200): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (const byte of buf) c = (crcTable[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 0, 0, 0, 0], 8);
  const row = Buffer.alloc(width + 1, 0xff);
  row[0] = 0; // filter: none
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---- API ----------------------------------------------------------------------------------------- */

export function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

export interface RunTrace {
  readonly projectId: string;
  readonly floorId: string;
  readonly uploadId: string;
  readonly status: 'completed' | 'failed';
  readonly error: string;
  /** Distinct `step` values in the order #8 reported them. */
  readonly steps: readonly string[];
  readonly percents: readonly number[];
  readonly ms: number;
  /** Peak `docker stats` reading of the ml container sampled during the run (MiB). */
  readonly mlPeakMiB: number;
}

/**
 * Own project with one floor, `png` uploaded (#5 → #6 → #7), then #8 polled every second until final. Records the
 * step sequence, the percent sequence, the wall time and the ml memory peak. The caller deletes `projectId`.
 */
export async function uploadAndTrace(
  api: APIRequestContext,
  slug: string,
  png: Buffer,
  {
    timeoutMs = RUN_TIMEOUT_MS,
    sampleMemory = false,
    onUploaded,
  }: {
    readonly timeoutMs?: number;
    readonly sampleMemory?: boolean;
    /** Runs right after #7, before the first poll (e.g. open the SSE stream while the run is live). */
    readonly onUploaded?: (seeded: { readonly projectId: string; readonly uploadId: string }) => Promise<void>;
  } = {},
): Promise<RunTrace> {
  const started = Date.now();
  const seeded = await createDrawingProject(api, `itml-${slug}`, png, ['Tầng 1']);
  if (onUploaded) await onUploaded(seeded);
  const steps: string[] = [];
  const percents: number[] = [];
  let mlPeakMiB = 0;
  for (;;) {
    const res = await api.get(`/api/projects/${seeded.projectId}/drawings/uploads/${seeded.uploadId}/progress`);
    expect(res.status(), '#8 progress').toBe(200);
    const progress = (await res.json()) as Json;
    const step = String(progress.step ?? '');
    if (step !== '' && steps.at(-1) !== step) steps.push(step);
    percents.push(Number(progress.progressPercent ?? Number.NaN));
    if (sampleMemory) mlPeakMiB = Math.max(mlPeakMiB, mlMemoryMiB() || 0);
    if (progress.status === 'completed' || progress.status === 'failed') {
      return {
        ...seeded,
        status: progress.status,
        error: String(progress.error ?? ''),
        steps,
        percents,
        ms: Date.now() - started,
        mlPeakMiB,
      };
    }
    if (Date.now() - started > timeoutMs) throw new Error(`${slug}: run still "${String(progress.status)}" after ${String(timeoutMs)} ms`);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

/** Run id of `uploadId` from N7b `GET /api/projects/:id/pipeline-runs` (first page is newest first). */
export async function runOf(api: APIRequestContext, projectId: string, uploadId: string): Promise<Json> {
  const res = await api.get(`/api/projects/${projectId}/pipeline-runs`);
  expect(res.status(), 'N7b pipeline-runs').toBe(200);
  const items = ((await res.json()) as { items?: Json[] }).items ?? [];
  const run = items.find((item) => item.uploadId === uploadId);
  if (!run) throw new Error(`N7b lists no run for upload ${uploadId}`);
  return run;
}

/** N16 floor layer, parsed by the app's own wire schema (the FE contract is part of what IT checks). */
export async function readLayer(api: APIRequestContext, projectId: string, floorId: string): Promise<FloorLayerDocument> {
  const res = await api.get(`/api/projects/${projectId}/floors/${floorId}/spatial/layer`);
  expect(res.status(), 'N16 spatial/layer').toBe(200);
  return FloorLayerDocumentSchema.parse(await res.json());
}

/* ---- checks on a layer (pure) -------------------------------------------------------------------- */

export interface Counts {
  readonly walls: number;
  readonly doors: number;
  readonly windows: number;
  readonly furniture: number;
  readonly rooms: number;
}

export function countsOf(doc: FloorLayerDocument): Counts {
  const { walls, openings, furniture, rooms } = doc.layer;
  return {
    walls: walls.length,
    doors: openings.filter((o) => o.kind === 'door').length,
    windows: openings.filter((o) => o.kind === 'window').length,
    furniture: furniture.length,
    rooms: rooms.length,
  };
}

const wallLength = (w: FloorLayerDocument['layer']['walls'][number]): number =>
  Math.hypot(w.centreline.end.x - w.centreline.start.x, w.centreline.end.y - w.centreline.start.y);

/** Slack for an opening that ends a hair past its wall (rounding of mm on the wire). */
const OPENING_SLACK_MM = 50;
/** Same-kind openings on one wall whose spans overlap by more than this share of the shorter one = duplicates. */
export const DUP_SHARE = 0.7;
/** Furniture boxes of one kind with IoU above this = duplicates (detector MERGE_OVERLAP 0.7, objects/detector.py:43-55). */
export const DUP_IOU = 0.7;
/** Narrowest real opening in CubiCasa ≈ 500 mm; anything under this is a tile-cut fragment. */
export const FRAGMENT_OPENING_MM = 250;
/** Thinnest real furniture box side; under this is a tile-cut sliver. */
export const FRAGMENT_FURNITURE_MM = 80;
/** Fallback before golden.maxWindowMm is set: no residential window is 4 m wide. */
export const LONG_WINDOW_FALLBACK_MM = 4_000;

/** IT-ML-017: values are finite, walls have length, boxes have area. */
export function invalidGeometry(doc: FloorLayerDocument): string[] {
  const bad: string[] = [];
  const finite = (n: number): boolean => Number.isFinite(n);
  for (const w of doc.layer.walls) {
    const pts = [w.centreline.start.x, w.centreline.start.y, w.centreline.end.x, w.centreline.end.y, w.thicknessMm];
    if (!pts.every(finite) || wallLength(w) <= 0 || w.thicknessMm <= 0) bad.push(`wall ${w.id}`);
  }
  for (const f of doc.layer.furniture) {
    const { min, max } = f.boundingBox;
    if (![min.x, min.y, max.x, max.y].every(finite) || max.x - min.x <= 0 || max.y - min.y <= 0) bad.push(`furniture ${f.id}`);
  }
  for (const o of doc.layer.openings) if (!finite(o.offsetMm) || !(o.widthMm > 0)) bad.push(`opening ${o.id}`);
  return bad;
}

/** IT-ML-017: furniture centres inside the walls' extent grown by 10 %. */
export function furnitureOutside(doc: FloorLayerDocument): string[] {
  const xs = doc.layer.walls.flatMap((w) => [w.centreline.start.x, w.centreline.end.x]);
  const ys = doc.layer.walls.flatMap((w) => [w.centreline.start.y, w.centreline.end.y]);
  if (xs.length === 0) return [];
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const gx = (x1 - x0) * 0.1;
  const gy = (y1 - y0) * 0.1;
  return doc.layer.furniture
    .filter((f) => f.centre.x < x0 - gx || f.centre.x > x1 + gx || f.centre.y < y0 - gy || f.centre.y > y1 + gy)
    .map((f) => `furniture ${f.id} (${f.kind}) at ${String(f.centre.x)},${String(f.centre.y)}`);
}

/** IT-ML-018: each opening hangs on an existing wall and fits inside it. */
export function openingsOffWall(doc: FloorLayerDocument): string[] {
  const walls = new Map(doc.layer.walls.map((w) => [w.id as string, w]));
  return doc.layer.openings.flatMap((o) => {
    const wall = walls.get(o.wallId);
    if (!wall) return [`opening ${o.id}: wall ${o.wallId} missing`];
    const room = wallLength(wall) + OPENING_SLACK_MM;
    return o.offsetMm + o.widthMm > room ? [`opening ${o.id}: ${String(o.offsetMm + o.widthMm)} mm > wall ${String(Math.round(room))} mm`] : [];
  });
}

/** IT-ML-060: duplicate openings (same wall + kind, spans overlap) and duplicate furniture (same kind, IoU). */
export function duplicates(doc: FloorLayerDocument): string[] {
  const out: string[] = [];
  const ops = doc.layer.openings;
  for (let i = 0; i < ops.length; i += 1) {
    for (let j = i + 1; j < ops.length; j += 1) {
      const a = ops[i];
      const b = ops[j];
      if (!a || !b || a.wallId !== b.wallId || a.kind !== b.kind) continue;
      const overlap = Math.min(a.offsetMm + a.widthMm, b.offsetMm + b.widthMm) - Math.max(a.offsetMm, b.offsetMm);
      if (overlap > DUP_SHARE * Math.min(a.widthMm, b.widthMm)) out.push(`${a.kind} ${a.id} ≈ ${b.id}`);
    }
  }
  // ponytail: O(n²) pairs, fine for ≤ a few hundred items per floor
  const fs = doc.layer.furniture;
  for (let i = 0; i < fs.length; i += 1) {
    for (let j = i + 1; j < fs.length; j += 1) {
      const a = fs[i];
      const b = fs[j];
      if (!a || !b || a.kind !== b.kind) continue;
      const iw = Math.min(a.boundingBox.max.x, b.boundingBox.max.x) - Math.max(a.boundingBox.min.x, b.boundingBox.min.x);
      const ih = Math.min(a.boundingBox.max.y, b.boundingBox.max.y) - Math.max(a.boundingBox.min.y, b.boundingBox.min.y);
      if (iw <= 0 || ih <= 0) continue;
      const area = (f: typeof a): number => (f.boundingBox.max.x - f.boundingBox.min.x) * (f.boundingBox.max.y - f.boundingBox.min.y);
      const inter = iw * ih;
      if (inter / (area(a) + area(b) - inter) > DUP_IOU) out.push(`${a.kind} ${a.id} ≈ ${b.id}`);
    }
  }
  return out;
}

/** IT-ML-061: windows wider than `limitMm` (several windows merged into one). */
export function longWindows(doc: FloorLayerDocument, limitMm: number): string[] {
  return doc.layer.openings.filter((o) => o.kind === 'window' && o.widthMm > limitMm).map((o) => `window ${o.id} ${String(o.widthMm)} mm`);
}

/** IT-ML-062: slivers left at tile cuts. */
export function fragments(doc: FloorLayerDocument): string[] {
  const ops = doc.layer.openings.filter((o) => o.widthMm < FRAGMENT_OPENING_MM).map((o) => `${o.kind} ${o.id} ${String(o.widthMm)} mm`);
  const fs = doc.layer.furniture
    .filter((f) => Math.min(f.boundingBox.max.x - f.boundingBox.min.x, f.boundingBox.max.y - f.boundingBox.min.y) < FRAGMENT_FURNITURE_MM)
    .map((f) => `${f.kind} ${f.id} sliver`);
  return [...ops, ...fs];
}

/** `value` inside `range`; a null range = baseline not reviewed yet (IT-PLAN §4). */
export function inRange(value: number, range: Range): string | null {
  if (range === null) return 'golden.json range is null: run the baseline and have it reviewed first';
  return value >= range[0] && value <= range[1] ? null : `${String(value)} not in [${String(range[0])}, ${String(range[1])}]`;
}
