/**
 * Phase 5 — SCR-23 Pascal viewer `/3d`, SCR-24 `/3d/exploded` redirect, SCR-26 `/3d/pascal` redirect: real sequential
 * flows (QA-05c P1; plan `flows-C1.md` "phase05_viewer_edge.spec.ts", 16 flows, 100 steps). One `test()` per flow, one
 * `test.step('[<row id>] …')` per catalog row in the plan's order. `H` rows hard `expect`, `S` rows `expect.soft`; each step
 * captures `E05_<row id>_<slug>.png`. ⚑ rows assert the CORRECT behaviour and stay red while the bug lives.
 * Helpers and copy: `support/p05/viewer.ts` (owned by this pack).
 *
 * Source @ d50bb248 (catalog-C1 short names): PV/PVC/UPV/PVT src/screens/viewer/PascalViewer/ · PSG ProjectSpatialGate.tsx ·
 * CL CollaborationLayer.tsx · VR src/routes/viewerRedirects.tsx · V vendor/pascal/packages (RA/RAP room area, FC furniture
 * clash, MC measurement control, UK editor hooks/use-keyboard.ts, CH contextualHelp.ts).
 *
 * Data: every project is own and run-unique (`qa-<runId>-<slug>-<uniq>`, layerSeed `createQcProject` / phase03Seed
 * `createProject`), deleted in `finally` by the admin API. Pool users of slots `p05-viewer` (viewer), `p05-viewer-dem`
 * (engineer, demoted to viewer in FL-23-13 and restored in `finally`), `p05-viewer-a2` (admin, never a member). Safe beside
 * other files under `--workers 4`. Mocks: none (mocked pairs live in `phase05_viewer_mocked_edge.spec.ts`, pack P2).
 *
 * Edit vehicle (flows-C1 "Edit vehicle"): rename in Pascal's "Diện tích phòng" panel (double-click the name, input
 * "Đổi tên phòng <tên>", Enter). Room selection uses that panel's row (RAP:124-130 `setSelection`, the same selection state as a
 * canvas pick) instead of a canvas click — stabler, same oracle. Items are selected through "Va chạm đồ đạc" rows.
 *
 * Request budget per full file run (QA stack, `qa-limits.override.yml`):
 * - `POST /api/auth/login` (120 / 60 s per IP): 1 admin API + 1 browser per flow, + 1 per pool session (FL-23-12, -13,
 *   -14) ≈ 34, spread over ~14 min.
 * - `POST /api/users/invitations` (30 / 3600 s per admin): 0 when the pool file holds the three slots, else ≤ 3.
 * - `POST /api/projects`: 17, each deleted. `PUT …/spatial/layer`: ≈ 19 seed writes + ≈ 20 screen writes; no rate limit.
 * - `POST …/members`: 2. `PATCH /api/users/:id/role`: 2 (demote, restore). `POST …/property-templates`: 1.
 */
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

import { loginUrl, pathOf, ROUTES } from '../../e2e/fixtures/routes';
import { dismissTour } from '../../e2e/fixtures/tour';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { captureEvidence } from './support/evidence';
import { createQcProject, qcLayer, writeLayer } from './support/layerSeed';
import { addProjectMember, createProject, poolUser, type PoolUser } from './support/phase03Seed';
import {
  adminApi,
  blurAll,
  button,
  canvasBox,
  canvasOnlyPng,
  caption,
  clash3Layer,
  cleanupProjects,
  closeSession,
  createLayeredProject,
  ensureRoomPanel,
  expandInspector,
  frame,
  furnitureCountOf,
  furnitureOnlyLayer,
  GATE,
  historyTab,
  layerApi,
  levelModeOf,
  measureButton,
  MOUNT_PATH,
  nonBackgroundRatio,
  openPascal,
  openPascalPanel,
  openSession,
  PASCAL,
  PASCAL_RENDER_TIMEOUT_MS,
  pascalEditOnce,
  pascalRoot,
  pixelDiffRatio,
  PRESENCE,
  PV,
  renameRoom,
  roomButton,
  roomNamesOf,
  SAVE,
  SAVE_WINDOW_MS,
  saveLine,
  selectFirstClashItem,
  selectRoom,
  setGlobalRole,
  settleUntil,
  spaGo,
  startRename,
  summaryList,
  summaryOf,
  tabTo,
  TOAST,
  traceCaption,
  unknownProjectId,
  watchLayerPuts,
  watchMountRequests,
  type LayerPut,
  type Session,
  type SessionOptions,
} from './support/p05/viewer';

const softly = expect.configure({ soft: true });
/** `test.setTimeout(Math.max(120_000, 2 * estimate))` (brief). */
const budget = (estimateS: number): number => Math.max(120_000, 2 * estimateS * 1_000);

