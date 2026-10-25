/**
 * Phase 3 — SCR-09 Floor Manager `/projects/:id/floors`, REAL flows (QA-03d P3, flow-plan.md FL-09-01 … FL-09-10).
 * One `test()` per user flow; one `test.step('[<catalog row>] …')` per flow-catalog.md row, in the planned order.
 * Observations are `expect.soft`; a step whose failure makes the rest meaningless is a hard `expect`.
 *
 * Every expected result cites the FE source (base qa/phase03-depth c16f2428):
 *   FM  src/screens/qc/FloorManager/FloorManager.tsx   FT …/FloorTable.tsx   FTR …/FloorTableRow.tsx
 *   FSC …/FloorSectionCut.tsx   FMC …/FloorManager.container.tsx   UFM …/useFloorManager.ts   FMG …/floorManagerGateway.ts
 *   RFC src/lib/commands/business/roomFloorCommands.ts   UNF src/hooks/useNumericField.ts   NF src/lib/format/number.ts
 *   TST src/components/feedback/Toast.tsx   NH …/NotificationHost.tsx   CM src/components/canvas/ContextMenu.tsx
 *   AF  src/domain/axes/alignFloors.ts   BE: AppBack apps/api/floors/{schemas,service,resolvers}.py
 *
 * ## Non-serial, own data
 * Each flow opens its own context from the stored admin session and its own project(s) through the real API
 * (`qa-<runId>-09-…`), deleted in `finally` (support/p03/P3.ts `withFloorsAdmin`). No mocks: every 4xx is produced on
 * the real stack (API writes "elsewhere": #10 POST, #11 DELETE, #34 PATCH; BE bounds 2000–10000 mm height,
 * −30000–300000 mm elevation, 50 floors).
 *
 * ## Real-backend budget per full run of this file (BE defaults + `qa-limits.override.yml`)
 * - `POST /api/auth/login`: 10 (one own admin session per flow, LOGIN_IP_LIMIT 120 / 60 s); the shared
 *   `ADMIN_STORAGE_STATE_FILE` is neither read nor written (files run in parallel). No pool user, no invitation.
 * - `POST /api/auth/refresh`: 1 per flow (fixture token) + 1 per page load ≈ 40.
 * - `POST /api/projects`: 11 (FL-09-09 makes 2), every one deleted in `finally`; no limit on that route.
 * - `POST /api/projects/:id/floors`: ≈ 20 from the UI + 7 by API; `DELETE /api/floors/:id` ≈ 14; `PATCH …/spatial` ≈ 60;
 *   `PATCH /api/floors/reorder` ≈ 8. No rate limit on the floor routes.
 * - `drawings_init`: 0 (no upload). `members_add`: 0. Mail: none.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson, captureEvidence } from './support/evidence';
import {
  DESKTOP,
  PHONE,
  apiAddFloor,
  apiDeleteFloor,
  apiPatchFloor,
  callsSince,
  classOf,
  createStack,
  floorWritesSince,
  newLevelId,
  nthCall,
  readFloors,
  recordAllAnnouncements,
  undoFromToast,
  watchWrites,
  withFloorsAdmin,
  writesSince,
  type FloorDraft,
  type FloorFull,
  type FloorsAdmin,
  type Write,
} from './support/p03/P3';

/* ---------------------------------------------------------------- copy (each cites its source) */

const SCREEN = 'Theo dõi từng tầng và làm tiếp tầng cần nhất'; // FM:70
const SECTION = 'Lát cắt các tầng theo đúng tỷ lệ chiều cao'; // FSC:43
const SCALE = 'Thang cao độ'; // FSC:47
const COLLAPSE = 'Thu gọn lát cắt'; // FSC:45
const EXPAND = 'Hiện lát cắt'; // FM:75
const BREADCRUMB_NAV = 'Đường dẫn trang'; // Breadcrumb NAV_LABEL (existing edge spec)
const ADD = 'Thêm tầng'; // FT:78
const DUPLICATE_SELECTED = 'Nhân bản tầng'; // FT:79
const AUTO = 'Tự tính cao độ'; // FT:84
const COPY_FURNITURE = 'Sao chép nội thất sang tầng mới'; // FTR:57
const CONFIRM_DUPLICATE = 'Nhân bản'; // FTR:78
const OVERRIDDEN = 'Ghi đè'; // FTR:79
const REFUSED_MARK = 'Chưa đặt được'; // FTR:81
const UPLOAD_LINK = 'Tải bản vẽ'; // FTR:56
const NO_DRAWING = 'Chưa có bản vẽ'; // FTR:53
const EMPTY_TITLE = 'Chưa có tầng nào'; // FT:76
const EMPTY_NOTICE = 'Thêm tầng đầu tiên, hoặc nhập số tầng từ màn hình tạo dự án.'; // UFM:178
const NOT_FOUND_TITLE = 'Không tìm thấy dự án này'; // ProjectSpatialGate PROJECT_NOT_FOUND_TITLE
const NOT_FOUND_SENTENCE = 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.'; // PSGATE:37-38
const BACK_TO_PROJECTS = 'Về danh sách dự án'; // PSGATE:39
const MENU = { name: 'Tuỳ chọn', rename: 'Đổi tên', duplicate: 'Nhân bản', hide: 'Ẩn khỏi mô hình 3D', show: 'Hiện trong mô hình 3D', remove: 'Xoá tầng' } as const; // CM:150, FT:159-182
const TOAST = {
  added: 'Đã thêm tầng.', // FMG:594
  renamed: 'Đã đổi tên tầng.', // FMG:595
  elevation: 'Đã đổi cao độ tầng.', // FMG:596
  height: 'Đã đổi chiều cao tầng.', // FMG:597
  reordered: 'Đã đổi thứ tự tầng.', // FMG:591
  removed: (name: string): string => `Đã xoá tầng ${name}.`, // FMG:584
  duplicated: (name: string): string => `Đã nhân bản tầng ${name}.`, // FMG:587
} as const;
const T = {
  persistFailed: 'Chưa lưu được thay đổi tầng', // UFM:181
  addRefused: 'Chưa thêm được tầng', // UFM:187
  renameRefused: 'Chưa đổi được tên tầng', // UFM:188
  undoRefused: 'Chưa hoàn tác được thay đổi tầng', // UFM:189
  idTaken: 'Mã tầng đã có trong dự án, thao tác vừa rồi đã được huỷ.', // UFM:190
  limit: 'Dự án đã đủ 50 tầng, thao tác vừa rồi đã được huỷ.', // UFM:191
  listChanged: 'Danh sách tầng vừa đổi ở nơi khác, thứ tự chưa được lưu.', // UFM:192
  idAmbiguous: 'Mã tầng này trùng với một tầng ở dự án khác của bạn nên máy chủ chưa xử lý được; thao tác vừa rồi đã được huỷ.', // UFM:193-194
  floorGone: 'Tầng này không còn trên máy chủ.', // UFM:195
  undoExpired: 'Đã quá thời gian khôi phục tầng, tầng đã xoá không lấy lại được.', // UFM:196
  undoNotLatest: 'Thay đổi này không còn là thay đổi gần nhất nên không hoàn tác được từ thông báo.', // UFM:197-198
  validation: 'Kiểm tra lại các trường được đánh dấu rồi thử lại.', // vi.json errors (catalog 09-B-032, UFM:228 describeError)
} as const;
const RENAME = {
  empty: 'Tên tầng không được để trống.', // FMG:826-827
  tooLong: 'Tên tầng dài quá 120 ký tự, hãy rút gọn lại.', // FMG:828
  bidi: 'Tên tầng có ký tự điều khiển hoặc ký tự đảo chiều chữ, hãy xoá chúng đi.', // FMG:829-830
  same: 'Tên tầng không đổi nên không có gì để lưu.', // FMG:876-880
} as const;
const CONTENTS_NOTICE = 'Tường, phòng và nội thất đi theo khi nhân bản hay xoá tầng chưa được lưu; tải lại trang sẽ mất phần thay đổi đó.'; // FMG:210
const HIDDEN_NOTICE = 'Tầng đang ẩn khỏi mô hình 3D sẽ hiện lại sau khi tải lại trang.'; // FMG:211
/** Stacked-row cell labels (FTR:71-77 StackedLabel, floorManagerTypes.ts FLOOR_COLUMN_LABELS). */
const CELL_LABELS = ['Cao độ (m)', 'Chiều cao (mm)', 'Tiến độ'] as const; // S-19: Bản vẽ/Tường/Phòng/Diện tích/Điểm luật gộp vào dòng phụ
/** UFM:205 FLOOR_RESTORE_WINDOW_MS. */
const RESTORE_WINDOW_MS = 570_000;
/** "Nothing was sent" waits past the 800 ms NumericField commit debounce (UNF:14). */
const QUIET_MS = 1_500;

/* ---------------------------------------------------------------- small helpers */

const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const pathOf = (page: Page): string => new URL(page.url()).pathname;
const quiet = (page: Page): Promise<void> => page.waitForTimeout(QUIET_MS);

const floorsRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}/floors$`, 'u');
const spatialRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}/floors/[^/]+/spatial$`, 'u');
const spatialOf = (id: string, floorId: string): RegExp => new RegExp(`^/api/projects/${esc(id)}/floors/${esc(floorId)}/spatial$`, 'u');
const deleteRe = /^\/api\/floors\/[^/]+$/u;
const deleteOf = (floorId: string): RegExp => new RegExp(`^/api/floors/${esc(floorId)}$`, 'u');
const reorderRe = /^\/api\/floors\/reorder$/u;

/** 3 m storeys stacked from 0 m ("Tầng 1…n"). */
const stackOf = (count: number, prefix = 'Tầng'): FloorDraft[] =>
  Array.from({ length: count }, (_, i) => ({ name: `${prefix} ${String(i + 1)}`, elevationMm: i * 3_000, heightMm: 3_000 }));

/** `<tr aria-label="{name}, cao độ …">` (FTR:204). */
const floorRows = (page: Page): Locator => page.getByRole('row', { name: /, cao độ /u });
const floorRow = (page: Page, name: string): Locator => page.getByRole('row', { name: new RegExp(`^${esc(name)}, cao độ `, 'u') });
const rowNames = async (page: Page): Promise<string[]> =>
  (await floorRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''))).map((label) =>
    label.replace(/, cao độ .*$/su, ''),
  );
const nameInput = (page: Page, name: string): Locator => page.getByRole('textbox', { name: `Tên tầng ${name}`, exact: true }); // FTR:258
const elevInput = (page: Page, name: string): Locator => page.getByRole('textbox', { name: `Cao độ tầng ${name}`, exact: true }); // FTR:285
const heightInput = (page: Page, name: string): Locator => page.getByRole('textbox', { name: `Chiều cao tầng ${name}`, exact: true }); // FTR:307
const kebab = (page: Page, name: string): Locator => page.getByRole('button', { name: `Thao tác khác cho tầng ${name}`, exact: true }); // FTR:396
const grip = (page: Page, name: string): Locator => page.getByRole('button', { name: `Đổi thứ tự tầng ${name}`, exact: true }); // FTR:239
const section = (page: Page): Locator => page.getByRole('region', { name: SECTION, exact: true });
const band = (page: Page, name: string): Locator => section(page).getByRole('button', { name: new RegExp(`^${esc(name)} · `, 'u') }); // FSC:99
const addButton = (page: Page): Locator => page.getByRole('button', { name: ADD, exact: true });
const autoSwitch = (page: Page): Locator => page.getByRole('switch', { name: AUTO, exact: true });
const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text }); // TST:120, NH:59-61
const breadcrumbProjects = (page: Page): Locator =>
  page.getByRole('navigation', { name: BREADCRUMB_NAV }).getByRole('button', { name: 'Dự án', exact: true }); // FM:116-126
/** Footer "{n} tầng · tổng cao {m} m · {area}" (FT:320-322), read once the count-up settled (UFM:633). */
const footer = (page: Page, floors: number, metres: string, area = '—'): Locator =>
  page.getByText(new RegExp(`^${String(floors)}\\s+tầng\\s+·\\s+tổng cao\\s+${esc(metres)}\\s+m\\s+·\\s+${esc(area)}$`, 'u'));
const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function openFloors(page: Page, projectId: string, rows: number): Promise<void> {
  await page.goto(ROUTES.project.floors(projectId));
  await expect(floorRows(page)).toHaveCount(rows);
}

async function menuAction(page: Page, floorName: string, item: string, nth = 0): Promise<void> {
  await kebab(page, floorName).nth(nth).click(); // FTR:398-401 → FT:154-186
  await page.getByRole('menu', { name: MENU.name }).getByRole('menuitem', { name: item, exact: true }).click();
}

/** Types `text` into a NumericField and commits it on blur (UNF:136-141). */
async function commitNumber(field: Locator, text: string): Promise<void> {
  await field.click();
  await field.fill(text);
  await field.blur();
}

/** Clicks a row on its "Chưa có bản vẽ" badge (no control there → the `<tr>` onClick selects it, FTR:214). */
const selectRow = (page: Page, name: string): Promise<void> => floorRow(page, name).getByText(NO_DRAWING, { exact: true }).click();

