/**
 * P8 helpers for SCR-36 mocked registry flows (phase08_registry_mocked_edge.spec.ts).
 * Everything lives in this file (no spec imports another spec).
 *
 * `openMocked(browser)`: admin session (1 login) + a page whose `/api/admin/ml/**` traffic is answered by `RegistryMock`.
 * PUT .../active is NEVER sent to the real server: a lowest-priority guard route aborts + counts every PUT that the mock
 * did not fulfil (`leaked()` must stay 0), and the mock only fulfils a PUT through `mock.put` / its default 200.
 */
import { expect, test, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { apiBaseUrl } from '../api';
import { readAdminCredentials } from '../auth';
import { captureEvidence } from '../evidence';

export type FamilyId = 'wallSegmentation' | 'openingAndFurnitureDetection' | 'dimensionReading';
// dup-of: flows-C3 FAMILY_LABEL (registry.ts)
export const FAMILY_LABEL: Readonly<Record<FamilyId, string>> = {
  wallSegmentation: 'Tách lớp tường', // useModelRegistry.ts:71-75
  openingAndFurnitureDetection: 'Nhận diện cửa và đồ đạc',
  dimensionReading: 'Đọc kích thước',
};

export interface Json {
  readonly [key: string]: unknown;
}
export type Answer = { readonly status: number; readonly body: unknown } | { readonly abort: true };
type Maybe<T> = T | Promise<T>;

/** 26 Crockford chars after `mdl_` (adminMl.ts modelVersionIdSchema). */
export const versionId = (n: number): string => `mdl_${'0'.repeat(24)}${String(n).padStart(2, '0')}`;

export interface VersionOpts {
  readonly status?: 'pending' | 'running' | 'completed' | 'failed';
  readonly format?: 'onnx' | 'safetensors';
}
const METRIC: Record<FamilyId, string> = { wallSegmentation: 'iou', openingAndFurnitureDetection: 'map50', dimensionReading: 'cer' };

/** One wire ModelVersion (adminMl.ts ModelVersionSchema: completed <=> metrics; creatorId system:pipeline). */
export function wireVersion(n: number, family: FamilyId, label: string, o: VersionOpts = {}): Json {
  const status = o.status ?? 'completed';
  return {
    checksumSha256: 'a'.repeat(64),
    createdAt: '2026-10-01T08:00:00.000Z',
    creatorId: 'system:pipeline',
    evaluationStatus: status,
    family,
    id: versionId(n),
    label,
    ...(status === 'completed' ? { metrics: { [METRIC[family]]: 0.8 } } : {}),
    weightsFormat: o.format ?? 'onnx',
  };
}
export const wireFamily = (family: FamilyId, revision: number, active?: number): Json => ({
  family,
  revision,
  ...(active === undefined ? {} : { activeVersionId: versionId(active) }),
});
/** BE error envelope (`code` UPPER_SNAKE, `resource`) as read by readWireError. */
export const wireError = (status: number, code?: string, resource?: string): Answer => ({
  status,
  body: { ...(code === undefined ? {} : { code }), ...(resource === undefined ? {} : { resource }), message: 'qa mocked' },
});

const defaultFamilies = (): Json[] => [
  wireFamily('wallSegmentation', 3, 1),
  wireFamily('openingAndFurnitureDetection', 5, 10),
  wireFamily('dimensionReading', 1, 20),
];
const defaultVersions = (): Record<FamilyId, Json[]> => ({
  wallSegmentation: [
    wireVersion(1, 'wallSegmentation', 'Bản tường 1'),
    wireVersion(2, 'wallSegmentation', 'Bản tường 2'),
    wireVersion(3, 'wallSegmentation', 'Gốc'),
  ],
  openingAndFurnitureDetection: [
    wireVersion(10, 'openingAndFurnitureDetection', 'Bản cửa A'),
    wireVersion(11, 'openingAndFurnitureDetection', 'Bản cửa B'),
    wireVersion(12, 'openingAndFurnitureDetection', 'Bản cửa C'),
  ],
  dimensionReading: [wireVersion(20, 'dimensionReading', 'Bản kích thước 1')],
});

export interface RegistryMock {
  /** Answer overrides: return null for the default data. `reset()` clears them. */
  families: (() => Maybe<Answer> | null) | null;
  versions: ((url: URL) => Maybe<Answer> | null) | null;
  version: ((id: string) => Maybe<Answer> | null) | null;
  /** PUT answer; default = 200 `{family, revision: baseVersion+1, activeVersionId}`. */
  put: ((body: Json, nth: number) => Maybe<Answer>) | null;
  /** true: GETs go to the real server (PUT stays mocked/guarded). */
  real: boolean;
  data: { families: Json[]; versions: Record<FamilyId, Json[]> };
  /** `METHOD path?query` of every request seen. */
  readonly log: string[];
  /** Bodies of PUTs the mock fulfilled. */
  readonly puts: Json[];
  reset: () => void;
}

export interface MockedSession {
  readonly page: Page;
  readonly mock: RegistryMock;
  /** PUTs that reached the guard (= not fulfilled by the mock): must be 0. */
  readonly leaked: () => number;
  /** Remove the mock, reload, expect a REAL 200 read of N23; PUTs to the network stay 0. */
  realRead: () => Promise<void>;
  close: () => Promise<void>;
}

const ML = /^\/api\/admin\/ml\//u;

export async function openMocked(browser: Browser, viewport = { width: 1440, height: 900 }): Promise<MockedSession> {
  const context: BrowserContext = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  const page = await context.newPage();
  const { email, password } = readAdminCredentials();
  const login = await context.request.post('/api/auth/login', {
    headers: { Origin: apiBaseUrl() },
    data: { email, password, rememberMe: false },
  });
  expect(login.status(), 'POST /api/auth/login (in-context sign-in)').toBe(204);

  const mock: RegistryMock = {
    families: null,
    versions: null,
    version: null,
    put: null,
    real: false,
    data: { families: defaultFamilies(), versions: defaultVersions() },
    log: [],
    puts: [],
    reset() {
      this.families = null;
      this.versions = null;
      this.version = null;
      this.put = null;
      this.real = false;
      this.data = { families: defaultFamilies(), versions: defaultVersions() };
    },
  };
  let leaked = 0;
  const matcher = (url: URL): boolean => ML.test(url.pathname);
  // Registered first = lowest priority: every PUT the mock did not fulfil lands here, is aborted and counted.
  const guard = async (route: Route): Promise<void> => {
    if (route.request().method() !== 'PUT') return route.fallback();
    leaked += 1;
    return route.abort();
  };
  await page.route(matcher, guard);

  const send = (route: Route, a: Answer): Promise<void> =>
    'abort' in a
      ? route.abort('failed')
      : route.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) });
  const handler = async (route: Route): Promise<void> => {
    const req = route.request();
    const url = new URL(req.url());
    mock.log.push(`${req.method()} ${url.pathname}${url.search}`);
    if (req.method() === 'PUT') {
      const body = (req.postDataJSON() ?? {}) as Json;
      const nth = mock.puts.length;
      mock.puts.push(body);
      if (mock.put !== null) return send(route, await mock.put(body, nth));
      const inner = (body.body ?? {}) as Json;
      return send(route, {
        status: 200,
        body: {
          family: url.pathname.split('/')[5] ?? '',
          revision: Number(body.baseVersion) + 1,
          ...(typeof inner.versionId === 'string' ? { activeVersionId: inner.versionId } : {}),
        },
      });
    }
    if (req.method() !== 'GET') return route.fallback();
    if (mock.real) return route.continue();
    const path = url.pathname.replace(/^\/api\/admin\/ml\//u, '');
    let answer: Maybe<Answer> | null = null;
    if (path === 'model-families') {
      answer = mock.families?.() ?? null;
      answer ??= { status: 200, body: { items: mock.data.families } };
    } else if (path === 'model-versions') {
      answer = mock.versions?.(url) ?? null;
      answer ??= { status: 200, body: { items: mock.data.versions[(url.searchParams.get('family') ?? 'wallSegmentation') as FamilyId] } };
    } else if (path.startsWith('model-versions/')) {
      const id = path.slice('model-versions/'.length);
      answer = mock.version?.(id) ?? null;
      const found = Object.values(mock.data.versions).flat().find((v) => v.id === id);
      answer ??= found === undefined ? wireError(404, undefined, 'modelVersion') : { status: 200, body: found };
    } else return route.fallback();
    return send(route, await answer);
  };
  await page.route(matcher, handler);

  return {
    page,
    mock,
    leaked: () => leaked,
    async realRead() {
      await page.unroute(matcher, handler);
      const read = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/admin/ml/model-families');
      await page.reload();
      expect((await read).status(), 'real GET model-families').toBe(200);
      await expect(picker(page)).toBeVisible();
      expect(leaked, 'PUT requests that reached the network guard').toBe(0);
    },
    async close() {
      await page.unroute(matcher, handler).catch(() => undefined);
      await page.unroute(matcher, guard).catch(() => undefined);
      await context.close().catch(() => undefined);
    },
  };
}

