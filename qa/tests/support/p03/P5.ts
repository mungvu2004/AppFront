/**
 * QA-03d P5 helpers for `phase03_upload_edge.spec.ts` (SCR-10 real flows). Owned by P5 only; the shared seeds stay in
 * `../phase03Seed.ts` (re-used, not edited).
 *
 * - {@link openFlow}: one browser context signed in as `who` (one `POST /api/auth/login` through the context's own cookie
 *   jar), its page, a response log (`watchApi`) and a request log with the upload bodies ({@link SentRequest}).
 * - Crafted files, all in memory or sparse on disk: {@link paddedPng} (a valid PNG grown to an exact byte size by a private
 *   ancillary chunk, so the BE magic/IEND checks and the decoder still accept it), {@link makePdf} (valid N-page PDF, a
 *   port of the BE fixture `packages/vision/preprocess/tests/synthetic.py` make_pdf, also in phase03_pipeline_api),
 *   {@link sparseFile} (size without bytes, for the 100 MiB bounds).
 * - {@link createStackProject}: own project with free-form floor drafts (elevation / height per floor).
 */
import { closeSync, ftruncateSync, openSync } from 'node:fs';

import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { watchApi, type ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { TEST_DATA_PREFIX } from '../evidence';
import { listFloors, type SeededProject } from '../phase03Seed';

export const DESKTOP = { width: 1440, height: 900 } as const;
export const COMPACT = { width: 375, height: 812 } as const;

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/* ---- request log ------------------------------------------------------------------------------ */

export interface SentRequest {
  readonly method: string;
  readonly path: string;
  /** Parsed JSON body of an upload init (#5); `null` for every other request. */
  readonly init: Record<string, unknown> | null;
  /** `chunkIndex` of a chunk POST (#6), read from the body tail (the base64 chunk is never parsed); else `null`. */
  readonly chunkIndex: number | null;
}

export const INIT_RE = /^\/api\/projects\/[^/]+\/floors\/[^/]+\/drawings\/uploads$/u;
export const CHUNK_RE = /^\/api\/projects\/[^/]+\/drawings\/uploads\/[^/]+\/chunks$/u;
export const COMPLETE_RE = /^\/api\/projects\/[^/]+\/drawings\/uploads\/[^/]+\/complete$/u;

export interface Flow {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Every `/api/` response of the page, in order (status, error code). */
  readonly log: ApiEntry[];
  /** Every `/api/` request of the page, in order, with upload bodies. */
  readonly sent: SentRequest[];
  /** Every dialog the page raised (type + message); dismissed by Playwright's default. */
  readonly dialogs: string[];
}

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/** Browser session of `who` in a fresh context (1 login), page + logs; `reducedMotion` emulated before any page opens. */
export async function openFlow(
  browser: Browser,
  who: Credentials,
  options: { readonly viewport?: { width: number; height: number }; readonly reducedMotion?: boolean } = {},
): Promise<Flow> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport: options.viewport ?? DESKTOP,
    ...(options.reducedMotion === true ? { reducedMotion: 'reduce' as const } : {}),
  });
  try {
    const res = await context.request.post('/api/auth/login', {
      data: { email: who.email, password: who.password, rememberMe: false },
      headers: { Origin: readBaseUrl() },
    });
    expect(res.status(), 'setup: POST /api/auth/login (flow session)').toBe(204);
    const page = await context.newPage();
    const sent: SentRequest[] = [];
    const dialogs: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith('/api/')) return;
      let init: Record<string, unknown> | null = null;
      let chunkIndex: number | null = null;
      if (request.method() === 'POST' && INIT_RE.test(url.pathname)) {
        init = (request.postDataJSON() as Record<string, unknown> | null) ?? null;
      } else if (request.method() === 'POST' && CHUNK_RE.test(url.pathname)) {
        const tail = (request.postData() ?? '').slice(-64);
        const found = /"chunkIndex"\s*:\s*(\d+)/u.exec(tail);
        chunkIndex = found?.[1] === undefined ? null : Number(found[1]);
      }
      sent.push({ method: request.method(), path: url.pathname, init, chunkIndex });
    });
    page.on('dialog', (dialog) => {
      dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    });
    return { context, page, log: watchApi(page), sent, dialogs };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function closeFlow(flow: Flow): Promise<void> {
  await flow.context.close().catch(() => undefined);
}

/** Upload inits sent since `mark` (index into `flow.sent`). */
export const initsSince = (flow: Flow, mark: number): SentRequest[] =>
  flow.sent.slice(mark).filter((r) => r.method === 'POST' && INIT_RE.test(r.path));

/** Writes (non-GET, minus refresh/telemetry) the page sent since `mark` (index into `flow.sent`). */
export const writesSince = (flow: Flow, mark: number): string[] =>
  flow.sent
    .slice(mark)
    .filter((r) => r.method !== 'GET' && r.path !== '/api/auth/refresh' && !r.path.startsWith('/api/telemetry'))
    .map((r) => `${r.method} ${r.path}`);

