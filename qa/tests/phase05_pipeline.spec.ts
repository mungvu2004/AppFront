/**
 * Phase 5 — MAIN chain (serial smoke), SCR-23 Pascal `/projects/:p/3d` after F-15 (QA-05c `flows-C1.md` "Main chain").
 * Replaces `phase05_3d_viewer.spec.ts` (that file is deleted at S4; it produced and consumed no checkpoint — "Needs only CP-0").
 * Two wrappers rewritten for Pascal, serial on ONE shared Q2-like project:
 *   FL-M-23-01 open /3d: mount, render, pixels, CSP  (folds M L854 "SCR-26 load" + the foldable half of M L411 "SCR-23 load")
 *   FL-M-23-02 Pascal edit → PUT layer → reload keeps it  (M L561 contract: PUT 200 + `baseVersion` + layer array; new UI path
 *              = room rename in Pascal's "Diện tích phòng", RA:56)
 * The SCR-25 / SCR-27 blocks of the old main belong to their owners (flows-C4 / flows-C5); nothing here reads CP-2…CP-6.
 *
 * Data: `beforeAll` creates `qa-<runId>-m05-…` with floors "Tầng 1" + "Tầng 2", both written through #35 with
 * `layerSeed.qcLayer` (walls, a door + a window, rooms "Bếp" / "PHONG NGU 2", a table); `afterAll` deletes it.
 * No mock: every response is the real stack.
 *
 * Budget per worker: `POST /api/auth/login` 2 (admin API `signedInApi`, the browser session); `POST /api/projects` 1, #35 PUT 2
 * (seed) + 1 (the rename), `DELETE /api/projects/:id` 1; `POST /api/auth/refresh` ≈ 1 per page load (3 loads).
 */
import { expect, test, type APIRequestContext, type Page, type Request, type Response } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { loadDracoDecoder, watchCsp, type CspViolation } from '../../e2e/fullstack/csp';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { createQcProject, type LayerApi, type SeededFloor } from './support/layerSeed';
import {
  DEBOUNCE_WINDOW_MS,
  PASCAL_BUNDLE_PATH,
  SAVED_AT,
  SAVE_TIMEOUT_MS,
  T,
  adminWho,
  canvasBox,
  cleanupProjects,
  closeSession,
  expectCanvasNotBlank,
  openPascal,
  openRoomPanel,
  openSession,
  pastDeadline,
  projectPath,
  renameRoom,
  roomRow,
  saveLine,
  spatialPath,
  waitRendered,
  type Session,
} from './support/p05/P2';

test.describe.configure({ mode: 'serial' });

type Json = Record<string, unknown>;

/** `v` = 8 hex of the bundle's sha256 (UPV:51-73, B-V10-41). */
const MOUNT_URL = /\/assets\/pascal\/pascal-mount\.js\?v=[0-9a-f]{8}$/u;
const RENAMED = 'Bếp chính';

let admin: APIRequestContext;
let api: LayerApi;
let floors: SeededFloor[] = [];
let session: Session | undefined;
let csp: CspViolation[] = [];
/** Every request of the page (url + method), for the same-origin and PUT counts. */
const requests: { url: string; method: string; body: string | null }[] = [];
/** N15 document of the latest open (for the floor revisions). */
let n15: Json | null = null;

const projectId = (): string => {
  const id = floors[0]?.projectId;
  if (id === undefined) throw new Error('setup: no seeded project');
  return id;
};
const page = (): Page => {
  if (session === undefined) throw new Error('setup: no browser session');
  return session.page;
};

test.beforeAll(async ({ browser }) => {
  const { email, password } = readAdminCredentials();
  admin = await signedInApi(email, password);
  api = { request: admin, headers: {} };
  floors = await createQcProject(api, 'm05', ['Tầng 1', 'Tầng 2'], 2);
  session = await openSession(browser, adminWho(), {
    onContext: async (context) => {
      csp = await watchCsp(context);
    },
  });
  session.page.on('request', (r: Request) => requests.push({ url: r.url(), method: r.method(), body: r.postData() }));
});

test.afterAll(async () => {
  try {
    if (floors[0] !== undefined) await cleanupProjects(api, [floors[0].projectId]);
  } finally {
    await closeSession(session);
    await admin?.dispose();
  }
});

