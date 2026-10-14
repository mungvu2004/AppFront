/**
 * Phase 4 - SCR-18 "Doc kich thuoc OCR", Playwright on Vite (mock API): BUG-610 (QA-04c AES-06).
 * Catalog expectation (BUG-LOG-P04.md BUG-610 "Mong doi"): the review action is a real Button (not 13 px accent text)
 * and the row status is a Badge with words, not an unlabeled dot.
 * Lives in e2e/ (root playwright.config.ts) because run-full runs qa/tests on the real stack, which has no Vite.
 * Run: VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port $E2E_PORT, then
 *   E2E_PORT=<port> pnpm exec playwright test -c playwright.config.ts e2e/qa04/dimensions.vite.spec.ts
 * Request budget: 0 uploads, 0 logins (mock API, no session).
 */
import { expect, test } from '@playwright/test';

import { MOCK_BASE_URL } from '../../qa/tests/support/auth';
import { captureEvidence } from '../../qa/tests/support/evidence';
import { DIM } from '../../qa/tests/support/p04/P3';
import { DIMENSION_OCR_TEXT } from '../../src/screens/qc/DimensionOcrReview/dimensionOcrText';
import { ROUTES } from '../fixtures/routes';
import { QC_PROJECT } from '../v6/seedQc';

/** Floor 2 of the A14 sample: 9 dimensions on the real mock load path (e2e/v6/dimension-ocr-review.spec.ts:18). */
const A14_FLOOR = 'L-LEVEL000001';

test.use({ baseURL: MOCK_BASE_URL, viewport: { width: 1440, height: 900 } });

/** A Button (size sm) is at least 32 px tall; the old bare `<button>` text-[13px] py-0.5 was ~22 px. */
const MIN_BUTTON_HEIGHT_PX = 32;

test('SCR-18 · FL-18-V1 [mocked response] BUG-610 duyet la Button that, trang thai co chu', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.dismiss());
  await page.goto(ROUTES.project.dimensions(QC_PROJECT, A14_FLOOR));
  const first = page.getByRole('group', { name: DIM.list, exact: true }).getByRole('option').first();
  await expect(first).toBeVisible({ timeout: 15_000 });

  await test.step('[BUG-610] status is a Badge with words in the row', async () => {
    await expect.soft(first.getByText(DIMENSION_OCR_TEXT.row.statusUnreviewedLabel, { exact: true })).toBeVisible();
  });

  await test.step('[BUG-610] approve action is a Button, not bare 13 px text', async () => {
    const approve = first.getByRole('button', { name: new RegExp(DIMENSION_OCR_TEXT.row.approveButtonAriaLabelPrefix) });
    await expect(approve).toBeVisible();
    const box = await approve.boundingBox();
    expect.soft(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_BUTTON_HEIGHT_PX);
    // A Button paints a background; bare text does not. Compared against a probe so no colour literal ships (noRawColor).
    const transparentBackground = await approve.evaluate((el) => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'transparent';
      document.body.append(probe);
      const none = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return getComputedStyle(el).backgroundColor === none;
    });
    expect.soft(transparentBackground).toBe(false);
    await captureEvidence(page, 'U04_dims_row_button_1440.png');
  });
});