/** Accessible description of the focused element, for Tab-order traces. */
const focusedLabel = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement)) return '';
    const labelledBy = el.getAttribute('aria-labelledby');
    const byId = labelledBy === null ? null : document.getElementById(labelledBy)?.textContent ?? null;
    return (el.getAttribute('aria-label') ?? byId ?? el.textContent ?? '').trim().slice(0, 80);
  });

const bodyOf = (call: Write): Record<string, unknown> => call.body ?? {};

/**
 * After a refused floor write the screen can drop to "Không đọc được danh sách tầng" although every GET answers 200
 * (bug candidate, QA-03d P3 probe: add → API delete → toast undo → DELETE 404). The flow records it as a soft failure
 * with its own evidence, presses "Thử lại" (FT:215-223) and goes on, so the later rows are still checked.
 */
async function readable(page: Page, tag: string): Promise<void> {
  await page.waitForTimeout(1_000);
  const readError = page.getByRole('alert').filter({ hasText: 'Không đọc được danh sách tầng' });
  if ((await readError.count()) === 0) return;
  await captureEvidence(page, `E03_${tag}_read_error_after_refused_write.png`);
  expect.soft(false, `${tag}: floor list read error after a refused write (GETs 200)`).toBe(true);
  await readError.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(floorRows(page).first()).toBeVisible();
}

/* ================================================================= flows */

