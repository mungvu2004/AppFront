/**
 * Phase 6 — UI VERIFICATION, SCR-31 Spatial JSON Viewer (skill `qa-verify-ui`): two flows, QA-06b P5 (`flows-C4.md` FL-31-U1 /
 * FL-31-U2). One `verifyUi` per state, four widths (1440 / 1024 / 768 / 375), evidence `U06d_<row id>_<slug>_<width>.png` + one
 * `U06d_<row id>_<slug>.json` of metrics. `verifyUi` fails softly on horizontal overflow, controls outside the viewport and broken
 * images; `expectLayoutClean` (support/p06/data.ts) adds the heuristics the plan lists (clipped text, overlaps, targets < 24 px,
 * 44 px for a text button below 640 px) as soft findings. Open bugs (BUG-447 placeholder cut / toolbar wrap at 375, BUG-449 Cây / Thô
 * 47x28 at 375, BUG-451 page height) keep the matching steps red until fixed.
 *
 * FL-31-U2 is `[mocked response]` (N15 held, dangling opening ids, #24 500) and pairs FL-31-U1 (31-F-001 tree, 31-F-007 empty,
 * 31-F-008 not-found): the integrity strip and a 5xx gate cannot be produced on the real stack.
 *
 * ## Real-backend budget per run
 * - `POST /api/auth/login`: 0 · `POST /api/auth/refresh`: 4 + 1 per page load (≈ 4 states x 4 widths per project, ≈ 120 loads for the file: spread over 3 minutes).
 * - `POST /api/projects` 4, `PUT …/spatial/layer` 3 (qc, big, mock), `DELETE /api/projects/:id` 4. No upload, no pipeline run.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { navigateThenWaitForApi } from '../../e2e/fullstack/apiWatch';
import { verifyUi } from './support/ui-verify';
import {
  ERROR_PAINT_TIMEOUT_MS,
  GATE,
  SJ,
  bareProject,
  createBigLayerProject,
  cutMessage,
  expectLayoutClean,
  matchLabel,
  mockData,
  modeOf,
  nextRow,
  openData,
  projectRe,
  qcProject,
  rootRow,
  rowsOf,
  searchBox,
  tabOf,
  tabsOf,
  toolbarButton,
  treeOf,
  uniq,
  withAdmin,
} from './support/p06/data';
import type { UiMetrics } from './support/ui-verify';

/** `verifyUi` opened every width, and the layout heuristics are clean. */
function expectCleanAll(metrics: readonly UiMetrics[]): void {
  expect(metrics.map((m) => m.openError).filter((e) => e !== undefined), 'widths where the state did not open').toEqual([]);
  expectLayoutClean(metrics);
}

