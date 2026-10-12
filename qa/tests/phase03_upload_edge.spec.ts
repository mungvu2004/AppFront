/**
 * Phase 3 — SCR-10 floor upload, EDGE layer, real stack: ten sequential user flows (QA-03d P5, `flow-plan.md`
 * "phase03_upload_edge.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row, in the planned
 * order. `H` rows use a hard `expect` (later steps depend on them), `S` rows `expect.soft`; `ev` rows capture
 * `E03_<row id>_<slug>.png`. Every expected result cites the FE source (same at 39016134 and this branch):
 *   UFU src/screens/upload/FloorUploadScreen/useFloorUploadScreen.ts   FU …/FloorUploadScreen.tsx
 *   FUC …/FloorUploadCard.tsx  FUD …/FloorUploadDropZone.tsx  FUT …/FloorUploadTray.tsx  FUF …/FloorUploadFooter.tsx
 *   FUG …/floorUploadGateway.ts  VAL src/lib/upload/validate.ts  UT src/lib/upload/uploadTask.ts  TST src/components/feedback/Toast.tsx
 *   BE: AppBack apps/api/drawings/{uploads,complete,schemas}.py
 *
 * Non-serial: each flow creates its own project (`qa-<runId>-10-NN-…`) through the real API and deletes it in `finally`.
 * No mocked response anywhere in this file.
 *
 * ## Users
 * Flows that start an upload (FL-10-02…08) sign in as the pool user `admin:p5-upload` (phase03Seed `poolUser`, own
 * `drawings_init` bucket; the shared admin's bucket is near its cap) and own their project. FL-10-01/09/10 never init an
 * upload and use the shared admin.
 *
 * ## Request budget per full run (BE limits; QA stack override qa-limits.override.yml)
 * - `POST /api/auth/login` (120 / 60 s per IP): 1 (admin API, beforeAll) + 1 (pool API, beforeAll) + 10 (one browser
 *   session per flow) = 12. No failed login.
 * - `POST /api/users/invitations` (30 / 3600 s per admin): 0 when the pool slot `admin:p5-upload` exists, else 1.
 * - `POST …/floors/:fid/drawings/uploads` (drawings_init 300 / 600 s per user on the QA stack, 60 by BE default), all as
 *   the pool user: FL-10-02 ≤ 2, FL-10-03 ≈ 9, FL-10-04 1, FL-10-05 19, FL-10-06 4, FL-10-07 ≈ 11, FL-10-08 3 → ≈ 49.
 *   Each completed upload starts one fake-ML pipeline run on the flow's own project (deleted at the end).
 * - `POST /api/projects` 10, `DELETE /api/projects/:id` 10, `DELETE /api/floors/:id` 1 (FL-10-07). No limit.
 * - `POST /api/auth/refresh` (300 / 60 s): ~1 per page load.
 */
import { rmSync, writeFileSync } from 'node:fs';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { signedInApi } from './support/api';
import { dashboardLoaded, readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import {
  createDrawingProject,
  createProject,
  deleteSeededProject,
  envDrawingPng,
  listFloors,
  poolUser,
  type PoolUser,
  type SeededFloorRow,
} from './support/phase03Seed';
import {
  CHUNK_RE,
  COMPACT,
  COMPLETE_RE,
  INIT_RE,
  closeFlow,
  createStackProject,
  escapeRegExp,
  initsSince,
  makePdf,
  openFlow,
  paddedPng,
  pdfText,
  pngWithoutIend,
  recordAnnouncements,
  sparseFile,
  writesSince,
  type Flow,
} from './support/p03/P5';

/* ---------------------------------------------------------------- copy (each cites its source) */

const DROPZONE = 'floor-upload-dropzone'; // FUD:30
const FILE_INPUT = 'floor-upload-file-input'; // FUD:33
const BLOCK_NOTICE = 'floor-upload-block-notice'; // FUF:22
const COUNTER = 'floor-upload-counter-number'; // FUF:25
const DROPZONE_TITLE = 'Kéo thả bản vẽ vào đây, hoặc chọn tệp'; // UFU:99
const SELECT_FILE = 'Chọn tệp'; // UFU:101
const FORMATS_LINE = 'Định dạng hỗ trợ: .png, .jpg, .pdf. Kích thước tối đa: 100,0 MB.'; // UFU:1265-1267
const TRAY = 'Tệp chưa gán tầng'; // UFU:104
const ASSIGN = 'Gán cho tầng khác'; // FUT:20, FUC:39
const PICK_PAGE = 'Chọn trang'; // FUC:40
const CAD_PILL = 'Bản vẽ CAD · độ chính xác cao'; // FUC:41
const RETRY = 'Thử lại'; // FUC:44
const DISMISS = 'Đóng'; // FUC:45, FUT:21
const AUTO_MATCH = 'Ghép tự động từ tên tệp — kiểm tra lại'; // UFU:103
const UPLOAD_EMPTY = 'Chưa có tầng nào có bản vẽ. Kéo thả tệp đầu tiên để bắt đầu.'; // UFU:106
const SUBMIT = 'Bắt đầu xử lý'; // UFU:113
const BLOCKED_TITLE = 'Không thể bắt đầu xử lý'; // UFU:115
const NO_FLOORS_REASON = 'Dự án chưa có tầng nào. Thêm tầng ở màn Quản lý tầng trước khi xử lý.'; // UFU:117
const WAITING = 'Chờ xử lý'; // UFU:123
const UPLOADING = 'Đang tải lên'; // UFU:124
const ATTACHED = 'Đã gắn kèm'; // UFU:125
const STATUS_ERROR = 'Lỗi'; // UFU:126
const NO_DRAWING = 'Chưa có bản vẽ'; // UFU:140 (BUG-263)
const PICK_PAGE_SENTENCE = 'Hãy chọn trang bản vẽ để bắt đầu tải'; // UFU:263
const NO_FLOORS_TITLE = 'Dự án chưa có tầng nào'; // FU:76
const NO_FLOORS_MESSAGE = 'Bản vẽ được gán theo tầng. Thêm tầng ở màn Quản lý tầng rồi quay lại đây để tải bản vẽ.'; // FU:77-78
const ADD_FLOORS = 'Thêm tầng'; // FU:80
const NOT_FOUND_TITLE = 'Không tìm thấy dự án này'; // ProjectSpatialGate.tsx:36
const NOT_FOUND_SENTENCE = 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.'; // PSGATE:37-38
const BACK_TO_PROJECTS = 'Về danh sách dự án'; // PSGATE:39
const BREADCRUMB_NAV = 'Đường dẫn trang'; // src/components/shell/Breadcrumb.tsx:19
const BREADCRUMB_PROJECTS = 'Dự án'; // FU:59
const CAD_SENTENCE = 'Bản vẽ CAD (.dwg) chưa được hỗ trợ; hãy xuất sang PDF rồi tải lại.'; // FUG:85
const VALIDATION_SENTENCE = 'Kiểm tra lại các trường được đánh dấu rồi thử lại.'; // src/i18n/vi.json errors.validation
const UNDO = 'Hoàn tác'; // TST:149
const unsupported = (ext: string): string => `Định dạng ${ext} chưa nhận được. Định dạng hỗ trợ: .png, .jpg, .pdf.`; // UFU:212-216
const UNREADABLE_PDF = 'Không đọc được nội dung tệp .pdf.'; // UFU:222-223
const tooManyPages = (n: number): string => `Tệp có ${String(n)} trang, vượt trần 20 trang.`; // UFU:217-221
const displaced = (name: string): string => `${name} đã về khay tệp chưa gán tầng vì tầng ấy đã có tệp khác`; // UFU:1334-1336
const removedToast = (name: string): string => `Đã xoá bản vẽ ${name}`; // UFU:921
const counterText = (done: number, total: number): string => `${String(done)} / ${String(total)} tầng đã có bản vẽ`; // UFU:1189-1191

/** `src/lib/upload/validate.ts:47` / `chunk.ts:46`. */
const MIB = 1024 * 1024;
const MAX_FILE_BYTES = 100 * MIB;
const CHUNK_BYTES = 5 * MIB;
/** A "nothing was sent" claim waits this long (uploads start on the next tick of `validateFile`). */
const QUIET_MS = 2_500;
const UPLOAD_DONE_MS = 60_000;

/* ---------------------------------------------------------------- locators and small actions */

const quiet = (page: Page): Promise<void> => page.waitForTimeout(QUIET_MS);
const pathOf = (page: Page): string => new URL(page.url()).pathname;
const tray = (page: Page): Locator => page.getByRole('region', { name: TRAY, exact: true });
/** Tray row by its summary line `{name} · {size}[ · N trang]` (UFU:1079-1081). */
const trayItem = (page: Page, name: string): Locator =>
  tray(page).getByRole('listitem').filter({ has: page.getByText(new RegExp(`^${escapeRegExp(name)} · `, 'u')) });
const card = (page: Page, floor: SeededFloorRow): Locator => page.locator(`[data-floor-id="${floor.id}"]`);
const cardSummary = (page: Page, floor: SeededFloorRow, name: string): Locator =>
  card(page, floor).getByText(new RegExp(`^${escapeRegExp(name)}( · |$)`, 'u'));
const menuButton = (page: Page, floor: SeededFloorRow): Locator =>
  card(page, floor).getByRole('button', { name: `Tuỳ chọn của tầng ${floor.name}`, exact: true }); // FUC:100-108
const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });
const notice = (page: Page): Locator => page.getByTestId(BLOCK_NOTICE);
const submit = (page: Page): Locator => page.getByRole('button', { name: SUBMIT, exact: true });
const breadcrumbProjects = (page: Page): Locator =>
  page.getByRole('navigation', { name: BREADCRUMB_NAV }).getByRole('button', { name: BREADCRUMB_PROJECTS, exact: true });

async function openUpload(page: Page, projectId: string, floors: readonly SeededFloorRow[]): Promise<void> {
  await page.goto(ROUTES.project.upload(projectId));
  await expect(page.getByTestId(DROPZONE)).toBeVisible();
  for (const floor of floors) await expect(card(page, floor)).toBeVisible();
}

const pick = (page: Page, files: Parameters<Locator['setInputFiles']>[0]): Promise<void> =>
  page.getByTestId(FILE_INPUT).setInputFiles(files);

/** "Chọn tệp" → the real file chooser (FUD:91-98) → `files`. */
async function choose(page: Page, files: Parameters<Locator['setInputFiles']>[0]): Promise<boolean> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId(DROPZONE).getByRole('button', { name: SELECT_FILE, exact: true }).click();
  const fileChooser = await chooser;
  await fileChooser.setFiles(files);
  return fileChooser.isMultiple();
}

async function assignFromTray(page: Page, name: string, floorName: string, nth = 0): Promise<void> {
  await trayItem(page, name).nth(nth).getByRole('combobox', { name: ASSIGN }).click(); // FUT:57-74
  await page.getByRole('option', { name: floorName, exact: true }).click();
}

/**
 * The card picker by keyboard (useSelect.ts:41-79): Enter opens it on the current floor, arrows walk to `floorName`, Enter
 * picks. A pointer click on an option far down a long list waited forever for it to settle (run-33-P5, 7 floors).
 */
async function assignFromCard(page: Page, floor: SeededFloorRow, floorName: string): Promise<void> {
  const combo = card(page, floor).getByRole('combobox', { name: ASSIGN }); // FUC:247-263
  await combo.focus();
  await page.keyboard.press('Enter');
  const options = page.getByRole('option');
  await expect(options.first()).toBeAttached();
  const names = (await options.allTextContents()).map((t) => t.trim());
  const from = Math.max(0, (await options.evaluateAll((els) => els.map((el) => el.getAttribute('aria-selected')))).indexOf('true'));
  const to = names.indexOf(floorName);
  if (to < 0) throw new Error(`no option "${floorName}" in ${names.join(', ')}`);
  for (let i = from; i !== to; i = (i + 1) % names.length) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}

async function removeFromCard(page: Page, floor: SeededFloorRow, fileName: string): Promise<void> {
  await menuButton(page, floor).click();
  await card(page, floor).getByRole('button', { name: `Xoá bản vẽ ${fileName}`, exact: true }).click(); // FUC:138-150
}

const trashInTray = (page: Page, name: string): Promise<void> =>
  trayItem(page, name).getByRole('button', { name: `Xoá bản vẽ ${name}`, exact: true }).first().click(); // FUT:76-83

const waitAttached = (page: Page, floor: SeededFloorRow): Promise<void> =>
  expect(card(page, floor).getByText(ATTACHED, { exact: true })).toBeVisible({ timeout: UPLOAD_DONE_MS });

/** The init POSTs sent since `mark`, once exactly `count` of them are on record. */
async function inits(flow: Flow, mark: number, count: number): Promise<Record<string, unknown>[]> {
  await expect.poll(() => initsSince(flow, mark).length, { message: `${String(count)} upload init(s)`, timeout: 20_000 }).toBe(count);
  return initsSince(flow, mark).map((r) => r.init ?? {});
}

function floorOf(floors: readonly SeededFloorRow[], name: string): SeededFloorRow {
  const floor = floors.find((f) => f.name === name);
  if (floor === undefined) throw new Error(`fixture floor "${name}" missing`);
  return floor;
}

