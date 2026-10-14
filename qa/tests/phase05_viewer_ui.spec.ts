/**
 * Phase 5 — SCR-23 Pascal `/projects/:p/3d` (+ SCR-24 `/3d/exploded`), dedicated UI-verification flows (skill `qa-verify-ui`;
 * QA-05c `flows-C1.md` "phase05_viewer_ui.spec.ts"). Three flows; every step is one screen state at 1920 / 1920 / 1440 / 1024 / 768
 * through `support/ui-verify.ts` `verifyUi` (re-opens the state per width, measures horizontal scroll, controls off-screen,
 * broken images, clipped text, overlaps, small targets; shoots `U05_<row id>_<slug>_<width>.png` + `U05_<row id>_<slug>.json`).
 * Row-specific numbers (canvas height share, canvas width, contrast, overlap) are measured inside `open` per width and asserted
 * after the four widths.
 *
 * FL-23-U2 is the only `[mocked response]` flow (bundle held / aborted, N15 + dimensions, N15 500) — pairs with FL-23-U1 (real
 * rendered states). Everything else is the real stack: Q1 (`layerSeed.createQcProject`, 1 floor qcLayer), P0
 * (`phase03Seed.createProject`, 1 floor, no layer), Q2 (2 layered floors), an unknown project id, and the pool viewer
 * (`poolUser(admin, 'viewer', 'p05-p2')`) as a REAL member in a second context.
 *
 * Budget per full run: `POST /api/auth/login` 1 admin API + 4 sessions (3 admin, 1 viewer) = 5; `POST /api/projects` 4
 * (Q1 ×2, P0, Q2), #35 PUT 1 + 1 + 2 (seeds) + 4 (FL-23-U1 step 3, one rename per width), `DELETE` 4; `POST …/members` 1;
 * invitation 0 (1 only when the pool slot is empty); `POST /api/auth/refresh` ≈ 1 per page load (≈ 50 loads).
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { createQcProject, type LayerApi } from './support/layerSeed';
import {
  ERROR_PAINT_TIMEOUT_MS,
  PASCAL_BUNDLE_GLOB,
  PASCAL_RENDER_TIMEOUT_MS,
  T,
  abortRoute,
  addDimensions,
  adminWho,
  canvasBox,
  canvasOnlyShot,
  caption,
  cleanupProjects,
  closeSession,
  fulfillGet,
  historyRegion,
  historyTab,
  holdPascalBundle,
  intersects,
  minContrast,
  mutateN15,
  nonBlankRatio,
  openPascal,
  openRoomPanel,
  openViewerRoomPanel,
  openSession,
  pascalEditOnce,
  pascalRoot,
  roomRow,
  saveLine,
  skippedBox,
  spatialPath,
  summary,
  viewerRoomRow,
  type Box,
  type Session,
} from './support/p05/P2';
import { addProjectMember, createProject, poolUser } from './support/phase03Seed';
import { verifyUi, type UiMetrics } from './support/ui-verify';

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

const widthOf = (p: Page): number => p.viewportSize()?.width ?? 0;
const heightOf = (p: Page): number => p.viewportSize()?.height ?? 0;
/** H steps: the state must open at every width (verifyUi only fails that softly). */
const expectOpened = (metrics: readonly UiMetrics[]): void => {
  for (const m of metrics) expect(m.openError, `${m.viewport}: the state opened`).toBeUndefined();
};

