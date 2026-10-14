/**
 * Phase 11 — floors, [mocked response] write errors and held responses (FL-11F-X1, SCR-10/11/25, <= 0.35 mock rows).
 * One engineer (pool slot `p11-floors-x`), three own projects (upload, quality, measurements); every route is removed right after its step.
 * Real stack underneath: only the answered write is replaced (or held); GETs are the real ones.
 * Source: UFU useFloorUpload.ts:969-971 · UIQ useInputQualityGate.ts:1191-1195 · IQW inputQualityWrite copy :19-27 · IQGW :177-181 ·
 * IQD :30-33 · UMT useMeasurementTool.ts:215-218, 370-376. Evidence `E11_<row id>_floors.png`.
 */
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { deleteSeededProject } from './support/drawingSeed';
import { captureEvidence } from './support/evidence';
import { createQcProject } from './support/layerSeed';
import { INIT_RE } from './support/p03/P5';
import { readQuality, seedQualityProject, skewedEnvPng } from './support/p03/P7';
import { recordWrites, seedMeasurements, toastWith, withEngineer } from './support/p11/P5';
import { addProjectMember, envDrawingPng } from './support/phase03Seed';

const DROPZONE = 'floor-upload-dropzone'; // FUD:30
const FILE_INPUT = 'floor-upload-file-input'; // FUD:33
const ASSIGN = 'Gán cho tầng khác'; // FUT:20, FUC:39
const UPLOADING = 'Đang tải lên'; // UFU:124
const TRAY = 'Tệp chưa gán tầng'; // UFU:104
const REPORT = 'Báo cáo chất lượng'; // IQR:281
const STRAIGHTEN = 'Tự động nắn'; // UIQ COPY.straightenAction
const CONFIRM_STRAIGHTEN = 'Nắn thẳng'; // UIQ COPY.straightenConfirmLabel
const CANCEL = 'Huỷ'; // UIQ COPY.confirmCancel
const WRITE_ERROR = 'Chưa xử lý được bản vẽ'; // InputQualityGate.tsx:64
const SENTENCE = {
  drawingChanged: 'Bản vẽ của tầng vừa đổi, kết quả đo đã được đọc lại; hãy xem rồi thử lại.', // IQW:19
  imageTooLarge: 'Ảnh bản vẽ lớn hơn mức xử lý được; hãy tải bản vẽ nhỏ hơn.', // IQW:23
  pdfUnreadable: 'Không đọc được trang PDF của bản vẽ; hãy tải lại tệp.', // IQW:24
  fileCorrupt: 'Tệp bản vẽ bị hỏng; hãy tải lại tệp.', // IQW:25
  queueFull: 'Hàng xử lý đang đầy; hãy thử lại sau ít phút.', // IQW:26
  uncertain: 'Chưa chắc máy chủ đã nhận thao tác; kết quả đo đang được đọc lại.', // IQW:27
} as const;
const DELETE_FAILED = 'Chưa xoá được phép đo, hãy thử lại'; // UMT:215
const DELETE_FORBIDDEN = 'Bạn không có quyền xoá phép đo trong dự án này'; // UMT:217
const UNDO_FAILED = 'Chưa hoàn tác được việc xoá phép đo'; // UMT:218
const MEASURE_VIEWPORT = 'Khung nhìn mô hình'; // VVP:91

const report = (page: Page): Locator => page.getByRole('region', { name: REPORT, exact: true });
const btn = (scope: Page | Locator, name: string): Locator => scope.getByRole('button', { name, exact: true });
const errorBody = (status: number, code: string): Parameters<Route['fulfill']>[0] => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ code, requestId: 'qa-p11-mock' }),
});
const isWrite = (url: URL): boolean => url.pathname.endsWith('/quality/straighten') || url.pathname.endsWith('/quality/corners');