const Q1_SUMMARY = { Tầng: '1', Tường: '10', 'Ô mở': '2', Phòng: '2' }; // layerSeed qcLayer: 10 walls, door + window, 2 rooms
const DIRTY = 'Có thay đổi chờ đồng bộ'; // i18n/vi.json autosave.dirty (USI:59-60)
const PANEL_REGION = (page: Page) => page.getByRole('region', { name: PV.history, exact: true });
const collapsedHeading = (page: Page) => page.getByRole('heading', { name: PV.collapsedTitle, exact: true });
/** NotificationHost.tsx:21-24,49-58 joins "title — description" into ONE string (E1-T9): match the title as a prefix. */
const toast = (page: Page, text: string) => page.getByText(new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}( — |$)`, 'u'));

/* ---------------------------------------------------------------- flow scaffold */

interface Flow {
  readonly admin: APIRequestContext;
  /** Own a project id: deleted in `finally`. */
  own(id: string): void;
  /** Run in `finally` before the cleanup (role restore). */
  restore(fn: () => Promise<unknown>): void;
  open(who: 'admin' | 'anon' | PoolUser, options?: SessionOptions): Promise<Session>;
  /** Q1 seed: `createQcProject` (1 floor "Tầng 1", qcLayer). */
  q1(slug: string): Promise<{ readonly projectId: string; readonly floorId: string }>;
}

async function withFlow(browser: Browser, body: (f: Flow) => Promise<void>): Promise<void> {
  const admin = await adminApi();
  const owned: string[] = [];
  const restores: (() => Promise<unknown>)[] = [];
  const sessions: Session[] = [];
  const f: Flow = {
    admin,
    own: (id) => owned.push(id),
    restore: (fn) => restores.push(fn),
    open: async (who, options) => {
      const s = await openSession(browser, who, options);
      sessions.push(s);
      return s;
    },
    q1: async (slug) => {
      const [floor] = await createQcProject(layerApi(admin), slug);
      if (floor === undefined) throw new Error('setup: createQcProject returned no floor');
      owned.push(floor.projectId);
      return { projectId: floor.projectId, floorId: floor.floorId };
    },
  };
  try {
    await body(f);
  } finally {
    // Every restore runs even when one fails; the first failure is re-thrown after the cleanup (never swallowed).
    const restoreErrors: unknown[] = [];
    for (const fn of restores.reverse()) await fn().then(undefined, (error: unknown) => restoreErrors.push(error));
    for (const s of sessions) await closeSession(s);
    const failed = await cleanupProjects(admin, owned);
    if (failed.length > 0) test.info().annotations.push({ type: 'cleanup', description: failed.join('; ') });
    await admin.dispose();
    if (restoreErrors.length > 0) throw restoreErrors[0];
  }
}

/** Waits for the next PUT after `before` and its status. */
async function nextPut(puts: LayerPut[], before: number, what: string): Promise<LayerPut> {
  await expect.poll(() => puts.length, { timeout: 20_000, message: what }).toBeGreaterThan(before);
  const put = puts[before] as LayerPut;
  await expect.poll(() => put.status, { timeout: 20_000, message: `${what}: answer` }).not.toBeNull();
  return put;
}

const writesUnderProjects = (s: Session): string[] =>
  s.log.filter((e) => e.method !== 'GET' && e.path.startsWith('/api/projects/')).map((e) => `${e.method} ${e.path} ${String(e.status)}`);

/* ================================================================= SCR-23 */

test.describe('SCR-23 Pascal viewer — real flows', () => {
  test('SCR-23 · FL-23-01 · open, header, summary, no exit, no writes, presence overlay', async ({ browser }) => {
    test.setTimeout(budget(45));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-23-01');
      const s = await f.open('admin');
      const { page } = s;
      await openPascal(page, ROUTES.project.viewer(q1.projectId));
      const renderedAt = Date.now();

      await test.step('[23-A-002] header: region "Mô hình 3D" with h2 "Mô hình 3D"', async () => {
        // PV:49-54 Frame wraps every branch.
        await expect(frame(page)).toBeVisible();
        await expect(frame(page).getByRole('heading', { level: 2, name: PV.title, exact: true })).toBeVisible();
        await captureEvidence(page, 'E05_23-A-002_header.png');
      });

      await test.step('[23-B-003] success caption visible (not sr-only): "Đã dựng xong toàn bộ bản vẽ."', async () => {
        await expect.soft(caption(page)).toHaveText(PV.success);
        await expect.soft(caption(page)).not.toHaveClass(/\bsr-only\b/u); // PV:61 showCaption → text-sm
        await expect.soft(caption(page)).toBeVisible();
        await captureEvidence(page, 'E05_23-B-003_success-caption.png');
      });

      await test.step('[23-B-004] summary: Tầng 1 · Tường 10 · Ô mở 2 · Phòng 2', async () => {
        expect.soft(await summaryOf(page)).toEqual(Q1_SUMMARY); // UPV:573-581, PV:285-304
        await captureEvidence(page, 'E05_23-B-004_summary.png');
      });

      await test.step('[23-A-003] no "Về màn xem 3D" button', async () => {
        await expect.soft(button(page, PV.oldLeave)).toHaveCount(0); // the only exit is PASCAL_LEAVE_LABEL (PVT:153)
        await captureEvidence(page, 'E05_23-A-003_no-leave-button.png');
      });

      await test.step('[23-A-015] group "Bảng phụ" holds only "Lịch sử thao tác"', async () => {
        const rail = page.getByRole('group', { name: PV.rail, exact: true });
        await expect.soft(rail.getByRole('button')).toHaveCount(1); // PVC:281-295, no extraPanels
        await expect.soft(button(rail, PV.history)).toBeVisible();
        await expect.soft(button(rail, PV.rooms)).toHaveCount(0);
        await expect.soft(button(rail, PV.furniture)).toHaveCount(0);
        await captureEvidence(page, 'E05_23-A-015_one-side-tab.png');
      });

      await test.step('[23-A-004] ⚑ a way back to the project / dashboard exists (BUG-487)', async () => {
        // PVT:151-155 "để rỗng/lỗi/cờ tắt không thành ngõ cụt"; FA round 2: PV:55-59 header button PASCAL_LEAVE_LABEL
        // "Về quản lý tầng" → ROUTES.project.floors (PVC:413). Frame header only (outside `.pascal-root`).
        const header = frame(page).locator(':scope > div').first();
        await expect.soft(button(header, PV.leave), 'a way out of /3d in the frame header').toBeVisible();
        await expect.soft(button(header, PV.leave)).toBeEnabled();
        await captureEvidence(page, 'E05_23-A-004_way-out.png');
      });

      await test.step('[23-G-003] N21 rule-config fetched exactly once after hydration', async () => {
        const ruleConfig = (): number => s.log.filter((e) => e.method === 'GET' && e.path === `/api/projects/${q1.projectId}/rule-config`).length;
        await softly.poll(ruleConfig, { timeout: 10_000 }).toBeGreaterThan(0); // UPS:68-83, 174-177
        expect.soft(ruleConfig()).toBe(1);
        await captureEvidence(page, 'E05_23-G-003_rule-config-once.png');
      });

      await test.step('[23-G-010] plain viewing sends no PUT/POST/DELETE under /api/projects/', async () => {
        await settleUntil(page, renderedAt); // UAV:420 mount "saved" sends nothing; past the save window
        expect.soft(writesUnderProjects(s)).toEqual([]);
        await captureEvidence(page, 'E05_23-G-010_no-writes.png');
      });

      await test.step('[23-B-024] save line hidden before the first edit', async () => {
        await expect.soft(saveLine(page)).toHaveCount(0); // PVC:219-220, UAS:160-170 (saved without lastSavedAt → null)
        await captureEvidence(page, 'E05_23-B-024_no-save-line.png');
      });

      await test.step('[23-E-001] exactly one main landmark', async () => {
        await expect.soft(page.getByRole('main')).toHaveCount(1); // RT:358-382
        await captureEvidence(page, 'E05_23-E-001_one-main.png');
      });

      await test.step('[23-E-003] ⚑ canvas box has an announced role + name "Khung dựng mô hình 3D"', async () => {
        // PV:255-260 puts aria-label on a role-less div (ignored by most AT); expected a role that carries the name.
        const named = page
          .getByRole('region', { name: PV.canvasName, exact: true })
          .or(page.getByRole('img', { name: PV.canvasName, exact: true }))
          .or(page.getByRole('application', { name: PV.canvasName, exact: true }));
        await expect.soft(named.first()).toBeVisible();
        await captureEvidence(page, 'E05_23-E-003_canvas-name.png');
      });

      await test.step('[23-E-016] presence toggle "Ai đang xem" collapsed; captions "Đang làm việc riêng", "Chỉ mình bạn đang xem"', async () => {
        const toggle = button(page, PRESENCE.toggle);
        await expect.soft(toggle).toHaveAttribute('aria-expanded', 'false'); // CL:328-331
        const captions = page.getByRole('status').filter({ hasText: PRESENCE.alone });
        await expect.soft(captions).toContainText(PRESENCE.private); // CL:100, UCL:176-183 presence off
        await expect.soft(captions).toContainText(PRESENCE.alone); // CL:89
        await captureEvidence(page, 'E05_23-E-016_presence.png');
      });

      await test.step('[23-E-017] roster open, Esc closes only the roster', async () => {
        await button(page, PRESENCE.toggle).click();
        const roster = page.getByRole('list', { name: PRESENCE.roster, exact: true });
        await expect.soft(roster).toBeVisible();
        await blurAll(page);
        await page.keyboard.press('Escape'); // CL:250-261 sidePanel scope beats the canvas collapse
        await expect.soft(roster).toHaveCount(0);
        await expect.soft(canvasBox(page)).toBeVisible();
        await captureEvidence(page, 'E05_23-E-017_roster-esc.png');
      });

      await test.step('[23-B-034] model framed: model pixels ≥ 10 % of the canvas (BUG-482)', async () => {
        // PF:136-161 HeroCamera runs only in the Viewer branch; edit mode uses the Editor camera.
        let ratio = 0;
        await softly
          .poll(async () => (ratio = await nonBackgroundRatio(await canvasOnlyPng(page))), { timeout: 15_000 })
          .toBeGreaterThanOrEqual(0.1);
        await captureEvidence(page, 'E05_23-B-034_model-framed.png', { caption: `model pixels ${(ratio * 100).toFixed(1)} % of the canvas` });
      });
    });
  });

  test('SCR-23 · FL-23-02 · collapse / expand, keys E and R, mount once, help dialog', async ({ browser }) => {
    test.setTimeout(budget(60));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-23-02');
      const { page } = await f.open('admin');
      const mounts = watchMountRequests(page);
      await openPascal(page, ROUTES.project.viewer(q1.projectId));

      await test.step('[23-A-006] Esc collapses: "Khung xem đang thu gọn", its text, "Mở khung xem"', async () => {
        await blurAll(page);
        await page.keyboard.press('Escape'); // UPV:508-517
        await expect(collapsedHeading(page)).toBeVisible();
        await expect(frame(page)).toContainText(PV.collapsedText);
        await expect(button(page, PV.expand)).toBeVisible();
        await expect(caption(page)).toHaveText(PV.collapsedCaption);
        await captureEvidence(page, 'E05_23-A-006_collapsed.png');
      });

      await test.step('[23-A-009] collapse disposes the second root: no .pascal-root, no <canvas>', async () => {
        await expect.soft(pascalRoot(page)).toHaveCount(0); // PM:190-196
        await expect.soft(page.locator('canvas')).toHaveCount(0);
        await captureEvidence(page, 'E05_23-A-009_root-disposed.png');
      });

      const trail = await traceCaption(page);
      const mountsBeforeExpand = mounts.length;
      await test.step('[23-E-014] Tab reaches "Mở khung xem", Enter expands', async () => {
        const expand = button(page, PV.expand);
        await tabTo(page, expand);
        await expect.soft(expand).toBeFocused();
        await page.keyboard.press('Enter'); // PV:219-229
        await expect.soft(canvasBox(page)).toBeVisible();
        await captureEvidence(page, 'E05_23-E-014_tab-expand.png');
      });

      await test.step('[23-A-007] expand re-mounts (loading → success) without refetching the bundle', async () => {
        await expect.soft(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS });
        const seen = await trail();
        expect.soft(seen, 'caption passes "Đang nạp khung dựng hình…" before success').toContain(PV.loading);
        expect.soft(mounts.length, 'no second pascal-mount.js (UPV:491-494, 162)').toBe(mountsBeforeExpand);
        await expect.soft(pascalRoot(page)).toHaveCount(1);
        await captureEvidence(page, 'E05_23-A-007_remount-no-refetch.png');
      });

      await test.step('[23-A-008] Esc, then key E expands', async () => {
        await blurAll(page);
        await page.keyboard.press('Escape');
        await expect.soft(collapsedHeading(page)).toBeVisible();
        await page.keyboard.press('e'); // UPV:530-539 (enabled only while collapsed)
        await expect.soft(canvasBox(page)).toBeVisible();
        await expect.soft(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS });
        await captureEvidence(page, 'E05_23-A-008_key-e.png');
      });

      await test.step('[23-B-013] R outside the error state requests no new bundle', async () => {
        const before = mounts.length;
        await blurAll(page);
        const pressedAt = Date.now();
        await page.keyboard.press('r'); // UPV:519-528 enabled only on failure
        await settleUntil(page, pressedAt, 1_500);
        expect.soft(mounts.length).toBe(before);
        await expect.soft(caption(page)).toHaveText(PV.success);
        await captureEvidence(page, 'E05_23-B-013_r-no-retry.png');
      });

      await test.step('[23-G-007] zod jitless set before the bundle', async () => {
        const jitless = await page.evaluate(() => (window as unknown as { __zod_globalConfig?: { jitless?: boolean } }).__zod_globalConfig?.jitless);
        expect.soft(jitless).toBe(true); // UPV:212-216
        await captureEvidence(page, 'E05_23-G-007_zod-jitless.png');
      });

      await test.step('[23-E-009] "?" opens "Phím tắt"; Esc closes it first; next Esc collapses', async () => {
        await blurAll(page);
        await page.keyboard.press('?'); // UK:399-403
        const dialog = page.getByRole('dialog', { name: PASCAL.shortcutsDialog, exact: true });
        await expect.soft(dialog).toBeVisible();
        await captureEvidence(page, 'E05_23-E-009_shortcuts-dialog.png');
        await page.keyboard.press('Escape');
        await expect.soft(dialog).toHaveCount(0);
        await expect.soft(canvasBox(page), 'first Esc closes only the dialog').toBeVisible();
        await blurAll(page);
        await page.keyboard.press('Escape');
        await expect.soft(collapsedHeading(page)).toBeVisible();
      });
    });
  });

  test('SCR-23 · FL-23-03 · history side panel: click, Ctrl+H, Esc order', async ({ browser }) => {
    test.setTimeout(budget(40));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-23-03');
      const { page } = await f.open('admin');
      await openPascal(page, ROUTES.project.viewer(q1.projectId));

      await test.step('[23-A-010] tab "Lịch sử thao tác" opens its region ("Đang mở bảng…" until loaded)', async () => {
        await historyTab(page).click(); // PV:86-131, PVC:279-295
        await expect(historyTab(page)).toHaveAttribute('aria-expanded', 'true');
        await expect(PANEL_REGION(page)).toBeVisible();
        await expect(PANEL_REGION(page)).not.toContainText(PV.panelLoading, { timeout: 15_000 }); // lazy chunk resolved
        await captureEvidence(page, 'E05_23-A-010_history-open.png');
      });

      await test.step('[23-E-006] semantics: group "Bảng phụ", region named by the label', async () => {
        await expect.soft(page.getByRole('group', { name: PV.rail, exact: true })).toBeVisible(); // PV:99-128
        await expect.soft(PANEL_REGION(page)).toHaveCount(1);
        await captureEvidence(page, 'E05_23-E-006_panel-semantics.png');
      });

      await test.step('[23-A-011] clicking the open tab again closes it', async () => {
        await historyTab(page).click(); // PV:105-110
        await expect.soft(historyTab(page)).toHaveAttribute('aria-expanded', 'false');
        await expect.soft(PANEL_REGION(page)).toHaveCount(0);
        await captureEvidence(page, 'E05_23-A-011_history-closed.png');
      });

      await test.step('[23-A-012] Ctrl+H toggles: open, closed, open', async () => {
        await blurAll(page);
        await page.keyboard.press('Control+h'); // PVC:314-320
        await expect.soft(PANEL_REGION(page)).toBeVisible();
        await page.keyboard.press('Control+h');
        await expect.soft(PANEL_REGION(page)).toHaveCount(0);
        await page.keyboard.press('Control+h');
        await expect.soft(PANEL_REGION(page)).toBeVisible();
        await captureEvidence(page, 'E05_23-A-012_ctrl-h.png');
      });

      await test.step('[23-A-013] Esc with the panel open closes only the panel', async () => {
        await blurAll(page);
        await page.keyboard.press('Escape'); // PVC:301-310 sidePanel scope before canvas
        await expect.soft(PANEL_REGION(page)).toHaveCount(0);
        await expect.soft(canvasBox(page)).toBeVisible();
        await captureEvidence(page, 'E05_23-A-013_esc-panel-only.png');
      });

      await test.step('[23-A-014] second Esc collapses the frame', async () => {
        await page.keyboard.press('Escape'); // UPV:508-517
        await expect.soft(collapsedHeading(page)).toBeVisible();
        await captureEvidence(page, 'E05_23-A-014_second-esc.png');
      });

      await test.step('[23-E-010] Ctrl+H is inert while typing in "Đổi tên phòng Bếp"', async () => {
        await button(page, PV.expand).click();
        await expect(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS });
        const input = await startRename(page, 'Bếp');
        await input.press('Control+h'); // SR:505 typing disables every binding but Escape
        await expect.soft(PANEL_REGION(page)).toHaveCount(0);
        await expect.soft(input).toBeFocused();
        await captureEvidence(page, 'E05_23-E-010_ctrl-h-typing.png');
      });
    });
  });

  test('SCR-23 · FL-23-04 · autosave timing, flush, announcer, undo / redo', async ({ browser }) => {
    test.setTimeout(budget(70));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-23-04');
      const { page } = await f.open('admin');
      const puts = watchLayerPuts(page);
      await openPascal(page, ROUTES.project.viewer(q1.projectId));

      await test.step('[23-D-001] admin: rename enabled, Pascal action menu visible', async () => {
        await ensureRoomPanel(page, 'Bếp');
        await expect(roomButton(page, 'Bếp')).toHaveAttribute('title', PASCAL.renameLabel('Bếp')); // RAP:415 not read-only
        await expect(measureButton(page).first()).toBeVisible(); // action menu (MC:74) hidden when read-only
        await captureEvidence(page, 'E05_23-D-001_admin-tools.png');
      });

      await test.step('[23-A-019] rename → first PUT not before the save window after Enter', async () => {
        const enterAt = await renameRoom(page, 'Bếp', 'Bếp A'); // time taken before the Enter press
        const put = await nextPut(puts, 0, 'PUT after the first rename');
        // 1 000 ms (use-auto-save.ts:7) + 800 ms (createAutosave.ts:83) are nominal timers, not a measured floor (run-051b
        // E1-T19: 1 594 ms); the debounce + a floor-saver share is the bound the source guarantees.
        expect.soft(put.at - enterAt, 'Pascal debounce + floor saver').toBeGreaterThanOrEqual(1_400);
        expect.soft(put.status).toBe(200);
        await captureEvidence(page, 'E05_23-A-019_save-timing.png', { caption: `t(PUT) − t(Enter) = ${String(put.at - enterAt)} ms` });
      });

      await test.step('[23-E-005] polite save line + announcer "Đã lưu lúc HH:MM"', async () => {
        await expect.soft(saveLine(page)).toHaveText(SAVE.saved, { timeout: 15_000 }); // PV:279-283
        await expect.soft(saveLine(page)).toHaveAttribute('aria-live', 'polite');
        const polite = page.locator('[aria-live="polite"]').filter({ hasText: /Đã lưu lúc \d{2}:\d{2}/u });
        await softly.poll(() => polite.count(), { message: 'save line + announcer (USI:108-135)' }).toBeGreaterThanOrEqual(2);
        await captureEvidence(page, 'E05_23-E-005_save-announced.png');
      });

      await test.step('[23-A-020] two renames inside 1 s → one PUT carrying the last name', async () => {
        const before = puts.length;
        const firstAt = await renameRoom(page, 'Bếp A', 'Bếp B');
        const lastAt = await renameRoom(page, 'Bếp B', 'Bếp C');
        // Plan premise "two renames inside 1 s": hard, so a slow machine fails the setup, not the oracle.
        expect(lastAt - firstAt, 'premise: both Enters inside the 1 s Pascal debounce').toBeLessThan(1_000);
        const put = await nextPut(puts, before, 'PUT after two quick renames');
        await settleUntil(page, Math.max(lastAt, put.at)); // a second PUT would leave inside this window
        expect.soft(puts.length - before, 'one PUT for both renames (UAV:317, UAS:403-430)').toBe(1);
        expect.soft(roomNamesOf(put)).toContain('Bếp C');
        await captureEvidence(page, 'E05_23-A-020_one-put.png');
      });

      await test.step('[23-A-021] Ctrl+S flushes: PUT within 800 ms once dirty', async () => {
        await expect(saveLine(page)).toHaveText(SAVE.saved, { timeout: 15_000 });
        const before = puts.length;
        await renameRoom(page, 'Bếp C', 'Bếp D');
        await expect.soft(saveLine(page)).toHaveText(DIRTY, { timeout: 5_000 }); // the store holds the Pascal commit
        await blurAll(page);
        const flushAt = Date.now();
        await page.keyboard.press('Control+s'); // RT:236-238 flushAutosaves
        const put = await nextPut(puts, before, 'PUT after Ctrl+S');
        // The flushed PUT leaves after Ctrl+S and clearly before the unflushed autosave (Enter + 1,8 s) would.
        expect.soft(put.at, 'PUT sent after Ctrl+S').toBeGreaterThanOrEqual(flushAt);
        expect.soft(put.at - flushAt, 'flush, not the 800 ms floor-saver timer').toBeLessThan(800);
        await captureEvidence(page, 'E05_23-A-021_ctrl-s.png', { caption: `t(PUT) − t(Ctrl+S) = ${String(put.at - flushAt)} ms` });
      });

      await test.step('[23-G-011] no Pascal scene copy in localStorage', async () => {
        const stored = await page.evaluate(() => window.localStorage.getItem('pascal-editor-scene')); // V editor/src/lib/scene.ts:441
        expect.soft(stored).toBeNull();
        await captureEvidence(page, 'E05_23-G-011_no-local-scene.png');
      });

      await test.step('[23-A-022] ⚑ Ctrl+Z = one step: name back, ONE undo toast, PUT with the old name, no reload', async () => {
        await expect(saveLine(page)).toHaveText(SAVE.saved, { timeout: 15_000 });
        const trail = await traceCaption(page);
        const before = puts.length;
        await blurAll(page);
        await page.keyboard.press('Control+z'); // UK:493-496 + RT:222-224 both bound (catalog notes)
        await expect.soft(toast(page, TOAST.undo)).toHaveCount(1);
        await expect.soft(roomButton(page, 'Bếp C')).toBeVisible();
        const put = await nextPut(puts, before, 'PUT after Ctrl+Z');
        expect.soft(roomNamesOf(put)).toContain('Bếp C');
        await expect.soft(toast(page, TOAST.undo), 'still ONE toast after the PUT (no second undo, RT:222-224)').toHaveCount(1);
        expect.soft(await trail(), 'editor never reloaded (UPV:476-484)').not.toContain(PV.loading);
        await captureEvidence(page, 'E05_23-A-022_undo-one-step.png');
      });

      await test.step('[23-A-023] Ctrl+Shift+Z redoes: toast, PUT with the new name', async () => {
        await expect.soft(saveLine(page)).toHaveText(SAVE.saved, { timeout: 15_000 });
        const before = puts.length;
        await blurAll(page);
        await page.keyboard.press('Control+Shift+z'); // UK:489-492, PVT:257-260
        await expect.soft(toast(page, TOAST.redo).first()).toBeVisible();
        const put = await nextPut(puts, before, 'PUT after Ctrl+Shift+Z');
        expect.soft(roomNamesOf(put)).toContain('Bếp D');
        await captureEvidence(page, 'E05_23-A-023_redo.png');
      });
    });
  });

  test('SCR-23 · FL-23-05 · delete through the gate: admitted, mass delete, missing confirm, template button', async ({ browser }) => {
    test.setTimeout(budget(50));
    await withFlow(browser, async (f) => {
      const seeded = await createLayeredProject(f.admin, 'v-23-05', ['Tầng 1'], [clash3Layer]);
      f.own(seeded.projectId);
      const { page } = await f.open('admin');
      const puts = watchLayerPuts(page);
      await openPascal(page, ROUTES.project.viewer(seeded.projectId));
      const deleteButton = button(pascalRoot(page), PASCAL.delete).first();

      await test.step('[23-A-027] select table A ("Va chạm đồ đạc"), "Xoá" → one PUT, furniture 3 → 2', async () => {
        await selectFirstClashItem(page); // FC:31-33
        await deleteButton.click(); // controlsAndPanels.ts parametricInspector.delete
        const put = await nextPut(puts, 0, 'PUT after deleting 1 of 6');
        expect(put.status).toBe(200);
        expect(furnitureCountOf(put)).toBe(2); // 1/6 < MASS_DELETE_RATIO 0,2 (guard.ts:36)
        await captureEvidence(page, 'E05_23-A-027_delete-admitted.png');
      });

      await test.step('[23-A-025] table B "Xoá" (1 of 5) → rejection toast, table back, no PUT', async () => {
        const before = puts.length;
        await selectFirstClashItem(page);
        const at = Date.now();
        await deleteButton.click();
        await expect.soft(toast(page, TOAST.rejected).first()).toBeVisible(); // PVC PASCAL_REJECTED_TITLE
        await expect.soft(page.getByText('Thay đổi này xoá 1 trong 5 đối tượng của một tầng nên phải được xác nhận trước.', { exact: true }).first()).toBeVisible(); // GD:198-206
        await expect.soft(pascalRoot(page).getByRole('button', { name: PASCAL.selectItem }).first(), 'table back in the clash list').toBeVisible();
        await settleUntil(page, at);
        expect.soft(puts.length - before).toBe(0);
        await captureEvidence(page, 'E05_23-A-025_mass-delete-refused.png');
      });

      await test.step('[23-A-026] ⚑ mass delete asks for confirmation (dialog)', async () => {
        // GD:27-30 "màn hình bắt mã này rồi mở hộp thoại"; source relabels to PASCAL_UNKNOWN_NODE + toast (UPE:180).
        await expect.soft(page.getByRole('alertdialog').or(page.getByRole('dialog')).first()).toBeVisible();
        await captureEvidence(page, 'E05_23-A-026_no-confirm.png');
      });

      await test.step('[23-A-024] the rejection undo is silent: no "Đã hoàn tác thay đổi gần nhất"', async () => {
        await expect.soft(toast(page, TOAST.undo)).toHaveCount(0); // UAV:300 temporal.undo(), not runUndo
        await captureEvidence(page, 'E05_23-A-024_silent-undo.png');
      });

      await test.step('[23-A-029] ⚑ table selected → "Lưu làm khuôn mẫu" present', async () => {
        await selectFirstClashItem(page);
        await expandInspector(page);
        // TPL kinds tường / ô mở / nội thất / phòng; source: item custom panel has no button (V/nodes/src/item/parametrics.ts).
        await expect.soft(button(pascalRoot(page), PASCAL.saveTemplate)).toBeVisible();
        await captureEvidence(page, 'E05_23-A-029_no-template-for-item.png');
      });
    });
  });

  test('SCR-23 · FL-23-06 · room selection, template, vendor chrome a11y, wall height rule', async ({ browser }) => {
    test.setTimeout(budget(60));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-23-06');
      const { page } = await f.open('admin');
      const puts = watchLayerPuts(page);
      await openPascal(page, ROUTES.project.viewer(q1.projectId));

      await test.step('[23-A-028] room selected → "Lưu làm khuôn mẫu" → POST 201 + "Đã lưu khuôn mẫu "Khuôn phòng R-…" cho dự án này."', async () => {
        await selectRoom(page, 'Bếp'); // RAP:124-130 (same selection as a canvas pick)
        await expandInspector(page);
        const created = waitForApi(page, 'POST', new RegExp(`^/api/projects/${q1.projectId}/property-templates$`, 'u'), [201]);
        await button(pascalRoot(page), PASCAL.saveTemplate).click(); // PVC:245-256
        await created;
        await expect(page.getByText(/^Đã lưu khuôn mẫu \x22Khuôn phòng R-[^\x22]+\x22 cho dự án này\.$/u)).toBeVisible(); // TPL:29-33
        await captureEvidence(page, 'E05_23-A-028_room-template.png');
      });

      await test.step('[23-E-012] ⚑ inspector close button has an accessible name', async () => {
        // panel-wrapper.tsx:342-390 has no aria-label.
        // The inspector header is the row holding its h2 (panel-wrapper.tsx:309-342); onClose is its last button (:400-406).
        const header = pascalRoot(page).locator('div.justify-between').filter({ has: page.locator(':scope > div > h2') }).first();
        const close = header.locator(':scope > div:last-child > button').last();
        await expect(close).toBeVisible();
        await expect.soft(close).toHaveAccessibleName(/\S/u);
        await captureEvidence(page, 'E05_23-E-012_inspector-close-name.png');
      });

      await test.step('[23-E-011] ⚑ Pascal rail buttons are named ("Diện tích phòng")', async () => {
        await expect.soft(pascalRoot(page).getByRole('button', { name: PASCAL.roomPanel, exact: true })).toBeVisible(); // IR:58-79 tooltip only
        await captureEvidence(page, 'E05_23-E-011_rail-names.png');
      });

      await test.step('[23-E-013] ⚑ no English chrome ("Select", "Zone", "Delete", "Orbit Left", …)', async () => {
        const found: string[] = [];
        for (const label of PASCAL.englishChrome) {
          const hits = (await pascalRoot(page).getByText(label, { exact: true }).count()) + (await pascalRoot(page).getByRole('button', { name: label, exact: true }).count());
          if (hits > 0) found.push(label);
        }
        const openClose = pascalRoot(page).getByRole('button', { name: PASCAL.englishChromePattern });
        found.push(...(await openClose.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''))));
        expect.soft(found, 'control-modes.tsx:30-46, icon-rail.tsx:33,39, panel-wrapper.tsx:390').toEqual([]);
        await captureEvidence(page, 'E05_23-E-013_english-chrome.png', { caption: `English labels found: ${found.join(', ') || 'none'}` });
      });

      await test.step('[23-C-003] window wall lower than its window top → toast, value reverts, no PUT — UNKNOWN — NEED VERIFICATION (wall pick via Site tree, height field label)', async () => {
        // Wall 7 = window wall (toPascal wallNodeNameOf "Tường chịu lực 7"); Site panel tooltip "Site" (IR:29-33).
        // UNKNOWN — NEED VERIFICATION: the Site tree node text and the SliderControl input name "Chiều cao" (nodes/src/wall/panel.tsx:322).
        await openPascalPanel(page, 'Site');
        await pascalRoot(page).getByText('Tường chịu lực 7', { exact: true }).click();
        const height = pascalRoot(page).getByLabel('Chiều cao', { exact: true }).first();
        const before = puts.length;
        const at = Date.now();
        await height.fill('1,5');
        await height.press('Enter');
        await expect.soft(page.getByText(/^Tường cao .+, thấp hơn đỉnh ô mở cao nhất trên nó \(.+\)\. Hạ ô mở trước, hoặc giữ tường cao ít nhất .+\.$/u).first()).toBeVisible(); // FP:292
        await settleUntil(page, at);
        expect.soft(puts.length - before).toBe(0);
        await captureEvidence(page, 'E05_23-C-003_wall-height-rule.png');
      });
    });
  });

  test('SCR-23 · FL-23-07 · measurement tool, delete toast, Esc conflicts', async ({ browser }) => {
    test.setTimeout(budget(50));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-23-07');
      const { page } = await f.open('admin');
      const puts = watchLayerPuts(page);
      await openPascal(page, `${ROUTES.project.viewer(q1.projectId)}?tool=measure`);
      const clickGround = async (): Promise<void> => {
        const box = await canvasBox(page).boundingBox();
        if (box === null) throw new Error('pascal-canvas has no box');
        await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.75);
        await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.75);
        await page.keyboard.press('Enter'); // hint "Hoàn tất đo: Enter" — two points alone leave the measurement open (E1-T16)
      };

      await test.step('[23-A-030] /3d?tool=measure arms the tool; two ground clicks draw a label — UNKNOWN — NEED VERIFICATION (label DOM)', async () => {
        await expect(measureButton(page).first()).toHaveAttribute('aria-pressed', 'true'); // PVC:159-162, PF:191-201, MC:76
        await clickGround();
        // UNKNOWN — NEED VERIFICATION: the measurement label is a Pascal overlay; assumed text "<n>,<nn> m".
        await expect.soft(pascalRoot(page).getByText(/^\d+(,\d+)?\s?m$/u).first()).toBeVisible();
        await captureEvidence(page, 'E05_23-A-030_measure-tool.png');
      });

      await test.step('[23-A-031] delete the measurement → toast "Đã xoá phép đo 1" + "Hoàn tác" brings it back; no PUT — UNKNOWN — NEED VERIFICATION (selection of the new measurement)', async () => {
        const before = puts.length;
        const at = Date.now();
        await page.keyboard.press('Delete'); // UK:734 deleteSelection; assumes the new measurement is selected
        await expect.soft(toast(page, TOAST.measurementDeleted(1)).first()).toBeVisible(); // PVC:184-195
        await page.getByRole('button', { name: TOAST.undoAction, exact: true }).first().click();
        await expect.soft(pascalRoot(page).getByText(/^\d+(,\d+)?\s?m$/u).first()).toBeVisible();
        await settleUntil(page, at);
        expect.soft(puts.length - before, 'measurement nodes are ignored (FP:143)').toBe(0);
        await captureEvidence(page, 'E05_23-A-031_measure-delete-undo.png');
      });

      await test.step('[23-E-007] ⚑ M then Esc cancels the tool, editor stays mounted', async () => {
        await blurAll(page);
        await page.keyboard.press('m'); // UK:443-450
        await expect.soft(measureButton(page).first()).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.press('Escape'); // A12 one Esc = one layer; source also collapses (SR:563-578)
        await expect.soft(canvasBox(page)).toBeVisible();
        await expect.soft(pascalRoot(page)).toHaveCount(1);
        await expect.soft(measureButton(page).first()).toHaveAttribute('aria-pressed', 'false');
        await captureEvidence(page, 'E05_23-E-007_esc-tool.png');
      });

      await test.step('[23-E-008] ⚑ Esc inside "Đổi tên phòng Bếp" cancels the input only', async () => {
        if ((await button(page, PV.expand).count()) > 0) {
          // 23-E-007 collapsed the editor: re-open to reach this row's own start state.
          await button(page, PV.expand).click();
          await expect(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS });
        }
        const input = await startRename(page, 'Bếp');
        await input.press('Escape'); // RAP:396-399; source lets Escape through text fields (SR:505-508) → collapse
        await expect.soft(input).toHaveCount(0);
        await expect.soft(canvasBox(page)).toBeVisible();
        await expect.soft(collapsedHeading(page)).toHaveCount(0);
        await captureEvidence(page, 'E05_23-E-008_esc-input.png');
      });
    });
  });

  test('SCR-23 · FL-23-08 · grid snap chips (S20)', async ({ browser }) => {
    test.setTimeout(budget(40));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-23-08');
      const { page } = await f.open('admin');
      await openPascal(page, ROUTES.project.viewer(q1.projectId));
      const chip = (text: string) => pascalRoot(page).getByText(text, { exact: true });
      const armWall = async (): Promise<void> => {
        await blurAll(page);
        await page.keyboard.press('b'); // UK:456-461 wall tool
      };

      await test.step('[23-C-004] arm the wall tool → "Bắt điểm: Lưới", "Lưới: 0,50 m"', async () => {
        await armWall();
        await expect(chip(PASCAL.snapping('Lưới'))).toBeVisible(); // contextual-helper-panel.tsx:183-207
        await expect(chip(PASCAL.gridStep('0,50'))).toBeVisible();
        await captureEvidence(page, 'E05_23-C-004_snap-chips.png');
      });

      await test.step('[23-C-005] tap Ctrl ×4: 0,25 → 0,10 → 0,05 → 0,50 m', async () => {
        for (const step of ['0,25', '0,10', '0,05', '0,50']) {
          await page.keyboard.press('Control'); // UK:776-788 clean tap cycles the grid step
          await expect.soft(chip(PASCAL.gridStep(step))).toBeVisible();
        }
        await captureEvidence(page, 'E05_23-C-005_grid-step-cycle.png');
      });

      await test.step('[23-C-006] tap Shift ×4: Đường gióng → Góc → Tắt → Lưới', async () => {
        for (const mode of ['Đường gióng', 'Góc', 'Tắt', 'Lưới']) {
          await page.keyboard.press('Shift'); // UK:763-774
          await expect.soft(chip(PASCAL.snapping(mode))).toBeVisible();
        }
        await captureEvidence(page, 'E05_23-C-006_snap-mode-cycle.png');
      });

      await test.step('[23-C-007] grid step 0,25 m survives a reload', async () => {
        await page.keyboard.press('Control');
        await expect.soft(chip(PASCAL.gridStep('0,25'))).toBeVisible();
        await page.reload();
        await dismissTour(page);
        await expect(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS });
        await armWall();
        await expect.soft(chip(PASCAL.gridStep('0,25'))).toBeVisible(); // use-editor.tsx:592 persisted
        await captureEvidence(page, 'E05_23-C-007_grid-step-reload.png');
      });
    });
  });

  test('SCR-23 · FL-23-09 · offline, no-change, 409 from a second writer', async ({ browser }) => {
    test.setTimeout(budget(60));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-23-09');
      const s = await f.open('admin');
      const { page } = s;
      const puts = watchLayerPuts(page);
      await openPascal(page, ROUTES.project.viewer(q1.projectId));

      await test.step('[23-B-027] offline rename → "Ngoại tuyến — sẽ lưu khi có mạng"; online → PUT 200 + "Đã lưu lúc …"', async () => {
        await s.context.setOffline(true);
        await renameRoom(page, 'Bếp', 'Bếp X');
        await expect(saveLine(page)).toHaveText(SAVE.offline, { timeout: 15_000 }); // USI:66-67
        await captureEvidence(page, 'E05_23-B-027_offline.png');
        const before = puts.filter((p) => p.status === 200).length;
        await s.context.setOffline(false);
        await expect.poll(() => puts.filter((p) => p.status === 200).length, { timeout: 20_000 }).toBeGreaterThan(before);
        await expect(saveLine(page)).toHaveText(SAVE.saved, { timeout: 15_000 });
      });

      await test.step('[23-C-002] rename to the same name → no PUT, no toast', async () => {
        const before = puts.length;
        const at = await renameRoom(page, 'Bếp X', 'Bếp X'); // RAP:134 trimmed === previous → return; UPE:195-199
        await settleUntil(page, at);
        expect.soft(puts.length - before).toBe(0);
        await expect.soft(toast(page, TOAST.rejected)).toHaveCount(0);
        await captureEvidence(page, 'E05_23-C-002_same-name.png');
      });

      await test.step('[23-B-028] +W2 PUT elsewhere, then rename → "Tầng 1: Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất."', async () => {
        await writeLayer(layerApi(f.admin), q1.projectId, q1.floorId, qcLayer); // second writer at the current revision
        const before = puts.length;
        await renameRoom(page, 'Bếp X', 'Bếp Y');
        const put = await nextPut(puts, before, 'PUT after the second writer');
        expect.soft(put.status).toBe(409);
        await expect.soft(saveLine(page)).toHaveText(SAVE.conflict, { timeout: 15_000 }); // UAS:600-612, SLS:83
        await captureEvidence(page, 'E05_23-B-028_conflict.png');
      });

      await test.step('[23-B-029] ⚑ the 409 offers a way out: button "Tải lại"', async () => {
        // UAS:470-475 onReload/confirm exist; PVC:219-220 shows only saveBlock.message.
        await expect.soft(button(page, SAVE.reload)).toBeVisible();
        await captureEvidence(page, 'E05_23-B-029_no-reload-button.png');
      });
    });
  });

  test('SCR-23 · FL-23-10 · empty project', async ({ browser }) => {
    test.setTimeout(budget(25));
    await withFlow(browser, async (f) => {
      const p0 = await createProject(f.admin, 'v-23-10', 1);
      f.own(p0.projectId);
      const { page } = await f.open('admin');
      const mounts = watchMountRequests(page);
      await openPascal(page, ROUTES.project.viewer(p0.projectId), { rendered: false });

      await test.step('[23-B-008] empty state: "Chưa có gì để dựng" + text; no canvas, no pascal-mount.js', async () => {
        await expect(page.getByRole('heading', { name: PV.emptyTitle, exact: true })).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS }); // PV:159-171
        await expect(frame(page)).toContainText(PV.emptyText);
        await expect(canvasBox(page)).toHaveCount(0);
        expect(mounts, 'UPV:393 no canvas → no bundle').toEqual([]);
        await captureEvidence(page, 'E05_23-B-008_empty.png');
      });

      await test.step('[23-E-002] caption sr-only but role=status: "Bản vẽ chưa có đối tượng nào để dựng."', async () => {
        await expect.soft(caption(page)).toHaveText(PV.emptyCaption); // PV:33-36, 61
        await expect.soft(caption(page)).toHaveClass(/\bsr-only\b/u);
        await captureEvidence(page, 'E05_23-E-002_sr-caption.png');
      });

      await test.step('[23-B-005] no summary list in the empty state', async () => {
        await expect.soft(summaryList(page)).toHaveCount(0); // UPV:574
        await captureEvidence(page, 'E05_23-B-005_no-summary.png');
      });

      await test.step('[23-A-005] "Xử lý lại bản vẽ" → /projects/:p/pipeline', async () => {
        await button(page, PV.reprocess).click(); // PVC:401-403
        await softly.poll(() => new URL(page.url()).pathname).toBe(ROUTES.project.pipeline(p0.projectId));
        await captureEvidence(page, 'E05_23-A-005_reprocess.png');
      });
    });
  });

  test('SCR-23 · FL-23-11 · furniture-only graph, level count, project switch, bundle once', async ({ browser }) => {
    test.setTimeout(budget(60));
    await withFlow(browser, async (f) => {
      const furn = await createLayeredProject(f.admin, 'v-23-11-furn', ['Tầng 1', 'Tầng 2'], [furnitureOnlyLayer]);
      f.own(furn.projectId);
      const q1 = await f.q1('v-23-11');
      const { page } = await f.open('admin');
      const mounts = watchMountRequests(page);
      await openPascal(page, ROUTES.project.viewer(furn.projectId), { rendered: false });

      await test.step('[23-B-009] furniture-only graph renders: "Đã dựng xong toàn bộ bản vẽ."', async () => {
        await expect(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS }); // UPV:334-339
        await expect(page.getByRole('heading', { name: PV.emptyTitle, exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E05_23-B-009_furniture-only.png');
      });

      await test.step('[23-C-008] summary counts levels: Tầng 2 · Tường 0 · Ô mở 0 · Phòng 0', async () => {
        expect.soft(await summaryOf(page)).toEqual({ Tầng: '2', Tường: '0', 'Ô mở': '0', Phòng: '0' }); // UPV:576
        await captureEvidence(page, 'E05_23-C-008_level-count.png');
      });

      await test.step('[23-A-033] in-app switch to Q1 /3d → Q1 summary, room "Bếp", nothing of QX:furn', async () => {
        await spaGo(page, ROUTES.project.viewer(q1.projectId));
        await dismissTour(page);
        await expect.soft(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS });
        expect.soft(await summaryOf(page)).toEqual(Q1_SUMMARY); // UPV:465-470, PS:426-428
        await ensureRoomPanel(page, 'Bếp');
        await expect.soft(roomButton(page, 'Bếp')).toBeVisible();
        await captureEvidence(page, 'E05_23-A-033_project-switch.png');
      });

      await test.step('[23-G-006] pascal-mount.js fetched once across both projects', async () => {
        expect.soft(mounts, 'UPV:162, 198-201 module promise reused').toHaveLength(1);
        await captureEvidence(page, 'E05_23-G-006_bundle-once.png', { caption: `${MOUNT_PATH} requests: ${String(mounts.length)}` });
      });
    });
  });

  test('SCR-23 · FL-23-12 · viewer member read-only', async ({ browser }) => {
    test.setTimeout(budget(50));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-23-12');
      const viewer = await poolUser(f.admin, 'viewer', 'p05-viewer');
      await addProjectMember(f.admin, q1.projectId, viewer.email);
      const { page } = await f.open(viewer);
      const puts = watchLayerPuts(page);
      await openPascal(page, ROUTES.project.viewer(q1.projectId));

      await test.step('[23-D-003] read-only chrome: inspector notice on a selected room, no Pascal action menu', async () => {
        await selectRoom(page, 'Bếp');
        await expect(pascalRoot(page).getByText(PASCAL.inspectorReadOnly, { exact: true })).toBeVisible(); // VE:843-870
        await expect(measureButton(page)).toHaveCount(0); // action menu hidden when read-only
        await expect(caption(page)).toHaveText(PV.success);
        await captureEvidence(page, 'E05_23-D-003_read-only-chrome.png');
      });

      await test.step('[23-D-004] rename blocked: title "Vai chỉ xem không đổi được tên phòng", no PUT', async () => {
        await expect.soft(roomButton(page, 'Bếp')).toHaveAttribute('title', PASCAL.readOnlyRename); // RA:58, RAP:415
        const at = Date.now();
        await roomButton(page, 'Bếp').dblclick(); // RAP:411 readOnly → return
        await expect.soft(page.getByLabel(PASCAL.renameLabel('Bếp'), { exact: true })).toHaveCount(0);
        await settleUntil(page, at);
        expect.soft(puts).toHaveLength(0);
        await captureEvidence(page, 'E05_23-D-004_rename-blocked.png');
      });

      await test.step('[23-D-005] no "Lưu làm khuôn mẫu" on a selected room', async () => {
        await expect.soft(button(pascalRoot(page), PASCAL.saveTemplate)).toHaveCount(0); // PVC:265, PF:320
        await captureEvidence(page, 'E05_23-D-005_no-template.png');
      });

      await test.step('[23-D-006] Delete on the selection writes nothing; room still listed', async () => {
        await selectRoom(page, 'Bếp');
        const at = Date.now();
        await page.keyboard.press('Delete'); // use-scene.ts:1608 lease, UPE:191, 208
        await settleUntil(page, at);
        expect.soft(puts).toHaveLength(0);
        await expect.soft(roomButton(page, 'Bếp')).toBeVisible();
        await captureEvidence(page, 'E05_23-D-006_delete-noop.png');
      });

      await test.step('[23-D-007] viewer can measure: ?tool=measure arms the tool (#67)', async () => {
        // PF:191-192 "Vai chỉ xem vẫn đo được". The viewer has no action menu (no "Đo: …" button), but the tool is armed:
        // its hint box shows (run-051b E1-T17, nodes/src/i18n/vi.ts:682-683).
        await openPascal(page, `${ROUTES.project.viewer(q1.projectId)}?tool=measure`);
        await expect.soft(pascalRoot(page).getByText(PASCAL.measureHintPlace).first()).toBeVisible();
        await expect.soft(pascalRoot(page).getByText(PASCAL.measureHintFinish).first()).toBeVisible();
        const box = await canvasBox(page).boundingBox();
        if (box === null) throw new Error('pascal-canvas has no box');
        await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.75);
        await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.75);
        await page.keyboard.press('Enter'); // ends the measurement (E1-T16)
        // UNKNOWN — NEED VERIFICATION: measurement label DOM, same assumption as [23-A-030].
        await expect.soft(pascalRoot(page).getByText(/^\d+(,\d+)?\s?m$/u).first(), 'label after two ground clicks').toBeVisible();
        await captureEvidence(page, 'E05_23-D-007_viewer-measure.png');
      });

      await test.step('[23-D-008] ⚑ presence caption "Bạn đang xem, không sửa được"', async () => {
        // CL:93, 263-267; container passes no canWrite (PVC:333, UCL:378 default true).
        await expect.soft(page.getByRole('status').filter({ hasText: PRESENCE.readOnly })).toBeVisible();
        await captureEvidence(page, 'E05_23-D-008_presence-read-only.png');
      });
    });
  });

  test('SCR-23 · FL-23-13 · engineer saves, revision chain, echo, demotion', async ({ browser }) => {
    test.setTimeout(budget(60));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-23-13');
      const engineer = await poolUser(f.admin, 'engineer', 'p05-viewer-dem');
      await addProjectMember(f.admin, q1.projectId, engineer.email);
      f.restore(async () => {
        const status = await setGlobalRole(f.admin, engineer.id, 'engineer');
        if (status !== 200) throw new Error(`restore +DEM to engineer: PATCH role → ${String(status)}`);
      });
      const { page } = await f.open(engineer);
      const puts = watchLayerPuts(page);
      await openPascal(page, ROUTES.project.viewer(q1.projectId));
      const trail = await traceCaption(page);

      await test.step('[23-D-002] engineer member renames → PUT 200', async () => {
        const put = await pascalEditOnce(page, puts, 'Bếp', 'Bếp E1'); // permissions engineer layer.edit
        expect(put.status).toBe(200);
        await captureEvidence(page, 'E05_23-D-002_engineer-save.png');
      });

      await test.step('[23-G-008] second rename: baseVersion = the first answer revision', async () => {
        await expect.soft(saveLine(page)).toHaveText(SAVE.saved, { timeout: 15_000 });
        const first = puts[0];
        const second = await pascalEditOnce(page, puts, 'Bếp E1', 'Bếp E2');
        expect.soft(second.status).toBe(200);
        expect.soft(second.body.baseVersion, 'SLS onSaved, UAS:403-430').toBe(first?.response?.revision);
        await captureEvidence(page, 'E05_23-G-008_revision-chain.png');
      });

      await test.step('[23-C-001] own save is an echo: room stays selected, caption never loading', async () => {
        await expect.soft(saveLine(page)).toHaveText(SAVE.saved, { timeout: 15_000 });
        // RAP:367-372 the selected row carries `bg-accent`; the double-click that started the rename selected it.
        const row = roomButton(page, 'Bếp E2').locator('xpath=ancestor::div[contains(@class,"rounded-md")][1]');
        await expect.soft(row).toHaveClass(/(^|\s)bg-accent(\s|$)/u);
        expect.soft(await trail(), 'UPV:360-365, 420-428 echo → no setScene').not.toContain(PV.loading);
        await captureEvidence(page, 'E05_23-C-001_echo-kept.png');
      });

      await test.step('[23-D-010] demoted while open → PUT 403, "Tầng 1: Bạn không còn quyền sửa tầng này."', async () => {
        expect(await setGlobalRole(f.admin, engineer.id, 'viewer'), 'PATCH role → viewer').toBe(200);
        const before = puts.length;
        await renameRoom(page, 'Bếp E2', 'Bếp E3');
        // users/service.py:284-294 change_role bumps the token version: the first PUT may be 401 (by design), the FE refreshes
        // the session and the retried PUT is 403. Assert on the last answer that is not 401.
        const first = await nextPut(puts, before, 'PUT after the demotion');
        expect.soft([401, 403], 'first PUT after the demotion').toContain(first.status);
        await softly
          .poll(() => puts.slice(before).filter((p) => p.status !== null && p.status !== 401).map((p) => p.status), { timeout: 20_000 })
          .toContain(403);
        await expect.soft(saveLine(page)).toHaveText(SAVE.revoked, { timeout: 15_000 }); // SLS:81, 118-120
        await captureEvidence(page, 'E05_23-D-010_demoted.png');
      });
    });
  });

  test('SCR-23 · FL-23-14 · access: non-member, unknown id, anonymous (all three routes)', async ({ browser }) => {
    test.setTimeout(budget(35));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-23-14');
      const a2 = await poolUser(f.admin, 'admin', 'p05-viewer-a2');
      const outsider = await f.open(a2);
      const notFound = (page: Page) => page.getByRole('alert').filter({ hasText: GATE.notFoundTitle });

      await test.step('[23-D-009] non-member admin → "Không tìm thấy dự án này" (K08)', async () => {
        await outsider.page.goto(ROUTES.project.viewer(q1.projectId));
        await expect(notFound(outsider.page)).toBeVisible({ timeout: 30_000 }); // PSG:74-76, UPS:31-35
        await expect(canvasBox(outsider.page)).toHaveCount(0);
        await captureEvidence(outsider.page, 'E05_23-D-009_non-member.png');
      });

      const { page } = await f.open('admin');
      const unknown = unknownProjectId();
      await test.step('[23-B-018] unknown id /3d → alert + "Về danh sách dự án" → /', async () => {
        await page.goto(ROUTES.project.viewer(unknown));
        await expect.soft(notFound(page)).toBeVisible({ timeout: 30_000 });
        await expect.soft(notFound(page)).toContainText(GATE.notFoundText);
        await captureEvidence(page, 'E05_23-B-018_unknown-id.png');
        await button(notFound(page), GATE.back).click(); // PSG:57
        await softly.poll(() => new URL(page.url()).pathname).toBe(ROUTES.dashboard);
      });

      await test.step('[24-A-010] unknown id /3d/exploded → same 404', async () => {
        await page.goto(`${ROUTES.project.viewer(unknown)}/exploded`); // VR:27-35 then PSG
        await expect.soft(notFound(page)).toBeVisible({ timeout: 30_000 });
        await captureEvidence(page, 'E05_24-A-010_unknown-exploded.png');
      });

      await test.step('[26-A-006] unknown id /3d/pascal → same 404', async () => {
        await page.goto(ROUTES.project.viewerPascal(unknown)); // VR:14-24
        await expect.soft(notFound(page)).toBeVisible({ timeout: 30_000 });
        await captureEvidence(page, 'E05_26-A-006_unknown-pascal.png');
      });

      const anon = await f.open('anon');
      const nextOf = (p: Page): string | null => new URL(p.url()).searchParams.get('next');
      await test.step('[23-A-032] anonymous /3d → /login?next=…, "Hãy đăng nhập để tiếp tục."', async () => {
        const target = ROUTES.project.viewer(q1.projectId);
        await anon.page.goto(target);
        await softly.poll(() => pathOf(anon.page.url())).toBe(loginUrl(target)); // SessionBootstrap
        await expect.soft(anon.page.getByText(GATE.loginLead, { exact: true })).toBeVisible();
        await captureEvidence(anon.page, 'E05_23-A-032_anon-viewer.png');
      });

      await test.step('[24-A-011] anonymous /3d/exploded → /login?next=…', async () => {
        await anon.page.goto(`${ROUTES.project.viewer(q1.projectId)}/exploded`);
        await softly.poll(() => new URL(anon.page.url()).pathname).toBe(ROUTES.login);
        expect.soft(nextOf(anon.page) ?? '').toMatch(new RegExp(`^/projects/${q1.projectId}/3d`, 'u'));
        await captureEvidence(anon.page, 'E05_24-A-011_anon-exploded.png');
      });

      await test.step('[26-A-007] anonymous /3d/pascal → /login?next=…', async () => {
        await anon.page.goto(ROUTES.project.viewerPascal(q1.projectId));
        await softly.poll(() => new URL(anon.page.url()).pathname).toBe(ROUTES.login);
        expect.soft(nextOf(anon.page) ?? '').toMatch(new RegExp(`^/projects/${q1.projectId}/3d`, 'u'));
        await captureEvidence(anon.page, 'E05_26-A-007_anon-pascal.png');
      });
    });
  });
});

/* ================================================================= SCR-24 */

test.describe('SCR-24 exploded redirect — real flows', () => {
  test('SCR-24 · FL-24-01 · exploded redirect and level mode', async ({ browser }) => {
    test.setTimeout(budget(80));
    await withFlow(browser, async (f) => {
      const q2 = await createQcProject(layerApi(f.admin), 'v-24-01', ['Tầng 1', 'Tầng 2'], 2);
      const projectId = q2[0]?.projectId;
      if (projectId === undefined) throw new Error('setup: createQcProject (Q2) returned no floor');
      f.own(projectId);
      const { page } = await f.open('admin');
      const viewer = ROUTES.project.viewer(projectId);
      // Stacked reference before anything sets levelMode (it persists in localStorage, 24-A-006).
      await openPascal(page, viewer);
      const stacked = await canvasOnlyPng(page);
      await page.goto(ROUTES.dashboard);
      let exploded = stacked;

      await test.step('[24-A-001] /3d/exploded → URL /3d?view=exploded, rendered', async () => {
        await openPascal(page, `${viewer}/exploded`); // VR:27-35, RT:351
        expect(pathOf(page.url())).toBe(`${viewer}?view=exploded`);
        await expect(caption(page)).toHaveText(PV.success);
        await captureEvidence(page, 'E05_24-A-001_exploded-redirect.png');
      });

      await test.step('[24-A-002] Back returns to the page before, not /3d/exploded', async () => {
        await page.goBack(); // VR:31 replace
        await softly.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);
        await captureEvidence(page, 'E05_24-A-002_back.png');
        await page.goForward();
        await expect(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS });
      });

      await test.step('[24-A-004] exploded mode applied: levelMode "exploded", pixels differ from stacked', async () => {
        expect.soft(await levelModeOf(page)).toBe('exploded'); // PF:219-223, use-viewer.ts:570
        exploded = await canvasOnlyPng(page);
        const diff = await pixelDiffRatio(stacked, exploded);
        expect.soft(diff).toBeGreaterThan(0.01);
        await captureEvidence(page, 'E05_24-A-004_exploded-mode.png', { caption: `pixels differing from stacked: ${(diff * 100).toFixed(1)} %` });
      });

      await test.step('[24-A-005] same editor, same summary: Tầng 2', async () => {
        await expect.soft(caption(page)).toHaveText(PV.success);
        expect.soft((await summaryOf(page))['Tầng']).toBe('2'); // UPV:573-581
        await captureEvidence(page, 'E05_24-A-005_summary.png');
      });

      await test.step('[24-A-007] reload keeps ?view=exploded and the mode', async () => {
        await page.reload();
        await dismissTour(page);
        await expect.soft(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS });
        expect.soft(pathOf(page.url())).toBe(`${viewer}?view=exploded`); // PVC:167-168
        expect.soft(await levelModeOf(page)).toBe('exploded');
        await captureEvidence(page, 'E05_24-A-007_reload.png');
      });

      await test.step('[24-A-008] Esc + "Mở khung xem" keeps exploded', async () => {
        await blurAll(page);
        await page.keyboard.press('Escape');
        await button(page, PV.expand).click();
        await expect.soft(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS });
        expect.soft(await levelModeOf(page)).toBe('exploded'); // UPV:474
        await captureEvidence(page, 'E05_24-A-008_collapse-expand.png');
      });

      await test.step('[24-A-009] in-app navigation to /3d remounts: caption passes "Đang nạp khung dựng hình…"', async () => {
        const trail = await traceCaption(page);
        await spaGo(page, viewer); // UPV:474 explodeLevels in the mount deps
        await expect.soft(caption(page)).toHaveText(PV.success, { timeout: PASCAL_RENDER_TIMEOUT_MS });
        expect.soft(await trail()).toContain(PV.loading);
        await captureEvidence(page, 'E05_24-A-009_remount.png');
      });

      await test.step('[24-A-006] ⚑ after leaving exploded, /3d opens stacked', async () => {
        // PF:219-223 never resets levelMode; it persists in localStorage, so every later /3d opens exploded.
        expect.soft(await levelModeOf(page)).not.toBe('exploded');
        const now = await canvasOnlyPng(page);
        const toStacked = await pixelDiffRatio(stacked, now);
        const explodedGap = await pixelDiffRatio(stacked, exploded);
        expect.soft(toStacked, `closer to stacked than the exploded shot is (${(explodedGap * 100).toFixed(1)} %)`).toBeLessThan(explodedGap);
        await captureEvidence(page, 'E05_24-A-006_stacked-again.png');
      });

      await test.step('[24-A-013] ⚑ a visible level-mode control returns to stacked', async () => {
        // FA round 2: level-mode-action.tsx:20-38 "Chế độ tầng: Xếp tầng|Tách tầng" with aria-pressed (editors only).
        const stackedBtn = button(pascalRoot(page), PASCAL.levelMode('Xếp tầng'));
        const explodedBtn = button(pascalRoot(page), PASCAL.levelMode('Tách tầng'));
        await expect.soft(stackedBtn.or(explodedBtn).first(), 'a visible level-mode control').toBeVisible();
        if ((await explodedBtn.count()) === 0) {
          await stackedBtn.first().click(); // stacked → exploded
          await expect.soft(explodedBtn).toHaveAttribute('aria-pressed', 'true');
        }
        await explodedBtn.first().click(); // exploded → back to stacked
        await expect.soft(stackedBtn).toHaveAttribute('aria-pressed', 'false');
        expect.soft(await levelModeOf(page)).toBe('stacked');
        await captureEvidence(page, 'E05_24-A-013_level-control.png');
      });

      await test.step('[24-A-003] ⚑ /3d/exploded?tool=measure#x keeps query and hash', async () => {
        await page.goto(`${viewer}/exploded?tool=measure#x`); // VR:33 drops both (VR:14-22 keeps them for /3d/pascal)
        const parts = (): { path: string; hash: string; query: string[] } => {
          const url = new URL(page.url());
          return { path: url.pathname, hash: url.hash, query: [...url.searchParams.entries()].map(([k, val]) => `${k}=${val}`).sort() };
        };
        await softly.poll(parts).toEqual({ path: viewer, hash: '#x', query: ['tool=measure', 'view=exploded'] });
        await captureEvidence(page, 'E05_24-A-003_query-hash.png');
      });
    });
  });
});