/** Opens /3d and returns the #24, N15 and bundle responses of that load (N15 body kept in `n15`). */
async function openWithResponses(): Promise<{ project: Response; spatial: Response; mount: Response }> {
  const p = page();
  const pid = projectId();
  const isGet = (r: Response, path: string): boolean => r.request().method() === 'GET' && new URL(r.url()).pathname === path;
  const project = p.waitForResponse((r) => isGet(r, projectPath(pid)));
  const spatial = p.waitForResponse((r) => isGet(r, spatialPath(pid)));
  const mount = p.waitForResponse((r) => new URL(r.url()).pathname === PASCAL_BUNDLE_PATH);
  await openPascal(p, pid, { wait: false });
  const out = { project: await project, spatial: await spatial, mount: await mount };
  n15 = (await out.spatial.json()) as Json;
  return out;
}

test('SCR-23 · FL-M-23-01 · open /3d: mount, render, pixels, CSP', async () => {
  test.setTimeout(Math.max(120_000, 2 * 60_000));
  let loaded: { project: Response; spatial: Response; mount: Response } | undefined;
  const loadMark = requests.length;

  await test.step('[23-A-001] deep link /3d as admin member renders the editor', async () => {
    loaded = await openWithResponses();
    // PVT:121 success caption; PV:255-260 the box holds Pascal's one <canvas> (UPV:395-474).
    await waitRendered(page(), T.rendered);
    await expect(canvasBox(page()).locator('canvas')).toHaveCount(1);
    await captureEvidence(page(), 'M05_23-A-001_rendered.png');
  });

  await test.step('[23-G-001] #24 GET /api/projects/:p 200 on load', async () => {
    expect.soft(loaded?.project.status(), 'UPS:104-112 #24').toBe(200);
    await captureEvidence(page(), 'M05_23-G-001_project-200.png', { caption: `GET ${projectPath(projectId())} → ${String(loaded?.project.status())}` });
  });

  await test.step('[23-G-002] N15 GET /api/projects/:p/spatial 200 on load', async () => {
    expect.soft(loaded?.spatial.status(), 'UPS:114-123 N15').toBe(200);
    await captureEvidence(page(), 'M05_23-G-002_spatial-200.png', { caption: `GET ${spatialPath(projectId())} → ${String(loaded?.spatial.status())}` });
  });

  await test.step('[23-G-004] pascal-mount.js?v=<8 hex> 200, Cache-Control no-cache', async () => {
    const mount = loaded?.mount;
    expect.soft(mount?.url() ?? '', 'UPV:58-73 mountUrl(0)').toMatch(MOUNT_URL);
    expect.soft(mount?.status()).toBe(200);
    expect.soft(mount?.headers()['cache-control'] ?? '', 'bundle served no-cache').toContain('no-cache');
    await captureEvidence(page(), 'M05_23-G-004_mount-url.png', {
      caption: `${new URL(mount?.url() ?? 'http://x').pathname}${new URL(mount?.url() ?? 'http://x').search} → ${String(mount?.status())}, cache-control: ${mount?.headers()['cache-control'] ?? '-'}`,
    });
  });

  await test.step('[23-G-005] every Pascal request same-origin; 0 CSP violations; Draco decoder loads under CSP', async () => {
    const origin = new URL(readBaseUrl()).origin;
    const loads = requests.slice(loadMark).filter((r) => r.url.startsWith('http'));
    const foreign = loads.map((r) => new URL(r.url)).filter((u) => u.origin !== origin).map((u) => u.href);
    const pascal = loads.map((r) => new URL(r.url).pathname).filter((p) => p.startsWith('/assets/pascal/'));
    expect.soft(foreign, 'UPV:212-216, PM:200-222 — nothing leaves the origin').toEqual([]);
    expect.soft(pascal.length, 'sub-chunks load under /assets/pascal/').toBeGreaterThan(1);
    expect.soft(await loadDracoDecoder(page()), 'Draco wasm under worker-src blob: / script-src self (M L411)').toBe('ok');
    expect.soft(csp, 'securitypolicyviolation events').toEqual([]);
    await attachJson('M05_23-G-005_requests.json', { foreign, pascalRequests: pascal.length, csp });
    await captureEvidence(page(), 'M05_23-G-005_same-origin.png', {
      caption: `${String(loads.length)} requests, ${String(pascal.length)} under /assets/pascal/, ${String(foreign.length)} foreign, ${String(csp.length)} CSP violations`,
    });
  });

  await test.step('[23-B-033] rendered canvas is not blank (> 1 % non-background pixels)', async () => {
    const ratio = await expectCanvasNotBlank(page(), 0.01, true);
    await captureEvidence(page(), 'M05_23-B-033_pixels.png', { caption: `canvas non-background ratio ${ratio.toFixed(3)}` });
  });
});

