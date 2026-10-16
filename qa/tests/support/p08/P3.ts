/**
 * P3 helpers (QA-08): SCR-34 mocked list/detail, SCR-35 UI, SCR-36 UI. Bodies on the wire are camelCase (src/api/schemas).
 * Mocks mutate the REAL response (`route.fetch()`), so shapes stay valid without hand-built fixtures.
 */
import { expect, type APIRequestContext, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';

/** GET /api/library is a BARE ARRAY (phase08_library_api.spec.ts:72). */
export const itemsOf = (json: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(json)) throw new Error('environment: GET /api/library did not return a bare array');
  return json as Record<string, unknown>[];
};

/** dup-of: flows-C1 craftedLibrary — copies of the first real item (previewless, 900000, 900001 triangles, 120-char name). */
// dup-of: flows-C1 craftedLibrary craftedLibrary
export function craftedLibrary(real: Record<string, unknown>[]): Record<string, unknown>[] {
  const first = real[0];
  if (first === undefined) throw new Error('environment: GET /api/library has no item to copy');
  const { previewUrl: _drop, ...noPreview } = first;
  void _drop;
  return [
    { ...noPreview, id: `${String(first.id)}-nopreview`, name: 'QA preview-less model' },
    { ...first, id: `${String(first.id)}-h0`, name: 'QA heavy model 900000', triangleCount: 900000 },
    { ...first, id: `${String(first.id)}-h1`, name: 'QA heavy model 900001', triangleCount: 900001 },
    { ...first, id: `${String(first.id)}-long`, name: 'N'.repeat(120) },
  ];
}

export const deferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

// dup-of: flows-C1 holdRoute holdGet
/** holds GET `urlRe` until `release()`, then answers from the real server. */
export async function holdGet(page: Page, urlRe: RegExp): Promise<{ release: () => Promise<void> }> {
  const gate = deferred();
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== 'GET') return route.fallback();
    await gate.promise;
    return route.fallback();
  };
  await page.route(urlRe, handler);
  return {
    release: async () => {
      gate.resolve();
    },
  };
}

/** Error body per ApiErrorBodySchema (errors.ts:104, strict): { code, requestId }. */
const CODES: Record<number, string> = { 403: 'FORBIDDEN', 404: 'NOT_FOUND', 429: 'RATE_LIMITED', 500: 'INTERNAL_ERROR' };
export const failWith = (route: Route, status: 403 | 404 | 429 | 500): Promise<void> =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code: CODES[status], requestId: 'qa-p08-mock' }) });
export const fail500 = (route: Route): Promise<void> => failWith(route, 500);

/** GET answer for a bare-array endpoint: the real array replaced by `items` (real status/headers kept). */
export async function fulfilList(route: Route, items: unknown[]): Promise<void> {
  const real = await route.fetch();
  await route.fulfill({ response: real, json: items });
}

/** GET answer = the real body passed through `edit`. */
export async function fulfilEdited(route: Route, edit: (body: Record<string, unknown>) => void): Promise<void> {
  const real = await route.fetch();
  const body = (await real.json()) as Record<string, unknown>;
  edit(body);
  await route.fulfill({ response: real, json: body });
}

export async function readJson(api: APIRequestContext, path: string): Promise<unknown> {
  const res = await api.get(path);
  expect(res.status(), `GET ${path}`).toBe(200);
  return res.json();
}

/* ---------------------------------------------------------------- SCR-35 / SCR-36 shared UI helpers */

export const SETTLE_MS = 20_000;
export const panelOrDrawer = (page: Page, label: string): Locator =>
  page.locator(`aside[aria-label="${label}"]`).or(page.getByRole('dialog', { name: label, exact: true }));

