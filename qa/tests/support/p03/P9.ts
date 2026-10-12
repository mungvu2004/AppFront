/**
 * QA-03d P9 helpers for `phase03_processing_mocked_edge.spec.ts` and `phase03_processing_ui.spec.ts` (SCR-12, mocked
 * responses). Owned by P9 only; shared seeds stay in `../phase03Seed.ts` and the P5 flow session in `./P5.ts` (re-used).
 *
 * - {@link SseServer}: a local `text/event-stream` server. `attach(page)` routes the page's
 *   `GET /api/streams/projects/:id/uploads/:uid/progress` (ENDPOINTS.streams.uploadProgress) to it with `route.continue`
 *   (same request, other host, transparent to the page), so the real `EventSource` of the app keeps a HELD-OPEN stream
 *   and the test pushes frames one by one (`send`), drops it (`drop`) or refuses the next N connections (`abortNext`).
 *   `route.fulfill` cannot stream: every fulfilled body ends the stream, and the app's back-off (1, 2, 4 … 30 s,
 *   src/lib/realtime/backoff.ts) would then pace every batch.
 * - {@link mockRuns}: N7 `GET …/drawings/uploads/latest` and #8 `GET …/drawings/uploads/:uid/progress` answered from
 *   test state (per-upload answer, one-shot answers, held answers), every request counted.
 * - {@link progress}: a #8 / SSE `Progress` body that passes the FE `ProgressSchema` (.strict(), src/api/schemas/index.ts:170).
 * - {@link stepStates}: the six step rows of the focus floor as `{ name, status }`, read from the row's name colour token
 *   (`STAGE_TEXT_CLASS`, src/screens/pipeline/ProcessingScreen/processingStatusTokens.ts).
 * - {@link spaNavigate}: in-app navigation without a reload (history + popstate; createBrowserRouter listens to popstate).
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, type Page, type Route } from '@playwright/test';

type Json = Record<string, unknown>;

const STREAM_RE = /^\/api\/streams\/projects\/[^/]+\/uploads\/([^/]+)\/progress$/u;

/* ---- Progress bodies ------------------------------------------------------------------------- */

/** The six stage ids in order (src/lib/realtime/pipeline.ts PIPELINE_STAGE_IDS) and their labels (vi.json `pipeline`). */
export const STAGES = [
  ['preprocess', 'Tiền xử lý'],
  ['wallSegmentation', 'Tách lớp tường'],
  ['openingAndFurnitureDetection', 'Nhận diện cửa và đồ đạc'],
  ['dimensionReading', 'Đọc kích thước'],
  ['spatialDataBuild', 'Dựng dữ liệu không gian'],
  ['qualityCheck', 'Kiểm tra chất lượng'],
] as const;
export type StageId = (typeof STAGES)[number][0];
export const stageLabel = (id: string): string => STAGES.find(([sid]) => sid === id)?.[1] ?? id;

const STARTED_AT = '2026-10-12T08:00:00Z';

/** A wire `Progress` (BE drawings/progress.py `progress_of`: `id` = upload id, `startedAt` once a run exists). */
export function progress(
  uploadId: string,
  status: 'pending' | 'running' | 'completed' | 'failed',
  step: string,
  percent: number,
  extra: { readonly error?: string; readonly omitError?: boolean } = {},
): Json {
  return {
    id: uploadId,
    status,
    step,
    progressPercent: percent,
    ...(status === 'pending' ? {} : { startedAt: STARTED_AT }),
    ...(status === 'completed' ? { endedAt: '2026-10-12T08:05:00Z' } : {}),
    ...(extra.error !== undefined ? { error: extra.error } : {}),
  };
}

/** Crockford base32 (the N7 `uploadId` regex `^upl_[0-9A-HJKMNP-TV-Z]{26}$`, src/api/schemas/uploads.ts:13). */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let uploadSeq = 0;
/** A run-unique fake upload id that passes the N7 schema. */
export function fakeUploadId(): string {
  uploadSeq += 1;
  let n = Date.now() * 1_000 + uploadSeq;
  let tail = '';
  while (n > 0) {
    tail = `${CROCKFORD[n % 32] ?? '0'}${tail}`;
    n = Math.floor(n / 32);
  }
  return `upl_QA${tail.padStart(24, '0')}`.slice(0, 30);
}

/* ---- SSE server ------------------------------------------------------------------------------ */

export interface SseConnection {
  readonly uploadId: string;
  /** `pathname + search` the page asked for (e.g. `…/progress?lastEventId=7`). */
  readonly url: string;
  readonly openedAt: number;
  closed: boolean;
  readonly res: ServerResponse;
}

