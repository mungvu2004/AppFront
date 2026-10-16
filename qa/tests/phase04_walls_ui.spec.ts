/**
 * Phase 4 — SCR-16 walls, UI-VERIFY layer (skill `qa-verify-ui`): two sequential flows (QA-04c P1, `flow-plan.md`
 * "phase04_walls_ui.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row; each step is ONE
 * screen state × the four review widths (`support/ui-verify.ts` `verifyUi`: re-opens the state per width, measures layout
 * defects, shoots `U04_<row id>_<slug>_<width>.png` and attaches `U04_<row id>_<slug>.json`). `H` rows use a hard `expect`.
 *
 * - FL-16-U1: the real states on ONE project (QX:walls-ui: an 80-character project name, floor 1 with a crafted layer, floor 2
 *   with every wall reviewed, floor 3 empty with a 65-character name) — no mock.
 * - FL-16-U2 [mocked response]: read failure (real 404 floor), the 409 dialog (real second writer), the viewer (a REAL viewer
 *   member), the tour card and its chip (a context with cleared tour storage), and two mocked states: the loading skeletons
 *   (N16 held by a promise) and the blocked save banner (PUT 500). It stays in this file because the plan places it here;
 *   the title carries `[mocked response]` for `tools/mock-pairs.mjs`.
 *
 * No clock here: a UI case is a still picture, nothing is waited on a timer. The first call of a width may wait for the
 * editor tour (`dismissTour`, `waitMs`); the product's own "Bỏ qua hướng dẫn" closes it.
 * Request budget: 2 logins per flow (+1 viewer + 1 fresh engineer in U2), 2 `POST /api/projects`, 3 #35 PUT writes, one
 * second-writer PUT per width of the 409 state (4).
 */
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { attachJson } from './support/evidence';
import { addProjectMember, deleteSeededProject, poolUser } from './support/phase03Seed';
import {
  WALL,
  adminClient,
  approveButton,
  canvasFrame,
  checkbox,
  clickAt,
  closeWallsRun,
  createNamedProject,
  gapPoint,
  inspector,
  layerApiOf,
  layerRe,
  openWalls,
  openWallsRun,
  secondWriter,
  seedQc,
  selectRow,
  statusBar,
  toasts,
  toggleCheckbox,
  uiName,
  wallIdOf,
  wallList,
  wallOption,
  wallPolygon,
  wallRows,
  wallsLayer,
  idTag,
  codesOf,
  type WallSpec,
  type WallsRun,
} from './support/p04/P1';
import { writeLayer } from './support/layerSeed';
import { verifyUi } from './support/ui-verify';

/** Width-independent reopen: walls of `floorId`, tour closed, first row present. */
async function reopen(page: Page, projectId: string, floorId: string, rows = true): Promise<void> {
  await openWalls(page, projectId, floorId, { tour: false });
  await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
  if (rows) await expect(wallRows(page).first()).toBeVisible();
}

