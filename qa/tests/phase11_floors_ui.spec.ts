/**
 * Phase 11 — floors (SCR-09/10/11/21/25) dedicated UI-verification flows, 1920/1440/1024/768 (`DESKTOP_VIEWPORTS`).
 * One `test()` per flow (FL-11F-U1..U4); one `test.step('[<row id>] …')` per catalog row. Evidence `U11_<row id>_floors_<w>.png`.
 * Data: own projects (admin API), deleted in `finally`; the engineer is pool slot `p11-floors-ui` (U1, U2, U4), U3 uses an own admin session.
 * Source: UFU useFloorUpload.ts (toast copy 921/977) · FUC FloorUploadCard · FUT FloorUploadTray · UIQ useInputQualityGate.ts ·
 * TAB ThicknessApplyBar.tsx · UMT useMeasurementTool.ts · MTL measurement list. Real stack, no mocks.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { deleteSeededProject } from './support/drawingSeed';
import { attachJson } from './support/evidence';
import { createQcProject } from './support/layerSeed';
import { floorRow } from './support/p03/P4';
import { withAdminProject } from './support/p03/P10';
import { readQuality, seedQualityProject, skewedEnvPng } from './support/p03/P7';
import { DESKTOP_VIEWPORTS } from './support/p11/common';
import { intersects, overflowX, seedMeasurements, seedThicknessLayer, toastWith, withEngineer } from './support/p11/P5';
import { addProjectMember, envDrawingPng, framelessPng } from './support/phase03Seed';
import { verifyUi } from './support/ui-verify';

const FILE_INPUT = 'floor-upload-file-input'; // FUD:33
const DROPZONE = 'floor-upload-dropzone'; // FUD:30
const SELECT_FILE = 'Chọn tệp'; // UFU:101
const SUBMIT = 'Bắt đầu xử lý'; // UFU:113
const ASSIGN = 'Gán cho tầng khác'; // FUT:20, FUC:39
const ATTACHED = 'Đã gắn kèm'; // UFU:125
const TRAY = 'Tệp chưa gán tầng'; // UFU:104
const removedToast = (name: string): string => `Đã xoá bản vẽ ${name}`; // UFU:921
const REPORT = 'Báo cáo chất lượng'; // IQR:281
const STRAIGHTEN = 'Tự động nắn'; // UIQ COPY.straightenAction
const STRAIGHTEN_DIALOG = /^Nắn thẳng bản vẽ tầng .+\?$/u; // UIQ
const CORNERS_DIALOG = /^Cắt và nắn bản vẽ tầng .+ theo bốn góc\?$/u; // UIQ
const THICK_SCREEN = 'Chuẩn hoá độ dày tường'; // TV:105
const THICK_SELECT_ALL = /^Chọn (cả \d+ nhóm|nhóm này) \(\d+ đoạn\)$/u; // bản Z TBP:TEXT.selectAll
const THICK_ACCEPT = /^Đồng ý đổi các đoạn .+ về \d+ mm$/u; // bản Z TBP:TEXT.acceptGroup
const DELETE_FLOOR_MENU = 'Xoá tầng'; // FT:180

const report = (page: Page): Locator => page.getByRole('region', { name: REPORT, exact: true });
const btn = (scope: Page | Locator, name: string): Locator => scope.getByRole('button', { name, exact: true });
const card = (page: Page, floorId: string): Locator => page.locator(`[data-floor-id="${floorId}"]`);
const tray = (page: Page): Locator => page.getByRole('region', { name: TRAY, exact: true });
const trayItem = (page: Page, name: string): Locator =>
  tray(page).getByRole('listitem').filter({ has: page.getByText(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')} · `, 'u')) });
const note = (name: string): { name: string; mimeType: string; buffer: Buffer } => ({ name, mimeType: 'text/plain', buffer: Buffer.from(`${name}\n`) });

async function openQuality(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.project.quality(projectId));
  await expect(report(page)).toBeVisible({ timeout: 45_000 });
}

test.describe('SCR-09/10/11/21/25 floors — UI verify (QA-11 P5)', () => {
  test('SCR-10 · FL-11F-U1 · engineer · UI thẻ/khay + toast', async ({ browser }) => {
    test.setTimeout(420_000);
    await withEngineer(browser, 'floors-ui', async (ctx) => {
      const project = await ctx.project('11f-u1', 4);
      const { page } = await ctx.session();
      let used = 0;

      await test.step('[11F-F-001] thẻ tầng + toast hoàn tác ở 4 khổ: không tràn ngang, toast không che nút chính', async () => {
        const overlaps: (number | undefined)[] = [];
        await verifyUi(
          page,
          'U11_11F-F-001_floors',
          async (p) => {
            const floor = project.floors[used];
            if (floor === undefined) throw new Error('seed: fewer floors than viewports');
            used += 1;
            await p.goto(ROUTES.project.upload(project.projectId));
            await expect(p.getByTestId(DROPZONE)).toBeVisible();
            const file = `mat-bang-${String(used)}.png`;
            await p.getByTestId(FILE_INPUT).setInputFiles({ name: file, mimeType: 'image/png', buffer: envDrawingPng() });
            await trayItem(p, file).getByRole('combobox', { name: ASSIGN }).click(); // FUT:57-74
            await p.getByRole('option', { name: floor.name, exact: true }).click();
            await expect(card(p, floor.id).getByText(ATTACHED, { exact: true })).toBeVisible({ timeout: 60_000 });
            await card(p, floor.id).getByRole('button', { name: `Tuỳ chọn của tầng ${floor.name}`, exact: true }).click(); // FUC:100-108
            await card(p, floor.id).getByRole('button', { name: `Xoá bản vẽ ${file}`, exact: true }).click(); // FUC:138-150
            const toast = toastWith(p, removedToast(file)).first();
            await expect(toast).toBeVisible();
            await expect(btn(toast, 'Hoàn tác')).toBeVisible();
            const toastBox = await toast.boundingBox();
            const submitBox = await btn(p, SUBMIT).boundingBox();
            if (intersects(toastBox, submitBox)) overlaps.push(p.viewportSize()?.width);
          },
          DESKTOP_VIEWPORTS,
        );
        expect.soft(overlaps, 'widths where the toast covers "Bắt đầu xử lý"').toEqual([]);
      });

      await test.step('[11F-F-002] khay tệp có thùng rác + toast ở 4 khổ: không tràn, toast không che nút chính', async () => {
        const overlaps: (number | undefined)[] = [];
        await verifyUi(
          page,
          'U11_11F-F-002_floors',
          async (p) => {
            await p.goto(ROUTES.project.upload(project.projectId));
            await expect(p.getByTestId(DROPZONE)).toBeVisible();
            await p.getByTestId(FILE_INPUT).setInputFiles([note('ghi-chu-1.txt'), note('ghi-chu-2.txt')]);
            await expect(trayItem(p, 'ghi-chu-1.txt')).toBeVisible();
            await trayItem(p, 'ghi-chu-1.txt').getByRole('button', { name: 'Xoá bản vẽ ghi-chu-1.txt', exact: true }).first().click(); // FUT:76-83
            const toast = toastWith(p, removedToast('ghi-chu-1.txt')).first();
            await expect(toast).toBeVisible();
            const [toastBox, pick] = [await toast.boundingBox(), await btn(p.getByTestId(DROPZONE), SELECT_FILE).boundingBox()];
            if (intersects(toastBox, pick)) overlaps.push(p.viewportSize()?.width);
          },
          DESKTOP_VIEWPORTS,
        );
        expect.soft(overlaps, 'widths where the toast covers "Chọn tệp"').toEqual([]);
      });
    });
  });

  test('SCR-11 · FL-11F-U2 · engineer · UI hộp thoại nắn/cắt', async ({ browser }) => {
    test.setTimeout(900_000);
    await withEngineer(browser, 'floors-ui', async (ctx) => {
      const quality = await seedQualityProject(ctx.admin, '11f-u2', [
        { name: 'Tầng 1', png: await skewedEnvPng(browser, 8) },
        { name: 'Tầng 2', png: await framelessPng(browser) },
      ]);
      try {
        await addProjectMember(ctx.admin, quality.projectId, ctx.engineer.email);
        await readQuality(ctx.admin, quality.projectId, quality.floors[0]!.id); // #30 readable before the member opens the screen
        const { page } = await ctx.session();

        await test.step('[11F-F-101] hộp thoại nắn ở 4 khổ: không tràn, nút trong khung', async () => {
          await verifyUi(
            page,
            'U11_11F-F-101_floors',
            async (p) => {
              await openQuality(p, quality.projectId);
              await btn(p, STRAIGHTEN).click();
              const dialog = p.getByRole('dialog', { name: STRAIGHTEN_DIALOG });
              await expect(dialog).toBeVisible();
              await expect(btn(dialog, 'Nắn thẳng')).toBeVisible();
              await expect(btn(dialog, 'Huỷ')).toBeVisible();
            },
            DESKTOP_VIEWPORTS,
            { fullPage: false },
          );
        });

        await test.step('[11F-F-102] hộp thoại cắt + chế độ chọn góc ở 4 khổ: không tràn, nút trong khung', async () => {
          await verifyUi(
            page,
            'U11_11F-F-102_floors',
            async (p) => {
              await openQuality(p, quality.projectId);
              await report(p).getByRole('row').filter({ has: p.getByRole('cell', { name: 'Tầng 2', exact: true }) }).click();
              const pick = p.locator('[data-quality-action="corners"]');
              await pick.click(); // UIQ: "Chọn góc thủ công" -> corner mode
              await expect(pick).toHaveAccessibleName('Gửi bốn góc đã chọn');
              await pick.click();
              const dialog = p.getByRole('dialog', { name: CORNERS_DIALOG });
              await expect(dialog).toBeVisible();
              await expect(btn(dialog, 'Cắt và nắn')).toBeVisible();
            },
            DESKTOP_VIEWPORTS,
            { fullPage: false },
          );
        });
      } finally {
        expect(await deleteSeededProject(ctx.admin, quality.projectId), 'cleanup').toBeNull();
      }
    });
  });

  test('SCR-09 · FL-11F-U3 · admin · UI bảng tầng + toast xoá', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdminProject(browser, '11f-u3', 5, async ({ flow, project }) => {
      const { page } = flow;
      let used = 0;
      const gone = new Set<string>();
      await test.step('[11F-F-201] bảng tầng + toast xoá ở 4 khổ: không tràn, toast không che hàng', async () => {
        const covered: string[] = [];
        await verifyUi(
          page,
          'U11_11F-F-201_floors',
          async (p) => {
            const doomed = project.floors[used + 1];
            if (doomed === undefined) throw new Error('seed: fewer floors than viewports');
            used += 1;
            await p.goto(ROUTES.project.floors(project.projectId));
            await expect(floorRow(p, doomed.name)).toBeVisible();
            await p.getByRole('button', { name: `Thao tác khác cho tầng ${doomed.name}`, exact: true }).click(); // FTR:396
            await p.getByRole('menu', { name: 'Tuỳ chọn' }).getByRole('menuitem', { name: DELETE_FLOOR_MENU, exact: true }).click(); // FT:180
            const toast = toastWith(p, `Đã xoá tầng ${doomed.name}.`).first(); // FGW:586
            await expect(toast).toBeVisible();
            const toastBox = await toast.boundingBox();
            gone.add(doomed.id);
            for (const other of project.floors.filter((f) => !gone.has(f.id))) { // floors deleted at earlier widths no longer have a row (boundingBox would wait 30 s)
              if (intersects(toastBox, await floorRow(p, other.name).boundingBox())) covered.push(`${String(p.viewportSize()?.width)}:${other.name}`);
            }
            expect(await overflowX(p)).toBe(0);
          },
          DESKTOP_VIEWPORTS,
        );
        expect.soft(covered, 'rows covered by the delete toast').toEqual([]);
      });
    });
  });

  test('SCR-21/25 · FL-11F-U4 · engineer · UI lô độ dày, tường đã duyệt ngoài lô, danh sách đo', async ({ browser }) => {
    test.setTimeout(300_000);
    await withEngineer(browser, 'floors-ui', async (ctx) => {
      const thick = await ctx.project('11f-u4t', 1);
      const floorId = thick.floors[0]!.id;
      await seedThicknessLayer(ctx.admin, thick.projectId, floorId);
      const { page } = await ctx.session();
      const openThickness = async (p: Page): Promise<Locator> => {
        await p.goto(ROUTES.project.thickness(thick.projectId, floorId));
        await expect(p.getByRole('heading', { name: THICK_SCREEN })).toBeVisible();
        return p.getByRole('region', { name: THICK_SCREEN, exact: true });
      };

      await test.step('[11F-F-301] lô đổi + danh sách "đoạn không đổi" (xem tay) ở 4 khổ: không tràn', async () => {
        await verifyUi(
          page,
          'U11_11F-F-301_floors',
          async (p) => {
            const region = await openThickness(p);
            await expect(p.getByRole('checkbox', { name: THICK_ACCEPT }).first()).toBeVisible();
            await region.getByRole('button', { name: THICK_SELECT_ALL }).click(); // every group ticked: the panel is the preview
            await expect(region.getByText(/nhóm chuẩn\./u)).toBeVisible();
            // the 500 mm wall is above 450 mm (a column): left for a manual review, listed with its reason (TB:toManualRows)
            await expect(region.getByText(/^Không đổi, giữ ở lớp Tường để xem tay \(\d+\)$/u)).toBeVisible();
            await attachJson('U11_11F-F-301_state.json', { width: p.viewportSize()?.width, url: p.url(), regionTail: (await region.innerText()).slice(-700) });
            await expect(region.getByText('500 mm', { exact: true }), 'row of the 500 mm wall in the list').toBeVisible();
            await expect(region.getByText('Dày bất thường, có thể là cột BTCT', { exact: true })).toBeVisible(); // TB:THICKNESS_BATCH_TEXT.column
          },
          DESKTOP_VIEWPORTS,
        );
      });

      await test.step('[11F-F-302] tường đã duyệt đứng ngoài lô (thay cảnh báo áp lại) ở 4 khổ: không tràn', async () => {
        await verifyUi(
          page,
          'U11_11F-F-302_floors',
          async (p) => {
            const region = await openThickness(p);
            await region.getByRole('button', { name: THICK_SELECT_ALL }).click();
            await expect(region.getByText(/1 tường đã duyệt không nằm trong lô\.$/u)).toBeVisible(); // TB:batchSentenceOf
          },
          DESKTOP_VIEWPORTS,
        );
      });

      await test.step('[11F-F-401] danh sách phép đo + toast hoàn tác ở 4 khổ: không tràn', async () => {
        const qc = await createQcProject({ request: ctx.admin, headers: {} }, '11f-u4m', ['Tầng 1']);
        const projectId = qc[0]!.projectId;
        try {
          await addProjectMember(ctx.admin, projectId, ctx.engineer.email);
          const names = DESKTOP_VIEWPORTS.map((v) => `do-11f-${String(v.width)}-${String(Date.now() % 100000)}`);
          await seedMeasurements(ctx.admin, projectId, names);
          let used = 0;
          await verifyUi(
            page,
            'U11_11F-F-401_floors',
            async (p) => {
              const name = names[used];
              if (name === undefined) throw new Error('seed: fewer measurements than viewports');
              used += 1;
              await p.goto(ROUTES.project.measure(projectId));
              await dismissTour(p, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
              await expect(btn(p, `Xoá ${name}`)).toBeVisible({ timeout: 60_000 }); // MTL:152-160
              await btn(p, `Xoá ${name}`).click();
              await expect(btn(p.getByRole('status').filter({ hasText: name }).first(), 'Hoàn tác')).toBeVisible(); // MUT:176
            },
            DESKTOP_VIEWPORTS,
          );
        } finally {
          expect(await deleteSeededProject(ctx.admin, projectId), 'cleanup').toBeNull();
        }
      });
    });
  });
});
