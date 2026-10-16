/**
 * Phase 5 — SCR-23H "Lịch sử thao tác", the side panel of Pascal `/projects/:p/3d`, EDGE layer, real stack: four flows
 * (QA-05c `flows-C3.md` "phase05_panels-b_edge.spec.ts", rows in `catalog-C3.md`; file named with `_b_` because
 * `qa/playwright.config.ts` `testMatch` /phase\d{2}_[a-z0-9_]+\.spec\.ts$/ does not take a hyphen). One `test()` per flow, one
 * `test.step('[<row id>] …')` per row in plan order; H rows hard `expect`, S rows `expect.soft`; evidence
 * `E05_<row id>_<slug>.png`. ⚑ steps assert the CORRECT behaviour and stay red while the bug lives (23H-E-002 two names,
 * 23H-A-009 Ctrl+H does not close, 23H-A-016 history never fills — PVC:288 passes no `history`, 23H-D-003 viewer body blank).
 *
 * Opening: `goto /projects/:p/3d`, wait for the success/partial caption (PVT:118-121); the side column only exists in
 * loading/success/partial (PV:247-275). No tour mounts on `/3d` (flows-C3 header).
 * Data: own Q1 per flow (`layerSeed.createQcProject`, 1 floor qcLayer); FL-23H-04 adds P0 (`phase03Seed.createProject`, 1 floor,
 * no layer) and pool users of slot `p05-p2` (engineer, viewer — REAL members in their own contexts) and `p05-p2-a2` (admin,
 * NOT a member → 404, K08). Edit vehicle for 23H-A-016: a room rename in Pascal (support/p05/P2.ts `pascalEditOnce`).
 *
 * Budget per full run: `POST /api/auth/login` 1 admin API + 3 admin sessions + 3 pool sessions (engineer, viewer, admin A2) = 7;
 * `POST /api/projects` 5 (+ #35 PUT 4 seeds + 1 rename), `DELETE` 5; `POST …/members` 2; invitations 0 (≤ 3 when the pool slots
 * are empty); `POST /api/auth/refresh` ≈ 1 per page load (≈ 20 loads). No mock.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { createQcProject, type LayerApi, type SeededFloor } from './support/layerSeed';
import {
  ERROR_PAINT_TIMEOUT_MS,
  H,
  PASCAL_RENDER_TIMEOUT_MS,
  T,
  actorCombo,
  activeLabel,
  adminWho,
  apiCalls,
  blurAll,
  canvasBox,
  chip,
  cleanupProjects,
  closeSession,
  historyPanel,
  historyRegion,
  historyTab,
  jsCalls,
  netlog,
  openPascal,
  openSession,
  pascalEditOnce,
  rail,
  type Session,
} from './support/p05/P2';
import { addProjectMember, createProject, poolUser } from './support/phase03Seed';

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

async function withQ1(browser: Browser, slug: string, body: (s: Session, floor: SeededFloor) => Promise<void>): Promise<void> {
  const [floor] = await createQcProject(api, slug);
  if (floor === undefined) throw new Error('setup: Q1 has no floor');
  let s: Session | undefined;
  try {
    s = await openSession(browser, adminWho());
    await body(s, floor);
  } finally {
    await closeSession(s);
    await cleanupProjects(api, [floor.projectId]);
  }
}

/** `Select` portals its listbox into `document.body` (src/components/ui/Select.tsx:231,255): page-wide, not inside the region. */
const listbox = (page: Page) => page.getByRole('listbox');

