/**
 * Phase 4 — SCR-20 "Duyệt tên phòng", EDGE layer, MOCKED RESPONSES: two sequential user flows (QA-04c P5, `flow-plan.md`
 * "phase04_rooms_mocked_edge.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row, in the
 * planned order. Every title carries `[mocked response]`: a 5xx, an aborted request or a 422 that only the server's own rules
 * could produce cannot be produced on the shared stack. What is real: the project, its floor layer (written through #35),
 * the session and every response the test does not replace.
 *
 * Mocks (`page.route`, all in this file):
 *   - N16 `GET …/floors/:f/spatial/layer`: held (a promise the test releases — never a timer), 500, aborted, or real;
 *   - #33 `GET …/floors/:f/spatial`: 500 or aborted;
 *   - #35 `PUT …/floors/:f/spatial/layer`: 422 (field `baseVersion`, `LAYER_INTEGRITY_BROKEN`, other), 503, 500 or aborted.
 * `page.clock` drives the debounce (800 ms) and the retry ladder (5 / 15 / 45 s) — no `waitForTimeout` anywhere.
 * Pairs: BE4-G-305/307 (pytest) and A4 reads (FL-A4-02) for M1; BE4-G-314, BE4-G-309 (pytest) and A4 versioning (FL-A4-04) for M2.
 *
 * Source (FE): FLR src/screens/qc/shared/floorLayerReadFailure.ts · RRV …/RoomLabelReview/RoomLabelReview.tsx ·
 * URR …/useRoomLabelReview.ts · UFL src/hooks/useFloorLayer.ts · AUS src/hooks/useAutosave.ts · SLS src/lib/autosave/spatialLayerSave.ts ·
 * RET src/lib/autosave/retrySchedule.ts (5 / 15 / 45 s) · HRT src/lib/http/retry.ts (client ladder 300 / 900 / 2700 ms) ·
 * FSB src/screens/qc/WallLayerReview/FloorLayerSaveBanner.tsx.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: 1 `signedInApi` per file worker + 1 per flow session (2).
 * - `POST /api/projects` 2, `DELETE` 2, `PUT …/spatial/layer` ≈ 6 real (seed + the second writer), the mocked ones never reach the BE.
 */
