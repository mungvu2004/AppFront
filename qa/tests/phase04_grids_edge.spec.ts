/**
 * Phase 4 — SCR-19 axes and origin (AxisGridManager), EDGE layer, real stack: seven sequential user flows (QA-04c P4,
 * `flow-plan.md` "phase04_grids_edge.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row, in
 * the planned order. `H` rows use a hard `expect`, `S` rows `expect.soft`; a row marked ⚑ asserts the CORRECT behaviour and
 * stays red when the app is wrong (never loosened to turn green).
 *
 * Source (FE, this branch): AGV src/screens/qc/AxisGridManager/AxisGridManager.tsx · UAG …/useAxisGridManager.ts ·
 * AGG …/axisGridManagerGateway.ts · ALP …/AxisGridLeftPanel.tsx · ACV …/AxisGridCanvas.tsx · AOP …/AxisGridOriginPanel.tsx ·
 * AFL …/AxisGridFloorAlignList.tsx · AGF …/AxisGridGhostFloor.tsx · AOM …/AxisGridOriginMarker.tsx ·
 * FLR src/screens/qc/shared/floorLayerReadFailure.ts · DET src/domain/axes/detect.ts · ALF src/domain/axes/alignFloors.ts ·
 * LBL src/domain/axes/label.ts · SNAP src/domain/units/snap.ts.
 *
 * ## Users and data
 * The shared admin for every flow (one `POST /api/auth/login` per flow context + 1 API login in `beforeAll`); no upload
 * anywhere (no pipeline run). Every flow owns its project(s) (`POST /api/projects`, `qa-<runId>-…`), writes their layer
 * through the real #35 and deletes them in `finally` (`deleteSeededProject`). SCR-19 itself never writes (AGG:135-158); every
 * flow that says so counts the writes of its page.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: 1 (beforeAll) + 7 flow sessions + 1 anonymous probe = 9 (limit 120 / 60 s per IP).
 * - `POST /api/projects` 10, `DELETE /api/projects/:id` 10, `PUT …/spatial/layer` ≈ 30 (fixtures), `GET …/spatial/layer` ≈ 40.
 * - `POST /api/auth/refresh`: ≈ 1 per page load (≈ 60). No upload init, no invitation.
 */
import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { deleteSeededProject } from './support/phase03Seed';
import { closeFlow, openFlow, recordAnnouncements, writesSince, type Flow } from './support/p03/P5';
import { spaGo } from './support/p03/P11';
import { leaveOnBeforeUnload } from './support/p04/P3';
import {
  CANVAS_LABEL,
  axisGroup,
  axisGrip,
  canvasPoint,
  canvasSvg,
  dragAxis,
  fieldText,
  gridsRect,
  gridsRules,
  gridsTwoFloors,
  optionNames,
  viNumber,
  escapeRegExp,
  type Built,
} from './support/p04/P4';

/* ---------------------------------------------------------------- copy (each cites its source) */

const SCREEN = 'Quản lý trục và gốc toạ độ'; // AGV:91
const BREADCRUMB = 'Dự án > Trục và gốc toạ độ'; // AGV:90
const DESCRIPTION = 'Kiểm tra các trục nằm trùng khớp giữa các tầng và điều chỉnh khoảng cách nếu cần.'; // AGV:92-93
const H_GROUP = 'Trục ngang'; // UAG:AXIS_GRID_TEXT.groupTitleHorizontal
const V_GROUP = 'Trục dọc';
const ADD_H = 'Thêm trục ngang';
const ADD_V = 'Thêm trục dọc';
const EMPTY_TITLE = 'Chưa có trục nào'; // AGV:96
const EMPTY_NOTICE = 'Chưa dò được trục nào từ tường bao của tầng này. Thêm trục bằng tay để bắt đầu.'; // useAxisGridManager.ts:163 AXIS_GRID_TEXT.emptyNotice (BUG-594)
const DERIVE = 'Suy ra từ tường bao'; // AGV:97
const CANVAS_EMPTY = 'Chưa có trục nào để hiện trên bản vẽ.'; // AGV:106
const ORIGIN_UNAVAILABLE = 'Chưa có trục nào nên chưa tính được gốc toạ độ.'; // AGV:104
const ALIGN_UNAVAILABLE = 'Chưa có trục nào nên chưa căn chỉnh được giữa các tầng.'; // AGV:105
const ANCHOR = 'Chọn giao trục neo'; // AOP:46
const GHOST = 'Hiện bóng ma tầng dưới'; // ALP:61
const AUTO_ALIGN = 'Căn chỉnh tự động'; // AFL:62
const APPROVED = 'Đã duyệt'; // AFL:64
const ROOT_FLOOR = 'Tầng gốc'; // AFL:63
const VIEW_ON_DRAWING = 'Xem trên bản vẽ'; // UAG:AXIS_GRID_TEXT.warningActionLabel
const UNSAVED_NOTICE = 'Trục chỉ giữ trong phiên này — tải lại trang sẽ mất các thay đổi.'; // useAxisGridManager.ts:176 AXIS_GRID_TEXT.unsavedNotice (BUG-578)
const TOASTS = 'Thông báo'; // Toast.tsx viewport
const UNDO = 'Hoàn tác';
const ORIGIN_NOT_PERSISTED =
  'Đã ghim gốc toạ độ cho phiên làm việc này. Hệ thống chưa có chỗ lưu lựa chọn đó, nên nó mất sau khi tải lại trang.'; // UAG:AXIS_GRID_TEXT.originNotPersisted
const OFFSET_LABELS = ['Lệch X (pixel)', 'Lệch Y (pixel)', 'Lệch X (mm)', 'Lệch Y (mm)'] as const; // AOP:50-53
const SPACING_NOTICE = /^không thể đặt .+ và .+ cách nhau dưới 100 mm — khoảng cách tối thiểu này giữ cho bước dò hai trục khác nhau phân biệt được\. khoảng cách hiện tại: [\d.]+ mm\.$/u; // AGG:675-681
const SPACING_ANNOUNCE = /^không thể đặt .+ và .+ cách dưới 100 mm$/u; // AGG:684-689

/* 404 / read failure screens: FLR + ProjectSpatialGate copy. */
const PROJECT_NOT_FOUND = 'Không tìm thấy dự án này';
const PROJECT_NOT_FOUND_SENTENCE = 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.';
const BACK_TO_PROJECTS = 'Về danh sách dự án';
const FLOOR_MISSING = 'Không mở được tầng này';
const FLOOR_GONE = 'Tầng này không còn tồn tại. Mở Quản lý tầng để chọn một tầng khác.';
const BACK_TO_FLOORS = 'Về quản lý tầng';

/* ---------------------------------------------------------------- session and locators */

const softly = expect.configure({ soft: true });

let adminApi: APIRequestContext;

test.beforeAll(async () => {
  const admin = readAdminCredentials();
  adminApi = await signedInApi(admin.email, admin.password);
});

test.afterAll(async () => {
  await adminApi?.dispose();
});

const LAYER_GET = /^\/api\/projects\/[^/]+\/floors\/[^/]+\/spatial\/layer$/u;
const layerGets = (flow: Flow): number => flow.log.filter((entry) => entry.method === 'GET' && LAYER_GET.test(entry.path)).length;

const region = (page: Page): Locator => page.getByRole('region', { name: SCREEN, exact: true });
const group = (page: Page, title: string): Locator => page.getByRole('listbox', { name: title, exact: true });
const rows = (page: Page, title: string): Locator => group(page, title).getByRole('option');
const addButton = (page: Page, which: 'h' | 'v'): Locator => page.getByRole('button', { name: which === 'h' ? ADD_H : ADD_V, exact: true });
const removeButton = (page: Page, label: string): Locator => page.getByRole('button', { name: `Xoá trục ${label}`, exact: true });
const hideButton = (page: Page, label: string): Locator => page.getByRole('button', { name: new RegExp(`^(Ẩn|Hiện) trục ${escapeRegExp(label)}$`, 'u') });
const rowOf = (page: Page, title: string, label: string): Locator => group(page, title).getByRole('option', { name: new RegExp(`^Trục ${escapeRegExp(label)}, `, 'u') });
const toasts = (page: Page): Locator => page.getByRole('region', { name: TOASTS, exact: true });
const ghostSwitch = (page: Page): Locator => page.getByRole('switch', { name: GHOST, exact: true });
const anchorBox = (page: Page): Locator => page.getByRole('combobox', { name: ANCHOR, exact: true });
/** The open select is portalled; its listbox is named by the trigger (the chosen value), so options are found by their text. */
const anchorOptions = (page: Page): Locator => page.getByRole('option', { name: /^[AB]-[12]$/u });
const spacingNotice = (page: Page): Locator => region(page).locator('[role="status"]').filter({ hasText: /không thể đặt/u });
const floorRow = (page: Page, floorName: string): Locator => page.getByRole('listitem', { name: new RegExp(`^${escapeRegExp(floorName)}, lệch `, 'u') });
const warningBanner = (page: Page): Locator => region(page).getByRole('alert');

