/**
 * Phase 11 — SCR-09/10/11/21/25 floors EDGE (destructive controls + read-only role), real stack, QA-11 P1.
 * Flows (flows-C1.md): FL-11F-01 (engineer, remove drawing / undo / expiry), FL-11F-06 (viewer, no destructive control on
 * 5 screens), FL-11F-09 (engineer, delete + restore a floor). One `test()` per flow, one step per id.
 * Sources (FE master 5fcaf502): UFU src/screens/upload/FloorUploadScreen/useFloorUploadScreen.ts, FUT …/FloorUploadTray.tsx,
 * FUC …/FloorUploadCard.tsx, FUF …/FloorUploadFooter.tsx, UT src/lib/upload/undoTicket.ts, TST src/components/feedback/Toast.tsx,
 * FM src/screens/qc/FloorManager/*, MTL src/screens/viewer/MeasurementTool/useMeasurementTool.ts, UIQ …/InputQualityGate/*.
 * Users: pool slot `p11Slot('floors')` (engineer + viewer, only ever members of this file's own projects). The admin owns and
 * deletes every project in `finally`. Nothing shared (main chain project, CP-2, admin.storage.json) is touched.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson, captureEvidence } from './support/evidence';
import { createProject, createSkewedDrawingProject, envDrawingPng, uploadDrawing, type SeededFloorRow } from './support/phase03Seed';
import { INIT_RE, makePdf, writesSince } from './support/p03/P5';
import { skewedEnvPng } from './support/p03/P7';
import { DESKTOP, p11Slot } from './support/p11/common';
import {
  adminApi,
  card,
  cardSummary,
  deleteSeededProject,
  endMember,
  esc,
  focusName,
  recordAnnouncements,
  removedToast,
  startMember,
  statusOf,
  toastWith,
  tray,
  trayItem,
  type MemberFlow,
} from './support/p11/P1';

const SLOT = p11Slot('floors');
test.use({ viewport: DESKTOP });

const DROPZONE = 'floor-upload-dropzone'; // FUD:30
const FILE_INPUT = 'floor-upload-file-input'; // FUD:33
const COUNTER = 'floor-upload-counter-number'; // FUF:25
const BLOCK_NOTICE = 'floor-upload-block-notice'; // FUF:22
const ASSIGN = 'Gán cho tầng khác'; // FUT:20, FUC:39
const UNDO = 'Hoàn tác'; // TST:149
const ATTACHED = 'Đã gắn kèm'; // UFU:125
const NO_DRAWING = 'Chưa có bản vẽ'; // UFU:140
const SUBMIT = 'Bắt đầu xử lý'; // UFU:113
const displaced = (name: string): string => `${name} đã về khay tệp chưa gán tầng vì tầng ấy đã có tệp khác`; // UFU:1334-1336
const counterText = (done: number, total: number): string => `${String(done)} / ${String(total)} tầng đã có bản vẽ`; // UFU:1189-1191
const READ_ONLY_UPLOAD = 'Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa.'; // phase09_roles_matrix.spec.ts:59
const FLOORS_FORBIDDEN_TITLE = 'Không có quyền sửa tầng'; // phase09_roles_matrix.spec.ts:55
const FLOORS_FORBIDDEN_NOTICE = 'Vai của bạn chỉ xem được ngăn xếp tầng; mọi thao tác sửa đã được ẩn.'; // useFloorManager.ts:183
const THICKNESS_FORBIDDEN_TITLE = 'Không có quyền sửa độ dày tường'; // phase09_roles_matrix.spec.ts:78
// UNKNOWN — NEED VERIFICATION: catalog quotes measurementToolScenarios.ts:363 ("Bạn không có quyền ghim …"); the live hook
// (useMeasurementTool.ts:201) says the sentence below. The live text is asserted; the catalog text is attached as JSON.
const PIN_BLOCKED_LIVE = 'Bạn chỉ có quyền xem dự án này, nên chưa ghim được phép đo. vẫn đo và đọc số bình thường.';
const PIN_BLOCKED_CATALOG = 'Bạn không có quyền ghim phép đo trong dự án này. Liên hệ quản trị dự án.';
const STRAIGHTEN = 'Tự động nắn'; // UIQ COPY.straightenAction
const PICK = 'Chọn góc thủ công'; // UIQ COPY.pickCornersAction
const REPORT = 'Báo cáo chất lượng'; // IQR:281
const floorRows = (page: Page): Locator => page.getByRole('row', { name: /, cao độ /u });
const floorRow = (page: Page, name: string): Locator => page.getByRole('row', { name: new RegExp(`^${esc(name)}, cao độ `, 'u') });
const kebab = (page: Page, name: string): Locator => page.getByRole('button', { name: `Thao tác khác cho tầng ${name}`, exact: true }); // FTR:396
const menuButton = (page: Page, floorId: string, floorName: string): Locator =>
  card(page, floorId).getByRole('button', { name: `Tuỳ chọn của tầng ${floorName}`, exact: true }); // FUC:100-108

const pick = (page: Page, files: Parameters<Locator['setInputFiles']>[0]): Promise<void> => page.getByTestId(FILE_INPUT).setInputFiles(files);
const note = (name: string): { name: string; mimeType: string; buffer: Buffer } => ({ name, mimeType: 'text/plain', buffer: Buffer.from(`${name}\n`) });
const pdf = (name: string, pages: number): { name: string; mimeType: string; buffer: Buffer } => ({ name, mimeType: 'application/pdf', buffer: makePdf(pages) });

async function openUpload(page: Page, projectId: string, floors: readonly SeededFloorRow[]): Promise<void> {
  await page.goto(ROUTES.project.upload(projectId));
  await expect(page.getByTestId(DROPZONE)).toBeVisible();
  for (const floor of floors) await expect(card(page, floor.id)).toBeVisible();
}

async function assignFromTray(page: Page, name: string, floorName: string): Promise<void> {
  await trayItem(page, name).first().getByRole('combobox', { name: ASSIGN }).click(); // FUT:57-74
  await page.getByRole('option', { name: floorName, exact: true }).click();
}

async function removeFromCard(page: Page, floor: SeededFloorRow, fileName: string): Promise<void> {
  await menuButton(page, floor.id, floor.name).click();
  await card(page, floor.id).getByRole('button', { name: `Xoá bản vẽ ${fileName}`, exact: true }).click(); // FUC:138-150
}

const trashInTray = (page: Page, name: string): Locator =>
  trayItem(page, name).getByRole('button', { name: `Xoá bản vẽ ${name}`, exact: true }).first(); // FUT:76-83

function floorAt(floors: readonly SeededFloorRow[], index: number): SeededFloorRow {
  const floor = floors[index];
  if (floor === undefined) throw new Error(`setup: floor #${String(index)} missing`);
  return floor;
}

test.describe('phase 11 floors edge', () => {
  test('SCR-10 · FL-11F-01 · engineer · gỡ bản vẽ, hoàn tác, hết hạn', async ({ browser }) => {
    test.setTimeout(300_000);
    const admin = await adminApi();
    const project = await createProject(admin, '11f-01', 2);
    const t1 = floorAt(project.floors, 0);
    const t2 = floorAt(project.floors, 1);
    let member: MemberFlow | undefined;
    try {
      await uploadDrawing(admin, project.projectId, t1.id, envDrawingPng(), 'nen-t1.png'); // server copy on Tầng 1
      member = await startMember(browser, admin, 'engineer', SLOT, [project.projectId]);
      const { flow } = member;
      const { page } = flow;
      const announced = await recordAnnouncements(page);
      await page.clock.install(); // time flows; fastForward jumps the 8 s undo window (UT:18, TST:68-83)
      await openUpload(page, project.projectId, project.floors);
      const t2Pdf = 'ba-trang.pdf';

      await test.step('[11F-A-001] trash on the floor card removes at once, no confirm dialog', async () => {
        await pick(page, pdf(t2Pdf, 3));
        await assignFromTray(page, t2Pdf, t2.name);
        await expect(cardSummary(page, t2.id, t2Pdf)).toBeVisible();
        await removeFromCard(page, t2, t2Pdf); // UFU:933-935 "xoá xảy ra NGAY, không hộp thoại"
        await expect(cardSummary(page, t2.id, t2Pdf)).toHaveCount(0);
        expect(flow.dialogs, 'no browser dialog').toEqual([]);
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
        await captureEvidence(page, 'E11_11F-A-001_floors.png');
      });

      await test.step('[11F-A-002] the toast after removal is role=status with the exact sentence', async () => {
        const toast = toastWith(page, removedToast(t2Pdf)).first();
        await expect.soft(toast).toBeVisible();
        await expect.soft(toast).toContainText(removedToast(t2Pdf)); // UFU:977
        await captureEvidence(page, 'E11_11F-A-002_floors.png');
      });

      await test.step('[11F-A-003] "Hoàn tác" within the window brings the file back and sends no request', async () => {
        const mark = flow.sent.length;
        const toast = toastWith(page, removedToast(t2Pdf)).first();
        await toast.getByRole('button', { name: UNDO, exact: true }).click(); // UFU:928-960
        await expect.soft(cardSummary(page, t2.id, t2Pdf)).toBeVisible();
        await expect.soft(toastWith(page, removedToast(t2Pdf))).toHaveCount(0);
        expect.soft(writesSince(flow, mark), 'removal + undo are local').toEqual([]);
        await captureEvidence(page, 'E11_11F-A-003_floors.png');
      });

      await test.step('[11F-A-004] removing a tray file moves focus to a neighbouring trash button, not <body>', async () => {
        await pick(page, [note('nhat-ky-a.txt'), note('nhat-ky-b.txt')]);
        await expect(tray(page)).toBeVisible();
        await trashInTray(page, 'nhat-ky-a.txt').click();
        await expect(trayItem(page, 'nhat-ky-a.txt')).toHaveCount(0);
        const focus = await focusName(page); // FUT:39-48 removeAndKeepFocus
        expect.soft(focus, 'focus after removing a tray file').not.toBe('BODY');
        expect.soft(focus).toBe('BUTTON Xoá bản vẽ nhat-ky-b.txt'); // FUT:39-48 next trash button
        await captureEvidence(page, 'E11_11F-A-004_floors.png', { caption: `focus: ${focus}` });
      });

      await test.step('[11F-A-005] double-clicking the trash makes ONE toast and one removal', async () => {
        await trashInTray(page, 'nhat-ky-b.txt').dblclick(); // UFU:927-931 second call finds no attachment
        await expect(trayItem(page, 'nhat-ky-b.txt')).toHaveCount(0);
        await expect.soft(toastWith(page, removedToast('nhat-ky-b.txt'))).toHaveCount(1);
        await captureEvidence(page, 'E11_11F-A-005_floors.png');
      });

      await test.step('[11F-A-006] "Hoàn tác" pressed twice does not duplicate the file', async () => {
        const undo = toastWith(page, removedToast('nhat-ky-b.txt')).first().getByRole('button', { name: UNDO, exact: true });
        await undo.dblclick(); // UFU:956-960 `previous.some(...)`, ticket `used` (UT:36)
        await expect(trayItem(page, 'nhat-ky-b.txt').first()).toBeVisible();
        await expect.soft(trayItem(page, 'nhat-ky-b.txt')).toHaveCount(1);
        await captureEvidence(page, 'E11_11F-A-006_floors.png');
      });

      await test.step('[11F-A-007] floor got another file while the undo waited → undo returns the file to the tray and announces it', async () => {
        await removeFromCard(page, t2, t2Pdf);
        const toast = toastWith(page, removedToast(t2Pdf)).first();
        await expect(toast).toBeVisible();
        await pick(page, pdf('tam-trang.pdf', 2));
        await assignFromTray(page, 'tam-trang.pdf', t2.name);
        await expect(cardSummary(page, t2.id, 'tam-trang.pdf')).toBeVisible();
        await toast.getByRole('button', { name: UNDO, exact: true }).click(); // UFU:951-966 occupied → toTray + announce
        await expect.soft(trayItem(page, t2Pdf)).toBeVisible();
        await expect.soft(cardSummary(page, t2.id, t2Pdf)).toHaveCount(0);
        await expect.configure({ soft: true }).poll(announced).toContain(displaced(t2Pdf));
        await captureEvidence(page, 'E11_11F-A-007_floors.png');
      });

      await test.step('[11F-A-008] after 8 s (fake clock) the toast is gone and the file never comes back', async () => {
        await removeFromCard(page, t2, 'tam-trang.pdf');
        await expect(toastWith(page, removedToast('tam-trang.pdf')).first()).toBeVisible();
        await page.clock.fastForward(8_100); // UT:18 UNDO_WINDOW_MS = 8000, ticket reads Date.now (UT:86-90)
        await expect(toastWith(page, removedToast('tam-trang.pdf'))).toHaveCount(0);
        await expect.soft(cardSummary(page, t2.id, 'tam-trang.pdf')).toHaveCount(0);
        await expect.soft(trayItem(page, 'tam-trang.pdf')).toHaveCount(0);
        await captureEvidence(page, 'E11_11F-A-008_floors.png');
      });

      // ⚑ chờ chủ sản phẩm: catalog-C1 Notes (toast says removed, server copy stays)
      test.info().annotations.push({ type: 'flag', description: 'catalog-C1:235 toast nói đã xoá, máy chủ còn' });
      await test.step('[11F-A-009] removing is local: reload shows the server drawing, no DELETE was sent', async () => {
        await page.reload();
        await openUpload(page, project.projectId, project.floors);
        await expect.soft(card(page, t1.id).getByText(NO_DRAWING, { exact: true })).toHaveCount(0);
        await expect.soft(card(page, t1.id).getByText(ATTACHED, { exact: true })).toBeVisible();
        expect.soft(flow.sent.filter((r) => r.method === 'DELETE').map((r) => r.path), 'no DELETE in the whole flow').toEqual([]);
        await captureEvidence(page, 'E11_11F-A-009_floors.png');
      });

      await test.step('[11F-B-001] removing the only file of a floor lowers the counter and brings back its block reason', async () => {
        await page.route('**/drawings/uploads/*/chunks', () => {
          // never fulfilled: keeps the upload "uploading" so Tầng 2 counts as having a drawing; dropped with the context
        });
        const mark = flow.sent.length;
        await pick(page, { name: 'nen-t2.png', mimeType: 'image/png', buffer: envDrawingPng() });
        // R1/D screenshot: "nen-t2.png" is matched to Tầng 2 by its name ("Ghép tự động từ tên tệp"), so it never waits in the tray
        await expect(cardSummary(page, t2.id, 'nen-t2.png')).toBeVisible();
        await expect.poll(() => flow.sent.slice(mark).filter((r) => r.method === 'POST' && INIT_RE.test(r.path)).length).toBe(1);
        await expect.soft(page.getByTestId(COUNTER)).toHaveText(counterText(2, 2)); // UFU:1189-1191 uploading counts
        await removeFromCard(page, t2, 'nen-t2.png');
        await expect(cardSummary(page, t2.id, 'nen-t2.png')).toHaveCount(0);
        await expect.soft(page.getByTestId(COUNTER)).toHaveText(counterText(1, 2)); // UFU:985-1010 blockReasons
        await page.getByRole('button', { name: SUBMIT, exact: true }).click();
        await expect.soft(page.getByTestId(BLOCK_NOTICE)).toContainText(`${t2.name} chưa có bản vẽ.`);
        await captureEvidence(page, 'E11_11F-B-001_floors.png');
      });

      await test.step('[11F-E-001] trash has the right label, Enter and Space activate it, the toast (role=status) has "Hoàn tác" in the Tab order', async () => {
        await pick(page, note('ghi-chu-e.txt'));
        const trash = trashInTray(page, 'ghi-chu-e.txt');
        await expect(trash).toHaveAttribute('aria-label', 'Xoá bản vẽ ghi-chu-e.txt'); // FUT:97, FUC:151
        await trash.focus();
        await page.keyboard.press('Enter');
        await expect(trayItem(page, 'ghi-chu-e.txt')).toHaveCount(0);
        const toast = toastWith(page, removedToast('ghi-chu-e.txt')).first();
        await expect(toast).toBeVisible();
        const trail: string[] = [];
        let reached = false;
        for (let i = 0; i < 40 && !reached; i += 1) {
          await page.keyboard.press('Tab');
          trail.push(await focusName(page));
          reached = await toast.getByRole('button', { name: UNDO, exact: true }).evaluate((el) => el === document.activeElement);
        }
        expect.soft(reached, `Tab trail: ${trail.join(' → ')}`).toBe(true);
        await toast.getByRole('button', { name: UNDO, exact: true }).click();
        await expect(trayItem(page, 'ghi-chu-e.txt')).toBeVisible();
        await trashInTray(page, 'ghi-chu-e.txt').focus();
        await page.keyboard.press('Space');
        await expect.soft(trayItem(page, 'ghi-chu-e.txt')).toHaveCount(0);
        await attachJson('E11_11F-E-001_floors.json', { trail, reached });
        await captureEvidence(page, 'E11_11F-E-001_floors.png');
      });
    } finally {
      await endMember(member);
      expect(await deleteSeededProject(admin, project.projectId), 'cleanup').toBeNull();
      await admin.dispose();
    }
  });

  test('SCR-10/11/09/21/25 · FL-11F-06 · viewer · vai xem: không điều khiển phá huỷ ở 5 màn', async ({ browser }) => {
    test.setTimeout(420_000);
    const admin = await adminApi();
    const seeded = await createSkewedDrawingProject(admin, '11f-06', await skewedEnvPng(browser, 8)); // measured floor with SKEW_DETECTED
    let member: MemberFlow | undefined;
    try {
      member = await startMember(browser, admin, 'viewer', SLOT, [seeded.projectId]);
      const { flow } = member;
      const { page } = flow;
      const noWrites = (mark: number): string[] => writesSince(flow, mark);

      await test.step('[11F-D-001] viewer: no trash on the upload screen', async () => {
        const mark = flow.sent.length;
        await page.goto(ROUTES.project.upload(seeded.projectId));
        await expect(page.getByText(READ_ONLY_UPLOAD, { exact: true })).toBeVisible(); // canEdit=false → removeLabel null (UFU:1206-1233)
        await expect(page.getByRole('button', { name: /^Xoá bản vẽ /u })).toHaveCount(0);
        await expect(page.getByTestId(DROPZONE)).toHaveCount(0);
        expect(noWrites(mark)).toEqual([]);
        await captureEvidence(page, 'E11_11F-D-001_floors.png');
      });

      await test.step('[11F-D-101] viewer: "Tự động nắn" / "Chọn góc thủ công" are not available, no POST', async () => {
        const mark = flow.sent.length;
        await page.goto(ROUTES.project.quality(seeded.projectId));
        const report = page.getByRole('region', { name: REPORT, exact: true });
        await expect(report).toBeVisible({ timeout: 45_000 });
        await expect(report.getByText('Ảnh bị nghiêng', { exact: true })).toBeVisible(); // findings are listed (milestone)
        await expect.soft(page.getByRole('button', { name: STRAIGHTEN, exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: PICK, exact: true })).toHaveCount(0);
        expect.soft(noWrites(mark)).toEqual([]);
        await captureEvidence(page, 'E11_11F-D-101_floors.png');
      });

      await test.step('[11F-D-201] viewer: no "Xoá tầng", the read-only notice is shown', async () => {
        const mark = flow.sent.length;
        await page.goto(ROUTES.project.floors(seeded.projectId));
        await expect(page.getByRole('heading', { name: FLOORS_FORBIDDEN_TITLE, exact: true })).toBeVisible();
        await expect.soft(page.getByText(FLOORS_FORBIDDEN_NOTICE, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: /^Thao tác khác cho tầng /u })).toHaveCount(0);
        await expect.soft(page.getByRole('menuitem', { name: 'Xoá tầng', exact: true })).toHaveCount(0);
        expect.soft(noWrites(mark)).toEqual([]);
        await captureEvidence(page, 'E11_11F-D-201_floors.png');
      });

      await test.step('[11F-D-301] viewer: the thickness screen has no apply / undo, no PATCH', async () => {
        const mark = flow.sent.length;
        await page.goto(ROUTES.project.thickness(seeded.projectId, seeded.floorId));
        await expect(page.getByRole('heading', { name: THICKNESS_FORBIDDEN_TITLE, exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: 'Áp dụng', exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: UNDO, exact: true })).toHaveCount(0);
        expect.soft(noWrites(mark).filter((w) => w.startsWith('PATCH'))).toEqual([]);
        await captureEvidence(page, 'E11_11F-D-301_floors.png');
      });

      await test.step('[11F-D-401] viewer: no trash on measurements; the pin permission note is shown', async () => {
        const mark = flow.sent.length;
        await page.goto(ROUTES.project.measure(seeded.projectId));
        await expect.soft(page.getByText(PIN_BLOCKED_LIVE, { exact: true })).toBeVisible({ timeout: 30_000 }); // MTL:201, :993
        await expect.soft(page.getByRole('button', { name: /^Xoá /u })).toHaveCount(0);
        expect.soft(noWrites(mark)).toEqual([]);
        await attachJson('E11_11F-D-401_floors.json', { live: PIN_BLOCKED_LIVE, catalog: PIN_BLOCKED_CATALOG });
        await captureEvidence(page, 'E11_11F-D-401_floors.png');
      });
    } finally {
      await endMember(member);
      expect(await deleteSeededProject(admin, seeded.projectId), 'cleanup').toBeNull();
      await admin.dispose();
    }
  });

  test('SCR-09 · FL-11F-09 · engineer · engineer xoá + hoàn tác tầng', async ({ browser }) => {
    test.setTimeout(180_000);
    const admin = await adminApi();
    const project = await createProject(admin, '11f-09', 2);
    const t2 = floorAt(project.floors, 1);
    let member: MemberFlow | undefined;
    try {
      member = await startMember(browser, admin, 'engineer', SLOT, [project.projectId]);
      const { page } = member.flow;

      await test.step('[11F-D-202] engineer (layer.edit) deletes a floor (200) and restores it (201)', async () => {
        await page.goto(ROUTES.project.floors(project.projectId));
        await expect(floorRows(page)).toHaveCount(2);
        const del = await statusOf(page, 'DELETE', new RegExp(`^/api/floors/${esc(t2.id)}$`, 'u'), async () => {
          await kebab(page, t2.name).click(); // FTR:398-401
          await page.getByRole('menu', { name: 'Tuỳ chọn' }).getByRole('menuitem', { name: 'Xoá tầng', exact: true }).click();
        });
        expect(del).toBe(200); // BE floors/router.py:26 FloorAccess layer.edit
        await expect(floorRow(page, t2.name)).toHaveCount(0);
        const toast = toastWith(page, `Đã xoá tầng ${t2.name}.`).first(); // FMG:584
        await expect(toast).toBeVisible();
        const post = await statusOf(page, 'POST', new RegExp(`^/api/projects/${esc(project.projectId)}/floors$`, 'u'), async () => {
          await toast.getByRole('button', { name: UNDO, exact: true }).click();
        });
        expect(post).toBe(201);
        await expect(floorRow(page, t2.name)).toHaveCount(1);
        await captureEvidence(page, 'E11_11F-D-202_floors.png');
      });
    } finally {
      await endMember(member);
      expect(await deleteSeededProject(admin, project.projectId), 'cleanup').toBeNull();
      await admin.dispose();
    }
  });
});