/** Records every text the app announcer (`[data-announcer]`, src/lib/input/announcer.ts:52-57) writes; call before `goto`. */
export async function recordAnnouncements(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __qaAnnounced: string[] }).__qaAnnounced = seen;
    new MutationObserver(() => {
      for (const node of document.querySelectorAll('[data-announcer]')) {
        const text = node.textContent?.trim() ?? '';
        if (text !== '' && !seen.includes(text)) seen.push(text);
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  return () => page.evaluate(() => (window as unknown as { __qaAnnounced?: string[] }).__qaAnnounced ?? []);
}

/* ---- projects --------------------------------------------------------------------------------- */

export interface FloorDraft {
  readonly name: string;
  readonly elevationMm: number;
  readonly heightMm: number;
}

/** Own project `qa-<runId>-<slug>-<uniq>` with `floors` drafts as given (#25 `floors`, BE projects/schemas.py:56-66). */
export async function createStackProject(api: APIRequestContext, slug: string, floors: readonly FloorDraft[]): Promise<SeededProject> {
  const name = `${TEST_DATA_PREFIX}${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const created = await api.post('/api/projects', { data: { name, floors: floors.map((floor, order) => ({ ...floor, order })) } });
  expect(created.status(), `setup: POST /api/projects "${name}": ${(await created.text()).slice(0, 300)}`).toBe(201);
  const projectId = String(((await created.json()) as { id: unknown }).id);
  return { projectId, name, floors: await listFloors(api, projectId) };
}

/* ---- crafted files ---------------------------------------------------------------------------- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** PNG signature (8) + IHDR chunk (4 length + 4 type + 13 data + 4 CRC). */
const AFTER_IHDR = 33;
const CHUNK_OVERHEAD = 12;

/**
 * `base` (a valid PNG) grown to exactly `totalBytes` by a private ancillary `qaPd` chunk right after IHDR: decoders skip
 * it, the BE checks only the magic bytes and IEND (apps/api/drawings/complete.py:58,145-153), so the upload completes.
 */
export function paddedPng(base: Buffer, totalBytes: number): Buffer {
  const fill = totalBytes - base.length - CHUNK_OVERHEAD;
  if (fill < 0) throw new Error(`paddedPng: ${String(totalBytes)} B is smaller than the base PNG + one chunk`);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(fill, 0);
  head.write('qaPd', 4, 'ascii');
  const data = Buffer.alloc(fill, 0x20);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  const out = Buffer.concat([base.subarray(0, AFTER_IHDR), head, data, crc, base.subarray(AFTER_IHDR)]);
  if (out.length !== totalBytes) throw new Error('paddedPng: size arithmetic');
  return out;
}

/** `base` with its IEND chunk (last 12 bytes) cut off: the BE answers 422 FILE_CORRUPT at complete. */
export const pngWithoutIend = (base: Buffer): Buffer => base.subarray(0, base.length - CHUNK_OVERHEAD);

/**
 * Minimal valid PDF with `pages` empty A4 pages and a correct xref table (BE fixture make_pdf; `pages = 0` gives
 * `/Count 0`, which the FE reads as "page count unknown" and pdfium refuses).
 */
export function makePdf(pages: number): Buffer {
  const kids = Array.from({ length: pages }, (_, i) => `${String(3 + i)} 0 R`).join(' ');
  const objects = ['<</Type/Catalog/Pages 2 0 R>>', `<</Type/Pages/Kids[${kids}]/Count ${String(pages)}>>`];
  for (let i = 0; i < pages; i += 1) {
    objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents ${String(3 + pages + i)} 0 R/Resources<<>>>>`);
  }
  for (let i = 0; i < pages; i += 1) objects.push('<</Length 0>>\nstream\n\nendstream');
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${String(i + 1)} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<</Size ${String(objects.length + 1)}/Root 1 0 R>>\nstartxref\n${String(xref)}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Text that only the FE page-count scan reads (src/lib/upload/validate.ts:306-339): `prefix` junk bytes, then `body`. */
export const pdfText = (body: string, prefix = 0, padTo = 0): Buffer => {
  const text = `${' '.repeat(prefix)}${body}`;
  return Buffer.from(text.length + 3 <= padTo ? `${text}\n%${'q'.repeat(padTo - text.length - 3)}\n` : text, 'latin1');
};

/** A file of exactly `sizeBytes` that holds no data on disk (NTFS / ext4 sparse via ftruncate). */
export function sparseFile(path: string, sizeBytes: number): string {
  const fd = openSync(path, 'w');
  try {
    ftruncateSync(fd, sizeBytes);
  } finally {
    closeSync(fd);
  }
  return path;
}