test('SCR-23 · FL-23H-01 · rail một tab, mở lần đầu (chunk muộn, 0 API), trạng thái rỗng, đóng bằng tab', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 35_000));
  await withQ1(browser, '23h-01', async ({ page }, floor) => {
    const net = netlog(page);
    let firstOpenJs: string[] = [];

    await test.step('[23H-A-001] rail "Bảng phụ" holds exactly one button "Lịch sử thao tác"', async () => {
      await openPascal(page, floor.projectId);
      await expect(rail(page), 'PV:99-117').toBeVisible();
      await expect(rail(page).getByRole('button')).toHaveCount(1);
      await expect(historyTab(page)).toBeVisible();
      await captureEvidence(page, 'E05_23H-A-001_rail-one-tab.png');
    });

    await test.step('[23H-A-002] on arrival the tab is closed', async () => {
      await expect.soft(historyTab(page), 'PV:105-115').toHaveAttribute('aria-expanded', 'false');
      await expect.soft(historyRegion(page)).toHaveCount(0);
      await captureEvidence(page, 'E05_23H-A-002_tab-closed.png');
    });

    let mark = 0;
    await test.step('[23H-A-003] click the tab → panel opens, region 344 px wide', async () => {
      mark = net.mark();
      await historyTab(page).click();
      await expect.soft(historyTab(page)).toHaveAttribute('aria-expanded', 'true');
      await expect.soft(historyRegion(page)).toBeVisible();
      const width = (await historyRegion(page).boundingBox())?.width ?? 0;
      expect.soft(width, 'PVT:191 PASCAL_SIDE_PANEL_WIDTH_PX').toBeCloseTo(344, 0);
      await captureEvidence(page, 'E05_23H-A-003_panel-open.png', { caption: `region width ${width.toFixed(1)} px` });
    });

    await test.step('[23H-A-004] Suspense fallback, then the panel body (data-testid history-panel)', async () => {
      // "Đang mở bảng…" may only flash (PVC:287); the mocked flow FL-23H-05 holds it. Here: the body arrives.
      await expect.soft(historyPanel(page), 'HP:133-149 data-testid history-panel').toBeVisible({ timeout: 15_000 });
      // At lg+ the body is an unnamed <section> inside the one region "Lịch sử thao tác" (HistoryPanel.tsx:97, FA).
      expect.soft(await historyPanel(page).evaluate((el) => el.tagName), 'panel body is a <section>').toBe('SECTION');
      await expect.soft(historyRegion(page).getByTestId(H.testId)).toBeVisible();
      await expect.soft(historyRegion(page).getByText(T.panelFallback, { exact: true })).toHaveCount(0);
      firstOpenJs = jsCalls(net.since(mark));
      await captureEvidence(page, 'E05_23H-A-004_panel-body.png');
    });

    await test.step('[23H-G-001] opening the panel sends no /api/ request', async () => {
      const calls = apiCalls(net.since(mark));
      expect.soft(calls, 'HPG:216-221 "Không một lượt gọi mạng nào"').toEqual([]);
      await attachJson('E05_23H-G-001_no-api.json', { apiCallsBetweenClickAndBody: calls });
      await captureEvidence(page, 'E05_23H-G-001_no-api.png', { caption: `/api/ requests between the click and the body: ${String(calls.length)}` });
    });

    await test.step('[23H-B-002] empty state "Chưa có bước nào" + its description', async () => {
      await expect.soft(historyPanel(page).getByText(H.emptyTitle, { exact: true }), 'HPCH:56-58').toBeVisible();
      await expect.soft(historyPanel(page).getByText(H.emptyText, { exact: true })).toBeVisible();
      await expect.soft(page.getByTestId('history-panel-empty')).toBeVisible();
      await captureEvidence(page, 'E05_23H-B-002_empty.png');
    });

    await test.step('[23H-B-003] no part of the other states', async () => {
      const panel = historyPanel(page);
      await expect.soft(panel.getByRole('region', { name: H.timeline, exact: true }), 'HP:133-149').toHaveCount(0);
      await expect.soft(panel.getByText(H.stepLimit, { exact: true })).toHaveCount(0);
      await expect.soft(panel.getByRole('button', { name: H.loadMore, exact: true })).toHaveCount(0);
      await expect.soft(panel.getByText(H.forbiddenTitle, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E05_23H-B-003_no-other-state.png');
    });

    await test.step('[23H-C-001] default filters: "Tất cả" pressed, combobox shows "Mọi người"', async () => {
      await expect.soft(chip(page, 'Tất cả'), 'UHP:105').toHaveAttribute('aria-pressed', 'true');
      await expect.soft(actorCombo(page), 'HPCH:192').toContainText(H.actorAll);
      await captureEvidence(page, 'E05_23H-C-001_default-filters.png');
    });

    await test.step('[23H-C-002] exactly four chips, in order, no "Nhập xuất"', async () => {
      const labels = await page.getByRole('group', { name: H.chipsGroup, exact: true }).getByRole('button').allInnerTexts();
      expect.soft(labels.map((l) => l.trim()), 'HPTY:88-101').toEqual([...H.chips]);
      await captureEvidence(page, 'E05_23H-C-002_four-chips.png', { caption: `chips: ${labels.join(' | ')}` });
    });

    await test.step('[23H-A-005] click the open tab → closes', async () => {
      await historyTab(page).click();
      await expect.soft(historyTab(page), 'PV:110').toHaveAttribute('aria-expanded', 'false');
      await expect.soft(historyRegion(page)).toHaveCount(0);
      await captureEvidence(page, 'E05_23H-A-005_closed-by-tab.png');
    });

    await test.step('[23H-G-002] the panel chunk loads on the first open only', async () => {
      const again = net.mark();
      await historyTab(page).click();
      await expect(historyPanel(page)).toBeVisible();
      const secondOpenJs = jsCalls(net.since(again));
      expect.soft(firstOpenJs.length, 'PVC:60-70 lazy chunk on the first open').toBeGreaterThan(0);
      expect.soft(secondOpenJs, 'no new JS on the second open').toEqual([]);
      await attachJson('E05_23H-G-002_chunks.json', { firstOpenJs, secondOpenJs });
      await captureEvidence(page, 'E05_23H-G-002_chunk-once.png', { caption: `JS on open 1: ${String(firstOpenJs.length)}, open 2: ${String(secondOpenJs.length)}` });
    });
  });
});

