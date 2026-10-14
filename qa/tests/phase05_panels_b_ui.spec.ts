/**
 * Phase 5 — SCR-23H "Lịch sử thao tác" side panel of Pascal `/projects/:p/3d`, dedicated UI-verification flow (skill
 * `qa-verify-ui`; QA-05c `flows-C3.md` "phase05_panels-b_ui.spec.ts"; file named with `_b_` because `qa/playwright.config.ts`
 * `testMatch` does not take a hyphen). Every step = one state at 1440 / 1024 / 768 / 375 through `verifyUi`
 * (`U05_<row id>_<slug>_<width>.png` + `.json`); row numbers (chip height, panel box, listbox box, notice clipping) are measured
 * inside `open` per width and asserted after the four widths. ⚑ 23H-F-002: below 1024 the panel turns into a `fixed` sheet
 * (HPC:83,100-126, HPCH:101-105) that leaves the 344 px region empty and covers the canvas; at 375 rail + 344 px > viewport.
 *
 * Real stack only: Q1 (`layerSeed.createQcProject`), the pool viewer (`poolUser(admin, 'viewer', 'p05-p2')`) as a REAL member
 * in a second context. Budget: `POST /api/auth/login` 1 admin API + 2 sessions = 3; `POST /api/projects` 1, #35 PUT 1,
 * `POST …/members` 1, `DELETE` 1; invitation 0 (1 when the slot is empty); `POST /api/auth/refresh` ≈ 20 page loads.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { createQcProject, type LayerApi } from './support/layerSeed';
import {
  H,
  actorCombo,
  adminWho,
  chip,
  cleanupProjects,
  closeSession,
  historyPanel,
  historyRegion,
  historyTab,
  inViewport,
  openPascal,
  openSession,
  type Session,
} from './support/p05/P2';
import { addProjectMember, poolUser } from './support/phase03Seed';
import { verifyUi } from './support/ui-verify';

let admin: APIRequestContext;
let api: LayerApi;

test.beforeAll(async () => {
  const { email, password } = readAdminCredentials();
  admin = await signedInApi(email, password);
  api = { request: admin, headers: {} };
});

test.afterAll(async () => {
  await admin?.dispose();
});

const vw = (p: Page): number => p.viewportSize()?.width ?? 0;
const vh = (p: Page): number => p.viewportSize()?.height ?? 0;

test('SCR-23 · FL-23H-06 · bảng lịch sử ở 4 khổ', async ({ browser }) => {
  // 5 states × 4 widths, each a fresh /3d render (~10 s).
  test.setTimeout(Math.max(180_000, 2 * 200_000));
  const [floor] = await createQcProject(api, '23h-06');
  if (floor === undefined) throw new Error('setup: Q1 has no floor');
  const pid = floor.projectId;
  let s: Session | undefined;
  let v: Session | undefined;
  try {
    const viewer = await poolUser(admin, 'viewer', 'p05-p2');
    await addProjectMember(admin, pid, viewer.email);
    s = await openSession(browser, adminWho());
    v = await openSession(browser, viewer);
    const { page } = s;
    const viewerPage = v.page;
    const openPanel = async (p: Page): Promise<void> => {
      await openPascal(p, pid);
      await historyTab(p).click();
      await expect(historyPanel(p)).toBeVisible();
    };

    await test.step('[23H-F-001] panel closed, rail only: tab in the viewport, no horizontal scroll', async () => {
      const tabIn: Record<number, boolean> = {};
      const metrics = await verifyUi(page, 'U05_23H-F-001_rail', async (p) => {
        await openPascal(p, pid);
        await expect(historyTab(p)).toBeVisible();
        tabIn[vw(p)] = inViewport(await historyTab(p).boundingBox(), vw(p), vh(p));
      });
      for (const m of metrics) expect(m.openError, `${m.viewport}: rail state opened`).toBeUndefined();
      for (const [w, ok] of Object.entries(tabIn)) expect.soft(ok, `${w}: "Lịch sử thao tác" inside the viewport (PV:98-118)`).toBe(true);
    });

    await test.step('[23H-F-002] ⚑ panel open, empty: no horizontal scroll, no empty 344 px box, panel inside the viewport', async () => {
      const found: Record<number, { panelIn: boolean; panelInRegion: boolean }> = {};
      await verifyUi(page, 'U05_23H-F-002_panel-open', async (p) => {
        await openPanel(p);
        const panel = await historyPanel(p).boundingBox();
        const region = await historyRegion(p).boundingBox();
        found[vw(p)] = {
          panelIn: inViewport(panel, vw(p), vh(p)),
          panelInRegion:
            panel !== null && region !== null && panel.x >= region.x - 1 && panel.x + panel.width <= region.x + region.width + 1,
        };
      }, undefined, { fullPage: false });
      for (const [w, f] of Object.entries(found)) {
        expect.soft(f.panelIn, `${w}: panel body inside the viewport`).toBe(true);
        expect.soft(f.panelInRegion, `${w}: panel body inside its 344 px region (no empty box)`).toBe(true);
      }
    });

    await test.step('[23H-E-009] chip target size (BUG-477): 44 px at 375, 32 px at 1440 / 1024 / 768', async () => {
      const heights: Record<number, number[]> = {};
      await verifyUi(page, 'U05_23H-E-009_chip-targets', async (p) => {
        await openPanel(p);
        const list: number[] = [];
        for (const label of H.chips) list.push((await chip(p, label).boundingBox())?.height ?? 0);
        heights[vw(p)] = list;
      }, undefined, { fullPage: false });
      for (const [w, list] of Object.entries(heights)) {
        const want = Number(w) < 640 ? 44 : 32; // HPCH:148-149 h-11 / sm:h-8
        for (const h of list) {
          expect.soft(Math.round(h), `${w}: chip height`).toBe(want);
          expect.soft(h, `${w}: chip ≥ 24 px (WCAG 2.5.8)`).toBeGreaterThanOrEqual(24);
        }
      }
    });

    await test.step('[23H-F-003] person listbox open: listbox and "Mọi người" inside the viewport', async () => {
      const found: Record<number, { list: boolean; option: boolean }> = {};
      await verifyUi(page, 'U05_23H-F-003_listbox', async (p) => {
        await openPanel(p);
        await actorCombo(p).click();
        const listbox = p.getByRole('listbox'); // portalled into document.body (Select.tsx:231,255)
        await expect(listbox).toBeVisible();
        found[vw(p)] = {
          list: inViewport(await listbox.boundingBox(), vw(p), vh(p)),
          option: inViewport(await listbox.getByRole('option', { name: H.actorAll }).boundingBox(), vw(p), vh(p)),
        };
      }, undefined, { fullPage: false });
      for (const [w, f] of Object.entries(found)) {
        expect.soft(f.list, `${w}: listbox inside the viewport`).toBe(true);
        expect.soft(f.option, `${w}: option "Mọi người" not cut`).toBe(true);
      }
    });

    await test.step('[23H-F-004] viewer: panel open in `forbidden`, notice not clipped, no horizontal scroll', async () => {
      const clipped: Record<number, boolean> = {};
      await verifyUi(viewerPage, 'U05_23H-F-004_viewer-forbidden', async (p) => {
        await openPanel(p);
        const notice = historyPanel(p).getByText(H.forbiddenText, { exact: true });
        await expect(historyPanel(p).getByText(H.forbiddenTitle, { exact: true }), 'HPCH:320-330').toBeVisible();
        clipped[vw(p)] = await notice.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
      }, undefined, { fullPage: false });
      for (const [w, c] of Object.entries(clipped)) expect.soft(c, `${w}: "Chỉ xem được lịch sử" notice text clipped`).toBe(false);
    });
  } finally {
    await closeSession(v);
    await closeSession(s);
    await cleanupProjects(api, [pid]);
  }
});