test.describe('E04 SCR-16 walls — UI verification flows (QA-04c P1)', () => {
  test('SCR-16 · FL-16-U1 · walls states on one project (layered floor, all-reviewed floor, empty floor with a 65-char name)', async ({ browser }) => {
    test.setTimeout(420_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      // QX:walls-ui: an 80-char project name; floor 1 = 6 walls (one low confidence, one 150 mm), floor 2 = 3 reviewed walls,
      // floor 3 = empty, named with 65 characters.
      const longFloor = `Tầng có tên rất dài để thử đường cắt chữ ${'x'.repeat(25)}`.slice(0, 65);
      const project = await createNamedProject(api, 'e04-16-u1', 80, ['Tầng 1', 'Tầng đã duyệt hết', longFloor]);
      projectId = project.projectId;
      const [one, two, three] = [project.floors[0]!, project.floors[1]!, project.floors[2]!];
      const tag1 = idTag();
      const tag2 = idTag();
      const floor1: WallSpec[] = [
        { from: [0, 0], to: [4_000, 0] },
        { from: [0, 1_500], to: [4_000, 1_500], confidence: 0.5 },
        { from: [0, 3_000], to: [4_000, 3_000], thicknessMm: 150 },
        { from: [0, 4_500], to: [4_000, 4_500] },
        { from: [0, 6_000], to: [4_000, 6_000] },
        { from: [0, 7_500], to: [4_000, 7_500] },
      ];
      await writeLayer(layerApiOf(api), project.projectId, one.id, wallsLayer(tag1, floor1));
      await writeLayer(
        layerApiOf(api),
        project.projectId,
        two.id,
        wallsLayer(tag2, [
          { from: [0, 0], to: [4_000, 0], reviewed: true },
          { from: [0, 2_000], to: [4_000, 2_000], reviewed: true },
          { from: [0, 4_000], to: [4_000, 4_000], reviewed: true },
        ]),
      );
      const code = (tag: string, n: number): string => codesOf([wallIdOf(tag, n)]).get(wallIdOf(tag, n)) as string;
      run = await openWallsRun(browser, { clock: false, acceptDialogs: true });
      const { page } = run;
      page.setDefaultTimeout(15_000);
      const writes: string[] = [];
      page.on('request', (request) => {
        if (request.method() !== 'GET' && request.url().includes('/api/projects/')) writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
      });
      const pick = async (n: number): Promise<void> => {
        await wallOption(page, code(tag1, n)).click();
        await expect(wallOption(page, code(tag1, n))).toHaveAttribute('aria-selected', 'true');
      };

      await test.step('[16-F-001] List (default): 4 widths, no horizontal scroll (BUG-317)', async () => {
        await verifyUi(page, uiName('16-F-001', 'list'), async (p) => {
          await reopen(p, project.projectId, one.id);
          await expect(p.getByRole('navigation', { name: WALL.floorNav, exact: true })).toBeVisible();
        });
        expect.soft(writes, 'a UI case writes nothing').toEqual([]);
      });

      await test.step('[16-F-002] Wall selected → inspector "Đoạn tường"', async () => {
        await verifyUi(page, uiName('16-F-002', 'wall-selected'), async (p) => {
          await reopen(p, project.projectId, one.id);
          await pick(0);
          await expect(approveButton(p)).toBeVisible();
          await expect(inspector(p)).toBeVisible();
        });
      });

      await test.step('[16-F-003] "Thông số nâng cao" open', async () => {
        await verifyUi(page, uiName('16-F-003', 'advanced'), async (p) => {
          await reopen(p, project.projectId, one.id);
          await pick(0);
          const advanced = inspector(p).getByRole('button', { name: WALL.advanced });
          await advanced.click();
          await expect(advanced).toHaveAttribute('aria-expanded', 'true');
          await expect(p.locator(`[id="${(await advanced.getAttribute('aria-controls')) ?? ''}"]`)).toBeVisible();
        });
      });

      await test.step('[16-F-004] "Chỉ hiện độ tin cậy thấp" on: the narrowed list or the no-match line', async () => {
        await verifyUi(page, uiName('16-F-004', 'low-confidence'), async (p) => {
          await reopen(p, project.projectId, one.id);
          await toggleCheckbox(p, WALL.onlyLow);
          await expect(checkbox(p, WALL.onlyLow)).toBeChecked();
          await expect(wallList(p).or(p.getByText(WALL.noMatch, { exact: true })).first()).toBeVisible();
        });
      });

      await test.step('[16-F-005] Collapsed panels: "Mở lại hai panel"', async () => {
        await verifyUi(page, uiName('16-F-005', 'collapsed'), async (p) => {
          await reopen(p, project.projectId, one.id);
          await p.getByRole('button', { name: WALL.collapse, exact: true }).click();
          await expect(p.getByRole('button', { name: WALL.expand, exact: true })).toBeVisible();
          await expect(wallList(p)).toHaveCount(0);
        });
      });

      await test.step('[16-F-014] Context menu open on a wall: the "Tuỳ chọn" menu', async () => {
        await verifyUi(page, uiName('16-F-014', 'context-menu'), async (p) => {
          await reopen(p, project.projectId, one.id);
          await wallPolygon(p, code(tag1, 2)).scrollIntoViewIfNeeded();
          await wallPolygon(p, code(tag1, 2)).click({ button: 'right' });
          await expect(p.getByRole('menu', { name: 'Tuỳ chọn', exact: true })).toBeVisible();
        }, undefined, { fullPage: false });
      });

      await test.step('[16-F-016] A committed measurement label on the canvas', async () => {
        await verifyUi(page, uiName('16-F-016', 'measurement'), async (p) => {
          await reopen(p, project.projectId, one.id);
          await canvasFrame(p).scrollIntoViewIfNeeded();
          await p.keyboard.press('m');
          await clickAt(p, await gapPoint(p, code(tag1, 0), code(tag1, 1), 0.2));
          await clickAt(p, await gapPoint(p, code(tag1, 0), code(tag1, 1), 0.8));
          await expect(canvasFrame(p).getByText(/^\d{1,3}(\.\d{3})*,\d{2} mm$/u)).toHaveCount(1);
        });
      });

      await test.step('[16-F-015] Delete toast with "Hoàn tác" above the status bar', async () => {
        let opens = 0; // a delete may reach the server before the next width: each width deletes a different wall
        await verifyUi(page, uiName('16-F-015', 'delete-toast'), async (p) => {
          await reopen(p, project.projectId, one.id);
          const victim = code(tag1, 5 - opens);
          opens += 1;
          await wallOption(p, victim).click();
          await p.keyboard.press('Backspace');
          await expect(toasts(p).getByText(`Đã xoá tường ${victim}.`, { exact: true })).toBeVisible();
          await expect(toasts(p).getByRole('button', { name: 'Hoàn tác', exact: true })).toBeVisible();
        }, undefined, { fullPage: false });
      });

      await test.step('[16-F-010] Success (all reviewed): "Sang lớp cửa và nội thất"', async () => {
        await verifyUi(page, uiName('16-F-010', 'success'), async (p) => {
          await reopen(p, project.projectId, two.id);
          await expect(p.getByRole('button', { name: WALL.continue, exact: true })).toBeVisible();
        });
      });

      await test.step('[16-F-017] The filter no-match line', async () => {
        await verifyUi(page, uiName('16-F-017', 'filter-no-match'), async (p) => {
          await reopen(p, project.projectId, two.id);
          await toggleCheckbox(p, WALL.onlyUnreviewed);
          await expect(p.getByText(WALL.noMatch, { exact: true })).toBeVisible();
        });
      });

      await test.step('[16-F-006] Empty floor + a long floor name in the nav', async () => {
        await verifyUi(page, uiName('16-F-006', 'empty-long-name'), async (p) => {
          await reopen(p, project.projectId, three.id, false);
          await expect(p.getByText(WALL.emptyTitle, { exact: true })).toBeVisible();
          await expect(p.getByRole('navigation', { name: WALL.floorNav, exact: true }).getByText(longFloor, { exact: true })).toBeVisible();
        });
        await attachJson('U04_16-F-006_names.json', { projectNameLength: project.name.length, floorNameLength: longFloor.length });
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-U2 · [mocked response] read failure, 409 dialog, viewer, tour card, loading, blocked save', async ({ browser }) => {
    test.setTimeout(420_000);
    const api = await adminClient();
    let admin: WallsRun | undefined;
    let viewerRun: WallsRun | undefined;
    let freshRun: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      const q1 = await seedQc(api, 'e04-16-u2');
      projectId = q1.projectId;
      const floor = q1.floors[0]!;
      const viewer = await poolUser(api, 'viewer');
      await addProjectMember(api, q1.projectId, viewer.email);
      const fresh = await poolUser(api, 'engineer', 'p04-fresh');
      await addProjectMember(api, q1.projectId, fresh.email);
      admin = await openWallsRun(browser, { clock: false, acceptDialogs: true });
      const { page } = admin;
      page.setDefaultTimeout(15_000);
      const code = (n: number): string => q1.codes.get(String(q1.walls[n]?.id)) as string;

      await test.step('[16-F-008] Read-failure screen (404 floor): "Không mở được tầng này"', async () => {
        await verifyUi(page, uiName('16-F-008', 'read-failure'), async (p) => {
          const missing = `L-QAP1U2MISSING${Date.now().toString(36).toUpperCase()}`;
          await p.goto(ROUTES.project.walls(q1.projectId, missing));
          await expect(p.getByRole('heading', { name: 'Không mở được tầng này', exact: true })).toBeVisible();
        });
      });

      let writes = 0; // a distinct thickness per width: an identical write is a no-op (applied=false, no 409)
      await test.step('[16-F-011] 409 reload banner + the A9 dialog "Bỏ thay đổi chưa lưu của tầng này?" at four widths', async () => {
        await verifyUi(
          page,
          uiName('16-F-011', 'conflict-dialog'),
          async (p) => {
            await reopen(p, q1.projectId, floor.id);
            await selectRow(p, code(1));
            writes += 1;
            await secondWriter(api, q1.projectId, floor.id, (walls) =>
              walls.map((w, i) => (i === 0 ? { ...w, thicknessMm: 300 + 10 * writes } : w)),
            );
            const conflict = waitForApi(p, 'PUT', layerRe(q1.projectId, floor.id), [409]);
            await approveButton(p).click();
            await conflict;
            const banner = p.getByRole('alert').filter({ hasText: WALL.conflict });
            await expect(banner).toBeVisible();
            await banner.getByRole('button', { name: WALL.reload, exact: true }).click();
            await expect(p.getByRole('dialog', { name: WALL.confirmTitle, exact: true })).toBeVisible();
          },
          undefined,
          { fullPage: false },
        );
      });

      await test.step('[16-F-009] Viewer (forbidden) with a wall selected: the viewer notice', async () => {
        viewerRun = await openWallsRun(browser, { who: viewer, clock: false, acceptDialogs: true });
        viewerRun.page.setDefaultTimeout(15_000);
        await verifyUi(viewerRun.page, uiName('16-F-009', 'viewer'), async (p) => {
          await reopen(p, q1.projectId, floor.id);
          await wallRows(p).first().click();
          await expect(p.getByText('Bạn đang xem với vai người xem, nên không duyệt hay sửa được đoạn tường nào.', { exact: false })).toBeVisible();
        });
      });

      await test.step('[16-F-018] ⚑ The tour step card and the "Xem hướng dẫn" chip stay clear of the status bar (BUG-397)', async () => {
        freshRun = await openWallsRun(browser, { who: fresh, clock: false, acceptDialogs: true });
        const tour = freshRun.page;
        tour.setDefaultTimeout(15_000);
        // A new document starts without the "seen" flag, so the tour card shows at every width.
        await tour.addInitScript(() => {
          for (const key of Object.keys(window.localStorage)) if (key.startsWith('appfront:system-editor-tour-seen:')) window.localStorage.removeItem(key);
        });
        const overlaps: { state: string; width: number; clear: boolean }[] = [];
        const clearOfStatusBar = async (p: Page, state: string, target: Locator): Promise<void> => {
          const [box, bar] = [await target.boundingBox(), await statusBar(p).boundingBox()];
          if (box === null || bar === null) throw new Error(`${state}: no box`);
          overlaps.push({ state, width: p.viewportSize()?.width ?? 0, clear: box.y + box.height <= bar.y + 1 || box.y >= bar.y + bar.height });
        };
        await verifyUi(tour, uiName('16-F-018', 'tour-card'), async (p) => {
          await openWalls(p, q1.projectId, floor.id, { tour: false });
          const card = p.getByRole('region', { name: 'Chọn công cụ ở ray bên trái', exact: true });
          await expect(card).toBeVisible();
          await clearOfStatusBar(p, 'card', card);
        });
        await verifyUi(tour, uiName('16-F-018', 'tour-chip'), async (p) => {
          await openWalls(p, q1.projectId, floor.id, { tour: false });
          await p.getByRole('button', { name: 'Bỏ qua hướng dẫn', exact: true }).first().click();
          const chip = p.getByRole('button', { name: 'Xem hướng dẫn', exact: true });
          await expect(chip).toBeVisible();
          await clearOfStatusBar(p, 'chip', chip);
        });
        await attachJson('U04_16-F-018_tour-clearance.json', { overlaps });
        for (const row of overlaps) expect.soft(row.clear, `${row.state} at ${String(row.width)} px is clear of the status bar`).toBe(true);
      });

      await test.step('[16-F-007] _(mock)_ Loading skeletons: the N16 read is held', async () => {
        let release = (): void => undefined;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const hold = async (route: Route): Promise<void> => {
          if (route.request().method() === 'GET' && layerRe(q1.projectId, floor.id).test(new URL(route.request().url()).pathname)) {
            await gate;
            await route.fallback().catch(() => undefined);
            return;
          }
          await route.fallback();
        };
        await page.route('**/api/projects/**', hold);
        try {
          await verifyUi(page, uiName('16-F-007', 'loading'), async (p) => {
            await p.goto(ROUTES.project.walls(q1.projectId, floor.id), { waitUntil: 'commit' });
            await expect(p.getByRole('status', { name: WALL.list, exact: true })).toBeVisible();
          });
        } finally {
          release();
          await page.unroute('**/api/projects/**', hold);
        }
      });

      await test.step('[16-F-012] _(mock)_ Blocked save banner "Không lưu được thay đổi của tầng này."', async () => {
        const fail = async (route: Route): Promise<void> => {
          if (route.request().method() === 'PUT' && layerRe(q1.projectId, floor.id).test(new URL(route.request().url()).pathname)) {
            await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'qa mocked', requestId: 'qa-blocked-save' }) });
            return;
          }
          await route.fallback();
        };
        await page.route('**/api/projects/**', fail);
        try {
          await verifyUi(page, uiName('16-F-012', 'blocked-save'), async (p) => {
            await reopen(p, q1.projectId, floor.id);
            await selectRow(p, code(2));
            await p.keyboard.press('3');
            await expect(p.getByRole('alert').filter({ hasText: 'Không lưu được thay đổi của tầng này.' })).toBeVisible();
          });
        } finally {
          await page.unroute('**/api/projects/**', fail);
        }
      });
    } finally {
      await closeWallsRun(viewerRun);
      await closeWallsRun(freshRun);
      await closeWallsRun(admin);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });
});

