/**
 * Phase 3 — EDGE CASES, Track A (admin): the last two isolated SCR-12 tests of the pre-QA-03d edge file.
 *
 * QA-03d folded every other test of this file into the flow files (`phase03_*_edge.spec.ts`, inventory
 * `F:/App/AppBack/backend/dieu-phoi/chay/QA-03d/flow-plan.md`). These two are owned by P9 (FL-12-13 [12-A-016],
 * FL-12-16 [12-B-010] [12-A-022] [12-A-023] in `phase03_processing_mocked_edge.spec.ts`); delete this file once P9's
 * branch is merged.
 *
 * Every expected result cites the FE source @ 8dce4ba8 (QA-03) or, written `BE:`, AppBack (`apps/api/…`).
 *   PR  src/screens/pipeline/ProcessingScreen/ProcessingScreen.tsx   UPR …/useProcessingScreen.ts
 *
 * ## Non-serial, parallel-safe
 * Every test opens its OWN browser context with its OWN admin `POST /api/auth/login` (never the stored admin session
 * file: its refresh cookie rotates, so parallel writers clash), creates its OWN project through the real API and
 * deletes it in `finally`.
 *
 * ## Mocks — "[mocked response]" in the title (1 of 2)
 * - `GET /api/projects/:id/drawings/uploads/latest` 500 (P13) — unpairable: 5xx is not producible on the shared stack.
 *
 * ## Real-backend budget per run
 * - `POST /api/auth/login`: 2 (one per test). `POST /api/projects`: 2, each deleted in `finally`.
 * - `drawings_init` (60 per window per user): 1 (P8, no `complete`: the upload stays `receiving`).
 */

import { readFileSync, existsSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Page, Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence } from './support/evidence';

/* ---------------------------------------------------------------- constants (each cites its source) */

const DESKTOP = { width: 1440, height: 900 } as const;
const FLOOR_HEIGHT_MM = 3_000;
const REFRESH_API = '/api/auth/refresh';
const PROJECTS_API = '/api/projects';

const PROCESSING = {
  emptyTitle: 'Chưa có bước nào để theo dõi', // PR:80
  background: 'Để chạy nền và thông báo cho tôi', // PR:64
  cancel: 'Huỷ xử lý', // PR:65
  retry: 'Thử lại', // PR:72
  support: 'Liên hệ hỗ trợ', // PR:71
} as const;
const BACKGROUND_STARTED = 'Sẽ báo cho bạn khi xử lý xong'; // UPR:152

/* ---------------------------------------------------------------- small helpers */

type Json = Record<string, unknown>;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

const stringField = (value: unknown, key: string, what: string): string => {
  const field = asRecord(value, what)[key];
  if (typeof field !== 'string' || field === '') throw new Error(`${what}: no string "${key}"`);
  return field;
};

const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const pathOf = (page: Page): string => new URL(page.url()).pathname;

/* ---------------------------------------------------------------- admin context + API fixtures */

interface FloorRef {
  readonly id: string;
  readonly name: string;
}

interface ProjectRef {
  readonly id: string;
  readonly name: string;
  readonly floors: readonly FloorRef[];
}

interface Admin {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Access token of this context's own refresh — sent as Bearer by the fixture calls, never logged. */
  readonly token: string;
  /** Project ids this test owns; deleted when the context closes. */
  readonly cleanup: string[];
}

