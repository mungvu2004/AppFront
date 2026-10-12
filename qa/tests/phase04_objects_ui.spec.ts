/**
 * Phase 4 — SCR-17 object layer review, UI-VERIFY layer (skill `qa-verify-ui`): two flows (QA-04c P2, `flow-plan.md`
 * "phase04_objects_ui.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row; every `[17-F-…]` step
 * is one screen state walked by `verifyUi` at 1440 / 1024 / 768 / 375 (it re-opens the state per width, measures overflow,
 * off-screen controls, broken images, clipped / overlapping / small targets and writes `U04_<row id>_<slug>_<width>.png` +
 * `.json`). The first step of a flow is a hard `expect`; the others `expect.soft`.
 *
 * FL-17-U1 is real (own project: Q1 floor + empty floor + 1-wall floor + low-confidence floor; the bogus floor id is a
 * never-created `L-…`). FL-17-U2 carries `[mocked response]` only for [17-F-015] (N16 held by test state, support/p04/P2.ts
 * `mockRoute`); the viewer of [17-F-008] is the REAL pool viewer made a member of the project.
 *
 * Budget: 3 logins (main admin API in beforeAll, owner per flow) + 1 viewer; `POST /api/projects` 2; N16 reads ~4 per width.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson } from './support/evidence';
import { verifyUi, UI_VIEWPORTS } from './support/ui-verify';
import {
  OBJ,
  QUICK,
  addMember,
  allOptions,
  at,
  attempt,
  chip,
  closeSession,
  deferred,
  eyeButton,
  ev,
  inspector,
  layerRe,
  menuItem,
  mockRoute,
  objectsQ1,
  objectsUiProject,
  openObjects,
  openSession,
  openUserContext,
  optionOf,
  poolUsers,
  railButton,
  screen,
  statusBar,
  swingRadio,
  symbolOf,
  toastRegion,
  writeQ1,
  type Deferred,
  type PoolUser,
  type Session,
} from './support/p04/P2';

let owner: PoolUser;
let viewer: PoolUser;

test.beforeAll(async () => {
  ({ owner, viewer } = await poolUsers());
});

const FLOW_TIMEOUT = 420_000;

async function withFlow(browser: Browser, body: (session: Session) => Promise<void>): Promise<void> {
  const session = await openSession(browser, owner);
  try {
    await body(session);
  } finally {
    await closeSession(session);
  }
}

/** Fresh load of the objects route and its marker (counter text) — what `verifyUi` needs from `open`. */
const openFloor = (pid: string, fid: string) => async (page: Page): Promise<void> => {
  await page.goto(ROUTES.project.objects(pid, fid));
  await expect(screen(page)).toBeVisible();
  await expect(statusBar(page)).toContainText('đối tượng đã duyệt');
};

/* ================================================================= FL-17-U1 */