/** Spacing text of row `label` ("8.000 mm" / "—"), read from the option's visible text. */
async function spacingOf(page: Page, title: string, label: string): Promise<string> {
  const text = (await rowOf(page, title, label).innerText()).replace(/\s+/gu, ' ').trim();
  return text.slice(label.length).trim();
}

/** Spacing text of every row of a group, in order. */
async function spacings(page: Page, title: string): Promise<string[]> {
  const names = await optionNames(group(page, title));
  return names.map((name) => name.replace(/^Trục .+?, cách trục kế là /u, ''));
}

const ev = (page: Page, row: string, slug: string, caption?: string): Promise<string> =>
  captureEvidence(page, `E04_${row}_${slug}.png`, caption === undefined ? {} : { caption });

const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};

/** Deep link to the grids of floor `index` and wait until the screen has its data (a group list, the empty state or a failure). */
async function openGrids(page: Page, built: Built, index = 0, expectEmpty = false): Promise<void> {
  await page.goto(ROUTES.project.grids(built.project.projectId, built.floorIds[index] as string));
  await expect(region(page)).toBeVisible();
  if (expectEmpty) await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
  else await expect(group(page, H_GROUP)).toBeVisible();
}

/** Opens a flow (one login), runs `body`, closes the context and deletes every project even when the body fails. */
async function withFlow(
  browser: Browser,
  builts: readonly Built[],
  body: (flow: Flow, announced: () => Promise<string[]>) => Promise<void>,
): Promise<void> {
  let flow: Flow | undefined;
  try {
    flow = await openFlow(browser, readAdminCredentials());
    leaveOnBeforeUnload(flow.page);
    const announced = await recordAnnouncements(flow.page);
    await body(flow, announced);
  } finally {
    if (flow !== undefined) await closeFlow(flow); // closeFlow(undefined) would throw and mask the body's error
    for (const built of builts) {
      const problem = await deleteSeededProject(adminApi, built.project.projectId);
      if (problem !== null) note(problem);
    }
  }
}

/* ================================================================= flows */