/** Refresh body: `accessToken`/`access_token`, optional `data` wrapper (src/lib/auth/refresh.ts:85-100). */
function readAccessToken(json: unknown): string {
  const body = asRecord(json, 'POST /api/auth/refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
  const token =
    typeof root.accessToken === 'string' ? root.accessToken : typeof root.access_token === 'string' ? root.access_token : '';
  if (token === '') throw new Error('POST /api/auth/refresh: no access token in the body');
  return token;
}

/** Own admin session (one `POST /api/auth/login` in this context, as `support/p03/P3.ts` `withFloorsAdmin`). */
async function openAdmin(browser: Browser): Promise<Admin> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
  try {
    const { email, password } = readAdminCredentials();
    const login = await context.request.post('/api/auth/login', {
      data: { email, password, rememberMe: false },
      headers: { Origin: readBaseUrl() },
    });
    expect(login.status(), 'setup: POST /api/auth/login (admin, own session)').toBe(204);
    const refreshed = await context.request.post(REFRESH_API, { headers: { Origin: readBaseUrl() } });
    expect(refreshed.status(), 'POST /api/auth/refresh (fixture token)').toBe(200);
    const token = readAccessToken(await refreshed.json());
    const page = await context.newPage();
    return { context, page, token, cleanup: [] };
  } catch (error) {
    await context.close();
    throw error;
  }
}

const bearer = (admin: Admin): Record<string, string> => ({
  Origin: readBaseUrl(),
  Authorization: `Bearer ${admin.token}`,
});

async function withAdmin(browser: Browser, body: (admin: Admin) => Promise<void>): Promise<void> {
  const admin = await openAdmin(browser);
  try {
    await body(admin);
  } finally {
    for (const id of admin.cleanup) {
      await admin.context.request.delete(`${PROJECTS_API}/${id}`, { headers: bearer(admin) }).catch(() => undefined);
    }
    await admin.context.close().catch(() => undefined);
  }
}

const floorName = (index: number): string => `Tầng ${String(index + 1)}`;

/**
 * Fixture project through the real API (BE:apps/api/projects/router.py:54-63; `name` 3–80 chars, schemas.py:25-28;
 * `floors` = `FloorDraftIn` drafts, schemas.py:56-66): `floorCount` stacked 3 m floors named "Tầng 1"… Floor ids are
 * read back from `GET /api/projects/:id`, never invented.
 */
async function createProject(
  admin: Admin,
  slug: string,
  floorCount = 0,
): Promise<ProjectRef> {
  const name = `${TEST_DATA_PREFIX}e03-${slug}-${uniq()}`;
  expect(name.length, `fixture name "${name}" fits NAME_MAX 80`).toBeLessThanOrEqual(80);
  const floors = Array.from({ length: floorCount }, (_unused, index) => ({
    name: floorName(index),
    order: index,
    elevationMm: index * FLOOR_HEIGHT_MM,
    heightMm: FLOOR_HEIGHT_MM,
  }));
  const created = await admin.context.request.post(PROJECTS_API, {
    headers: bearer(admin),
    data: { name, ...(floorCount > 0 ? { floors } : {}) },
  });
  expect(created.status(), `fixture POST ${PROJECTS_API} "${name}"`).toBe(201);
  const id = stringField(await created.json(), 'id', 'POST /api/projects');
  admin.cleanup.push(id);

  const read = await admin.context.request.get(`${PROJECTS_API}/${id}`, { headers: bearer(admin) });
  expect(read.status(), `fixture GET ${PROJECTS_API}/${id}`).toBe(200);
  const rawFloors = asRecord(await read.json(), 'GET /api/projects/:id').floors;
  const list = (Array.isArray(rawFloors) ? rawFloors : []).map((floor, index) => {
    const record = asRecord(floor, `floors[${String(index)}]`);
    return {
      id: stringField(record, 'id', `floors[${String(index)}]`),
      name: stringField(record, 'name', `floors[${String(index)}]`),
      order: typeof record.order === 'number' ? record.order : index,
    };
  });
  list.sort((first, second) => first.order - second.order);
  expect(list.map((floor) => floor.name), 'fixture floors as created').toEqual(floors.map((floor) => floor.name));
  return { id, name, floors: list.map(({ id: floorId, name: floorLabel }) => ({ id: floorId, name: floorLabel })) };
}

function firstFloor(project: ProjectRef): FloorRef {
  const floor = project.floors[0];
  if (floor === undefined) throw new Error(`${project.name}: no floor`);
  return floor;
}

function drawingPng(): string {
  const value = process.env.E2E_DRAWING_PNG?.trim();
  if (value === undefined || value === '' || !value.toLowerCase().endsWith('.png') || !existsSync(value)) {
    throw new Error('E2E_DRAWING_PNG is not an existing .png file (qa.config.json env.vars)');
  }
  return value;
}

