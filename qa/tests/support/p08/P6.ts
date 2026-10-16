/**
 * P6 helpers (SCR-35 `phase08_training_b_mocked_edge.spec.ts`): a mocked `/api/admin/ml/**` for the training screen.
 * Wire shapes copy src/api/schemas/adminMl.ts (TrainingJobSchema :370, TrainingMetricPointSchema :452, TrainingLogLineSchema :489,
 * DatasetSchema :262, DatasetVersionSchema :295); routes copy src/api/endpoints.ts:65-78. `// dup-of:` names the flows-C2 helper
 * that package P5 writes in parallel (the coordinator merges at S4).
 *
 * A GET of an unknown job id is a 404 `trainingJob`; any other request that matches no known route is aborted and recorded in `unexpected`; every POST without a responder is aborted AND recorded in `unexpected`
 * (a spec asserts `unexpected` is empty at the end): no real POST can leave the page.
 */
import type { Page } from '@playwright/test';

export type Answer = { status: number; body: unknown } | 'abort';
export type Call = { method: string; path: string; query: URLSearchParams; headers: Record<string, string>; body: unknown };
export type Responder = (call: Call) => Answer | Promise<Answer>;

/** ULID-shaped id the schemas accept (`^<prefix>_[0-9A-HJKMNP-TV-Z]{26}$`); digits only. */
export const wireId = (prefix: 'job' | 'dst' | 'dsv' | 'mdl', n: number): string => `${prefix}_${String(n).padStart(26, '0')}`;
const iso = (n: number): string => new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString();
const CREATOR = 'usr_00000000000000000000000001';

export interface WireJob {
  baseModel: string;
  createdAt: string;
  creatorId: string;
  currentEpoch?: number;
  datasetVersionId: string;
  endedAt?: string;
  epochs: number;
  failureCode?: string;
  family: string;
  id: string;
  resultModelVersionId?: string;
  startedAt?: string;
  status: string;
}

// dup-of: phase08Training.ts jobFixture
export function jobFixture(o: { n: number; status: string; family?: string; baseModel?: string; epochs: number; currentEpoch?: number; failureCode?: string }): WireJob {
  const family = o.family ?? 'wallSegmentation';
  const job: WireJob = {
    baseModel: o.baseModel ?? (family === 'wallSegmentation' ? 'mitB0' : 'yolov8n'),
    createdAt: iso(o.n),
    creatorId: CREATOR,
    datasetVersionId: wireId('dsv', 1),
    epochs: o.epochs,
    family,
    id: wireId('job', o.n),
    status: o.status,
    ...(o.currentEpoch === undefined ? {} : { currentEpoch: o.currentEpoch }),
  };
  if (o.status === 'running' || o.status === 'cancelling') job.startedAt = iso(o.n + 1);
  if (o.status === 'failed') {
    job.failureCode = o.failureCode ?? 'TRAINING_TIMEOUT';
    job.endedAt = iso(o.n + 2);
  }
  if (o.status === 'cancelled') job.endedAt = iso(o.n + 2);
  if (o.status === 'succeeded') {
    job.startedAt = iso(o.n + 1);
    job.endedAt = iso(o.n + 2);
    job.resultModelVersionId = wireId('mdl', 1);
  }
  return job;
}

// dup-of: phase08Training.ts datasetFixture
export const datasetFixture = (n: number, family = 'wallSegmentation') => ({ createdAt: iso(n), family, id: wireId('dst', n), name: `QA dataset ${n}` });

// dup-of: phase08Training.ts versionFixture
export const versionFixture = (datasetN: number, sequence: number) => ({
  createdAt: iso(sequence),
  datasetId: wireId('dst', datasetN),
  id: wireId('dsv', sequence),
  manifestSha256: 'a'.repeat(64),
  sequence,
  source: 'approvedFloors',
  splitCounts: { test: 1, train: 8, validation: 1 },
  status: 'ready',
});

export interface Point { epoch: number; iou?: number; loss?: number; recordedAt: string; split: 'train' | 'validation'; step: number }
export interface Line { at: string; level: 'info' | 'warning' | 'error'; message: string; seq: number }

// dup-of: phase08Training.ts metricPoints (steps from..from+n-1, ascending; epoch = step)
export const metricPoints = (n: number, from = 1, split: Point['split'] = 'validation'): Point[] =>
  Array.from({ length: n }, (_u, i) => ({
    epoch: from + i,
    iou: Math.min(0.9999, (from + i) / 10_000 + 0.5),
    loss: 1 / (from + i),
    recordedAt: iso(from + i),
    split,
    step: from + i,
  }));

// dup-of: phase08Training.ts logLines (seq from..from+n-1, levels cycle info/warning/error)
export const logLines = (n: number, from = 1): Line[] =>
  Array.from({ length: n }, (_u, i) => ({
    at: iso(from + i),
    level: (['info', 'warning', 'error'] as const)[i % 3] ?? 'info',
    message: `qa log line ${from + i}`,
    seq: from + i,
  }));

// dup-of: phase08Training.ts wireError (shape read by readWireError: src/lib/errors/wireError.ts:86)
export const wireError = (status: number, code: string, extra: Record<string, string> = {}): Answer => ({
  body: { code, message: `qa mocked ${code}`, requestId: `qa-${code.toLowerCase()}`, ...extra },
  status,
});

