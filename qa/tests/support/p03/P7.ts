/**
 * QA-03d P7 (SCR-11 input quality gate) — helpers for `phase03_quality_edge.spec.ts` and `phase03_quality_ui.spec.ts` only.
 * Real API only (seeds); the mocks live in the specs, in the flows titled `[mocked response]`.
 *
 *   const admin = await mainAdminApi();                              // 1 login (main admin: pool reads + role change)
 *   const owner = await poolUser(admin, 'admin', P7_SLOT);           // own drawings_init bucket for every P7 upload
 *   const ownerApi = await signedInApi(owner.email, owner.password); // 1 login
 *   const p = await seedQualityProject(ownerApi, '11-x', [{ name: 'Tầng 1', png: await planPng(browser, CLEAN) }]);
 *   const s = await openSession(browser, owner);                    // 1 login (browser) + announcement recorder + API log
 *   ... finally { await deleteSeededProject(ownerApi, p.projectId); await s.context.close(); }
 *
 * Crafted drawings ({@link planPng}) follow BE packages/vision/quality (metrics.py, assess.py, preprocess/geometry.py):
 *   - resolution = the short edge of the ORIGINAL image (2000 good, 1200 attention, below poor);
 *   - contrast = (paper median − ink median) / 255 after Otsu: black on white = 1,00; 85 on 235 ≈ 0,59; 120 on 200 ≈ 0,31;
 *   - noise = small 8-connected ink blobs (area ≤ (shortEdge/540)², 14 px at 2000) / all blobs: the frame + walls are one
 *     blob, 20 boxes of 40 px are 20 more, so 10 dots of 3×3 px ≈ 0,32 (attention) and 40 dots ≈ 0,66 (poor);
 *   - skew = weighted median angle of long Hough segments: every stroke is horizontal or vertical → 0;
 *   - frame = the largest convex 4-gon ≥ 25 % of the image holding ≥ 97 % of the ink: the stroked border when `frame`.
 * The skewed drawings are the env drawing (`E2E_DRAWING_PNG`, 1600×1200, frameless) turned with `rotatedPng`; a canvas
 * turn of +d° measures −d° (`estimate_skew` reads −atan2(dy, dx) with y down), so `skewedEnvPng(browser, 8)` shows 8°.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { watchApi, type ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { captureEvidence, EVIDENCE_DIR } from '../evidence';
import {
  createProject,
  deleteSeededProject,
  rotatedPng,
  signInPoolUser,
  uploadDrawing,
  type PoolUser,
} from '../phase03Seed';
import { UI_VIEWPORTS } from '../ui-verify';
type Json = Record<string, unknown>;

/** Pool slot of the "fresh admin" that owns every P7 project with a drawing (own `drawings_init` bucket). */
export const P7_SLOT = 'p7-quality';
/** Pool slot of the engineer whose global role FL-11-06 lowers to viewer and puts back (never the shared engineer). */
export const P7_ROLE_SLOT = 'p7-role';

export const DESKTOP = { width: 1440, height: 900 } as const;

/* ---- sessions ---------------------------------------------------------------------------------- */

/** Main admin API client (1 login): `poolUser` lookups, role change of the FL-11-06 engineer. */
export function mainAdminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

export interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Every `/api/` response of the page (method, path, status). */
  readonly log: ApiEntry[];
}

/**
 * Records every text the app announcer writes (`src/lib/input/announcer.ts`: `[data-announcer]` live regions, text
 * replaced on each message) into `window.__qaAnnounced`, from the first document on.
 */