test('SCR-17 · FL-17-U1 objects states on one project', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page } = s;
    const project = await objectsUiProject(s, 'fu1');
    const pid = project.projectId;
    const [q1, empty, oneWall, lowConf] = [0, 1, 2, 3].map((index) => at(project.floors, index, 'floor').floorId) as [string, string, string, string];
    const bogusFloor = `L-QAP2UI${Date.now().toString(36).toUpperCase()}`;

    await test.step('[17-F-001] List loaded, nothing selected · 4 widths', async () => {
      const metrics = await verifyUi(page, 'U04_17-F-001_list', openFloor(pid, q1));
      expect(metrics).toHaveLength(UI_VIEWPORTS.length);
    });

    await test.step('[17-F-002] Object selected (inspector "Đối tượng") · 4 widths', async () => {
      await verifyUi(page, 'U04_17-F-002_selected', async (p) => {
        await openFloor(pid, q1)(p);
        await optionOf(p, '#D-001').click();
        await expect.soft(inspector(p).getByText('#D-001', { exact: true })).toBeVisible();
      });
    });

    await test.step('[17-F-012] Window selected (sill row + 4 swing radios with labels, BUG-399)', async () => {
      await verifyUi(page, 'U04_17-F-012_window_selected', async (p) => {
        await openFloor(pid, q1)(p);
        await optionOf(p, '#S-001').click();
        await expect.soft(inspector(p).getByText('Cao độ bệ cửa', { exact: true })).toBeVisible();
        for (const label of ['Mở trái', 'Mở phải', 'Hai cánh', 'Trượt']) await expect.soft(inspector(p).getByText(label, { exact: true }), `swing label "${label}" visible`).toBeVisible();
        await expect.soft(inspector(p).getByRole('radio')).toHaveCount(4);
      });
    });

    await test.step('[17-F-013] Furniture selected ("Đứng tự do")', async () => {
      await verifyUi(page, 'U04_17-F-013_furniture_selected', async (p) => {
        await openFloor(pid, q1)(p);
        await optionOf(p, '#F-001').click();
        await expect.soft(inspector(p).getByText(OBJ.furnitureFree, { exact: true })).toBeVisible();
      });
    });

    await test.step('[17-F-003] "Lọc theo loại" chip on · 4 widths', async () => {
      await verifyUi(page, 'U04_17-F-003_chip_on', async (p) => {
        await openFloor(pid, q1)(p);
        await chip(p, 'Cửa đơn').click();
        await expect.soft(chip(p, 'Cửa đơn')).toHaveAttribute('aria-pressed', 'true');
      });
    });

    await test.step('[17-F-007] Panels collapsed (floating rail)', async () => {
      await verifyUi(page, 'U04_17-F-007_collapsed', async (p) => {
        await openFloor(pid, q1)(p);
        await statusBar(p).getByRole('button', { name: OBJ.collapse, exact: true }).click();
        await expect(statusBar(p).getByRole('button', { name: OBJ.expand, exact: true })).toBeVisible();
      });
    });

    await test.step('[17-F-011] Context menu open near the right/bottom edge stays in the viewport', async () => {
      await verifyUi(page, 'U04_17-F-011_context_menu', async (p) => {
        await openFloor(pid, q1)(p);
        await symbolOf(p, '#S-001').click({ button: 'right', timeout: QUICK }); // the window sits on the right wall
        const menu = p.getByRole('menu', { name: 'Tuỳ chọn', exact: true });
        await expect(menu).toBeVisible();
        const box = await menu.boundingBox();
        const size = p.viewportSize();
        expect.soft(box !== null && size !== null && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height, `menu inside the viewport: ${JSON.stringify(box)}`).toBe(true);
      }, UI_VIEWPORTS, { fullPage: false });
    });

    await test.step('[17-F-014] Delete toast with "Hoàn tác"', async () => {
      await verifyUi(
        page,
        'U04_17-F-014_delete_toast',
        async (p) => {
          await writeQ1(s, pid, q1); // every width starts from the full layer again (the delete is saved by autosave)
          await openFloor(pid, q1)(p);
          const code = ((await allOptions(p).first().getAttribute('aria-label')) ?? '').split(' — ')[0] ?? '';
          await symbolOf(p, code).click({ button: 'right', timeout: QUICK });
          await menuItem(p, 'Xoá').click({ timeout: QUICK });
          await expect(toastRegion(p).getByRole('status')).toBeVisible();
          await expect.soft(toastRegion(p).getByRole('button', { name: OBJ.undo })).toBeVisible();
        },
        UI_VIEWPORTS,
        { fullPage: false },
      );
    });

    await test.step('[17-F-006] Partial low-confidence notice + toggle', async () => {
      await verifyUi(page, 'U04_17-F-006_low_confidence', async (p) => {
        await openFloor(pid, lowConf)(p);
        await expect(p.getByText('1 mục dưới ngưỡng tin cậy, đã lọc sẵn', { exact: true })).toBeVisible();
        await expect.soft(p.getByRole('button', { name: OBJ.lowOnly, exact: true })).toHaveAttribute('aria-pressed', 'true');
      });
    });

    await test.step('[17-F-005] Empty with a wall ("Thêm thủ công") · 4 widths', async () => {
      await verifyUi(page, 'U04_17-F-005_empty_with_wall', async (p) => {
        await openFloor(pid, oneWall)(p);
        await expect(p.getByRole('button', { name: OBJ.addManually, exact: true })).toBeVisible();
      });
    });

    await test.step('[17-F-004] Empty, no wall ("Sang duyệt tường") · 4 widths', async () => {
      await verifyUi(page, 'U04_17-F-004_empty_no_wall', async (p) => {
        await openFloor(pid, empty)(p);
        await expect(p.getByRole('button', { name: OBJ.openWalls, exact: true })).toBeVisible();
      });
    });

    await test.step('[17-F-009] Read-failure screen · "Không mở được tầng này"', async () => {
      await verifyUi(page, 'U04_17-F-009_read_failure', async (p) => {
        await p.goto(ROUTES.project.objects(pid, bogusFloor));
        await expect(p.getByRole('heading', { name: 'Không mở được tầng này', exact: true })).toBeVisible();
      });
    });
  });
});

/* ================================================================= FL-17-U2 */