test('SCR-23 · FL-M-23-02 · Pascal edit → PUT layer → reload keeps it', async () => {
  test.setTimeout(Math.max(120_000, 2 * 60_000));
  // Runs alone too (fresh worker after a failure): open the screen when the page is not on it.
  if (new URL(page().url()).pathname !== ROUTES.project.viewer(projectId()) || n15 === null) {
    await openWithResponses();
  }
  await waitRendered(page());
  let actionAt = 0;
  let putMark = 0;

  await test.step('[23-A-016] rename "Bếp" → "Bếp chính" in Pascal drives the save line to "Đã lưu lúc HH:MM"', async () => {
    // Log every text the save line shows (PV:279-283) — "Có thay đổi chờ đồng bộ" / "Đang lưu…" can be short-lived.
    await page().evaluate(() => {
      const log: string[] = [];
      (window as unknown as { __qaSaveLog: string[] }).__qaSaveLog = log;
      const read = (): string =>
        document.querySelector('section[aria-label="Mô hình 3D"] > div > div > p[role="status"][aria-live="polite"]')?.textContent ?? '';
      new MutationObserver(() => {
        const text = read();
        if (text !== '' && log.at(-1) !== text) log.push(text);
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    putMark = requests.length;
    actionAt = Date.now();
    await renameRoom(page(), 'Bếp', RENAMED);
    await expect(saveLine(page()), 'USI:53-71 save line after the real PUT').toHaveText(SAVED_AT, { timeout: SAVE_TIMEOUT_MS });
    const log = await page().evaluate(() => (window as unknown as { __qaSaveLog: string[] }).__qaSaveLog);
    const at = (text: string | RegExp): number => log.findIndex((l) => (typeof text === 'string' ? l === text : text.test(l)));
    expect.soft(at(T.dirty), `"${T.dirty}" shown before saving (log ${JSON.stringify(log)})`).toBeGreaterThan(-1);
    expect.soft(at(T.saving), `"${T.saving}" after "${T.dirty}"`).toBeGreaterThan(at(T.dirty));
    expect.soft(at(SAVED_AT), '"Đã lưu lúc …" last').toBeGreaterThan(at(T.saving));
    await captureEvidence(page(), 'M05_23-A-016_saved.png', { caption: `save line: ${log.join(' → ')}` });
  });

  await test.step('[23-A-017] exactly one PUT …/spatial/layer 200, baseVersion = N15 revision, layer.rooms has "Bếp chính"', async () => {
    await pastDeadline(actionAt, DEBOUNCE_WINDOW_MS, 'the rename');
    const puts = requests.slice(putMark).filter((r) => r.method === 'PUT' && /\/spatial\/layer$/u.test(new URL(r.url).pathname));
    expect.soft(puts.length, 'one PUT per settled edit (UPE:206-235)').toBe(1);
    const first = puts[0];
    const body = JSON.parse(first?.body ?? '{}') as Json;
    const floorId = /\/floors\/([^/]+)\/spatial\/layer$/u.exec(new URL(first?.url ?? 'http://x').pathname)?.[1];
    const revisions = (n15?.floorRevisions as { floorId: string; revision: number }[] | undefined) ?? [];
    const base = revisions.find((r) => r.floorId === floorId)?.revision;
    expect.soft(body.baseVersion, 'client.ts:1346-1353 baseVersion = the floor revision N15 gave').toBe(base);
    const rooms = (((body.body as Json | undefined)?.layer as Json | undefined)?.rooms as Json[] | undefined) ?? [];
    expect.soft(rooms.map((r) => r.name), 'the layer sent carries the new room name').toContain(RENAMED);
    await attachJson('M05_23-A-017_put.json', { puts: puts.length, floorId, baseVersion: body.baseVersion, n15Revision: base });
    await captureEvidence(page(), 'M05_23-A-017_one-put.png', {
      caption: `${String(puts.length)} PUT …/floors/${floorId ?? '?'}/spatial/layer, baseVersion ${String(body.baseVersion)} (N15 ${String(base)})`,
    });
  });

  await test.step('[23-A-018] reload keeps the change (N15 + Pascal panel)', async () => {
    const spatial = page().waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === spatialPath(projectId()));
    await page().reload();
    const doc = (await (await spatial).json()) as Json;
    const names = (((doc.graph as Json).rooms as Json[] | undefined) ?? []).map((r) => r.name);
    expect.soft(names, 'UPS:150-183 N15 returns the renamed room').toContain(RENAMED);
    await waitRendered(page());
    await openRoomPanel(page(), RENAMED);
    await expect.soft(roomRow(page(), RENAMED), `Pascal panel shows "${T.renameLabel(RENAMED)}"`).toBeVisible();
    await captureEvidence(page(), 'M05_23-A-018_reloaded.png', { caption: `N15 rooms: ${names.join(', ')}` });
  });
});