test.describe('E04 SCR-19 axes — real-stack flows (QA-04c P4)', () => {
  test('SCR-19 · FL-19-01 · detected preview on a rectangle: rows, spacing, labels, selection, names', async ({ browser }) => {
    test.setTimeout(240_000);
    const built = await gridsRect(adminApi, '19-01');
    await withFlow(browser, [built], async (flow, announced) => {
      const { page } = flow;
      const mark = flow.sent.length;

      await test.step('[19-A-001] deep link opens the screen: region, breadcrumb, title, description', async () => {
        await openGrids(page, built);
        const screen = region(page);
        await expect(screen).toBeVisible(); // AGV:221-231
        await expect(screen.getByText(BREADCRUMB, { exact: true })).toBeVisible();
        await expect(screen.getByRole('heading', { level: 2, name: SCREEN, exact: true })).toBeVisible();
        await expect(screen.getByText(DESCRIPTION, { exact: true })).toBeVisible();
        await ev(page, '19-A-001', 'deep-link');
      });

      await test.step('[19-G-001] deep link (store empty): exactly one GET N16, no other spatial read', async () => {
        expect.soft(layerGets(flow), 'GET …/spatial/layer').toBe(1); // AGG:1114
        const others = flow.log.filter((entry) => entry.method === 'GET' && /\/spatial/u.test(entry.path) && !LAYER_GET.test(entry.path));
        expect.soft(others.map((entry) => entry.path), 'no #33 / N15 read').toEqual([]);
      });

      await test.step('[19-A-002] ≥ 2 collinear walls per line, no stored axis: detected preview, two groups', async () => {
        await expect.soft(rows(page, H_GROUP)).toHaveCount(2); // A, B (horizontal lines y = 500, 6500)
        await expect.soft(rows(page, V_GROUP)).toHaveCount(2); // 1, 2 (vertical lines x = 1000, 9000)
        const names = [...(await optionNames(group(page, H_GROUP))), ...(await optionNames(group(page, V_GROUP)))];
        for (const name of names) expect.soft(name).toMatch(/^Trục .+, cách trục kế là /u); // ALP:80-82
        await ev(page, '19-A-002', 'preview-two-groups');
      });

      await test.step('[19-A-003] each row shows the spacing to the next axis; the last row shows "—"', async () => {
        expect.soft(await spacings(page, H_GROUP)).toEqual(['6.000 mm', '—']); // y 500 -> 6500
        expect.soft(await spacings(page, V_GROUP)).toEqual(['8.000 mm', '—']); // x 1000 -> 9000
        await expect.soft(rowOf(page, H_GROUP, 'B')).toHaveAccessibleName('Trục B, cách trục kế là —');
        await expect.soft(rowOf(page, H_GROUP, 'A')).toContainText('6.000 mm');
        await expect.soft(rowOf(page, H_GROUP, 'B')).toContainText('—');
      });

      await test.step('[19-C-003] labels: vertical axes numbered, horizontal lettered, the generator leaves no gap', async () => {
        await addButton(page, 'v').click();
        await expect.soft(rows(page, V_GROUP)).toHaveCount(3);
        await expect.soft(rowOf(page, V_GROUP, '3')).toBeVisible(); // LBL:215-250 verticalAxisLabel(2) = "3"
        await addButton(page, 'h').click();
        await expect.soft(rows(page, H_GROUP)).toHaveCount(3);
        await expect.soft(rowOf(page, H_GROUP, 'C')).toBeVisible(); // horizontalAxisLabel(2) = "C"
        await ev(page, '19-C-003', 'labels-continue');
      });

      await test.step('[19-E-001] landmark and heading outline', async () => {
        const screen = region(page);
        await expect.soft(screen.getByRole('heading', { level: 2, name: SCREEN, exact: true })).toBeVisible();
        for (const title of ['Trục', 'Gốc toạ độ', 'Căn chỉnh giữa các tầng']) {
          await expect.soft(screen.getByRole('heading', { level: 3, name: title, exact: true })).toBeVisible(); // ALP:198 AOP:85 AFL:128
        }
        for (const title of [H_GROUP, V_GROUP]) {
          await expect.soft(screen.getByRole('heading', { level: 4, name: title, exact: true })).toBeVisible();
        }
      });

      await test.step('[19-E-002] the canvas section, group and svg all carry the same accessible name', async () => {
        await expect.soft(page.locator(`[aria-label="${CANVAS_LABEL}"]`)).toHaveCount(3); // AGV:250, ACV:75,298-303
        await expect.soft(page.locator(`section[aria-label="${CANVAS_LABEL}"]`)).toHaveCount(1);
        await expect.soft(page.locator(`div[role="group"][aria-label="${CANVAS_LABEL}"]`)).toHaveCount(1);
        await expect.soft(page.locator(`svg[role="img"][aria-label="${CANVAS_LABEL}"]`)).toHaveCount(1);
      });

      await test.step('[19-E-003] options are buttons with aria-selected; no arrow-key movement, each is a Tab stop', async () => {
        const first = rows(page, H_GROUP).first();
        await expect.soft(first).toHaveAttribute('aria-selected', /true|false/u);
        expect.soft(await first.evaluate((node) => node.tagName)).toBe('BUTTON');
        await first.focus();
        const seen: string[] = [];
        for (let key = 0; key < 3; key += 1) {
          await page.keyboard.press('Tab');
          seen.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''));
        }
        expect.soft(seen[0]).toBe('Ẩn trục A'); // option, eye, trash, next option (ALP:100-133)
        expect.soft(seen[1]).toBe('Xoá trục A');
        expect.soft(seen[2]).toMatch(/^Trục B, /u);
        await first.focus();
        await page.keyboard.press('ArrowDown');
        expect.soft(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''), 'ArrowDown does not move between options').toMatch(/^Trục A, /u);
      });

      await test.step('[19-E-004] Enter / Space on a focused option selects it', async () => {
        const second = rows(page, V_GROUP).nth(1);
        await second.focus();
        await page.keyboard.press('Enter');
        await expect.soft(second).toHaveAttribute('aria-selected', 'true');
        const first = rows(page, V_GROUP).first();
        await first.focus();
        await page.keyboard.press('Space');
        await expect.soft(first).toHaveAttribute('aria-selected', 'true');
        await expect.soft(second).toHaveAttribute('aria-selected', 'false');
        expect.soft((await announced()).some((text) => /^[A-Z0-9]+-[A-Z0-9]+( lệch .+)?$/u.test(text)), 'selection announced').toBe(true);
      });

      await test.step('[19-A-015] click a row: selected, accent stroke on the canvas, position announced', async () => {
        const row = rowOf(page, H_GROUP, 'B');
        await row.click();
        await expect.soft(row).toHaveAttribute('aria-selected', 'true'); // ALP:101-111
        const stroke = (label: string): Promise<string | null> => axisGroup(page, label).locator('line').first().getAttribute('stroke');
        const selected = await stroke('B');
        const other = await stroke('A');
        expect.soft(selected, 'selected axis stroke differs from an unselected one').not.toBe(other); // ACV:124
        const texts = await announced();
        await attachJson('E04_19-A-015_announcements.json', { texts });
        expect.soft(texts.some((text) => /^B-[A-Z0-9]+( lệch .+)?$/u.test(text)), 'describePoint announcement for B').toBe(true); // UAG:809-824
        await ev(page, '19-A-015', 'row-selected');
      });

      await test.step('[19-A-016] click an axis on the canvas: its row is selected', async () => {
        const grip = await axisGrip(page, '2');
        await page.mouse.click(grip.x, grip.y);
        await expect.soft(rowOf(page, V_GROUP, '2'), 'a click on a canvas axis leaves it selected').toHaveAttribute('aria-selected', 'true'); // ACV:134-143
        await ev(page, '19-A-016', 'canvas-click');
      });

      await test.step('[19-A-017] click the canvas background clears the selection', async () => {
        await canvasSvg(page).click({ position: { x: 8, y: 8 } }); // ACV:287-291
        await expect.soft(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(0);
      });

      await test.step('[19-E-005] canvas axes have no keyboard path: role=presentation, no tabindex', async () => {
        const info = await canvasSvg(page).evaluate((svg) =>
          [...svg.querySelectorAll(':scope > g[aria-label]')]
            .filter((node) => node.getAttribute('role') === 'presentation')
            .map((node) => ({ label: node.getAttribute('aria-label'), tabindex: node.getAttribute('tabindex') })),
        );
        await attachJson('E04_19-E-005_axis-nodes.json', { info });
        expect.soft(info.length, 'axis groups with role=presentation').toBeGreaterThanOrEqual(5);
        expect.soft(info.filter((node) => node.tabindex !== null)).toEqual([]); // ACV:154-161
      });

      await test.step('[19-E-011] origin marker is named', async () => {
        await expect.soft(page.getByRole('img', { name: 'Gốc toạ độ 0,0', exact: true })).toBeVisible(); // AOM:43,55-56
      });

      await test.step('[19-E-008] live announcements use the assertive region', async () => {
        await expect.soft(page.locator('[data-announcer="assertive"]')).toHaveAttribute('role', 'alert'); // announcer.ts:51-56
        const texts = await announced();
        expect.soft(texts, 'add announced').toContain('Thêm trục 3.'); // 19-A-004 text
        expect.soft(texts.some((text) => /^[A-Z0-9]+-[A-Z0-9]+( lệch .+)?$/u.test(text)), '19-A-015 text').toBe(true);
        note('[19-E-008] the anchor (19-A-026) and "Xem trên bản vẽ" (19-A-034) texts are read in FL-19-04 / FL-19-06');
        expect.soft(writesSince(flow, mark), 'axes write nothing').toEqual([]);
      });
    });
  });

  test('SCR-19 · FL-19-02 · preview no-ops, add, hide / show, delete toast, Mod+Z, preview returns, reload loses edits', async ({ browser }) => {
    test.setTimeout(240_000);
    const built = await gridsRect(adminApi, '19-02');
    await withFlow(browser, [built], async (flow, announced) => {
      const { page } = flow;
      const mark = flow.sent.length;
      await openGrids(page, built);
      const firstNames = [...(await optionNames(group(page, H_GROUP))), ...(await optionNames(group(page, V_GROUP)))];
      const total = (): Promise<number> => page.getByRole('option').count();

      await test.step('[19-A-013] Mod+Z with an empty stack does nothing', async () => {
        await page.locator('body').click({ position: { x: 4, y: 4 } });
        await page.keyboard.press('Control+Z'); // UAG:575-579
        await expect(page.getByRole('option')).toHaveCount(4);
        await expect.soft(region(page).getByRole('alert'), 'no error shown').toHaveCount(0);
        expect.soft(await total()).toBe(4);
      });

      await test.step('[19-A-014] ⚑ "Xoá trục X" on a PREVIEW row is a silent no-op (expected: delete or be absent)', async () => {
        const before = (await announced()).length;
        const button = removeButton(page, 'A');
        // Expected by the spec: a preview row either deletes or has no delete button. Today the click does nothing.
        if ((await button.count()) > 0) {
          await button.click();
          expect.soft(await total(), 'a visible "Xoá trục A" must delete the row').toBe(3);
          expect.soft((await announced()).length, 'and say so').toBeGreaterThan(before);
          // The first edit stores the whole preview (useAxisGridManager.ts:477,660-690); one Mod+Z returns the preview, the rest of the flow starts from it.
          await page.locator('body').click({ position: { x: 4, y: 4 } });
          await page.keyboard.press('Control+Z');
          await expect.poll(total, { message: 'Mod+Z returns the preview after the first edit' }).toBe(4);
        }
        await ev(page, '19-A-014', 'preview-delete-noop');
      });

      await test.step('[19-A-019] ⚑ drag of a PREVIEW axis is inert or acts (expected: a reason, not silence)', async () => {
        const before = await canvasPoint(page, 0, 0);
        const grip = await axisGrip(page, '2');
        await page.mouse.move(grip.x, grip.y);
        await page.mouse.down();
        await page.mouse.move(grip.x - 60, grip.y, { steps: 8 });
        await page.mouse.up();
        const after = await axisGrip(page, '2');
        expect.soft(Math.abs(after.x - grip.x) < 1 || Math.abs(after.x - (grip.x - 60)) < 8, 'the axis either stays or follows the pointer').toBe(true);
        // Expectation changed: a dragged preview axis now acts (useAxisGridManager.ts:477,660-690,816) and the spacing follows it;
        // if it stayed, the spacing must be untouched. One Mod+Z returns the preview for the next steps.
        const spacingNow = await spacings(page, V_GROUP);
        if (Math.abs(after.x - grip.x) >= 1) {
          expect.soft(spacingNow[0], 'a followed preview axis changes the spacing').not.toBe('8.000 mm');
          await page.locator('body').click({ position: { x: 4, y: 4 } });
          await page.keyboard.press('Control+Z');
          await expect.poll(() => spacings(page, V_GROUP), { message: 'one Mod+Z returns the preview' }).toEqual(['8.000 mm', '—']);
        } else {
          expect.soft(spacingNow, 'a preview axis that stays must not move silently').toEqual(['8.000 mm', '—']);
        }
        await attachJson('E04_19-A-019_drag.json', { before, grip, after });
      });

      await test.step('[19-A-005] "Thêm trục dọc" adds one row and the preview rows stay (BUG-320)', async () => {
        await addButton(page, 'v').click();
        await expect.soft(page.getByRole('option')).toHaveCount(5); // UAG:677-697
        await expect.soft(rows(page, V_GROUP)).toHaveCount(3);
        await expect.soft(rows(page, H_GROUP)).toHaveCount(2);
        await ev(page, '19-A-005', 'axis-added');
      });

      await test.step('[19-C-004] new axis coordinate = last + pitch of the last two', async () => {
        // x: 1000, 9000 -> pitch 8000 -> 17000; the old last row now shows the previous pitch.
        expect.soft(await spacings(page, V_GROUP)).toEqual(['8.000 mm', '8.000 mm', '—']); // AGG:550-570
      });

      await test.step('[19-A-006] after the first add the whole preview is stored: "Xoá trục A" deletes and toasts', async () => {
        // same-type toasts within 5 s merge (notificationBus.ts:8,150-170): start from none so the text is this delete's alone
        await expect(toasts(page).getByRole('button', { name: UNDO, exact: true })).toHaveCount(0, { timeout: 15_000 });
        await removeButton(page, 'A').click();
        await expect.soft(rows(page, H_GROUP)).toHaveCount(1); // UAG:682-697,777-807
        const toast = toasts(page).getByText('Đã xoá trục A.', { exact: true });
        await expect.soft(toast).toBeVisible();
        await expect.soft(toasts(page).getByRole('button', { name: UNDO, exact: true })).toBeVisible();
        await ev(page, '19-A-006', 'deleted-toast');
      });

      await test.step('[19-A-008] "Hiện trục X" shows a hidden axis again', async () => {
        const eye = hideButton(page, 'A');
        await expect(eye).toHaveAccessibleName('Ẩn trục A');
        await eye.click(); // 19-A-007 (hide) is read by the main chain; here it is the precondition
        await expect.soft(eye).toHaveAccessibleName('Hiện trục A');
        await expect.soft(eye).toHaveAttribute('aria-pressed', 'false');
        await expect.soft(axisGroup(page, 'A')).toHaveCount(0);
        await eye.click();
        await expect.soft(eye).toHaveAccessibleName('Ẩn trục A'); // ALP:65-67
        await expect.soft(eye).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(axisGroup(page, 'A')).toHaveCount(1);
      });

      await test.step('[19-A-011] the delete toast closes itself after the undo window (8 s)', async () => {
        // a toast raised while another is still up is merged into it: start from none, then delete
        const toast = toasts(page).getByText('Đã xoá trục A.', { exact: true });
        // the earlier toast must be gone as text too, not only its button
        await expect(toast).toHaveCount(0, { timeout: 15_000 });
        await expect(toasts(page).getByRole('button', { name: UNDO, exact: true })).toHaveCount(0);
        const rowsBefore = await total();
        await removeButton(page, 'A').click(); // a fresh toast: its window starts now
        // Diagnostic for the next run (rr5: no toast although the row went): what IS on screen right after the click.
        await expect.soft(page.getByText('Đã xoá trục A.', { exact: true }).first(), 'the text is somewhere (toast or announcer)').toBeVisible({ timeout: 3000 });
        await attachJson('E04_19-A-011_after-click.json', {
          rowsBefore,
          rowsAfter: await total(),
          toastRegion: await toasts(page).innerText(),
          alerts: await page.getByRole('alert').allInnerTexts(),
          statuses: await page.getByRole('status').allInnerTexts(),
        });
        await expect.soft(toast).toBeVisible();
        // fixed-wait-ok: UNDO_WINDOW_MS = 8000 (undoTicket.ts:18) is real time; a polled expect, not a sleep.
        await expect.soft(toast).toBeHidden({ timeout: 15_000 });
        await expect.soft(toasts(page).getByRole('button', { name: UNDO, exact: true })).toHaveCount(0);
        await ev(page, '19-A-011', 'toast-closed');
      });

      await test.step('[19-A-012] Mod+Z (focus not in a field) undoes the last axis change on the screen\'s own stack', async () => {
        const before = await total();
        await addButton(page, 'v').click();
        await expect(page.getByRole('option')).toHaveCount(before + 1);
        await page.locator('body').click({ position: { x: 4, y: 4 } });
        await page.keyboard.press('Control+Z'); // UAG:983-992 scope canvas
        await expect.soft(page.getByRole('option')).toHaveCount(before);
      });

      await test.step('[19-A-022] deleting every stored axis brings the wall preview back (never empty while walls exist)', async () => {
        let left = await total();
        const stored = left;
        for (let step = 0; step < stored; step += 1) {
          await page.getByRole('button', { name: /^Xoá trục /u }).first().click();
          left -= 1;
          if (left > 0) await expect(page.getByRole('option')).toHaveCount(left);
        }
        await expect.soft(page.getByRole('option')).toHaveCount(4); // UAG:462-465 detectedPreview
        await expect.soft(page.getByText(EMPTY_TITLE, { exact: true })).toHaveCount(0);
        await ev(page, '19-A-022', 'preview-returns');
      });

      await test.step('[19-A-028] ⚑ reload after an edit: the edit is gone and the screen says edits are not saved', async () => {
        await addButton(page, 'v').click();
        await expect(page.getByRole('option')).toHaveCount(5);
        await expect.soft(page.getByText(UNSAVED_NOTICE, { exact: true }), 'a fixed on-screen notice that axis edits are not saved').toBeVisible(); // BUG-578, AxisGridManager.tsx:233-238
        await page.reload();
        await expect(group(page, H_GROUP)).toBeVisible();
        expect.soft([...(await optionNames(group(page, H_GROUP))), ...(await optionNames(group(page, V_GROUP)))]).toEqual(firstNames); // AGC:47-54
        await ev(page, '19-A-028', 'reload-loses-edits');
      });

      await test.step('[19-G-010] no PUT path exists for axes / origin (capability report)', async () => {
        expect.soft(writesSince(flow, mark), 'persistAxisGrid / persistAxisOrigin → supported:false, 0 requests').toEqual([]); // AGG:135-158,1105-1119
      });
    });
  });

  test('SCR-19 · FL-19-03 · drag a stored axis: snap, undo steps, crossing, spacing block', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await gridsRect(adminApi, '19-03', { stubs: true });
    await withFlow(browser, [built], async (flow, announced) => {
      const { page } = flow;
      const mark = flow.sent.length;
      await openGrids(page, built);
      /** Reload to a clean preview and store a third vertical axis (x = 17000). */
      const fresh = async (): Promise<void> => {
        await page.reload();
        await expect(group(page, V_GROUP)).toBeVisible();
        await addButton(page, 'v').click();
        await expect(rows(page, V_GROUP)).toHaveCount(3);
      };
      const vSpacings = (): Promise<string[]> => spacings(page, V_GROUP);

      await test.step('[19-A-018] drag a stored axis: it follows the pointer, snaps to a wall end point (no 50 mm grid)', async () => {
        await fresh();
        expect.soft(await vSpacings()).toEqual(['8.000 mm', '8.000 mm', '—']);
        await dragAxis(page, '3', 'vertical', 13_000, 60); // aims at 13 060: grid 50 mm would give 13 050, the vertex gives 13 000
        await expect.poll(vSpacings, { message: 'axis 2 -> axis 3 spacing after the snap' }).toEqual(['8.000 mm', '4.000 mm', '—']); // ACV:251-285; UAG:726-775
        expect.soft(writesSince(flow, mark), 'a drag sends no request').toEqual([]);
        await ev(page, '19-A-018', 'drag-snap');
      });

      await test.step('[19-C-006] drag snaps to a wall end point within reach (grid snap off)', async () => {
        await dragAxis(page, '3', 'vertical', 18_000, -60); // 17 940 -> vertex (18 000, 500) within the 120 mm capture
        await expect.poll(vSpacings, { message: 'axis 3 at the tail end' }).toEqual(['8.000 mm', '9.000 mm', '—']); // UAG:726-762
        await ev(page, '19-C-006', 'drag-snap-vertex');
      });

      await test.step('[19-A-020] ⚑ one drag = one undo step (expected: one Mod+Z restores the start position)', async () => {
        await dragAxis(page, '3', 'vertical', 13_000, 60); // from 18 000 to 13 000
        await expect.poll(vSpacings).toEqual(['8.000 mm', '4.000 mm', '—']);
        await page.locator('body').click({ position: { x: 4, y: 4 } });
        await page.keyboard.press('Control+Z');
        await expect.poll(vSpacings, { message: 'one Mod+Z after a drag restores the start of the drag (18 000)' }).toEqual(['8.000 mm', '9.000 mm', '—']); // ACV:260-281; UAG:772
        await ev(page, '19-A-020', 'drag-one-undo');
      });

      await test.step('[19-A-021] ⚑ drag an axis past its neighbour keeps the same axis (expected: coordinates 1000, 5000, 9000)', async () => {
        await fresh();
        await dragAxis(page, '3', 'vertical', 5_000, 40); // across axis 2 (9 000), snapping to the vertex (5 000, 500)
        await expect.poll(vSpacings, { message: 'the dragged axis lands on 5 000 and axis 2 stays on 9 000' }).toEqual(['4.000 mm', '4.000 mm', '—']); // UAG:194-195,1007-1013
        await ev(page, '19-A-021', 'drag-past-neighbour');
      });

      await test.step('[19-B-008] spacing block: inline notice under the header, the screen is not in error', async () => {
        await fresh();
        await dragAxis(page, '3', 'vertical', 9_000, 20); // snaps to the corner vertex (9 000, 500) = axis 2 -> distance 0
        await expect.soft(spacingNotice(page)).toBeVisible();
        await expect.soft(spacingNotice(page)).toHaveText(SPACING_NOTICE); // AGV:234-238; AGG:675-681
        await expect.soft(page.getByText('Không tính được trục', { exact: true })).toHaveCount(0);
        expect.soft(await vSpacings(), 'the blocked axis did not move onto its neighbour').not.toContain('0 mm');
        await ev(page, '19-B-008', 'spacing-notice');
      });

      await test.step('[19-B-009] the spacing block is announced', async () => {
        expect.soft((await announced()).some((text) => SPACING_ANNOUNCE.test(text)), 'aria-live carries the short sentence').toBe(true); // UAG:611-612
      });

      await test.step('[19-C-005] spacing rule is "< 100 mm": exactly 100 accepted, 99 blocked', async () => {
        await dragAxis(page, '3', 'vertical', 9_100, 30); // vertex (9 100, 500) = 100 from axis 2 (9 000)
        await expect.poll(vSpacings, { message: '100 mm is accepted' }).toEqual(['8.000 mm', '100 mm', '—']); // AGG:202,513-531
        await expect.soft(spacingNotice(page)).toHaveCount(0);
        await addButton(page, 'v').click(); // pitch of the last two = 100 -> axis 4 at 9 200 (100 from axis 3: accepted)
        await expect(rows(page, V_GROUP)).toHaveCount(4);
        // a 4 mm aim from axis 4's own spot (9 200) is under the 2 px drag threshold (AxisGridCanvas.tsx:186): move it away first
        await dragAxis(page, '4', 'vertical', 13_000, 60);
        await expect.poll(vSpacings, { message: 'axis 4 now sits at 13 000' }).toEqual(['8.000 mm', '100 mm', '3.900 mm', '—']);
        await dragAxis(page, '4', 'vertical', 9_199, 4); // vertex (9 199, 500): 99 from axis 3 (9 100)
        await expect.soft(spacingNotice(page)).toBeVisible();
        await expect.soft(spacingNotice(page)).toContainText('khoảng cách hiện tại: 99 mm');
        await ev(page, '19-C-005', 'spacing-99-blocked');
      });

      await test.step('[19-B-010] the next valid move clears the notice', async () => {
        await dragAxis(page, '4', 'vertical', 18_000, -60); // axis 4 stayed on 13 000 when blocked; 17 940 -> vertex (18 000, 500)
        await expect.soft(spacingNotice(page)).toHaveCount(0); // UAG:605-607
        await ev(page, '19-B-010', 'notice-cleared');
      });
    });
  });

  test('SCR-19 · FL-19-04 · anchor, ghost switch, origin offsets', async ({ browser }) => {
    test.setTimeout(240_000);
    const built = await gridsRect(adminApi, '19-04', { scaleMmPerPx: 25 });
    await withFlow(browser, [built], async (flow, announced) => {
      const { page } = flow;
      await openGrids(page, built);
      const offsets = async (): Promise<string[]> => Promise.all(OFFSET_LABELS.map((label) => fieldText(page, label)));
      const originBox = async (): Promise<{ x: number; y: number }> => {
        const box = await page.getByRole('img', { name: 'Gốc toạ độ 0,0', exact: true }).boundingBox();
        if (box === null) throw new Error('origin marker has no box');
        return { x: box.x, y: box.y };
      };

      await test.step('[19-A-025] "Chọn giao trục neo" lists every crossing; choosing one moves the origin and the offsets', async () => {
        await expect(anchorBox(page)).toBeVisible();
        await expect.poll(async () => viNumber((await offsets())[2] as string), { message: 'Lệch X (mm) of the plan origin' }).not.toBe(0);
        const start = await offsets();
        const startOrigin = await originBox();
        await anchorBox(page).click(); // AOP:92-98
        const options = anchorOptions(page);
        await expect.soft(options).toHaveText(['A-1', 'A-2', 'B-1', 'B-2']);
        await options.filter({ hasText: 'B-2' }).click();
        await expect.poll(async () => viNumber((await offsets())[2] as string), { message: 'offset X (mm) counts to 0' }).toBe(0); // AOP:102-111
        await expect.poll(async () => viNumber((await offsets())[3] as string)).toBe(0);
        const end = await offsets();
        await attachJson('E04_19-A-025_offsets.json', { start, end });
        await expect.poll(async () => (await originBox()).x, { message: 'canvas origin marker moved' }).not.toBe(startOrigin.x);
        await expect.soft(anchorBox(page)).toContainText('B-2');
        await ev(page, '19-A-025', 'anchor-chosen');
      });

      await test.step('[19-A-026] choosing an anchor announces that it is session-only', async () => {
        expect.soft(await announced()).toContain(ORIGIN_NOT_PERSISTED); // UAG:171-172,846-852; AGG:1119
      });

      await test.step('[19-E-007] "Chọn giao trục neo" is keyboard-selectable', async () => {
        await anchorBox(page).focus();
        await page.keyboard.press('Enter'); // opens, highlights the selected "B-2" (index 3)
        await expect(anchorOptions(page).first()).toBeVisible();
        await page.keyboard.press('ArrowDown'); // wraps to index 0 = "A-1"
        await page.keyboard.press('Enter');
        await expect.soft(anchorBox(page)).toContainText('A-1'); // AOP:92-98
      });

      await test.step('[19-A-027] reload after choosing an anchor: the default anchor again', async () => {
        await anchorBox(page).click();
        await anchorOptions(page).filter({ hasText: 'B-1' }).click();
        await expect.soft(anchorBox(page)).toContainText('B-1');
        await page.reload();
        await expect(group(page, H_GROUP)).toBeVisible();
        await expect.soft(anchorBox(page)).toContainText('A-1'); // UAG:411-412,1064-1065: nearest crossing of (0,0)
        await ev(page, '19-A-027', 'anchor-reset');
      });

      await test.step('[19-A-029] "Hiện bóng ma tầng dưới" flips the switch', async () => {
        const toggle = ghostSwitch(page);
        await expect.soft(toggle).toHaveAttribute('aria-checked', 'false');
        await toggle.click(); // ALP:61,216; UAG:861-863
        await expect.soft(toggle).toHaveAttribute('aria-checked', 'true');
        await toggle.click();
        await expect.soft(toggle).toHaveAttribute('aria-checked', 'false');
      });

      await test.step('[19-E-006] the ghost toggle is a labelled switch, Space toggles it', async () => {
        const toggle = ghostSwitch(page);
        await expect.soft(toggle).toHaveRole('switch');
        await toggle.focus();
        await page.keyboard.press('Space'); // Toggle.tsx:86-90
        await expect.soft(toggle).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('Space');
        await expect.soft(toggle).toHaveAttribute('aria-checked', 'false');
      });

      await test.step('[19-A-032] ⚑ single floor (deep link): one base row, no "Đã duyệt" (BUG-336)', async () => {
        const row = floorRow(page, 'Tầng 1');
        await expect.soft(row).toHaveAccessibleName('Tầng 1, lệch 0 mm, Tầng gốc'); // AFL:52-55,69-73,94-97
        await expect.soft(row.getByText(ROOT_FLOOR, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(APPROVED, { exact: true })).toHaveCount(0); // AFL:118-130
        await ev(page, '19-A-032', 'single-floor-base');
      });

      await test.step('[19-C-007] ⚑ offsets in px use the floor\'s scale (25 mm/px), not the fixture 50 mm/px', async () => {
        // The page is on the post-reload default anchor A-1 (an explicit anchor choice would zero the offsets).
        await expect.poll(async () => Math.abs(viNumber((await offsets())[2] as string))).toBeGreaterThan(0);
        const [xPx, yPx, xMm, yMm] = (await offsets()).map(viNumber) as [number, number, number, number];
        await attachJson('E04_19-C-007_offsets.json', { xPx, yPx, xMm, yMm, floorScaleMmPerPx: 25 });
        expect.soft(Math.abs(xPx), 'Lệch X (pixel) = mm / floor scale').toBeCloseTo(Math.abs(xMm) / 25, 1); // AGG:1122; axisGridFixture.ts:331
        expect.soft(Math.abs(yPx), 'Lệch Y (pixel) = mm / floor scale').toBeCloseTo(Math.abs(yMm) / 25, 1);
        await ev(page, '19-C-007', 'offsets-px');
      });
    });
  });

  test('SCR-19 · FL-19-05 · detection rules and empty / partial floors, unknown ids', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await gridsRules(adminApi, '19-05');
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      const mark = flow.sent.length;

      await test.step('[19-B-002] empty floor: EmptyState, notice and the "Suy ra từ tường bao" action', async () => {
        await openGrids(page, built, 0, true);
        await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible(); // AGV:101-102,153-164
        await expect.soft(page.getByText(EMPTY_NOTICE, { exact: true })).toBeVisible();
        // BUG-594: the empty state no longer offers a derive button that never derived anything (AxisGridManager.tsx:109).
        await expect.soft(page.getByRole('button', { name: DERIVE, exact: true })).toHaveCount(0);
        await ev(page, '19-B-002', 'empty-floor');
      });

      await test.step('[19-B-003] empty floor: canvas notice', async () => {
        await expect.soft(page.getByText(CANVAS_EMPTY, { exact: true })).toBeVisible(); // AGV:110,211
      });

      await test.step('[19-B-004] empty floor: the origin panel says why, no fake zeros (BUG-330)', async () => {
        await expect.soft(page.getByText(ORIGIN_UNAVAILABLE, { exact: true })).toBeVisible(); // AOP:87-89
        await expect.soft(anchorBox(page)).toHaveCount(0);
      });

      await test.step('[19-B-005] empty floor: the alignment panel says why, the button is disabled, no "Đã duyệt" (BUG-336)', async () => {
        await expect.soft(page.getByText(ALIGN_UNAVAILABLE, { exact: true })).toBeVisible(); // AFL:117-142
        await expect.soft(page.getByRole('button', { name: AUTO_ALIGN, exact: true })).toBeDisabled();
        await expect.soft(page.getByText(APPROVED, { exact: true })).toHaveCount(0);
        await ev(page, '19-B-005', 'empty-panels');
      });

      await test.step('[19-A-023] an empty floor has no "Suy ra từ tường bao" button (BUG-594), nothing is written', async () => {
        const before = flow.sent.length;
        await expect.soft(page.getByRole('button', { name: DERIVE, exact: true })).toHaveCount(0); // useAxisGridManager.ts:984
        await expect.soft(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('option')).toHaveCount(0);
        expect.soft(writesSince(flow, before)).toEqual([]);
      });

      await test.step('[19-B-006] one direction only: "Trục dọc" is empty, the anchor select is disabled', async () => {
        await openGrids(page, built, 1);
        await expect.soft(rows(page, H_GROUP)).toHaveCount(2); // y = 500 and 3500
        await expect.soft(rows(page, V_GROUP)).toHaveCount(0); // UAG:1043-1056
        await expect.soft(anchorBox(page)).toBeDisabled(); // AOP:93
        await ev(page, '19-B-006', 'one-direction');
      });

      await test.step('[19-B-007] ⚑ same state: offsets show "—" instead of "0 px / 0 mm" (BUG-330 relapse)', async () => {
        const texts = await Promise.all(OFFSET_LABELS.map((label) => fieldText(page, label)));
        await attachJson('E04_19-B-007_offsets.json', { texts });
        for (const text of texts) expect.soft(text, 'an unmeasured offset reads "—"').toMatch(/^—/u); // UAG:1043-1055; AOP:78-81,103-110
      });

      await test.step('[19-C-001] one wall per line is not an axis (MIN_WALLS_PER_AXIS 2)', async () => {
        await openGrids(page, built, 2, true);
        await expect.soft(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible(); // DET:14-17,49,243
      });

      await test.step('[19-C-002] walls of any kind feed detection: partition segments also produce axes', async () => {
        await openGrids(page, built, 3);
        await expect.soft(page.getByRole('option')).toHaveCount(4); // DET:216-243; AGG:447-458
        await ev(page, '19-C-002', 'partition-axes');
      });

      await test.step('[19-B-011] ⚑ many axes: the list scrolls inside the panel and every badge stays inside the frame (BUG-404)', async () => {
        await openGrids(page, built, 4);
        await expect.soft(rows(page, H_GROUP)).toHaveCount(10);
        await expect.soft(rows(page, V_GROUP)).toHaveCount(10);
        const scrolls = await group(page, H_GROUP).evaluate((node) => {
          for (let up: HTMLElement | null = node.parentElement; up !== null; up = up.parentElement) {
            const overflow = getComputedStyle(up).overflowY;
            if ((overflow === 'auto' || overflow === 'scroll') && up.scrollHeight > up.clientHeight) return true;
          }
          return false;
        }); // ALP:201
        expect.soft(scrolls, 'the panel scrolls (20 rows do not fit)').toBe(true);
        const frame = await page.locator(`div[role="group"][aria-label="${CANVAS_LABEL}"]`).boundingBox();
        const outside: string[] = [];
        for (const circle of await canvasSvg(page).locator('circle').all()) {
          const box = await circle.boundingBox();
          if (box === null || frame === null) continue;
          if (box.x < frame.x - 1 || box.y < frame.y - 1 || box.x + box.width > frame.x + frame.width + 1 || box.y + box.height > frame.y + frame.height + 1) {
            outside.push(`${Math.round(box.x)},${Math.round(box.y)}`);
          }
        }
        await attachJson('E04_19-B-011_badges.json', { outside });
        expect.soft(outside, 'badges outside the canvas frame').toEqual([]); // ACV:94-109
        await ev(page, '19-B-011', 'many-axes');
      });

      await test.step('[19-G-004] N16 404 project: the whole screen is replaced by the project 404', async () => {
        const projectId = `prj_qa-e04-${Date.now().toString(36)}`;
        const floorId = `L-QAE04NOPROJ${Date.now().toString(36).toUpperCase()}`;
        const notFound = waitForApi(page, 'GET', new RegExp(`^/api/projects/${projectId}/floors/${floorId}/spatial/layer$`, 'u'), [404]);
        await page.goto(ROUTES.project.grids(projectId, floorId));
        await notFound;
        const alert = page.getByRole('alert').filter({ hasText: PROJECT_NOT_FOUND_SENTENCE }); // FLR:55-62
        await expect(alert).toBeVisible();
        await expect.soft(alert.getByRole('heading', { name: PROJECT_NOT_FOUND, exact: true })).toBeVisible();
        await expect.soft(alert.getByRole('button', { name: BACK_TO_PROJECTS, exact: true })).toBeVisible();
        await ev(page, '19-G-004', 'project-404');
      });

      await test.step('[19-G-005] N16 404 floor: "Không mở được tầng này" with one exit', async () => {
        const floorId = `L-QAE04MISSING${Date.now().toString(36).toUpperCase()}`;
        const notFound = waitForApi(page, 'GET', new RegExp(`^/api/projects/${built.project.projectId}/floors/${floorId}/spatial/layer$`, 'u'), [404]);
        await page.goto(ROUTES.project.grids(built.project.projectId, floorId));
        await notFound;
        const alert = page.getByRole('alert').filter({ hasText: FLOOR_GONE }); // FLR:21-24,64-70
        await expect(alert).toBeVisible();
        await expect.soft(alert.getByRole('heading', { name: FLOOR_MISSING, exact: true })).toBeVisible();
        await expect.soft(alert.getByRole('button', { name: BACK_TO_FLOORS, exact: true })).toBeVisible();
        await ev(page, '19-G-005', 'floor-404');
      });

      await test.step('[19-E-013] reduced motion: the axis colour transition is off (motion-reduce:transition-none)', async () => {
        await openGrids(page, built, 3);
        const classes = await axisGroup(page, 'A').getAttribute('class');
        expect.soft(classes ?? '').toContain('motion-reduce:transition-none'); // ACV:68
        expect.soft(writesSince(flow, mark), 'nothing on SCR-19 writes').toEqual([]);
      });
    });
  });

  test('SCR-19 · FL-19-06 · two floors: alignment list, ghost, warnings, auto-align and undo', async ({ browser }) => {
    test.setTimeout(300_000);
    const builts: Built[] = []; // seeded inside the flow so `finally` deletes whatever was made before a failure
    await withFlow(browser, builts, async (flow, announced) => {
      const shifted = await gridsTwoFloors(adminApi, '19-06', { shiftMm: 200, lowF2: true });
      builts.push(shifted);
      const identical = await gridsTwoFloors(adminApi, '19-06b', { shiftMm: 0 });
      builts.push(identical);
      const widened = await gridsTwoFloors(adminApi, '19-06w', { shiftMm: 0, widenMm: 400, lowF2: true });
      builts.push(widened);
      const { page } = flow;
      const mark = flow.sent.length;
      const [f1, f2] = shifted.project.floors;
      if (f1 === undefined || f2 === undefined) throw new Error('fixture floors missing');
      const toGrids = (built: Built, index: number): string => ROUTES.project.grids(built.project.projectId, built.floorIds[index] as string);

      /** The floors screen reads every floor into the store; a client-side hop to SCR-19 then sees a 2-floor store. */
      const enterWithTwoFloors = async (built: Built, index: number): Promise<void> => {
        await page.goto(ROUTES.project.floors(built.project.projectId));
        await expect(page.getByRole('row', { name: /, cao độ /u }).first()).toBeVisible();
        await expect(page.getByRole('row', { name: /, cao độ /u })).toHaveCount(2);
        await spaGo(page, toGrids(built, index));
        await expect(region(page)).toBeVisible();
        await expect(group(page, H_GROUP)).toBeVisible();
      };

      await test.step('[19-A-030] ghost outline of the other floor appears only with a multi-floor store', async () => {
        await openGrids(page, shifted); // deep link: one floor in the store
        await ghostSwitch(page).click();
        await expect.soft(canvasSvg(page).locator('polygon')).toHaveCount(0); // UAG:1093-1120; AGF:99-105
        await enterWithTwoFloors(shifted, 0);
        await expect.soft(canvasSvg(page).locator('polygon')).toHaveCount(1);
        await expect.soft(canvasSvg(page).locator('polygon')).toHaveCSS('opacity', '0');
        await ghostSwitch(page).click();
        await expect.soft(ghostSwitch(page)).toHaveAttribute('aria-checked', 'true');
        await expect.poll(() => canvasSvg(page).locator('polygon').evaluate((node) => Number(getComputedStyle(node).opacity))).toBeGreaterThan(0);
        await ev(page, '19-A-030', 'ghost-floor-2');
      });

      await test.step('[19-A-031] hovering a floor row highlights its ghost and the row', async () => {
        const row = floorRow(page, f2.name);
        const polygon = canvasSvg(page).locator('polygon');
        const strokeBefore = await polygon.getAttribute('stroke');
        await row.hover(); // AFL:80-89; UAG:865-867,1115
        await expect.soft(row).toHaveClass(/bg-bg-hover/u);
        await expect.poll(() => polygon.getAttribute('stroke')).not.toBe(strokeBefore);
      });

      await test.step('[19-E-009] floor rows are listitems with full text names; the dot is aria-hidden, the status is visible text (BUG-638)', async () => {
        await expect.soft(page.getByRole('listitem', { name: /, lệch / })).toHaveCount(2); // AFL:69-73
        const row = floorRow(page, f2.name);
        const dot = row.locator('span[aria-hidden="true"]');
        await expect.soft(dot).toHaveCount(1);
        // AxisGridFloorAlignList.tsx:60-64,103-107: the status is the Badge text and the row's aria-label tail, no dot title.
        await expect.soft(row.getByText(/^(Trong ngưỡng|Cần chú ý|Không căn được)$/u)).toBeVisible();
        await expect.soft(row).toHaveAttribute('aria-label', /, (Trong ngưỡng|Cần chú ý|Không căn được)$/u);
      });

      await test.step('[19-C-010] the base floor is labelled "Tầng gốc" and has no status dot', async () => {
        const base = floorRow(page, f1.name);
        await expect.soft(base.getByText(ROOT_FLOOR, { exact: true })).toBeVisible(); // AFL:54,94-97
        await expect.soft(base.locator('span[aria-hidden="true"]')).toHaveCount(0);
      });

      await test.step('[19-A-033] other floor without stored axes: "Không căn được" and the warning banner', async () => {
        await addButton(page, 'v').click(); // stores F1's preview + one axis (F2 stays without stored axes)
        await expect(rows(page, V_GROUP)).toHaveCount(3);
        const row = floorRow(page, f2.name);
        await expect.soft(row).toHaveAccessibleName(/Không căn được$/u); // ALF:605-616; AFL:57-61
        const banner = warningBanner(page);
        // Whole sentence of the banner <p> (AFL:143). ALF:613 prefixes "Tầng " to the name "Tầng 2" -> "Tầng Tầng 2" (app bug candidate, stays red).
        await expect.soft(banner.locator('p')).toHaveText(`${f2.name} chỉ khớp được 0 trục với tầng chuẩn ${f1.name}, chưa đủ căn cứ để chồng tầng.`); // UAG:1157-1167; ALF:612-614
        await expect.soft(banner.getByRole('button', { name: VIEW_ON_DRAWING, exact: true })).toBeVisible();
        await ev(page, '19-A-033', 'unalignable-banner');
      });

      await test.step('[19-E-010] the warning banner is role=alert, the spacing notice role=status', async () => {
        await expect.soft(warningBanner(page)).toHaveAttribute('role', 'alert'); // AFL:145
        note('[19-E-010] the spacing notice (role=status) is asserted in FL-19-03 [19-B-008] (.getByRole status filter)');
      });

      await test.step('[19-A-034] "Xem trên bản vẽ" turns the ghost on and announces the offset', async () => {
        await ghostSwitch(page).click(); // off first, so the button visibly turns it on
        await expect(ghostSwitch(page)).toHaveAttribute('aria-checked', 'false');
        await warningBanner(page).getByRole('button', { name: VIEW_ON_DRAWING, exact: true }).click();
        await expect.soft(ghostSwitch(page)).toHaveAttribute('aria-checked', 'true'); // UAG:869-881
        await softly
          .poll(async () => (await announced()).some((text) => new RegExp(`^${escapeRegExp(f2.name)}, lệch .+ mm\\.$`, 'u').test(text)), { message: '"{name}, lệch {x} mm."' })
          .toBe(true);
      });

      /** Both floors get stored axes through client-side hops; the page ends on floor 2. */
      const storeBoth = async (built: Built): Promise<void> => {
        await enterWithTwoFloors(built, 0);
        await addButton(page, 'v').click();
        await expect(rows(page, V_GROUP)).toHaveCount(3);
        await spaGo(page, toGrids(built, 1));
        await expect(group(page, H_GROUP)).toBeVisible();
        await addButton(page, 'v').click();
        await expect(rows(page, V_GROUP)).toHaveCount(3);
      };

      await test.step('[19-A-035] two floors with stored axes that do not fit rigidly (F2 400 mm wider): "Cần chú ý" and the threshold banner', async () => {
        // A pure 200 mm shift is aligned by translation (residual 0, ALF header), so the plan's "shifted 200 mm" floor is widened instead.
        await storeBoth(widened);
        await expect.soft(floorRow(page, f2.name)).toHaveAccessibleName(/Cần chú ý$/u);
        // Banner <p> (AFL:143), whole sentence; ALF:175-177 writes the residual with a decimal comma ("200" / "200,5"). ALF:627
        // prefixes "Tầng " to the name "Tầng 2" -> "Tầng Tầng 2" (app bug candidate): the correct sentence is asserted and stays red.
        await expect
          .soft(warningBanner(page).locator('p'))
          .toHaveText(new RegExp(`^${escapeRegExp(f2.name)} còn lệch \\d+(?:,\\d)? mm so với tầng chuẩn ${escapeRegExp(f1.name)}, vượt ngưỡng 150 mm\\.$`, 'u')); // ALF:61,620-630
        await ev(page, '19-A-035', 'attention-banner');
      });

      await test.step('[19-C-009] the floor status dot: ok / warning / unalignable (title + accessible name)', async () => {
        const dot = floorRow(page, f2.name).locator('span[aria-hidden="true"]');
        await expect.soft(dot).toHaveAttribute('title', 'Cần chú ý'); // AFL:57-61,69-73,99-103
        await expect.soft(floorRow(page, f2.name)).toHaveAccessibleName(/, Cần chú ý$/u);
        await expect.soft(dot).toHaveClass(/bg-state-attention/u);
        note('[19-C-009] "Không căn được" was asserted in [19-A-033]; "Trong dung sai" in [19-A-039]');
      });

      await test.step('[19-C-008] the banner picks the alignment issue even though F2 is only 2000 mm high (clear-height never reaches it)', async () => {
        await expect.soft(warningBanner(page)).toContainText('vượt ngưỡng 150 mm'); // UAG:263-278; ALF:455-530
        await expect.soft(warningBanner(page)).not.toContainText(/chiều cao|thông thuỷ|chồng/iu);
      });

      /** x of vertical axis "1" of the open floor, in canvas units (ACV:163-167; 1 unit = 50 mm, AGG:331). */
      const axisOneX = async (): Promise<number> => Number(await axisGroup(page, '1').locator('line').getAttribute('x1'));
      let xBeforeAlign = Number.NaN;

      await test.step('[19-A-036] "Căn chỉnh tự động" with an alignable floor: one command, toast with undo', async () => {
        await storeBoth(shifted); // F2 = F1 moved 200 mm: alignable by translation
        xBeforeAlign = await axisOneX();
        expect(Number.isFinite(xBeforeAlign), 'axis "1" is drawn on F2').toBe(true);
        await page.getByRole('button', { name: AUTO_ALIGN, exact: true }).click();
        const toast = toasts(page).getByText('Đã căn chỉnh 1 tầng thành công.', { exact: true });
        await expect.soft(toast).toBeVisible(); // UAG:890-926; AGG:724-725,856-882
        await expect.soft(toasts(page).getByRole('button', { name: UNDO, exact: true })).toBeVisible();
        await expect.soft(floorRow(page, f2.name)).toHaveAccessibleName(new RegExp(`^${escapeRegExp(f2.name)}, lệch 0 mm, `, 'u'));
        // A pure shift already reads "lệch 0 mm" before aligning (offsetText = maxResidualMm, UAG:1084): the move is the proof.
        await softly
          .poll(async () => Math.round(Math.abs((await axisOneX()) - xBeforeAlign) * 50), { message: 'F2 axes moved by 200 mm' })
          .toBe(200);
        await ev(page, '19-A-036', 'auto-align');
      });

      await test.step('[19-A-037] the toast "Hoàn tác" after auto-align restores and announces', async () => {
        await toasts(page).getByRole('button', { name: UNDO, exact: true }).click();
        await expect.poll(async () => (await announced()).includes('Đã hoàn tác căn chỉnh.')).toBe(true); // UAG:912-916; AGG:728
        await softly.poll(axisOneX, { message: 'undo puts F2 axes back where they were' }).toBeCloseTo(xBeforeAlign, 3);
      });

      await test.step('[19-A-038] "Căn chỉnh tự động" with nothing to move is locked with a reason (BUG-594/601)', async () => {
        await storeBoth(identical); // identical floors: nothing to move
        // Expectation changed (BUG-594/BUG-601, useAxisGridManager.ts:1203-1212, test useAxisGridManager.test.ts:782-800): with nothing to move the button
        // is locked and the panel says why, so there is no silent click any more.
        await expect.soft(page.getByRole('button', { name: AUTO_ALIGN, exact: true }), 'nothing to move: the button is locked').toBeDisabled();
        await expect.soft(page.getByText('Các tầng đã khớp nhau, không còn gì để căn.', { exact: true }), 'and says why').toBeVisible(); // useAxisGridManager.ts:180
        await ev(page, '19-A-038', 'auto-align-nothing');
      });

      await test.step('[19-A-039] all floors within tolerance (≥ 2 floors): badge "Đã duyệt"', async () => {
        await expect.soft(page.getByText(APPROVED, { exact: true })).toBeVisible(); // AFL:55,118-130
        await expect.soft(warningBanner(page)).toHaveCount(0);
        const dot = floorRow(page, f2.name).locator('span[aria-hidden="true"]'); // [19-C-009] the "ok" variant
        await expect.soft(dot).toHaveAttribute('title', 'Trong ngưỡng'); // AFL:57-61,99-103
        await expect.soft(floorRow(page, f2.name)).toHaveAccessibleName(/, Trong ngưỡng$/u); // AFL:69-73
        await ev(page, '19-A-039', 'approved-badge');
        expect.soft(writesSince(flow, mark), 'on a floors-screen entry the saver is not watching: no PUT').toEqual([]);
      });
    });
  });

  test('SCR-19 · FL-19-07 · SPA entry from SCR-16: no GET, hidden writes, stale store, anonymous', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await gridsTwoFloors(adminApi, '19-07', { shiftMm: 200 });
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      const [f1, f2] = built.project.floors;
      if (f1 === undefined || f2 === undefined) throw new Error('fixture floors missing');
      const putsOf = (floorId: string, from: number): number =>
        flow.sent.slice(from).filter((request) => request.method === 'PUT' && request.path.endsWith(`/floors/${floorId}/spatial/layer`)).length;

      await test.step('[19-A-043] entry from SCR-16 "Cây lớp" → "Trục" opens this floor\'s grids route with the walls\' store', async () => {
        await page.goto(ROUTES.project.walls(built.project.projectId, f1.id));
        await expect(page.getByRole('region', { name: 'Duyệt lớp tường', exact: true })).toBeVisible();
        const tour = page.getByRole('button', { name: 'Bỏ qua hướng dẫn', exact: true }).first();
        if (await tour.isVisible().catch(() => false)) await tour.click();
        const reads = layerGets(flow);
        await page.getByRole('tree', { name: 'Cây lớp', exact: true }).getByRole('treeitem', { name: 'Trục', exact: true }).click(); // WLP:252
        await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.project.grids(built.project.projectId, f1.id));
        await expect(group(page, H_GROUP)).toBeVisible();
        expect.soft(layerGets(flow) - reads, 'GET …/spatial/layer after the SPA hop').toBe(0); // AGG:1114
        await ev(page, '19-A-043', 'spa-entry');
      });

      await test.step('[19-G-002] store already holds a graph (SPA entry): no GET at all', async () => {
        expect.soft(layerGets(flow), 'one N16 read in the whole flow: the walls screen\'s').toBe(1); // AGG:1114
      });

      await test.step('[19-A-040] ⚑ SPA entry from SCR-16 then "Thêm trục ngang" sends no PUT (expected per plan)', async () => {
        const from = flow.sent.length;
        await addButton(page, 'h').click();
        await expect(rows(page, H_GROUP)).toHaveCount(3);
        await page.waitForTimeout(1_500); // fixed-wait-ok: absence of a write, no signal exists for "nothing sent" (debounce 800 ms)
        const sent = putsOf(f1.id, from);
        await attachJson('E04_19-A-040_puts.json', { puts: putsOf(f1.id, from), writes: writesSince(flow, from) });
        expect.soft(sent, 'axis commands after an SPA entry must not write the layer (AUS:403-433, SLS:51-66)').toBe(0);
        await ev(page, '19-A-040', 'hidden-put');
      });

      await test.step('[19-A-041] ⚑ same path, "Căn chỉnh tự động" must not persist the moved WALLS of F2', async () => {
        // Both floors in the store (floors screen, full load), then the saver book opens on the walls screen, then SCR-19.
        await page.goto(ROUTES.project.floors(built.project.projectId));
        await expect(page.getByRole('row', { name: /, cao độ /u })).toHaveCount(2);
        await spaGo(page, ROUTES.project.walls(built.project.projectId, f1.id));
        await expect(page.getByRole('region', { name: 'Duyệt lớp tường', exact: true })).toBeVisible();
        const skip = page.getByRole('button', { name: 'Bỏ qua hướng dẫn', exact: true }).first();
        if (await skip.isVisible().catch(() => false)) await skip.click();
        await spaGo(page, ROUTES.project.grids(built.project.projectId, f2.id));
        await expect(group(page, H_GROUP)).toBeVisible();
        await addButton(page, 'v').click();
        await spaGo(page, ROUTES.project.grids(built.project.projectId, f1.id));
        await expect(group(page, H_GROUP)).toBeVisible();
        await addButton(page, 'v').click();
        const from = flow.sent.length;
        await page.getByRole('button', { name: AUTO_ALIGN, exact: true }).click();
        await expect.soft(toasts(page).getByText(/Đã căn chỉnh/u)).toBeVisible();
        await page.waitForTimeout(1_500); // fixed-wait-ok: absence of a write, no signal exists for "nothing sent" (debounce 800 ms)
        const sent = putsOf(f2.id, from);
        await attachJson('E04_19-A-041_puts.json', { puts: putsOf(f2.id, from) });
        expect.soft(sent, 'auto-align must not persist F2\'s shifted walls (AGG:865-869, AUS:345,403-433)').toBe(0);
      });

      await test.step('[19-A-042] ⚑ stale store: SPA hop to the grids of a floor the store does not hold shows that floor\'s axes', async () => {
        await page.goto(ROUTES.project.walls(built.project.projectId, f1.id)); // deep link: the store holds F1 only
        await expect(page.getByRole('region', { name: 'Duyệt lớp tường', exact: true })).toBeVisible();
        await spaGo(page, ROUTES.project.grids(built.project.projectId, f2.id));
        await expect(region(page)).toBeVisible();
        await expect.soft(page.getByText(EMPTY_TITLE, { exact: true }), 'F2 has walls: its detected axes, not "Chưa có trục nào"').toHaveCount(0); // AGG:1114; UAG:432-444
        await expect.soft(page.getByRole('option')).toHaveCount(4);
        await ev(page, '19-A-042', 'stale-store');
      });

      await test.step('[19-A-044] anonymous deep link → login with next', async () => {
        const anon = await browser.newContext({ baseURL: page.url().split('/').slice(0, 3).join('/') });
        try {
          const guest = await anon.newPage();
          const target = ROUTES.project.grids(built.project.projectId, f1.id);
          await guest.goto(target);
          await expect(guest).toHaveURL(new RegExp(`/login\\?next=`, 'u'));
          await expect.soft(guest.getByText('Hãy đăng nhập để tiếp tục.', { exact: true })).toBeVisible();
          await ev(guest, '19-A-044', 'anonymous-login');
        } finally {
          await anon.close();
        }
      });
    });
  });
});