test('SCR-23 · FL-23H-02 · phím và bộ lọc: Ctrl+H, chip, combobox người, Esc nhiều lớp', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 45_000));
  await withQ1(browser, '23h-02', async ({ page }, floor) => {
    const net = netlog(page);
    await openPascal(page, floor.projectId);

    await test.step('[23H-A-008] Ctrl+H (focus on body) opens the panel', async () => {
      await blurAll(page);
      await page.keyboard.press('Control+h'); // PVC:314-321 scope canvas
      await expect(historyTab(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(historyRegion(page)).toBeVisible();
      await expect(historyPanel(page)).toBeVisible();
      await captureEvidence(page, 'E05_23H-A-008_ctrl-h-open.png');
    });

    await test.step('[23H-E-001] rail semantics: role=group "Bảng phụ", tab is a button with aria-expanded', async () => {
      await expect.soft(page.locator('[role="group"][aria-label="Bảng phụ"]'), 'PV:99-103').toHaveCount(1);
      expect.soft(await historyTab(page).evaluate((el) => el.tagName), 'a real <button>').toBe('BUTTON');
      await expect.soft(historyTab(page)).toHaveAttribute('aria-expanded', 'true');
      await captureEvidence(page, 'E05_23H-E-001_rail-semantics.png');
    });

    await test.step('[23H-E-002] ⚑ one name for one panel (outer region and inner section)', async () => {
      const outer = await historyRegion(page).getAttribute('aria-label');
      const inner = await historyPanel(page).getAttribute('aria-label');
      // Landmark names in the panel cluster: the region itself + every named section/region inside it. Any fix is fine as long
      // as one panel carries one name. Was: region "Lịch sử thao tác" (PV:122) wrapping section "Lịch sử chỉnh sửa"; FA dropped the inner name.
      const names = await historyRegion(page).evaluate((el) =>
        [el, ...el.querySelectorAll('section[aria-label], [role="region"][aria-label]')].map((n) => n.getAttribute('aria-label') ?? ''),
      );
      expect.soft(new Set(names.filter((n) => n !== '')).size, `landmark names: ${JSON.stringify(names)}`).toBeLessThanOrEqual(1);
      await captureEvidence(page, 'E05_23H-E-002_two-names.png', { caption: `region "${outer ?? ''}" › section "${inner ?? ''}"` });
    });

    await test.step('[23H-E-003] chip group role=group "Lọc theo loại việc"', async () => {
      await expect.soft(page.getByRole('group', { name: H.chipsGroup, exact: true }), 'HPCH:52,135-139').toBeVisible();
      await captureEvidence(page, 'E05_23H-E-003_chip-group.png');
    });

    let chipMark = 0;
    await test.step('[23H-A-011] chip "Chỉnh sửa" → pressed, "Tất cả" not; still "Chưa có bước nào"', async () => {
      chipMark = net.mark();
      await chip(page, 'Chỉnh sửa').click();
      await expect.soft(chip(page, 'Chỉnh sửa'), 'HPCH:128-166').toHaveAttribute('aria-pressed', 'true');
      await expect.soft(chip(page, 'Tất cả')).toHaveAttribute('aria-pressed', 'false');
      await expect.soft(historyPanel(page).getByText(H.emptyTitle, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E05_23H-A-011_chip-edit.png');
    });

    await test.step('[23H-A-012] "Duyệt" → "AI" → "Tất cả": exactly one chip pressed each time', async () => {
      const pressed = async (): Promise<string[]> =>
        page.getByRole('group', { name: H.chipsGroup, exact: true }).locator('button[aria-pressed="true"]').allInnerTexts();
      for (const label of ['Duyệt', 'AI', 'Tất cả']) {
        await chip(page, label).click();
        await expect.soft(chip(page, label)).toHaveAttribute('aria-pressed', 'true');
        expect.soft((await pressed()).map((t) => t.trim()), `after "${label}" (HPCH:141-163)`).toEqual([label]);
      }
      await captureEvidence(page, 'E05_23H-A-012_one-pressed.png');
    });

    await test.step('[23H-G-003] chip clicks send no request', async () => {
      const sent = apiCalls(net.since(chipMark));
      expect.soft(sent, 'UHP:356-362 filters are local').toEqual([]);
      await captureEvidence(page, 'E05_23H-G-003_chips-no-request.png', { caption: `requests during the chip clicks: ${String(sent.length)}` });
    });

    await test.step('[23H-E-005] Enter / Space on a focused chip selects it', async () => {
      await chip(page, 'Duyệt').focus();
      await page.keyboard.press('Enter');
      await expect.soft(chip(page, 'Duyệt'), 'HPCH:145-158 <button type=button>').toHaveAttribute('aria-pressed', 'true');
      await chip(page, 'AI').focus();
      await page.keyboard.press('Space');
      await expect.soft(chip(page, 'AI')).toHaveAttribute('aria-pressed', 'true');
      await captureEvidence(page, 'E05_23H-E-005_keyboard-select.png');
    });

    await test.step('[23H-E-006] keyboard focus ring on a chip is visible', async () => {
      await page.keyboard.press('Shift+Tab'); // AI → Duyệt by keyboard: :focus-visible applies
      const focused = chip(page, 'Duyệt');
      await expect.soft(focused).toBeFocused();
      const shadow = await focused.evaluate((el) => getComputedStyle(el).boxShadow);
      expect.soft(shadow, 'HPCH:108-110 focus-visible:ring-2 ring-accent ring-offset-2').not.toBe('none');
      await captureEvidence(page, 'E05_23H-E-006_focus-ring.png', { caption: `box-shadow: ${shadow}` });
    });

    await test.step('[23H-E-004] Tab order: tab → "Tất cả" → "Chỉnh sửa" → "Duyệt" → "AI" → combobox', async () => {
      await historyTab(page).focus();
      const order: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        await page.keyboard.press('Tab');
        order.push(await activeLabel(page));
      }
      expect.soft(order, 'PV:98-128, HPCH:199-215').toEqual([...H.chips, 'combobox']);
      await captureEvidence(page, 'E05_23H-E-004_tab-order.png', { caption: `Tab order: ${order.join(' → ')}` });
    });

    await test.step('[23H-E-007] person combobox: label, aria-haspopup=listbox, ArrowDown opens', async () => {
      const combo = actorCombo(page);
      await expect.soft(combo, 'SEL:132-141').toHaveAttribute('aria-haspopup', 'listbox');
      await expect.soft(combo).toHaveAttribute('aria-expanded', 'false');
      await combo.focus();
      await page.keyboard.press('ArrowDown');
      await expect.soft(combo).toHaveAttribute('aria-expanded', 'true');
      await captureEvidence(page, 'E05_23H-E-007_combobox-open.png');
    });

    await test.step('[23H-A-013] listbox has exactly one option "Mọi người"', async () => {
      await expect.soft(listbox(page).getByRole('option'), 'HPCH:176-196 people = 0').toHaveCount(1);
      await expect.soft(listbox(page).getByRole('option', { name: H.actorAll })).toBeVisible();
      await captureEvidence(page, 'E05_23H-A-013_one-option.png');
    });

    await test.step('[23H-A-014] Esc in the listbox closes only the listbox', async () => {
      await expect(listbox(page), 'mốc: the listbox is open before Esc').toBeVisible();
      await page.keyboard.press('Escape');
      await expect.soft(listbox(page), 'USEL:51-57 stopPropagation (BUG-152)').toHaveCount(0);
      await expect.soft(historyRegion(page)).toBeVisible();
      await expect.soft(historyTab(page)).toHaveAttribute('aria-expanded', 'true');
      await captureEvidence(page, 'E05_23H-A-014_esc-listbox.png');
    });

    await test.step('[23H-E-008] Esc with focus on a chip closes the panel', async () => {
      await chip(page, 'Tất cả').focus();
      await page.keyboard.press('Escape'); // REG:505-507 a chip is not a text field → PVC:301-310
      await expect.soft(historyRegion(page)).toHaveCount(0);
      await expect.soft(historyTab(page)).toHaveAttribute('aria-expanded', 'false');
      await captureEvidence(page, 'E05_23H-E-008_esc-chip.png');
    });

    await test.step('[23H-A-009] ⚑ Ctrl+H opens, Ctrl+H again closes ("Mở hoặc đóng bảng lịch sử thao tác")', async () => {
      await blurAll(page);
      await page.keyboard.press('Control+h');
      await expect(historyRegion(page)).toBeVisible();
      await expect(historyPanel(page)).toBeVisible();
      await page.keyboard.press('Control+h');
      // Source today: the panel registers mod+h at scope sidePanel (UHP:382-388), which beats canvas (REG:59-64) → stays open.
      await expect.soft(historyTab(page)).toHaveAttribute('aria-expanded', 'false');
      await expect.soft(historyRegion(page)).toHaveCount(0);
      await captureEvidence(page, 'E05_23H-A-009_ctrl-h-twice.png');
    });
  });
});

test('SCR-23 · FL-23H-03 · Esc thu khung, đặt lại bộ lọc, reload, tách tầng, ⚑ lượt sửa Pascal vào lịch sử', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 70_000));
  await withQ1(browser, '23h-03', async ({ page }, floor) => {
    const pid = floor.projectId;
    await openPascal(page, pid);

    await test.step('[23H-A-006] panel open, Esc → panel closes, the frame does not collapse', async () => {
      await historyTab(page).click();
      await expect(historyPanel(page)).toBeVisible();
      await blurAll(page);
      await page.keyboard.press('Escape'); // PVC:301-310 sidePanel > canvas (REG:59-64)
      await expect(historyRegion(page)).toHaveCount(0);
      await expect(canvasBox(page)).toBeVisible();
      await expect(page.getByRole('heading', { name: T.collapsedTitle, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E05_23H-A-006_esc-closes-panel.png');
    });

    await test.step('[23H-A-007] second Esc collapses (no rail); E re-opens, tab still closed', async () => {
      await page.keyboard.press('Escape');
      await expect.soft(page.getByRole('heading', { name: T.collapsedTitle, exact: true }), 'UPV:508-538').toBeVisible();
      await expect.soft(rail(page)).toHaveCount(0);
      await captureEvidence(page, 'E05_23H-A-007_collapsed.png');
      await page.keyboard.press('e');
      await expect.soft(rail(page)).toBeVisible();
      await expect.soft(historyTab(page)).toHaveAttribute('aria-expanded', 'false');
    });

    await test.step('[23H-A-015] chip "AI", close, re-open → filters back to "Tất cả"', async () => {
      await historyTab(page).click();
      await chip(page, 'AI').click();
      await expect(chip(page, 'AI')).toHaveAttribute('aria-pressed', 'true');
      await historyTab(page).click();
      await historyTab(page).click();
      await expect.soft(chip(page, 'Tất cả'), 'PV:120 unmount on close; UHP:105').toHaveAttribute('aria-pressed', 'true');
      await captureEvidence(page, 'E05_23H-A-015_filters-reset.png');
    });

    await test.step('[23H-A-018] panel open, reload → tab closed', async () => {
      await expect(historyRegion(page)).toBeVisible();
      await page.reload();
      await expect(rail(page)).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      await expect.soft(historyTab(page), 'PVC:279 local state').toHaveAttribute('aria-expanded', 'false');
      await captureEvidence(page, 'E05_23H-A-018_reload-closed.png');
    });

    await test.step('[23H-A-017] /3d/exploded → ?view=exploded, the tab opens the panel', async () => {
      await page.goto(ROUTES.project.exploded(pid));
      await expect.poll(() => new URL(page.url()).searchParams.get('view'), { message: 'viewerRedirects.tsx:26-33' }).toBe('exploded');
      await expect(rail(page)).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      await historyTab(page).click();
      await expect.soft(historyRegion(page)).toBeVisible();
      await captureEvidence(page, 'E05_23H-A-017_exploded-panel.png');
    });

    await test.step('[23H-A-016] ⚑ a Pascal edit (PUT 200, "Đã lưu lúc …") shows up in the history timeline', async () => {
      await openPascal(page, pid);
      await pascalEditOnce(page, 'Bếp', 'Bếp 23H');
      await historyTab(page).click();
      await expect(historyPanel(page)).toBeVisible();
      // Source today: PVC:288 passes no `history` → HPG:225 builds an empty stack of its own; the real stack (UPE:124) is not exposed.
      await expect.soft(
        historyPanel(page).getByRole('region', { name: H.timeline, exact: true }).getByTestId(H.itemTestId).first(),
        '≥ 1 history-panel-item after one edit',
      ).toBeVisible();
      await expect.soft(historyPanel(page).getByText(H.emptyTitle, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E05_23H-A-016_edit-in-history.png');
    });
  });
});

test('SCR-23 · FL-23H-04 · vai và trạng thái không có cột bảng', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 75_000));
  const [floor] = await createQcProject(api, '23h-04');
  if (floor === undefined) throw new Error('setup: Q1 has no floor');
  const pid = floor.projectId;
  const owned = [pid];
  const sessions: Session[] = [];
  try {
    const p0 = await createProject(admin, '23h-04-p0', 1);
    owned.push(p0.projectId);
    const engineer = await poolUser(admin, 'engineer', 'p05-p2');
    const viewer = await poolUser(admin, 'viewer', 'p05-p2');
    const outsider = await poolUser(admin, 'admin', 'p05-p2-a2');
    await addProjectMember(admin, pid, engineer.email);
    await addProjectMember(admin, pid, viewer.email);
    const open = async (who: { email: string; password: string }): Promise<Page> => {
      const s = await openSession(browser, who);
      sessions.push(s);
      return s.page;
    };

    await test.step('[23H-D-001] engineer member opens the panel → empty like admin, no notice', async () => {
      const page = await open(engineer);
      await openPascal(page, pid);
      await historyTab(page).click();
      await expect(historyPanel(page).getByText(H.emptyTitle, { exact: true }), 'HPG:246; permissions.ts:64-66').toBeVisible();
      await expect(historyPanel(page).getByText(H.forbiddenTitle, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E05_23H-D-001_engineer-empty.png');
    });

    const viewerPage = await open(viewer);
    await test.step('[23H-D-002] viewer member: panel in `forbidden` with its notice; four chips stay', async () => {
      await openPascal(viewerPage, pid);
      await historyTab(viewerPage).click();
      await expect.soft(historyPanel(viewerPage).getByText(H.forbiddenTitle, { exact: true }), 'HPM:911-913').toBeVisible();
      await expect.soft(historyPanel(viewerPage).getByText(H.forbiddenText, { exact: true })).toBeVisible();
      await expect.soft(viewerPage.getByRole('group', { name: H.chipsGroup, exact: true }).getByRole('button')).toHaveCount(4);
      await captureEvidence(viewerPage, 'E05_23H-D-002_viewer-forbidden.png');
    });

    await test.step('[23H-D-003] ⚑ viewer, 0 steps: the body says there is no step (not a bare spine)', async () => {
      // A11 "no branch draws a blank screen" (HP:20-30); source today: forbidden takes the shared body (HP:151-183) → spine only.
      await expect.soft(historyPanel(viewerPage).getByText(/chưa có bước nào/iu).first()).toBeVisible();
      await captureEvidence(viewerPage, 'E05_23H-D-003_viewer-blank-body.png');
    });

    await test.step('[23H-D-004] admin outside the project → not found, no rail', async () => {
      const page = await open(outsider);
      await openPascal(page, pid, { wait: false });
      await expect.soft(page.getByRole('heading', { name: T.notFoundTitle }), 'PVC:396-405 (K08)').toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect.soft(rail(page)).toHaveCount(0);
      await captureEvidence(page, 'E05_23H-D-004_outsider-404.png');
    });

    const adminPage = await open(adminWho());
    await test.step('[23H-B-012] project without a layer (P0) → "Chưa có gì để dựng", no rail', async () => {
      await openPascal(adminPage, p0.projectId, { wait: false });
      await expect.soft(adminPage.getByRole('heading', { name: T.emptyTitle, exact: true }), 'PV:159-171').toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      await expect.soft(rail(adminPage), 'PV:269').toHaveCount(0);
      await captureEvidence(adminPage, 'E05_23H-B-012_empty-no-rail.png');
    });

    await test.step('[23H-B-015] unknown project id → not found, no rail', async () => {
      await openPascal(adminPage, randomUUID(), { wait: false });
      await expect.soft(adminPage.getByRole('heading', { name: T.notFoundTitle }), 'PVC:396-405').toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect.soft(rail(adminPage)).toHaveCount(0);
      await captureEvidence(adminPage, 'E05_23H-B-015_unknown-404.png');
    });
  } finally {
    for (const s of sessions) await closeSession(s);
    await cleanupProjects(api, owned);
  }
});