/* ================================================================= SCR-26 */

test.describe('SCR-26 /3d/pascal redirect — real flows', () => {
  test('SCR-26 · FL-26-01 · /3d/pascal keeps query and hash', async ({ browser }) => {
    test.setTimeout(budget(50));
    await withFlow(browser, async (f) => {
      const q1 = await f.q1('v-26-01');
      const { page } = await f.open('admin');
      const viewer = ROUTES.project.viewer(q1.projectId);
      const pascal = ROUTES.project.viewerPascal(q1.projectId);
      await page.goto(ROUTES.dashboard);

      await test.step('[26-A-001] /3d/pascal → URL /3d, rendered', async () => {
        await openPascal(page, pascal); // VR:14-24
        expect(pathOf(page.url())).toBe(viewer);
        await expect(caption(page)).toHaveText(PV.success);
        await captureEvidence(page, 'E05_26-A-001_pascal-redirect.png');
      });

      await test.step('[26-A-004] Back does not return to /3d/pascal', async () => {
        await page.goBack(); // VR:20 replace
        await softly.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);
        await captureEvidence(page, 'E05_26-A-004_back.png');
      });

      await test.step('[26-A-003] /3d/pascal#ghim → /3d#ghim', async () => {
        await page.goto(`${pascal}#ghim`); // VR:21
        await softly.poll(() => pathOf(page.url())).toBe(`${viewer}#ghim`);
        await captureEvidence(page, 'E05_26-A-003_hash.png');
      });

      await test.step('[26-A-002] /3d/pascal?view=exploded → /3d?view=exploded, levelMode "exploded"', async () => {
        await openPascal(page, `${pascal}?view=exploded`);
        expect.soft(pathOf(page.url())).toBe(`${viewer}?view=exploded`);
        expect.soft(await levelModeOf(page)).toBe('exploded');
        await captureEvidence(page, 'E05_26-A-002_query.png');
      });

      await test.step('[24-A-012] single-floor project in exploded mode renders, no error', async () => {
        await expect.soft(caption(page)).toHaveText(PV.success); // PF:219-223
        await expect.soft(page.getByRole('heading', { name: PV.errorTitle, exact: true })).toHaveCount(0);
        expect.soft((await summaryOf(page))['Tầng']).toBe('1');
        await captureEvidence(page, 'E05_24-A-012_single-floor-exploded.png');
      });

      await test.step('[26-A-005] /3d/pascal?tool=measure → /3d?tool=measure, tool active', async () => {
        await openPascal(page, `${pascal}?tool=measure`);
        expect.soft(pathOf(page.url())).toBe(`${viewer}?tool=measure`);
        await expect.soft(measureButton(page).first()).toHaveAttribute('aria-pressed', 'true'); // PVC:159-162
        await captureEvidence(page, 'E05_26-A-005_measure-query.png');
      });
    });
  });
});