test.describe('E06d SCR-31 Spatial JSON Viewer UI', () => {
  test('SCR-31 · FL-31-U1 · admin states on one project (verifyUi, 4 widths)', async ({ browser }) => {
    test.setTimeout(420_000);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const qc = await qcProject(admin, 'data-ui'); // S-DATA-QC
      const bare = await bareProject(admin, 'data-ui-empty'); // S-DATA-BARE
      const big = await createBigLayerProject(admin, 'data-ui-big'); // S-DATA-BIG

      /** Opens the QC data route to a painted tree, then runs `prepare` (a per-width interaction). */
      const qcState = (prepare: (p: Page) => Promise<void> = async () => undefined) => async (p: Page): Promise<void> => {
        await openData(p, qc.id);
        await prepare(p);
      };

      await test.step('[31-F-001] tree loaded (success) at 4 widths — BUG-447 placeholder cut, BUG-451 page height', async () => {
        const metrics = await verifyUi(page, 'U06d_31-F-001_tree', qcState());
        expectCleanAll(metrics);
        expect(metrics, 'four widths measured').toHaveLength(4);
      });

      await test.step('[31-F-002] search with matches at 4 widths', async () => {
        const metrics = await verifyUi(
          page,
          'U06d_31-F-002_search',
          qcState(async (p) => {
            await searchBox(p).fill('loadbearing');
            await expect(matchLabel(p)).toHaveText(/^1 \/ [1-9][\d.]*$/u);
          }),
        );
        expectCleanAll(metrics);
      });

      await test.step('[31-F-003] search with no match ("Không tìm thấy kết quả") at 4 widths', async () => {
        const metrics = await verifyUi(
          page,
          'U06d_31-F-003_no_match',
          qcState(async (p) => {
            await searchBox(p).fill('qa-khong-co-khoa-nay');
            await expect(matchLabel(p)).toHaveText(SJ.noMatch);
          }),
        );
        expectCleanAll(metrics);
      });

      await test.step('[31-F-004] "Mở rộng tất cả" (long tree) at 4 widths', async () => {
        const metrics = await verifyUi(
          page,
          'U06d_31-F-004_expand_all',
          qcState(async (p) => {
            await toolbarButton(p, SJ.expandAll).click();
            await expect(rowsOf(p).nth(40)).toBeVisible();
          }),
        );
        expectCleanAll(metrics);
      });

      await test.step('[31-F-005] item selected + "Xem trước" (detail from 1024; hidden below) at 4 widths', async () => {
        const metrics = await verifyUi(
          page,
          'U06d_31-F-005_preview',
          qcState(async (p) => {
            const walls = rootRow(p, 'walls');
            await walls.focus();
            await p.keyboard.press('ArrowRight');
            const first = nextRow(walls);
            await first.click();
            await expect(first).toHaveAttribute('aria-selected', 'true');
            if ((await tabsOf(p).count()) > 0) {
              await tabOf(p, 'Xem trước').click();
              await expect(tabOf(p, 'Xem trước')).toHaveAttribute('aria-selected', 'true');
            }
          }),
        );
        expectCleanAll(metrics);
      });

      await test.step('[31-F-006] "Thô" mode (BUG-450: below 1024 the JSON frame replaces the tree) at 4 widths', async () => {
        const metrics = await verifyUi(
          page,
          'U06d_31-F-006_raw',
          qcState(async (p) => {
            await modeOf(p, 'Thô').click();
            await expect(modeOf(p, 'Thô')).toHaveAttribute('aria-checked', 'true');
            await expect(p.locator('pre').first()).toBeVisible();
          }),
        );
        expectCleanAll(metrics);
      });

      await test.step('[31-F-007] empty (project without a layer) at 4 widths', async () => {
        const metrics = await verifyUi(page, 'U06d_31-F-007_empty', (p) => openData(p, bare.id, 'empty'));
        expectCleanAll(metrics);
      });

      await test.step('[31-F-008] not-found gate (unknown project) at 4 widths', async () => {
        const unknownId = `prj_qa-e06d-${uniq()}`;
        const metrics = await verifyUi(page, 'U06d_31-F-008_not_found', async (p) => {
          await navigateThenWaitForApi(p, () => p.goto(ROUTES.project.data(unknownId), { waitUntil: 'commit' }), 'GET', projectRe(unknownId), [404]);
          await expect(p.getByRole('alert').filter({ hasText: GATE.notFoundTitle })).toBeVisible();
        });
        expectCleanAll(metrics);
      });

      await test.step('[31-F-011] raw JSON longer than 600 lines + "Còn N dòng nữa" (big seed) at 4 widths', async () => {
        const metrics = await verifyUi(page, 'U06d_31-F-011_raw_cut', async (p) => {
          await openData(p, big.id);
          await modeOf(p, 'Thô').click();
          await expect(cutMessage(p)).toBeVisible();
        });
        expectCleanAll(metrics);
      });

      await test.step('[31-E-009] Touch targets (BUG-449): toolbar icon buttons and Cây / Thô are >= 24 x 24 px (44 px for a text button at 375)', async () => {
        const metrics = await verifyUi(page, 'U06d_31-E-009_targets', qcState());
        const toolbar = /Kết quả trước|Kết quả sau|Mở rộng tất cả|Thu gọn tất cả|Sao chép nhánh đang chọn|^Cây |^Thô /u;
        for (const m of metrics) {
          expect.soft(m.smallTargets.filter((s) => toolbar.test(s)), `${m.viewport}: toolbar targets below the minimum`).toEqual([]);
        }
      });
    });
  });

  test('SCR-31 · FL-31-U2 · [mocked response] loading, issues, gate error — pairs FL-31-U1', async ({ browser }) => {
    test.setTimeout(300_000);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const qc = await qcProject(admin, 'data-ui-mock'); // S-DATA-MOCK on top of S-DATA-QC
      const mock = await mockData(page);

      await test.step('[31-F-009] loading skeleton [mock: N15 held] at 4 widths', async () => {
        const metrics = await verifyUi(page, 'U06d_31-F-009_loading', async (p) => {
          mock.hold();
          await p.goto(ROUTES.project.data(qc.id), { waitUntil: 'commit' });
          await expect(p.getByRole('region', { name: SJ.structure, exact: true }).locator('.animate-pulse').first()).toBeVisible();
        });
        mock.release();
        expect(metrics.map((m) => m.openError).filter((e) => e !== undefined), 'widths where the skeleton did not paint').toEqual([]);
        expectLayoutClean(metrics);
      });

      await test.step('[31-F-010] issue strip with 3 issues [mock: dangling opening ids] at 4 widths', async () => {
        mock.setN15('dangling', 3);
        const metrics = await verifyUi(page, 'U06d_31-F-010_issue_strip', async (p) => {
          await openData(p, qc.id);
          await expect(p.getByText('3 lỗi nghiêm trọng · 0 cảnh báo.', { exact: true })).toBeVisible();
          await expect(treeOf(p)).toBeVisible();
        });
        expectCleanAll(metrics);
      });

      await test.step('[31-F-012] gate error alert [mock: #24 500] at 4 widths', async () => {
        mock.setN15('pass');
        mock.setProject500(true);
        const metrics = await verifyUi(page, 'U06d_31-F-012_gate_error', async (p) => {
          await p.goto(ROUTES.project.data(qc.id), { waitUntil: 'commit' });
          await expect(p.getByRole('alert').filter({ has: p.getByRole('heading') })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
        });
        expectCleanAll(metrics);
      });
    });
  });
});