test('SCR-23 · FL-23-U1 · rendered states', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 220_000));
  const [floor] = await createQcProject(api, 'u05-u1');
  if (floor === undefined) throw new Error('setup: Q1 has no floor');
  const pid = floor.projectId;
  let s: Session | undefined;
  try {
    s = await openSession(browser, adminWho());
    const { page } = s;

    await test.step('[23-F-002] rendered: canvas height > ½ viewport', async () => {
      const share: Record<number, number> = {};
      const metrics = await verifyUi(page, 'U05_23-F-002_rendered', async (p) => {
        await openPascal(p, pid);
        share[widthOf(p)] = ((await canvasBox(p).boundingBox())?.height ?? 0) / heightOf(p);
      });
      expectOpened(metrics);
      for (const [w, r] of Object.entries(share)) expect.soft(r, `${w}: canvas height / viewport (PVC:389-394, B-V10-02)`).toBeGreaterThan(0.5);
    });

    await test.step('[23-F-007] history panel open: no horizontal scroll, canvas width > 0', async () => {
      const canvasWidth: Record<number, number> = {};
      await verifyUi(page, 'U05_23-F-007_history-open', async (p) => {
        await openPascal(p, pid);
        await historyTab(p).click();
        await expect(historyRegion(p)).toBeVisible();
        canvasWidth[widthOf(p)] = (await canvasBox(p).boundingBox())?.width ?? 0;
      });
      // ⚑ suspected (catalog 23-F-007): rail + fixed 344 px column squeezes the canvas (PV:98-128).
      for (const [w, cw] of Object.entries(canvasWidth)) expect.soft(cw, `${w}: canvas width with the panel open`).toBeGreaterThan(0);
    });

    let current = 'Bếp';
    await test.step('[23-F-008] after a rename: save line "Đã lưu lúc …" + summary', async () => {
      await verifyUi(page, 'U05_23-F-008_saved', async (p) => {
        await openPascal(p, pid);
        const next = `Bếp U${String(widthOf(p))}`;
        await pascalEditOnce(p, current, next);
        current = next;
        await expect(saveLine(p)).toBeVisible();
        await expect(summary(p), 'PV:279-304').toBeVisible();
      });
    });

    await test.step('[23-F-012] presence roster open: caption contrast ≥ 4,5, no overlap with Pascal chrome', async () => {
      const found: Record<number, { contrast: number; overlaps: number }> = {};
      await verifyUi(page, 'U05_23-F-012_roster', async (p) => {
        await openPascal(p, pid);
        const toggle = p.getByRole('button', { name: T.rosterToggle, exact: true });
        await toggle.click();
        const anchor = toggle.locator('..');
        const list = anchor.getByRole('list', { name: T.rosterList, exact: true });
        await expect(list).toBeVisible();
        const contrast = await minContrast(anchor.locator('div[role="status"] > p'));
        const listBox = (await list.boundingBox()) as Box | null;
        const chrome = await pascalRoot(p)
          .locator('button')
          .evaluateAll((els) =>
            els
              .map((el) => el.getBoundingClientRect())
              .filter((r) => r.width > 2 && r.height > 2)
              .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
          );
        found[widthOf(p)] = { contrast, overlaps: listBox === null ? 0 : chrome.filter((b) => intersects(listBox, b)).length };
      });
      for (const [w, f] of Object.entries(found)) {
        expect.soft(f.contrast, `${w}: presence caption contrast (CL:315-375, BUG-478)`).toBeGreaterThanOrEqual(4.5);
        expect.soft(f.overlaps, `${w}: roster over Pascal buttons (BUG-486 pattern)`).toBe(0);
      }
    });

    await test.step('[23-F-006] collapsed', async () => {
      await verifyUi(page, 'U05_23-F-006_collapsed', async (p) => {
        await openPascal(p, pid);
        await p.keyboard.press('Escape'); // UPV:508-538
        await expect(p.getByRole('heading', { name: T.collapsedTitle, exact: true }), 'PV:219-229').toBeVisible();
      });
    });
  } finally {
    await closeSession(s);
    await cleanupProjects(api, [pid]);
  }
});

test('SCR-23 · FL-23-U2 · [mocked response] loading / partial / error / gate error — pairs with FL-23-U1', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 80_000));
  const [floor] = await createQcProject(api, 'u05-u2');
  if (floor === undefined) throw new Error('setup: Q1 has no floor');
  const pid = floor.projectId;
  let s: Session | undefined;
  try {
    s = await openSession(browser, adminWho());
    const { page } = s;

    await test.step('[23-F-001] bundle held → loading', async () => {
      const hold = await holdPascalBundle(page);
      try {
        const metrics = await verifyUi(page, 'U05_23-F-001_loading', async (p) => {
          await openPascal(p, pid, { wait: false });
          await expect(caption(p), 'PV:232-266').toHaveText(T.loading);
        });
        expectOpened(metrics);
      } finally {
        await hold.dispose();
      }
    });

    await test.step('[23-F-003] N15 + dimensions → partial box', async () => {
      const n15 = await mutateN15(page, pid, (graph) => addDimensions(graph, 2));
      try {
        await verifyUi(page, 'U05_23-F-003_partial', async (p) => {
          await openPascal(p, pid, { text: T.partial });
          await expect(skippedBox(p), 'PV:306-319').toBeVisible();
        });
      } finally {
        await n15.dispose();
      }
    });

    await test.step('[23-F-005] bundle aborted → PASCAL-01', async () => {
      const lost = await abortRoute(page, PASCAL_BUNDLE_GLOB);
      try {
        await verifyUi(page, 'U05_23-F-005_pascal-01', async (p) => {
          await openPascal(p, pid, { wait: false });
          await expect(p.getByRole('heading', { name: T.errorTitle, exact: true }), 'PV:202-216').toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
        });
      } finally {
        await lost.dispose();
      }
    });

    await test.step('[23-F-010] N15 500 → gate error', async () => {
      const n15 = await fulfillGet(page, spatialPath(pid), 500);
      try {
        await verifyUi(page, 'U05_23-F-010_gate-error', async (p) => {
          await openPascal(p, pid, { wait: false });
          await expect(p.getByRole('alert').filter({ hasText: T.unknownText }), 'PSG:78-91').toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
        });
      } finally {
        await n15.dispose();
      }
    });
  } finally {
    await closeSession(s);
    await cleanupProjects(api, [pid]);
  }
});