test.describe('SCR-09 floor manager — real flows (QA-03d P3)', () => {
  test('SCR-09 · FL-09-01 · Look at a 3-floor stack, add floors, undo through toasts and Mod+Z', async ({ browser }) => {
    await withFloors(browser, async ({ page, log, api }, project) => {
      const projectId = project.id;
      const announced = await recordAllAnnouncements(page);
      await openFloors(page, projectId, 3);

      await test.step('[09-E-001] region, h2, section, elevation scale, breadcrumb', async () => {
        await expect.soft(page.getByRole('region', { name: SCREEN, exact: true })).toBeVisible(); // FM:114
        await expect.soft(page.getByRole('heading', { level: 2, name: SCREEN, exact: true })).toBeVisible(); // FM:127
        await expect.soft(section(page)).toBeVisible(); // FSC:139
        await expect.soft(section(page).getByRole('group', { name: SCALE, exact: true })).toBeVisible(); // FSC:69-72
        await expect.soft(page.getByRole('navigation', { name: BREADCRUMB_NAV })).toBeVisible();
      });

      await test.step('[09-C-031] footer "3 tầng · tổng cao 9,0 m · —"; header big number = same total', async () => {
        await expect.soft(footer(page, 3, '9,0')).toBeVisible(); // FT:320-322, UFM:1615-1639 (no counts → "—")
        await expect.soft(section(page).locator('header').getByText('9,0 m', { exact: true })).toBeVisible(); // FSC:145
        await captureEvidence(page, 'E03_09-C-031_footer_total.png');
      });

      await test.step('[09-C-032] walls / rooms / area / QC read "—" on every floor without drawing', async () => {
        // UFM:1485-1505 counts only for floors with drawings; UFM:1539 QC "—" when no drawing (never 0 / 0 %).
        const cells = await floorRows(page).evaluateAll((rows) =>
          rows.map((row) => [...row.querySelectorAll('td')].map((td) => (td.textContent ?? '').trim())),
        );
        const dashes = cells.map((row) => row.filter((text) => text.endsWith('—')).length);
        const zeros = cells.flat().filter((text) => /(^|\D)0( %|%)?$/u.test(text));
        await attachJson('E03_09-C-032_dash_cells.json', { cells, dashes, zeros });
        expect.soft(dashes, 'walls, rooms, area, QC = "—" per row').toEqual([4, 4, 4]);
        expect.soft(zeros, 'no "0" / "0 %" cell').toEqual([]);
        await captureEvidence(page, 'E03_09-C-032_dash_cells.png');
      });

      await test.step('[09-E-003] Tab to a row: tabIndex 0, visible ring, aria-selected, aria-label', async () => {
        await addButton(page).focus();
        await page.keyboard.press('Tab'); // FT: "Thêm tầng" → table body; first <tr tabIndex=0> (FTR:234)
        const first = floorRow(page, 'Tầng 1');
        await expect.soft(first).toBeFocused();
        await expect.soft(first).toHaveAttribute('tabindex', '0');
        await expect.soft(first).toHaveAttribute('aria-selected', 'false');
        await expect.soft(first).toHaveAttribute('aria-label', 'Tầng 1, cao độ 0,0 m, cao 3,0 m, chưa có bản vẽ'); // FTR:204, BUG-263
        const ring = await first.evaluate((row) => getComputedStyle(row).boxShadow);
        expect.soft(ring, 'focus-visible ring (FTR:208)').not.toBe('none');
        await captureEvidence(page, 'E03_09-E-003_row_focus.png');
      });

      await test.step('[09-E-014] sr-only "Đổi thứ tự" / "Hành động" headers; stacked rows: header hidden, cells labelled', async () => {
        const srOnly = await page.locator('thead th .sr-only').allTextContents(); // FT:254-256
        expect.soft(srOnly).toEqual(['Đổi thứ tự', 'Hành động']);
        await expect.soft(page.locator('thead')).toBeHidden(); // FT:250 (cut open → isStacked, FM:179)
        for (const label of CELL_LABELS) await expect.soft(floorRow(page, 'Tầng 1').getByText(label, { exact: true })).toBeVisible();
      });

      let firstAddId = '';
      await test.step('[09-C-005] "Thêm tầng" → POST order 3, elevationMm 9000 (stack top), heightMm 3000', async () => {
        const mark = log.length;
        await addButton(page).click();
        const post = await nthCall(log, mark, 'POST', floorsRe(projectId)); // FMG:655-676, FMG:1291-1295
        expect(post.status).toBe(201);
        expect(bodyOf(post)).toMatchObject({ order: 3, elevationMm: 9_000, heightMm: 3_000 });
        firstAddId = String(bodyOf(post).id);
      });

      await test.step('[09-C-003] the new floor is "Tầng 4" (3 floors ≥ 0 m, "Tầng 3" taken) and its row appears', async () => {
        await expect(floorRow(page, 'Tầng 4')).toBeVisible(); // UFM:369-378 nextNewFloorName
        await captureEvidence(page, 'E03_09-C-003_new_floor_name.png');
        await attachJson('E03_09-C-003_new_floor_name.json', { rows: await rowNames(page), id: firstAddId });
      });

      const addedToast = toastWith(page, TOAST.added).first();
      const addedUndo = addedToast.getByRole('button', { name: 'Hoàn tác', exact: true });
      await test.step('[09-E-013] toast "Đã thêm tầng." is role=status aria-live polite; "Hoàn tác" reached by Tab', async () => {
        await expect.soft(addedToast).toHaveAttribute('aria-live', 'polite'); // TST:120-121
        await autoSwitch(page).focus();
        let reached = false;
        for (let i = 0; i < 60 && !reached; i += 1) {
          await page.keyboard.press('Tab');
          reached = await addedUndo.evaluate((button) => button === document.activeElement).catch(() => false);
        }
        expect.soft(reached, '"Hoàn tác" of the toast is in the Tab order').toBe(true);
        if (!reached) await addedUndo.focus();
      });

      await test.step('[09-A-002] Enter on toast "Hoàn tác" → DELETE /api/floors/:id, row gone, footer back to 3 floors', async () => {
        const mark = log.length;
        await page.keyboard.press('Enter');
        const del = await nthCall(log, mark, 'DELETE', deleteOf(firstAddId)); // UFM:891-892 inverse of an add
        expect(del.status).toBeLessThan(300);
        await expect(floorRow(page, 'Tầng 4')).toHaveCount(0);
        await expect.soft(footer(page, 3, '9,0')).toBeVisible();
        await captureEvidence(page, 'E03_09-A-002_add_undo.png');
      });

      const ids: string[] = [];
      await test.step('[09-A-003] double-click "Thêm tầng" → 2 sequential POSTs "Tầng 4", "Tầng 5", distinct ids, 5 rows', async () => {
        const mark = log.length;
        await addButton(page).dblclick(); // UFM:833 runExclusive floors:{id} queues both
        const first = await nthCall(log, mark, 'POST', floorsRe(projectId), 1);
        const second = await nthCall(log, mark, 'POST', floorsRe(projectId), 2);
        expect([first.status, second.status]).toEqual([201, 201]);
        expect([bodyOf(first).name, bodyOf(second).name]).toEqual(['Tầng 4', 'Tầng 5']);
        ids.push(String(bodyOf(first).id), String(bodyOf(second).id));
        expect(ids[0]).not.toBe(ids[1]);
        await expect(floorRows(page)).toHaveCount(5);
        await captureEvidence(page, 'E03_09-A-003_double_add.png');
      });

      // Same-type notifications within 5 s collapse into ONE toast whose ticket undoes them all (notificationBus.ts:72-190,
      // DEFAULT_GROUP_WINDOW_MS 5000): the two adds above share one "Đã thêm tầng." toast. The "older step" toast of
      // 09-A-033 is therefore made the catalog's way: an add, then a rename (another type) on top of it.
      const markUndo = log.length;
      const notLatest = toastWith(page, `${T.undoRefused} — ${T.undoNotLatest}`);
      await test.step('[09-A-033] rename on top of the adds, then "Hoàn tác" on the add toast → "không còn là thay đổi gần nhất", no request', async () => {
        const input = nameInput(page, 'Tầng 2');
        await input.fill('Tầng hai');
        await input.press('Enter');
        const rename = await nthCall(log, markUndo, 'PATCH', spatialRe(projectId));
        expect(rename.status).toBe(200);
        await expect(toastWith(page, TOAST.renamed).first()).toBeVisible();
        const markClick = log.length;
        await undoFromToast(page, TOAST.added); // the add toast is now a 4 px peek under the rename toast (TST:107-128)
        await expect.soft(notLatest.first()).toBeVisible(); // UFM:946-950
        await captureEvidence(page, 'E03_09-A-033_older_toast_refused.png');
        await quiet(page);
        expect.soft(floorWritesSince(log, markClick), 'a refused toast undo sends nothing').toEqual([]);
        await expect.soft(floorRows(page)).toHaveCount(5);
      });

      await test.step('[09-A-034] row focused Mod+Z (undoes the rename), then that step\'s toast "Hoàn tác" → same refusal', async () => {
        const mark = log.length;
        await floorRow(page, 'Tầng 1').focus();
        await page.keyboard.press('Control+z'); // UFM:1464-1473 Mod+Z
        const back = await nthCall(log, mark, 'PATCH', spatialRe(projectId));
        expect.soft(bodyOf(back).name).toBe('Tầng 2');
        await expect(nameInput(page, 'Tầng 2')).toHaveValue('Tầng 2');
        const markClick = log.length;
        await undoFromToast(page, TOAST.renamed); // its step left the history top (UFM:938-950)
        await expect.soft(notLatest.first()).toBeVisible();
        await quiet(page);
        expect.soft(floorWritesSince(log, markClick)).toEqual([]);
        await captureEvidence(page, 'E03_09-A-034_modz_then_toast.png');
      });

      await test.step('[09-A-036] Mod+Z undoes "Tầng 5" then "Tầng 4" (DELETE each); Mod+Z on an empty history → nothing', async () => {
        await floorRow(page, 'Tầng 1').focus();
        const mark = log.length;
        await page.keyboard.press('Control+z');
        await nthCall(log, mark, 'DELETE', deleteOf(ids[1] ?? ''));
        await page.keyboard.press('Control+z');
        await nthCall(log, mark, 'DELETE', deleteOf(ids[0] ?? ''));
        await expect(floorRows(page)).toHaveCount(3);
        const toastsBefore = await page.getByRole('status').filter({ hasText: /^Chưa / }).count();
        const markEmpty = log.length;
        await page.keyboard.press('Control+z'); // UFM:938-944: no step, no ticket → silent
        await quiet(page);
        expect.soft(floorWritesSince(log, markEmpty), 'empty history sends nothing').toEqual([]);
        expect.soft(await page.getByRole('status').filter({ hasText: /^Chưa / }).count()).toBeLessThanOrEqual(toastsBefore);
        await expect.soft(floorRows(page)).toHaveCount(3);
      });

      await test.step('[09-A-037] Mod+Shift+Z and Mod+Y → nothing (no redo binding)', async () => {
        const mark = log.length;
        await page.keyboard.press('Control+Shift+Z');
        await page.keyboard.press('Control+y');
        await quiet(page);
        expect.soft(floorWritesSince(log, mark), 'no redo request').toEqual([]);
        expect.soft(await rowNames(page)).toEqual(['Tầng 1', 'Tầng 2', 'Tầng 3']);
        await attachJson('E03_09-A-037_no_redo.json', { writesSinceUndoSteps: writesSince(log, markUndo) });
      });
      await test.step('[09-B-024] add, API-DELETE it, toast "Hoàn tác" → DELETE 404 → row stays + "Chưa lưu được…" toast', async () => {
        const mark = log.length;
        await addButton(page).click();
        const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
        const newId = String(bodyOf(post).id);
        expect(await apiDeleteFloor(api, newId), 'the other writer deletes it').toBeLessThan(300);
        await undoFromToast(page, TOAST.added);
        const del = await nthCall(log, mark, 'DELETE', deleteOf(newId));
        expect(del.status).toBe(404);
        await readable(page, '09-B-024');
        await expect.soft(floorRow(page, String(bodyOf(post).name))).toBeVisible(); // UFM:984-993 redo
        await expect.soft(toastWith(page, `${T.persistFailed} — ${T.floorGone}`).first()).toBeVisible(); // UFM:224-226
        expect.soft((await announced()).map((x) => x.text), 'say() also announces the failure (UFM:690-699)').toContain(T.floorGone);
        await captureEvidence(page, 'E03_09-B-024_undo_inverse_404.png');
      });
    }, stackOf(3), '09-fl01');
  });

  test('SCR-09 · FL-09-02 · Rename floors: menu, blur, undo, every refusal, 120-char name, concurrent delete, leave', async ({ browser }) => {
    test.setTimeout(150_000);
    await withFloors(browser, async ({ page, log, api, context }, project) => {
      const projectId = project.id;
      const [f1, f2] = project.floors;
      if (f1 === undefined || f2 === undefined) throw new Error('setup: 2 floors');
      await openFloors(page, projectId, 2);

      await test.step('[09-E-005] row menu by keyboard: Enter, ArrowDown/Up/Home/End, Escape back to the kebab', async () => {
        const opener = kebab(page, 'Tầng 1');
        await opener.focus();
        await page.keyboard.press('Enter');
        const menu = page.getByRole('menu', { name: MENU.name }); // CM:149-151
        await expect(menu).toBeVisible();
        const items = menu.getByRole('menuitem');
        await expect.soft(items.nth(0)).toBeFocused(); // CM:124-128 first item
        await page.keyboard.press('ArrowDown');
        await expect.soft(items.nth(1)).toBeFocused();
        await page.keyboard.press('ArrowUp');
        await expect.soft(items.nth(0)).toBeFocused();
        await page.keyboard.press('End');
        await expect.soft(items.nth(3)).toBeFocused();
        await captureEvidence(page, 'E03_09-E-005_menu_keyboard.png');
        await page.keyboard.press('Home');
        await expect.soft(items.nth(0)).toBeFocused();
        await page.keyboard.press('Escape'); // CM:106-108, focus back CM:129-132
        await expect(menu).toBeHidden();
        await expect.soft(opener).toBeFocused();
      });

      await test.step('[09-A-023] menu "Đổi tên" → focus lands in "Tên tầng Tầng 1"', async () => {
        await menuAction(page, 'Tầng 1', MENU.rename); // FT:159-163
        await expect(nameInput(page, 'Tầng 1')).toBeFocused();
        await captureEvidence(page, 'E03_09-A-023_rename_focus.png');
      });

      await test.step('[09-A-005] type a new name, click elsewhere (no Enter) → blur commits PATCH …/spatial {name}', async () => {
        const mark = log.length;
        await nameInput(page, 'Tầng 1').fill('Tầng trệt');
        await page.getByRole('heading', { level: 2, name: SCREEN }).click(); // FTR:260 onBlur → commit
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id));
        expect(patch.status).toBe(200);
        expect(bodyOf(patch).name).toBe('Tầng trệt');
      });

      await test.step('[09-A-006] toast "Đã đổi tên tầng." → "Hoàn tác" → PATCH previous name; input shows it', async () => {
        await expect(toastWith(page, TOAST.renamed).first()).toBeVisible();
        const mark = log.length;
        await undoFromToast(page, TOAST.renamed);
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id)); // UFM:895-897
        expect(bodyOf(patch).name).toBe('Tầng 1');
        await expect(nameInput(page, 'Tầng 1')).toHaveValue('Tầng 1');
        await captureEvidence(page, 'E03_09-A-006_rename_undo.png');
      });

      const markRefusals = log.length;
      const refusals = [
        ['09-C-006', '', RENAME.empty],
        ['09-C-007', 'x'.repeat(121), RENAME.tooLong],
        ['09-C-009', 'Tầng‮2', RENAME.bidi],
      ] as const;
      for (const [row, typed, reason] of refusals) {
        await test.step(`[${row}] "Tên tầng" ${row === '09-C-006' ? 'empty' : row === '09-C-007' ? '121 chars' : 'U+202E'} + Enter → "${T.renameRefused} — …", no PATCH, saved name back`, async () => {
          const input = nameInput(page, 'Tầng 1');
          await input.fill(typed);
          await input.press('Enter'); // FTR:264-266 Enter blurs → commit
          await expect.soft(toastWith(page, `${T.renameRefused} — ${reason}`).first()).toBeVisible(); // UFM:1196-1199
          await expect.soft(input).toHaveValue('Tầng 1');
          if (row !== '09-C-007') await captureEvidence(page, `E03_${row}_rename_refused.png`);
        });
      }

      await test.step('[09-C-010] "Tầng 1x" then back to "Tầng 1" + Enter → "Tên tầng không đổi…", no PATCH', async () => {
        const input = nameInput(page, 'Tầng 1');
        await input.fill('Tầng 1x');
        await input.fill('Tầng 1');
        await input.press('Enter');
        await expect.soft(toastWith(page, `${T.renameRefused} — ${RENAME.same}`).first()).toBeVisible(); // FMG:876-880
        await quiet(page);
        expect.soft(callsSince(log, markRefusals, 'PATCH', spatialRe(projectId)), 'refused names send no PATCH').toEqual([]);
        await captureEvidence(page, 'E03_09-C-010_rename_same.png');
      });

      const composed = 'Tầng Một';
      await test.step('[09-C-011] "  {NFD name} " → PATCH body trimmed + NFC; padded saved name → "không đổi", no PATCH', async () => {
        const mark = log.length;
        const input = nameInput(page, 'Tầng 1');
        await input.fill(`  ${composed.normalize('NFD')} `);
        await input.press('Enter');
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id)); // FMG:868-876 normalizeHumanText
        expect.soft(bodyOf(patch).name).toBe(composed.normalize('NFC'));
        const saved = nameInput(page, composed);
        await expect(saved).toHaveValue(composed);
        const markPadded = log.length;
        await saved.fill(` ${composed} `);
        await saved.press('Enter');
        await expect.soft(toastWith(page, `${T.renameRefused} — ${RENAME.same}`).first()).toBeVisible();
        await quiet(page);
        expect.soft(callsSince(log, markPadded, 'PATCH', spatialRe(projectId))).toEqual([]);
      });

      await test.step('[09-C-012] rename "Tầng 2" to floor 1\'s name → PATCH 200 (no uniqueness rule)', async () => {
        const mark = log.length;
        const input = nameInput(page, 'Tầng 2');
        await input.fill(composed);
        await input.press('Enter');
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f2.id));
        expect.soft(patch.status).toBe(200);
        await expect.soft(nameInput(page, composed)).toHaveCount(2);
      });

      await test.step('[09-E-010] Mod+Z inside "Tên tầng …" is the input\'s own undo; row focused Mod+Z → floor undo PATCH', async () => {
        const second = nameInput(page, composed).nth(1);
        await second.click();
        const mark = log.length;
        await page.keyboard.type('abc');
        await page.keyboard.press('Control+z'); // shortcutRegistry: no binding fires in a text field
        await quiet(page);
        expect.soft(floorWritesSince(log, mark), 'no floor request from Mod+Z in the input').toEqual([]);
        await second.press('Escape'); // FTR:268-271 cancel the draft
        await floorRows(page).nth(0).focus();
        await page.keyboard.press('Control+z');
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f2.id)); // undo the 09-C-012 rename
        expect.soft(bodyOf(patch).name).toBe('Tầng 2');
        await expect(nameInput(page, 'Tầng 2')).toHaveValue('Tầng 2');
      });

      const name120 = `Tầng ${'A'.repeat(115)}`;
      await test.step('[09-C-008] rename to exactly 120 characters → PATCH 200 (boundary)', async () => {
        expect([...name120].length).toBe(120);
        const mark = log.length;
        const input = nameInput(page, composed);
        await input.fill(name120);
        await input.press('Enter');
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id)); // BE NAME_MAX 120
        expect(patch.status).toBe(200);
        await expect(nameInput(page, name120)).toHaveValue(name120);
      });

      await test.step('[09-B-037] 120-char name: input and band label truncate, no overflow; aria-labels carry the full name', async () => {
        expect.soft(await horizontalOverflow(page), 'no horizontal page scroll').toBeLessThanOrEqual(0);
        await expect.soft(floorRow(page, name120)).toHaveCount(1); // FTR:204 full name in the row label
        await expect.soft(band(page, name120)).toHaveCount(1); // FSC:99 full name in the band label
        const truncated = await band(page, name120).locator('span').evaluate((span) => span.scrollWidth > span.clientWidth);
        expect.soft(truncated, 'band label is truncated (FSC:123 `truncate`)').toBe(true);
        await captureEvidence(page, 'E03_09-B-037_long_name.png');
      });

      await test.step('[09-C-013] duplicate the 120-char floor → POST "{stem} (bản sao)" ≤ 120 chars, 201', async () => {
        const mark = log.length;
        await menuAction(page, name120, MENU.duplicate);
        await floorRow(page, name120).getByRole('button', { name: CONFIRM_DUPLICATE, exact: true }).click();
        const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
        const expected = `${[...name120].slice(0, 110).join('').trimEnd()} (bản sao)`; // UFM:381-388
        expect.soft(post.status).toBe(201);
        expect.soft(bodyOf(post).name).toBe(expected);
        expect.soft([...String(bodyOf(post).name)].length).toBeLessThanOrEqual(120);
        await expect(floorRows(page)).toHaveCount(3);
      });

      await test.step('[09-B-035] second tab renames the same floor, then this tab → both 200, reload shows the last write', async () => {
        const other = await context.newPage();
        try {
          const otherLog = watchWrites(other);
          await other.goto(ROUTES.project.floors(projectId));
          await expect(floorRows(other)).toHaveCount(3);
          const otherInput = nameInput(other, 'Tầng 2');
          await otherInput.fill('Tab hai');
          await otherInput.press('Enter');
          const first = await nthCall(otherLog, 0, 'PATCH', spatialOf(projectId, f2.id));
          expect.soft(first.status).toBe(200);
        } finally {
          await other.close();
        }
        const mark = log.length;
        const input = nameInput(page, 'Tầng 2');
        await input.fill('Tab một');
        await input.press('Enter');
        const second = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f2.id)); // FMG:1298-1303 no revision
        expect.soft(second.status).toBe(200);
        await expect.soft(toastWith(page, T.persistFailed)).toHaveCount(0);
        await page.reload();
        await expect(floorRows(page)).toHaveCount(3);
        await expect.soft(nameInput(page, 'Tab một')).toHaveValue('Tab một');
        await captureEvidence(page, 'E03_09-B-035_last_write_wins.png');
      });

      await test.step('[09-B-019] API-DELETE floor 1, rename it here → PATCH 404; name reverts', async () => {
        expect(await apiDeleteFloor(api, f1.id), 'the other writer deletes floor 1').toBeLessThan(300);
        const mark = log.length;
        const input = nameInput(page, name120);
        await input.fill('Tầng đã xoá');
        await input.press('Enter');
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id));
        expect(patch.status).toBe(404);
        await readable(page, '09-B-019');
        await expect.soft(nameInput(page, name120)).toHaveValue(name120); // UFM:864-877 first request failed → undo
      });

      await test.step('[09-B-025] the failure says "Chưa lưu được thay đổi tầng — Tầng này không còn trên máy chủ."', async () => {
        await expect.soft(toastWith(page, `${T.persistFailed} — ${T.floorGone}`).first()).toBeVisible(); // UFM:224-226
        await captureEvidence(page, 'E03_09-B-025_floor_gone_toast.png');
      });

      await test.step('[09-B-018] menu "Xoá tầng" on that gone floor → DELETE 404; row comes back; failure toast', async () => {
        const mark = log.length;
        await menuAction(page, name120, MENU.remove);
        const del = await nthCall(log, mark, 'DELETE', deleteOf(f1.id));
        expect(del.status).toBe(404);
        await readable(page, '09-B-018');
        await expect.soft(floorRow(page, name120)).toHaveCount(1);
        await expect.soft(toastWith(page, T.persistFailed).first()).toBeVisible();
        await captureEvidence(page, 'E03_09-B-018_delete_404.png');
      });

      await test.step('[09-A-043] breadcrumb "Dự án" → "/"', async () => {
        await breadcrumbProjects(page).click(); // FMC:258-260
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
      });
    }, stackOf(2), '09-fl02');
  });

  test('SCR-09 · FL-09-03 · Edit elevations and heights: refusals, parsing, bounds, restack, undo, reload', async ({ browser }) => {
    test.setTimeout(240_000);
    await withFloors(browser, async ({ page, log, api }, project) => {
      const projectId = project.id;
      const [f1, f2, f3] = project.floors;
      if (f1 === undefined || f2 === undefined || f3 === undefined) throw new Error('setup: 3 floors');
      const announced = await recordAllAnnouncements(page);
      await openFloors(page, projectId, 3);
      await expect(autoSwitch(page)).toHaveAttribute('aria-checked', 'false'); // UFM:516: elevation inputs editable
      const strip = page.getByRole('status').filter({ hasText: /Đặt ở|Không đặt được|trùng nhau/u }); // FM:154-158
      const markStart = log.length;

      const aboveSentence = 'Đặt ở 4,0 m thì tầng "Tầng 2" cao 3,0 m sẽ chạm lên tầng "Tầng 3" đang ở 6,0 m.'; // RFC:624-629
      await test.step('[09-C-015] middle elevation ArrowUp to 4 m + blur → strip names both floors (no lead sentence)', async () => {
        const middle = elevInput(page, 'Tầng 2');
        await middle.click();
        await middle.press('ArrowUp'); // UNF:149-164 +1 m
        await middle.blur();
        await expect(strip).toHaveCount(1);
        await expect(strip).toContainText(aboveSentence);
        await expect.soft(strip).not.toContainText('Không đặt được cao độ'); // FMG:500-504 subject named → no lead
        await captureEvidence(page, 'E03_09-C-015_elevation_above.png');
      });

      await test.step('[09-B-015] strip role=status; "Chưa đặt được" on that row only; draft kept; no PATCH', async () => {
        await expect.soft(page.getByText(REFUSED_MARK, { exact: true })).toHaveCount(1); // FTR:287
        await expect.soft(floorRow(page, 'Tầng 2').getByText(REFUSED_MARK, { exact: true })).toHaveCount(1);
        await expect.soft(elevInput(page, 'Tầng 2')).toHaveValue('4,0'); // UFM:1226-1233 draft kept
        await quiet(page);
        expect.soft(callsSince(log, markStart, 'PATCH', spatialRe(projectId))).toEqual([]);
        await captureEvidence(page, 'E03_09-B-015_refusal_state.png');
      });

      await test.step('[09-E-008] input aria-invalid + aria-describedby → "Chưa đặt được"; sentence on the assertive live region', async () => {
        const middle = elevInput(page, 'Tầng 2');
        await expect.soft(middle).toHaveAttribute('aria-invalid', 'true'); // Input.tsx aria-invalid
        const describedBy = (await middle.getAttribute('aria-describedby')) ?? '';
        const described = describedBy === '' ? '' : await page.locator(`[id="${describedBy.split(/\s+/u)[0] ?? ''}"]`).innerText();
        expect.soft(described).toContain(REFUSED_MARK);
        expect.soft((await announced()).filter((a) => a.urgency === 'assertive').map((a) => a.text)).toContain(aboveSentence); // UFM:1230
      });

      await test.step('[09-B-016] Escape in the elevation field → shown value restored, the refusal strip stays', async () => {
        const middle = elevInput(page, 'Tầng 2');
        await middle.click();
        await middle.fill('5');
        await middle.press('Escape'); // UNF:143-148 restores the field's last commit; no onFloorFieldCancel
        await expect.soft(middle).toHaveValue('4,0');
        await middle.blur();
        await expect.soft(strip).toHaveCount(1);
        await captureEvidence(page, 'E03_09-B-016_escape_keeps_strip.png');
      });

      await test.step('[09-C-014] middle elevation 2 m → "Không đặt được cao độ 2,0 m cho tầng …" + below sentence', async () => {
        await commitNumber(elevInput(page, 'Tầng 2'), '2');
        // FMG:500-508 lead sentence (below branch does not name the subject) + RFC:616-621.
        await expect.soft(strip).toContainText(
          'Không đặt được cao độ 2,0 m cho tầng "Tầng 2". Tầng "Tầng 1" ở 0,0 m cao 3,0 m nên đỉnh của nó ở 3,0 m; cao độ mới 2,0 m nằm thấp hơn.',
        );
        await captureEvidence(page, 'E03_09-C-014_elevation_below.png');
      });

      await test.step('[09-E-011] type in an elevation field, Escape → committed value restored, no request', async () => {
        const top = elevInput(page, 'Tầng 3');
        const mark = log.length;
        await top.click();
        await top.fill('7');
        await top.press('Escape');
        await expect.soft(top).toHaveValue('6,0');
        await top.blur();
        await quiet(page);
        expect.soft(floorWritesSince(log, mark)).toEqual([]);
      });

      await test.step('[09-C-018] bottom elevation −1 m → PATCH accepted, no strip; then 0 m back → PATCH', async () => {
        await commitNumber(elevInput(page, 'Tầng 2'), '3'); // back to its own value: strip cleared (UFM:1235), nothing sent
        await expect(strip).toHaveCount(0);
        const mark = log.length;
        await commitNumber(elevInput(page, 'Tầng 1'), '-1'); // RFC:612-630 only the "above" rule for the bottom floor
        const down = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id));
        expect(down.status).toBe(200);
        expect(bodyOf(down).elevationMm).toBe(-1_000);
        await expect.soft(strip).toHaveCount(0);
        await commitNumber(elevInput(page, 'Tầng 1'), '0');
        const back = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id), 2);
        expect(bodyOf(back).elevationMm).toBe(0);
        expect.soft(callsSince(log, mark, 'PATCH', spatialOf(projectId, f2.id)), 'the "back to 3 m" commit sent nothing').toEqual([]);
      });

      await test.step('[09-C-019] retype the committed elevation → no refusal, no PATCH', async () => {
        const mark = log.length;
        await commitNumber(elevInput(page, 'Tầng 1'), '0'); // UNF:87 same value → no onChange
        await quiet(page);
        expect.soft(floorWritesSince(log, mark)).toEqual([]);
        await expect.soft(strip).toHaveCount(0);
      });

      await test.step('[09-B-021] bottom elevation −31 m → PATCH 422 → elevation back to 0,0 m, no "Ghi đè"', async () => {
        const mark = log.length;
        await commitNumber(elevInput(page, 'Tầng 1'), '-31');
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id));
        expect(patch.status).toBe(422); // BE ELEVATION_MIN −30000
        await readable(page, '09-B-021');
        await expect.soft(elevInput(page, 'Tầng 1')).toHaveValue('0,0');
        await expect.soft(floorRow(page, 'Tầng 1').getByText(OVERRIDDEN, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_09-B-021_elevation_422_rollback.png');
      });

      await test.step('[09-C-026] top elevation Shift+ArrowUp (+10), ArrowDown (−1) → blur → PATCH 15000 + "Đã đổi cao độ tầng."', async () => {
        const top = elevInput(page, 'Tầng 3');
        const mark = log.length;
        await top.click();
        await top.press('Shift+ArrowUp');
        await top.press('ArrowDown');
        await expect.soft(top).toHaveValue('15,0');
        await top.blur();
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f3.id));
        expect(patch.status).toBe(200);
        expect(bodyOf(patch).elevationMm).toBe(15_000);
        await expect.soft(toastWith(page, TOAST.elevation).first()).toBeVisible();
      });

      await test.step('[09-C-027] "Ghi đè" on the top row (15 m ≠ 3 m + 3 m), never on the bottom row', async () => {
        await expect.soft(floorRow(page, 'Tầng 3').getByText(OVERRIDDEN, { exact: true })).toBeVisible(); // UFM:1529
        await expect.soft(floorRow(page, 'Tầng 1').getByText(OVERRIDDEN, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_09-C-027_override_label.png');
      });

      await test.step('[09-A-012] toast "Hoàn tác" → PATCH elevationMm 6000; "Ghi đè" disappears', async () => {
        const mark = log.length;
        await undoFromToast(page, TOAST.elevation);
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f3.id));
        expect(bodyOf(patch).elevationMm).toBe(6_000);
        await expect(floorRow(page, 'Tầng 3').getByText(OVERRIDDEN, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_09-A-012_elevation_undo.png');
      });

      await test.step('[09-A-010] top floor height "3,5" → exactly one PATCH (heightMm 3500), no reorder/restack', async () => {
        const mark = log.length;
        await commitNumber(heightInput(page, 'Tầng 3'), '3500');
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f3.id));
        expect(bodyOf(patch).heightMm).toBe(3_500);
        await quiet(page);
        expect.soft(floorWritesSince(log, mark).map((w) => w.path)).toEqual([patch.path]); // FMG:943-948
      });

      await test.step('[09-C-022] top floor height "4.5" → PATCH heightMm 4500; field shows "4,5"', async () => {
        const mark = log.length;
        await commitNumber(heightInput(page, 'Tầng 3'), '4500'); // ô mm: số nguyên
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f3.id));
        expect.soft(bodyOf(patch).heightMm).toBe(4_500);
        await expect.soft(heightInput(page, 'Tầng 3')).toHaveValue(mmShown(4500));
      });

      await test.step('[09-C-024] "3,55" → rounded to 0,1 m: PATCH heightMm 3600, field "3,6"', async () => {
        const mark = log.length;
        await commitNumber(heightInput(page, 'Tầng 3'), '3550'); // ô mm: không còn làm tròn 0,1 m
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f3.id));
        expect.soft(bodyOf(patch).heightMm).toBe(3_550);
        await expect.soft(heightInput(page, 'Tầng 3')).toHaveValue(mmShown(3550));
      });

      await test.step('[09-C-025] "abc" and a cleared field → no request; field shows the stored value again', async () => {
        const mark = log.length;
        await commitNumber(heightInput(page, 'Tầng 3'), 'abc'); // UFM:1215-1221 null → draft cleared
        await expect.soft(heightInput(page, 'Tầng 3')).toHaveValue(mmShown(3550));
        await commitNumber(heightInput(page, 'Tầng 3'), '');
        await quiet(page);
        expect.soft(floorWritesSince(log, mark)).toEqual([]);
        await expect.soft(heightInput(page, 'Tầng 3')).toHaveValue(mmShown(3550));
      });

      await test.step('[09-C-023] "3.500" → 3500 m → PATCH heightMm 3500000 → 422 → height back to 3,6', async () => {
        const mark = log.length;
        await commitNumber(heightInput(page, 'Tầng 3'), '3500000'); // 3500 m = 3.500.000 mm
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f3.id));
        expect(bodyOf(patch).heightMm).toBe(3_500_000);
        expect(patch.status).toBe(422);
        await readable(page, '09-C-023');
        await expect.soft(heightInput(page, 'Tầng 3')).toHaveValue(mmShown(3550));
        await captureEvidence(page, 'E03_09-C-023_thousands_422.png');
      });

      await test.step('[09-C-020] heights 1,9 / 10,1 m → 422 + rollback; 2,0 / 10,0 m → 200; bottom elevation −30,1 m → 422', async () => {
        const results: string[] = [];
        for (const [typed, mm, status, shown] of [
          ['1900', 1_900, 422, mmShown(3550)],
          ['10100', 10_100, 422, mmShown(3550)],
          ['2000', 2_000, 200, mmShown(2000)],
          ['10000', 10_000, 200, mmShown(10000)],
        ] as const) {
          const mark = log.length;
          await commitNumber(heightInput(page, 'Tầng 3'), typed);
          const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f3.id));
          results.push(`${typed} → ${String(bodyOf(patch).heightMm)} ${String(patch.status)}`);
          expect.soft(bodyOf(patch).heightMm).toBe(mm);
          expect.soft(patch.status).toBe(status); // BE HEIGHT_MIN 2000 / HEIGHT_MAX 10000
          if (status !== 200) await readable(page, `09-C-020-${String(mm)}`);
          await expect.soft(heightInput(page, 'Tầng 3')).toHaveValue(shown);
        }
        const mark = log.length;
        await commitNumber(elevInput(page, 'Tầng 1'), '-30,1');
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id));
        results.push(`elevation -30,1 → ${String(bodyOf(patch).elevationMm)} ${String(patch.status)}`);
        expect.soft(patch.status).toBe(422);
        await readable(page, '09-C-020');
        await expect.soft(elevInput(page, 'Tầng 1')).toHaveValue('0,0');
        await attachJson('E03_09-C-020_bounds.json', { results });
      });

      await test.step('[09-B-032] 422 toast "Chưa lưu được thay đổi tầng — Kiểm tra lại các trường…"; no field aria-invalid', async () => {
        await expect.soft(toastWith(page, `${T.persistFailed} — ${T.validation}`).first()).toBeVisible();
        await expect.soft(page.locator('input[aria-invalid="true"]')).toHaveCount(0);
        await captureEvidence(page, 'E03_09-B-032_validation_toast.png');
      });

      await test.step('[09-C-021] bottom height 0 → the height command alone: one PATCH 422, rollback', async () => {
        const mark = log.length;
        await commitNumber(heightInput(page, 'Tầng 1'), '0'); // FMG:938-948 reorder refused ("phải lớn hơn 0 m")
        const patch = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id));
        expect.soft(bodyOf(patch).heightMm).toBe(0);
        expect.soft(patch.status).toBe(422);
        await readable(page, '09-C-021');
        await quiet(page);
        expect.soft(callsSince(log, mark, 'PATCH', spatialRe(projectId))).toHaveLength(1);
        await expect.soft(heightInput(page, 'Tầng 1')).toHaveValue(mmShown(3000));
        await expect.soft(page.getByText('phải lớn hơn 0 m')).toHaveCount(0);
      });

      // QA-03e (BUG-517, FIX-2332, on fix/qa03e-int): restack keeps a "Ghi đè" elevation while it still sits on or above the
      // top of the storey under it (roomFloorCommands.ts:743-764); the height command reads the overrides from before the
      // change (floorManagerGateway.ts:947). Tầng 3 at 8 m stays above Tầng 2's new top (7 m): only two levels change.
      await test.step('[09-A-008] top elevation 8 m (override), bottom height 4 m → one PATCH per changed level (2) + toast; 8 m kept', async () => {
        const markTop = log.length;
        await commitNumber(elevInput(page, 'Tầng 3'), '8');
        expect((await nthCall(log, markTop, 'PATCH', spatialOf(projectId, f3.id))).status).toBe(200);
        await expect(floorRow(page, 'Tầng 3').getByText(OVERRIDDEN, { exact: true })).toBeVisible();
        const mark = log.length;
        await commitNumber(heightInput(page, 'Tầng 1'), '4000'); // FMG:913-949 height + restack, one transaction
        const bottom = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id));
        const middle = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f2.id));
        expect.soft(bodyOf(bottom).heightMm).toBe(4_000);
        expect.soft(bodyOf(middle).elevationMm).toBe(4_000);
        await quiet(page);
        expect.soft(callsSince(log, mark, 'PATCH', spatialOf(projectId, f3.id)), 'the 8 m override is not rewritten').toEqual([]);
        expect.soft(callsSince(log, mark, 'PATCH', spatialRe(projectId))).toHaveLength(2);
        await expect.soft(toastWith(page, TOAST.height).first()).toBeVisible();
        await captureEvidence(page, 'E03_09-A-008_restack.png');
      });

      await test.step('[09-C-029] the restack keeps the top floor\'s hand-typed 8,0 m and its "Ghi đè" (BUG-517)', async () => {
        await expect.soft(elevInput(page, 'Tầng 3')).toHaveValue('8,0');
        await expect.soft(floorRow(page, 'Tầng 3').getByText(OVERRIDDEN, { exact: true })).toBeVisible(); // isElevationOverridden, RFC:705
        await captureEvidence(page, 'E03_09-C-029_override_erased.png');
      });

      await test.step('[09-A-009] toast "Hoàn tác" → PATCH per changed level with the before values; the 8 m override stays', async () => {
        const mark = log.length;
        await undoFromToast(page, TOAST.height); // newest "Đã đổi chiều cao tầng." = the 4 m one
        const bottom = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id));
        const middle = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f2.id));
        expect.soft(bodyOf(bottom).heightMm).toBe(3_000);
        expect.soft(bodyOf(middle).elevationMm).toBe(3_000);
        await quiet(page);
        // BUG-517: the forward change never touched Tầng 3, so its undo sends nothing for it.
        expect.soft(callsSince(log, mark, 'PATCH', spatialOf(projectId, f3.id))).toEqual([]);
        await expect.soft(heightInput(page, 'Tầng 1')).toHaveValue(mmShown(3000));
        await expect.soft(elevInput(page, 'Tầng 3')).toHaveValue('8,0');
        await expect.soft(floorRow(page, 'Tầng 3').getByText(OVERRIDDEN, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_09-A-009_height_undo.png');
      });

      await test.step('[09-B-020] middle height 1,5 m → first PATCH 422 → height and restacked elevations revert together', async () => {
        const mark = log.length;
        await commitNumber(heightInput(page, 'Tầng 2'), '1500');
        const first = await nthCall(log, mark, 'PATCH', spatialRe(projectId));
        expect.soft(first.path).toMatch(spatialOf(projectId, f2.id));
        expect.soft(first.status).toBe(422);
        await readable(page, '09-B-020');
        await quiet(page);
        expect.soft(callsSince(log, mark, 'PATCH', spatialRe(projectId)), 'nothing sent after the first failure').toHaveLength(1);
        await expect.soft(heightInput(page, 'Tầng 2')).toHaveValue(mmShown(3000));
        await expect.soft(elevInput(page, 'Tầng 3')).toHaveValue('8,0');
        await captureEvidence(page, 'E03_09-B-020_restack_rollback.png');
      });

      await test.step('[09-A-045] reload → names, heights and elevations equal the last successful PATCH values', async () => {
        await page.reload();
        await expect(floorRows(page)).toHaveCount(3);
        const shown = [];
        for (const name of ['Tầng 1', 'Tầng 2', 'Tầng 3']) {
          shown.push({ name, elevation: await elevInput(page, name).inputValue(), height: await heightInput(page, name).inputValue() });
        }
        expect.soft(shown).toEqual([
          { name: 'Tầng 1', elevation: '0,0', height: '3,0' },
          { name: 'Tầng 2', elevation: '3,0', height: '3,0' },
          { name: 'Tầng 3', elevation: '8,0', height: '10,0' },
        ]);
        const server = await readFloors(api, projectId);
        expect.soft(server.map((f) => [f.name, f.elevationMm, f.heightMm])).toEqual([
          ['Tầng 1', 0, 3_000],
          ['Tầng 2', 3_000, 3_000],
          ['Tầng 3', 8_000, 10_000],
        ]);
        await captureEvidence(page, 'E03_09-A-045_reload_persisted.png');
        await attachJson('E03_09-A-045_reload_persisted.json', { shown, server, writes: writesSince(log, markStart) });
      });
    }, stackOf(3), '09-fl03');
  });

  test('SCR-09 · FL-09-04 · Reorder by keyboard and drag, undo, then a list changed elsewhere', async ({ browser }) => {
    await withFloors(browser, async ({ page, log, api }, project) => {
      const projectId = project.id;
      const [f1, f2, f3] = project.floors;
      if (f1 === undefined || f2 === undefined || f3 === undefined) throw new Error('setup: 3 floors');
      await openFloors(page, projectId, 3);

      await test.step('[09-A-018] Alt+ArrowUp on the first row / Alt+ArrowDown on the last row → no reorder, no request', async () => {
        const mark = log.length;
        await floorRow(page, 'Tầng 1').focus();
        await page.keyboard.press('Alt+ArrowUp'); // FTR:85-104 reorderedIds → null at the edge
        await floorRow(page, 'Tầng 3').focus();
        await page.keyboard.press('Alt+ArrowDown');
        await quiet(page);
        expect.soft(floorWritesSince(log, mark)).toEqual([]);
        expect.soft(await rowNames(page)).toEqual(['Tầng 1', 'Tầng 2', 'Tầng 3']);
        await captureEvidence(page, 'E03_09-A-018_reorder_edges.png');
      });

      await test.step('[09-A-015] middle row Alt+ArrowUp → PATCH /floors/reorder 200, then PATCH spatial per moved floor', async () => {
        const mark = log.length;
        await floorRow(page, 'Tầng 2').focus();
        await page.keyboard.press('Alt+ArrowUp');
        const reorder = await nthCall(log, mark, 'PATCH', reorderRe);
        expect(reorder.status).toBe(200);
        expect(bodyOf(reorder).floorIds).toEqual([f2.id, f1.id, f3.id]);
        const moved2 = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f2.id));
        const moved1 = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id));
        expect.soft(bodyOf(moved2)).toMatchObject({ order: 0, elevationMm: 0 }); // RFC restack from datum 0 (4 m storey)
        expect.soft(bodyOf(moved1)).toMatchObject({ order: 1, elevationMm: 4_000 });
        const writes = floorWritesSince(log, mark).map((w) => w.path);
        expect.soft(writes[0], 'reorder first (UFM:1437-1440)').toBe('/api/floors/reorder');
        await quiet(page);
        expect.soft(callsSince(log, mark, 'PATCH', spatialOf(projectId, f3.id)), 'Tầng 3 did not move').toEqual([]);
        await expect.poll(() => rowNames(page)).toEqual(['Tầng 2', 'Tầng 1', 'Tầng 3']);
      });

      await test.step('[09-A-016] toast "Đã đổi thứ tự tầng." → "Hoàn tác" → PATCH reorder (old order) + spatial before-values', async () => {
        const mark = log.length;
        await undoFromToast(page, TOAST.reordered);
        const reorder = await nthCall(log, mark, 'PATCH', reorderRe); // UFM:900-918
        expect.soft(bodyOf(reorder).floorIds).toEqual([f1.id, f2.id, f3.id]);
        const back2 = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f2.id));
        const back1 = await nthCall(log, mark, 'PATCH', spatialOf(projectId, f1.id));
        expect.soft(bodyOf(back2)).toMatchObject({ order: 1, elevationMm: 3_000 });
        expect.soft(bodyOf(back1)).toMatchObject({ order: 0, elevationMm: 0 });
        await expect.poll(() => rowNames(page)).toEqual(['Tầng 1', 'Tầng 2', 'Tầng 3']);
        await captureEvidence(page, 'E03_09-A-016_reorder_undo.png');
      });

      await test.step('[09-A-019] drag grip "Đổi thứ tự tầng Tầng 3" over the first row → insertion line; drop → PATCH reorder', async () => {
        const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
        const target = floorRow(page, 'Tầng 1');
        // dragend alone clears the line (FT:144-147), nothing sent.
        const markCancel = log.length;
        await grip(page, 'Tầng 3').dispatchEvent('dragstart', { dataTransfer });
        await target.dispatchEvent('dragover', { dataTransfer });
        await expect(target).toHaveClass(/border-t-accent/u); // FTR:211 2 px line
        await captureEvidence(page, 'E03_09-A-019_insertion_line.png');
        await grip(page, 'Tầng 3').dispatchEvent('dragend', { dataTransfer });
        await expect.soft(target).not.toHaveClass(/border-t-accent/u);
        expect.soft(floorWritesSince(log, markCancel)).toEqual([]);
        const mark = log.length;
        await grip(page, 'Tầng 3').dispatchEvent('dragstart', { dataTransfer });
        await target.dispatchEvent('dragover', { dataTransfer });
        await target.dispatchEvent('drop', { dataTransfer });
        const reorder = await nthCall(log, mark, 'PATCH', reorderRe);
        expect(reorder.status).toBe(200);
        expect.soft(bodyOf(reorder).floorIds).toEqual([f3.id, f1.id, f2.id]);
        await expect.poll(() => rowNames(page)).toEqual(['Tầng 3', 'Tầng 1', 'Tầng 2']);
        await expect.soft(page.locator('tr.border-t-accent')).toHaveCount(0);
      });

      await test.step('[09-A-020] drop a row on itself, then on the row just below → same order, no request', async () => {
        await quiet(page);
        const mark = log.length;
        const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
        await grip(page, 'Tầng 1').dispatchEvent('dragstart', { dataTransfer });
        await floorRow(page, 'Tầng 1').dispatchEvent('dragover', { dataTransfer });
        await floorRow(page, 'Tầng 1').dispatchEvent('drop', { dataTransfer });
        await grip(page, 'Tầng 3').dispatchEvent('dragstart', { dataTransfer });
        await floorRow(page, 'Tầng 1').dispatchEvent('dragover', { dataTransfer }); // FT:135 insert before index 1 = same place
        await floorRow(page, 'Tầng 1').dispatchEvent('drop', { dataTransfer });
        await quiet(page);
        expect.soft(floorWritesSince(log, mark)).toEqual([]); // RFC:772-774 "không có gì thay đổi"
        expect.soft(await rowNames(page)).toEqual(['Tầng 3', 'Tầng 1', 'Tầng 2']);
      });

      await test.step('[09-A-021] drag the first row past the last row → it should reach the last position', async () => {
        const mark = log.length;
        const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
        await grip(page, 'Tầng 3').dispatchEvent('dragstart', { dataTransfer });
        // QA-03e (BUG-518, FIX-2222): the lower half of a row inserts AFTER it, so the last row takes a drop past it
        // (FloorTableRow.tsx:216 insertion line, :226-227 `clientY > top + height / 2` → index + 1): aim at the lower half.
        const lastBox = await floorRow(page, 'Tầng 2').boundingBox();
        const lowerHalf = { clientX: (lastBox?.x ?? 0) + 10, clientY: (lastBox?.y ?? 0) + (lastBox?.height ?? 0) * 0.75 };
        await floorRow(page, 'Tầng 2').dispatchEvent('dragover', { dataTransfer, ...lowerHalf });
        await floorRow(page, 'Tầng 2').dispatchEvent('drop', { dataTransfer, ...lowerHalf });
        await nthCall(log, mark, 'PATCH', reorderRe);
        await quiet(page);
        const after = await rowNames(page);
        await captureEvidence(page, 'E03_09-A-021_drag_to_end.png');
        await attachJson('E03_09-A-021_drag_to_end.json', { after, writes: writesSince(log, mark) });
        expect.soft(after.at(-1), 'a drop past the last row reaches the last slot').toBe('Tầng 3');
      });

      let before: string[] = [];
      await test.step('[09-B-027] API-POST a floor, then Alt+ArrowUp → 422 FLOOR_REORDER_MISMATCH toast', async () => {
        before = await rowNames(page);
        const top = (await readFloors(api, projectId)).reduce((max, f) => Math.max(max, f.elevationMm + f.heightMm), 0);
        const added = await apiAddFloor(api, projectId, { name: 'Tầng thêm ngoài', order: 3, elevationMm: top, heightMm: 3_000 });
        expect(added.status, 'the other writer adds a floor').toBe(201);
        const mark = log.length;
        const middle = before[1] ?? '';
        await floorRow(page, middle).focus();
        await page.keyboard.press('Alt+ArrowUp');
        const reorder = await nthCall(log, mark, 'PATCH', reorderRe);
        expect(reorder.status).toBe(422);
        await readable(page, '09-B-027');
        expect.soft((reorder.json as { code?: string } | undefined)?.code).toBe('FLOOR_REORDER_MISMATCH'); // BE resolvers.py:113
        await expect.soft(toastWith(page, `${T.persistFailed} — ${T.listChanged}`).first()).toBeVisible(); // UFM:192, 211
        await captureEvidence(page, 'E03_09-B-027_reorder_mismatch.png');
      });

      await test.step('[09-B-022] the failed first request rolls the order back', async () => {
        await expect.poll(() => rowNames(page)).toEqual(before); // UFM:864-877
      });

      await test.step('[09-B-034] SPA away and back to /floors → the API-added floor should appear', async () => {
        await breadcrumbProjects(page).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        await page.goBack(); // history navigation, no document load
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.floors(projectId));
        await expect(floorRows(page).first()).toBeVisible();
        await page.waitForTimeout(1_000);
        await captureEvidence(page, 'E03_09-B-034_spa_back.png');
        await attachJson('E03_09-B-034_spa_back.json', { rows: await rowNames(page) });
        // QA-03e (BUG-515, FIX-2221): each mount reads N16 fresh (useFloorManager.ts:590 refetchOnMount 'always',
        // floorManagerGateway.ts:1178 isMountRead) unless the store holds unsaved edits.
        await expect.soft(floorRow(page, 'Tầng thêm ngoài')).toHaveCount(1);
      });
    }, [
      { name: 'Tầng 1', elevationMm: 0, heightMm: 3_000 },
      { name: 'Tầng 2', elevationMm: 3_000, heightMm: 4_000 },
      { name: 'Tầng 3', elevationMm: 7_000, heightMm: 5_000 },
    ], '09-fl04');
  });

  test('SCR-09 · FL-09-05 · Select rows, duplicate, hide in 3D, reload, delete and restore, go to upload', async ({ browser }) => {
    test.setTimeout(180_000);
    await withFloors(browser, async ({ page, log, api }, project) => {
      const projectId = project.id;
      const [f1, f2] = project.floors;
      if (f1 === undefined || f2 === undefined) throw new Error('setup: 2 floors');
      const announced = await recordAllAnnouncements(page);
      await page.clock.install(); // time flows; fastForward / setSystemTime move Date.now (UFM gateway.now)
      await openFloors(page, projectId, 2);
      const copyName = 'Tầng 1 (bản sao)';

      await test.step('[09-E-002] Tab order: breadcrumb → "Thu gọn lát cắt" → bands → "Thêm tầng" → rows → switch', async () => {
        await breadcrumbProjects(page).focus();
        const trace: string[] = [];
        for (let i = 0; i < 40; i += 1) {
          await page.keyboard.press('Tab');
          const label = await focusedLabel(page);
          trace.push(label);
          if (label === AUTO) break;
        }
        await attachJson('E03_09-E-002_tab_order.json', { trace });
        const at = (match: (label: string) => boolean): number => trace.findIndex(match);
        const order = [
          at((l) => l === COLLAPSE),
          at((l) => l.startsWith('Tầng 1 · ')),
          at((l) => l.startsWith(ADD)), // a Button's text can be doubled in textContent
          at((l) => l.startsWith('Tầng 1, cao độ')),
          at((l) => l === AUTO),
        ];
        expect.soft(order.every((index) => index >= 0), `every stop found: ${JSON.stringify(order)}`).toBe(true);
        expect.soft([...order].sort((a, b) => a - b), 'DOM order FM:167-197').toEqual(order);
      });

      await test.step('[09-A-040] row click selects; band aria-pressed + ", đang chọn"; hover row ↔ band', async () => {
        await selectRow(page, 'Tầng 1');
        await expect.soft(floorRow(page, 'Tầng 1')).toHaveAttribute('aria-selected', 'true');
        expect.soft(await classOf(floorRow(page, 'Tầng 1'))).toContain('bg-bg-selected'); // FTR:209
        await expect.soft(band(page, 'Tầng 1')).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(band(page, 'Tầng 1')).toHaveAttribute('aria-label', 'Tầng 1 · 3,0 m, đang chọn'); // FSC:99
        await band(page, 'Tầng 2').hover();
        expect.soft(await classOf(floorRow(page, 'Tầng 2')), 'hover band → row bg-bg-hover (FTR:209)').toContain('bg-bg-hover');
        await page.mouse.move(0, 0);
        const bandBefore = await classOf(band(page, 'Tầng 2'));
        await floorRow(page, 'Tầng 2').getByText(NO_DRAWING, { exact: true }).hover();
        const bandHovered = await classOf(band(page, 'Tầng 2'));
        await captureEvidence(page, 'E03_09-A-040_select_hover.png');
        await attachJson('E03_09-A-040_select_hover.json', { bandBefore, bandHovered });
        // QA-03e (BUG-519, FIX-2223): SectionBand applies bg-bg-hover when isHovered (FloorSectionCut.tsx:108).
        expect.soft(bandHovered, 'hover row → band highlighted').not.toBe(bandBefore);
        await page.mouse.move(0, 0);
      });

      await test.step('[09-E-009] band role=button: Enter then Space select their rows; aria-pressed + ", đang chọn"', async () => {
        await band(page, 'Tầng 2').focus();
        await page.keyboard.press('Enter'); // FSC:110-115
        await expect.soft(floorRow(page, 'Tầng 2')).toHaveAttribute('aria-selected', 'true');
        await expect.soft(band(page, 'Tầng 2')).toHaveAttribute('aria-label', /, đang chọn$/u);
        await band(page, 'Tầng 1').focus();
        await page.keyboard.press('Space');
        await expect.soft(floorRow(page, 'Tầng 1')).toHaveAttribute('aria-selected', 'true');
        await expect.soft(band(page, 'Tầng 1')).toHaveAttribute('aria-pressed', 'true');
        await captureEvidence(page, 'E03_09-E-009_band_keyboard.png');
      });

      await test.step('[09-A-041] clicks inside name/height/elevation inputs, grip and kebab of the other row keep the selection', async () => {
        // "Tải lên" is left to 09-A-042: it selects its own row and leaves the screen (UFM:1105-1118).
        const other = floorRow(page, 'Tầng 2');
        await nameInput(page, 'Tầng 2').click();
        await elevInput(page, 'Tầng 2').click();
        await heightInput(page, 'Tầng 2').click();
        await grip(page, 'Tầng 2').click();
        await kebab(page, 'Tầng 2').click();
        await page.keyboard.press('Escape');
        await expect.soft(floorRow(page, 'Tầng 1')).toHaveAttribute('aria-selected', 'true'); // FTR stopPropagation
        await expect.soft(other).toHaveAttribute('aria-selected', 'false');
      });

      const copySwitch = floorRow(page, 'Tầng 1').getByRole('switch', { name: COPY_FURNITURE, exact: true }); // FTR:350-355
      await test.step('[09-A-024] menu "Nhân bản" → in-row strip: switch "Sao chép nội thất…" (OFF) + "Nhân bản"', async () => {
        await menuAction(page, 'Tầng 1', MENU.duplicate);
        await expect(copySwitch).toBeVisible();
        await expect.soft(copySwitch).toHaveAttribute('aria-checked', 'false');
        await expect.soft(floorRow(page, 'Tầng 1').getByRole('button', { name: CONFIRM_DUPLICATE, exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_09-A-024_duplicate_strip.png');
      });

      await test.step('[09-E-006] focus the switch, Escape → strip removed, no POST', async () => {
        const mark = log.length;
        await copySwitch.focus();
        await page.keyboard.press('Escape'); // FTR:177-182
        await expect(copySwitch).toHaveCount(0);
        await quiet(page);
        expect.soft(callsSince(log, mark, 'POST', floorsRe(projectId))).toEqual([]);
      });

      await test.step('[09-E-007] role=switch "Tự tính cao độ" and "Sao chép nội thất…": aria-checked false, flips on click', async () => {
        const auto = autoSwitch(page);
        await expect.soft(auto).toHaveAttribute('aria-checked', 'false');
        await auto.click();
        await expect.soft(auto).toHaveAttribute('aria-checked', 'true');
        await auto.click();
        await expect.soft(auto).toHaveAttribute('aria-checked', 'false');
        await menuAction(page, 'Tầng 1', MENU.duplicate);
        await expect.soft(copySwitch).toHaveAttribute('aria-checked', 'false');
        await copySwitch.click();
        await expect.soft(copySwitch).toHaveAttribute('aria-checked', 'true');
        await copySwitch.click();
        await expect.soft(copySwitch).toHaveAttribute('aria-checked', 'false');
      });

      let copyId = '';
      let firstBody: Record<string, unknown> = {};
      await test.step('[09-A-025] confirm "Nhân bản" → POST "{source} (bản sao)", source height, stack-top elevation; toast', async () => {
        const mark = log.length;
        await floorRow(page, 'Tầng 1').getByRole('button', { name: CONFIRM_DUPLICATE, exact: true }).click();
        const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
        expect(post.status).toBe(201);
        firstBody = bodyOf(post);
        expect.soft(firstBody).toMatchObject({ name: copyName, heightMm: 3_000, elevationMm: 6_000, order: 2 }); // FMG:698-762
        copyId = String(firstBody.id);
        await expect.poll(() => rowNames(page)).toEqual(['Tầng 1', 'Tầng 2', copyName]); // top of the stack = last row
        await expect.soft(toastWith(page, TOAST.duplicated('Tầng 1')).first()).toBeVisible();
        await captureEvidence(page, 'E03_09-A-025_duplicate.png');
      });

      await test.step('[09-A-026] toast "Hoàn tác" → DELETE /api/floors/:newId; the copy row is gone', async () => {
        const mark = log.length;
        await undoFromToast(page, TOAST.duplicated('Tầng 1'));
        expect((await nthCall(log, mark, 'DELETE', deleteOf(copyId))).status).toBeLessThan(300);
        await expect(floorRow(page, copyName)).toHaveCount(0);
      });

      await test.step('[09-A-027] duplicate with "Sao chép nội thất…" ON → same POST body; contents notice announced (assertive)', async () => {
        await menuAction(page, 'Tầng 1', MENU.duplicate);
        await copySwitch.click();
        await expect(copySwitch).toHaveAttribute('aria-checked', 'true');
        const mark = log.length;
        await floorRow(page, 'Tầng 1').getByRole('button', { name: CONFIRM_DUPLICATE, exact: true }).click();
        const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
        copyId = String(bodyOf(post).id);
        const { id: _a, ...withSwitch } = bodyOf(post);
        const { id: _b, ...withoutSwitch } = firstBody;
        void _a;
        void _b;
        expect.soft(withSwitch, 'contents are local only (FMG:200-211)').toEqual(withoutSwitch);
        await expect
          .poll(async () => (await announced()).filter((a) => a.urgency === 'assertive').map((a) => a.text), { timeout: 10_000 })
          .toContain(CONTENTS_NOTICE); // UFM:1373-1383
        await captureEvidence(page, 'E03_09-A-027_duplicate_contents.png');
      });

      await test.step('[09-B-014] "Ẩn khỏi mô hình 3D" then "Hiện trong mô hình 3D" → hide notice announced on each toggle', async () => {
        const before = (await announced()).length;
        await menuAction(page, 'Tầng 2', MENU.hide);
        await expect.soft(floorRow(page, 'Tầng 2')).toHaveClass(/opacity-50/u); // FTR:210
        await menuAction(page, 'Tầng 2', MENU.show);
        await expect
          .poll(async () => (await announced()).slice(before).filter((a) => a.urgency === 'assertive' && a.text === HIDDEN_NOTICE).length)
          .toBe(2); // UFM:1094-1100
      });

      await test.step('[09-A-046] hide, collapse the cut, auto ON, reload → visible, cut expanded, auto OFF, copied contents gone', async () => {
        await menuAction(page, 'Tầng 2', MENU.hide);
        await page.getByRole('button', { name: COLLAPSE, exact: true }).click();
        await expect(page.getByRole('button', { name: EXPAND, exact: true })).toBeVisible();
        await autoSwitch(page).click();
        await expect(autoSwitch(page)).toHaveAttribute('aria-checked', 'true');
        await page.reload();
        await expect(floorRows(page)).toHaveCount(3);
        await expect.soft(floorRow(page, 'Tầng 2')).not.toHaveClass(/opacity-50/u); // UFM:514 session only
        await expect.soft(section(page)).toBeVisible(); // UFM:515
        await expect.soft(autoSwitch(page)).toHaveAttribute('aria-checked', 'false'); // UFM:516
        await expect.soft(page.getByText(HIDDEN_NOTICE)).toHaveCount(0);
        const copyCells = await floorRow(page, copyName).evaluate((row) => [...row.querySelectorAll('td')].map((td) => (td.textContent ?? '').trim()));
        expect.soft(copyCells.filter((text) => text.endsWith('—')).length, 'copy has no walls/rooms/area after reload').toBe(4);
        await captureEvidence(page, 'E03_09-A-046_reload_resets.png');
      });

      await test.step('[09-A-029] menu "Xoá tầng" → DELETE at once, toast "Đã xoá tầng Tầng 2." → "Hoàn tác" re-POSTs the same id', async () => {
        const mark = log.length;
        await menuAction(page, 'Tầng 2', MENU.remove); // FT:177-182 no confirm
        expect((await nthCall(log, mark, 'DELETE', deleteOf(f2.id))).status).toBeLessThan(300);
        await expect(floorRow(page, 'Tầng 2')).toHaveCount(0);
        await expect(toastWith(page, TOAST.removed('Tầng 2')).first()).toBeVisible();
        await undoFromToast(page, TOAST.removed('Tầng 2'));
        const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
        expect(post.status).toBe(201);
        expect.soft(bodyOf(post).id).toBe(f2.id); // UFM:893-894 server restore of the same level
        await expect(floorRow(page, 'Tầng 2')).toHaveCount(1);
        await captureEvidence(page, 'E03_09-A-029_delete_undo.png');
      });

      await test.step('[09-A-030] select a row, delete it → selection cleared, "Nhân bản tầng" disappears', async () => {
        await selectRow(page, copyName);
        await expect(page.getByRole('button', { name: DUPLICATE_SELECTED, exact: true })).toBeVisible(); // FT:233-244
        const mark = log.length;
        await menuAction(page, copyName, MENU.remove);
        await nthCall(log, mark, 'DELETE', deleteOf(copyId));
        await expect.soft(page.getByRole('button', { name: DUPLICATE_SELECTED, exact: true })).toHaveCount(0); // UFM:1405-1408
        await expect.soft(page.locator('tr[aria-selected="true"]')).toHaveCount(0);
        await captureEvidence(page, 'E03_09-A-030_delete_selected.png');
      });

      await test.step('[09-A-032] clock +9 s (toast gone), row focused Mod+Z → POST restores the floor', async () => {
        await page.clock.fastForward(9_000);
        await expect.soft(toastWith(page, TOAST.removed(copyName))).toHaveCount(0);
        const mark = log.length;
        await floorRow(page, 'Tầng 1').focus();
        await page.keyboard.press('Control+z'); // history is not limited to the 8 s toast
        const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
        expect(post.status).toBe(201);
        expect.soft(bodyOf(post).id).toBe(copyId);
        await expect(floorRow(page, copyName)).toHaveCount(1);
      });

      await test.step('[09-B-026] delete a floor, API-POST the same id, toast "Hoàn tác" → 409 "Mã tầng đã có trong dự án…"', async () => {
        const mark = log.length;
        await menuAction(page, 'Tầng 2', MENU.remove);
        expect((await nthCall(log, mark, 'DELETE', deleteOf(f2.id))).status).toBeLessThan(300);
        const restored = await apiAddFloor(api, projectId, { id: f2.id, name: 'Tầng 2', order: 1, elevationMm: 3_000, heightMm: 3_000 });
        expect(restored.status, 'the other writer restores the same id').toBe(201);
        await undoFromToast(page, TOAST.removed('Tầng 2'));
        const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
        expect(post.status).toBe(409); // BE service.py:83 FLOOR_ID_TAKEN
        await readable(page, '09-B-026');
        await expect.soft(toastWith(page, `${T.persistFailed} — ${T.idTaken}`).first()).toBeVisible(); // UFM:190, 209
        await captureEvidence(page, 'E03_09-B-026_restore_id_taken.png');
      });

      await test.step('[09-A-035] delete, clock +571 s, Mod+Z → "Đã quá thời gian khôi phục tầng…", no POST', async () => {
        const mark = log.length;
        await menuAction(page, copyName, MENU.remove);
        await nthCall(log, mark, 'DELETE', deleteOf(copyId));
        const pageNow = await page.evaluate(() => Date.now());
        await page.clock.setSystemTime(pageNow + RESTORE_WINDOW_MS + 1_000);
        const markUndo = log.length;
        await floorRow(page, 'Tầng 1').focus();
        await page.keyboard.press('Control+z'); // UFM:952-967 isExpired
        await expect.soft(toastWith(page, `${T.undoRefused} — ${T.undoExpired}`).first()).toBeVisible();
        await quiet(page);
        expect.soft(callsSince(log, markUndo, 'POST', floorsRe(projectId))).toEqual([]);
        await expect.soft(floorRow(page, copyName)).toHaveCount(0);
        await captureEvidence(page, 'E03_09-A-035_undo_expired.png');
      });

      await test.step('[09-A-042] "Tải lên" on a row without drawing → navigates to /projects/:id/upload', async () => {
        await floorRow(page, 'Tầng 1').getByRole('button', { name: UPLOAD_LINK, exact: true }).click(); // FTR:328-337
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(projectId)); // FMC:254-256
        await expect(page.locator(`[data-floor-id="${f1.id}"]`)).toBeVisible();
        await captureEvidence(page, 'E03_09-A-042_upload_link.png');
      });
    }, stackOf(2), '09-fl05');
  });

  test('SCR-09 · FL-09-06 · Empty project: add the first floor, delete it back to empty', async ({ browser }) => {
    await withFloors(browser, async ({ page, log }, project) => {
      const projectId = project.id;
      await page.goto(ROUTES.project.floors(projectId));

      await test.step('[09-B-002] "Chưa có tầng nào" + notice + "Thêm tầng"; the cut shows only a "0,0 m" tick', async () => {
        await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible(); // FT:190-199
        await expect.soft(page.getByText(EMPTY_NOTICE, { exact: true })).toBeVisible();
        await expect.soft(addButton(page)).toBeVisible();
        const ticks = await section(page).getByRole('group', { name: SCALE, exact: true }).innerText().catch(() => '<no scale>');
        await captureEvidence(page, 'E03_09-B-002_empty.png');
        await attachJson('E03_09-B-002_empty.json', { ticks });
        expect.soft(ticks.trim(), 'FM:16 empty → scale with only the "0,0 m" tick').toBe('0,0 m');
      });

      await test.step('[09-A-044] "Thêm tầng" → POST (elevationMm 0, heightMm 2400); row "Tầng 1" with height 2,4 m', async () => {
        const mark = log.length;
        await addButton(page).click();
        const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
        expect(post.status).toBe(201);
        expect.soft(bodyOf(post)).toMatchObject({ name: 'Tầng 1', elevationMm: 0, heightMm: 2_400 }); // FMG:633-637
        await expect(floorRow(page, 'Tầng 1')).toBeVisible();
        await expect.soft(heightInput(page, 'Tầng 1')).toHaveValue(mmShown(2400));
        await captureEvidence(page, 'E03_09-A-044_first_floor.png');
      });

      await test.step('[09-A-031] menu "Xoá tầng" on the only floor → back to "Chưa có tầng nào"', async () => {
        await menuAction(page, 'Tầng 1', MENU.remove);
        await expect.soft(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible(); // UFM:326-327
        await captureEvidence(page, 'E03_09-A-031_back_to_empty.png');
      });
    }, [], '09-fl06');
  });

  test('SCR-09 · FL-09-07 · Crafted stacks: basement naming and datum, both-neighbour and twin refusals, overlap notice', async ({ browser }) => {
    await withFloors(browser, async ({ page, log, api }, project) => {
      const projectId = project.id;
      const [basement, f1, f2] = project.floors;
      if (basement === undefined || f1 === undefined || f2 === undefined) throw new Error('setup: basement + 2 floors');
      const announced = await recordAllAnnouncements(page);
      await openFloors(page, projectId, 3);
      const strip = page.getByRole('status').filter({ hasText: /nằm thấp hơn|sẽ chạm lên|trùng nhau/u });
      let f3Id = '';

      await test.step('[09-C-004] "Thêm tầng" → the basement is not counted: "Tầng 2" taken → "Tầng 3"', async () => {
        const mark = log.length;
        await addButton(page).click();
        const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
        expect.soft(bodyOf(post).name).toBe('Tầng 3'); // UFM:369-378 (BUG-277)
        f3Id = String(bodyOf(post).id);
        await expect(floorRows(page)).toHaveCount(4);
        await captureEvidence(page, 'E03_09-C-004_basement_naming.png');
      });

      await test.step('[09-C-028] change a floor height → the basement should stay at −3,0 m', async () => {
        const mark = log.length;
        await commitNumber(heightInput(page, 'Tầng 1'), '3500');
        await nthCall(log, mark, 'PATCH', spatialRe(projectId));
        await quiet(page);
        const server = await readFloors(api, projectId);
        await captureEvidence(page, 'E03_09-C-028_restack_datum.png');
        await attachJson('E03_09-C-028_restack_datum.json', { server, writes: writesSince(log, mark) });
        // QA-03e (BUG-516, FIX-2220): restack starts from the LOWEST storey (roomFloorCommands.ts:724 stackBaseMm), not datum 0.
        expect.soft(server.find((f) => f.id === basement.id)?.elevationMm, 'basement elevation after the restack').toBe(-3_000);
        await expect.soft(elevInput(page, 'Tầng hầm 1')).toHaveValue(/^[-−]3,0$/u);
      });

      const seed = async (values: readonly [string, number, number][]): Promise<void> => {
        for (const [id, elevationMm, heightMm] of values) {
          expect(await apiPatchFloor(api, projectId, id, { elevationMm, heightMm }), `seed PATCH ${id}`).toBe(200);
        }
        await page.reload();
        await expect(floorRows(page)).toHaveCount(4);
      };

      await test.step('[09-C-016] floor taller than its gap; elevation violating both neighbours → both domain sentences', async () => {
        await seed([[basement.id, -3_000, 3_000], [f1.id, 0, 3_000], [f2.id, 3_000, 5_000], [f3Id, 6_000, 3_000]]);
        const mark = log.length;
        await commitNumber(elevInput(page, 'Tầng 2'), '2');
        const below = 'Tầng "Tầng 1" ở 0,0 m cao 3,0 m nên đỉnh của nó ở 3,0 m; cao độ mới 2,0 m nằm thấp hơn.';
        const above = 'Đặt ở 2,0 m thì tầng "Tầng 2" cao 5,0 m sẽ chạm lên tầng "Tầng 3" đang ở 6,0 m.';
        await expect(strip).toHaveCount(1);
        const text = await strip.innerText();
        await attachJson('E03_09-C-016_both_neighbours.json', { text, leadPresent: text.includes('Không đặt được cao độ') });
        // FMG:496-508: the above sentence names the subject, so no lead sentence is added (catalog row says "lead +").
        expect.soft(text).toContain(`${below} ${above}`);
        await captureEvidence(page, 'E03_09-C-016_both_neighbours.png');
        await quiet(page);
        expect.soft(callsSince(log, mark, 'PATCH', spatialRe(projectId))).toEqual([]);
        await commitNumber(elevInput(page, 'Tầng 2'), '3');
        await expect(strip).toHaveCount(0);
      });

      await test.step('[09-C-017] elevations out of order; elevation = a non-neighbour\'s → "… hai tầng trùng nhau."', async () => {
        await seed([[f2.id, -9_000, 3_000], [f3Id, 6_000, 3_000]]);
        await commitNumber(elevInput(page, 'Tầng 3'), '-3');
        // FMG:517-535 twin check after the neighbour rules pass.
        await expect.soft(strip).toContainText(
          /Tầng "Tầng hầm 1" đã ở cao độ [-−]3,0 m; đặt tầng "Tầng 3" ở đúng cao độ đó thì hai tầng trùng nhau\./u,
        );
        await captureEvidence(page, 'E03_09-C-017_twin_elevation.png');
        await commitNumber(elevInput(page, 'Tầng 3'), '6');
        await expect(strip).toHaveCount(0);
      });

      // QA-03e: back to the plan's check (a height change). With BUG-516 the basement stays put; with BUG-517 the restack still
      // re-seats an overlapping storey (it is below the top under it, roomFloorCommands.ts:743-764), so the seeded overlap is
      // repaired and the worst issue left is the clear height of the changed floor (2,0 m < 2,4 m, alignFloors.ts:455-478),
      // announced by the height command's onApplied (useFloorManager.ts:1316-1329 announceStackIssue).
      await test.step('[09-C-033] overlap seeded, change a height → worst stack FloorIssue.message announced (clear height 2,0 m)', async () => {
        await seed([[basement.id, -3_000, 3_000], [f1.id, 0, 3_000], [f2.id, 2_000, 3_000], [f3Id, 6_000, 3_000]]);
        const before = (await announced()).length;
        const mark = log.length;
        await commitNumber(heightInput(page, 'Tầng 3'), '2000');
        expect((await nthCall(log, mark, 'PATCH', spatialOf(projectId, f3Id))).status).toBe(200);
        await expect
          .poll(async () => (await announced()).slice(before).map((x) => x.text).join(' | '), { timeout: 10_000 })
          .toContain('có chiều cao thông thuỷ 2,000 m'); // alignFloors.ts:473 metreText = toFixed(3)
        await attachJson('E03_09-C-033_overlap_announced.json', { announced: (await announced()).slice(before) });
      });
    }, [
      { name: 'Tầng hầm 1', elevationMm: -3_000, heightMm: 3_000 },
      { name: 'Tầng 1', elevationMm: 0, heightMm: 3_000 },
      { name: 'Tầng 2', elevationMm: 3_000, heightMm: 3_000 },
    ], '09-fl07');
  });

  test('SCR-09 · FL-09-08 · 49 floors: server cap from elsewhere, then the 50-floor local cap and scrolling', async ({ browser }) => {
    await withFloors(browser, async ({ page, log, api }, project) => {
      const projectId = project.id;
      const announced = await recordAllAnnouncements(page);
      await openFloors(page, projectId, 49);

      await test.step('[09-B-029] API-add the 50th floor, "Thêm tầng" → 422 FLOOR_LIMIT_REACHED toast, 49 rows', async () => {
        const added = await apiAddFloor(api, projectId, { name: 'Tầng 50', order: 49, elevationMm: 147_000, heightMm: 3_000 });
        expect(added.status, 'the other writer adds the 50th floor').toBe(201);
        const mark = log.length;
        await addButton(page).click();
        const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
        expect(post.status).toBe(422);
        await readable(page, '09-B-029');
        expect.soft((post.json as { code?: string } | undefined)?.code).toBe('FLOOR_LIMIT_REACHED'); // BE service.py:89
        await expect.soft(toastWith(page, `${T.persistFailed} — ${T.limit}`).first()).toBeVisible(); // UFM:191, 210
        await expect(floorRows(page)).toHaveCount(49);
        await captureEvidence(page, 'E03_09-B-029_server_cap.png');
      });

      await test.step('[09-C-001] reload (50 rows), "Thêm tầng" → "Chưa thêm được tầng — Dự án đã đủ 50 tầng…", no POST', async () => {
        await page.reload();
        await expect(floorRows(page)).toHaveCount(50);
        const mark = log.length;
        await addButton(page).click();
        await expect.soft(toastWith(page, `${T.addRefused} — ${T.limit}`).first()).toBeVisible(); // UFM:1300-1311
        await quiet(page);
        expect.soft(callsSince(log, mark, 'POST', floorsRe(projectId))).toEqual([]);
        await captureEvidence(page, 'E03_09-C-001_local_cap.png');
      });

      await test.step('[09-C-002] menu "Nhân bản" + confirm at 50 → same refusal, no POST', async () => {
        const mark = log.length;
        const said = (await announced()).filter((x) => x.text === T.limit).length;
        await menuAction(page, 'Tầng 1', MENU.duplicate);
        await floorRow(page, 'Tầng 1').getByRole('button', { name: CONFIRM_DUPLICATE, exact: true }).click();
        // UFM:1343 → say(): toast (may fold into the 09-C-001 toast, same type within 5 s) + assertive announcement.
        await expect.poll(async () => (await announced()).filter((x) => x.text === T.limit).length).toBe(said + 1);
        await expect.soft(toastWith(page, `${T.addRefused} — ${T.limit}`).first()).toBeVisible();
        await quiet(page);
        expect.soft(callsSince(log, mark, 'POST', floorsRe(projectId))).toEqual([]);
      });

      await test.step('[09-B-036] 50 floors: table scrolls inside its frame, no page overflow; every band labelled', async () => {
        const frame = await page.locator('table').evaluate((table) => {
          const box = table.parentElement as HTMLElement;
          return { scrollHeight: box.scrollHeight, clientHeight: box.clientHeight };
        });
        const labels = await section(page).getByRole('button').evaluateAll((bands) =>
          bands.map((b) => b.getAttribute('aria-label') ?? '').filter((l) => / · /u.test(l)),
        );
        const overflow = await horizontalOverflow(page);
        await captureEvidence(page, 'E03_09-B-036_fifty_floors.png');
        await attachJson('E03_09-B-036_fifty_floors.json', { frame, bands: labels.length, overflow });
        expect.soft(frame.scrollHeight, 'table frame scrolls (FT:248 overflow-auto)').toBeGreaterThan(frame.clientHeight);
        expect.soft(overflow).toBeLessThanOrEqual(0);
        expect.soft(labels).toHaveLength(50);
      });
    }, stackOf(49), '09-fl08');
  });

  test('SCR-09 · FL-09-09 · Two own projects: SPA switch, shared level id, then an unknown project', async ({ browser }) => {
    await withFloors(browser, async (admin, projectA) => {
      const { page, log, api } = admin;
      const projectB = await createStack(admin, '09-fl09-b', stackOf(2, 'B tầng'));

      await test.step('[09-A-047] A\'s /floors, in-app nav to B\'s /floors → B\'s floor names shown', async () => {
        await openFloors(page, projectA.id, 2);
        const target = ROUTES.project.floors(projectB.id);
        await page.evaluate((path) => {
          window.history.pushState({}, '', path); // client-side navigation, no document load
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, target);
        await expect.poll(() => pathOf(page)).toBe(target);
        await expect.poll(() => log.some((w) => w.method === 'GET' && floorsRe(projectB.id).test(w.path))).toBe(true);
        await expect(floorRows(page).first()).toBeVisible();
        await page.waitForTimeout(1_000);
        const names = await rowNames(page);
        await captureEvidence(page, 'E03_09-A-047_spa_switch.png');
        await attachJson('E03_09-A-047_spa_switch.json', { names });
        // QA-03e (BUG-515, FIX-2221): the store graph is reused only for the same spatialProjectId (floorManagerGateway.ts:1178).
        expect.soft(names).toEqual(['B tầng 1', 'B tầng 2']);
      });

      await test.step('[09-B-028] the same L- id in A and B; delete it on B → 409 "Mã tầng này trùng với một tầng ở dự án khác…"', async () => {
        const shared = newLevelId();
        const inA = await apiAddFloor(api, projectA.id, { id: shared, name: 'Tầng chung', order: 2, elevationMm: 6_000, heightMm: 3_000 });
        const inB = await apiAddFloor(api, projectB.id, { id: shared, name: 'Tầng chung', order: 2, elevationMm: 6_000, heightMm: 3_000 });
        expect([inA.status, inB.status], 'setup: the same level id in both projects').toEqual([201, 201]);
        await openFloors(page, projectB.id, 3);
        const mark = log.length;
        await menuAction(page, 'Tầng chung', MENU.remove);
        const del = await nthCall(log, mark, 'DELETE', deleteOf(shared));
        expect(del.status).toBe(409); // BE resolvers.py:50 FLOOR_ID_AMBIGUOUS
        await readable(page, '09-B-028');
        await expect.soft(toastWith(page, `${T.persistFailed} — ${T.idAmbiguous}`).first()).toBeVisible(); // UFM:193-194, 212
        await expect.soft(floorRow(page, 'Tầng chung')).toHaveCount(1);
        await captureEvidence(page, 'E03_09-B-028_id_ambiguous.png');
      });

      const alert = page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE });
      await test.step('[09-B-009] random prj id → "Không tìm thấy dự án này" + sentence; no cut', async () => {
        await page.goto(ROUTES.project.floors(`prj_qa-09-${Date.now().toString(36)}`)); // BE access.py → 404, no DB read
        await expect(alert).toBeVisible(); // FT:202-213, UFM:1652-1662
        await expect.soft(alert).toContainText(NOT_FOUND_SENTENCE);
        await expect.soft(section(page)).toHaveCount(0); // FM:95-111
        await captureEvidence(page, 'E03_09-B-009_unknown_project.png');
      });

      await test.step('[09-E-012] alert role=alert; Tab reaches "Về danh sách dự án", Enter → "/"', async () => {
        const back = alert.getByRole('button', { name: BACK_TO_PROJECTS, exact: true });
        let reached = false;
        for (let i = 0; i < 40 && !reached; i += 1) {
          await page.keyboard.press('Tab');
          reached = await back.evaluate((button) => button === document.activeElement);
        }
        expect.soft(reached, 'the way out is in the Tab order').toBe(true);
        if (!reached) await back.focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
      });
    }, stackOf(2, 'A tầng'), '09-fl09-a');
  });

  test('SCR-09 · FL-09-10 · Phone width: compact layout, then live resize to desktop', async ({ browser }) => {
    await withFloors(
      browser,
      async ({ page }, project) => {
        await openFloors(page, project.id, 3);
        const table = page.locator('table');

        await test.step('[09-F-018] 375 px: the cut comes after the table in DOM and Tab order, full width, 400 px tall', async () => {
          const domAfter = await table.evaluate((tableEl, sectionLabel) => {
            const sectionEl = document.querySelector(`section[aria-label="${sectionLabel}"]`);
            return sectionEl !== null && Boolean(tableEl.compareDocumentPosition(sectionEl) & Node.DOCUMENT_POSITION_FOLLOWING);
          }, SECTION);
          expect.soft(domAfter, 'FM:167/197 cut after the table in the DOM').toBe(true);
          await autoSwitch(page).focus();
          await page.keyboard.press('Tab');
          expect.soft(await focusedLabel(page), 'Tab from the last table control lands in the cut').toBe(COLLAPSE);
          const sectionBox = await section(page).boundingBox();
          // The table column is the table's scroll box: the <table> itself loses the width of that box's own scrollbar,
          // which shows or not with the platform's scrollbar mode (run-40: 17 px), so it is not the column width.
          const tableBox = await table.evaluate((el) => {
            let box: Element = el;
            while (box.parentElement !== null && !/auto|scroll/u.test(getComputedStyle(box).overflowY)) box = box.parentElement;
            const r = box.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          });
          await captureEvidence(page, 'E03_09-F-018_compact_cut.png', { fullPage: true });
          await attachJson('E03_09-F-018_compact_cut.json', { sectionBox, tableBox });
          expect.soft(Math.round(sectionBox?.height ?? 0), 'FM:100 h-[400px]').toBe(400);
          expect.soft(Math.abs((sectionBox?.width ?? 0) - (tableBox?.width ?? -1)) <= 2, 'cut as wide as the table column').toBe(true);
        });

        await test.step('[09-F-019] rows stacked as cards, header row hidden, each cell shows its column label', async () => {
          await expect.soft(page.locator('thead')).toBeHidden(); // FT:250
          await expect.soft(floorRow(page, 'Tầng 1')).toHaveClass(/flex-wrap/u); // FTR:66 STACKED_ROW
          for (const label of CELL_LABELS) await expect.soft(floorRow(page, 'Tầng 1').getByText(label, { exact: true })).toBeVisible();
          expect.soft(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
          await captureEvidence(page, 'E03_09-F-019_stacked_rows.png');
        });

        await test.step('[09-F-021] resize to 1440 (no reload) → matchMedia switches the layout: the cut beside the table', async () => {
          await page.setViewportSize(DESKTOP);
          await expect
            .poll(async () => {
              const s = await section(page).boundingBox();
              const t = await table.boundingBox();
              return s !== null && t !== null && s.x + s.width <= t.x;
            })
            .toBe(true); // FMC:217-235 change listener
          await captureEvidence(page, 'E03_09-F-021_live_resize.png');
        });

        await test.step('[09-F-020] 1440 with the cut open: rows still stacked; "Thu gọn lát cắt" → 10-column table with header', async () => {
          await expect.soft(page.locator('thead')).toBeHidden(); // FM:179 isStacked = isCompact || !isCollapsed
          await page.getByRole('button', { name: COLLAPSE, exact: true }).click();
          await expect.soft(page.locator('thead')).toBeVisible();
          await expect.soft(page.locator('thead th')).toHaveCount(10);
          await captureEvidence(page, 'E03_09-F-020_collapsed_table.png');
        });
      },
      stackOf(3),
      '09-fl10',
      PHONE,
    );
  });
});

/* ---------------------------------------------------------------- flow harness */

/** Admin session + own project made of `drafts` (deleted after), then `body`. */
async function withFloors(
  browser: Parameters<typeof withFloorsAdmin>[0],
  body: (admin: FloorsAdmin, project: { id: string; floors: FloorFull[] }) => Promise<void>,
  drafts: readonly FloorDraft[],
  slug: string,
  viewport: { readonly width: number; readonly height: number } = DESKTOP,
): Promise<void> {
  await withFloorsAdmin(
    browser,
    async (admin) => {
      const project = await createStack(admin, slug, drafts);
      await body(admin, project);
    },
    viewport,
  );
}

/** Ô chiều cao nhập mm (S-19): giá trị hiện ra có thể có dấu chấm ngăn nghìn tuỳ locale. */
function mmShown(mm: number): RegExp {
  return new RegExp(`^${String(mm).replace(/\B(?=(\d{3})+(?!\d))/gu, '[.,]?')}$`, 'u');
}