export class SseServer {
  readonly connections: SseConnection[] = [];
  /** Stream requests refused with `route.abort('failed')` before reaching the server (no `onopen`). */
  readonly aborted: string[] = [];
  private abortBudget = 0;
  private readonly server: Server;
  private readonly port: number;

  private constructor(server: Server, port: number) {
    this.server = server;
    this.port = port;
  }

  static async start(): Promise<SseServer> {
    const holder: { sse?: SseServer } = {};
    const server = createServer((req: IncomingMessage, res: ServerResponse) => holder.sse?.accept(req, res));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    holder.sse = new SseServer(server, (server.address() as AddressInfo).port);
    return holder.sse;
  }

  private accept(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? '';
    const uploadId = STREAM_RE.exec(url.split('?')[0] ?? '')?.[1] ?? '';
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(': qa\n\n');
    const conn: SseConnection = { uploadId, url, openedAt: Date.now(), closed: false, res };
    req.on('close', () => {
      conn.closed = true;
    });
    this.connections.push(conn);
  }

  /** Routes this page's progress streams here (call before `goto`). */
  async attach(page: Page): Promise<void> {
    await page.route(
      (url) => STREAM_RE.test(url.pathname),
      async (route: Route) => {
        const url = new URL(route.request().url());
        if (this.abortBudget > 0) {
          this.abortBudget -= 1;
          this.aborted.push(`${url.pathname}${url.search}`);
          await route.abort('failed').catch(() => undefined);
          return;
        }
        await route.continue({ url: `http://127.0.0.1:${String(this.port)}${url.pathname}${url.search}` }).catch(() => undefined);
      },
    );
  }

  /** The next `count` stream requests fail at the network (EventSource `onerror` without `onopen`). */
  abortNext(count: number): void {
    this.abortBudget = count;
  }

  of(uploadId: string): SseConnection[] {
    return this.connections.filter((c) => c.uploadId === uploadId);
  }

  open(uploadId: string): SseConnection[] {
    return this.of(uploadId).filter((c) => !c.closed);
  }

  /** Waits until `uploadId` has at least `count` connections in total (open or closed). */
  async waitForConnections(uploadId: string, count = 1, timeout = 30_000): Promise<SseConnection> {
    await expect
      .poll(() => this.of(uploadId).length, { message: `${String(count)} SSE connection(s) for ${uploadId}`, timeout })
      .toBeGreaterThanOrEqual(count);
    const last = this.of(uploadId).at(-1);
    if (last === undefined) throw new Error('unreachable');
    return last;
  }

  /** Writes `frames` (unnamed events → `onmessage`, eventChannel.ts) to the newest open stream of `uploadId`. */
  async send(uploadId: string, frames: readonly Json[], firstId?: number): Promise<void> {
    await expect.poll(() => this.open(uploadId).length, { message: `an open SSE stream for ${uploadId}` }).toBeGreaterThan(0);
    const conn = this.open(uploadId).at(-1);
    if (conn === undefined) throw new Error('unreachable');
    const text = frames
      .map((frame, i) => `${firstId === undefined ? '' : `id: ${String(firstId + i)}\n`}data: ${JSON.stringify(frame)}\n\n`)
      .join('');
    await new Promise<void>((resolve) => conn.res.write(text, () => resolve()));
  }

  /** Cuts the newest open stream of `uploadId` (socket destroyed: the page sees a dropped connection). */
  drop(uploadId: string): void {
    const conn = this.open(uploadId).at(-1);
    conn?.res.destroy();
  }