test('SCR-23 · FL-23-U3 · empty, 404, exploded, viewer', async ({ browser }) => {
  // 4 states × 4 widths; exploded renders + pixel poll up to 60 s per width (run-051: 160 s was not enough).
  test.setTimeout(Math.max(120_000, 2 * 200_000));
  const p0 = await createProject(admin, 'u05-u3-p0', 1);
  const q2 = await createQcProject(api, 'u05-u3-q2', ['Tầng 1', 'Tầng 2'], 2).catch(async (error: unknown) => {
    await cleanupProjects(api, [p0.projectId]);
    throw error;
  });
  const q2pid = q2[0]?.projectId ?? '';
  let s: Session | undefined;
  let v: Session | undefined;
  try {
    const viewer = await poolUser(admin, 'viewer', 'p05-p2');
    await addProjectMember(admin, q2pid, viewer.email);
    s = await openSession(browser, adminWho());
    v = await openSession(browser, viewer);
    const { page } = s;
    const viewerPage = v.page;

    await test.step('[23-F-004] empty (P0)', async () => {
      const metrics = await verifyUi(page, 'U05_23-F-004_empty', async (p) => {
        await openPascal(p, p0.projectId, { wait: false });
        await expect(p.getByRole('heading', { name: T.emptyTitle, exact: true }), 'PV:159-171').toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      });
      expectOpened(metrics);
    });

    await test.step('[23-F-009] unknown id → 404', async () => {
      const unknown = randomUUID();
      await verifyUi(page, 'U05_23-F-009_not-found', async (p) => {
        await openPascal(p, unknown, { wait: false });
        await expect(p.getByRole('heading', { name: T.notFoundTitle }), 'PSG:48-61').toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      });
    });

    await test.step('[24-F-001] Q2 /3d/exploded at 4 widths, canvas not blank', async () => {
      const ratios: Record<number, number> = {};
      await verifyUi(page, 'U05_24-F-001_exploded', async (p) => {
        await openPascal(p, q2pid, { path: ROUTES.project.exploded(q2pid) });
        await expect(p).toHaveURL(/[?&]view=exploded(&|$)/u);
        await expect
          .poll(async () => (ratios[widthOf(p)] = await nonBlankRatio(await canvasOnlyShot(p))), { timeout: PASCAL_RENDER_TIMEOUT_MS })
          .toBeGreaterThan(0);
      });
      for (const [w, r] of Object.entries(ratios)) expect.soft(r, `${w}: exploded canvas non-background share (PF:219-223)`).toBeGreaterThan(0.01);
    });

    await test.step('[23-F-011] Q2 as viewer, room selected → read-only inspector notice', async () => {
      await verifyUi(viewerPage, 'U05_23-F-011_viewer-readonly', async (p) => {
        await openPascal(p, q2pid);
        await openViewerRoomPanel(p); // viewer: rows carry readOnlyRename, not "Đổi tên phòng Bếp" (run-052)
        await viewerRoomRow(p, 'Bếp').click();
        await expect(pascalRoot(p).getByText(T.viewerInspectorNotice, { exact: true }), 'panel-manager.tsx:288-290').toBeVisible();
      });
    });
  } finally {
    await closeSession(v);
    await closeSession(s);
    await cleanupProjects(api, [p0.projectId, q2pid].filter((id) => id !== ''));
  }
});