test('SCR-17 · FL-17-U2 [mocked response] viewer, loading, narrow layout, canvas fit, focus rings', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page } = s;
    const project = await objectsQ1(s, 'fu2');
    const pid = project.projectId;
    const fid = at(project.floors, 0, 'floor').floorId;
    const holds: Deferred[] = [];

    await test.step('[17-F-008] Viewer forbidden (no rail tools, read-only inspector) · status bar notice', async () => {
      await addMember(s, pid, viewer.email);
      const guest = await openUserContext(browser, viewer);
      try {
        await verifyUi(guest.page, 'U04_17-F-008_viewer', async (p) => {
          await openFloor(pid, fid)(p);
          await optionOf(p, '#D-001').click();
          await expect(statusBar(p)).toContainText(OBJ.forbidden);
          await expect.soft(p.getByRole('toolbar', { name: OBJ.rail, exact: true }).getByRole('button')).toHaveCount(0);
          await expect.soft(inspector(p).getByRole('combobox')).toHaveCount(0);
          await expect.soft(inspector(p).getByRole('button', { name: OBJ.approve, exact: true })).toHaveCount(0);
        });
      } finally {
        await guest.context.close();
      }
    });

    await test.step('[17-F-015] (mock) Loading skeleton · 4 widths', async () => {
      const n16 = await mockRoute(page, layerRe(pid, fid), 'GET');
      await verifyUi(page, 'U04_17-F-015_loading', async (p) => {
        const hold = deferred();
        holds.push(hold);
        n16.set({ hold });
        await p.goto(ROUTES.project.objects(pid, fid), { waitUntil: 'commit' });
        await expect(screen(p)).toBeVisible();
        await expect(p.locator('div.flex.items-center.gap-4.p-3:has(> .animate-pulse)')).toHaveCount(4);
      });
      n16.set('pass');
      for (const hold of holds) hold.resolve();
    });

    await test.step('[17-F-016] Under 1280 the panels wrap under the canvas, only vertical scroll; status bar sticks to the bottom; legend not broken', async () => {
      await verifyUi(page, 'U04_17-F-016_narrow', async (p) => {
        await openFloor(pid, fid)(p);
        const size = p.viewportSize();
        // The status bar must stay reachable at the bottom (BUG-317/324): pinned (sticky / fixed) or inside the first viewport.
        const pinned = await statusBar(p).evaluate((node) => {
          const rect = node.getBoundingClientRect();
          let el: HTMLElement | null = node as HTMLElement;
          while (el !== null && !['sticky', 'fixed'].includes(getComputedStyle(el).position)) el = el.parentElement;
          return { pinned: el !== null, bottom: rect.bottom, height: window.innerHeight };
        });
        if ((size?.width ?? 0) < 1280) expect.soft(pinned.pinned || pinned.bottom <= pinned.height + 1, `status bar pinned or in view: ${JSON.stringify(pinned)}`).toBe(true);
        const legend = p.getByLabel(OBJ.legend, { exact: true });
        const lines = await legend.evaluate((node) => new Set([...node.querySelectorAll('span')].map((span) => Math.round(span.getBoundingClientRect().top))).size);
        expect.soft(await legend.evaluate((node) => getComputedStyle(node).whiteSpace), 'legend keeps each label on one line (BUG-401)').toBe('nowrap');
        expect.soft(lines, 'legend lines').toBeGreaterThan(0);
        expect.soft(await p.evaluate(() => (document.scrollingElement?.scrollWidth ?? 0) <= window.innerWidth), 'no horizontal page scroll').toBe(true);
      });
    });

    await test.step('[17-C-036] Canvas fits the drawing/walls to the frame (viewBox) at every width; symbols are clickable (BUG-403/424)', async () => {
      await verifyUi(page, 'U04_17-C-036_canvas_fit', async (p) => {
        await openFloor(pid, fid)(p);
        const frame = await p.getByRole('group', { name: OBJ.canvas, exact: true }).boundingBox();
        expect.soft(await p.getByRole('img', { name: OBJ.canvas, exact: true }).getAttribute('viewBox'), 'svg viewBox set').not.toBeNull();
        for (const code of ['#D-001', '#S-001', '#F-001']) {
          const box = await symbolOf(p, code).boundingBox();
          expect.soft(frame !== null && box !== null && box.x >= frame.x - 1 && box.y >= frame.y - 1 && box.x + box.width <= frame.x + frame.width + 1 && box.y + box.height <= frame.y + frame.height + 1, `${code} inside the frame`).toBe(true);
          await attempt(`click the symbol ${code}`, async () => {
            await symbolOf(p, code).click({ timeout: QUICK });
            await expect(optionOf(p, code)).toHaveAttribute('aria-selected', 'true', { timeout: QUICK });
          });
        }
      });
    });

    await test.step('[17-E-020] Focus ring visible on rows, chips, eye and rail buttons', async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openObjects(page, pid, fid);
      await page.keyboard.press('Tab'); // keyboard modality: a scripted focus() then matches :focus-visible
      const targets = {
        row: optionOf(page, '#D-001'),
        chip: chip(page, 'Cửa đơn'),
        eye: eyeButton(page, 'cửa đi'),
        rail: railButton(page, 'Chọn nhóm cửa đi (phím D)'),
      };
      const rings: Record<string, string> = {};
      for (const [name, locator] of Object.entries(targets)) {
        await locator.focus();
        rings[name] = await locator.evaluate((node) => {
          const style = getComputedStyle(node);
          const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 ? `outline ${style.outlineWidth}` : '';
          const shadow = style.boxShadow !== 'none' ? `shadow ${style.boxShadow}` : '';
          return `${outline} ${shadow}`.trim();
        });
        expect.soft(rings[name], `focus ring on the ${name}`).not.toBe('');
      }
      await attachJson('U04_17-E-020_focus_rings.json', { rings });
      await ev(page, '17-E-020', 'focus_rings', 'U04');
    });
  });
});