/** What has keyboard focus, as "<TAG> <accessible-ish name>" (aria-label, <label for>, own text). */
const focusName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el === null || el === document.body) return 'BODY';
    const labelled = (el as HTMLButtonElement).labels?.[0]?.textContent ?? '';
    const name = el.getAttribute('aria-label') ?? (labelled || (el.textContent ?? ''));
    return `${el.tagName} ${name.trim().replace(/\s+/gu, ' ').slice(0, 80)}${el.dataset.testid ? ` [${el.dataset.testid}]` : ''}`;
  });

const suspected = (description: string): void => {
  test.info().annotations.push({ type: 'suspected-bug', description });
};

/* ---------------------------------------------------------------- users (one admin API + one pool uploader per worker) */

let adminApi: APIRequestContext;
let uploader: PoolUser;
let uploaderApi: APIRequestContext;

test.beforeAll(async () => {
  const admin = readAdminCredentials();
  adminApi = await signedInApi(admin.email, admin.password);
  uploader = await poolUser(adminApi, 'admin', 'p5-upload');
  uploaderApi = await signedInApi(uploader.email, uploader.password);
});

test.afterAll(async () => {
  await uploaderApi?.dispose();
  await adminApi?.dispose();
});

/* ================================================================= flows */

test.describe('E03 SCR-10 floor upload — flows (QA-03d P5)', () => {
  test('FL-10-01 · SCR-10 project without floors, then a wrong project link', async ({ browser }) => {
    const project = await createProject(adminApi, '10-01', 0);
    const flow = await openFlow(browser, readAdminCredentials());
    const { page } = flow;
    try {
      await test.step('[10-B-003] 0 floors → "Dự án chưa có tầng nào" + its sentence + "Thêm tầng"; no drop zone; submit names noFloors (BUG-298)', async () => {
        await page.goto(ROUTES.project.upload(project.projectId));
        await expect(page.getByText(NO_FLOORS_TITLE, { exact: true })).toBeVisible(); // FU:160-166
        await expect(page.getByText(NO_FLOORS_MESSAGE, { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: ADD_FLOORS, exact: true })).toBeVisible();
        await expect(page.getByTestId(DROPZONE)).toHaveCount(0); // UFU:436-437 canDrop false
        const mark = flow.sent.length;
        await submit(page).click();
        await expect(notice(page)).toContainText(BLOCKED_TITLE); // UFU:933-934 noFloors reason
        await expect(notice(page)).toContainText(NO_FLOORS_REASON);
        await quiet(page);
        expect(writesSince(flow, mark), 'a blocked submit sends nothing').toEqual([]);
        expect(pathOf(page)).toBe(ROUTES.project.upload(project.projectId));
        await captureEvidence(page, 'E03_10-B-003_no-floors-submit.png', { caption: `submit blocked, writes: ${JSON.stringify(writesSince(flow, mark))}` });
      });

      await test.step('[10-A-036] "Thêm tầng" → /projects/:id/floors; Back → the upload screen', async () => {
        await page.getByRole('button', { name: ADD_FLOORS, exact: true }).click(); // UFU:1308-1311
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.floors(project.projectId));
        await captureEvidence(page, 'E03_10-A-036_add-floors-route.png');
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.projectId));
        await expect(page.getByText(NO_FLOORS_TITLE, { exact: true })).toBeVisible();
      });

      await test.step('[10-A-037] breadcrumb "Dự án" → "/"', async () => {
        await breadcrumbProjects(page).click(); // FU:210-220, UFU:1312-1313
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        await dashboardLoaded(page);
        await captureEvidence(page, 'E03_10-A-037_breadcrumb-dashboard.png');
      });

      const unknownId = `prj_qa-e03-${Date.now().toString(36)}`; // not prj_<ULID> → BE 404 before any read (projects/access.py)
      await test.step('[10-B-004] unknown project → "Không tìm thấy dự án này" + sentence; no "Thử lại", no drop zone, no footer', async () => {
        await page.goto(ROUTES.project.upload(unknownId));
        const alert = page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE }); // FU:142-153 isProjectMissing
        await expect(alert).toContainText(NOT_FOUND_SENTENCE, { timeout: 30_000 });
        await expect(alert.getByRole('button', { name: RETRY, exact: true })).toHaveCount(0);
        await expect(page.getByTestId(DROPZONE)).toHaveCount(0);
        await expect(submit(page)).toHaveCount(0); // FU:248 no footer in state 'error'
        await captureEvidence(page, 'E03_10-B-004_unknown-project.png');
      });

      await test.step('[10-A-039] "Về danh sách dự án" → "/"', async () => {
        await page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE }).getByRole('button', { name: BACK_TO_PROJECTS, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        await dashboardLoaded(page);
        await captureEvidence(page, 'E03_10-A-039_back-to-projects.png');
      });
    } finally {
      await closeFlow(flow);
      await deleteSeededProject(adminApi, project.projectId);
    }
  });

  test('FL-10-02 · SCR-10 add files by chooser, keyboard and drag; every client refusal; refused files are not assignable', async ({ browser }, testInfo) => {
    test.setTimeout(300_000);
    const png = envDrawingPng();
    const disk = (name: string, bytes: Buffer): string => {
      const path = testInfo.outputPath(name);
      writeFileSync(path, bytes);
      return path;
    };
    const fileA = disk('mat-bang-a.png', png);
    const fileB = disk('mat-bang-b.png', png);
    const txt = disk('ghi-chu.txt', Buffer.from('ghi chú, không phải bản vẽ\n', 'utf8'));
    const big101 = sparseFile(testInfo.outputPath('ghi-chu-lon.txt'), 101 * MIB);
    const atCap = sparseFile(testInfo.outputPath('dung-tran.png'), MAX_FILE_BYTES);
    const overCap = sparseFile(testInfo.outputPath('qua-tran.png'), MAX_FILE_BYTES + 1);
    const project = await createProject(uploaderApi, '10-02', 2);
    const [t1, t2] = project.floors as [SeededFloorRow, SeededFloorRow];
    const flow = await openFlow(browser, uploader);
    const { page } = flow;
    try {
      await test.step('[10-B-002] open → invitation sentence; both cards "Chưa có bản vẽ"; "0 / 2 tầng đã có bản vẽ"', async () => {
        await openUpload(page, project.projectId, project.floors);
        await expect(page.getByText(UPLOAD_EMPTY, { exact: true })).toBeVisible(); // FU:172-174
        for (const floor of project.floors) await expect(card(page, floor).getByText(NO_DRAWING, { exact: true })).toBeVisible();
        await expect(page.getByTestId(COUNTER)).toHaveText(counterText(0, 2));
        await captureEvidence(page, 'E03_10-B-002_empty-invitation.png');
      });

      await test.step('[10-E-007] "Bắt đầu xử lý" → role="alert" notice lists "Tầng 1/2 chưa có bản vẽ."', async () => {
        await submit(page).click();
        await expect.soft(notice(page)).toHaveAttribute('role', 'alert'); // FUF:76-80
        await expect.soft(notice(page)).toContainText(BLOCKED_TITLE);
        for (const floor of project.floors) await expect.soft(notice(page)).toContainText(`${floor.name} chưa có bản vẽ.`);
        await captureEvidence(page, 'E03_10-E-007_blocked-notice.png');
      });

      await test.step('[10-C-033] drop zone formats line', async () => {
        await expect.soft(page.getByTestId(DROPZONE).getByText(FORMATS_LINE, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_10-C-033_formats-line.png');
      });

      await test.step('[10-A-002] "Chọn tệp" → multi-file chooser, accept .png,.jpg,.pdf; ghi-chu.txt refused, no init', async () => {
        await expect(page.getByTestId(FILE_INPUT)).toHaveAttribute('accept', '.png,.jpg,.pdf'); // UFU:1268
        const mark = flow.sent.length;
        expect(await choose(page, txt), 'input[multiple] (FUD:80)').toBe(true);
        await expect(trayItem(page, 'ghi-chu.txt').getByRole('alert')).toContainText(unsupported('.txt'));
        await quiet(page);
        expect(initsSince(flow, mark), 'a refused file sends no init').toHaveLength(0);
        await captureEvidence(page, 'E03_10-A-002_chooser-txt-refused.png');
      });

      await test.step('[10-E-001] Tab from the breadcrumb reaches "Chọn tệp"; Enter opens the chooser; input labelled "Chọn tệp"', async () => {
        await breadcrumbProjects(page).focus();
        const trail: string[] = [];
        for (let i = 0; i < 12; i += 1) {
          await page.keyboard.press('Tab');
          const now = await focusName(page);
          trail.push(now);
          if (now.startsWith(`BUTTON ${SELECT_FILE}`) || now.includes(`[${FILE_INPUT}]`)) break;
        }
        const reached = trail.at(-1) ?? '';
        expect.soft(reached.startsWith(`BUTTON ${SELECT_FILE}`) || reached.includes(`[${FILE_INPUT}]`), `Tab trail: ${trail.join(' → ')}`).toBe(true);
        const chooser = page.waitForEvent('filechooser', { timeout: 5_000 }).catch(() => null);
        await page.keyboard.press('Enter');
        const fileChooser = await chooser;
        expect.soft(fileChooser, 'Enter on the focused control opens the file chooser').not.toBeNull();
        await fileChooser?.setFiles([]);
        await expect.soft(page.getByLabel(SELECT_FILE, { exact: true })).toHaveAttribute('data-testid', FILE_INPUT); // FUD:68-70
        await attachJson('E03_10-E-001_tab-trail.json', { trail, chooserOpened: fileChooser !== null });
        await trashInTray(page, 'ghi-chu.txt'); // back to an empty tray for the next pick
        await expect(tray(page)).toHaveCount(0);
      });

      await test.step('[10-A-003] one pick of 2 PNG + .txt → 3 tray items, "3 tệp"; only the .txt refused; PNGs offer "Gán cho tầng khác"', async () => {
        await choose(page, [fileA, fileB, txt]);
        await expect(tray(page).getByRole('listitem')).toHaveCount(3);
        await expect(tray(page).getByText('3 tệp', { exact: true })).toBeVisible(); // UFU:1180
        await expect(trayItem(page, 'ghi-chu.txt').getByRole('alert')).toContainText(unsupported('.txt'));
        for (const name of ['mat-bang-a.png', 'mat-bang-b.png']) {
          await expect(trayItem(page, name).getByRole('alert')).toHaveCount(0);
          await expect(trayItem(page, name).getByRole('combobox', { name: ASSIGN })).toBeVisible();
        }
        await tray(page).scrollIntoViewIfNeeded();
        await captureEvidence(page, 'E03_10-A-003_tray-three-files.png');
      });

      await test.step('[10-E-010] the .txt sentence is role="alert"; Tab reaches its "Đóng", Enter dismisses it', async () => {
        const item = trayItem(page, 'ghi-chu.txt');
        await expect.soft(item.getByRole('alert')).toHaveCount(1);
        await item.getByRole('button', { name: 'Xoá bản vẽ ghi-chu.txt', exact: true }).focus();
        await page.keyboard.press('Tab');
        const dismiss = item.getByRole('alert').getByRole('button', { name: DISMISS, exact: true });
        await expect.soft(dismiss, 'Tab from the trash lands on "Đóng"').toBeFocused();
        await dismiss.focus();
        await page.keyboard.press('Enter');
        await expect(item.getByRole('alert')).toHaveCount(0);
      });

      await test.step('[10-B-016] after "Đóng" the .txt stays (name, trash; no "Gán cho tầng khác") without its sentence', async () => {
        const item = trayItem(page, 'ghi-chu.txt');
        await expect.soft(item).toBeVisible();
        // QA-03e (BUG-523): a refused file never gets a floor picker (useFloorUploadScreen.ts:1199, FloorUploadTray.tsx:76).
        await expect.soft(item.getByRole('combobox', { name: ASSIGN })).toHaveCount(0);
        await expect.soft(item.getByRole('button', { name: 'Xoá bản vẽ ghi-chu.txt', exact: true })).toBeVisible();
        await expect.soft(item.getByText(unsupported('.txt'), { exact: true })).toHaveCount(0);
        await item.scrollIntoViewIfNeeded();
        await captureEvidence(page, 'E03_10-B-016_dismissed-stays.png');
      });

      await test.step('[10-B-015] trash all three → no "Tệp chưa gán tầng" region', async () => {
        for (const name of ['mat-bang-a.png', 'mat-bang-b.png', 'ghi-chu.txt']) await trashInTray(page, name);
        await expect.soft(tray(page)).toHaveCount(0); // FUT:29-31
        await captureEvidence(page, 'E03_10-B-015_tray-gone.png');
      });

      await test.step('[10-A-004] pick the very same mat-bang-a.png again → a new tray item (input value was reset)', async () => {
        await choose(page, fileA);
        await expect(trayItem(page, 'mat-bang-a.png')).toHaveCount(1); // FUD:85-87
        await expect(page.getByTestId(FILE_INPUT)).toHaveValue('');
        await captureEvidence(page, 'E03_10-A-004_same-file-again.png');
      });

      const zone = page.getByTestId(DROPZONE);
      await test.step('[10-A-006] dragenter lights the zone, dragleave clears it; a dropped .docx → cleared + refused', async () => {
        const transfer = await page.evaluateHandle(() => {
          const dt = new DataTransfer();
          dt.items.add(new File(['không phải bản vẽ'], 'ghi-chu.docx', { type: 'application/octet-stream' }));
          return dt;
        });
        await zone.dispatchEvent('dragenter', { dataTransfer: transfer }); // FU:193-207
        await expect(zone).toHaveAttribute('data-drag-active', 'true'); // FUD:61
        await captureEvidence(page, 'E03_10-A-006_drag-active.png');
        await zone.dispatchEvent('dragleave', { dataTransfer: transfer });
        await expect(zone).toHaveAttribute('data-drag-active', 'false');
        await zone.dispatchEvent('dragenter', { dataTransfer: transfer });
        await zone.dispatchEvent('drop', { dataTransfer: transfer }); // UFU:1278-1281 depth reset
        await expect(zone).toHaveAttribute('data-drag-active', 'false');
        await expect(trayItem(page, 'ghi-chu.docx').getByRole('alert')).toContainText(unsupported('.docx'));
      });

      await test.step('[10-A-007] dragenter page + card, one dragleave → still lit; the balancing dragleave → cleared', async () => {
        await zone.dispatchEvent('dragenter');
        await card(page, t1).dispatchEvent('dragenter'); // UFU:1283-1288 depth counter
        await zone.dispatchEvent('dragleave');
        await expect.soft(zone).toHaveAttribute('data-drag-active', 'true');
        await captureEvidence(page, 'E03_10-A-007_nested-drag-still-active.png', { caption: '2 dragenter, 1 dragleave' });
        await card(page, t1).dispatchEvent('dragleave');
        await expect.soft(zone).toHaveAttribute('data-drag-active', 'false');
      });

      await test.step('[10-A-008] drop a valid mat-bang-c.png → tray with picker + trash; no init', async () => {
        const mark = flow.sent.length;
        const transfer = await page.evaluateHandle((b64) => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
          const dt = new DataTransfer();
          dt.items.add(new File([bytes], 'mat-bang-c.png', { type: 'image/png' }));
          return dt;
        }, png.toString('base64'));
        await zone.dispatchEvent('dragenter', { dataTransfer: transfer });
        await zone.dispatchEvent('drop', { dataTransfer: transfer });
        const item = trayItem(page, 'mat-bang-c.png');
        await expect(item.getByRole('combobox', { name: ASSIGN })).toBeVisible();
        await expect(item.getByRole('button', { name: 'Xoá bản vẽ mat-bang-c.png', exact: true })).toBeVisible();
        await quiet(page);
        expect(initsSince(flow, mark), 'a dropped file waits in the tray').toHaveLength(0);
        await item.scrollIntoViewIfNeeded();
        await captureEvidence(page, 'E03_10-A-008_dropped-png-tray.png');
      });

      const refusalShot = async (name: string, evidence: string): Promise<void> => {
        await trayItem(page, name).scrollIntoViewIfNeeded();
        await captureEvidence(page, evidence);
      };

      await test.step('[10-C-005] x.jpeg → ".jpeg chưa nhận được" (only .jpg listed)', async () => {
        await pick(page, { name: 'x.jpeg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
        await expect.soft(trayItem(page, 'x.jpeg').getByRole('alert')).toContainText(unsupported('.jpeg'));
        await refusalShot('x.jpeg', 'E03_10-C-005_jpeg-refused.png');
      });

      await test.step('[10-C-006] "banve" (no dot) → "Định dạng chưa rõ chưa nhận được."', async () => {
        await pick(page, { name: 'banve', mimeType: 'application/octet-stream', buffer: Buffer.from('banve') });
        await expect.soft(trayItem(page, 'banve').getByRole('alert')).toContainText(unsupported('chưa rõ'));
        await refusalShot('banve', 'E03_10-C-006_no-extension.png');
      });

      await test.step('[10-C-009] text named khong-doc-duoc.pdf → "Không đọc được nội dung tệp .pdf."', async () => {
        await pick(page, { name: 'khong-doc-duoc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('this is not a pdf\n') });
        await expect.soft(trayItem(page, 'khong-doc-duoc.pdf').getByRole('alert')).toContainText(UNREADABLE_PDF);
        await refusalShot('khong-doc-duoc.pdf', 'E03_10-C-009_unreadable-pdf.png');
      });

      await test.step('[10-C-011] 0-byte rong.pdf → "Không đọc được nội dung tệp .pdf."', async () => {
        await pick(page, { name: 'rong.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
        await expect.soft(trayItem(page, 'rong.pdf').getByRole('alert')).toContainText(UNREADABLE_PDF);
        await refusalShot('rong.pdf', 'E03_10-C-011_empty-pdf.png');
      });

      await test.step('[10-C-010] "%PDF-" at byte 1019 → accepted; at byte 1020 → unreadable', async () => {
        const body = '%PDF-1.4\n1 0 obj << /Type /Pages /Count 1 >> endobj\n%%EOF\n';
        await pick(page, [
          { name: 'dau-1019.pdf', mimeType: 'application/pdf', buffer: pdfText(body, 1019) },
          { name: 'dau-1020.pdf', mimeType: 'application/pdf', buffer: pdfText(body, 1020) },
        ]); // VAL:171-174 header within the first 1024 bytes
        await expect.soft(trayItem(page, 'dau-1019.pdf').getByText(/ · 1 trang$/u)).toBeVisible();
        await expect.soft(trayItem(page, 'dau-1019.pdf').getByRole('alert')).toHaveCount(0);
        await expect.soft(trayItem(page, 'dau-1020.pdf').getByRole('alert')).toContainText(UNREADABLE_PDF);
        await refusalShot('dau-1020.pdf', 'E03_10-C-010_header-boundary.png');
      });

      await test.step('[10-C-012] /Count 21 → "Tệp có 21 trang, vượt trần 20 trang."', async () => {
        await pick(page, { name: 'hai-mot-trang.pdf', mimeType: 'application/pdf', buffer: pdfText('%PDF-1.4\n1 0 obj << /Type /Pages /Count 21 >> endobj\n%%EOF\n') });
        await expect.soft(trayItem(page, 'hai-mot-trang.pdf').getByRole('alert')).toContainText(tooManyPages(21));
        await refusalShot('hai-mot-trang.pdf', 'E03_10-C-012_21-pages.png');
      });

      await test.step('[10-C-014] nested page tree /Count 3 and /Count 21 → refused as 21 pages (largest wins)', async () => {
        const nested = '%PDF-1.4\n1 0 obj << /Type /Pages /Count 3 >> endobj\n2 0 obj << /Type /Pages /Count 21 >> endobj\n%%EOF\n';
        await pick(page, { name: 'cay-long.pdf', mimeType: 'application/pdf', buffer: pdfText(nested) });
        await expect.soft(trayItem(page, 'cay-long.pdf').getByRole('alert')).toContainText(tooManyPages(21));
        await refusalShot('cay-long.pdf', 'E03_10-C-014_nested-count.png');
      });

      const countless =
        '%PDF-1.4\n1 0 obj << /Type /Pages /Kids [2 0 R 3 0 R 4 0 R] >> endobj\n2 0 obj << /Type /Page >> endobj\n' +
        '3 0 obj << /Type /Page >> endobj\n4 0 obj << /Type /Page >> endobj\n%%EOF\n';
      await test.step('[10-C-015] no /Count, 3 "/Type /Page" + 1 "/Type /Pages" → accepted with "3 trang"', async () => {
        await pick(page, { name: 'ba-trang-dem.pdf', mimeType: 'application/pdf', buffer: pdfText(countless, 0, 1536) });
        await expect.soft(trayItem(page, 'ba-trang-dem.pdf').getByRole('alert')).toHaveCount(0);
        await expect.soft(trayItem(page, 'ba-trang-dem.pdf').getByText(/ · 3 trang$/u)).toBeVisible(); // VAL:327,335
        await refusalShot('ba-trang-dem.pdf', 'E03_10-C-015_page-objects-counted.png');
      });

      await test.step('[10-C-034] summary "{name} · {x,y} KB · 3 trang" with a vi-VN decimal comma', async () => {
        const line = trayItem(page, 'ba-trang-dem.pdf').getByText(/^ba-trang-dem\.pdf · /u);
        await expect.soft(line).toHaveText('ba-trang-dem.pdf · 1,5 KB · 3 trang'); // 1536 B, UFU:1079-1081
        await refusalShot('ba-trang-dem.pdf', 'E03_10-C-034_summary-line.png');
      });

      await test.step('[10-C-013] /Count 20 → "20 trang"; assigned to Tầng 1 → "Chọn trang" lists Trang 1…20; no init; then trashed', async () => {
        await pick(page, { name: 'hai-muoi-trang.pdf', mimeType: 'application/pdf', buffer: pdfText('%PDF-1.4\n1 0 obj << /Type /Pages /Count 20 >> endobj\n%%EOF\n') });
        await expect(trayItem(page, 'hai-muoi-trang.pdf').getByText(/ · 20 trang$/u)).toBeVisible();
        const mark = flow.sent.length;
        await assignFromTray(page, 'hai-muoi-trang.pdf', t1.name);
        const picker = card(page, t1).getByRole('combobox', { name: PICK_PAGE }); // FUC:265-281
        await picker.click();
        const options = page.getByRole('option', { name: /^Trang \d+$/u });
        await expect(options).toHaveCount(20); // UFU:1064-1070
        await expect(options.first()).toHaveText('Trang 1');
        await expect(options.last()).toHaveText('Trang 20');
        await captureEvidence(page, 'E03_10-C-013_twenty-pages-picker.png');
        await page.keyboard.press('Escape');
        await quiet(page);
        expect(initsSince(flow, mark), 'no init before a page is chosen').toHaveLength(0);
        await removeFromCard(page, t1, 'hai-muoi-trang.pdf');
        await expect(card(page, t1).getByText(NO_DRAWING, { exact: true })).toBeVisible();
      });

      await test.step('[10-C-003] sparse 101 MiB .txt → the size sentence, not the format one', async () => {
        await pick(page, big101); // VAL:246-255 size before format
        const alert = trayItem(page, 'ghi-chu-lon.txt').getByRole('alert');
        await expect.soft(alert).toContainText('Tệp nặng 101,0 MB, vượt trần 100,0 MB của một tệp.');
        await expect.soft(alert).not.toContainText('chưa nhận được');
        await refusalShot('ghi-chu-lon.txt', 'E03_10-C-003_size-before-format.png');
      });

      await test.step('[10-C-002] sparse .png of exactly 104857600 B → no refusal, "Gán cho tầng khác" offered', async () => {
        await pick(page, atCap); // VAL:246 strict >
        await expect.soft(trayItem(page, 'dung-tran.png').getByRole('alert')).toHaveCount(0);
        await expect.soft(trayItem(page, 'dung-tran.png').getByRole('combobox', { name: ASSIGN })).toBeVisible();
        await refusalShot('dung-tran.png', 'E03_10-C-002_exactly-at-cap.png');
      });

      await test.step('[10-C-001] sparse .png of 104857601 B → "Tệp nặng 100,1 MB, vượt trần 100,0 MB của một tệp."; summary "100,1 MB" (BUG-302); no init', async () => {
        const mark = flow.sent.length;
        await pick(page, overCap);
        const item = trayItem(page, 'qua-tran.png');
        await expect(item.getByRole('alert')).toContainText('Tệp nặng 100,1 MB, vượt trần 100,0 MB của một tệp.'); // UFU:186-211
        await expect(item.getByText('qua-tran.png · 100,1 MB', { exact: true })).toBeVisible(); // UFU:1060-1063
        await quiet(page);
        expect(initsSince(flow, mark)).toHaveLength(0);
        await refusalShot('qua-tran.png', 'E03_10-C-001_over-cap.png');
      });

      // QA-03e (BUG-523, FIX-2245): a tray file without a validated branch offers no floor picker
      // (useFloorUploadScreen.ts:1199 `assignOptions: canEdit && attachment.branch !== null ? … : []`,
      // FloorUploadTray.tsx:76) and `reassign` ignores it (useFloorUploadScreen.ts:842-846).
      await test.step('[10-C-019] a refused ghi-chu.txt offers no "Gán cho tầng khác" → it cannot be assigned; no init', async () => {
        await pick(page, txt);
        const item = trayItem(page, 'ghi-chu.txt');
        await expect(item.getByRole('alert')).toContainText(unsupported('.txt'));
        const mark = flow.sent.length;
        await expect.soft(item.getByRole('combobox', { name: ASSIGN }), 'a refused file has no floor picker').toHaveCount(0); // UFU:1199, FUT:76
        await quiet(page);
        const sent = initsSince(flow, mark).map((r) => r.init);
        const pickers = await item.getByRole('combobox', { name: ASSIGN }).count();
        await captureEvidence(page, 'E03_10-C-019_refused-file-assigned.png', { caption: `refused .txt: floor pickers ${String(pickers)}, inits ${String(sent.length)}` });
        await attachJson('E03_10-C-019_refused-file-assigned.json', { inits: sent, pickers });
        expect.soft(sent, 'a file the screen refused is never uploaded').toHaveLength(0);
      });

      // Catalog 10-B-020 reached init 413 only through the refusal bypass above. With BUG-523 fixed the
      // over-cap file stays a tray-only refusal (the size check runs first, UFU:186-211), so the step asserts that.
      await test.step('[10-B-020] the refused 100 MiB + 1 file offers no "Gán cho tầng khác" → no init; the size sentence stays', async () => {
        const mark = flow.sent.length;
        const item = trayItem(page, 'qua-tran.png');
        await expect.soft(item.getByRole('combobox', { name: ASSIGN }), 'an over-cap file has no floor picker').toHaveCount(0); // UFU:1199
        await expect.soft(item.getByRole('alert')).toContainText('Tệp nặng 100,1 MB, vượt trần 100,0 MB của một tệp.');
        await expect.soft(card(page, t2).getByText(NO_DRAWING, { exact: true })).toBeVisible();
        await quiet(page);
        expect.soft(initsSince(flow, mark), 'no init for a refused file').toHaveLength(0);
        await item.scrollIntoViewIfNeeded();
        await captureEvidence(page, 'E03_10-B-020_init-413.png', { caption: 'over-cap tray file: no floor picker, no init (BUG-523)' });
      });
    } finally {
      await closeFlow(flow);
      await deleteSeededProject(uploaderApi, project.projectId);
      for (const path of [big101, atCap, overCap]) rmSync(path, { force: true });
    }
  });

  test('FL-10-03 · SCR-10 assign by keyboard, move, displace, undo onto a taken floor, then leave and reload mid-upload', async ({ browser }, testInfo) => {
    test.setTimeout(300_000);
    const png = envDrawingPng();
    const disk = (name: string, bytes: Buffer): string => {
      const path = testInfo.outputPath(name);
      writeFileSync(path, bytes);
      return path;
    };
    const fileA = disk('mat-bang-a.png', png);
    const fileB = disk('mat-bang-b.png', png);
    const banVe = disk('ban-ve.png', png);
    const big = disk('mat-bang-lon.png', paddedPng(png, 16 * MIB)); // 4 chunks of 5 MiB (chunk.ts:46)
    // Seed S1(4), not S1(3): Tầng 4 stays without a server drawing for the reload row (10-A-042).
    const project = await createProject(uploaderApi, '10-03', 4);
    const [t1, t2, t3, t4] = project.floors as [SeededFloorRow, SeededFloorRow, SeededFloorRow, SeededFloorRow];
    const flow = await openFlow(browser, uploader, { reducedMotion: true });
    const { page } = flow;
    const announced = await recordAnnouncements(page);
    try {
      await test.step('[10-E-017] reduced motion → cards shown at once (no 260 ms reveal / 24 ms stagger)', async () => {
        await openUpload(page, project.projectId, project.floors);
        expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'emulated').toBe(true);
        const motion = await page.locator('[data-floor-id]').evaluateAll((cards) =>
          cards.map((el) => {
            const s = getComputedStyle(el);
            return { name: s.animationName, duration: s.animationDuration, delay: s.animationDelay };
          }),
        );
        await captureEvidence(page, 'E03_10-E-017_reduced-motion.png', { caption: `card animations: ${JSON.stringify(motion)}` });
        await attachJson('E03_10-E-017_reduced-motion.json', { motion });
        for (const m of motion) {
          expect.soft(m.name === 'none' || (m.duration === '0s' && m.delay === '0s'), `card reveal under reduced motion: ${JSON.stringify(m)}`).toBe(true);
        }
      });

      await test.step('[10-E-002] Tab order breadcrumb → "Chọn tệp" → tray (picker, trash) → "Bắt đầu xử lý"; sticky footer never covers focus', async () => {
        await pick(page, fileA);
        await expect(trayItem(page, 'mat-bang-a.png')).toBeVisible();
        await breadcrumbProjects(page).focus();
        const trail: { name: string; covered: boolean }[] = [];
        for (let i = 0; i < 40; i += 1) {
          await page.keyboard.press('Tab');
          const name = await focusName(page);
          const covered = await page.evaluate((counterId) => {
            const el = document.activeElement as HTMLElement | null;
            const footer = document.querySelector(`[data-testid="${counterId}"]`)?.closest('.sticky');
            if (el === null || footer === null || footer === undefined || footer.contains(el)) return false;
            const r = el.getBoundingClientRect();
            const f = footer.getBoundingClientRect();
            return r.bottom > f.top + 1 && r.top < f.bottom;
          }, COUNTER);
          trail.push({ name, covered });
          if (name.startsWith(`BUTTON ${SUBMIT}`)) break;
        }
        const names = trail.map((t) => t.name);
        const at = (prefix: string): number => names.findIndex((n) => n.startsWith(prefix));
        const order = [at(`BUTTON ${SELECT_FILE}`), at(`BUTTON ${ASSIGN}`), at('BUTTON Xoá bản vẽ mat-bang-a.png'), at(`BUTTON ${SUBMIT}`)];
        await attachJson('E03_10-E-002_tab-order.json', { trail });
        await captureEvidence(page, 'E03_10-E-002_tab-order.png', { caption: `Tab trail: ${names.join(' → ')}` });
        expect.soft(order.every((i) => i >= 0), `every stop reached: ${names.join(' → ')}`).toBe(true);
        expect.soft([...order].sort((a, b) => a - b), 'stops in reading order').toEqual(order);
        expect.soft(trail.filter((t) => t.covered).map((t) => t.name), 'focused controls under the sticky footer').toEqual([]);
      });

      await test.step('[10-E-003] tray "Gán cho tầng khác" by keyboard: aria-expanded; Esc closes; ArrowDown + Enter picks Tầng 1 → "Đã gắn kèm"', async () => {
        const combo = trayItem(page, 'mat-bang-a.png').getByRole('combobox', { name: ASSIGN });
        await combo.focus();
        await expect(combo).toHaveAttribute('aria-expanded', 'false');
        await page.keyboard.press('ArrowDown'); // useSelect.ts:42-47 opens, highlight 0
        await expect(combo).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(combo).toHaveAttribute('aria-expanded', 'false');
        const mark = flow.sent.length;
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        const [init] = await inits(flow, mark, 1);
        expect(init?.floorId).toBe(t1.id);
        await waitAttached(page, t1);
        await expect(cardSummary(page, t1, 'mat-bang-a.png')).toBeVisible();
        await captureEvidence(page, 'E03_10-E-003_keyboard-assign.png');
      });

      await test.step('[10-A-009] card "Gán cho tầng khác" Tầng 1 → Tầng 2: new init on Tầng 2; Tầng 1 loses the local file', async () => {
        const mark = flow.sent.length;
        await assignFromCard(page, t1, t2.name);
        const [init] = await inits(flow, mark, 1);
        expect(init?.floorId).toBe(t2.id);
        await waitAttached(page, t2);
        await expect(cardSummary(page, t2, 'mat-bang-a.png')).toBeVisible();
        // Tầng 1 already holds the finished upload on the server, so its card shows that copy (no menu) or "Chưa có bản vẽ".
        await expect(menuButton(page, t1)).toHaveCount(0);
        const t1Status = (await card(page, t1).innerText()).includes(ATTACHED) ? 'server copy' : NO_DRAWING;
        await captureEvidence(page, 'E03_10-A-009_moved-to-floor-2.png', { caption: `Tầng 1 card after the move: ${t1Status}` });
      });

      await test.step('[10-A-010] mat-bang-b.png assigned to Tầng 2 → mat-bang-a.png back in the tray; Tầng 2 shows mat-bang-b.png', async () => {
        await pick(page, fileB);
        await assignFromTray(page, 'mat-bang-b.png', t2.name); // UFU:830-839 displaced → toTray
        await expect(trayItem(page, 'mat-bang-a.png')).toBeVisible();
        await expect(cardSummary(page, t2, 'mat-bang-b.png')).toBeVisible();
        await waitAttached(page, t2);
        await captureEvidence(page, 'E03_10-A-010_displaced-to-tray.png');
      });

      const threePages = makePdf(3);
      await test.step('[10-E-013] displaced sentence announced; a 3-page PDF on Tầng 1 announces "Hãy chọn trang bản vẽ để bắt đầu tải"', async () => {
        await expect.poll(announced).toContain(displaced('mat-bang-a.png'));
        const mark = flow.sent.length;
        await pick(page, { name: 'ba-trang.pdf', mimeType: 'application/pdf', buffer: threePages });
        await assignFromTray(page, 'ba-trang.pdf', t1.name);
        await expect.configure({ soft: true }).poll(announced).toContain(PICK_PAGE_SENTENCE); // UFU:625-628
        await quiet(page);
        expect(initsSince(flow, mark)).toHaveLength(0);
        await attachJson('E03_10-E-013_announcements.json', { announced: await announced() });
      });

      await test.step('[10-A-028] remove ba-trang.pdf from Tầng 1, give Tầng 1 mat-bang-a.png, then "Hoàn tác" → ba-trang.pdf back to the tray (announced)', async () => {
        await removeFromCard(page, t1, 'ba-trang.pdf');
        const toast = toastWith(page, removedToast('ba-trang.pdf')).first();
        await expect(toast).toBeVisible();
        await assignFromTray(page, 'mat-bang-a.png', t1.name);
        await toast.getByRole('button', { name: UNDO, exact: true }).click(); // UFU:893-909 occupied → tray
        await expect(trayItem(page, 'ba-trang.pdf')).toBeVisible();
        await expect(cardSummary(page, t1, 'ba-trang.pdf')).toHaveCount(0);
        await expect(cardSummary(page, t1, 'mat-bang-a.png')).toBeVisible();
        await expect.poll(announced).toContain(displaced('ba-trang.pdf'));
        await trayItem(page, 'ba-trang.pdf').scrollIntoViewIfNeeded();
        await captureEvidence(page, 'E03_10-A-028_undo-onto-taken-floor.png');
      });

      await test.step('[10-A-005] ban-ve.png picked twice → two tray items; one to Tầng 1, one to Tầng 3 → two inits, different floorId', async () => {
        await waitAttached(page, t1);
        await choose(page, banVe);
        await choose(page, banVe);
        await expect(trayItem(page, 'ban-ve.png')).toHaveCount(2); // UFU:738-756 no dedupe
        await captureEvidence(page, 'E03_10-A-005_same-name-twice.png');
        const mark = flow.sent.length;
        await assignFromTray(page, 'ban-ve.png', t1.name);
        await assignFromTray(page, 'ban-ve.png', t3.name);
        const sent = await inits(flow, mark, 2);
        expect(sent.map((b) => b.floorId).sort()).toEqual([t1.id, t3.id].sort());
        expect(sent.every((b) => b.fileName === 'ban-ve.png')).toBe(true);
        await waitAttached(page, t1);
        await waitAttached(page, t3);
      });

      await test.step('[10-A-041] 16 MiB PNG on Tầng 1; after chunk 0 breadcrumb "Dự án" → no prompt; complete still 200; reopened Tầng 1 "Đã gắn kèm"', async () => {
        await pick(page, big);
        const chunk0 = waitForApi(page, 'POST', CHUNK_RE, [200], 60_000);
        const complete = waitForApi(page, 'POST', COMPLETE_RE, [200], 120_000);
        await assignFromTray(page, 'mat-bang-lon.png', t1.name);
        await chunk0;
        await breadcrumbProjects(page).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        const done = await complete; // UFU:453-471 unmount drops only offline commands
        expect(done.response.status()).toBe(200);
        expect(flow.dialogs, 'no leave prompt').toEqual([]);
        await openUpload(page, project.projectId, project.floors);
        await waitAttached(page, t1);
        await captureEvidence(page, 'E03_10-A-041_left-mid-upload.png', { caption: `complete after leaving: ${String(done.response.status())}; dialogs: ${String(flow.dialogs.length)}` });
      });

      await test.step('[10-A-042] 16 MiB PNG on Tầng 4; after chunk 0 reload → no dialog, no resume; Tầng 4 "Chưa có bản vẽ"', async () => {
        await pick(page, big);
        const chunk0 = waitForApi(page, 'POST', CHUNK_RE, [200], 60_000);
        await assignFromTray(page, 'mat-bang-lon.png', t4.name);
        await chunk0;
        await page.reload();
        const mark = flow.sent.length;
        await openUpload(page, project.projectId, project.floors);
        await quiet(page);
        const resumed = flow.sent.slice(mark).filter((r) => CHUNK_RE.test(r.path) || COMPLETE_RE.test(r.path) || INIT_RE.test(r.path));
        await captureEvidence(page, 'E03_10-A-042_reload-mid-upload.png', { caption: `after reload: ${String(resumed.length)} upload requests; dialogs: ${String(flow.dialogs.length)}` });
        expect.soft(flow.dialogs, 'no beforeunload dialog').toEqual([]);
        expect.soft(resumed, 'nothing resumes after a reload (File lived in memory only)').toEqual([]);
        await expect.soft(card(page, t4).getByText(NO_DRAWING, { exact: true })).toBeVisible();
        await expect.soft(tray(page)).toHaveCount(0);
      });
    } finally {
      await closeFlow(flow);
      await deleteSeededProject(uploaderApi, project.projectId);
    }
  });

  test('FL-10-04 · SCR-10 remove files, undo, let undo expire, then the card menu of an attached file', async ({ browser }) => {
    test.setTimeout(240_000);
    const png = envDrawingPng();
    const project = await createProject(uploaderApi, '10-04', 1);
    const [t1] = project.floors as [SeededFloorRow];
    const flow = await openFlow(browser, uploader);
    const { page } = flow;
    const note = (name: string): { name: string; mimeType: string; buffer: Buffer } => ({ name, mimeType: 'text/plain', buffer: Buffer.from(`${name}\n`) });
    try {
      await page.clock.install(); // time flows; fastForward jumps the 8 s undo window (undoTicket.ts:18, TST:68-83)
      await openUpload(page, project.projectId, project.floors);
      let focusAfterTrash = '';

      await test.step('[10-A-025] trash ghi-chu-xoa.txt → tray gone + toast "Đã xoá bản vẽ …" → "Hoàn tác" puts it back; no request', async () => {
        await pick(page, note('ghi-chu-xoa.txt'));
        const mark = flow.sent.length;
        await trashInTray(page, 'ghi-chu-xoa.txt');
        focusAfterTrash = await focusName(page);
        await expect(tray(page)).toHaveCount(0);
        const toast = toastWith(page, removedToast('ghi-chu-xoa.txt')).first();
        await expect(toast).toBeVisible();
        await captureEvidence(page, 'E03_10-A-025_trash-toast.png');
        await toast.getByRole('button', { name: UNDO, exact: true }).click();
        await expect(trayItem(page, 'ghi-chu-xoa.txt')).toBeVisible();
        expect(writesSince(flow, mark), 'trash + undo are local').toEqual([]);
      });

      await test.step('[10-E-015] after trashing the last tray file focus is on "Chọn tệp", not <body>', async () => {
        await captureEvidence(page, 'E03_10-E-015_focus-after-trash.png', { caption: `focus right after the trash click: ${focusAfterTrash}` });
        expect.soft(focusAfterTrash, 'focus after removing a tray file').not.toBe('BODY');
        // QA-03e (BUG-525, FIX-2246): next/previous tray trash, else the "Chọn tệp" button (FloorUploadTray.tsx:45, FUD:36,95).
        expect.soft(focusAfterTrash, 'the tray was empty after the trash → "Chọn tệp"').toMatch(new RegExp(`^BUTTON ${SELECT_FILE}`, 'u'));
      });

      await test.step('[10-E-012] removal toast role="status" aria-live="polite"; Tab reaches "Hoàn tác", Enter restores within 8 s', async () => {
        await trashInTray(page, 'ghi-chu-xoa.txt');
        const toast = toastWith(page, removedToast('ghi-chu-xoa.txt')).first();
        await expect.soft(toast).toHaveAttribute('aria-live', 'polite'); // TST:120-121
        const trail: string[] = [];
        let reached = false;
        for (let i = 0; i < 40 && !reached; i += 1) {
          await page.keyboard.press('Tab');
          trail.push(await focusName(page));
          reached = await toast.getByRole('button', { name: UNDO, exact: true }).evaluate((el) => el === document.activeElement).catch(() => false);
        }
        expect.soft(reached, `Tab trail: ${trail.join(' → ')}`).toBe(true);
        if (reached) await page.keyboard.press('Enter');
        else await toast.getByRole('button', { name: UNDO, exact: true }).click();
        await expect(trayItem(page, 'ghi-chu-xoa.txt')).toBeVisible();
        await attachJson('E03_10-E-012_toast-keyboard.json', { trail, reached });
      });

      await test.step('[10-A-029] trash, then 8.1 s pass → toast gone; the file cannot come back; tray empty', async () => {
        await trashInTray(page, 'ghi-chu-xoa.txt');
        const toast = toastWith(page, removedToast('ghi-chu-xoa.txt'));
        await expect(toast.first()).toBeVisible();
        await page.clock.fastForward(8_100);
        await expect(toast).toHaveCount(0);
        await expect(tray(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_10-A-029_undo-expired.png', { caption: 'clock +8.1 s after the trash click' });
      });

      // QA-03f (BUG-571, FIX-2427): hover or focus holds every toast, undo included, and stops the ticket's clock with it, so
      // "Hoàn tác" still works when pressed (Toast.tsx:80-89, 153-158 and undoTicket.ts:57-76 at 854987d6, WCAG 2.2.1). Off the
      // pointer, the rest of the window runs out (Toast.tsx:91-116).
      await test.step('[10-A-030] trash, hover the toast, 9 s pass → the undo toast is still there and "Hoàn tác" restores the file; pointer off → the rest of the window runs out', async () => {
        await pick(page, note('ghi-chu-hover.txt'));
        await trashInTray(page, 'ghi-chu-hover.txt');
        const toast = toastWith(page, removedToast('ghi-chu-hover.txt'));
        await expect(toast.first()).toBeVisible();
        await toast.first().hover();
        await page.clock.fastForward(9_000);
        await expect.soft(toast, 'a hovered undo toast is held past 8 s').toHaveCount(1);
        await captureEvidence(page, 'E03_10-A-030_hover-then-undo.png', { caption: `hover + 9 s: removal toasts left ${String(await toast.count())}` });
        await toast.first().getByRole('button', { name: UNDO, exact: true }).click();
        await expect.soft(trayItem(page, 'ghi-chu-hover.txt'), 'the held ticket still undoes').toBeVisible();
        await expect.soft(toast, 'used: the toast leaves').toHaveCount(0);

        // Same file again: hold, then let go — the remaining window (< 8 s) runs out, the removal stays and the tray is empty
        // again for [10-A-031].
        await trashInTray(page, 'ghi-chu-hover.txt');
        const toast2 = toastWith(page, removedToast('ghi-chu-hover.txt'));
        await expect(toast2.first()).toBeVisible();
        await toast2.first().hover();
        await page.clock.fastForward(9_000);
        await expect.soft(toast2, 'held while hovered').toHaveCount(1);
        await page.mouse.move(0, 0);
        await page.clock.fastForward(8_100);
        await expect.soft(toast2, 'pointer off: the rest of the window runs out').toHaveCount(0);
        await expect.soft(trayItem(page, 'ghi-chu-hover.txt'), 'the expired removal stays').toHaveCount(0);
        await captureEvidence(page, 'E03_10-A-030_released-expired.png');
        await expect(page.getByRole('status').filter({ hasText: 'Đã xoá bản vẽ' })).toHaveCount(0);
      });

      await test.step('[10-A-031] trash 4 files quickly → 2 toasts + "Đã thực hiện 2 thay đổi"; its "Hoàn tác" restores one grouped file, 3 toasts left → no summary', async () => {
        const names = ['g1.txt', 'g2.txt', 'g3.txt', 'g4.txt'];
        await pick(page, names.map(note));
        await expect(tray(page).getByRole('listitem')).toHaveCount(4);
        for (const name of names) await trashInTray(page, name);
        const summary = page.getByRole('status').filter({ hasText: 'Đã thực hiện 2 thay đổi' }); // TST:228-254
        await expect.soft(summary).toHaveCount(1);
        await expect.soft(page.getByRole('status').filter({ hasText: /^Đã xoá bản vẽ g[1-4]\.txt/u })).toHaveCount(2);
        await captureEvidence(page, 'E03_10-A-031_grouped-toasts.png');
        // The summary is a 4 px "peek" slot (TST:117-125): reached by keyboard, not by a pointer.
        await summary.getByRole('button', { name: UNDO, exact: true }).press('Enter');
        await expect(tray(page).getByRole('listitem')).toHaveCount(1);
        await expect.soft(trayItem(page, 'g2.txt'), 'the oldest-but-one change (groupedItems[0]) comes back').toBeVisible();
        const stillUndoable = (await summary.count()) + (await toastWith(page, removedToast('g1.txt')).count());
        await captureEvidence(page, 'E03_10-A-031_grouped-undo.png', { caption: `after the summary undo: summary toasts ${String(await summary.count())}, g1 still undoable = ${String(stillUndoable > 0)}` });
        expect.soft(stillUndoable, 'the other grouped change stays undoable').toBeGreaterThan(0);
        // Catalog fixed by QA-03e: Toast.tsx:228-254 groups only from 4 toasts; 4 − 1 = 3, so the summary turns back into
        // plain toasts and g1 keeps its own "Hoàn tác" ("summary stays" needs 5 or more toasts).
        await expect.soft(summary).toHaveCount(0);
        await expect.soft(toastWith(page, removedToast('g1.txt'))).toHaveCount(1);
        await trashInTray(page, 'g2.txt');
        await page.clock.fastForward(8_100);
      });

      await test.step('[10-E-005] ban-ve.png uploaded to Tầng 1 → "Tuỳ chọn của tầng Tầng 1" aria-expanded true; Esc → false', async () => {
        await pick(page, { name: 'ban-ve.png', mimeType: 'image/png', buffer: png });
        await assignFromTray(page, 'ban-ve.png', t1.name);
        await waitAttached(page, t1);
        await menuButton(page, t1).click();
        await expect.soft(menuButton(page, t1)).toHaveAttribute('aria-expanded', 'true'); // FUC:93-108
        await captureEvidence(page, 'E03_10-E-005_card-menu-open.png');
        await page.keyboard.press('Escape');
        await expect.soft(menuButton(page, t1)).toHaveAttribute('aria-expanded', 'false');
      });

      await test.step('[10-E-006] after Esc focus stays on the trigger; items reachable by Tab; outside click leaves it open; no role=menu (recorded)', async () => {
        await expect.soft(menuButton(page, t1), 'focus back on the trigger').toBeFocused();
        await menuButton(page, t1).click();
        await page.keyboard.press('Tab');
        const tabbed = await focusName(page);
        expect.soft(tabbed, 'Tab from the trigger reaches the first menu item').toBe('BUTTON Xoá bản vẽ ban-ve.png');
        await page.getByText(DROPZONE_TITLE, { exact: true }).click();
        const openAfterOutside = await card(page, t1).getByRole('button', { name: 'Xoá bản vẽ ban-ve.png', exact: true }).isVisible();
        const menus = await page.getByRole('menu').count();
        await attachJson('E03_10-E-006_card-menu.json', { tabbed, openAfterOutside, roleMenu: menus });
        expect.soft(openAfterOutside, 'outside click leaves the menu open (source: no outside handler)').toBe(true);
        expect.soft(menus, 'no role=menu (plain buttons, FUC:111-152)').toBe(0);
        if (openAfterOutside) await menuButton(page, t1).click();
      });

      await test.step('[10-A-026] menu "Xoá bản vẽ ban-ve.png" is local; "Hoàn tác" → "Đã gắn kèm"; remove again + reload → server copy, no menu', async () => {
        const mark = flow.sent.length;
        await removeFromCard(page, t1, 'ban-ve.png');
        const toast = toastWith(page, removedToast('ban-ve.png')).first();
        await expect(toast).toBeVisible();
        await toast.getByRole('button', { name: UNDO, exact: true }).click();
        await expect(card(page, t1).getByText(ATTACHED, { exact: true })).toBeVisible(); // UFU:886-889
        expect(writesSince(flow, mark), 'removal + undo send no request').toEqual([]);
        await removeFromCard(page, t1, 'ban-ve.png');
        await expect(toastWith(page, removedToast('ban-ve.png')).first()).toBeVisible();
        expect(writesSince(flow, mark)).toEqual([]);
        await captureEvidence(page, 'E03_10-A-026_removed-locally.png');
        await page.reload();
        await waitAttached(page, t1); // server copy
        await expect(menuButton(page, t1)).toHaveCount(0); // FUC:82-86
        await captureEvidence(page, 'E03_10-A-026_reload-server-copy.png');
      });
    } finally {
      await closeFlow(flow);
      await deleteSeededProject(uploaderApi, project.projectId);
    }
  });

  test('FL-10-05 · SCR-10 auto-match by file name for every naming form, then submit with overlapping floors', async ({ browser }) => {
    test.setTimeout(300_000);
    const png = envDrawingPng();
    /** PNG by name only: the FE never reads a PNG's bytes (VAL:258-260); the BE refuses these at complete (no server drawing left behind). */
    const junk = Buffer.from('qa: tên tệp thôi, không phải PNG\n', 'utf8');
    const project = await createStackProject(uploaderApi, '10-05', [
      { name: 'Tầng hầm 2', elevationMm: -6_000, heightMm: 3_000 },
      { name: 'Tầng hầm', elevationMm: -3_000, heightMm: 3_000 },
      { name: 'Tầng trệt', elevationMm: 0, heightMm: 3_000 },
      { name: 'Tầng 1', elevationMm: 3_000, heightMm: 3_000 },
      { name: 'Tầng 2', elevationMm: 5_000, heightMm: 3_000 }, // inside Tầng 1 (3 m + 3 m): 1000 mm overlap
      { name: 'Tầng 3', elevationMm: 8_000, heightMm: 3_000 },
      { name: 'Mái', elevationMm: 11_000, heightMm: 3_000 },
    ]);
    const f = (name: string): SeededFloorRow => floorOf(project.floors, name);
    const flow = await openFlow(browser, uploader);
    const { page } = flow;
    const matched: Record<string, string> = {};
    /** One pick of `name`; returns the floor name its init went to, or "tray". Removes the file again afterwards. */
    const autoPick = async (name: string, keep = false): Promise<string> => {
      const mark = flow.sent.length;
      await pick(page, { name, mimeType: 'image/png', buffer: junk });
      const landed = await expect
        .poll(() => (initsSince(flow, mark).length > 0 ? 'init' : ''), { timeout: 5_000 })
        .toBe('init')
        .then(() => 'init')
        .catch(() => 'tray');
      if (landed === 'tray') {
        await expect(trayItem(page, name)).toBeVisible();
        matched[name] = 'tray';
        return 'tray';
      }
      const floorId = String(initsSince(flow, mark)[0]?.init?.floorId ?? '');
      const floor = project.floors.find((row) => row.id === floorId);
      matched[name] = floor?.name ?? floorId;
      if (floor !== undefined) {
        await expect.soft(card(page, floor).getByText(AUTO_MATCH, { exact: true }), `hint on ${floor.name} for "${name}"`).toBeVisible();
        if (!keep) {
          await removeFromCard(page, floor, name);
          await expect(cardSummary(page, floor, name)).toHaveCount(0);
        }
      }
      return matched[name] ?? '';
    };
    try {
      await openUpload(page, project.projectId, project.floors);

      await test.step('[10-A-012] tang-1.png → no tray; init on Tầng 1; hint; "Đã gắn kèm" in the attention variant, not verified', async () => {
        const mark = flow.sent.length;
        await pick(page, { name: 'tang-1.png', mimeType: 'image/png', buffer: png });
        const [init] = await inits(flow, mark, 1);
        expect(init?.floorId).toBe(f('Tầng 1').id); // UFU:764-787
        await expect(tray(page)).toHaveCount(0);
        await expect(card(page, f('Tầng 1')).getByText(AUTO_MATCH, { exact: true })).toBeVisible();
        await waitAttached(page, f('Tầng 1'));
        await expect(card(page, f('Tầng 1')).getByText(ATTACHED, { exact: true })).toHaveClass(/bg-state-attention-tint/u); // UFU:1087-1090
        await captureEvidence(page, 'E03_10-A-012_auto-match-attention.png');
      });

      await test.step('[10-A-015] card "Gán cho tầng khác" → "Mái" → hint gone; badge verified', async () => {
        const mark = flow.sent.length;
        await assignFromCard(page, f('Tầng 1'), 'Mái');
        const [init] = await inits(flow, mark, 1);
        expect.soft(init?.floorId).toBe(f('Mái').id);
        await waitAttached(page, f('Mái'));
        await expect.soft(card(page, f('Mái')).getByText(AUTO_MATCH, { exact: true })).toHaveCount(0); // UFU:841-845
        await expect.soft(card(page, f('Mái')).getByText(ATTACHED, { exact: true })).toHaveClass(/bg-state-verified-tint/u);
        await captureEvidence(page, 'E03_10-A-015_manual-verified.png');
      });

      await test.step('[10-A-013] one pick tang-2.png + tang-2-b.png → the first claims Tầng 2, the second stays in the tray', async () => {
        const mark = flow.sent.length;
        await pick(page, [
          { name: 'tang-2.png', mimeType: 'image/png', buffer: junk },
          { name: 'tang-2-b.png', mimeType: 'image/png', buffer: junk },
        ]);
        const [init] = await inits(flow, mark, 1);
        expect(init?.floorId).toBe(f('Tầng 2').id);
        expect(init?.fileName).toBe('tang-2.png'); // UFU:796 one `claimed` set per pick
        await expect(trayItem(page, 'tang-2-b.png')).toBeVisible();
        await quiet(page);
        expect(initsSince(flow, mark)).toHaveLength(1);
        await captureEvidence(page, 'E03_10-A-013_one-floor-one-file.png');
        await removeFromCard(page, f('Tầng 2'), 'tang-2.png');
        await trashInTray(page, 'tang-2-b.png');
      });

      const expectEach = async (names: readonly string[], floorName: string, evidence: string): Promise<void> => {
        for (const [i, name] of names.entries()) {
          const keep = i === names.length - 1;
          expect.soft(await autoPick(name, keep), `"${name}" → ${floorName}`).toBe(floorName);
          if (keep && matched[name] !== 'tray') {
            await card(page, floorOf(project.floors, matched[name] ?? floorName)).scrollIntoViewIfNeeded();
            await captureEvidence(page, evidence, { caption: names.map((n) => `${n} → ${matched[n] ?? '?'}`) });
            await removeFromCard(page, floorOf(project.floors, matched[name] ?? floorName), name);
          } else if (keep) {
            await captureEvidence(page, evidence, { caption: names.map((n) => `${n} → ${matched[n] ?? '?'}`) });
          }
        }
      };

      await test.step('[10-C-025] "tang-2", "TẦNG 2", "floor 2", "level 2" → Tầng 2 each', async () => {
        await expectEach(['tang-2.png', 'TẦNG 2.png', 'floor 2.png', 'level 2.png'], 'Tầng 2', 'E03_10-C-025_explicit-forms.png');
      });

      await test.step('[10-C-007] "TANG-2.PNG" → no refusal (extension lower-cased), matched to Tầng 2', async () => {
        await expectEach(['TANG-2.PNG'], 'Tầng 2', 'E03_10-C-007_upper-case-extension.png');
      });

      await test.step('[10-C-028] "lau-2", "T2", "L2", "fl2" → Tầng 2 with the auto-match hint', async () => {
        await expectEach(['lau-2.png', 'T2.png', 'L2.png', 'fl2.png'], 'Tầng 2', 'E03_10-C-028_short-forms.png');
      });

      await test.step('[10-C-026] "ham", "basement", "B1" → Tầng hầm; "tang-ham-2" → Tầng hầm 2', async () => {
        await expectEach(['ham.png', 'basement.png', 'B1.png'], 'Tầng hầm', 'E03_10-C-026_basement-forms.png');
        expect.soft(await autoPick('tang-ham-2.png'), '"tang-ham-2" → Tầng hầm 2').toBe('Tầng hầm 2');
      });

      await test.step('[10-C-027] "tret", "ground floor" → Tầng trệt', async () => {
        await expectEach(['tret.png', 'ground floor.png'], 'Tầng trệt', 'E03_10-C-027_ground-forms.png');
      });

      await test.step('[10-C-030] "ban-ve-B2-tang-3.png" → Tầng 3, not Tầng hầm 2', async () => {
        await expectEach(['ban-ve-B2-tang-3.png'], 'Tầng 3', 'E03_10-C-030_explicit-beats-b2.png');
      });

      await test.step('[10-C-029] "A-101-trang-3", "sheet3", "p3" → tray, no init (sheet numbers ignored)', async () => {
        await expectEach(['A-101-trang-3.png', 'sheet3.png', 'p3.png'], 'tray', 'E03_10-C-029_sheet-numbers.png');
      });

      await test.step('[10-C-031] "T.png", "tang.png" → tray, no init', async () => {
        await expectEach(['T.png', 'tang.png'], 'tray', 'E03_10-C-031_no-number.png');
      });

      await test.step('[10-C-032] "mai.png" → tray; "Mái" is never an auto-match target', async () => {
        await expectEach(['mai.png'], 'tray', 'E03_10-C-032_roof-never-matched.png');
        await attachJson('E03_10-C-0xx_auto-match-table.json', { matched });
      });

      await test.step('[10-B-037] "Bắt đầu xử lý" → the overlap reason "… hai tầng chồng lấn 1000 mm."', async () => {
        await submit(page).click();
        await expect(notice(page)).toContainText(BLOCKED_TITLE);
        // UFU:986-1002 issue.message as is; alignFloors.ts:517-520 prefixes "Tầng " to a name that already says "Tầng".
        await expect.soft(notice(page)).toContainText(/bắt đầu ở cao độ 5,000 m, thấp hơn trần tầng (Tầng )?Tầng 1 ở 6,000 m: hai tầng chồng lấn 1000 mm\./u);
        const doubled = (await notice(page).innerText()).includes('Tầng Tầng');
        if (doubled) suspected('10-B-037: the overlap reason reads "Tầng Tầng 2 … trần tầng Tầng 1" (domain prefix + floor name)');
        await notice(page).scrollIntoViewIfNeeded();
        await captureEvidence(page, 'E03_10-B-037_overlap-reason.png');
        expect.soft(doubled, 'the overlap sentence names each floor once').toBe(false);
      });
    } finally {
      await closeFlow(flow);
      await deleteSeededProject(uploaderApi, project.projectId);
    }
  });

  test('FL-10-06 · SCR-10 multi-page and single-page PDFs: pick a page, change it, PDF without a page count', async ({ browser }) => {
    test.setTimeout(240_000);
    const project = await createProject(uploaderApi, '10-06', 2);
    const [t1, t2] = project.floors as [SeededFloorRow, SeededFloorRow];
    const flow = await openFlow(browser, uploader);
    const { page } = flow;
    const pdf = (name: string, bytes: Buffer): { name: string; mimeType: string; buffer: Buffer } => ({ name, mimeType: 'application/pdf', buffer: bytes });
    try {
      await openUpload(page, project.projectId, project.floors);

      await test.step('[10-A-016] valid 3-page ba-trang.pdf on Tầng 1 → "Chờ xử lý" + "Chọn trang" (3); no init; submit "Tầng 1 chưa chọn trang của bản vẽ." (BUG-303)', async () => {
        await pick(page, pdf('ba-trang.pdf', makePdf(3)));
        await expect(trayItem(page, 'ba-trang.pdf').getByText(/ · 3 trang$/u)).toBeVisible();
        const mark = flow.sent.length;
        await assignFromTray(page, 'ba-trang.pdf', t1.name);
        await expect(card(page, t1).getByText(WAITING, { exact: true })).toBeVisible();
        const picker = card(page, t1).getByRole('combobox', { name: PICK_PAGE });
        await picker.click();
        await expect(page.getByRole('option', { name: /^Trang [1-3]$/u })).toHaveCount(3);
        await page.keyboard.press('Escape');
        await quiet(page);
        expect(initsSince(flow, mark)).toHaveLength(0); // UFU:625-628
        await submit(page).click();
        await expect(notice(page)).toContainText(`${t1.name} chưa chọn trang của bản vẽ.`); // UFU:955-957
        await captureEvidence(page, 'E03_10-A-016_pdf-waits-for-page.png');
      });

      await test.step('[10-E-004] "Chọn trang" combobox: ArrowDown walks "Trang N"; Esc closes', async () => {
        const picker = card(page, t1).getByRole('combobox', { name: PICK_PAGE });
        await picker.focus();
        await page.keyboard.press('ArrowDown'); // opens, highlight 0
        await expect.soft(picker).toHaveAttribute('aria-expanded', 'true');
        const highlighted: string[] = [];
        for (let i = 0; i < 3; i += 1) {
          highlighted.push(await page.getByRole('option').evaluateAll((els) => els.filter((el) => el.className.split(/\s+/u).includes('bg-bg-hover')).map((el) => el.textContent ?? '').join('|')));
          await page.keyboard.press('ArrowDown');
        }
        expect.soft(highlighted, 'highlight walks Trang 1 → 2 → 3').toEqual(['Trang 1', 'Trang 2', 'Trang 3']);
        await page.keyboard.press('Escape');
        await expect.soft(picker).toHaveAttribute('aria-expanded', 'false');
        await attachJson('E03_10-E-004_page-picker-keys.json', { highlighted });
      });

      await test.step('[10-A-017] pick "Trang 2" → init pageIndex 1 → chunks → complete → "Đã gắn kèm"', async () => {
        const mark = flow.sent.length;
        await card(page, t1).getByRole('combobox', { name: PICK_PAGE }).click();
        await page.getByRole('option', { name: 'Trang 2', exact: true }).click(); // UFU:856-869
        const [init] = await inits(flow, mark, 1);
        expect(init?.pageIndex).toBe(1);
        await waitAttached(page, t1);
        await captureEvidence(page, 'E03_10-A-017_page-2-attached.png', { caption: `init body: ${JSON.stringify(init)}` });
      });

      await test.step('[10-A-018] change to "Trang 3" → a new init with pageIndex 2 → "Đã gắn kèm"', async () => {
        const mark = flow.sent.length;
        await card(page, t1).getByRole('combobox', { name: PICK_PAGE }).click();
        await page.getByRole('option', { name: 'Trang 3', exact: true }).click();
        const [init] = await inits(flow, mark, 1);
        expect(init?.pageIndex).toBe(2);
        await waitAttached(page, t1);
        await captureEvidence(page, 'E03_10-A-018_page-3-attached.png', { caption: `init body: ${JSON.stringify(init)}` });
      });

      await test.step('[10-A-019] 1-page PDF on Tầng 2 → no "Chọn trang"; init without pageIndex; "{name} · {size} · 1 trang"; "Đã gắn kèm"', async () => {
        const onePage = makePdf(1);
        await pick(page, pdf('mot-trang.pdf', onePage));
        await expect(trayItem(page, 'mot-trang.pdf').getByText(`mot-trang.pdf · ${String(onePage.length)} B · 1 trang`, { exact: true })).toBeVisible();
        const mark = flow.sent.length;
        await assignFromTray(page, 'mot-trang.pdf', t2.name);
        const [init] = await inits(flow, mark, 1);
        expect(init !== undefined && 'pageIndex' in init, 'init carries no pageIndex').toBe(false); // UFU:284-300, 649-668
        await waitAttached(page, t2);
        const pickers = await card(page, t2).getByRole('combobox', { name: PICK_PAGE }).count();
        await captureEvidence(page, 'E03_10-A-019_one-page-pdf.png', { caption: `"Chọn trang" on a 1-page PDF card: ${String(pickers)}` });
        expect.soft(pickers, 'a 1-page PDF offers no page picker').toBe(0); // QA-03e BUG-530: pageOptions only when pageCount > 1 (UFU:1089-1092, FUC:215)
      });

      await test.step('[10-C-016] /Count 0 PDF → no "N trang", no picker, init without pageIndex; complete 422 → validation sentence', async () => {
        await pick(page, pdf('khong-dem.pdf', makePdf(0)));
        await expect.soft(trayItem(page, 'khong-dem.pdf').getByText(/ trang$/u)).toHaveCount(0); // UFU:1055-1058
        const mark = flow.sent.length;
        const completeAnswer = waitForApi(page, 'POST', COMPLETE_RE, [422], 30_000).catch(() => null);
        await assignFromTray(page, 'khong-dem.pdf', t2.name);
        const [init] = await inits(flow, mark, 1);
        expect.soft(init !== undefined && 'pageIndex' in init, 'no pageIndex').toBe(false);
        await expect.soft(card(page, t2).getByRole('combobox', { name: PICK_PAGE })).toHaveCount(0);
        const answer = await completeAnswer;
        expect.soft(answer?.response.status() ?? 'no 422 complete').toBe(422);
        await expect.soft(card(page, t2).getByRole('alert')).toContainText(VALIDATION_SENTENCE);
        await captureEvidence(page, 'E03_10-C-016_count-zero-pdf.png', { caption: `complete: ${JSON.stringify(answer?.json ?? null).slice(0, 160)}` });
      });
    } finally {
      await closeFlow(flow);
      await deleteSeededProject(uploaderApi, project.projectId);
    }
  });

  test('FL-10-07 · SCR-10 server refuses the file: CAD, MIME, bytes, empty, long name, deleted floor; chunk boundary', async ({ browser }) => {
    test.setTimeout(300_000);
    const png = envDrawingPng();
    const project = await createProject(uploaderApi, '10-07', 2);
    const [t1, t2] = project.floors as [SeededFloorRow, SeededFloorRow];
    const flow = await openFlow(browser, uploader);
    const { page } = flow;
    const file = (name: string, buffer: Buffer, mimeType = 'image/png'): { name: string; mimeType: string; buffer: Buffer } => ({ name, mimeType, buffer });
    /** Picks `f`, assigns it to `floor`, waits for the init (and, when `atComplete`, the complete) answer. */
    const refusedUpload = async (f: { name: string; mimeType: string; buffer: Buffer }, floor: SeededFloorRow, atComplete: boolean): Promise<{ status: number | string; code: string; inits: number }> => {
      await pick(page, f);
      const mark = flow.sent.length;
      const answer = waitForApi(page, 'POST', atComplete ? COMPLETE_RE : INIT_RE, [400, 404, 413, 422], 30_000).catch(() => null);
      await assignFromTray(page, f.name, floor.name);
      const got = await answer;
      await expect(card(page, floor).getByText(STATUS_ERROR, { exact: true })).toBeVisible({ timeout: 30_000 });
      await quiet(page);
      const json = (got?.json ?? {}) as { code?: string; error?: { code?: string } };
      return { status: got?.response.status() ?? 'none', code: json.code ?? json.error?.code ?? '', inits: initsSince(flow, mark).length };
    };
    const noRetry = async (floor: SeededFloorRow): Promise<number> => {
      await menuButton(page, floor).click();
      const retries = await card(page, floor).getByRole('button', { name: RETRY, exact: true }).count();
      await page.keyboard.press('Escape');
      return retries;
    };
    try {
      await openUpload(page, project.projectId, project.floors);

      await test.step('[10-C-008] ban-ve.dwg via the input (accept omits it) → no client refusal, "Gán cho tầng khác" offered', async () => {
        await pick(page, file('ban-ve.dwg', Buffer.from('AC1027 qa-e03 not a real drawing\n'), 'application/octet-stream'));
        await expect.soft(trayItem(page, 'ban-ve.dwg').getByRole('alert')).toHaveCount(0); // VAL:53-66 branch cad
        await expect.soft(trayItem(page, 'ban-ve.dwg').getByRole('combobox', { name: ASSIGN })).toBeVisible();
        await captureEvidence(page, 'E03_10-C-008_dwg-accepted-by-client.png');
      });

      let dwgInits = 0;
      await test.step('[10-B-017] assign to Tầng 1 → init 422 → CAD sentence + "Lỗi"; no CAD pill (BUG-304)', async () => {
        const mark = flow.sent.length;
        const answer = waitForApi(page, 'POST', INIT_RE, [422], 30_000);
        await assignFromTray(page, 'ban-ve.dwg', t1.name);
        await answer; // BE drawings/uploads.py declared_kind → CAD_NOT_SUPPORTED
        await expect(card(page, t1).getByRole('alert')).toContainText(CAD_SENTENCE); // FUG:194-199
        await expect(card(page, t1).getByText(STATUS_ERROR, { exact: true })).toBeVisible();
        await expect(card(page, t1).getByText(CAD_PILL, { exact: true })).toHaveCount(0); // UFU:1078
        await captureEvidence(page, 'E03_10-B-017_dwg-422.png');
        await quiet(page);
        dwgInits = initsSince(flow, mark).length;
      });

      await test.step('[10-C-036] exactly one init POST for the .dwg (a 422 is not retried)', async () => {
        expect.soft(dwgInits, 'UT:200,390 terminal').toBe(1);
      });

      await test.step('[10-A-023] "Đóng" → sentence gone; badge stays "Lỗi"; submit "Tầng 1 chưa tải xong bản vẽ."', async () => {
        await card(page, t1).getByRole('alert').getByRole('button', { name: DISMISS, exact: true }).click();
        await expect(card(page, t1).getByRole('alert')).toHaveCount(0);
        await expect(card(page, t1).getByText(STATUS_ERROR, { exact: true })).toBeVisible();
        await submit(page).click();
        await expect(notice(page)).toContainText(`${t1.name} chưa tải xong bản vẽ.`); // UFU:946-959
        await captureEvidence(page, 'E03_10-A-023_dismissed-still-blocked.png');
      });

      await test.step('[10-B-018] x.png sent as text/plain → init 422 → "Lỗi" + validation sentence; no "Thử lại"; 1 init', async () => {
        const r = await refusedUpload(file('x.png', png, 'text/plain'), t1, false); // BE uploads.py:112-114 FILE_TYPE_MISMATCH
        expect.soft(r.status).toBe(422);
        expect.soft(r.inits).toBe(1);
        await expect.soft(card(page, t1).getByRole('alert')).toContainText(VALIDATION_SENTENCE);
        expect.soft(await noRetry(t1)).toBe(0);
        await captureEvidence(page, 'E03_10-B-018_mime-mismatch.png', { caption: `init ${String(r.status)} ${r.code}` });
      });

      await test.step('[10-B-029] text bytes as x-chu.png, then a PNG without IEND → complete 422 each → validation sentence; no "Thử lại"', async () => {
        const text = await refusedUpload(file('x-chu.png', Buffer.from('chữ, không phải ảnh\n', 'utf8')), t1, true);
        await expect.soft(card(page, t1).getByRole('alert')).toContainText(VALIDATION_SENTENCE);
        expect.soft(await noRetry(t1)).toBe(0);
        const cut = await refusedUpload(file('x-cut.png', pngWithoutIend(png)), t1, true);
        await expect.soft(card(page, t1).getByRole('alert')).toContainText(VALIDATION_SENTENCE);
        expect.soft(await noRetry(t1)).toBe(0);
        expect.soft([text.status, cut.status]).toEqual([422, 422]);
        await captureEvidence(page, 'E03_10-B-029_complete-422-bytes.png', { caption: `text-as-png: ${String(text.status)} ${text.code}; no IEND: ${String(cut.status)} ${cut.code}` });
      });

      await test.step('[10-B-030] DWG magic bytes in x-dwg.png → complete 422 CAD_NOT_SUPPORTED → the CAD sentence', async () => {
        const r = await refusedUpload(file('x-dwg.png', Buffer.from('AC1032 qa-e03 dwg magic in a png name\n')), t1, true); // complete.py:145-153
        expect.soft(`${String(r.status)} ${r.code}`).toBe('422 CAD_NOT_SUPPORTED');
        await expect.soft(card(page, t1).getByRole('alert')).toContainText(CAD_SENTENCE);
        await captureEvidence(page, 'E03_10-B-030_dwg-magic-in-png.png');
      });

      await test.step('[10-C-017] 0-byte rong.png → client accepts; init 422 → validation sentence', async () => {
        await pick(page, file('rong.png', Buffer.alloc(0)));
        await expect.soft(trayItem(page, 'rong.png').getByRole('alert')).toHaveCount(0);
        const mark = flow.sent.length;
        const answer = waitForApi(page, 'POST', INIT_RE, [422], 30_000).catch(() => null);
        await assignFromTray(page, 'rong.png', t1.name);
        expect.soft((await answer)?.response.status() ?? 'none').toBe(422); // BE schemas.py:65 sizeBytes ≥ 1
        await expect.soft(card(page, t1).getByRole('alert')).toContainText(VALIDATION_SENTENCE);
        expect.soft(initsSince(flow, mark)).toHaveLength(1);
        await captureEvidence(page, 'E03_10-C-017_empty-png.png');
      });

      await test.step('[10-C-018] a 256-character name, then a name with U+202E → client accepts; init 422 fileName → validation sentence', async () => {
        const longName = `${'a'.repeat(252)}.png`;
        const bidiName = 'ban-ve-‮gnp.png';
        const results: string[] = [];
        for (const name of [longName, bidiName]) {
          await pick(page, file(name, png));
          await expect.soft(trayItem(page, name).getByRole('alert')).toHaveCount(0);
          const answer = waitForApi(page, 'POST', INIT_RE, [422], 30_000).catch(() => null);
          await assignFromTray(page, name, t1.name);
          const got = await answer;
          results.push(`${String(got?.response.status() ?? 'none')} ${JSON.stringify(got?.json ?? null).slice(0, 120)}`);
          await expect.soft(card(page, t1).getByRole('alert')).toContainText(VALIDATION_SENTENCE);
        }
        expect.soft(results.map((r) => r.slice(0, 3))).toEqual(['422', '422']);
        await captureEvidence(page, 'E03_10-C-018_bad-file-names.png', { caption: results });
      });

      await test.step('[10-C-020] PNG of exactly 5 MiB → 1 chunk then complete; 5 MiB + 1 → chunkIndex 0 and 1 then complete', async () => {
        const seen: string[][] = [];
        for (const [name, size] of [['nam-mib.png', CHUNK_BYTES], ['nam-mib-mot.png', CHUNK_BYTES + 1]] as const) {
          await pick(page, file(name, paddedPng(png, size)));
          const mark = flow.sent.length;
          const complete = waitForApi(page, 'POST', COMPLETE_RE, [200, 422], 60_000);
          await assignFromTray(page, name, t1.name);
          await complete;
          seen.push(flow.sent.slice(mark).filter((r) => CHUNK_RE.test(r.path) || COMPLETE_RE.test(r.path)).map((r) => (r.chunkIndex === null ? 'complete' : `chunk ${String(r.chunkIndex)}`)));
        }
        await attachJson('E03_10-C-020_chunk-boundary.json', { exactly5MiB: seen[0], fiveMiBPlusOne: seen[1] });
        expect.soft(seen[0]).toEqual(['chunk 0', 'complete']); // chunk.ts:120-156
        expect.soft(seen[1]).toEqual(['chunk 0', 'chunk 1', 'complete']);
      });

      // QA-03f (FIX-2426, BUG-572): after the init 404 the floor re-read (BUG-311) no longer holds Tầng 2, so its card leaves and the
      // file returns to the tray with the floor-gone sentence, not retryable (useFloorUploadScreen.ts:844-866, 1415-1419 at ecab056b;
      // tray alert FloorUploadTray.tsx:106-115). `refusedUpload` waits for the card's "Lỗi", which no longer stays — inline here.
      await test.step('[10-B-019] Tầng 2 deleted by the API, then a PNG assigned to it → init 404 → card gone, file back in the tray with "Tầng 2 đã bị xoá ở nơi khác…"; no "Thử lại"', async () => {
        const removed = await uploaderApi.delete(`/api/floors/${t2.id}`);
        expect(removed.status(), 'the other writer: DELETE /api/floors/:id').toBe(200);
        const name = 'tang-da-xoa.png';
        await pick(page, file(name, png));
        const mark = flow.sent.length;
        const answer = waitForApi(page, 'POST', INIT_RE, [404], 30_000).catch(() => null);
        await assignFromTray(page, name, t2.name);
        const got = await answer;
        expect.soft(got?.response.status() ?? 'none', 'init on the deleted floor').toBe(404);
        const alert = trayItem(page, name).getByRole('alert');
        await expect.soft(alert).toContainText(`${t2.name} đã bị xoá ở nơi khác; ${name} đã về khay tệp chưa gán tầng, hãy gán cho tầng khác`, { timeout: 30_000 });
        await expect.soft(card(page, t2)).toHaveCount(0);
        await expect.soft(trayItem(page, name).getByRole('button', { name: RETRY, exact: true })).toHaveCount(0);
        expect.soft(initsSince(flow, mark), 'one init, no retry').toHaveLength(1);
        await captureEvidence(page, 'E03_10-B-019_floor-deleted-404.png', { caption: `init ${String(got?.response.status() ?? 'none')}` });
      });
    } finally {
      await closeFlow(flow);
      await deleteSeededProject(uploaderApi, project.projectId);
    }
  });

  test('FL-10-08 · SCR-10 project with a server drawing: counter, replace it, fail over it, finish and submit', async ({ browser }) => {
    test.setTimeout(240_000);
    const png = envDrawingPng();
    // S2: Tầng 1 holds an uploaded drawing; Tầng 2 none (drawingSeed createDrawingProject, both floors in one POST).
    const seeded = await createDrawingProject(uploaderApi, '10-08', png, ['Tầng 1', 'Tầng 2']);
    const floors = await listFloors(uploaderApi, seeded.projectId);
    const [t1, t2] = floors as [SeededFloorRow, SeededFloorRow];
    const read = await uploaderApi.get(`/api/projects/${seeded.projectId}`);
    const serverName = String(
      ((await read.json()) as { floors: { id: string; drawings: { name: string }[] }[] }).floors.find((row) => row.id === t1.id)?.drawings[0]?.name ?? '',
    );
    const big = paddedPng(png, 16 * MIB); // long enough to watch "Đang tải lên"
    const flow = await openFlow(browser, uploader);
    const { page } = flow;
    try {
      await test.step('[10-B-010] open → "1 / 2 tầng đã có bản vẽ"; Tầng 1 attached next to Tầng 2 "Chưa có bản vẽ"', async () => {
        await openUpload(page, seeded.projectId, floors);
        await expect(page.getByTestId(COUNTER)).toHaveText(counterText(1, 2));
        await expect(card(page, t1).getByText(ATTACHED, { exact: true })).toBeVisible();
        await expect(card(page, t2).getByText(NO_DRAWING, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_10-B-010_one-of-two.png');
      });

      await test.step('[10-B-013] Tầng 1: "Đã gắn kèm", summary = server file name, no menu, no progress rail (QA-03e: rail only while uploading)', async () => {
        await expect.soft(card(page, t1).getByText(ATTACHED, { exact: true })).toBeVisible(); // UFU:1097-1098 server drawing → attached
        await expect.soft(card(page, t1).getByText(serverName, { exact: true })).toBeVisible(); // UFU:1096-1119
        await expect.soft(menuButton(page, t1)).toHaveCount(0); // FUC:82-86
        const bars = await card(page, t1).getByRole('progressbar').count();
        await captureEvidence(page, 'E03_10-B-013_server-drawing-card.png', { caption: `server name "${serverName}"; progressbars on the card: ${String(bars)}` });
        // Catalog fixed by QA-03e: FloorUploadCard.tsx:299 renders the rail (and its progressbar) only while uploading, so the
        // "Tải xong {name}" label built at useFloorUploadScreen.ts:1136-1138 is never on screen for an attached card.
        expect.soft(bars, 'an attached card has no progress rail').toBe(0);
      });

      await test.step('[10-B-014] Tầng 1 server-drawing card offers no "Gán cho tầng khác"; no request, the file stays', async () => {
        const mark = flow.sent.length;
        // QA-03e (BUG-531, FIX-2251): a card holding only a server drawing gets `reassignOptions: []`
        // (useFloorUploadScreen.ts:1168 `canEdit && attachment !== null`), so FloorUploadCard.tsx:268 renders no picker.
        await expect.soft(card(page, t1).getByRole('combobox', { name: ASSIGN }), 'no floor picker on a server drawing').toHaveCount(0);
        await quiet(page);
        expect.soft(writesSince(flow, mark)).toEqual([]);
        await expect.soft(card(page, t1).getByText(ATTACHED, { exact: true })).toBeVisible();
        await expect.soft(card(page, t2).getByText(NO_DRAWING, { exact: true })).toBeVisible();
        const pickers = await card(page, t1).getByRole('combobox', { name: ASSIGN }).count();
        await captureEvidence(page, 'E03_10-B-014_server-card-reassign-noop.png', { caption: `floor pickers on the server card: ${String(pickers)}` });
      });

      await test.step('[10-A-014] pick tang-1.png → stays in the tray (Tầng 1 has a drawing); no init', async () => {
        const mark = flow.sent.length;
        await pick(page, { name: 'tang-1.png', mimeType: 'image/png', buffer: big });
        await expect(trayItem(page, 'tang-1.png')).toBeVisible(); // UFU:720-736 takenFloorIds
        await quiet(page);
        expect.soft(initsSince(flow, mark)).toHaveLength(0);
        await captureEvidence(page, 'E03_10-A-014_auto-match-skips-drawn-floor.png');
      });

      await test.step('[10-B-036] ban-ve.dwg on Tầng 1 → "Lỗi"; counter "0 / 2"; submit "Tầng 1 chưa tải xong bản vẽ."', async () => {
        await pick(page, { name: 'ban-ve.dwg', mimeType: 'application/octet-stream', buffer: Buffer.from('AC1027 qa-e03\n') });
        await assignFromTray(page, 'ban-ve.dwg', t1.name);
        await expect(card(page, t1).getByText(STATUS_ERROR, { exact: true })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId(COUNTER)).toHaveText(counterText(0, 2)); // UFU:1097-1098, 1183
        await submit(page).click();
        await expect(notice(page)).toContainText(`${t1.name} chưa tải xong bản vẽ.`);
        await captureEvidence(page, 'E03_10-B-036_failed-over-server-drawing.png');
      });

      await test.step('[10-C-035] tang-1.png on Tầng 1: while "Đang tải lên" the counter stays "0 / 2"', async () => {
        const chunk0 = waitForApi(page, 'POST', CHUNK_RE, [200], 60_000);
        await assignFromTray(page, 'tang-1.png', t1.name);
        await expect(card(page, t1).getByText(UPLOADING, { exact: true })).toBeVisible();
        await expect.soft(page.getByTestId(COUNTER)).toHaveText(counterText(0, 2));
        await captureEvidence(page, 'E03_10-C-035_counter-while-uploading.png');
        await chunk0;
      });

      await test.step('[10-A-011] the upload finishes → Tầng 1 shows tang-1.png instead of the server drawing; "1 / 2"', async () => {
        await waitAttached(page, t1);
        await expect(cardSummary(page, t1, 'tang-1.png')).toBeVisible(); // UFU:1095-1119 attachment wins
        await expect(page.getByTestId(COUNTER)).toHaveText(counterText(1, 2));
        await captureEvidence(page, 'E03_10-A-011_replaced-server-drawing.png');
      });

      await test.step('[10-A-034] submit → "Tầng 2 chưa có bản vẽ."; ban-ve.png uploaded to Tầng 2 → the notice goes without a re-click', async () => {
        await submit(page).click();
        await expect(notice(page)).toContainText(`${t2.name} chưa có bản vẽ.`);
        await captureEvidence(page, 'E03_10-A-034_notice-before.png');
        await pick(page, { name: 'ban-ve.png', mimeType: 'image/png', buffer: png });
        await assignFromTray(page, 'ban-ve.png', t2.name);
        await waitAttached(page, t2);
        await expect(notice(page)).toHaveCount(0); // UFU:1010-1012
        await captureEvidence(page, 'E03_10-A-034_notice-gone.png');
      });

      await test.step('[10-B-011] "2 / 2 tầng đã có bản vẽ"; no invitation sentence', async () => {
        await expect.soft(page.getByTestId(COUNTER)).toHaveText(counterText(2, 2));
        await expect.soft(page.getByText(UPLOAD_EMPTY, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_10-B-011_all-attached.png');
      });

      await test.step('[10-E-008] the visible number is aria-hidden; a sr-only role=status holds "2 / 2 tầng đã có bản vẽ"', async () => {
        await expect.soft(page.getByTestId(COUNTER)).toHaveAttribute('aria-hidden', 'true'); // FUF:97-109
        await expect.soft(page.getByRole('status').filter({ hasText: new RegExp(`^${escapeRegExp(counterText(2, 2))}$`, 'u') })).toHaveCount(1);
      });

      await test.step('[10-A-035] "Bắt đầu xử lý" → /projects/:id/pipeline, no request', async () => {
        const mark = flow.sent.length;
        await submit(page).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(seeded.projectId)); // UFU:1040-1042
        const writes = writesSince(flow, mark);
        await captureEvidence(page, 'E03_10-A-035_submit-opens-pipeline.png', { caption: `writes since the click: ${JSON.stringify(writes)}` });
        expect(writes, '"Bắt đầu xử lý" itself sends no request').toEqual([]);
      });
    } finally {
      await closeFlow(flow);
      await deleteSeededProject(uploaderApi, seeded.projectId);
    }
  });

  test('FL-10-09 · SCR-10 thirty floors: scroll to the end and submit', async ({ browser }) => {
    const project = await createProject(adminApi, '10-09', 30);
    const flow = await openFlow(browser, readAdminCredentials());
    const { page } = flow;
    try {
      await test.step('[10-B-041] open → 30 cards (staggered reveal), "0 / 30 tầng đã có bản vẽ"', async () => {
        await openUpload(page, project.projectId, project.floors);
        await expect(page.locator('[data-floor-id]')).toHaveCount(30);
        await expect(page.getByTestId(COUNTER)).toHaveText(counterText(0, 30));
        const delays = await page.locator('[data-floor-id]').evaluateAll((els) => els.map((el) => (el as HTMLElement).style.animationDelay));
        await attachJson('E03_10-B-041_reveal-delays.json', { delays });
        expect.soft(delays[0], 'first card at once').toBe('0ms'); // staggerDelayMs(0)
        expect.soft(Number.parseFloat(delays[29] ?? '0'), 'later cards later').toBeGreaterThan(0);
        await captureEvidence(page, 'E03_10-B-041_thirty-floors.png');
      });

      await test.step('[10-A-033] scroll to the end, "Bắt đầu xử lý" once → 30 reasons; Tầng 1 card scrolls into view', async () => {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expect(card(page, project.floors[0] as SeededFloorRow)).not.toBeInViewport();
        await submit(page).click();
        await expect.soft(notice(page).getByRole('listitem')).toHaveCount(30); // UFU:940-962
        await expect.soft(card(page, project.floors[0] as SeededFloorRow)).toBeInViewport(); // FU:126-139
        await captureEvidence(page, 'E03_10-A-033_scrolled-to-first-blocked.png');
      });
    } finally {
      await closeFlow(flow);
      await deleteSeededProject(adminApi, project.projectId);
    }
  });

  test('FL-10-10 · SCR-10 narrow screen: collapsed cards, missing invitation, live breakpoint', async ({ browser }) => {
    const project = await createProject(adminApi, '10-10', 2);
    const flow = await openFlow(browser, readAdminCredentials(), { viewport: COMPACT });
    const { page } = flow;
    const first = (): Locator => card(page, project.floors[0] as SeededFloorRow);
    try {
      await test.step('[10-F-021] 375 px → cards stacked (flex-col, gap-2); no horizontal scroll', async () => {
        await openUpload(page, project.projectId, project.floors);
        await expect(first()).toHaveClass(/\bflex-col\b/u); // FUC:201
        await expect(page.locator('ul:has(> [data-floor-id])')).toHaveClass(/\bgap-2\b/u); // FU:175
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        await captureEvidence(page, 'E03_10-F-021_compact-cards.png', { fullPage: true, caption: `horizontal overflow ${String(overflow)} px` });
        expect(overflow, 'no horizontal scroll at 375 px').toBeLessThanOrEqual(0);
      });

      await test.step('[10-F-023] the invitation sentence at 375 px (collapsed wins over empty in UFU:1222-1224)', async () => {
        const shown = await page.getByText(UPLOAD_EMPTY, { exact: true }).isVisible();
        if (!shown) suspected('10-F-023: below 1024 px the empty-state invitation is missing (state "collapsed" wins over "empty")');
        await captureEvidence(page, 'E03_10-F-023_compact-invitation.png', { caption: `invitation shown at 375 px: ${String(shown)}` });
        expect.soft(shown, 'a project without drawings invites the first file at every width').toBe(true);
      });

      await test.step('[10-F-022] 1023 px → collapsed; 1024 px → row layout; switches live without reload', async () => {
        await page.setViewportSize({ width: 1023, height: 800 });
        await expect.soft(first()).toHaveClass(/\bflex-col\b/u); // UFU:307-323 (width < 1024px)
        await captureEvidence(page, 'E03_10-F-022_1023-collapsed.png');
        await page.setViewportSize({ width: 1024, height: 800 });
        await expect.soft(first()).toHaveClass(/\bflex-row\b/u);
        await captureEvidence(page, 'E03_10-F-022_1024-row.png');
      });
    } finally {
      await closeFlow(flow);
      await deleteSeededProject(adminApi, project.projectId);
    }
  });
});
