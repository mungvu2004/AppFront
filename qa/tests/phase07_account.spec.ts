/**
 * Phase 7 main chain: SCR-33 Account Settings (`/tai-khoan`), flow FL-M-33P-01 (QA-07b P1, rewritten short).
 *
 * Track A: compose build at `E2E_FULLSTACK_BASE_URL`, shared admin from CP-1 (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`).
 * Only the "Chức danh" of the admin is touched and put back inside the same test. Matrix evidence names are kept:
 * `33_account_autosave.png` (plan line 216), `33_account_hidden_sections.png` (plan line 220).
 *
 * Request budget (429 limits): 1 admin UI login (`POST /api/auth/login`), 2 `PATCH /api/me` (+1 in `finally` only when the
 * revert did not happen), 0 password, 0 avatar.
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { ME_RE, TITLE, box, heading, IND, meApi, recordWrites, saveIndicator } from './support/p07/account';
import { SUBTITLE, countMeReads } from './support/p07/P1';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';

test.describe.configure({ mode: 'serial' });

const JOB_TITLE_SUFFIX = '-e2e';

test('SCR-33 · FL-M-33P-01 · open /tai-khoan, "Chức danh" autosave + revert, hidden blocks', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let original = '';
  let serverHolds = false; // true while the server may hold the edited title (guards the `finally` revert)
  let writes: ReturnType<typeof recordWrites> | undefined;
  try {
    await signInAdmin(page);
    writes = recordWrites(page);

    await test.step('[33P-A-001] open /tai-khoan', async () => {
      const reads = countMeReads(page);
      const me = waitForApi(page, 'GET', ME_RE, [200]);
      await page.goto(ROUTES.account);
      const body = (await me).json as Record<string, unknown>;
      original = typeof body.jobTitle === 'string' ? body.jobTitle : '';
      await expect(heading(page)).toHaveText(TITLE);
      await expect(page.getByText(SUBTITLE, { exact: true })).toBeVisible();
      await expect(box(page, 'Chức danh')).toHaveValue(original);
      reads.stop();
      expect(reads.statuses(), 'GET /api/me on open').toEqual([200]);
    });

    const jobTitle = box(page, 'Chức danh');
    const edited = `${original}${JOB_TITLE_SUFFIX}`;

    await test.step('[33P-A-011] "Chức danh" + -e2e autosaves', async () => {
      const patch = waitForApi(page, 'PATCH', ME_RE, [200]);
      serverHolds = true;
      await jobTitle.fill(edited);
      await patch;
      await expect(saveIndicator(page)).toHaveText(IND.saved);
      expect(writes?.list() ?? [], 'one PATCH so far').toEqual(['PATCH /api/me']);
      await captureEvidence(page, '33_account_autosave.png');
    });

    await test.step('[33P-G-003] body of that PATCH', async () => {
      expect.soft(writes?.bodies('/api/me')[0], 'PATCH /api/me body').toEqual({ jobTitle: edited });
    });

    await test.step('[33P-A-012] revert the field', async () => {
      const revert = waitForApi(page, 'PATCH', ME_RE, [200]);
      await jobTitle.fill(original);
      await revert;
      serverHolds = false;
      expect.soft(writes?.bodies('/api/me')[1], 'revert body').toEqual({ jobTitle: original });
      expect.soft(writes?.list() ?? [], 'two PATCH in total').toEqual(['PATCH /api/me', 'PATCH /api/me']);
      await expect.soft(jobTitle).toHaveValue(original);
    });

    await test.step('[33P-B-005] "Phiên đăng nhập" is not rendered', async () => {
      await expect.soft(page.getByRole('heading', { name: 'Phiên đăng nhập', exact: true })).toHaveCount(0);
      await expect.soft(page.locator('#account-sessions')).toHaveCount(0);
    });

    await test.step('[33P-B-006] "Vùng nguy hiểm" is not rendered', async () => {
      await expect.soft(page.getByRole('heading', { name: 'Vùng nguy hiểm', exact: true })).toHaveCount(0);
      await expect.soft(page.getByText('Xoá tài khoản', { exact: true })).toHaveCount(0);
      await expect.soft(page.locator('#account-danger')).toHaveCount(0);
      await captureEvidence(page, '33_account_hidden_sections.png', { fullPage: true });
    });
  } finally {
    writes?.stop();
    if (serverHolds) {
      try {
        const res = await (await meApi(context)).patch({ jobTitle: original });
        if (res.status() !== 200) throw new Error(`PATCH /api/me -> ${String(res.status())}`);
      } catch (error) {
        test.info().annotations.push({ type: 'revert-failed', description: String(error) });
      }
    }
    await context.close();
  }
});