/* ---------------------------------------------------------------- SCR-12 (P9 folds these, then this file goes) */

test.describe('E03 SCR-12 processing — gap rows (QA-03d)', () => {
  test('E03 · SCR-12 [P8] an upload still receiving → "Để chạy nền và thông báo cho tôi"; click → "Sẽ báo cho bạn khi xử lý xong"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'pbackground', 1);
      const floor = firstFloor(project);
      const png = readFileSync(drawingPng());
      // #5 init + #6 chunk 0 and NO #7: the upload stays `receiving`, which N7 lists (BE drawings/latest.py:67) — a run
      // that is not final (UPR:470-478), the only state the button is drawn for (UPR:844, PR:97-101).
      const init = await admin.context.request.post(`${PROJECTS_API}/${project.id}/floors/${floor.id}/drawings/uploads`, {
        headers: bearer(admin),
        data: { fileName: `${TEST_DATA_PREFIX}e03-receiving.png`, floorId: floor.id, mimeType: 'image/png', projectId: project.id, sizeBytes: png.length },
      });
      expect(init.status(), 'setup: upload init (#5)').toBe(200);
      const uploadId = stringField(await init.json(), 'id', 'init');
      const chunk = await admin.context.request.post(`${PROJECTS_API}/${project.id}/drawings/uploads/${uploadId}/chunks`, {
        headers: bearer(admin),
        data: { chunk: png.toString('base64'), chunkIndex: 0 },
      });
      expect(chunk.status(), 'setup: upload chunk 0 (#6)').toBe(200);

      await page.goto(ROUTES.project.pipeline(project.id));
      const background = page.getByRole('button', { name: PROCESSING.background, exact: true });
      await expect(background).toBeVisible();
      await expect(page.getByRole('button', { name: PROCESSING.cancel, exact: true })).toHaveCount(0); // cancel unsupported
      await background.click(); // UPR:880-926 runInBackground (supported) → notice
      await expect(page.getByText(BACKGROUND_STARTED, { exact: true }).first()).toBeVisible();
      await captureEvidence(page, 'E03_pipeline_background.png');
    });
  });

  test('E03 · SCR-12 [P13] [mocked response] N7 read 500 → alert "Thử lại" + technical code + "Liên hệ hỗ trợ" (→ /tai-khoan); retry reads', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'p500', 1);
      const latestPath = `/api/projects/${project.id}/drawings/uploads/latest`; // endpoints.ts:100-102
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', requestId: 'qa-e03-mock' }) });
      };
      const matcher = (url: URL): boolean => url.pathname === latestPath;
      await page.route(matcher, handler);
      await page.goto(ROUTES.project.pipeline(project.id));
      // PR:258-272: not a missing project → InlineAlert + "Thử lại", then the code and "Liên hệ hỗ trợ".
      const retry = page.getByRole('alert').getByRole('button', { name: PROCESSING.retry, exact: true });
      await expect(retry).toBeVisible({ timeout: 45_000 });
      const support = page.getByRole('button', { name: PROCESSING.support, exact: true });
      await expect(support).toBeVisible();
      await expect(page.locator('span.font-mono').first()).toHaveText(/\S+/u); // PR:265 technicalCode
      await captureEvidence(page, 'E03_pipeline_read_500.png');
      await attachJson('E03_pipeline_read_500.json', { technicalCode: await page.locator('span.font-mono').first().innerText() });
      await page.unroute(matcher, handler);
      await retry.click();
      await expect(page.getByText(PROCESSING.emptyTitle, { exact: true })).toBeVisible();

      await page.route(matcher, handler);
      await page.reload();
      await expect(support).toBeVisible({ timeout: 45_000 });
      await support.click(); // UPR:831-840 → ROUTES.account
      await expect.poll(() => pathOf(page)).toBe(ROUTES.account);
      await page.unroute(matcher, handler);
    });
  });
});