  async close(): Promise<void> {
    for (const conn of this.connections) conn.res.destroy();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}

/* ---- N7 / #8 mocks ----------------------------------------------------------------------------- */

export interface UploadItem {
  readonly floorId: string;
  readonly floorName: string;
  readonly uploadId: string;
  readonly sourceImageUrl?: string;
}

/** One mocked answer: a JSON body with a status (200 by default), optionally held until `release` resolves. */
export interface Answer {
  readonly status?: number;
  readonly body?: unknown;
  readonly hold?: Promise<void>;
}

export interface RunsMock {
  /** N7 items, in order (answered as `{ items }`, no `nextCursor`). */
  uploads: UploadItem[];
  /** Overrides the N7 answer while set (e.g. 500); `'real'` → the real backend; `null` → `{ items: uploads }`. */
  n7Answer: Answer | 'real' | null;
  /** One-shot N7 answers, consumed first. */
  readonly n7Once: Answer[];
  /** #8 answer per upload id. */
  readonly progressOf: Map<string, Answer>;
  /** One-shot #8 answers per upload id, consumed before `progressOf`. */
  readonly progressOnce: Map<string, Answer[]>;
  /** Every mocked request, in order: `n7` or the upload id of a #8 read. */
  readonly calls: string[];
  /** Requests so far for `key` (`n7` or an upload id). */
  readonly count: (key: string) => number;
}

async function answer(route: Route, a: Answer): Promise<void> {
  if (a.hold !== undefined) await a.hold;
  await route
    .fulfill({ status: a.status ?? 200, contentType: 'application/json', body: JSON.stringify(a.body ?? {}) })
    .catch(() => undefined); // the page navigated away while the answer was held
}

/** Mocks N7 and #8 of `projectId` on `page` (call before `goto`); a fake upload's preview image is served too. */
export async function mockRuns(page: Page, projectId: string, previewPng?: Buffer): Promise<RunsMock> {
  const n7Path = `/api/projects/${projectId}/drawings/uploads/latest`;
  const progressRe = new RegExp(`^/api/projects/${projectId}/drawings/uploads/([^/]+)/progress$`, 'u');
  const mock: RunsMock = {
    uploads: [],
    n7Answer: null,
    n7Once: [],
    progressOf: new Map(),
    progressOnce: new Map(),
    calls: [],
    count: (key) => mock.calls.filter((c) => c === key).length,
  };
  await page.route(
    (url) => url.pathname === n7Path,
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      mock.calls.push('n7');
      const once = mock.n7Once.shift();
      if (once === undefined && mock.n7Answer === 'real') return route.fallback();
      await answer(route, once ?? (mock.n7Answer === 'real' ? null : mock.n7Answer) ?? { body: { items: mock.uploads } });
    },
  );
  await page.route(
    (url) => progressRe.test(url.pathname),
    async (route) => {
      const uploadId = progressRe.exec(new URL(route.request().url()).pathname)?.[1] ?? '';
      mock.calls.push(uploadId);
      const once = mock.progressOnce.get(uploadId)?.shift();
      const a = once ?? mock.progressOf.get(uploadId);
      if (a === undefined) return route.fallback();
      await answer(route, a);
    },
  );
  if (previewPng !== undefined) {
    await page.route(
      (url) => url.pathname.startsWith('/qa-preview/'),
      (route) => route.fulfill({ status: 200, contentType: 'image/png', body: previewPng }),
    );
  }
  return mock;
}

/** `{ status, body }` of a JSON error the FE reads with `readWireError` (BE envelope `{ code, message, requestId }`). */
export const wireError = (status: number, code: string): Answer => ({
  status,
  body: { code, message: `qa mocked ${code}`, requestId: `qa-${code.toLowerCase()}` },
});

/* ---- page helpers ---------------------------------------------------------------------------- */

export type StepStatus = 'queued' | 'running' | 'done' | 'failed' | '?';

/** The focus floor's six step rows (`ol[aria-label="Các bước xử lý"]`, ProcessingStepList.tsx:241-250). */
export function stepStates(page: Page): Promise<{ name: string; status: StepStatus }[]> {
  return page
    .locator('ol[aria-label="Các bước xử lý"]')
    .first()
    .evaluate((ol) =>
      [...ol.querySelectorAll(':scope > li')].map((li) => {
        const nameEl = li.querySelector('span.flex-1');
        const cls = nameEl?.className ?? '';
        // STAGE_TEXT_CLASS: queued text-text-secondary, running text-text-primary, done …verified-text, failed …violation-text.
        const status = cls.includes('text-state-verified-text')
          ? 'done'
          : cls.includes('text-state-violation-text')
            ? 'failed'
            : cls.includes('text-text-primary')
              ? 'running'
              : cls.includes('text-text-secondary')
                ? 'queued'
                : '?';
        return { name: (nameEl?.textContent ?? '').trim(), status: status as 'queued' | 'running' | 'done' | 'failed' | '?' };
      }),
    );
}

/** `stepStates` as one comparable line, e.g. `done,done,running,queued,queued,queued`. */
export const stepLine = async (page: Page): Promise<string> => (await stepStates(page)).map((s) => s.status).join(',');

/** The expected `stepLine` while stage `index` (0-based) runs and every earlier stage is done (C3). */
export const runningAt = (index: number, current: StepStatus = 'running'): string =>
  STAGES.map((_, i) => (i < index ? 'done' : i === index ? current : 'queued')).join(',');

/** In-app navigation (no reload): history entry + popstate, which the data router listens to. */
export async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState(null, '', to);
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  }, path);
}

/** "2 phút 5 giây" / "45 giây" / "1 giờ 3 phút" (formatDuration) → seconds; NaN when nothing matches. */
export function durationSeconds(text: string): number {
  const part = (unit: string): number => Number(new RegExp(`(\\d+)\\s*${unit}`, 'u').exec(text)?.[1] ?? 0);
  const total = part('giờ') * 3_600 + part('phút') * 60 + part('giây');
  return /\d/u.test(text) ? total : Number.NaN;
}