import type { APIRequestContext, Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import type { LayerApi } from './support/layerSeed';
import { fulfillError } from './support/p03/P2';
import { recordAnnouncements } from './support/p03/P5';
import {
  NAMES,
  ROOM,
  SAVED_AT,
  advance,
  canvasGroup,
  closeSession,
  codesOf,
  layerPath,
  layerPutsSince,
  layerRe,
  floorRe,
  nameField,
  openRooms,
  openSession,
  optionName,
  optionOf,
  rect,
  rooms1,
  rooms3,
  roomOptions,
  seedFloor,
  settle,
  selectRoom,
  uniq,
  waitForLayerPut,
  writeElsewhere,
  arrayOf,
  type Session,
} from './support/p04/P5';
import { createProject, deleteSeededProject } from './support/phase03Seed';

let admin: APIRequestContext;
let layerApi: LayerApi;

test.beforeAll(async () => {
  const { email, password } = readAdminCredentials();
  admin = await signedInApi(email, password);
  layerApi = { request: admin, headers: {} };
});

test.afterAll(async () => {
  await admin.dispose();
});

const creds = (): { email: string; password: string } => readAdminCredentials();
const SLOW_READ_MS = 60_000; // the client ladder (300 / 900 / 2700 ms) runs before a failed read shows

/* ---------------------------------------------------------------- the mocks */

type ReadMode = 'real' | 'hold' | 'e500' | 'abort';

interface ReadMock {
  mode: ReadMode;
  hits: number;
  /** Lets a held read through (and stops holding). */
  release: () => void;
}

/** Replaces GET answers of `match` according to `mode`; every other method falls through. */
async function mockRead(page: Page, match: (path: string) => boolean): Promise<ReadMock> {
  let open: () => void = () => undefined;
  let gate = new Promise<void>((resolve) => (open = resolve));
  const mock: ReadMock = {
    mode: 'real',
    hits: 0,
    release: () => {
      open();
      gate = Promise.resolve();
    },
  };
  await page.route(
    (url) => match(url.pathname),
    async (route: Route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      mock.hits += 1;
      if (mock.mode === 'hold') {
        await gate;
        return route.fallback();
      }
      if (mock.mode === 'e500') return fulfillError(route, 500, 'INTERNAL');
      if (mock.mode === 'abort') return route.abort('failed');
      return route.fallback();
    },
  );
  return mock;
}

type PutMode =
  | { readonly kind: 'real' }
  | { readonly kind: 'status'; readonly status: number; readonly code: string; readonly extra?: Record<string, unknown> }
  | { readonly kind: 'abort' };

interface PutMock {
  mode: PutMode;
  attempts: number;
}

async function mockPut(page: Page, projectId: string, floorId: string): Promise<PutMock> {
  const mock: PutMock = { mode: { kind: 'real' }, attempts: 0 };
  await page.route(
    (url) => url.pathname === layerPath(projectId, floorId),
    async (route: Route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      mock.attempts += 1;
      const mode = mock.mode;
      if (mode.kind === 'status') return fulfillError(route, mode.status, mode.code, mode.extra ?? {});
      if (mode.kind === 'abort') return route.abort('failed');
      return route.fallback();
    },
  );
  return mock;
}

async function cleanup(projectId: string | undefined, s: Session | undefined): Promise<void> {
  await closeSession(s);
  if (projectId !== undefined) {
    const failed = await deleteSeededProject(admin, projectId);
    if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
  }
}

/* ================================================================= FL-20-M1 */

test('SCR-20 · FL-20-M1 · [mocked response] first read and re-read failures, inline retry, background error', async ({ browser }) => {
  test.setTimeout(420_000);
  const seed = rooms3();
  const project = await createProject(admin, '20-m1', ['Tầng 1']);
  const floor = project.floors[0] as { id: string };
  let s: Session | undefined;
  try {
    await seedFloor(layerApi, project.projectId, floor.id, seed);
    const sess = await openSession(browser, creds());
    s = sess;
    const { page } = sess;
    const n16 = await mockRead(page, (path) => layerRe(project.projectId, floor.id).test(path));
    const n33 = await mockRead(page, (path) => floorRe(project.projectId, floor.id).test(path));
    const ids = [seed.rooms.unnamed as string, seed.rooms.ai as string, seed.rooms.reviewed as string];
    const codes = codesOf(ids);
    const url = `/projects/${project.projectId}/floors/${floor.id}/layers/rooms`;
    const failure = page.getByRole('alert');
    const retry = page.getByRole('button', { name: ROOM.retry, exact: true });
    const checkGaps = page.getByRole('button', { name: ROOM.checkGaps, exact: true });
    const listed = async (): Promise<void> => {
      await expect(roomOptions(page)).toHaveCount(3, { timeout: SLOW_READ_MS });
    };

    await test.step('[20-B-001] the first read still in flight: six skeleton rows in the left column', async () => {
      n16.mode = 'hold';
      await page.goto(url, { waitUntil: 'commit' });
      const region = page.getByRole('region', { name: ROOM.screen, exact: true });
      await expect(region).toBeVisible();
      await expect(region.locator('div.gap-4.p-3.w-full')).toHaveCount(6);
      await expect.soft(page.getByRole('listbox', { name: ROOM.list, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E04_20-B-001_skeleton.png');
      n16.release();
      n16.mode = 'real';
      await listed();
    });

    await test.step('[20-G-015] N16 500 on the first read: the whole screen shows "Có trục trặc" + the sentence + "Thử lại"', async () => {
      n16.mode = 'e500';
      await page.goto(url, { waitUntil: 'commit' });
      await expect(failure.getByText(ROOM.unknownTitle, { exact: true })).toBeVisible({ timeout: SLOW_READ_MS });
      await expect.soft(failure.getByText(ROOM.unknownText, { exact: true })).toBeVisible();
      await expect.soft(failure.getByRole('button', { name: ROOM.retry, exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-G-015_read-500.png');
    });

    await test.step('[20-G-016] N16 aborted on the first read: "Mất kết nối" + the sentence + "Thử lại"', async () => {
      n16.mode = 'abort';
      await page.goto(url, { waitUntil: 'commit' });
      await expect(failure.getByText(ROOM.networkTitle, { exact: true })).toBeVisible({ timeout: SLOW_READ_MS });
      await expect.soft(failure.getByText(ROOM.networkText, { exact: true })).toBeVisible();
      await expect.soft(failure.getByRole('button', { name: ROOM.retry, exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-G-016_read-abort.png');
    });

    await test.step('[20-G-017] "Thử lại" after a transient first-read failure recovers: the next read is real and the list shows', async () => {
      n16.mode = 'real';
      const before = n16.hits;
      await retry.click();
      await listed();
      expect.soft(n16.hits - before, 'one more read').toBeGreaterThanOrEqual(1);
      await captureEvidence(page, 'E04_20-G-017_retry-recovers.png');
    });

    await test.step('[20-G-018] the re-read fails after data: an inline alert, the list hidden, the canvas kept', async () => {
      n16.mode = 'e500';
      await checkGaps.click();
      const left = page.getByText(ROOM.readErrorTitle, { exact: true });
      await expect(left).toBeVisible({ timeout: SLOW_READ_MS });
      await expect.soft(page.getByText(ROOM.unknownText, { exact: true })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: ROOM.retry, exact: true })).toBeVisible();
      await expect.soft(page.getByRole('listbox', { name: ROOM.list, exact: true })).toHaveCount(0);
      await expect.soft(canvasGroup(page)).toBeVisible();
      await captureEvidence(page, 'E04_20-G-018_reread-error.png');
    });

    await test.step('[20-G-019] the inline "Thử lại" re-reads and restores the list', async () => {
      n16.mode = 'real';
      const before = n16.hits;
      await page.getByRole('button', { name: ROOM.retry, exact: true }).click();
      await listed();
      expect.soft(n16.hits - before, 'one more N16 read').toBeGreaterThanOrEqual(1);
      await expect.soft(page.getByText(ROOM.readErrorTitle, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E04_20-G-019_inline-retry.png');
    });

    await test.step('[20-G-020] #33 500 / network: no background, no error shown, the rooms are still listed', async () => {
      for (const mode of ['e500', 'abort'] as const) {
        n33.mode = mode;
        await page.goto(url, { waitUntil: 'commit' });
        await listed();
        await expect.soft(failure, `#33 ${mode}: no alert`).toHaveCount(0);
        await expect.soft(canvasGroup(page).locator('img'), `#33 ${mode}: no background`).toHaveCount(0);
        await expect.soft(optionOf(page, codes.get(ids[1] as string) as string)).toHaveAccessibleName(
          optionName(codes.get(ids[1] as string) as string, NAMES.ai, rect(0, 0, 4000, 4000), ROOM.statusSuggested),
        );
        await captureEvidence(page, `E04_20-G-020_background-${mode}.png`);
      }
    });
  } finally {
    await cleanup(project.projectId, s);
  }
});

/* ================================================================= FL-20-M2 */

test('SCR-20 · FL-20-M2 · [mocked response] save failures: reload read, 422 baseVersion / integrity / other, retry ladder', async ({ browser }) => {
  test.setTimeout(480_000);
  const seed = rooms1();
  const project = await createProject(admin, '20-m2', ['Tầng 1']);
  const floor = project.floors[0] as { id: string };
  const roomId = seed.rooms.one as string;
  const code = codesOf([roomId]).get(roomId) as string;
  let s: Session | undefined;
  try {
    await seedFloor(layerApi, project.projectId, floor.id, seed);
    const sess = await openSession(browser, creds());
    s = sess;
    const { page } = sess;
    const field = nameField(page);
    const announced = await recordAnnouncements(page);
    const putMock = await mockPut(page, project.projectId, floor.id);
    const n16 = await mockRead(page, (path) => layerRe(project.projectId, floor.id).test(path));
    const banner = (text: string) => page.getByRole('alert').filter({ hasText: text });
    const puts = (): number => layerPutsSince(sess, project.projectId, floor.id).length;
    await page.clock.install();

    /** Opens the screen fresh with the room selected and renames it to a new unique name. */
    const fresh = async (): Promise<string> => {
      await openRooms(page, project.projectId, floor.id);
      await selectRoom(page, code);
      const name = `qa m2 ${uniq()}`;
      await field.fill(name);
      await field.press('Enter');
      return name;
    };

    await test.step('[20-G-009] the reload read fails after a 409: the banner says "Không tải lại được tầng này. Thử lại sau."', async () => {
      await openRooms(page, project.projectId, floor.id);
      await selectRoom(page, code);
      await writeElsewhere(layerApi, project.projectId, floor.id, (layer) => ({ ...layer, rooms: arrayOf(layer.rooms, 'rooms').map((r) => ({ ...r, name: 'qa nơi khác' })) }));
      const conflict = waitForLayerPut(page, project.projectId, floor.id, undefined, [409]);
      await field.fill(`qa m2 ${uniq()}`);
      await field.press('Enter');
      await advance(page, 1_000);
      await conflict;
      await expect(banner(ROOM.conflict)).toBeVisible();
      await banner(ROOM.conflict).getByRole('button', { name: ROOM.reload, exact: true }).click();
      n16.mode = 'e500';
      await page.getByRole('dialog', { name: ROOM.confirmTitle, exact: true }).getByRole('button', { name: ROOM.confirmReload, exact: true }).click();
      await advance(page, 10_000); // the client ladder (300 / 900 / 2700 ms) before the read gives up
      await expect.soft(page.getByText(ROOM.reloadFailed, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-G-009_reload-failed.png');
      n16.mode = 'real';
    });

    await test.step('[20-G-010] PUT 422 on field baseVersion takes the same reload branch', async () => {
      putMock.mode = { kind: 'status', status: 422, code: 'VALIDATION', extra: { field: 'baseVersion' } };
      await fresh();
      await advance(page, 1_000);
      await expect.soft(banner(ROOM.conflict)).toBeVisible();
      await expect.soft(banner(ROOM.conflict).getByRole('button', { name: ROOM.reload, exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-G-010_422-base-version.png');
    });

    await test.step('[20-G-012] PUT 422 LAYER_INTEGRITY_BROKEN: "Tầng này có {n} chỗ hỏng liên kết hình học nên chưa lưu được."', async () => {
      putMock.mode = { kind: 'status', status: 422, code: 'LAYER_INTEGRITY_BROKEN', extra: { count: 3 } };
      await fresh();
      await advance(page, 1_000);
      await expect.soft(banner('Tầng này có 3 chỗ hỏng liên kết hình học nên chưa lưu được.')).toBeVisible();
      await captureEvidence(page, 'E04_20-G-012_integrity.png');
    });

    await test.step('[20-G-022] PUT 503 → temporary: it retries after 5, 15, 45 s, the failure is announced, a later success clears it', async () => {
      // SCR-20 draws no save indicator: `useSaveIndicator` feeds only the live region ("Lưu thất bại. …" / "Đã lưu lúc HH:MM").
      // The page clock is PAUSED here, so fake time moves only by the 500 ms steps below: the timeline is exact.
      await openRooms(page, project.projectId, floor.id);
      await selectRoom(page, code);
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      putMock.mode = { kind: 'status', status: 503, code: 'DEPENDENCY_UNAVAILABLE' };
      const start = putMock.attempts;
      let seen = start;
      let fake = 0;
      const stamps: number[] = [];
      const step = async (ms: number): Promise<void> => {
        await page.clock.runFor(ms);
        fake += ms;
        await settle(page);
        for (; seen < putMock.attempts; seen += 1) stamps.push(fake);
      };
      /** Attempts grouped in cycles: the client ladder (300 / 900 / 2700 ms) stays under 4 s, the engine's retry waits 5 s or more. */
      const cycles = (): number[][] => {
        const out: number[][] = [];
        for (const at of stamps) {
          const last = out[out.length - 1];
          if (last !== undefined && at - (last[last.length - 1] as number) < 4_000) last.push(at);
          else out.push([at]);
        }
        return out;
      };
      await field.fill(`qa m2 ${uniq()}`);
      await field.press('Enter');
      for (let i = 0; i < 400; i += 1) {
        await step(500);
        const lastAt = stamps[stamps.length - 1] ?? 0;
        if (cycles().length >= 4 && fake - lastAt >= 3_500) break; // the first try and the three scheduled retries
      }
      const c = cycles();
      const gaps = c.slice(1).map((cycle, i) => (cycle[0] as number) - ((c[i] as number[])[(c[i] as number[]).length - 1] as number));
      await attachJson('E04_20-G-022_timeline.json', { stampsMs: stamps, gapsMs: gaps });
      expect.soft(c.length, 'four cycles: the first try and the 5, 15 and 45 s retries').toBe(4);
      for (const [i, expected] of [5_000, 15_000, 45_000].entries()) {
        expect.soft(Math.abs((gaps[i] ?? -99_999) - expected), `retry ${String(i + 1)} comes ~${String(expected / 1000)} s after the failure (gaps ${gaps.join(', ')})`).toBeLessThanOrEqual(1_500);
      }
      expect.soft((await announced()).some((text) => /Lưu thất bại/u.test(text)), 'once the retries are spent the failure is announced ("Lưu thất bại")').toBe(true);
      // a later success clears it: the server is healthy again and the next edit saves
      putMock.mode = { kind: 'real' };
      const base = puts();
      await field.fill(`qa m2 ${uniq()}`);
      await field.press('Enter');
      for (let i = 0; i < 20 && puts() === base; i += 1) await step(500);
      await expect.poll(async () => (await announced()).some((text) => SAVED_AT.test(text.trim())), { message: '"Đã lưu lúc HH:MM" announced after the next edit' }).toBe(true);
      await page.clock.resume();
      await captureEvidence(page, 'E04_20-G-022_recovered.png');
      // A network abort is temporary too; a 500 is not retried — it blocks with the generic text (SLS classifyLayerSaveError:
      // only network / timeout / 408 / 429 / 502 / 503 / 504 are transient, which differs from the catalog's "500 / 503 / network").
      putMock.mode = { kind: 'abort' };
      const startAbort = putMock.attempts;
      await fresh();
      await advance(page, 1_000);
      await expect.poll(() => putMock.attempts - startAbort, { message: 'aborted PUT attempted' }).toBeGreaterThanOrEqual(1);
      await advance(page, 8_000);
      await expect.soft(page.getByRole('alert').filter({ hasText: ROOM.saveFailedGeneric }), 'an abort is not a block').toHaveCount(0);
      putMock.mode = { kind: 'real' };
      await advance(page, 6_000);
      await expect.soft(page.getByRole('alert').filter({ hasText: ROOM.saveFailedGeneric })).toHaveCount(0);
      putMock.mode = { kind: 'status', status: 500, code: 'INTERNAL' };
      await fresh();
      await advance(page, 1_000);
      await expect.soft(banner(ROOM.saveFailedGeneric)).toBeVisible();
      await captureEvidence(page, 'E04_20-G-022_abort-then-500.png');
    });

    await test.step('[20-G-023] PUT 422 with another field: the generic blocked text "Không lưu được thay đổi của tầng này."', async () => {
      putMock.mode = { kind: 'status', status: 422, code: 'VALIDATION', extra: { field: 'body' } };
      await fresh();
      await advance(page, 1_000);
      await expect.soft(banner(ROOM.saveFailedGeneric)).toBeVisible();
      await captureEvidence(page, 'E04_20-G-023_422-other.png');
    });
  } finally {
    await cleanup(project.projectId, s);
  }
});
