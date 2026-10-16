/**
 * Phase 4 — SCR-18 "Đọc kích thước OCR", dedicated UI verification (skill `qa-verify-ui`): ONE sequential flow
 * (QA-04c P3, `flow-plan.md` FL-18-U1). Each catalog row is one `test.step('[<row id>] …')` that runs `verifyUi`
 * (1440 / 1024 / 768 / 375, `U04_<row id>_<state>_<width>.png` + `.json`), except [18-B-003] (one shot + a check).
 *
 * `[mocked response]`: the rows with a dimension need GET N16 answered with a `dimensions` array (#35 cannot write it,
 * fake-ML OCR reads none — catalog C2); `support/p04/P3.ts` routeDims fetches the REAL N16 of the flow's own Q2 floor and
 * adds the rows (10 mm/px calibrated level). The empty-state rows ([18-F-003], [18-F-004], [18-B-003]) are the real
 * empty second floor, untouched. Pair: A4 pipeline run reads dimensions (BE4-G-030). Real: project + layer (#25, #35),
 * the pool viewer `viewer:p04-p3` and its membership, auth, settings.
 *
 * Source: DV DimensionOcrReview.tsx (lg: split, DV:230-263), DR DimensionOcrRow.tsx (crop square below lg, DR:116-134),
 * DK DimensionOcrKeyboardMode.tsx, DL DimensionOcrList.tsx, DT dimensionOcrText.ts, DCV DimensionOcrCanvas.tsx
 * (src/screens/qc/DimensionOcrReview/).
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: 1 admin API (beforeAll) + 1 admin session + 1 viewer session = 3.
 * - `POST /api/users/invitations`: 0 when `viewer:p04-p3` exists, else 1. `POST /api/projects` 1 + #35 PUT 1 + `DELETE` 1,
 *   `POST …/members` 1. No upload. `POST /api/auth/refresh` ≈ 1 per page load (≈ 46: 11 states × 4 widths + 2).
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { captureEvidence } from './support/evidence';
import { createQcProject, type SeededFloor } from './support/layerSeed';
import { addProjectMember, deleteSeededProject, poolUser } from './support/phase03Seed';
import { closeFlow, openFlow, type Flow } from './support/p03/P5';
import { verifyUi } from './support/ui-verify';
import {
  DIM,
  approveButton,
  canvasFrame,
  compareBar,
  dimCode,
  errorAlert,
  gate,
  keyboardSection,
  note,
  option,
  options,
  outlierText,
  panel,
  radio,
  region,
  routeDims,
  selectRow,
  skeletonRows,
  type DimRow,
  type DimsAnswer,
  type Gate,
} from './support/p04/P3';

const SCALE = 10;
const at = (x: number, y: number, length: number): DimRow['line'] => [x, y, x + length, y];
/** Eight rows, no outlier, every confidence above 0,75 (default filter "Tất cả"); same layout as the mocked edge file. */
const LIST8: readonly DimRow[] = [
  { n: 1, valueMm: 2_030, confidence: 0.95, line: at(500, 800, 2_000) },
  { n: 2, valueMm: 2_600, confidence: 0.9, line: at(500, 1_900, 2_300) },
  { n: 3, valueMm: 2_600, confidence: 0.85, line: at(500, 3_000, 2_600) },
  { n: 4, valueMm: 2_900, confidence: 0.92, line: at(500, 4_100, 2_900) },
  { n: 5, valueMm: 2_100, confidence: 0.88, line: at(4_500, 800, 2_100) },
  { n: 6, valueMm: 2_400, confidence: 0.9, line: at(4_500, 1_900, 2_400) },
  { n: 7, valueMm: 2_700, confidence: 0.97, line: at(4_500, 3_000, 2_700) },
  { n: 8, valueMm: 3_000, confidence: 0.93, line: at(4_500, 4_100, 3_000) },
];
/** M-001 reads 99 999 among 2 000–3 000 → the outlier notice on the first row. */
const OUTLIER8: readonly DimRow[] = [{ ...LIST8[0]!, valueMm: 99_999 }, ...LIST8.slice(1)];
/** Every row reviewed by a person → "Chưa duyệt" lists nothing. */
const REVIEWED8: readonly DimRow[] = LIST8.map((row) => ({ ...row, reviewed: true }));