// ponytail: copied from phase08_admin_ui.spec.ts:176-200 (training) — same selectors, verified against TrainingJobs sources there.
export const panelRows = (page: Page): Locator => page.getByRole('tabpanel').locator('button[aria-pressed]');
export async function openTraining(page: Page): Promise<void> {
  await page.goto(ROUTES.adminTrainingJobs);
  await expect(page.getByRole('heading', { level: 1, name: 'Huấn luyện model AI', exact: true })).toBeVisible({ timeout: SETTLE_MS });
  await expect(page.getByRole('tab', { name: 'Lượt huấn luyện', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: SETTLE_MS });
  await expect(page.getByText('Chưa có lượt huấn luyện', { exact: true }).or(panelRows(page).first())).toBeVisible();
}
export async function openCreateForm(page: Page): Promise<Locator> {
  await openTraining(page);
  await page.getByRole('button', { name: 'Tạo lượt huấn luyện', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo lượt huấn luyện' });
  await expect(dialog).toBeVisible();
  return dialog;
}

export const FAMILY_LABELS = { walls: 'Tách lớp tường', opening: 'Nhận diện cửa và đồ đạc', dimension: 'Đọc kích thước' } as const;
export type FamilyKey = keyof typeof FAMILY_LABELS;
export const FAMILY_ORDER: readonly FamilyKey[] = ['walls', 'opening', 'dimension'];
export const versionLabels = (page: Page): Locator => page.locator('table button[aria-pressed], li button[aria-pressed]');
export const enabledActivate = (page: Page): Locator => page.getByRole('button', { name: 'Kích hoạt', exact: true }).and(page.locator(':enabled'));
export const picker = (page: Page): Locator => page.getByRole('radiogroup', { name: 'Họ model' });

export async function selectFamily(page: Page, family: FamilyKey): Promise<void> {
  const radio = picker(page).getByRole('radio', { name: FAMILY_LABELS[family], exact: true });
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: SETTLE_MS });
  await expect(page.getByText('Chưa có phiên bản', { exact: true }).or(versionLabels(page).first())).toBeVisible({ timeout: SETTLE_MS });
}
export async function openRegistry(page: Page, family: FamilyKey = 'walls'): Promise<void> {
  await page.goto(ROUTES.adminTrainingModels);
  await expect(picker(page)).toBeVisible({ timeout: SETTLE_MS });
  await selectFamily(page, family);
}
/** First family with a match for `found`; hard `expect` with an `environment:` message when none (decision S2-3, no skip). */
export async function openRegistryWhere(page: Page, found: (p: Page) => Locator, why: string): Promise<Locator> {
  await openRegistry(page, 'walls');
  for (const family of FAMILY_ORDER) {
    await selectFamily(page, family);
    if ((await found(page).count()) > 0) return found(page).first();
  }
  expect(false, `environment: ${why}`).toBe(true);
  throw new Error('unreachable');
}

// dup-of: flows-C3 guardWrites guardWrites
/** aborts PUT …/active, counts attempts. */
export async function guardWrites(page: Page): Promise<{ count: () => number }> {
  let n = 0;
  await page.route(/\/api\/admin\/ml\/model-families\/[^/]+\/active$/u, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    n += 1;
    return route.abort();
  });
  return { count: () => n };
}

/* ---------------------------------------------------------------- SCR-35 mock fixtures (TrainingJobSchema, adminMl.ts:370) */
const ULID = (n: number): string => `01HZX${String(n).padStart(2, '0')}ABCDEFGHJKMNPQRSTV`.slice(0, 26).padEnd(26, 'A');
const AT = '2026-10-14T08:00:00.000Z'; // isoInstantSchema needs milliseconds (common.ts:32)
export function jobFixture(n: number, status: 'running' | 'queued' | 'succeeded', epochs = 40): Record<string, unknown> {
  return {
    baseModel: 'mitB0',
    createdAt: AT,
    creatorId: 'system:pipeline',
    datasetVersionId: `dsv_${ULID(n)}`,
    epochs,
    family: 'wallSegmentation',
    id: `job_${ULID(n)}`,
    status,
    ...(status === 'queued' ? {} : { startedAt: AT, currentEpoch: 5 }),
    ...(status === 'succeeded' ? { endedAt: '2026-10-14T08:30:00.000Z', resultModelVersionId: `mdl_${ULID(n)}` } : {}),
  };
}
export const metricPoints = (n: number): Record<string, unknown>[] =>
  Array.from({ length: n }, (_, i) => ({ epoch: i + 1, loss: 1 / (i + 1), recordedAt: AT, split: 'train', step: i }));
export const logLines = (n: number): Record<string, unknown>[] =>
  Array.from({ length: n }, (_, i) => ({ at: AT, level: 'info', message: `qa-p08 log line ${i + 1}`, seq: i }));

/** Mocks list, :id, metrics, logs, cancel. Cancel answers 409 TRAINING_JOB_NOT_CANCELLABLE (trainingJobsGateway.ts:151). */
export async function mockTraining(page: Page, state: { mode: 'ok' | '500'; jobs: Record<string, unknown>[]; cancels: number }): Promise<void> {
  await page.route(/\/api\/admin\/ml\/training-jobs(\/.*)?(\?.*)?$/u, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === 'POST' && path.endsWith('/cancel')) {
      state.cancels += 1;
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'TRAINING_JOB_NOT_CANCELLABLE', requestId: 'qa-p08-mock' }) });
    }
    if (req.method() !== 'GET') return route.fallback();
    if (state.mode === '500') return fail500(route);
    if (path.endsWith('/metrics')) return route.fulfill({ json: { items: metricPoints(12), nextCursor: 'c1' } });
    if (path.endsWith('/logs')) return route.fulfill({ json: { items: logLines(30), nextCursor: 'c1' } });
    const id = path.split('/').pop();
    const one = state.jobs.find((j) => j.id === id);
    if (one !== undefined) return route.fulfill({ json: one });
    return route.fulfill({ json: { items: state.jobs } });
  });
}