/** goto the registry (commit only; the caller waits for what it needs). */
export const gotoRegistry = (page: Page): Promise<unknown> => page.goto(ROUTES.adminTrainingModels, { waitUntil: 'commit' });
export const picker = (page: Page) => page.getByRole('radiogroup', { name: 'Họ model', exact: true });
export const activeCard = (page: Page) => page.locator('section[aria-label="Đang dùng"]'); // ModelRegistry.tsx:90
export const rowOf = (page: Page, label: string) => page.locator('tr').filter({ has: page.getByRole('button', { name: label, exact: true }) });
export const dialog = (page: Page) => page.getByRole('dialog');
export const toast = (page: Page, text: string) => page.getByText(text);
export const detail = (page: Page) => page.getByRole('complementary', { name: 'Chi tiết phiên bản', exact: true });
export const selectFamily = (page: Page, family: FamilyId) => picker(page).getByRole('radio', { name: FAMILY_LABEL[family], exact: true }).click();
/** Reload (the screen opens on the wall family) and optionally wait for a row. */
export async function fresh(s: MockedSession, label?: string): Promise<void> {
  await s.page.reload();
  if (label !== undefined) await expect(rowOf(s.page, label)).toBeVisible();
}
/** Wait until `log` has an entry matching `re` after index `from`. */
export const seenSince = (log: readonly string[], from: number, re: RegExp): Promise<void> =>
  expect.poll(() => log.slice(from).some((l) => re.test(l)), { message: `request ${String(re)}` }).toBe(true);

/** Evidence per step: `E08_<row id>_registry.png` (retry suffix keeps names unique inside one worker). */
export async function shot(page: Page, id: string, caption?: string): Promise<void> {
  const retry = test.info().retry;
  await captureEvidence(page, `E08_${id}_registry${retry > 0 ? `_r${String(retry)}` : ''}.png`, caption === undefined ? {} : { caption });
}

/** Timeout for reads that end in an error after retries (1 query retry; 429 ladder ~4 s). */
export const LONG = { timeout: 20_000 } as const;
/** Resolve-by-hand gate for holding a response. */
export function gate(): { readonly open: () => void; readonly wait: Promise<void> } {
  let open: () => void = () => undefined;
  const wait = new Promise<void>((r) => {
    open = r;
  });
  return { open, wait };
}