let adminApi: APIRequestContext;

test.beforeAll(async () => {
  const { email, password } = readAdminCredentials();
  adminApi = await signedInApi(email, password);
});

test.afterAll(async () => {
  await adminApi?.dispose();
});

test.describe('U04 SCR-18 dimension OCR review — UI verification (QA-04c P3)', () => {
  test('SCR-18 · FL-18-U1 · [mocked response] dimension states', async ({ browser }) => {
    test.setTimeout(900_000);
    const floors = await createQcProject({ request: adminApi, headers: {} }, 'fl18-u1', ['Tầng 1', 'Tầng trống'], 1);
    const dimsFloor: SeededFloor | undefined = floors[0];
    const emptyFloor: SeededFloor | undefined = floors[1];
    if (dimsFloor === undefined || emptyFloor === undefined) throw new Error('fixture: Q2 floors missing');
    const viewerUser = await poolUser(adminApi, 'viewer', 'p04-p3');
    await addProjectMember(adminApi, dimsFloor.projectId, viewerUser.email);
    let admin: Flow | undefined;
    let viewer: Flow | undefined;
    const held: Gate[] = [];
    try {
      admin = await openFlow(browser, readAdminCredentials());
      const page = admin.page;
      const dims = await routeDims(page, { [dimsFloor.floorId]: { rows: LIST8, scale: SCALE } });
      const answer: DimsAnswer = dims.floors[dimsFloor.floorId]!;
      const dimsPath = ROUTES.project.dimensions(dimsFloor.projectId, dimsFloor.floorId);
      const emptyPath = ROUTES.project.dimensions(emptyFloor.projectId, emptyFloor.floorId);
      const openList = async (p: Page): Promise<void> => {
        await p.goto(dimsPath);
        await expect(region(p)).toBeVisible();
        await expect(options(p).first()).toBeVisible();
      };
      const openEmpty = async (p: Page): Promise<void> => {
        await p.goto(emptyPath);
        await expect(panel(p).getByText(DIM.emptyTitle, { exact: true })).toBeVisible();
      };

      await test.step('[18-F-001] list at 4 widths', async () => {
        const metrics = await verifyUi(page, 'U04_18-F-001_list', openList);
        expect(metrics.length, 'four widths measured').toBe(4);
      });

      await test.step('[18-F-002] row selected + compare bar', async () => {
        await verifyUi(page, 'U04_18-F-002_selected', async (p) => {
          await openList(p);
          await selectRow(p, 1);
          await expect(compareBar(p)).toBeVisible();
        });
      });

      await test.step('[18-F-005] keyboard mode with a row (full screen, magnified crop)', async () => {
        await verifyUi(page, 'U04_18-F-005_keyboard_row', async (p) => {
          await openList(p);
          await selectRow(p, 1);
          await p.getByRole('button', { name: DIM.keyboardOn, exact: true }).click();
          await expect(keyboardSection(p).getByText(dimCode(1), { exact: true })).toBeVisible();
        });
      });

      await test.step('[18-F-008] outlier notice in a row', async () => {
        answer.rows = OUTLIER8;
        await verifyUi(page, 'U04_18-F-008_outlier', async (p) => {
          await openList(p);
          await expect(option(p, 1).getByRole('status')).toHaveText(outlierText(99_999));
        });
      });

      await test.step('[18-F-009] filter with zero rows', async () => {
        answer.rows = REVIEWED8;
        await verifyUi(page, 'U04_18-F-009_zero_rows', async (p) => {
          await openList(p);
          await radio(p, DIM.unreviewed).click();
          await expect(options(p)).toHaveCount(0);
        });
      });

      await test.step('[18-F-007] viewer footer notice', async () => {
        viewer = await openFlow(browser, viewerUser);
        await routeDims(viewer.page, { [dimsFloor.floorId]: { rows: LIST8, scale: SCALE } });
        await verifyUi(viewer.page, 'U04_18-F-007_viewer', async (p) => {
          await openList(p);
          await expect(panel(p).getByText(DIM.forbiddenDescription, { exact: true })).toBeVisible();
          await expect(approveButton(p, 1)).toHaveCount(0);
        });
      });

      await test.step('[18-F-006] read error alert', async () => {
        answer.fail = 500;
        await verifyUi(page, 'U04_18-F-006_error', async (p) => {
          await p.goto(dimsPath);
          await expect(errorAlert(p)).toBeVisible();
        });
        answer.fail = undefined;
      });

      await test.step('[18-F-010] loading skeleton (N16 held until the shot)', async () => {
        answer.rows = LIST8;
        await verifyUi(page, 'U04_18-F-010_loading', async (p) => {
          const hold = gate();
          held.push(hold);
          answer.hold = hold.promise;
          await p.goto(dimsPath);
          await expect(skeletonRows(p)).toHaveCount(4);
        });
        answer.hold = undefined;
        for (const hold of held) hold.release();
      });

      await test.step('[18-F-011] < 1024: canvas stacked over the panel, no horizontal scroll; crop square on compact', async () => {
        const stacking: string[] = [];
        await verifyUi(page, 'U04_18-F-011_stacked', async (p) => {
          await openList(p);
          const width = p.viewportSize()?.width ?? 0;
          const canvasBox = await p.locator(`section[aria-label="${DIM.canvas}"]`).boundingBox();
          const panelBox = await panel(p).boundingBox();
          const crop = await option(p, 1).getByRole('img').boundingBox();
          if (canvasBox === null || panelBox === null || crop === null) throw new Error('layout boxes missing');
          const stacked = canvasBox.y + canvasBox.height <= panelBox.y + 1;
          const square = Math.abs(crop.width - crop.height) <= 1;
          stacking.push(`${String(width)}: stacked=${String(stacked)} crop=${String(Math.round(crop.width))}×${String(Math.round(crop.height))}`);
          if (width < 1024) {
            expect.soft(stacked, `${String(width)} px: canvas above the panel (DV:230 flex-col)`).toBe(true);
            expect.soft(square, `${String(width)} px: crop is square (DR:122)`).toBe(true);
          } else {
            expect.soft(stacked, `${String(width)} px: side by side (lg:flex-row)`).toBe(false);
          }
        });
        note(`18-F-011 layout: ${stacking.join(' · ')}`);
      });

      await test.step('[18-F-003] empty state', async () => {
        await verifyUi(page, 'U04_18-F-003_empty', openEmpty);
      });

      await test.step('[18-F-004] keyboard mode, no row', async () => {
        await verifyUi(page, 'U04_18-F-004_keyboard_no_row', async (p) => {
          await openEmpty(p);
          await p.getByRole('button', { name: DIM.keyboardOn, exact: true }).click();
          await expect(panel(p).getByRole('region', { name: DIM.keyboardCaption, exact: true })).toBeVisible();
        });
      });

      await test.step('[18-B-003] ⚑ empty: the canvas frame explains why it is blank (BUG-335)', async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openEmpty(page);
        const text = await canvasFrame(page).evaluate((frame) => {
          const clone = frame.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('button, .sr-only').forEach((el) => el.remove());
          return (clone.textContent ?? '').trim();
        });
        // ⚑ BUG-335 still open: DCV:187-230 draws an empty frame (no chain, no image, no sentence).
        expect.soft(text, '⚑ visible explanation inside the empty canvas frame').not.toBe('');
        await captureEvidence(page, 'U04_18-B-003_blank_canvas.png', { caption: `canvas frame text: "${text}"` });
      });
    } finally {
      for (const hold of held) hold.release();
      if (viewer !== undefined) await closeFlow(viewer);
      if (admin !== undefined) await closeFlow(admin);
      const problem = await deleteSeededProject(adminApi, dimsFloor.projectId);
      if (problem !== null) note(`cleanup: ${problem}`);
    }
  });
});
