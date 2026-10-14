/**
 * Phase 5 — SCR-23 side panels "Diện tích phòng" + "Thư viện đồ đạc" of `/projects/:p/3d`, EDGE layer, real stack (QA-05c P3,
 * plan `flows-C2.md` "phase05_panels_a_edge.spec.ts": 14 flows, 143 steps). One `test()` per flow on its own seed, one
 * `test.step('[<row id>] …')` per catalog row in plan order; H rows use a hard `expect`, S rows `expect.soft`; each step shoots
 * `E05_<row id>_<slug>.png`. ⚑ steps assert the CORRECT behaviour (catalog-C2 Notes) and stay red while the bug is there.
 *
 * Since F-15 both panels are Pascal's vendor copies in the editor's icon rail (catalog-C2 "Phát hiện phạm vi"): AppFront's own
 * "Bảng phụ" column only holds "Lịch sử thao tác". Copy, selectors and file:line live in `support/p05/P3.ts` (RA, FL, PV, SAVE).
 *
 * Non-serial (`--workers 4`): every flow opens its own admin context from the stored state and seeds its own run-unique project
 * (`qa-<runId>-p3-…`), deleted in `finally`. No faked response here (the two mock rows are in `_mocked_edge`).
 * Writes on the real stack: own projects only (+ their layers); FL-23RF-02 changes the pool engineer `p05-panels-a-demote` to
 * viewer through #41 and back in `finally`.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login` (120 / 60 s per IP): 0 admin (stored session; 1 UI sign-in only if it is dead) + 1 viewer (FL-23RF-01)
 *   + 1 engineer (FL-23RF-02) = 2.
 * - `POST /api/users/invitations`: 0 when the two pool slots exist, else ≤ 2 (users_invite 30 / 3600 s).
 * - `POST /api/auth/refresh` (300 / 60 s): 2 per flow (session check + fixture Bearer) + 1 per page load (≈ 20) ≈ 50.
 * - `POST /api/projects` 14 + `DELETE` 14; seed #35 PUTs 1–4 per flow (≈ 30) + 1 W2 PUT; `POST …/members` 2; #41 PATCH 3.
 *   No rate limit on projects / layers / members (layerSeed.ts header).
 * - Screen #35 PUTs (renames, placement, replace-all): ≈ 20.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { captureEvidence } from './support/evidence';
import {
  FL,
  PV,
  RA,
  SAVE,
  SAVED_AT,
  blockedLine,
  canvasShot,
  chip,
  chipGroup,
  classToken,
  closeAdminSession,
  combo,
  detectedRow,
  detectedStrip,
  expand,
  expandToggle,
  externalRequests,
  floorOf,
  fullPage,
  fullRoomRows,
  groupLabels,
  groupRows,
  groupSubtotal,
  historyRegion,
  itemCount,
  layerIdle,
  layerPutWith,
  layerPuts,
  nextLayerPut,
  nonGetUnderProjects,
  openAdminSession,
  openMemberSession,
  openPascal,
  openRailPanel,
  panelOf,
  panelTotal,
  pascalRoot,
  previewDialog,
  putRoomNames,
  railButton,
  readClipboard,
  renameBand,
  renameInput,
  renameRoom,
  replaceButton,
  roomArea,
  roomButton,
  roomDot,
  roomNames,
  roomRow,
  roomSubline,
  saveLine,
  searchBox,
  seedFX,
  seedQ1,
  seedRA1,
  seedRA2,
  seedRA3,
  selectedTileCount,
  setRole,
  sideRail,
  siteButton,
  softly,
  tile,
  tileNames,
  tiles,
  toast,
  tooltip,
  touchLayer,
  undoButton,
  undoOnCanvas,
  type AdminSession,
  type MemberSession,
} from './support/p05/P3';

/** Pool slots of this pack (brief: `p05-panels-a*`); the demote slot is the only one whose role changes. */
const VIEWER_SLOT = 'p05-panels-a';
const DEMOTE_SLOT = 'p05-panels-a-demote';

const shot = (page: Page, id: string, slug: string, caption?: string): Promise<string> =>
  captureEvidence(page, `E05_${id}_${slug}.png`, caption === undefined ? {} : { caption });

/** `{ group label: room names }` of the panel as shown. */
async function rowsByGroup(panel: Locator): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const label of await groupLabels(panel)) out[label] = await groupRows(panel, label);
  return out;
}

const tsvLines = async (page: Page): Promise<string[]> => (await readClipboard(page)).split(/\r?\n/u);
const countOf = async (panel: Locator): Promise<number> => Number.parseInt((await itemCount(panel).textContent()) ?? '', 10);

/** Middle of the part of Pascal's canvas not under the sidebar panel (`panel` = an open rail panel). */
async function canvasFloorPoint(page: Page, panel: Locator): Promise<{ x: number; y: number }> {
  const canvas = await page.getByTestId('pascal-canvas').locator('canvas').first().boundingBox();
  const side = await panel.boundingBox();
  if (canvas === null || side === null) throw new Error('canvas / panel has no box');
  const left = Math.max(canvas.x, side.x + side.width);
  return { x: (left + canvas.x + canvas.width) / 2, y: canvas.y + canvas.height / 2 };
}