export const ok = (body: unknown, status = 200): Answer => ({ body, status });
export const notFoundJob = (): Answer => wireError(404, 'NOT_FOUND', { resource: 'trainingJob' });

/** Cursor stream (N36/N37): items with key > `since`, 200 per page, `nextCursor` = last key returned (or `since`; "0" at the start). */
export function cursorFeed<T>(keyOf: (item: T) => number): { items: T[]; responder: Responder } {
  const feed = {
    items: [] as T[],
    responder: ((call: Call) => {
      const since = call.query.get('since');
      const after = since === null ? -1 : Number(since);
      const page = feed.items.filter((i) => keyOf(i) > after).slice(0, 200);
      const last = page.at(-1);
      return ok({ items: page, nextCursor: last === undefined ? String(Math.max(after, 0)) : String(keyOf(last)) });
    }) as Responder,
  };
  return feed;
}

export type GetKind = 'jobs' | 'job' | 'metrics' | 'logs' | 'versions' | 'datasets';

export interface TrainingMock {
  calls: Call[];
  unexpected: Call[];
  jobs: WireJob[];
  /** Raw body per job id for GET /training-jobs/:id (overrides `jobs`). */
  jobBody: Record<string, unknown>;
  datasets: unknown[];
  versions: unknown[];
  metrics: Responder;
  logs: Responder;
  create?: Responder;
  cancel?: Responder;
  /** Recorded GETs of one kind (optionally of one job). */
  gets(kind: GetKind, jobId?: string): Call[];
  /** Recorded POSTs: create (`training-jobs`) or cancel (`…/cancel`). */
  posts(kind: 'create' | 'cancel'): Call[];
}

const PATH = /^\/api\/admin\/ml\/(training-jobs|datasets)(?:\/([^/]+))?(?:\/([a-z]+))?$/u;

const kindOf = (path: string): GetKind | null => {
  const m = PATH.exec(path);
  if (m === null) return null;
  const [, root, id, sub] = m;
  if (root === 'datasets') return sub === 'versions' ? 'versions' : 'datasets';
  if (id === undefined) return 'jobs';
  return sub === undefined ? 'job' : sub === 'metrics' ? 'metrics' : sub === 'logs' ? 'logs' : null;
};
const idOf = (path: string): string | undefined => PATH.exec(path)?.[2];

// dup-of: phase08Training.ts mockTrainingApi
export async function mockTrainingApi(page: Page, init: Partial<Pick<TrainingMock, 'jobs' | 'datasets' | 'versions'>> = {}): Promise<TrainingMock> {
  const empty = cursorFeed<never>(() => 0);
  const mock: TrainingMock = {
    calls: [],
    datasets: init.datasets ?? [],
    gets: (kind, jobId) => mock.calls.filter((c) => c.method === 'GET' && kindOf(c.path) === kind && (jobId === undefined || idOf(c.path) === jobId)),
    jobBody: {},
    jobs: init.jobs ?? [],
    logs: empty.responder,
    metrics: empty.responder,
    posts: (kind) => mock.calls.filter((c) => c.method === 'POST' && (kind === 'cancel' ? c.path.endsWith('/cancel') : c.path.endsWith('/training-jobs'))),
    unexpected: [],
    versions: init.versions ?? [],
  };
  await page.route(/\/api\/admin\/ml\//u, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    const call: Call = { body, headers: req.headers(), method: req.method(), path: url.pathname, query: url.searchParams };
    const kind = kindOf(call.path);
    const id = idOf(call.path);
    let answer: Answer | undefined;
    if (call.method === 'GET' && kind !== null) {
      mock.calls.push(call);
      if (kind === 'datasets') answer = ok({ items: mock.datasets });
      else if (kind === 'versions') answer = ok({ items: mock.versions });
      else if (kind === 'jobs') answer = ok({ items: mock.jobs });
      else if (kind === 'metrics') answer = await mock.metrics(call);
      else if (kind === 'logs') answer = await mock.logs(call);
      else {
        const raw = (id === undefined ? undefined : mock.jobBody[id]) ?? mock.jobs.find((j) => j.id === id);
        answer = raw === undefined ? notFoundJob() : ok(raw);
      }
    } else if (call.method === 'POST' && (kind === 'jobs' || call.path.endsWith('/cancel'))) {
      mock.calls.push(call);
      const responder = kind === 'jobs' ? mock.create : mock.cancel;
      if (responder === undefined) mock.unexpected.push(call);
      else answer = await responder(call);
    } else {
      mock.unexpected.push(call);
    }
    if (answer === undefined || answer === 'abort') {
      await route.abort('failed');
      return;
    }
    await route.fulfill({ body: JSON.stringify(answer.body), contentType: 'application/json', status: answer.status });
  });
  return mock;
}

/** Hold a responder's answer until `release()`; `seen` resolves when the request arrived. */
export function held(answer: Answer): { responder: Responder; seen: Promise<void>; release: () => void } {
  let release = (): void => undefined;
  let seen = (): void => undefined;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const seenP = new Promise<void>((r) => {
    seen = r;
  });
  return {
    release,
    responder: async () => {
      seen();
      await gate;
      return answer;
    },
    seen: seenP,
  };
}
