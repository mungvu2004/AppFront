/**
 * Phase 6 — EDGE layer, ShareDialog (SCR-30S, slug `share`): one flow, QA-06b P5 (`flows-C4.md` "phase06_share_edge.spec.ts").
 * ShareDialog is dead code on every route in v1: `SHARE_LINKS_SUPPORTED = false` (src/lib/export/shareLink.ts:354) keeps
 * `ShareDialogContainer` unmounted (ExportPanel.container.tsx:160) and the "Chia sẻ" button out of the DOM
 * (useExportPanel.ts:719). VersionHistory never mounts it (the brief's "opened from VersionHistory" is false). So this file
 * pins the flag-off contract: when the flag flips in v2 these steps go red on purpose and the 29 `n/a` rows must be activated.
 * No `_mocked_edge` / `_ui` / `_api` for 30S (nothing is reachable beyond absence).
 *
 * Short names: EPV src/screens/export/ExportPanel/ExportPanel.tsx · UEP …/useExportPanel.ts · EPC …/ExportPanel.container.tsx ·
 * SLK src/lib/export/shareLink.ts · SDH src/screens/export/ShareDialog/useShareDialog.ts · VH src/screens/export/VersionHistory/.
 *
 * ## Request budget per run (BE defaults; QA stack override `qa-limits.override.yml`)
 * - `POST /api/auth/login` (120 / 60 s per IP): 1 (the viewer member's session); the admin reuses the stored session (0).
 * - `POST /api/auth/refresh` (300 / 60 s): 2 for the fixtures + 1 per page load ≈ 5.
 * - `POST /api/projects` 1, `PUT …/spatial/layer` 1 (createQcProject), `DELETE /api/projects/:id` 1.
 * - `POST /api/users/invitations`: 0 when the `p06-share` viewer slot already exists (else 1 + 1 accept); `POST …/members` 1, `DELETE …/members/:id` 1.
 * - `drawings_init`, pipeline runs: 0.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { navigateThenWaitForApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry } from '../../e2e/fullstack/apiWatch';
import { captureEvidence } from './support/evidence';
import { addProjectMember, poolUser, removeProjectMember } from './support/phase03Seed';
import { adminRequest, openPoolFlow, qcProject, spatialRe, withAdmin } from './support/p06/data';

/* ShareDialog / Export copy (each cites its source). */
const SHARE = {
  button: 'Chia sẻ', // EPV:251 (only when SHARE_LINKS_SUPPORTED)
  dialog: 'Chia sẻ bản vẽ', // SD:47
  revoke: 'Thu hồi liên kết này?', // SD:100
  exportButton: 'Xuất', // EPT:69
  formats: 'Định dạng xuất', // EPF:144
  versionsList: 'Danh sách phiên bản', // VHL:137
  forbidden: 'Không có quyền xuất bản vẽ', // EPV:207-215 (viewer: model.export false)
} as const;

const versionsRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${projectId}/versions$`, 'u');
const shareLinkCalls = (api: readonly ApiEntry[]): string[] =>
  api.filter((entry) => entry.path.endsWith('/share-links')).map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

/** `/export` with a fresh document: waits for N15 200, the format group, and the tour (G6: its backdrop swallows the first click). */
async function openExport(page: Page, projectId: string): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.export(projectId), { waitUntil: 'commit' }), 'GET', spatialRe(projectId), [200]);
  await expect(page.getByRole('radiogroup', { name: SHARE.formats, exact: true })).toBeVisible();
  await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
  await expect(page.getByRole('button', { name: SHARE.exportButton, exact: true })).toBeVisible();
}

/** `/versions` with a fresh document: waits for N17 200 of the floor and for the list (or the empty copy) to paint. */
async function openVersions(page: Page, projectId: string, floorId: string, floorName: string): Promise<void> {
  const listed = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      versionsRe(projectId).test(new URL(response.url()).pathname) &&
      new URL(response.url()).searchParams.get('floorId') === floorId &&
      response.status() === 200,
  );
  await page.goto(ROUTES.project.versions(projectId));
  await listed;
  await expect(
    page.getByText(`${floorName} chưa có phiên bản nào`, { exact: true }).or(page.getByRole('navigation', { name: SHARE.versionsList, exact: true })),
  ).toBeVisible(); // UVH:606 / VHL:137
}

test.describe('E06d SCR-30S ShareDialog (flag off)', () => {
  test('SCR-30S · FL-30S-01 · share entry points are absent from Export and Versions while the flag is off', async ({ browser }) => {
    test.setTimeout(150_000);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await qcProject(admin, 'share'); // S-SHARE
      const floor = project.floors[0];
      if (floor === undefined) throw new Error('setup: the share project has no floor');
      const adminApi = await adminRequest(admin);
      const viewer = await poolUser(adminApi, 'viewer', 'p06-share');
      await addProjectMember(adminApi, project.id, viewer.email);
      try {
        await openExport(page, project.id);

        await test.step('[30S-A-001] /export (JSON): header has NO "Chia sẻ" button while SHARE_LINKS_SUPPORTED=false', async () => {
          // EPV:249-253 (`onShare !== null`), UEP:718-719, SLK:354
          await expect(page.getByRole('button', { name: SHARE.exportButton, exact: true })).toBeVisible();
          await expect(page.getByRole('button', { name: SHARE.button, exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E06d_30S-A-001_export_no_share_button.png');
        });

        await test.step('[30S-A-003] /export: no dialog "Chia sẻ bản vẽ" and no "Thu hồi liên kết này?" in the DOM', async () => {
          // EPC:160 `{SHARE_LINKS_SUPPORTED && <ShareDialogContainer/>}`
          await expect.soft(page.getByRole('dialog', { name: SHARE.dialog })).toHaveCount(0);
          await expect.soft(page.getByText(SHARE.revoke, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E06d_30S-A-003_export_no_dialog.png');
        });

        await test.step('[30S-G-001] /export load: no request to /api/projects/:id/share-links', async () => {
          // SDH:332, SLK:349-354; settle point = the format group and "Xuất" painted in openExport (N15 200 already read).
          expect.soft(shareLinkCalls(api), 'share-links calls on /export').toEqual([]);
          await captureEvidence(page, 'E06d_30S-G-001_export_no_share_links.png');
        });

        await openVersions(page, project.id, floor.id, floor.name);

        await test.step('[30S-A-002] /versions: VersionHistory has NO entry point to a share dialog', async () => {
          // ShareDialogContainer is mounted only at ExportPanel.container.tsx:160; no ShareDialog import under VersionHistory/
          await expect.soft(page.getByRole('button', { name: SHARE.button, exact: true })).toHaveCount(0);
          await expect.soft(page.getByRole('dialog', { name: SHARE.dialog })).toHaveCount(0);
          await captureEvidence(page, 'E06d_30S-A-002_versions_no_share.png');
        });

        await test.step('[30S-G-002] /versions load: no request to /share-links', async () => {
          // as 30S-G-001; the settle point is the N17 200 + list painted in openVersions
          expect.soft(shareLinkCalls(api), 'share-links calls since /export and /versions').toEqual([]);
          expect.soft(api.some((entry) => versionsRe(project.id).test(entry.path)), 'N17 was read before the claim').toBe(true);
          await captureEvidence(page, 'E06d_30S-G-002_versions_no_share_links.png');
        });

        const member = await openPoolFlow(browser, viewer);
        try {
          // A viewer has no export right: /export shows the forbidden state, not the format group (ExportPanel.container.tsx:14-16,
          // ExportPanel.tsx:207-215), so the settle point is N15 200 + that heading.
          await navigateThenWaitForApi(member.page, () => member.page.goto(ROUTES.project.export(project.id), { waitUntil: 'commit' }), 'GET', spatialRe(project.id), [200]);
          await expect(member.page.getByRole('heading', { name: SHARE.forbidden, exact: true })).toBeVisible();
          await test.step('[30S-D-001] viewer member on /export: no "Chia sẻ" button either (flag is global, not role-based)', async () => {
            // UEP:719
            await expect(member.page.getByRole('radiogroup', { name: SHARE.formats, exact: true })).toHaveCount(0);
            await expect(member.page.getByRole('button', { name: SHARE.button, exact: true })).toHaveCount(0);
            expect.soft(shareLinkCalls(member.api), 'share-links calls as the viewer').toEqual([]);
            await captureEvidence(member.page, 'E06d_30S-D-001_viewer_export_no_share_button.png');
          });
        } finally {
          await member.context.close();
        }
      } finally {
        const failed = await removeProjectMember(adminApi, project.id, viewer.id);
        if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
        await adminApi.dispose();
      }
    });
  });
});