test.describe('E05 SCR-23 side panels A — Diện tích phòng / Thư viện đồ đạc (QA-05c P3, real stack)', () => {
  /* ======================================================================== FL-23R-01 */
  test('SCR-23 · FL-23R-01 · thanh icon + khung bảng Diện tích phòng', async ({ browser }) => {
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page } = s;
      const seeded = await seedQ1(s, 'p3-r01');
      await openPascal(page, seeded.projectId);
      const panel = panelOf(page, RA.title);
      const heading = pascalRoot(page).getByRole('heading', { level: 2, name: RA.title, exact: true });
      let ruler!: Locator;

      await test.step('[23R-A-001] hover the ruler in Pascal\'s icon rail → tooltip "Diện tích phòng"; click → h2 "Diện tích phòng"', async () => {
        ruler = await railButton(page, RA.title); // APN:26-29, IR:55-80
        await expect(tooltip(page).filter({ hasText: RA.title }).first()).toHaveText(RA.title);
        await ruler.click();
        await expect(heading).toBeVisible();
        await shot(page, '23R-A-001', 'rail-open');
      });

      await test.step('[23R-E-001] ⚑ the rail button has an accessible name (IR:58-79: svg only, label only in the tooltip)', async () => {
        await expect.soft(pascalRoot(page).getByRole('button', { name: RA.title, exact: true })).toHaveCount(1);
        await shot(page, '23R-E-001', 'rail-name');
      });

      await test.step('[23R-E-002] the tooltip also shows on keyboard focus, not only on hover', async () => {
        await heading.hover();
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await expect(tooltip(page)).toHaveCount(0);
        await ruler.focus();
        await expect.soft(tooltip(page).filter({ hasText: RA.title }).first()).toHaveText(RA.title);
        await shot(page, '23R-E-002', 'focus-tooltip');
      });

      await test.step('[23R-E-012] "Site" closes the panel; Tab to the ruler + Enter opens it again (IR:60-66)', async () => {
        await siteButton(page).click();
        await expect.soft(heading).toHaveCount(0);
        await page.keyboard.press('Tab');
        await expect.soft(ruler).toBeFocused();
        await page.keyboard.press('Enter');
        await expect.soft(heading).toBeVisible();
        await shot(page, '23R-E-012', 'keyboard-open');
      });

      await test.step('[23R-A-002] the open button has `bg-accent`; "Site" closes, the ruler reopens (IR:56-64, AS:41-46)', async () => {
        await expect.soft(ruler).toHaveClass(classToken('bg-accent'));
        await siteButton(page).click();
        await expect.soft(heading).toHaveCount(0);
        await ruler.click();
        await expect.soft(heading).toBeVisible();
        await shot(page, '23R-A-002', 'active-button');
      });

      await test.step('[23R-A-003] AppFront\'s "Bảng phụ" column has only "Lịch sử thao tác" (PV:99-117, PVC:281-295)', async () => {
        // Button.tsx:60-72 doubles the label in an aria-hidden copy: check the accessible name, not textContent (E1-T12).
        await expect.soft(sideRail(page).getByRole('button')).toHaveCount(1);
        await expect.soft(sideRail(page).getByRole('button')).toHaveAccessibleName(PV.history);
        await shot(page, '23R-A-003', 'appfront-rail');
      });

      await test.step('[23R-A-004] opening "Lịch sử thao tác" keeps the Pascal panel open (two independent rails)', async () => {
        await sideRail(page).getByRole('button', { name: PV.history, exact: true }).click();
        await expect.soft(historyRegion(page)).toBeVisible();
        await expect.soft(heading).toBeVisible();
        await shot(page, '23R-A-004', 'both-open');
      });

      await test.step('[23R-E-003] header buttons are named "Sao chép bảng", "Mở toàn trang", "Bảng toàn trang" (RAP:205-231)', async () => {
        for (const name of [RA.copyTable, RA.openFullPage, RA.fullTable]) {
          await expect.soft(panel.getByRole('button', { name, exact: true }), name).toHaveCount(1);
        }
        await shot(page, '23R-E-003', 'header-buttons');
      });

      await test.step('[23R-E-007] the selects are labelled "Nhóm theo", "Sắp xếp", "Lọc tầng" (RAP:276-316)', async () => {
        for (const name of [RA.groupBy, RA.sortBy, RA.levelFilter]) await expect.soft(combo(panel, name), name).toHaveCount(1);
        await shot(page, '23R-E-007', 'select-labels');
      });

      await test.step('[23R-B-011] footer: "Chú giải", the three status labels and the area formula (RAP:470-480)', async () => {
        const footer = panel.locator('footer');
        for (const text of [RA.statusLegend, RA.statusTrusted, RA.statusSuspect, RA.statusReviewed, RA.areaFormula]) {
          await expect.soft(footer, text).toContainText(text);
        }
        await shot(page, '23R-B-011', 'footer');
      });

      await test.step('[23R-C-005] only `room` zones are rows: exactly "Bếp", "PHONG NGU 2" (RAM:144-147)', async () => {
        await softly.poll(async () => (await roomNames(panel)).sort()).toEqual(['Bếp', 'PHONG NGU 2'].sort());
        await shot(page, '23R-C-005', 'two-rows');
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23R-02 */
  test('SCR-23 · FL-23R-02 · hàng phòng Q1: dòng phụ, chọn/rê, sao chép, công năng', async ({ browser }) => {
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser, { clipboard: true });
      const { page } = s;
      const seeded = await seedQ1(s, 'p3-r02');
      await openPascal(page, seeded.projectId);
      const panel = await openRailPanel(page, RA.title);
      let canvasBefore = Buffer.alloc(0);

      await test.step('[23R-A-018] Bếp sub-line starts "1 cửa · 1 cửa sổ · Chu vi 20 m" (RAP:422-425, RAM:116-133)', async () => {
        await expect(roomSubline(panel, 'Bếp')).toHaveText(/^1 cửa · 1 cửa sổ · Chu vi 20 m/u);
        await shot(page, '23R-A-018', 'bep-subline');
      });

      await test.step('[23R-A-019] PHONG NGU 2 sub-line starts "0 cửa · 0 cửa sổ · Chu vi 20 m"', async () => {
        await expect.soft(roomSubline(panel, 'PHONG NGU 2')).toHaveText(/^0 cửa · 0 cửa sổ · Chu vi 20 m/u);
        await shot(page, '23R-A-019', 'pn2-subline');
      });

      await test.step('[23R-A-020] ⚑ ceiling height follows the 3000 mm floor: "Chiều cao 3 m" (TP:327-339 writes no ceilingHeight)', async () => {
        await expect.soft(roomSubline(panel, 'Bếp')).toHaveText(/Chiều cao 3 m$/u);
        await shot(page, '23R-A-020', 'ceiling-height');
      });

      await test.step('[23R-E-005] ⚑ the status dot has a readable name (role img / hidden text; RAP:64-71 aria-label on a bare span)', async () => {
        await expect.soft(roomRow(panel, 'Bếp').getByRole('img', { name: RA.statusTrusted })).toHaveCount(1);
        await shot(page, '23R-E-005', 'dot-name');
      });

      await test.step('[23R-A-021] clicking "Bếp" selects the row: `bg-accent` (RAP:124-130, 372)', async () => {
        canvasBefore = await canvasShot(page);
        await roomButton(panel, 'Bếp').click();
        await expect.soft(roomRow(panel, 'Bếp')).toHaveClass(classToken('bg-accent'));
        await shot(page, '23R-A-021', 'row-selected');
      });

      await test.step('[23R-A-022] the click frames the camera on the room: canvas pixels change (RAP:127 camera-controls:focus)', async () => {
        await softly.poll(async () => !(await canvasShot(page)).equals(canvasBefore), { timeout: 10_000 }).toBe(true);
        await shot(page, '23R-A-022', 'camera-framed');
      });

      await test.step('[23R-A-023] hovering PHONG NGU 2 gives `bg-accent/60`, leaving removes it (RAP:371, 374-375)', async () => {
        await roomRow(panel, 'PHONG NGU 2').hover();
        await expect.soft(roomRow(panel, 'PHONG NGU 2')).toHaveClass(classToken('bg-accent/60'));
        await shot(page, '23R-A-023', 'row-hover');
        await panel.locator('h2').hover();
        await expect.soft(roomRow(panel, 'PHONG NGU 2')).not.toHaveClass(classToken('bg-accent/60'));
      });

      await test.step('[23R-A-040] "Sao chép bảng" → 6-line TSV (catalog oracle), button title "Đã sao chép bảng" (RAM:319-331)', async () => {
        const copy = panel.getByRole('button', { name: RA.copyTable, exact: true });
        await copy.click();
        await expect.soft(copy).toHaveAttribute('title', RA.copied);
        const lines = await tsvLines(page);
        expect.soft(lines, 'TSV line count').toHaveLength(6);
        expect.soft(lines[0]).toBe('Số phòng\tTên phòng\tCông năng\tDiện tích');
        expect.soft(lines[1]).toBe('Tầng 1');
        // Equal areas keep scene order, which the plan does not pin: compare the two room lines as a set.
        expect.soft(lines.slice(2, 4).sort()).toEqual(['—\tBếp\t—\t16 m²', '—\tPHONG NGU 2\t—\t16 m²'].sort());
        expect.soft(lines[4]).toBe('Tổng phụ\t\t\t32 m²');
        expect.soft(lines[5]).toBe('Tổng diện tích\t\t\t32 m²');
        await shot(page, '23R-A-040', 'copied', `clipboard: ${lines.join(' ⏎ ').replace(/\t/gu, '⇥')}`);
      });

      await test.step('[23R-E-004] ⚑ "copied" is announced: a `role=status` with "Đã sao chép bảng" (RAP:209 only swaps `title`)', async () => {
        await expect.soft(page.getByRole('status').filter({ hasText: RA.copied })).toHaveCount(1);
        await shot(page, '23R-E-004', 'copied-status');
      });

      await test.step('[23R-B-012] one occupancy band, title "Chưa đặt công năng · 100%" (RAM:217-242)', async () => {
        await expect.soft(panel.locator('[title$="%"]')).toHaveCount(1);
        await expect.soft(panel.locator(`[title="${RA.noOccupancy} · 100%"]`)).toHaveCount(1);
        await shot(page, '23R-B-012', 'band');
      });

      await test.step('[23R-A-014] ⚑ "Nhóm theo" = "Công năng" splits by room usage: ≥ 2 groups, not only "Chưa đặt công năng"', async () => {
        await combo(panel, RA.groupBy).selectOption({ label: RA.groupByOccupancy });
        await expect.soft(combo(panel, RA.groupBy)).toHaveValue('occupancy');
        await softly.poll(async () => (await groupLabels(panel)).length, { message: 'occupancy groups' }).toBeGreaterThanOrEqual(2);
        await softly.poll(() => groupLabels(panel)).not.toEqual([RA.noOccupancy]);
        await shot(page, '23R-A-014', 'group-occupancy');
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23R-03 */
  test('SCR-23 · FL-23R-03 · RA1: thu gọn → mở rộng, sắp xếp, tổng (oracle)', async ({ browser }) => {
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser, { clipboard: true });
      const { page } = s;
      const seeded = await seedRA1(s, 'p3-r03');
      await openPascal(page, seeded.projectId);
      const panel = await openRailPanel(page, RA.title);
      const sort = combo(panel, RA.sortBy);

      await test.step('[23R-A-005] collapsed by default: "5 phòng lớn nhất"; rows Phòng khách, Bếp, Ăn | Phòng ngủ 1, Phòng chữ L', async () => {
        await expect(panel.getByText(RA.collapsedHint, { exact: true })).toBeVisible();
        await expect
          .poll(() => rowsByGroup(panel))
          .toEqual({ 'Tầng 1': ['Phòng khách', 'Bếp', 'Ăn'], 'Tầng 2': ['Phòng ngủ 1', 'Phòng chữ L'] });
        await shot(page, '23R-A-005', 'collapsed');
      });

      await test.step('[23R-A-006] collapsed total "72,75 m²" (24 + 18 + 12,5 + 12 + 6,25)', async () => {
        await expect.soft(panelTotal(panel)).toHaveText('72,75 m²');
        await shot(page, '23R-A-006', 'collapsed-total');
      });

      await test.step('[23R-A-009] collapsed subtotals count shown rows only: "Tổng phụ 42,75 m²", "Tổng phụ 30 m²"', async () => {
        await expect.soft(groupSubtotal(panel, 'Tầng 1')).toHaveText('Tổng phụ 42,75 m²');
        await expect.soft(groupSubtotal(panel, 'Tầng 2')).toHaveText('Tổng phụ 30 m²');
        await shot(page, '23R-A-009', 'collapsed-subtotals');
      });

      await test.step('[23R-A-013] "Tên phòng" while collapsed: still the 5 largest, by name — Ăn, Bếp, Phòng khách | Phòng chữ L, Phòng ngủ 1', async () => {
        await sort.selectOption({ label: RA.sortName });
        await softly
          .poll(() => rowsByGroup(panel))
          .toEqual({ 'Tầng 1': ['Ăn', 'Bếp', 'Phòng khách'], 'Tầng 2': ['Phòng chữ L', 'Phòng ngủ 1'] });
        await shot(page, '23R-A-013', 'collapsed-by-name');
      });

      await test.step('[23R-A-041] copy while collapsed: no WC / Kho / Ban công line; last line "Tổng diện tích⇥⇥⇥72,75 m²"', async () => {
        const copy = panel.getByRole('button', { name: RA.copyTable, exact: true });
        await copy.click();
        await expect.soft(copy).toHaveAttribute('title', RA.copied);
        const lines = await tsvLines(page);
        const names = lines.map((line) => line.split('\t')[1]);
        for (const hidden of ['WC', 'Kho', 'Ban công']) expect.soft(names, `no "${hidden}" line`).not.toContain(hidden);
        expect.soft(lines.at(-1)).toBe('Tổng diện tích\t\t\t72,75 m²');
        await shot(page, '23R-A-041', 'copy-collapsed', `clipboard: ${lines.join(' ⏎ ').replace(/\t/gu, '⇥')}`);
      });

      await test.step('[23R-A-007] "Bảng toàn trang" expands in place: 8 rows, hint gone, button "Thu gọn", total "80,08 m²"', async () => {
        await expandToggle(panel).click();
        await softly.poll(async () => (await roomNames(panel)).length).toBe(8);
        await expect.soft(panel.getByText(RA.collapsedHint, { exact: true })).toHaveCount(0);
        await expect.soft(panel.getByRole('button', { name: RA.collapsed, exact: true })).toBeVisible();
        await expect.soft(panelTotal(panel)).toHaveText('80,08 m²');
        await shot(page, '23R-A-007', 'expanded');
      });

      await test.step('[23R-A-008] expanded subtotals "Tổng phụ 46,75 m²" / "Tổng phụ 33,33 m²"', async () => {
        await expect.soft(groupSubtotal(panel, 'Tầng 1')).toHaveText('Tổng phụ 46,75 m²');
        await expect.soft(groupSubtotal(panel, 'Tầng 2')).toHaveText('Tổng phụ 33,33 m²');
        await shot(page, '23R-A-008', 'expanded-subtotals');
      });

      await test.step('[23R-C-003] the total sums unrounded areas: "80,08 m²" (46,75 + 33,333), not 46,75 + 33,33', async () => {
        await expect.soft(panelTotal(panel)).toHaveText('80,08 m²');
        await shot(page, '23R-C-003', 'unrounded-total');
      });

      await test.step('[23R-A-010] "Diện tích giảm dần": Phòng khách, Bếp, Ăn, WC, Kho | Phòng ngủ 1, Phòng chữ L, Ban công', async () => {
        await sort.selectOption({ label: RA.sortAreaDesc });
        await softly.poll(() => rowsByGroup(panel)).toEqual({
          'Tầng 1': ['Phòng khách', 'Bếp', 'Ăn', 'WC', 'Kho'],
          'Tầng 2': ['Phòng ngủ 1', 'Phòng chữ L', 'Ban công'],
        });
        await shot(page, '23R-A-010', 'area-desc');
      });

      await test.step('[23R-A-011] "Diện tích tăng dần": Kho, WC, Ăn, Bếp, Phòng khách | Ban công, Phòng chữ L, Phòng ngủ 1', async () => {
        await sort.selectOption({ label: RA.sortAreaAsc });
        await softly.poll(() => rowsByGroup(panel)).toEqual({
          'Tầng 1': ['Kho', 'WC', 'Ăn', 'Bếp', 'Phòng khách'],
          'Tầng 2': ['Ban công', 'Phòng chữ L', 'Phòng ngủ 1'],
        });
        await shot(page, '23R-A-011', 'area-asc');
      });

      await test.step('[23R-A-012] "Tên phòng" (localeCompare vi): Ăn, Bếp, Kho, Phòng khách, WC | Ban công, Phòng chữ L, Phòng ngủ 1', async () => {
        await sort.selectOption({ label: RA.sortName });
        await softly.poll(() => rowsByGroup(panel)).toEqual({
          'Tầng 1': ['Ăn', 'Bếp', 'Kho', 'Phòng khách', 'WC'],
          'Tầng 2': ['Ban công', 'Phòng chữ L', 'Phòng ngủ 1'],
        });
        await shot(page, '23R-A-012', 'by-name');
      });

      await test.step('[23R-C-001] L-shaped room: "12 m²", "Chu vi 16 m" (shoelace)', async () => {
        await expect.soft(roomArea(panel, 'Phòng chữ L')).toHaveText('12 m²');
        await expect.soft(roomSubline(panel, 'Phòng chữ L')).toContainText('Chu vi 16 m');
        await shot(page, '23R-C-001', 'l-shape');
      });

      await test.step('[23R-C-002] number format: "24 m²", "12,5 m²", "6,25 m²", "3,33 m²" (vi-VN, ≤ 2 decimals)', async () => {
        const areas = await panel.locator('section li > div > span.tabular-nums').allTextContents();
        for (const text of ['24 m²', '12,5 m²', '6,25 m²', '3,33 m²']) expect.soft(areas, text).toContain(text);
        await shot(page, '23R-C-002', 'number-format');
      });

      await test.step('[23R-B-009] status dots: WC "Máy đọc, cần soát", Kho "Người duyệt đã xác minh" (RV:55-58)', async () => {
        await expect.soft(roomDot(panel, 'WC')).toHaveAttribute('aria-label', RA.statusSuspect);
        await expect.soft(roomDot(panel, 'Kho')).toHaveAttribute('aria-label', RA.statusReviewed);
        await shot(page, '23R-B-009', 'status-dots');
      });

      await test.step('[23R-B-010] confidence 0,65 ≥ 0,6 → Ăn "Máy đọc, chưa soát" (RV:50)', async () => {
        await expect.soft(roomDot(panel, 'Ăn')).toHaveAttribute('aria-label', RA.statusTrusted);
        await shot(page, '23R-B-010', 'confidence-065');
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23R-04 */
  test('SCR-23 · FL-23R-04 · RA1: lọc tầng + mở bảng toàn trang', async ({ browser }) => {
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page } = s;
      const seeded = await seedRA1(s, 'p3-r04');
      await openPascal(page, seeded.projectId);
      const panel = await openRailPanel(page, RA.title);
      const filter = combo(panel, RA.levelFilter);
      const dialog = fullPage(page);

      await test.step('[23R-A-015] "Lọc tầng" offers "Mọi tầng", "Tầng 1", "Tầng 2" (RAP:302-316)', async () => {
        await expect(filter.locator('option')).toHaveText([RA.allLevels, 'Tầng 1', 'Tầng 2']);
        await shot(page, '23R-A-015', 'level-options');
      });

      await test.step('[23R-A-016] expanded, filter "Tầng 2": only group "Tầng 2", total "33,33 m²" (#75 filters the table only)', async () => {
        await expand(panel);
        await filter.selectOption({ label: 'Tầng 2' });
        await softly.poll(() => groupLabels(panel)).toEqual(['Tầng 2']);
        await expect.soft(panelTotal(panel)).toHaveText('33,33 m²');
        // UNKNOWN — NEED VERIFICATION: "tầng hoạt động của editor không đổi" — no DOM marker of Pascal's active level was
        // verified for this panel layout (the site panel that lists levels is closed while this panel is open).
        await shot(page, '23R-A-016', 'filter-t2');
      });

      await test.step('[23R-A-017] back to "Mọi tầng": two groups, "80,08 m²"', async () => {
        await filter.selectOption({ label: RA.allLevels });
        await softly.poll(() => groupLabels(panel)).toEqual(['Tầng 1', 'Tầng 2']);
        await expect.soft(panelTotal(panel)).toHaveText('80,08 m²');
        await shot(page, '23R-A-017', 'filter-all');
      });

      await test.step('[23R-A-042] "Mở toàn trang": dialog "Diện tích phòng", aria-modal, focus on "Đóng bảng toàn trang" (RAF:53-58, 191-193)', async () => {
        await panel.getByRole('button', { name: RA.openFullPage, exact: true }).click();
        await expect.soft(dialog).toBeVisible();
        await expect.soft(dialog).toHaveAttribute('aria-modal', 'true');
        await expect.soft(dialog.getByRole('button', { name: RA.closeFullTable, exact: true })).toBeFocused();
        await shot(page, '23R-A-042', 'full-page');
      });

      await test.step('[23R-B-016] ⚑ the dialog is styled: `position: fixed`, covers ≥ 90 % of the canvas box, opaque background', async () => {
        // RAF:207-208 portals to document.body, outside `.pascal-root` where Pascal's CSS is scoped (PR:1-9).
        const style = await dialog.evaluate((el) => {
          const css = getComputedStyle(el);
          return { position: css.position, background: css.backgroundColor };
        });
        expect.soft(style.position, 'dialog position').toBe('fixed');
        expect.soft(style.background, 'dialog background').not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/u);
        const [box, frame] = [await dialog.boundingBox(), await page.getByTestId('pascal-canvas').boundingBox()];
        const cover =
          box === null || frame === null
            ? 0
            : (Math.max(0, Math.min(box.x + box.width, frame.x + frame.width) - Math.max(box.x, frame.x)) *
                Math.max(0, Math.min(box.y + box.height, frame.y + frame.height) - Math.max(box.y, frame.y))) /
              (frame.width * frame.height);
        expect.soft(cover, 'share of the canvas box under the dialog').toBeGreaterThanOrEqual(0.9);
        await shot(page, '23R-B-016', 'dialog-styled', `position ${style.position}, background ${style.background}, cover ${cover.toFixed(2)}`);
      });

      await test.step('[23R-E-008] ⚑ focus stays in the dialog: 4 × Tab from its last control', async () => {
        await dialog.getByRole('button', { name: RA.column.area, exact: true }).focus();
        for (let tab = 1; tab <= 4; tab += 1) {
          await page.keyboard.press('Tab');
          expect.soft(await dialog.evaluate((el) => el.contains(document.activeElement)), `Tab ${String(tab)} stays in the dialog`).toBe(true);
        }
        await shot(page, '23R-E-008', 'focus-trap');
      });

      await test.step('[23R-A-043] every room even though the panel was collapsed before: 8 rows; tfoot "Tổng diện tích" "80,08 m²"', async () => {
        await expect.soft(fullRoomRows(dialog)).toHaveCount(8);
        await expect.soft(dialog.locator('tfoot')).toContainText(RA.total);
        await expect.soft(dialog.locator('tfoot td').last()).toHaveText('80,08 m²');
        await shot(page, '23R-A-043', 'all-rows');
      });

      await test.step('[23R-A-044] group header rows "Tầng 1"/"Tầng 2" and subtotal rows "46,75 m²"/"33,33 m²" (RAF:139-160)', async () => {
        await expect.soft(dialog.locator('th[scope="colgroup"]')).toHaveText(['Tầng 1', 'Tầng 2']);
        await expect.soft(dialog.locator('tbody tr:last-child td:first-child')).toHaveText([RA.subtotal, RA.subtotal]);
        await expect.soft(dialog.locator('tbody tr:last-child td:last-child')).toHaveText(['46,75 m²', '33,33 m²']);
        await shot(page, '23R-A-044', 'groups-subtotals');
      });

      await test.step('[23R-A-045] empty cells: "Số phòng" "—", "Công năng" "Chưa đặt công năng" (RAF:148-150)', async () => {
        const cells = fullRoomRows(dialog).first().locator('td');
        await expect.soft(cells.nth(0)).toHaveText('—');
        await expect.soft(cells.nth(2)).toHaveText(RA.noOccupancy);
        await shot(page, '23R-A-045', 'empty-cells');
      });

      await test.step('[23R-E-009] table semantics: 4 column headers, `aria-sort` on "Tên phòng" and "Diện tích" (RAF:106-137)', async () => {
        const headers = dialog.locator('thead').getByRole('columnheader');
        await expect.soft(headers).toHaveCount(4);
        await expect.soft(headers.nth(1)).toHaveAttribute('aria-sort', /^(ascending|descending|none)$/u);
        await expect.soft(headers.nth(3)).toHaveAttribute('aria-sort', /^(ascending|descending|none)$/u);
        await shot(page, '23R-E-009', 'table-semantics');
      });

      await test.step('[23R-A-052] "Đóng bảng toàn trang" closes the dialog (RAF:86-95)', async () => {
        await dialog.getByRole('button', { name: RA.closeFullTable, exact: true }).click();
        await expect.soft(dialog).toHaveCount(0);
        await shot(page, '23R-A-052', 'closed');
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23R-05 */
  test('SCR-23 · FL-23R-05 · RA1: toàn trang sắp/sao chép/Esc + chỉ đọc', async ({ browser }) => {
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser, { clipboard: true });
      const { page, log } = s;
      const seeded = await seedRA1(s, 'p3-r05');
      await openPascal(page, seeded.projectId);
      await sideRail(page).getByRole('button', { name: PV.history, exact: true }).click();
      await expect(historyRegion(page)).toBeVisible();
      const panel = await openRailPanel(page, RA.title);
      const dialog = fullPage(page);
      const headers = dialog.locator('thead th');
      const nameHeader = dialog.getByRole('button', { name: RA.column.name, exact: true });
      const areaHeader = dialog.getByRole('button', { name: RA.column.area, exact: true });

      await test.step('[23R-A-046] full page, click "Tên phòng": `aria-sort="ascending"` there, "none" on "Diện tích" (RAF:112-128)', async () => {
        await panel.getByRole('button', { name: RA.openFullPage, exact: true }).click();
        await expect(dialog).toBeVisible();
        await nameHeader.click();
        await expect(headers.nth(1)).toHaveAttribute('aria-sort', 'ascending');
        await expect(headers.nth(3)).toHaveAttribute('aria-sort', 'none');
        await expect
          .soft(fullRoomRows(dialog).locator('td:nth-child(2)'))
          .toHaveText(['Ăn', 'Bếp', 'Kho', 'Phòng khách', 'WC', 'Ban công', 'Phòng chữ L', 'Phòng ngủ 1']);
        await shot(page, '23R-A-046', 'sort-name');
      });

      await test.step('[23R-A-047] "Diện tích" twice: `aria-sort` "descending" then "ascending" (RAF:34-38)', async () => {
        await areaHeader.click();
        await expect.soft(headers.nth(3)).toHaveAttribute('aria-sort', 'descending');
        await areaHeader.click();
        await expect.soft(headers.nth(3)).toHaveAttribute('aria-sort', 'ascending');
        await shot(page, '23R-A-047', 'sort-area-toggle');
      });

      await test.step('[23R-A-048] from name sort, "Diện tích" goes to "descending" (NEXT_AREA_SORT.name, RAF:37)', async () => {
        await nameHeader.click();
        await expect.soft(headers.nth(1)).toHaveAttribute('aria-sort', 'ascending');
        await areaHeader.click();
        await expect.soft(headers.nth(3)).toHaveAttribute('aria-sort', 'descending');
        await shot(page, '23R-A-048', 'name-to-area');
      });

      await test.step('[23R-A-050] "Sao chép bảng" in the dialog: button "Đã sao chép bảng"; clipboard has 8 rooms, ends "Tổng diện tích⇥⇥⇥80,08 m²"', async () => {
        await dialog.getByRole('button', { name: /sao chép bảng$/iu }).click();
        await expect.soft(dialog.getByRole('button', { name: RA.copied, exact: true })).toBeVisible();
        const lines = await tsvLines(page);
        const names = lines.map((line) => line.split('\t')[1]);
        for (const room of ['Phòng khách', 'Bếp', 'Ăn', 'WC', 'Kho', 'Phòng ngủ 1', 'Phòng chữ L', 'Ban công']) {
          expect.soft(names, room).toContain(room);
        }
        expect.soft(lines.at(-1)).toBe('Tổng diện tích\t\t\t80,08 m²');
        await shot(page, '23R-A-050', 'copy-full', `clipboard: ${lines.join(' ⏎ ').replace(/\t/gu, '⇥')}`);
      });

      await test.step('[23R-A-049] "Nhóm theo" = "Công năng" in the dialog → after closing, the panel\'s "Nhóm theo" is "Công năng" too', async () => {
        await combo(dialog, RA.groupBy).selectOption({ label: RA.groupByOccupancy });
        await dialog.getByRole('button', { name: RA.closeFullTable, exact: true }).click();
        await expect.soft(dialog).toHaveCount(0);
        await expect.soft(combo(panel, RA.groupBy)).toHaveValue('occupancy');
        await shot(page, '23R-A-049', 'shared-grouping');
      });

      await test.step('[23R-A-051] reopen, Esc: dialog closes, focus back on "Mở toàn trang", "Lịch sử thao tác" still open (RAF:194-204)', async () => {
        const opener = panel.getByRole('button', { name: RA.openFullPage, exact: true });
        await opener.click();
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(dialog).toHaveCount(0);
        await expect.soft(opener).toBeFocused();
        await expect.soft(historyRegion(page)).toBeVisible();
        await shot(page, '23R-A-051', 'esc-closes');
      });

      await test.step('[23F-B-002] "Thư viện đồ đạc" on a floor without furniture: no "Đã phát hiện" section (DFS:145)', async () => {
        const furniture = await openRailPanel(page, FL.title);
        await expect.soft(itemCount(furniture)).toHaveText(FL.count(101));
        await expect.soft(detectedStrip(furniture)).toHaveCount(0);
        await shot(page, '23F-B-002', 'no-detected');
      });

      await test.step('[23R-G-003] browsing only: 0 non-GET request under /api/projects/ for the whole flow', async () => {
        expect.soft(nonGetUnderProjects(log)).toEqual([]);
        await shot(page, '23R-G-003', 'no-writes', `non-GET under /api/projects/: ${String(nonGetUnderProjects(log).length)}`);
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23R-06 */
  test('SCR-23 · FL-23R-06 · RA1: đổi tên → lưu → hoàn tác → tải lại → 409', async ({ browser }) => {
    test.setTimeout(140_000);
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page, log } = s;
      const seeded = await seedRA1(s, 'p3-r06');
      const t1 = floorOf(seeded, 'Tầng 1');
      const t2 = floorOf(seeded, 'Tầng 2');
      await openPascal(page, seeded.projectId);
      let panel = await openRailPanel(page, RA.title);
      await expand(panel);
      let firstPut: Promise<unknown> = Promise.resolve();
      let undoPut: Promise<unknown> = Promise.resolve();

      await test.step('[23R-A-026] double-click "Bếp" → textbox "Đổi tên phòng Bếp" focused, value "Bếp" (RAP:381-414)', async () => {
        await roomButton(panel, 'Bếp').dblclick();
        const box = panel.getByRole('textbox', { name: RA.renameLabel('Bếp'), exact: true });
        await expect(box).toBeFocused();
        await expect(box).toHaveValue('Bếp');
        await shot(page, '23R-A-026', 'rename-box');
      });

      await test.step('[23R-A-027] type "Bếp chính" + Enter → row "Bếp chính"; strip `Đã đổi tên thành "Bếp chính"` + "Hoàn tác"', async () => {
        firstPut = nextLayerPut(page, t1.floorId);
        await renameInput(panel).fill('Bếp chính');
        await renameInput(panel).press('Enter');
        await expect.soft(roomButton(panel, 'Bếp chính')).toBeVisible();
        await expect.soft(renameBand(panel)).toHaveText(RA.renamed('Bếp chính'));
        await expect.soft(undoButton(panel)).toBeVisible();
        await shot(page, '23R-A-027', 'renamed');
      });

      await test.step('[23R-C-007] exactly one PUT for one rename: after the first answer and "Đã lưu lúc", still 1 PUT', async () => {
        await firstPut;
        await expect.soft(saveLine(page)).toHaveText(SAVED_AT);
        // An absence check needs the rename timer (800 ms, RAP:147-149) + autosave debounce (800 ms) to elapse after the answer.
        await page.waitForTimeout(1_700); // fixed-wait-ok: 800 ms timer + 800 ms debounce window, no event marks "no second PUT"
        await layerIdle(log);
        expect.soft(layerPuts(log).map((e) => e.path)).toHaveLength(1);
        await shot(page, '23R-C-007', 'one-put', `#35 PUTs so far: ${String(layerPuts(log).length)}`);
      });

      await test.step('[23R-G-001] PUT body: floor "Tầng 1", `rooms[]` has name "Bếp chính", 200, "Đã lưu lúc HH:MM" (PVC:212-220)', async () => {
        const put = layerPuts(log)[0];
        expect.soft(put?.path).toBe(`/api/projects/${seeded.projectId}/floors/${t1.floorId}/spatial/layer`);
        expect.soft(put?.status).toBe(200);
        expect.soft(typeof (JSON.parse(put?.body ?? '{}') as { baseVersion?: unknown }).baseVersion).toBe('number');
        expect.soft(putRoomNames(put)).toContain('Bếp chính');
        await expect.soft(saveLine(page)).toHaveText(SAVED_AT);
        await shot(page, '23R-G-001', 'put-body', `PUT ${put?.path ?? '—'} → ${String(put?.status)}; rooms: ${putRoomNames(put).join(', ')}`);
      });

      await test.step('[23R-A-034] "Hoàn tác" → name back to "Bếp", strip gone (RAP:161-165)', async () => {
        undoPut = nextLayerPut(page, t1.floorId);
        await undoButton(panel).click();
        await expect.soft(roomButton(panel, 'Bếp')).toBeVisible();
        await expect.soft(renameBand(panel)).toHaveCount(0);
        await shot(page, '23R-A-034', 'undone');
      });

      await test.step('[23R-G-002] the undo is a second PUT: 200, name "Bếp"', async () => {
        await undoPut;
        const put = layerPuts(log).at(-1);
        expect.soft(layerPuts(log)).toHaveLength(2);
        expect.soft(put?.status).toBe(200);
        expect.soft(putRoomNames(put)).toContain('Bếp');
        expect.soft(putRoomNames(put)).not.toContain('Bếp chính');
        await shot(page, '23R-G-002', 'undo-put', `PUT #2 → ${String(put?.status)}; rooms: ${putRoomNames(put).join(', ')}`);
      });

      await test.step('[23R-A-033] "  Kho lạnh  " is trimmed: row "Kho lạnh"; PUT name "Kho lạnh" (RAP:134-136)', async () => {
        const put = layerPutWith(page, '"name":"Kho lạnh"');
        await renameRoom(panel, 'Kho', '  Kho lạnh  ');
        await expect.soft(roomButton(panel, 'Kho lạnh')).toBeVisible();
        const res = await put;
        expect.soft(res.status()).toBe(200);
        expect.soft(putRoomNames(layerPuts(log).at(-1))).toContain('Kho lạnh');
        await shot(page, '23R-A-033', 'trimmed');
      });

      await test.step('[23R-C-006] after a rename "Kho lạnh" reads "Máy đọc, chưa soát" (current C2 design — cần sản phẩm xác nhận)', async () => {
        // The catalog row expected the sign-off kept (RV:61-72); the C2 design clears it on any real edit (fromPascal.ts:240-243
        // `reviewed:false`; run-051b E1-T22). Asserts the current source design — CẦN SẢN PHẨM XÁC NHẬN "đổi tên có mất duyệt không".
        await expect.soft(roomDot(panel, 'Kho lạnh')).toHaveAttribute('aria-label', RA.statusTrusted);
        await shot(page, '23R-C-006', 'review-kept');
      });

      await test.step('[23R-G-004] rename on "Tầng 2" → exactly 1 PUT to its floor, 0 new PUT for "Tầng 1" (SLS changedLevelIds)', async () => {
        await layerIdle(log);
        const mark = layerPuts(log).length;
        const put = nextLayerPut(page, t2.floorId);
        await renameRoom(panel, 'Phòng chữ L', 'Phòng chữ L1');
        await put;
        const since = layerPuts(log).slice(mark);
        expect.soft(since.filter((e) => e.path.includes(`/floors/${t2.floorId}/`)), 'PUTs to Tầng 2').toHaveLength(1);
        expect.soft(since.filter((e) => e.path.includes(`/floors/${t1.floorId}/`)), 'PUTs to Tầng 1').toHaveLength(0);
        await shot(page, '23R-G-004', 'one-floor', `PUTs since the rename: ${since.map((e) => e.path).join(', ')}`);
      });

      await test.step('[23R-A-035] the strip hides by itself (≤ 10 s after the last rename; RAP:45, 155-159)', async () => {
        await expect.soft(renameBand(panel)).toHaveCount(0, { timeout: 10_000 });
        await shot(page, '23R-A-035', 'strip-gone');
      });

      await test.step('[23R-A-038] reload: "Kho lạnh" and "Phòng chữ L1" are still there (read back from N15)', async () => {
        await openPascal(page, seeded.projectId);
        panel = await openRailPanel(page, RA.title);
        await expand(panel);
        await expect.soft(roomButton(panel, 'Kho lạnh')).toBeVisible();
        await expect.soft(roomButton(panel, 'Phòng chữ L1')).toBeVisible();
        await shot(page, '23R-A-038', 'reloaded');
      });

      await test.step('[23R-G-005] +W2 (a PUT from the API), then rename "Ăn" → "Phòng ăn": "Tầng này vừa được sửa ở nơi khác. …" (409)', async () => {
        if (s === undefined) throw new Error('no session');
        await touchLayer(s.api, seeded.projectId, t1.floorId);
        const put = nextLayerPut(page, t1.floorId);
        await renameRoom(panel, 'Ăn', 'Phòng ăn');
        const res = await put;
        expect.soft(res.status(), 'PUT on a stale baseVersion').toBe(409);
        await expect.soft(saveLine(page)).toHaveText(blockedLine(SAVE.reload));
        await shot(page, '23R-G-005', 'conflict-409');
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23R-07 */
  test('SCR-23 · FL-23R-07 · RA1: đổi tên — các nhánh cạnh, phím, đặt đồ', async ({ browser }) => {
    test.setTimeout(120_000);
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page, log } = s;
      const seeded = await seedRA1(s, 'p3-r07');
      await openPascal(page, seeded.projectId);
      const panel = await openRailPanel(page, RA.title);
      await expand(panel);
      const newBands = async (before: readonly string[]): Promise<string[]> =>
        (await renameBand(panel).allTextContents()).filter((text) => !before.includes(text));

      await test.step('[23R-A-028] double-click "Bếp", type "Bếp A", click outside (blur) → row "Bếp A" (RAP:386-389)', async () => {
        await roomButton(panel, 'Bếp').dblclick();
        await renameInput(panel).fill('Bếp A');
        await panel.locator('h2').click();
        await expect(renameInput(panel)).toHaveCount(0);
        await expect(roomButton(panel, 'Bếp A')).toBeVisible();
        await shot(page, '23R-A-028', 'blur-commits');
      });

      await test.step('[23R-A-029] "Ăn" → "Ăn B" without Enter: strip `Đã đổi tên thành "Ăn B"` while the textbox is open (800 ms, RAP:43)', async () => {
        await roomButton(panel, 'Ăn').dblclick();
        await renameInput(panel).fill('Ăn B');
        await expect.soft(renameBand(panel)).toHaveText(RA.renamed('Ăn B'));
        await expect.soft(renameInput(panel)).toBeVisible();
        await shot(page, '23R-A-029', 'autosave-strip');
        await renameInput(panel).press('Enter');
        await expect(renameInput(panel)).toHaveCount(0);
      });

      await test.step('[23R-A-030] ⚑ "WC" → "WC2" then Esc at once: after the latest PUT + 1 marker PUT, row still "WC", no PUT carries "WC2"', async () => {
        // A rename that leaves an undo strip, saved first: its "Hoàn tác" is the marker write — it calls updateNode directly and
        // never touches the 800 ms rename timer (RAP:146-149, 161-165), so a pending "WC2" timer cannot be cleared by it.
        const prep = layerPutWith(page, '"name":"Phòng khách M"');
        await renameRoom(panel, 'Phòng khách', 'Phòng khách M');
        await prep;
        await roomButton(panel, 'WC').dblclick();
        await renameInput(panel).fill('WC2');
        await renameInput(panel).press('Escape');
        await expect(renameInput(panel)).toHaveCount(0);
        const marker = layerPutWith(page, '"name":"Phòng khách"');
        await undoButton(panel).click();
        await marker;
        await expect.soft(roomButton(panel, 'WC')).toBeVisible();
        await expect.soft(roomButton(panel, 'WC2')).toHaveCount(0);
        expect.soft(layerPuts(log).flatMap(putRoomNames), 'a PUT carried "WC2"').not.toContain('WC2');
        await shot(page, '23R-A-030', 'esc-cancels');
      });

      await test.step('[23R-A-031] clear the name + Enter, then only spaces + Enter → name kept, no new strip (RAP:134-135)', async () => {
        for (const value of ['', '   ']) {
          const before = await renameBand(panel).allTextContents();
          await roomButton(panel, 'Phòng khách').dblclick();
          await renameInput(panel).fill(value);
          await renameInput(panel).press('Enter');
          await expect(renameInput(panel)).toHaveCount(0);
          await expect.soft(roomButton(panel, 'Phòng khách'), `"${value}" keeps the name`).toBeVisible();
          expect.soft(await newBands(before), `"${value}" adds no strip`).toEqual([]);
        }
        await shot(page, '23R-A-031', 'empty-ignored');
      });

      await test.step('[23R-A-032] same name + Enter → no new strip (RAP:135)', async () => {
        const before = await renameBand(panel).allTextContents();
        await roomButton(panel, 'Phòng khách').dblclick();
        await renameInput(panel).press('Enter');
        await expect(renameInput(panel)).toHaveCount(0);
        expect.soft(await newBands(before)).toEqual([]);
        await shot(page, '23R-A-032', 'same-name');
      });

      await test.step('[23R-A-036] ⚑ "Kho" → "Kho X", Enter, "Hoàn tác" at once → after the PUT, row still "Kho"', async () => {
        await layerIdle(log);
        await roomButton(panel, 'Kho').dblclick();
        await renameInput(panel).fill('Kho X');
        await renameInput(panel).press('Enter');
        const put = nextLayerPut(page);
        await undoButton(panel).click();
        await put;
        await expect.soft(roomButton(panel, 'Kho')).toBeVisible();
        await expect.soft(roomButton(panel, 'Kho X')).toHaveCount(0);
        expect.soft(putRoomNames(layerPuts(log).at(-1)), 'last PUT').not.toContain('Kho X');
        await shot(page, '23R-A-036', 'fast-undo');
      });

      await test.step('[23R-A-037] rename, then Ctrl+Z (canvas, no field focused) → old name back in one step (#80)', async () => {
        const saved = layerPutWith(page, '"name":"Khách"');
        await renameRoom(panel, 'Phòng khách', 'Khách');
        await saved;
        await undoOnCanvas(page);
        await expect.soft(roomButton(panel, 'Phòng khách')).toBeVisible();
        await shot(page, '23R-A-037', 'ctrl-z');
      });

      await test.step('[23R-A-039] "Bếp A" selected, Backspace / Delete inside its textbox only edit text, the room stays (use-keyboard.ts:235-239)', async () => {
        await roomButton(panel, 'Bếp A').click();
        await roomButton(panel, 'Bếp A').dblclick();
        const input = renameInput(panel);
        await input.press('End');
        await input.press('Backspace');
        await input.press('A');
        await input.press('Delete');
        await input.press('Enter');
        await expect(input).toHaveCount(0);
        await expect.soft(roomButton(panel, 'Bếp A')).toBeVisible();
        await softly.poll(async () => (await roomNames(panel)).length).toBe(8);
        await shot(page, '23R-A-039', 'delete-in-field');
      });

      await test.step('[23R-E-006] ⚑ keyboard path to rename: focus "Ăn B" + Enter / F2 opens "Đổi tên phòng Ăn B"', async () => {
        await roomButton(panel, 'Ăn B').focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('F2');
        await expect.soft(panel.getByRole('textbox', { name: RA.renameLabel('Ăn B'), exact: true })).toBeVisible();
        await shot(page, '23R-E-006', 'keyboard-rename');
      });

      await test.step('[23R-E-010] ⚑ after Enter in the textbox, focus is on that room\'s name button (not `body`)', async () => {
        if ((await renameInput(panel).count()) === 0) await roomButton(panel, 'Ăn B').dblclick();
        await renameInput(panel).press('Enter');
        await expect(renameInput(panel)).toHaveCount(0);
        await expect.soft(roomButton(panel, 'Ăn B')).toBeFocused();
        await shot(page, '23R-E-010', 'focus-back');
      });

      await test.step('[23F-G-004] ⚑ "Thư viện đồ đạc": tile "Dining table", click the canvas floor → 1 PUT …/spatial/layer 200, "Đã lưu lúc"', async () => {
        await layerIdle(log);
        const mark = layerPuts(log).length;
        const furniture = await openRailPanel(page, FL.title);
        await tile(furniture, 'Dining table').click();
        const point = await canvasFloorPoint(page, furniture);
        await page.mouse.move(point.x - 20, point.y);
        await page.mouse.move(point.x, point.y);
        const put = nextLayerPut(page).then(
          (res) => res.status(),
          () => null,
        );
        await page.mouse.click(point.x, point.y);
        expect.soft(await put, 'PUT …/spatial/layer after the placement (null = none within the autosave timeout)').toBe(200);
        await layerIdle(log);
        expect.soft(layerPuts(log).slice(mark), 'PUTs after the placement').toHaveLength(1);
        await expect.soft(saveLine(page)).toHaveText(SAVED_AT);
        await shot(page, '23F-G-004', 'place-item', `PUTs after the placement: ${String(layerPuts(log).length - mark)}`);
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23R-08 */
  test('SCR-23 · FL-23R-08 · RA2: một phần, lỗi, rò lọc tầng, thứ tự nhóm', async ({ browser }) => {
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page } = s;
      const seeded = await seedRA2(s, 'p3-r08');
      await openPascal(page, seeded.projectId);
      const panel = await openRailPanel(page, RA.title);
      const filter = combo(panel, RA.levelFilter);
      const footerStatus = panel.locator('footer').getByRole('status');

      await test.step('[23R-B-005] partial: footer `role=status` "Có phòng chưa đo được" + the reason; rows "Sảnh", "Phòng máy" (RAP:481-487)', async () => {
        await expect(footerStatus).toContainText(RA.partialTitle);
        await expect(footerStatus).toContainText(RA.unmeasurable('Hộp kỹ thuật'));
        await expect.poll(async () => (await roomNames(panel)).sort()).toEqual(['Phòng máy', 'Sảnh'].sort());
        await shot(page, '23R-B-005', 'partial');
      });

      await test.step('[23R-E-011] notice roles: partial = `role=status`; filter "Mái" gives `role=alert` (RAP:347, 482)', async () => {
        await expect.soft(footerStatus).toHaveCount(1);
        await filter.selectOption({ label: 'Mái' });
        await expect.soft(panel.getByRole('alert')).toHaveCount(1);
        await shot(page, '23R-E-011', 'notice-roles');
        await filter.selectOption({ label: RA.allLevels });
      });

      await test.step('[23R-C-004] ⚑ group order follows the storeys (expanded): "Tầng 2" before "Tầng 10" (RAM:306 sorts labels as text)', async () => {
        await expand(panel);
        await softly.poll(() => groupLabels(panel)).toEqual(['Tầng 2', 'Tầng 10']);
        await shot(page, '23R-C-004', 'group-order');
      });

      await test.step('[23R-B-006] filter "Mái": `role=alert` "Không đo được phòng nào" + reason; the footer does not repeat the list', async () => {
        await filter.selectOption({ label: 'Mái' });
        const alert = panel.getByRole('alert');
        await expect.soft(alert).toContainText(RA.errorTitle);
        await expect.soft(alert).toContainText(RA.unmeasurable('Hộp kỹ thuật'));
        await expect.soft(footerStatus).toHaveCount(0);
        await expect.soft(panel.locator('footer')).not.toContainText(RA.unmeasurable('Hộp kỹ thuật'));
        await shot(page, '23R-B-006', 'error');
      });

      await test.step('[23R-B-007] ⚑ filter "Tầng 2" (clean floor): no "Có phòng chưa đo được" (RAM:264-270 counts every floor)', async () => {
        await filter.selectOption({ label: 'Tầng 2' });
        await expect.soft(panel.getByText(RA.partialTitle, { exact: true })).toHaveCount(0);
        await shot(page, '23R-B-007', 'filter-leak');
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23R-09 */
  test('SCR-23 · FL-23R-09 · RA3: rỗng + kiểm khe hở tường', async ({ browser }) => {
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page } = s;
      const seeded = await seedRA3(s, 'p3-r09');
      await openPascal(page, seeded.projectId);
      let panel = await openRailPanel(page, RA.title);
      const detect = (): Locator => panel.getByRole('button', { name: RA.detectSpaces, exact: true });

      await test.step('[23R-B-001] empty: "Chưa có phòng nào đo được", "Phòng chỉ hiện ở đây khi đường bao tường đã kín.", total "0 m²"', async () => {
        await expect(panel.getByText(RA.emptyTitle, { exact: true })).toBeVisible();
        await expect(panel.getByText(RA.emptyBody, { exact: true })).toBeVisible();
        await expect(detect()).toBeVisible();
        await expect(panelTotal(panel)).toHaveText('0 m²');
        await shot(page, '23R-B-001', 'empty');
      });

      await test.step('[23R-B-002] "Kiểm tra khe hở tường" on every floor → "Tìm thấy 1 vùng kín — mở lại bảng để xem" (RAP:177-189)', async () => {
        await detect().click();
        await expect.soft(panel.getByText(RA.gapsClosed(1), { exact: true })).toBeVisible();
        await shot(page, '23R-B-002', 'gaps-closed');
      });

      await test.step('[23R-B-003] filter "Tầng 2", check again → "Chưa có vùng nào kín — còn khe hở giữa các tường"', async () => {
        await combo(panel, RA.levelFilter).selectOption({ label: 'Tầng 2' });
        await detect().click();
        await expect.soft(panel.getByText(RA.gapsOpen, { exact: true })).toBeVisible();
        await shot(page, '23R-B-003', 'gaps-open');
      });

      await test.step('[23R-B-004] ⚑ follow the hint: "Mọi tầng", close and reopen the panel → at least 1 room row', async () => {
        await combo(panel, RA.levelFilter).selectOption({ label: RA.allLevels });
        await siteButton(page).click();
        await expect(panelOf(page, RA.title)).toHaveCount(0);
        panel = await openRailPanel(page, RA.title);
        await expect.soft(panel.getByText(RA.emptyTitle, { exact: true })).toHaveCount(0);
        await softly.poll(async () => (await roomNames(panel)).length).toBeGreaterThan(0);
        await shot(page, '23R-B-004', 'reopened');
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23RF-01 */
  test('SCR-23 · FL-23RF-01 · vai xem trên cả hai bảng', async ({ browser }) => {
    let s: AdminSession | undefined;
    let v: MemberSession | undefined;
    try {
      s = await openAdminSession(browser);
      const seeded = await seedFX(s, 'p3-rf01');
      v = await openMemberSession(browser, s, seeded.projectId, 'viewer', VIEWER_SLOT, { clipboard: true });
      const { page, log } = v;
      await openPascal(page, seeded.projectId);
      const panel = await openRailPanel(page, RA.title);

      await test.step('[23R-D-002] viewer double-clicks "Bếp" → no textbox; title "Vai chỉ xem không đổi được tên phòng" (RAP:409-416)', async () => {
        await roomButton(panel, 'Bếp').dblclick();
        await expect(renameInput(panel)).toHaveCount(0);
        await expect(roomButton(panel, 'Bếp')).toHaveAttribute('title', RA.readOnlyRename);
        await shot(page, '23R-D-002', 'viewer-no-rename');
      });

      await test.step('[23R-B-014] role notice `role=status` "Bạn đang ở vai người xem — …" (RAP:333-337)', async () => {
        await expect.soft(panel.getByRole('status').filter({ hasText: RA.forbiddenNotice })).toHaveCount(1);
        await shot(page, '23R-B-014', 'viewer-notice');
      });

      await test.step('[23R-D-003] sort, filter, copy, open/close the full page all work; 0 non-GET so far', async () => {
        await combo(panel, RA.sortBy).selectOption({ label: RA.sortAreaAsc });
        await expect.soft(combo(panel, RA.sortBy)).toHaveValue('area-asc');
        await combo(panel, RA.levelFilter).selectOption({ label: 'Tầng 1' });
        await softly.poll(() => groupLabels(panel)).toEqual(['Tầng 1']);
        const copy = panel.getByRole('button', { name: RA.copyTable, exact: true });
        await copy.click();
        await expect.soft(copy).toHaveAttribute('title', RA.copied);
        await panel.getByRole('button', { name: RA.openFullPage, exact: true }).click();
        await expect.soft(fullPage(page)).toBeVisible();
        await shot(page, '23R-D-003', 'viewer-browse');
        await fullPage(page).getByRole('button', { name: RA.closeFullTable, exact: true }).click();
        await expect.soft(fullPage(page)).toHaveCount(0);
        expect.soft(nonGetUnderProjects(log)).toEqual([]);
      });

      await test.step('[23F-B-003] viewer opens "Thư viện đồ đạc": "Vai chỉ xem: không thêm được đồ đạc"; no "Đã phát hiện" (FLP:83, DFS:145)', async () => {
        const furniture = await openRailPanel(page, FL.title);
        await expect.soft(furniture.getByText(FL.readOnlyNotice, { exact: true })).toBeVisible();
        await expect.soft(detectedStrip(furniture)).toHaveCount(0);
        await shot(page, '23F-B-003', 'viewer-library');
      });

      await test.step('[23F-D-002] click / drag a tile: tiles `disabled`, `draggable="false"`, none with `ring-2` (IC:70-84)', async () => {
        const furniture = panelOf(page, FL.title);
        const first = tiles(furniture).first();
        await expect.soft(first).toBeDisabled();
        await expect.soft(first).toHaveAttribute('draggable', 'false');
        await first.click({ force: true });
        expect.soft(await selectedTileCount(furniture), 'tiles with ring-2').toBe(0);
        await shot(page, '23F-D-002', 'tiles-locked');
      });

      await test.step('[23F-D-003] end of flow: 0 non-GET request under /api/projects/', async () => {
        expect.soft(nonGetUnderProjects(log)).toEqual([]);
        await shot(page, '23F-D-003', 'viewer-no-writes', `non-GET under /api/projects/: ${String(nonGetUnderProjects(log).length)}`);
      });
    } finally {
      await v?.context.close().catch(() => undefined);
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23RF-02 */
  test('SCR-23 · FL-23RF-02 · kỹ sư: đổi tên, dải phát hiện, kéo thả, rồi bị hạ vai', async ({ browser }) => {
    test.setTimeout(140_000);
    let s: AdminSession | undefined;
    let e: MemberSession | undefined;
    try {
      s = await openAdminSession(browser);
      const seeded = await seedFX(s, 'p3-rf02');
      // A run that died mid-flow may have left this slot demoted: back to engineer before the login.
      e = await openMemberSession(browser, s, seeded.projectId, 'engineer', DEMOTE_SLOT, { resetRole: true });
      const { page } = e;
      await openPascal(page, seeded.projectId);
      let panel = await openRailPanel(page, RA.title);
      const t1 = floorOf(seeded, 'Tầng 1');

      await test.step('[23R-D-001] the member engineer renames "Bếp" → "Bếp K": PUT 200, "Đã lưu lúc" (permissions.ts:64-66)', async () => {
        const put = nextLayerPut(page, t1.floorId);
        await renameRoom(panel, 'Bếp', 'Bếp K');
        expect((await put).status()).toBe(200);
        await expect(saveLine(page)).toHaveText(SAVED_AT);
        await shot(page, '23R-D-001', 'engineer-rename');
      });

      await test.step('[23F-D-001] "Thư viện đồ đạc": "Đã phát hiện" shows; tiles are not disabled (FLP:30, DFS:145)', async () => {
        const furniture = await openRailPanel(page, FL.title);
        await expect.soft(detectedStrip(furniture)).toBeVisible();
        await expect.soft(tiles(furniture).first()).toBeEnabled();
        await shot(page, '23F-D-001', 'engineer-library');
      });

      await test.step('[23F-A-029] drag "Dining Chair" over "ghế (3)" → row `border-primary`; drop → dialog "Thay thế tất cả 3 ghế?" (then "Huỷ")', async () => {
        const furniture = panelOf(page, FL.title);
        await chip(furniture, 'Ghế').click();
        const row = detectedRow(furniture, 'ghế (3)');
        await tile(furniture, 'Dining Chair').hover();
        await page.mouse.down();
        const box = await row.boundingBox();
        if (box === null) throw new Error('"ghế (3)" row has no box');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
        await expect.soft(row).toHaveClass(classToken('border-primary'));
        await page.mouse.up();
        const dialog = page.getByRole('dialog', { name: FL.previewTitle('ghế', 3), exact: true });
        await expect.soft(dialog).toBeVisible();
        await expect.soft(dialog.getByRole('listitem').first()).toHaveText(FL.previewRow('ghế', 1, 'Dining Chair'));
        await shot(page, '23F-A-029', 'drop-preview');
        if ((await dialog.count()) > 0) await dialog.getByRole('button', { name: FL.cancel, exact: true }).click();
        await expect.soft(previewDialog(page)).toHaveCount(0);
      });

      await test.step('[23F-A-030] dropping text (not a catalog tile) on the row: no highlight, no dialog (DFS:168)', async () => {
        const furniture = panelOf(page, FL.title);
        const row = detectedRow(furniture, 'ghế (3)');
        // A text drag carries only `text/plain` — the type check of DFS:168 is what is under test.
        const transfer = await page.evaluateHandle(() => {
          const data = new DataTransfer();
          data.setData('text/plain', 'ghế gỗ');
          return data;
        });
        await row.dispatchEvent('dragenter', { dataTransfer: transfer });
        await row.dispatchEvent('dragover', { dataTransfer: transfer });
        await expect.soft(row).not.toHaveClass(classToken('border-primary'));
        await row.dispatchEvent('drop', { dataTransfer: transfer });
        await expect.soft(previewDialog(page)).toHaveCount(0);
        await shot(page, '23F-A-030', 'text-drop');
      });

      await test.step('[23R-G-006] +DEM demoted through #41, back on "Diện tích phòng", "PHONG NGU 2" → "Ngủ 2": "Bạn không còn quyền sửa tầng này."', async () => {
        if (s === undefined || e === undefined) throw new Error('no session');
        expect.soft(await setRole(s.admin, e.user, 'viewer'), '#41 demote').toBe(200);
        panel = await openRailPanel(page, RA.title);
        // #41 bumps the token version (users/service.py:284-294): the first PUT is 401, the FE refreshes and the retry is 403
        // (run-051b E1-T15) — wait for the first non-401 answer.
        const put = page.waitForResponse(
          (res) => res.request().method() === 'PUT' && new URL(res.url()).pathname.endsWith('/spatial/layer') && res.status() !== 401,
          { timeout: 30_000 },
        );
        await renameRoom(panel, 'PHONG NGU 2', 'Ngủ 2');
        expect.soft((await put).status(), 'PUT after the demotion (past the 401 of the old token)').toBe(403);
        await expect.soft(saveLine(page)).toHaveText(blockedLine(SAVE.forbidden));
        await shot(page, '23R-G-006', 'demoted-403');
      });
    } finally {
      if (s !== undefined && e !== undefined) {
        const restored = await setRole(s.admin, e.user, 'engineer').catch((error: unknown) => String(error));
        if (restored !== 200) test.info().annotations.push({ type: 'cleanup', description: `#41 restore engineer → ${String(restored)}` });
      }
      await e?.context.close().catch(() => undefined);
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23F-01 */
  test('SCR-23 · FL-23F-01 · Thư viện: mở, ảnh, chip (oracle)', async ({ browser }) => {
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page, log } = s;
      const seeded = await seedQ1(s, 'p3-f01');
      await openPascal(page, seeded.projectId);
      const panel = panelOf(page, FL.title);
      const imgs = tiles(panel).locator('img');
      const pick = async (label: string, count: number): Promise<void> => {
        await chip(panel, label).click();
        await expect.soft(chip(panel, label)).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(itemCount(panel), label).toHaveText(FL.count(count));
      };

      await test.step('[23F-A-001] hover the armchair → tooltip "Thư viện đồ đạc"; click → h2 "Thư viện đồ đạc", "101 mẫu" (APN:31-36; FB self-hosted catalog)', async () => {
        const button = await railButton(page, FL.title);
        await expect(tooltip(page).filter({ hasText: FL.title }).first()).toHaveText(FL.title);
        await button.click();
        await expect(panel).toBeVisible();
        await expect(itemCount(panel)).toHaveText(FL.count(101));
        await shot(page, '23F-A-001', 'library-open');
      });

      await test.step('[23F-E-001] ⚑ the rail button has an accessible name "Thư viện đồ đạc" (IR:58-79)', async () => {
        await expect.soft(pascalRoot(page).getByRole('button', { name: FL.title, exact: true })).toHaveCount(1);
        await shot(page, '23F-E-001', 'rail-name');
      });

      await test.step('[23F-B-001] ⚑ tile pictures load: the first 8 `img` have `naturalWidth > 0` (IC:89-97; CSP blocks supabase.co)', async () => {
        await expect.poll(() => imgs.evaluateAll((els) => els.slice(0, 8).filter((el) => (el as HTMLImageElement).complete).length)).toBe(8);
        const loaded = await imgs.evaluateAll((els) => els.slice(0, 8).filter((el) => (el as HTMLImageElement).naturalWidth > 0).length);
        expect.soft(loaded, 'loaded pictures of the first 8 tiles').toBe(8);
        await shot(page, '23F-B-001', 'tile-images');
      });

      await test.step('[23F-G-002] ⚑ no request to another origin (request log + every tile `img` source; IC:96)', async () => {
        const own = new URL(page.url()).origin;
        const sources = await imgs.evaluateAll((els) => els.map((el) => (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src));
        const foreign = [...externalRequests(log), ...sources.filter((src) => /^https?:/u.test(src) && new URL(src).origin !== own)];
        expect.soft(foreign.slice(0, 5), `${String(foreign.length)} foreign URL(s)`).toEqual([]);
        await shot(page, '23F-G-002', 'no-foreign', `foreign URLs: ${String(foreign.length)}${foreign[0] === undefined ? '' : ` (${foreign[0]})`}`);
      });

      await test.step('[23F-A-002] 10 chips in order; "Tất cả" `aria-pressed="true"` (FLP:63-81, CF:20-31)', async () => {
        await expect.soft(chipGroup(panel).getByRole('button')).toHaveText([...FL.chips]);
        await expect.soft(chip(panel, 'Tất cả')).toHaveAttribute('aria-pressed', 'true');
        await shot(page, '23F-A-002', 'chips');
      });

      await test.step('[23F-E-003] chips are toggle buttons: group "Nhóm nội thất", exactly one `aria-pressed="true"`', async () => {
        await expect.soft(chipGroup(panel)).toBeVisible();
        await expect.soft(chipGroup(panel).locator('[aria-pressed="true"]')).toHaveCount(1);
        await shot(page, '23F-E-003', 'chip-toggle');
      });

      await test.step('[23F-A-003] "Bàn" → "7 mẫu"', async () => {
        await pick('Bàn', 7);
        await shot(page, '23F-A-003', 'chip-ban');
      });
      await test.step('[23F-A-004] "Ghế" → "4 mẫu"', async () => {
        await pick('Ghế', 4);
        await shot(page, '23F-A-004', 'chip-ghe');
      });
      await test.step('[23F-A-005] "Giường" → "2 mẫu"', async () => {
        await pick('Giường', 2);
        await shot(page, '23F-A-005', 'chip-giuong');
      });
      await test.step('[23F-A-006] "Tủ kệ" → "17 mẫu"', async () => {
        await pick('Tủ kệ', 17);
        await shot(page, '23F-A-006', 'chip-tu-ke');
      });
      await test.step('[23F-A-007] "Thiết bị vệ sinh" → "10 mẫu"', async () => {
        await pick('Thiết bị vệ sinh', 10);
        await shot(page, '23F-A-007', 'chip-ve-sinh');
      });
      await test.step('[23F-A-008] "Bếp" → "18 mẫu"', async () => {
        await pick('Bếp', 18);
        await shot(page, '23F-A-008', 'chip-bep');
      });
      await test.step('[23F-A-009] "Thiết bị kỹ thuật" → "24 mẫu"', async () => {
        await pick('Thiết bị kỹ thuật', 24);
        await shot(page, '23F-A-009', 'chip-ky-thuat');
      });

      await test.step('[23F-A-010] ⚑ "Ghế sofa" → ≥ "1 mẫu", not "Không có đồ đạc nào khớp" (catalog has "Sofa"; CF:40)', async () => {
        await chip(panel, 'Ghế sofa').click();
        await softly.poll(() => countOf(panel)).toBeGreaterThanOrEqual(1);
        await expect.soft(panel.getByText(FL.emptyTitle, { exact: true })).toHaveCount(0);
        await shot(page, '23F-A-010', 'chip-sofa');
      });

      await test.step('[23F-A-011] "Của tôi" → "0 mẫu", "Không có đồ đạc nào khớp", "Bỏ dấu, bớt chữ, hoặc chọn nhóm khác." (CF:73-75)', async () => {
        await pick('Của tôi', 0);
        await expect.soft(panel.getByText(FL.emptyTitle, { exact: true })).toBeVisible();
        await expect.soft(panel.getByText(FL.emptyBody, { exact: true })).toBeVisible();
        await shot(page, '23F-A-011', 'chip-mine');
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23F-02 */
  test('SCR-23 · FL-23F-02 · Thư viện: tìm kiếm (oracle)', async ({ browser }) => {
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page, log } = s;
      const seeded = await seedQ1(s, 'p3-f02');
      await openPascal(page, seeded.projectId);
      const panel = await openRailPanel(page, FL.title);
      const search = searchBox(panel);
      const find = async (text: string, count: number): Promise<void> => {
        await search.fill(text);
        await expect.soft(itemCount(panel), `"${text}"`).toHaveText(FL.count(count));
      };

      await test.step('[23F-A-012] with "Tất cả" chosen, the empty chips "Ghế sofa", "Của tôi" are dimmed (`opacity-50`, FLP:38, 72)', async () => {
        await expect(chip(panel, 'Tất cả')).toHaveAttribute('aria-pressed', 'true');
        await expect(chip(panel, 'Ghế sofa')).toHaveClass(classToken('opacity-50'));
        await expect(chip(panel, 'Của tôi')).toHaveClass(classToken('opacity-50'));
        await shot(page, '23F-A-012', 'dimmed-chips');
      });

      await test.step('[23F-E-002] search box: searchbox "Tìm đồ đạc", placeholder "Tên hoặc nhóm, không cần dấu" (FLP:51-61)', async () => {
        await expect.soft(search).toHaveCount(1);
        await expect.soft(search).toHaveAttribute('placeholder', FL.searchPlaceholder);
        await shot(page, '23F-E-002', 'searchbox');
      });

      await test.step('[23F-A-013] "chair" → "4 mẫu"', async () => {
        await find('chair', 4);
        await shot(page, '23F-A-013', 'search-chair');
      });

      await test.step('[23F-A-014] case-insensitive "TABLE" → "8 mẫu"', async () => {
        await find('TABLE', 8);
        await shot(page, '23F-A-014', 'search-table');
      });

      await test.step('[23F-A-015] ⚑ "ghế" then "ghe" → ≥ "4 mẫu" each (the hint promises accent-free search; names are English)', async () => {
        for (const text of ['ghế', 'ghe']) {
          await search.fill(text);
          await softly.poll(() => countOf(panel), { message: `"${text}"` }).toBeGreaterThanOrEqual(4);
        }
        await shot(page, '23F-A-015', 'search-ghe');
      });

      await test.step('[23F-A-016] ⚑ "bàn" → tables, not "Parking Spot" / "Scooter" (tag "urban" contains "ban")', async () => {
        await search.fill('bàn');
        await softly.poll(() => countOf(panel), { message: 'grid re-filtered for "bàn"' }).not.toBe(101);
        const names = await tileNames(panel);
        expect.soft(names).not.toContain('Parking Spot');
        expect.soft(names).not.toContain('Scooter');
        expect.soft(names.some((name) => /table|desk/iu.test(name)), `tiles: ${names.join(', ')}`).toBe(true);
        await shot(page, '23F-A-016', 'search-ban');
      });

      await test.step('[23F-A-017] "zzz" → "0 mẫu", "Không có đồ đạc nào khớp" (FLP:85-92)', async () => {
        await find('zzz', 0);
        await expect.soft(panel.getByText(FL.emptyTitle, { exact: true })).toBeVisible();
        await shot(page, '23F-A-017', 'search-zzz');
      });

      await test.step('[23F-A-018] "chair" + chip "Bàn" → "1 mẫu" ("Office Chair" carries tag `desk`; combined filter, CF:89-96)', async () => {
        await search.fill('chair');
        await chip(panel, 'Bàn').click();
        await expect.soft(itemCount(panel)).toHaveText(FL.count(1));
        await shot(page, '23F-A-018', 'chair-and-ban');
      });

      await test.step('[23F-C-003] "chair" with "Tất cả": "Ghế" and "Bàn" ("Office Chair", tag `desk`) not dimmed, "Giường" dimmed (CF:99-108)', async () => {
        await chip(panel, 'Tất cả').click();
        await expect.soft(chip(panel, 'Ghế')).not.toHaveClass(classToken('opacity-50'));
        await expect.soft(chip(panel, 'Bàn')).not.toHaveClass(classToken('opacity-50'));
        await expect.soft(chip(panel, 'Giường')).toHaveClass(classToken('opacity-50'));
        await shot(page, '23F-C-003', 'dim-by-search');
      });

      await test.step('[23F-C-001] "đ" folds to "d" → "88 mẫu" (CF:62-69)', async () => {
        await find('đ', 88);
        await shot(page, '23F-C-001', 'search-d');
      });

      await test.step('[23F-C-002] "  chair  " is trimmed → "4 mẫu" (CF:94)', async () => {
        await find('  chair  ', 4);
        await shot(page, '23F-C-002', 'search-trim');
      });

      await test.step('[23F-A-019] clearing the box → "101 mẫu" (FLP:54-60)', async () => {
        await find('', 101);
        await shot(page, '23F-A-019', 'search-cleared');
      });

      await test.step('[23F-A-031] ⚑ tile names are Vietnamese: the first tile is not "Cactus" / "TV Stand" (IC:102-104)', async () => {
        const first = (await tileNames(panel))[0];
        expect.soft(['Cactus', 'TV Stand'], `first tile "${String(first)}"`).not.toContain(first);
        await shot(page, '23F-A-031', 'tile-names');
      });

      await test.step('[23F-A-032] footer "Thẻ đơn sắc để màu nhấn chỉ dành cho thứ bấm được" (FLP:99-101)', async () => {
        await expect.soft(panel.getByText(FL.monochromeNotice, { exact: true })).toBeVisible();
        await shot(page, '23F-A-032', 'footer');
      });

      await test.step('[23F-G-001] end of flow: 0 non-GET under /api/projects/, 0 request to /api/library (static catalog, FLP:34-38)', async () => {
        expect.soft(nonGetUnderProjects(log)).toEqual([]);
        expect.soft(log.filter((e) => e.path.startsWith('/api/library')).map((e) => e.path)).toEqual([]);
        await shot(page, '23F-G-001', 'no-api', `non-GET under /api/projects/: ${String(nonGetUnderProjects(log).length)}`);
      });
    } finally {
      await closeAdminSession(s);
    }
  });

  /* ======================================================================== FL-23F-03 */
  test('SCR-23 · FL-23F-03 · Thư viện: dải "Đã phát hiện" → xem trước → áp → hoàn tác', async ({ browser }) => {
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page, log } = s;
      const seeded = await seedFX(s, 'p3-f03');
      await openPascal(page, seeded.projectId);
      const panel = await openRailPanel(page, FL.title);
      const strip = detectedStrip(panel);
      const chairs = detectedRow(panel, 'ghế (3)');
      const dialog = page.getByRole('dialog', { name: FL.previewTitle('ghế', 3), exact: true });
      let applyPut: Promise<number | null> = Promise.resolve(null);

      await test.step('[23F-A-021] strip "Đã phát hiện", its hint, row "bàn (1)" (DFS:154-186)', async () => {
        await expect(strip).toBeVisible();
        await expect(strip.getByText(FL.detectedHint, { exact: true })).toBeVisible();
        await expect(detectedRow(panel, 'bàn (1)')).toBeVisible();
        await shot(page, '23F-A-021', 'strip');
      });

      await test.step('[23F-A-022] groups in first-seen order: "bàn (1)" then "ghế (3)" (BR:151-159)', async () => {
        await expect.soft(strip.locator('li > span')).toHaveText(['bàn (1)', 'ghế (3)']);
        await shot(page, '23F-A-022', 'strip-order');
      });

      await test.step('[23F-E-006] the section is a named region "Đã phát hiện" (DFS:155)', async () => {
        await expect.soft(panel.getByRole('region', { name: FL.detectedTitle, exact: true })).toHaveCount(1);
        await shot(page, '23F-E-006', 'region-name');
      });

      await test.step('[23F-A-023] no tile picked: "Thay thế tất cả" disabled, title "Chọn một mẫu trong thư viện trước" (DFS:175-183)', async () => {
        await expect.soft(replaceButton(chairs)).toBeDisabled();
        await expect.soft(replaceButton(chairs)).toHaveAttribute('title', FL.replaceAllNeedsItem);
        await shot(page, '23F-A-023', 'replace-disabled');
      });

      await test.step('[23F-A-020] chip "Ghế", click "Dining Chair" → tile `ring-2`; "Thay thế tất cả" enabled (IC:63-84)', async () => {
        await chip(panel, 'Ghế').click();
        await tile(panel, 'Dining Chair').click();
        await expect.soft(tile(panel, 'Dining Chair')).toHaveClass(classToken('ring-2'));
        await expect.soft(replaceButton(chairs)).toBeEnabled();
        await shot(page, '23F-A-020', 'tile-picked');
      });

      await test.step('[23F-E-004] the tile is a button named "Dining Chair" (IC:66-104)', async () => {
        await expect.soft(panel.getByRole('button', { name: 'Dining Chair' })).toHaveCount(1);
        await shot(page, '23F-E-004', 'tile-name');
      });

      await test.step('[23F-A-024] "Thay thế tất cả" on "ghế (3)" → dialog "Thay thế tất cả 3 ghế?", body, "ghế 1 → Dining Chair" … "ghế 3 → …"', async () => {
        await replaceButton(chairs).click();
        await expect.soft(dialog).toBeVisible();
        await expect.soft(dialog.getByText(FL.previewBody, { exact: true })).toBeVisible();
        await expect
          .soft(dialog.getByRole('list', { name: FL.previewList }).getByRole('listitem'))
          .toHaveText([1, 2, 3].map((n) => FL.previewRow('ghế', n, 'Dining Chair')));
        await shot(page, '23F-A-024', 'preview');
      });

      await test.step('[23F-E-005] focus is trapped in the dialog (4 × Tab); closing it returns focus to the row\'s "Thay thế tất cả"', async () => {
        for (let tab = 1; tab <= 4; tab += 1) {
          await page.keyboard.press('Tab');
          expect.soft(await dialog.evaluate((el) => el.contains(document.activeElement)), `Tab ${String(tab)} stays in the dialog`).toBe(true);
        }
        await shot(page, '23F-E-005', 'preview-focus');
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect.soft(replaceButton(chairs)).toBeFocused();
      });

      await test.step('[23F-A-025] "Huỷ" closes the dialog; "ghế (3)" stays (DFS:204-210)', async () => {
        await replaceButton(chairs).click();
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: FL.cancel, exact: true }).click();
        await expect.soft(dialog).toHaveCount(0);
        await expect.soft(chairs).toBeVisible();
        await shot(page, '23F-A-025', 'cancel');
      });

      await test.step('[23F-A-026] reopen, Esc: dialog gone, "ghế (3)" stays (DFS:188)', async () => {
        await replaceButton(chairs).click();
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(dialog).toHaveCount(0);
        await expect.soft(chairs).toBeVisible();
        await shot(page, '23F-A-026', 'esc');
      });

      await test.step('[23F-G-005] so far: 0 PUT …/spatial/layer since the flow began (preview is a dry run)', async () => {
        expect.soft(layerPuts(log).map((e) => e.path)).toEqual([]);
        await shot(page, '23F-G-005', 'no-put-yet', `#35 PUTs: ${String(layerPuts(log).length)}`);
      });

      await test.step('[23F-A-027] reopen, "Thay thế tất cả" in the dialog: dialog gone, no "ghế (3)" row (DFS:211-219)', async () => {
        await replaceButton(chairs).click();
        await expect(dialog).toBeVisible();
        applyPut = nextLayerPut(page).then(
          (res) => res.status(),
          () => null,
        );
        await dialog.getByRole('button', { name: FL.replaceAll, exact: true }).click();
        await expect.soft(dialog).toHaveCount(0);
        await expect.soft(chairs).toHaveCount(0);
        await shot(page, '23F-A-027', 'applied');
      });

      await test.step('[23F-G-003] ⚑ the batch is saved: 1 PUT …/spatial/layer 200, "Đã lưu lúc HH:MM", no "Chưa lưu được thay đổi" toast', async () => {
        expect.soft(await applyPut, 'PUT …/spatial/layer after "Thay thế tất cả" (null = none within the autosave timeout)').toBe(200);
        await layerIdle(log);
        expect.soft(layerPuts(log), '#35 PUTs of the flow').toHaveLength(1);
        await expect.soft(saveLine(page)).toHaveText(SAVED_AT);
        await expect.soft(toast(page, PV.saveFailed)).toHaveCount(0);
        await shot(page, '23F-G-003', 'saved', `#35 PUTs: ${String(layerPuts(log).length)}`);
      });

      await test.step('[23F-A-028] one Ctrl+Z on the canvas → "ghế (3)" back (one history step, BR:179)', async () => {
        await undoOnCanvas(page);
        await expect.soft(chairs).toBeVisible();
        await shot(page, '23F-A-028', 'undo-batch');
      });
    } finally {
      await closeAdminSession(s);
    }
  });
});