test.describe('SCR-10/11/25 floors — mocked edge (QA-11 P5)', () => {
  test('SCR-10/11/25 · FL-11F-X1 · engineer · [mocked response] ghi lỗi + giữ phản hồi', async ({ browser }) => {
    test.setTimeout(600_000);
    await withEngineer(browser, 'floors-x', async (ctx) => {
      const upload = await ctx.project('11f-x1u', 1);
      const quality = await seedQualityProject(ctx.admin, '11f-x1q', [{ name: 'Tầng 1', png: await skewedEnvPng(browser, 8) }]);
      let measureId = '';
      try {
        await addProjectMember(ctx.admin, quality.projectId, ctx.engineer.email);
        const qc = await createQcProject({ request: ctx.admin, headers: {} }, '11f-x1m', ['Tầng 1']);
        measureId = qc[0]!.projectId;
        await addProjectMember(ctx.admin, measureId, ctx.engineer.email);
        const names = ['do-x1-a', 'do-x1-b', 'do-x1-c'].map((n) => `${n}-${String(Date.now() % 100000)}`);
        await seedMeasurements(ctx.admin, measureId, names);
        const floorId = quality.floors[0]!.id;
        const { page, log } = await ctx.session();
        const writes = recordWrites(page);
        const qualityGets = (): number => log.filter((e) => e.method === 'GET' && e.path.endsWith('/quality')).length;

        await test.step('[11F-A-010] gỡ tệp đang tải → huỷ lượt tải; "Hoàn tác" tải lại từ đầu', async () => {
          const floor = upload.floors[0]!;
          let inits = 0;
          const never = new Promise<void>(() => undefined);
          await page.route(
            (url) => INIT_RE.test(url.pathname),
            async (route) => {
              if (route.request().method() !== 'POST') return route.fallback();
              inits += 1;
              await never; // held: the file stays "Đang tải lên" (UFU:124)
              return undefined;
            },
          );
          try {
            await page.goto(ROUTES.project.upload(upload.projectId));
            await expect(page.getByTestId(DROPZONE)).toBeVisible();
            await page.getByTestId(FILE_INPUT).setInputFiles({ name: 'tai-do.png', mimeType: 'image/png', buffer: envDrawingPng() });
            const tray = page.getByRole('region', { name: TRAY, exact: true });
            await tray.getByRole('listitem').getByRole('combobox', { name: ASSIGN }).click();
            await page.getByRole('option', { name: floor.name, exact: true }).click();
            const card = page.locator(`[data-floor-id="${floor.id}"]`);
            await expect(card.getByText(UPLOADING, { exact: true })).toBeVisible();
            await expect.poll(() => inits, { message: 'first init held' }).toBe(1);
            await card.getByRole('button', { name: `Tuỳ chọn của tầng ${floor.name}`, exact: true }).click(); // FUC:100-108
            await card.getByRole('button', { name: 'Xoá bản vẽ tai-do.png', exact: true }).click(); // FUC:138-150
            await expect(card.getByText(UPLOADING, { exact: true })).toHaveCount(0);
            await btn(toastWith(page, 'Đã xoá bản vẽ tai-do.png').first(), 'Hoàn tác').click(); // UFU:969-971 startUpload again
            await expect.poll(() => inits, { message: 'undo starts the upload again' }).toBe(2);
            await expect(card.getByText(UPLOADING, { exact: true })).toBeVisible();
            await captureEvidence(page, 'E11_11F-A-010_floors.png');
          } finally {
            await page.unrouteAll({ behavior: 'ignoreErrors' });
          }
        });

        // ---- SCR-11: one route, the answer switches per step (FL-11-09 pattern)
        const keys: string[] = [];
        let hits = 0;
        let answer: (route: Route, attempt: number) => Promise<void> = (route) => route.fallback();
        await page.route(isWrite, async (route) => {
          hits += 1;
          keys.push(route.request().headers()['idempotency-key'] ?? '');
          await answer(route, hits);
        });
        const openQuality = async (): Promise<void> => {
          await page.goto(ROUTES.project.quality(quality.projectId));
          await expect(report(page)).toBeVisible({ timeout: 45_000 });
        };
        const dialog = page.getByRole('dialog', { name: /^Nắn thẳng bản vẽ tầng .+\?$/u });
        const writeBand = page.getByRole('alert').filter({ hasText: WRITE_ERROR });
        const remaining = report(page).locator('.sr-only[role="status"]'); // IQR:307
        const straighten = async (reply: (route: Route, attempt: number) => Promise<void>, dbl = false): Promise<void> => {
          hits = 0;
          keys.length = 0;
          answer = reply;
          await btn(page, STRAIGHTEN).click();
          if (dbl) await btn(dialog, CONFIRM_STRAIGHTEN).dblclick();
          else await btn(dialog, CONFIRM_STRAIGHTEN).click();
        };
        const fulfil = (status: number, code: string) => (route: Route): Promise<void> => route.fulfill(errorBody(status, code));
        try {
          await openQuality();

          await test.step('[11F-A-112] bấm đúp "Nắn thẳng" trong hộp thoại → đúng MỘT POST', async () => {
            let release: () => void = () => undefined;
            const held = new Promise<void>((resolve) => (release = resolve));
            const before = writes().length;
            await straighten(async (route) => {
              await held;
              await route.fulfill(errorBody(409, 'QUALITY_DRAWING_CHANGED')); // 4xx: never retried, so hits counts clicks
            }, true);
            await expect(btn(dialog, CONFIRM_STRAIGHTEN)).toBeDisabled(); // UIQ:1191-1195 disabled={isBusy}
            release();
            await expect(writeBand).toContainText(SENTENCE.drawingChanged); // landmark: the answer has come back
            expect(hits, 'requests that reached the route').toBe(1);
            expect(writes().slice(before).filter((w) => w.endsWith('/quality/straighten')), 'write requests sent').toHaveLength(1);
            await captureEvidence(page, 'E11_11F-A-112_floors.png');
          });

          await test.step('[11F-A-113] thử lại sau mất mạng dùng CÙNG Idempotency-Key', async () => {
            await openQuality();
            await straighten(async (route, attempt) => (attempt === 1 ? route.abort() : route.fulfill(errorBody(422, 'FILE_CORRUPT'))));
            await expect(writeBand).toContainText(SENTENCE.fileCorrupt, { timeout: 30_000 });
            expect(keys.length, 'abort then the http layer retry').toBeGreaterThanOrEqual(2);
            expect(keys[0], 'Idempotency-Key present').not.toBe('');
            expect(keys[1], 'same key on the retry (IQGW:177-181)').toBe(keys[0]);
            await captureEvidence(page, 'E11_11F-A-113_floors.png');
          });

          await test.step('[11F-C-102] bản vẽ vừa đổi → câu + đọc lại kết quả đo', async () => {
            await openQuality();
            const gets = qualityGets();
            await straighten(fulfil(409, 'QUALITY_DRAWING_CHANGED'));
            await expect(writeBand).toContainText(SENTENCE.drawingChanged);
            await expect.poll(qualityGets, { message: 'GET assess again' }).toBeGreaterThan(gets);
            await captureEvidence(page, 'E11_11F-C-102_floors.png');
          });

          await test.step('[11F-C-104] mất mạng/hết giờ khi ghi → câu "Chưa chắc…" + đọc lại', async () => {
            await openQuality();
            const gets = qualityGets();
            await straighten((route) => route.abort());
            await expect(writeBand).toContainText(SENTENCE.uncertain, { timeout: 30_000 });
            await expect.poll(qualityGets, { message: 'reread after the abort' }).toBeGreaterThan(gets);
            await captureEvidence(page, 'E11_11F-C-104_floors.png');
          });

          await test.step('[11F-C-105] các mã còn lại → đúng câu (ảnh quá lớn, PDF không đọc, tệp hỏng, hàng đợi đầy)', async () => {
            const cases: [number, string, string, string][] = [
              [422, 'IMAGE_TOO_LARGE', SENTENCE.imageTooLarge, 'E11_11F-C-105_floors.png'],
              [422, 'PDF_UNREADABLE', SENTENCE.pdfUnreadable, 'E11_11F-C-105_pdf_floors.png'],
              [422, 'FILE_CORRUPT', SENTENCE.fileCorrupt, 'E11_11F-C-105_corrupt_floors.png'],
              [503, 'DEPENDENCY_UNAVAILABLE', SENTENCE.queueFull, 'E11_11F-C-105_queue_floors.png'],
            ];
            for (const [status, code, sentence, shot] of cases) {
              await openQuality();
              await straighten(fulfil(status, code));
              await expect(writeBand).toContainText(sentence, { timeout: 30_000 });
              await captureEvidence(page, shot);
            }
          });

          await test.step('[11F-C-106] lỗi khi ghi → dữ liệu còn nguyên, hộp thoại đóng, nút dùng lại được', async () => {
            await openQuality();
            const before = await remaining.textContent();
            await straighten(fulfil(422, 'FILE_CORRUPT'));
            await expect(writeBand).toContainText(SENTENCE.fileCorrupt);
            await expect(dialog).toBeHidden();
            await expect.soft(remaining, 'findings unchanged after the failed write').toHaveText((before ?? '').trim());
            await expect(btn(page, STRAIGHTEN)).toBeEnabled();
            await captureEvidence(page, 'E11_11F-C-106_floors.png');
          });

          await test.step('[11F-E-103] đang ghi: Huỷ/xác nhận disabled, Esc bị bỏ qua', async () => {
            await openQuality();
            let release: () => void = () => undefined;
            const held = new Promise<void>((resolve) => (release = resolve));
            await straighten(async (route) => {
              await held;
              await route.fulfill(errorBody(409, 'QUALITY_DRAWING_CHANGED'));
            });
            await expect(btn(dialog, CONFIRM_STRAIGHTEN)).toBeDisabled(); // IQD:30-33 isBusy
            await expect(btn(dialog, CANCEL)).toBeDisabled();
            await page.keyboard.press('Escape');
            await expect(dialog).toBeVisible();
            await captureEvidence(page, 'E11_11F-E-103_floors.png');
            release();
            await expect(writeBand).toContainText(SENTENCE.drawingChanged); // landmark before the route goes away
          });
        } finally {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
        expect(await readQuality(ctx.admin, quality.projectId, floorId), 'server data untouched by the mocked writes').toBeTruthy();

        // ---- SCR-25
        const rowName = (i: number): string => names[i] ?? '';
        const openMeasure = async (): Promise<void> => {
          await page.goto(ROUTES.project.measure(measureId));
          await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
          await expect(page.getByRole('main', { name: MEASURE_VIEWPORT, exact: true })).toHaveAttribute('aria-busy', 'false', { timeout: 60_000 });
          await expect(btn(page, `Xoá ${rowName(0)}`)).toBeVisible({ timeout: 60_000 });
        };
        const measurePath = /\/measurements\/[^/]+$/u;

        await test.step('[11F-B-402] 5xx khi xoá → "Chưa xoá được phép đo, hãy thử lại", hàng còn', async () => {
          await openMeasure();
          await page.route((url) => measurePath.test(url.pathname), (route) =>
            route.request().method() === 'DELETE' ? route.fulfill(errorBody(500, 'INTERNAL')) : route.fallback(),
          );
          try {
            await btn(page, `Xoá ${rowName(0)}`).click();
            await expect(toastWith(page, DELETE_FAILED).first()).toBeVisible({ timeout: 30_000 });
            await expect(btn(page, `Xoá ${rowName(0)}`), 'row back after rollback').toBeVisible();
            await captureEvidence(page, 'E11_11F-B-402_floors.png');
          } finally {
            await page.unrouteAll({ behavior: 'ignoreErrors' });
          }
        });

        await test.step('[11F-B-403] 403 khi xoá → "Bạn không có quyền xoá phép đo trong dự án này"', async () => {
          await openMeasure();
          await page.route((url) => measurePath.test(url.pathname), (route) =>
            route.request().method() === 'DELETE' ? route.fulfill(errorBody(403, 'FORBIDDEN')) : route.fallback(),
          );
          try {
            await btn(page, `Xoá ${rowName(1)}`).click();
            await expect(toastWith(page, DELETE_FORBIDDEN).first()).toBeVisible();
            await captureEvidence(page, 'E11_11F-B-403_floors.png');
          } finally {
            await page.unrouteAll({ behavior: 'ignoreErrors' });
          }
        });

        await test.step('[11F-B-404] hoàn tác lỗi → "Chưa hoàn tác được việc xoá phép đo"', async () => {
          await openMeasure();
          await page.route((url) => url.pathname === `/api/projects/${measureId}/measurements`, (route) =>
            route.request().method() === 'POST' ? route.fulfill(errorBody(500, 'INTERNAL')) : route.fallback(),
          );
          try {
            const deleted = page.waitForResponse((r) => r.request().method() === 'DELETE' && measurePath.test(new URL(r.url()).pathname));
            await btn(page, `Xoá ${rowName(2)}`).click(); // real DELETE 204 (own project)
            expect((await deleted).status(), 'real DELETE').toBe(204);
            await btn(page.getByRole('status').filter({ hasText: rowName(2) }).first(), 'Hoàn tác').click(); // UMT:370-376 -> POST 500
            await expect(toastWith(page, UNDO_FAILED).first()).toBeVisible({ timeout: 30_000 });
            await captureEvidence(page, 'E11_11F-B-404_floors.png');
          } finally {
            await page.unrouteAll({ behavior: 'ignoreErrors' });
          }
        });
      } finally {
        expect(await deleteSeededProject(ctx.admin, quality.projectId), 'cleanup').toBeNull();
        if (measureId !== '') expect(await deleteSeededProject(ctx.admin, measureId), 'cleanup').toBeNull();
      }
    });
  });
});