async function recordAnnouncements(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __qaAnnounced: string[] }).__qaAnnounced = seen;
    new MutationObserver((records) => {
      for (const record of records) {
        const node = record.target;
        const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
        const region = element?.closest('[data-announcer]');
        const text = region?.textContent?.replace(/ $/u, '').trim() ?? '';
        if (text !== '' && seen[seen.length - 1] !== text) seen.push(text);
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
}

/** What the announcer said so far in this document. */
export const announced = (page: Page): Promise<string[]> =>
  page.evaluate(() => [...((window as unknown as { __qaAnnounced?: string[] }).__qaAnnounced ?? [])]);

/** Browser context signed in as a pool user (1 `POST /api/auth/login`), with the announcement recorder and an API log. */
export async function openSession(
  browser: Browser,
  user: PoolUser,
  viewport: { readonly width: number; readonly height: number } = DESKTOP,
): Promise<Session> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  try {
    await recordAnnouncements(context);
    await signInPoolUser(context, user);
    const page = await context.newPage();
    return { context, page, log: watchApi(page) };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/* ---- crafted drawings -------------------------------------------------------------------------- */

export interface PlanSpec {
  readonly width: number;
  readonly height: number;
  /** Stroked border around the plan (the "khung bản vẽ"); default true. */
  readonly frame?: boolean;
  /** Ink / paper grey (0–255); defaults 0 / 255. */
  readonly ink?: number;
  readonly paper?: number;
  /** Filled 40 px boxes (large blobs) and 3×3 px dots (small blobs) — the noise ratio (see the file comment). */
  readonly boxes?: number;
  readonly dots?: number;
}

/**
 * Clean framed drawing whose stored page still has a short edge ≥ 2000: a found frame makes the pipeline crop the page to
 * it (apps/worker/pipeline_orchestrate/preprocess.py `rectify(page, quad)`), and the border sits 6 % in → 2300 → ≈ 2039.
 * Exact sizes (2000 / 1999 / 1200 / 1199) therefore need `frame: false` (no crop).
 */
export const CLEAN: PlanSpec = { width: 2300, height: 2300 };

/** A straight plan drawn in a browser canvas: border (optional), three walls joined to it, boxes, dots. PNG bytes. */
export async function planPng(browser: Browser, spec: PlanSpec): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    const dataUrl = await page.evaluate((s) => {
      const { width: W, height: H } = s;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (ctx === null) throw new Error('no 2d canvas');
      const grey = (v: number): string => `rgb(${String(v)},${String(v)},${String(v)})`;
      ctx.fillStyle = grey(s.paper);
      ctx.fillRect(0, 0, W, H);
      const short = Math.min(W, H);
      const m = Math.round(short * 0.06);
      const lw = Math.max(6, Math.round(short / 150));
      ctx.strokeStyle = grey(s.ink);
      ctx.fillStyle = grey(s.ink);
      ctx.lineWidth = lw;
      const line = (x0: number, y0: number, x1: number, y1: number): void => {
        ctx.beginPath();
        ctx.moveTo(Math.round(x0), Math.round(y0));
        ctx.lineTo(Math.round(x1), Math.round(y1));
        ctx.stroke();
      };
      if (s.frame) {
        ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
        line(m, H * 0.55, W - m, H * 0.55);
        line(W * 0.45, m, W * 0.45, H * 0.55);
        line(W * 0.7, H * 0.55, W * 0.7, H - m);
      } else {
        // No closed quad anywhere: an open "T" of walls (frame stays not found).
        line(W * 0.15, H * 0.55, W * 0.85, H * 0.55);
        line(W * 0.45, H * 0.2, W * 0.45, H * 0.55);
        line(W * 0.7, H * 0.55, W * 0.7, H * 0.85);
      }
      const b = Math.round(short * 0.02);
      for (let i = 0; i < s.boxes; i += 1) {
        ctx.fillRect(m + 2 * b + (i % 5) * 3 * b, m + 2 * b + Math.floor(i / 5) * 3 * b, b, b);
      }
      const x0 = Math.round(W * 0.7) + 20;
      const cols = Math.max(1, Math.floor((W - m - 20 - x0) / 20));
      for (let i = 0; i < s.dots; i += 1) {
        ctx.fillRect(x0 + (i % cols) * 20, Math.round(H * 0.55) + 30 + Math.floor(i / cols) * 20, 3, 3);
      }
      return canvas.toDataURL('image/png');
    }, { width: spec.width, height: spec.height, frame: spec.frame ?? true, ink: spec.ink ?? 0, paper: spec.paper ?? 255, boxes: spec.boxes ?? 0, dots: spec.dots ?? 0 });
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  } finally {
    await page.close();
  }
}

/** The env drawing (`E2E_DRAWING_PNG`, straight, frameless, 1600×1200). */
export function envPngPath(): string {
  const path = process.env.E2E_DRAWING_PNG;
  if (!path) throw new Error('E2E_DRAWING_PNG is not set (qa.config.json env.vars)');
  return path;
}
export const envPng = (): Buffer => readFileSync(envPngPath());

/** The env drawing turned so that the BE measures `measuredDeg` (sign flipped: see the file comment). */
export const skewedEnvPng = (browser: Browser, measuredDeg: number): Promise<Buffer> => rotatedPng(browser, envPngPath(), -measuredDeg);

/* ---- seeds ------------------------------------------------------------------------------------- */

export interface QualityFloorSeed {
  readonly name: string;
  /** Drawing uploaded to this floor; `null` = the floor stays without a drawing. */
  readonly png: Buffer | null;
}

export interface QualityProject {
  readonly projectId: string;
  readonly name: string;
  readonly floors: readonly { readonly id: string; readonly name: string }[];
}

const PROJECTS = '/api/projects';
export const qualityPath = (projectId: string, floorId: string): string => `${PROJECTS}/${projectId}/floors/${floorId}/quality`;

/**
 * Own project with `floors` in order; each `png` uploaded to its floor (#5 → #6 → #7, one `drawings_init` each); resolves
 * once #30 lists every drawn floor measured (BE quality/assessments.py: `floors` = floors with a live drawing). Deletes
 * the project on any setup failure.
 */
export async function seedQualityProject(api: APIRequestContext, slug: string, floors: readonly QualityFloorSeed[]): Promise<QualityProject> {
  const project = await createProject(api, slug, floors.map((floor) => floor.name));
  try {
    const drawn: string[] = [];
    for (const [index, floor] of floors.entries()) {
      const row = project.floors[index];
      if (row === undefined) throw new Error(`setup: floor ${floor.name} was not created`);
      if (floor.png === null) continue;
      await uploadDrawing(api, project.projectId, row.id, floor.png, `${slug}-${String(index + 1)}.png`);
      drawn.push(row.id);
    }
    const probe = drawn[0];
    if (probe !== undefined) {
      await expect
        .poll(
          async () => {
            const res = await api.get(qualityPath(project.projectId, probe));
            if (res.status() !== 200) return `#30 ${String(res.status())}`;
            const listed = ((await res.json()) as { floors: { isMeasured: boolean }[] }).floors;
            return `${String(listed.filter((f) => f.isMeasured).length)}/${String(listed.length)}`;
          },
          { message: `setup: #30 lists ${String(drawn.length)} drawn floors measured`, timeout: 300_000, intervals: [2_000] },
        )
        .toBe(`${String(drawn.length)}/${String(drawn.length)}`);
    }
    return { projectId: project.projectId, name: project.name, floors: project.floors.map(({ id, name }) => ({ id, name })) };
  } catch (error) {
    await deleteSeededProject(api, project.projectId);
    throw error;
  }
}

/** Wire body of #30 for `floorId` (status 200 required). */
export async function readQuality(api: APIRequestContext, projectId: string, floorId: string): Promise<Json & { floors: Json[] }> {
  const res = await api.get(qualityPath(projectId, floorId));
  expect(res.status(), `GET ${qualityPath(projectId, floorId)}`).toBe(200);
  return (await res.json()) as Json & { floors: Json[] };
}

/** One floor of a #30 body by id. */
export function floorOf(body: { floors: Json[] }, floorId: string): Json & { measurement: { widthPx: number; heightPx: number; skewDeg: number; contrastScore: number; noiseScore: number }; findings: (Json & { code: string; region: { xRatio: number; yRatio: number; widthRatio: number; heightRatio: number } })[] } {
  const floor = body.floors.find((f) => f.floorId === floorId);
  if (floor === undefined) throw new Error(`#30 has no floor ${floorId}`);
  return floor as ReturnType<typeof floorOf>;
}

/* ---- vi-VN numbers, as src/lib/format (formatNumber: Intl vi-VN, fixed digits) ------------------ */

const fixed = (value: number, digits: number): string =>
  new Intl.NumberFormat('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Object.is(value, -0) ? 0 : value);
/** `formatResolution`: "1.751 × 1.411 px". */
export const viResolution = (w: number, h: number): string => `${fixed(w, 0)} × ${fixed(h, 0)} px`;
/** `formatScore`: "0,59". */
export const viScore = (v: number): string => fixed(v, 2);
/** `formatAngle` (ANGLE_FRACTION_DIGITS 1): "-8,0°". */
export const viAngle = (v: number): string => `${fixed(v, 1)}°`;

/* ---- one state at the four widths without re-opening it ---------------------------------------- */

/**
 * For a state that exists only once (after a real write): resizes the SAME page to each review width (layouts follow
 * `matchMedia` live), measures horizontal scroll / controls off-screen / broken images and shoots `<name>_<width>.png`
 * (full page). `support/ui-verify.ts` `verifyUi` re-opens per width, which would repeat the write.
 */
export async function shootWidthsInPlace(page: Page, name: string, marker: () => Promise<void>): Promise<void> {
  const all: Json[] = [];
  for (const vp of UI_VIEWPORTS) {
    await page.setViewportSize(vp);
    await marker();
    const metrics = await page.evaluate(() => {
      const vw = window.innerWidth;
      const controls = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2;
      });
      return {
        horizontalOverflowPx: Math.max(0, (document.scrollingElement ?? document.documentElement).scrollWidth - vw),
        // A control scrolled away inside its own scroll box (the zoomed drawing frame) is not off the page.
        offscreen: controls
          .filter((el) => {
            const r = el.getBoundingClientRect();
            let box = el.parentElement;
            while (box !== null && !/auto|scroll/u.test(getComputedStyle(box).overflowX)) box = box.parentElement;
            return box === null && (r.right > vw + 1 || r.left < -1);
          })
          .map((el) => (el.getAttribute('aria-label') ?? (el as HTMLElement).innerText).trim().slice(0, 60)),
        brokenImages: [...document.images].filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.alt),
      };
    });
    all.push({ viewport: `${String(vp.width)}x${String(vp.height)}`, ...metrics });
    await captureEvidence(page, `${name}_${String(vp.width)}.png`, { fullPage: true });
    expect.soft(metrics.horizontalOverflowPx, `${String(vp.width)}: page scrolls horizontally`).toBe(0);
    expect.soft(metrics.offscreen, `${String(vp.width)}: controls outside the viewport`).toEqual([]);
    expect.soft(metrics.brokenImages, `${String(vp.width)}: broken images`).toEqual([]);
  }
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(EVIDENCE_DIR, `${name}.json`), JSON.stringify(all, null, 2));
  await page.setViewportSize(DESKTOP);
}
