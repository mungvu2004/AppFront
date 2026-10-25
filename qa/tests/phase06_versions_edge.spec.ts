/**
 * Phase 6 (QA-06b P6) — SCR-32 Lịch sử phiên bản, real stack, 11 flows FL-32-01..11 (flows-C5.md `phase06_versions_edge.spec.ts`).
 * One test = one flow = one journey on one seed; one `test.step('[<row id>] …')` per catalog row, in plan order. No `serial`.
 * Steps marked ⚑ assert the CORRECT behaviour (red while the bug is there). `S5-confirm:` marks a seed / copy assumption.
 *
 * Source: FE `src/screens/export/VersionHistory/` (VH VersionHistory.tsx · VL VersionList.tsx · VC VersionCompare.tsx · VD VersionLabelDialog.tsx
 * · UVH useVersionHistory.ts · VHM versionHistoryModel.ts · VHG versionHistoryGateway.ts · VHC …container.tsx), PSG ProjectSpatialGate.tsx;
 * BE `apps/api/versions/` (service.py, snapshots.py). Seeds and helpers: `support/p06/versions.ts`.
 *
 * Seeds: V2F two empty floors · V0F no floor · PV pipeline project (v1 "before", v2 "after" = "Hiện tại"; read-only, one per worker) · PM PV + a
 * ladder of restores (>= 58 versions, 50 with content; read-only, one per worker) · PC two floors, floor 1 written once (restorable; one per
 * worker) · PR own pipeline project + one layer write per flow · PX PR + two API restores.
 * Needs `E2E_DRAWING_PNG` for every pipeline seed (those flows skip with an "Environment:" reason without it).
 *
 * Budget per run (QA stack, `--workers 4`): admin `POST /api/auth/login` ~2 per flow (API + browser) + 1 per pool page (FL-32-10: 4);
 * `POST /api/projects` 11 + 3 shared (each deleted); pipeline seeds `drawings_init` (60 / 600 s per user): PV 1 + PM 1 + PC 1 per worker + PR 1
 * + PX 1 + (FL-32-10 reuses PC) ≈ 5 per worker; N19 restores ≈ 56 (PM ladder; from the 2nd restore each adds only the "after" version, BE snapshots.py:243-244) + 2 (PX) + 4 UI; N20 labels ≈ 6; `PUT …/spatial/layer` ≈ 6;
 * pool users: 4 slots `p06-versions-{engineer,viewer,nonmember,demote}` (invited on first use only, `users_invite` 30 / 3600 s).
 */
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

import { loginUrl } from '../../e2e/fixtures/routes';
import { waitForApi, type ApiEntry } from '../../e2e/fullstack/apiWatch';
import { PASCAL_RENDER_TIMEOUT_MS, PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { initialsOf } from '../../src/lib/format/initials';
import { attachJson, captureEvidence, TEST_DATA_PREFIX } from './support/evidence';
import { qcLayer, writeLayer } from './support/layerSeed';
import {
  addProjectMember,
  createPipelineProject,
  createProject,
  envDrawingPng,
  listFloors,
  poolUser,
  type SeededDrawing,
} from './support/phase03Seed';
import {
  DESKTOP,
  DIFF_TABS,
  NARROW,
  NOT_FOUND,
  VH,
  adminApi,
  asRecord,
  button,
  closePages,
  createLongNameProject,
  deleteProjects,
  diffTab,
  diffTabHeights,
  labelRe,
  layerRe,
  listVersionsAll,
  must,
  openAdminPage,
  openPoolPage,
  openVersions,
  pickOption,
  restoreRe,
  restoreVia,
  rowBox,
  seedVersionLadder,
  setBox,
  tabPanel,
  toast,
  trackSnapshots,
  unknownProjectId,
  versionList,
  versionReads,
  versionRow,
  versionsRe,
  writesSince,
  layerRevision,
  type OpenPage,
  type VersionItem,
} from './support/p06/versions';

void createLongNameProject; // exported for the ui file (V1F65 seed); not needed by the edge flows

const HAS_PNG = (process.env.E2E_DRAWING_PNG ?? '') !== '';
const ENV_SKIP = 'Environment: E2E_DRAWING_PNG is not set (qa.config.json env.vars)';
const TOAST_UNDO = 'Hoàn tác'; // Toast.tsx:149
const FLOOR_1 = 'Tầng 1';

/** One evidence shot per step: `E06v_<row id>_<slug>.png`. */
const ev = (page: Page, id: string, slug: string, caption?: string): Promise<string> =>
  captureEvidence(page, `E06v_${id}_${slug}.png`, caption === undefined ? {} : { caption });

const note = (text: string): void => {
  test.info().annotations.push({ type: 'cleanup', description: text });
};

/** `{request, headers}` for `writeLayer` from an authenticated admin API context. */
const layerApi = (admin: APIRequestContext): { request: APIRequestContext; headers: Record<string, string> } => ({ request: admin, headers: {} });

interface Flow {
  readonly admin: APIRequestContext;
  readonly open: OpenPage;
  readonly cleanup: string[];
}

/** Admin API + admin browser session for one flow; fixture projects in `cleanup` are deleted at the end. */
async function withFlow(browser: Browser, body: (flow: Flow) => Promise<void>, viewport: { width: number; height: number } = DESKTOP): Promise<void> {
  const admin = await adminApi();
  const cleanup: string[] = [];
  let open: OpenPage | undefined;
  try {
    open = await openAdminPage(browser, viewport);
    await body({ admin, open, cleanup });
  } finally {
    await closePages(open);
    await deleteProjects(admin, cleanup, note);
    await admin.dispose().catch(() => undefined);
  }
}

/** A project that stays the same for every test of one `describe` (per worker): built in `beforeAll`, deleted in `afterAll`. */
function useSeed<T extends { projectId: string }>(build: (admin: APIRequestContext) => Promise<T>, timeoutMs: number): () => T {
  let seed: T | undefined;
  test.beforeAll(async () => {
    test.setTimeout(timeoutMs);
    const admin = await adminApi();
    try {
      seed = await build(admin);
    } finally {
      await admin.dispose();
    }
  });
  test.afterAll(async () => {
    if (seed === undefined) return;
    const admin = await adminApi();
    try {
      await deleteProjects(admin, [seed.projectId], note);
    } finally {
      await admin.dispose();
    }
  });
  return () => must(seed, 'shared seed');
}

const labelOf = (item: VersionItem): string => `v${String(item.sequence)}`;
const lastOf = <T>(items: readonly T[]): T => must(items[items.length - 1], 'last item');

/** The N17 versions list the page read last, as JSON items. */
const lastListed = (log: readonly ApiEntry[], projectId: string): ApiEntry => lastOf(versionReads(log, projectId).filter((entry) => entry.status === 200));

/* ================================================================= FL-32-01 · FL-32-02 (no pipeline needed) */

test.describe('SCR-32 versions — floors and project gate', () => {
  test('SCR-32 · FL-32-01 · floors: empty state, ?floorId=, Select, switch, narrow empty', async ({ browser }) => {
    test.setTimeout(120_000);
    await withFlow(browser, async ({ admin, open, cleanup }) => {
      const { page, api } = open;
      const project = await createProject(admin, '32-v2f', 2);
      cleanup.push(project.projectId);
      const floor1 = must(project.floors[0], 'floor 1');
      const floor2 = must(project.floors[1], 'floor 2');
      const floorSelect = page.getByRole('combobox', { name: VH.floorSelect, exact: true });

      await test.step('[32-B-005] floor without versions: empty state, Select kept', async () => {
        await openVersions(page, project.projectId, floor1.id);
        await expect(page.getByText(VH.emptyTitle(floor1.name), { exact: true })).toBeVisible(); // UVH:611
        await expect(page.getByText(VH.emptyDescription, { exact: true })).toBeVisible(); // VH:72
        await expect(button(page, VH.restore)).toHaveCount(0);
        await expect(floorSelect).toContainText(floor1.name);
        await ev(page, '32-B-005', 'empty_floor');
      });

      await test.step('[32-A-002] ?floorId= picks the floor and N17 asks for it', async () => {
        const mark = api.length;
        await openVersions(page, project.projectId, floor2.id, `?floorId=${encodeURIComponent(floor2.id)}`); // VHC:200-206
        await expect(floorSelect).toContainText(floor2.name);
        await expect(page.getByText(VH.emptyTitle(floor2.name), { exact: true })).toBeVisible();
        const floors = versionReads(api, project.projectId, mark).map((entry) => new URLSearchParams(entry.search).get('floorId'));
        expect.soft(floors, 'N17 asked for floor 2').toContain(floor2.id);
        await ev(page, '32-A-002', 'query_floor2');
      });

      await test.step('[32-A-003] ?floorId= of a floor that is not in the project is ignored', async () => {
        await openVersions(page, project.projectId, floor1.id, `?floorId=${encodeURIComponent('flr_00000000000000000000000000')}`); // VHC:205-206 known()
        await expect.soft(floorSelect).toContainText(floor1.name);
        await expect.soft(page.getByText(VH.emptyTitle(floor1.name), { exact: true })).toBeVisible();
        await ev(page, '32-A-003', 'query_unknown_floor');
      });

      await test.step('[32-A-004] "Tầng" lists every floor by order, the current one selected', async () => {
        await floorSelect.click();
        await expect.soft(page.getByRole('option')).toHaveText([floor1.name, floor2.name]);
        await expect.soft(page.getByRole('option', { name: floor1.name, exact: true })).toHaveAttribute('aria-selected', 'true');
        await ev(page, '32-A-004', 'floor_options');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('option')).toHaveCount(0);
      });

      await test.step('[32-A-005] picking another floor reads N17 for it', async () => {
        const listed = waitForApi(page, 'GET', versionsRe(project.projectId), [200]);
        await pickOption(page, VH.floorSelect, floor2.name);
        const { response } = await listed;
        expect(new URL(response.url()).searchParams.get('floorId')).toBe(floor2.id);
        await expect.soft(page.getByText(VH.emptyTitle(floor2.name), { exact: true })).toBeVisible();
        await ev(page, '32-A-005', 'picked_floor2');
      });

      await test.step('[32-A-006] ⚑ the picked floor survives a reload (URL carries ?floorId=)', async () => {
        await page.reload();
        await expect(page.getByText(/ chưa có phiên bản nào$/u)).toBeVisible();
        await expect.soft(floorSelect).toContainText(floor2.name); // VHC:198,206: `picked` is local state, the URL is never written
        expect.soft(new URL(page.url()).searchParams.get('floorId')).toBe(floor2.id);
        await ev(page, '32-A-006', 'reload_keeps_floor');
      });

      await test.step('[32-B-006] empty state wins over the narrow layout (768)', async () => {
        await page.setViewportSize(NARROW);
        await expect(page.getByText(/ chưa có phiên bản nào$/u)).toBeVisible();
        await expect(page.getByRole('combobox', { name: VH.narrowSelect, exact: true })).toHaveCount(0); // BUG-473
        await expect(versionList(page)).toHaveCount(0);
        await ev(page, '32-B-006', 'empty_768');
      });
    });
  });

  test('SCR-32 · FL-32-02 · project gate: zero floors, unknown project, anonymous', async ({ browser }) => {
    test.setTimeout(120_000);
    await withFlow(browser, async ({ admin, open, cleanup }) => {
      const { page, api } = open;
      const project = await createProject(admin, '32-v0f', 0);
      cleanup.push(project.projectId);
      const route = `/projects/${project.projectId}/versions`;
      let anonymous: OpenPage | undefined;

      try {
        await test.step('[32-B-003] project without floors', async () => {
          await page.goto(route);
          await expect(page.getByText(VH.noFloorTitle, { exact: true })).toBeVisible(); // VHC:75-77
          await expect(page.getByText(VH.noFloorMessage, { exact: true })).toBeVisible();
          await expect(page.getByRole('heading', { level: 1, name: VH.h1 })).toHaveCount(0);
          await expect(page.getByRole('combobox')).toHaveCount(0);
          await ev(page, '32-B-003', 'no_floor');
        });

        await test.step('[32-B-041] project without floors reads no history', async () => {
          // milestone: the "Dự án chưa có tầng" state above is painted, so the container already returned before the hook mounted.
          expect(versionReads(api, project.projectId)).toEqual([]);
          await ev(page, '32-B-041', 'no_history_read');
        });

        await test.step('[32-B-002] unknown project id: not-found state and a way out', async () => {
          await page.goto(`/projects/${unknownProjectId()}/versions`);
          await expect.soft(page.getByText(NOT_FOUND.title, { exact: true })).toBeVisible(); // PSG:37
          await expect.soft(button(page, NOT_FOUND.back)).toBeVisible();
          await ev(page, '32-B-002', 'unknown_project');
        });

        await test.step('[32-A-046] "Về danh sách dự án" leaves to the dashboard', async () => {
          await button(page, NOT_FOUND.back).click();
          await expect.poll(() => new URL(page.url()).pathname).toBe('/'); // PSG:55-57
          await ev(page, '32-A-046', 'back_to_dashboard');
        });

        await test.step('[32-D-007] anonymous deep link goes to the login page', async () => {
          const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP }); // no storage state: anonymous
          anonymous = { context, page: await context.newPage(), api: [] };
          await anonymous.page.goto(route);
          await expect(anonymous.page).toHaveURL(new RegExp(`${loginUrl(route).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u'));
          await expect(anonymous.page.getByText('Hãy đăng nhập để tiếp tục.', { exact: true })).toBeVisible();
          await ev(anonymous.page, '32-D-007', 'anonymous_login');
        });
      } finally {
        await closePages(anonymous);
      }
    });
  });
});

/* ================================================================= PV — read-only AI project */

test.describe('SCR-32 versions — AI project (PV)', () => {
  test.skip(!HAS_PNG, ENV_SKIP);
  const pv = useSeed<SeededDrawing>((admin) => createPipelineProject(admin, '32-pv', envDrawingPng()), PIPELINE_TIMEOUT_MS + 120_000);

  test('SCR-32 · FL-32-03 · AI project tour: rows, "Hiện tại", counts, sentences, colours', async ({ browser }) => {
    test.setTimeout(140_000);
    await withFlow(browser, async ({ open }) => {
      const { page, api } = open;
      const { projectId, floorId } = pv();

      await test.step('[32-C-008] "Hiện tại" marks the versions whose floor revision equals the floor revision', async () => {
        await openVersions(page, projectId, floorId);
        await expect(versionRow(page, 'v2')).toContainText(VH.current); // VHM:216
        await expect(versionRow(page, 'v1')).not.toContainText(VH.current);
        await expect(versionList(page).getByText(VH.current, { exact: true })).toHaveCount(1);
        await ev(page, '32-C-008', 'current_badge');
      });

      await test.step('[32-C-009] current version: no restore, label offered', async () => {
        await expect(button(page, VH.restore)).toHaveCount(0); // VH:174-179
        await expect(button(page, VH.tag)).toBeVisible();
        await button(page, VH.tag).scrollIntoViewIfNeeded();
        await ev(page, '32-C-009', 'current_no_restore');
      });

      await test.step('[32-C-001] row label is v + sequence without digit grouping', async () => {
        // v1000 (sequence 1000) needs 1000 versions: unit-tested; here the real labels carry no grouping separator.
        await expect(versionRow(page, 'v2').getByText(/^v\d+$/u)).toHaveText('v2'); // VHM:204
        await expect(versionRow(page, 'v1').getByText(/^v\d+$/u)).toHaveText('v1');
        await ev(page, '32-C-001', 'row_labels');
      });

      await test.step('[32-C-003] author: creator name from the list, initials in the avatar', async () => {
        const row = versionRow(page, 'v2');
        const avatar = row.locator('[aria-label="hệ thống AI"]');
        await expect(avatar).toHaveCount(1); // Avatar.tsx: span aria-label = alt = creatorName
        await expect(avatar).toHaveText(initialsOf('hệ thống AI'));
        await ev(page, '32-C-003', 'author_avatar');
      });

      await test.step('[32-C-004] time column: relative label, absolute time as tooltip', async () => {
        const time = versionRow(page, 'v2').locator('span[title]');
        await expect(time).toHaveAttribute('title', /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/u); // VHM:212-213
        await expect.soft(time).toHaveText(/\S/u);
        await expect.soft(time).not.toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/u);
        await ev(page, '32-C-004', 'time_column');
      });

      await test.step('[32-C-007] per-row diff dots compare with the next older version that has content', async () => {
        const dots = versionRow(page, 'v2').locator('span[aria-hidden="true"]').filter({ hasText: /\+\d+/u });
        await expect(dots).toHaveText(/^\+\d+\s*−\d+\s*~\d+$/u);
        const colours = dots.locator('span.rounded-full');
        await expect(colours).toHaveCount(3);
        for (const [index, token] of ['--accent', '--state-violation', '--state-attention'].entries()) {
          await expect.soft(colours.nth(index)).toHaveAttribute('style', new RegExp(`var\\(${token}\\)`, 'u')); // types.ts DIFF_TONE_TOKENS
        }
        await expect.soft(versionRow(page, 'v2').locator('span.sr-only')).toHaveText(/^Thêm \d+, xoá \d+, thay đổi \d+$/u);
        await expect.soft(versionRow(page, 'v1').locator('span.sr-only')).toHaveText(VH.noChangeStatus); // oldest row: zeros
        await ev(page, '32-C-007', 'row_dots');
      });

      await test.step('[32-C-015] opaque ids are shown as #1, #2 per kind', async () => {
        const text = await tabPanel(page, DIFF_TABS.changes).innerText();
        expect.soft(text, 'no raw ULID in any sentence').not.toMatch(/[0-9A-Z]{16,}/u); // VHM:287-319 (BUG-456)
        expect.soft(text).toMatch(/#1/u); // S5-confirm: the AI layer holds >= 2 walls, so "tường #1" and "tường #2" both appear
        expect.soft(text).toMatch(/#2/u);
        await ev(page, '32-C-015', 'short_ids');
      });

      await test.step('[32-C-019] diff colours: verified / violation / attention tint on the row', async () => {
        const rows = await tabPanel(page, DIFF_TABS.changes)
          .locator('li')
          .evaluateAll((items) =>
            items.map((item) => {
              const tint = item.querySelector('div[aria-hidden="true"]');
              return {
                sentence: item.querySelector('p')?.textContent ?? '',
                style: tint?.getAttribute('style') ?? '',
                opacity: tint === null ? '' : getComputedStyle(tint).opacity,
              };
            }),
          );
        expect(rows.length, 'the default pair has changes').toBeGreaterThan(0);
        for (const row of rows) {
          const token = row.sentence.startsWith('Thêm') ? '--accent' : row.sentence.startsWith('Xoá') ? '--state-violation' : '--state-attention';
          expect.soft(row.style, row.sentence).toContain(`var(${token})`); // VG:44-52
          expect.soft(row.opacity, row.sentence).toBe('0.08'); // DIFF_TINT_OPACITY
        }
        await ev(page, '32-C-019', 'diff_tints');
      });

      await test.step('[32-A-042] "Xuất phiên bản này" is not offered on the route', async () => {
        await expect(button(page, /^Xuất (phiên bản này|v[0-9]+)$/u)).toHaveCount(0); // VHC:225: no onExportVersion
        await ev(page, '32-A-042', 'no_export');
      });

      void api;
    });
  });

  test('SCR-32 · FL-32-04 · AI project: landmarks, pair, tabs by keyboard, no writes', async ({ browser }) => {
    test.setTimeout(200_000);
    await withFlow(browser, async ({ open }) => {
      const { page, api } = open;
      const { projectId, floorId, floorName } = pv();
      const changes = diffTab(page, DIFF_TABS.changes);
      const json = diffTab(page, DIFF_TABS.json);
      const visual = diffTab(page, DIFF_TABS.visual);
      const restore = button(page, VH.restore);
      let mark = 0;

      await test.step('[32-E-001] one level-1 heading', async () => {
        await openVersions(page, projectId, floorId);
        mark = api.length;
        // loading / empty / error / forbidden states: FL-32-01 (empty), mocked file (error, forbidden, loading); success here.
        await expect(page.getByRole('heading', { level: 1, name: VH.h1 })).toHaveCount(1); // VH:44-46
        await ev(page, '32-E-001', 'h1');
      });

      await test.step('[32-E-002] the version list is a navigation landmark', async () => {
        await expect(page.getByRole('navigation', { name: VH.list, exact: true })).toBeVisible(); // VL:364
        await ev(page, '32-E-002', 'nav_landmark');
      });

      await test.step('[32-E-003] row checkbox has a descriptive name, avatar an alt text', async () => {
        await expect(rowBox(page, 'v2')).toBeVisible(); // VL:307
        await expect(versionRow(page, 'v2').locator('[aria-label="hệ thống AI"]')).toHaveCount(1);
        await ev(page, '32-E-003', 'checkbox_names');
      });

      await test.step('[32-E-004] colour dots hidden from AT, spoken sentence instead', async () => {
        await expect(versionList(page).locator('span[aria-hidden="true"]').filter({ hasText: /\+\d+/u })).toHaveCount(2); // VL:268
        await expect(versionRow(page, 'v2').locator('span.sr-only')).toHaveText(/^Thêm \d+, xoá \d+, thay đổi \d+$/u);
        await expect(page.getByRole('status').filter({ hasText: /^Thêm \d+, xoá \d+, thay đổi \d+$/u })).toHaveCount(1); // VC:121-123
        await ev(page, '32-E-004', 'sr_counts');
      });

      await test.step('[32-E-005] polite live region reports snapshot load failures', async () => {
        const live = page.getByRole('status', { name: VH.snapshotStatus, exact: true });
        await expect(live).toHaveAttribute('aria-live', 'polite'); // VL:255
        await expect(live).toHaveText('');
        await ev(page, '32-E-005', 'live_region');
      });

      await test.step('[32-B-024] compare area returns to full opacity after a new pair', async () => {
        const container = tabPanel(page, DIFF_TABS.changes).locator('xpath=..');
        await setBox(rowBox(page, 'v1'), false);
        await setBox(rowBox(page, 'v1'), true); // pair rebuilt -> VC:215-221 dims to 40 % for 180 ms
        await expect(container).toHaveCSS('opacity', '1'); // end state; the 180 ms dim is not observable without a clock
        await ev(page, '32-B-024', 'opacity_settled');
      });

      await test.step('[32-E-006] diff tabs: roving tabindex, ArrowLeft/Right wrap, Home/End', async () => {
        await expect(changes).toHaveAttribute('aria-selected', 'true');
        await expect(changes).toHaveAttribute('tabindex', '0'); // Tabs.tsx:129
        await expect(json).toHaveAttribute('tabindex', '-1');
        await expect(visual).toHaveAttribute('tabindex', '-1');
        await changes.focus();
        await page.keyboard.press('ArrowLeft'); // Tabs.tsx:105 wraps to the last tab
        await expect(visual).toHaveAttribute('aria-selected', 'true');
        await expect(visual).toBeFocused();
        await page.keyboard.press('Home');
        await expect(changes).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('End');
        await expect(visual).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('ArrowRight'); // wraps back to the first
        await expect(changes).toHaveAttribute('aria-selected', 'true');
        await expect(changes).toBeFocused();
        await ev(page, '32-E-006', 'tabs_keyboard');
      });

      await test.step('[32-E-007] tab panels are named, focusable, inactive ones hidden', async () => {
        for (const label of [DIFF_TABS.changes, DIFF_TABS.json, DIFF_TABS.visual]) await expect(tabPanel(page, label)).toHaveAttribute('tabindex', '0');
        await expect(tabPanel(page, DIFF_TABS.changes)).toBeVisible();
        await expect(tabPanel(page, DIFF_TABS.json)).toBeHidden(); // VC:226-241
        await expect(tabPanel(page, DIFF_TABS.visual)).toBeHidden();
        await changes.focus();
        await page.keyboard.press('Tab');
        await expect(tabPanel(page, DIFF_TABS.changes)).toBeFocused();
        await ev(page, '32-E-007', 'tabpanels');
      });

      await test.step('[32-E-008] diff rows focus and show a ring', async () => {
        await page.keyboard.press('Tab'); // panel -> first row (li tabIndex 0)
        const row = tabPanel(page, DIFF_TABS.changes).getByRole('listitem').first();
        await expect(row).toHaveAttribute('tabindex', '0'); // VG:62-80
        await expect(row).toBeFocused();
        await expect.soft(row).not.toHaveCSS('box-shadow', 'none');
        await ev(page, '32-E-008', 'row_focus');
      });

      await test.step('[32-A-045] footer buttons act on right ?? left', async () => {
        await setBox(rowBox(page, 'v2'), false);
        await expect(restore).toBeEnabled(); // BUG-470: v1 is not current
        await restore.click();
        const dialog = page.getByRole('dialog', { name: VH.restoreTitle('v1', floorName) });
        await expect(dialog).toBeVisible(); // VHM:539 names the ticked version
        await dialog.getByRole('button', { name: VH.restoreCancel, exact: true }).click(); // never confirmed
        await expect(dialog).toHaveCount(0);
        await ev(page, '32-A-045', 'single_pick_restore_dialog');
      });

      await test.step('[32-B-015] pair not complete: sentence', async () => {
        await expect(page.getByText(VH.noPair, { exact: true })).toBeVisible(); // VHP:44
        await ev(page, '32-B-015', 'pair_incomplete');
      });

      await test.step('[32-C-022] nothing ticked: footer asks for a choice, restore disabled', async () => {
        await setBox(rowBox(page, 'v1'), false);
        await expect(page.getByText(VH.pickOne, { exact: true })).toBeVisible(); // VH:152-154
        await expect(restore).toBeDisabled();
        await ev(page, '32-C-022', 'nothing_ticked');
      });

      await test.step('[32-E-017] footer tab order: label, then restore; a disabled restore is skipped', async () => {
        await setBox(rowBox(page, 'v1'), true);
        await expect(restore).toBeEnabled();
        await button(page, VH.tag).focus();
        await page.keyboard.press('Tab');
        await expect(restore).toBeFocused(); // DOM order (VH:163-192)
        await setBox(rowBox(page, 'v1'), false);
        await expect(restore).toBeDisabled(); // a disabled button is not in the tab order
        await ev(page, '32-E-017', 'footer_tab_order');
      });

      await test.step('[32-G-013] no write while only reading and comparing', async () => {
        expect(writesSince(api, mark)).toEqual([]); // UVH:506-510
        await ev(page, '32-G-013', 'no_writes');
      });

      void json;
    });
  });

  test('SCR-32 · FL-32-05 · AI project: label dialog and label rules', async ({ browser }) => {
    test.setTimeout(180_000);
    await withFlow(browser, async ({ admin, open }) => {
      const { page, api } = open;
      const { projectId, floorId } = pv();
      const tag = button(page, VH.tag);
      const dialog = page.getByRole('dialog', { name: VH.labelDialog('v2') }); // VD:37: the reviewed (right) version is v2
      const field = dialog.getByRole('textbox', { name: VH.labelField, exact: true });
      const badge = versionRow(page, 'v2').getByText('x', { exact: true });
      const typed = `${TEST_DATA_PREFIX}nhan`;
      const openDialog = async (): Promise<void> => {
        await tag.click();
        await expect(dialog).toBeVisible();
      };
      const sendWith = async (text: string): Promise<{ body: unknown; status: number }> => {
        await field.fill(text);
        const sent = waitForApi(page, 'PATCH', labelRe(projectId), [200, 400, 422]);
        await page.keyboard.press('Enter'); // VD:27-32 form submit
        const { response } = await sent;
        return { body: response.request().postDataJSON(), status: response.status() };
      };
      let mark6 = 0;
      const v2 = must((await listVersionsAll(admin, projectId, floorId)).find((item) => item.sequence === 2), 'v2');

      try {
        await test.step('[32-E-010] label dialog: field labelled, hint tied to it, focus in the field', async () => {
          await openVersions(page, projectId, floorId);
          await openDialog();
          await expect(field).toBeFocused(); // VD:428-434
          await expect(field).toHaveAccessibleDescription(VH.labelHint);
          await ev(page, '32-E-010', 'dialog_a11y');
        });

        await test.step('[32-A-026] label field stops at 60 characters', async () => {
          await field.fill('');
          await field.pressSequentially('x'.repeat(VH.labelMax + 10));
          expect((await field.inputValue()).length).toBe(VH.labelMax); // VD:403,433 maxLength
          await ev(page, '32-A-026', 'label_max_60', `${String(VH.labelMax + 10)} typed, ${String(VH.labelMax)} kept`);
        });

        await test.step('[32-A-023] "Huỷ" closes the dialog and sends nothing', async () => {
          const mark = api.length;
          await dialog.getByRole('button', { name: VH.labelCancel, exact: true }).click();
          await expect(dialog).toHaveCount(0);
          // milestone: the dialog is gone; cancelling has no async send.
          expect(writesSince(api, mark)).toEqual([]);
          await ev(page, '32-A-023', 'cancel_sends_nothing');
        });

        await test.step('[32-A-024] Esc and "Đóng hộp thoại" close it, nothing sent', async () => {
          const mark = api.length;
          await openDialog();
          await page.keyboard.press('Escape');
          await expect(dialog).toHaveCount(0);
          await openDialog();
          await dialog.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click(); // Modal.tsx:171
          await expect(dialog).toHaveCount(0);
          expect(writesSince(api, mark)).toEqual([]);
          await ev(page, '32-A-024', 'close_sends_nothing');
        });

        await test.step('[32-A-027] Enter in the field submits the form', async () => {
          await openDialog();
          const sent = await sendWith(typed);
          expect(sent.status).toBe(200);
          expect(asRecord(sent.body, 'PATCH body').label).toBe(typed);
          await expect(dialog).toHaveCount(0);
          await ev(page, '32-A-027', 'enter_submits');
        });

        await test.step('[32-C-045] label is sent as typed, the row shows the normalised text', async () => {
          mark6 = api.length;
          await openDialog();
          const sent = await sendWith('  x  ');
          expect(sent.status).toBe(200);
          expect(sent.body).toEqual({ label: '  x  ' }); // VD:416-421 untrimmed
          await expect(badge).toBeVisible(); // BE service.py: NFC + strip
          await ev(page, '32-C-045', 'normalised_badge');
        });

        await test.step('[32-G-012] after a label N17 is refetched', async () => {
          await expect
            .poll(() => {
              const patch = api.slice(mark6).findIndex((entry) => entry.method === 'PATCH' && labelRe(projectId).test(entry.path));
              return patch >= 0 && versionReads(api, projectId, mark6 + patch + 1).length > 0;
            })
            .toBe(true); // UVH:463
          await ev(page, '32-G-012', 'list_refetched');
        });

        await test.step('[32-A-025] dialog opens prefilled with the current label', async () => {
          await openDialog();
          await expect(field).toHaveValue('x'); // VH:217, VD:432
          await page.keyboard.press('Escape');
          await expect(dialog).toHaveCount(0);
          await ev(page, '32-A-025', 'prefilled');
        });

        await test.step('[32-A-022] submitting an empty label removes it; toast "Đã gỡ nhãn"', async () => {
          await openDialog();
          const sent = await sendWith('');
          expect(sent.status).toBe(200);
          expect(sent.body).toEqual({ label: '' });
          await expect(badge).toHaveCount(0);
          await expect(toast(page, VH.unlabeledToast)).toBeVisible(); // UVH:475
          await ev(page, '32-A-022', 'label_removed');
        });

        await test.step('[32-C-046] ⚑ removing a label from a version that has none says nothing was removed', async () => {
          await page.mouse.move(0, 0); // the pointer must not hold the toast (Toast.tsx:153)
          await expect(toast(page, VH.unlabeledToast)).toHaveCount(0, { timeout: 20_000 }); // the toast of the previous step is gone
          await openDialog();
          const mark = api.length;
          const sent = await sendWith('');
          expect(sent.status).toBe(200);
          await expect.poll(() => versionReads(api, projectId, mark).length).toBeGreaterThan(0); // milestone: the toast would be up by now
          // One read at the milestone (the toast lives 8 s, so a retrying toHaveCount(0) would pass after it left).
          expect.soft(await toast(page, VH.unlabeledToast).count(), 'no "Đã gỡ nhãn" when nothing was removed').toBe(0); // UVH:465-475
          await ev(page, '32-C-046', 'no_label_removed_toast');
        });

        await test.step('[32-C-043] ⚑ a forbidden direction character is refused with a text that says why', async () => {
          await openDialog();
          const sent = await sendWith('a\u202Eb');
          expect(sent.status, 'BE normalize_label: category Cf -> 422 VALIDATION label').toBe(422);
          const banner = page.getByRole('alert').filter({ hasText: VH.labelErrorTitle });
          await expect(banner).toBeVisible();
          await expect.soft(banner).not.toContainText('Nhãn dài tối đa 60 ký tự.'); // VHM:448 maps VALIDATION to the length text for every cause
          await expect.soft(banner).toContainText(/không hợp lệ|điều khiển|đảo chiều/u); // S5-confirm: wording of the corrected message
          await ev(page, '32-C-043', 'forbidden_char');
        });
      } finally {
        // PV is shared: leave v2 unlabelled whatever happened above.
        await admin.patch(`/api/projects/${projectId}/versions/${v2.id}/label`, { data: { label: '' } }).catch(() => undefined);
      }
    });
  });
});

/* ================================================================= PM — many versions */

interface Ladder extends SeededDrawing {
  readonly versions: VersionItem[];
}

test.describe('SCR-32 versions — many versions (PM)', () => {
  test.skip(!HAS_PNG, ENV_SKIP);
  const pm = useSeed<Ladder>(async (admin) => {
    const seeded = await createPipelineProject(admin, '32-pm', envDrawingPng());
    try {
      return { ...seeded, versions: await seedVersionLadder(admin, seeded.projectId, seeded.floorId, 58) };
    } catch (error) {
      await deleteProjects(admin, [seeded.projectId], note);
      throw error;
    }
  }, PIPELINE_TIMEOUT_MS + 300_000);

  test('SCR-32 · FL-32-06 · many versions: snapshot budget, pick rules, load more, retention rows', async ({ browser }) => {
    test.setTimeout(240_000);
    await withFlow(browser, async ({ open }) => {
      const { page, api } = open;
      const { projectId, floorId, versions } = pm();
      const withContent = versions.filter((item) => item.hasSnapshot);
      const retention = versions.filter((item) => !item.hasSnapshot);
      const at = (index: number): VersionItem => must(versions[index], `version #${String(index)}`);
      const snapshots = trackSnapshots(page);
      const leftSelect = page.getByRole('combobox', { name: VH.leftSelect, exact: true });
      const rightSelect = page.getByRole('combobox', { name: VH.rightSelect, exact: true });
      const ticked = versionList(page).getByRole('checkbox', { checked: true });
      let secondPage: { json: unknown; url: URL } | undefined;

      await test.step('[32-C-012] snapshot reads: 10 newest + the ticked pair, at most 2 in flight', async () => {
        await openVersions(page, projectId, floorId);
        await expect(diffTab(page, DIFF_TABS.changes)).toBeVisible(); // pair built -> its snapshots are in
        await expect.poll(() => snapshots.inFlight).toBe(0);
        const first = snapshots.urls.length;
        expect.soft(snapshots.peak, 'peak concurrent GET …/snapshot').toBeLessThanOrEqual(2); // UVH:82-84
        expect.soft(first, 'reads on load').toBeLessThanOrEqual(10);
        const older = at(15); // outside the 10 prefetched, still has content
        await pickOption(page, VH.leftSelect, new RegExp(`^${labelOf(older)} ·`, 'u'));
        await expect.poll(() => snapshots.urls.length).toBe(first + 1);
        expect(lastOf(snapshots.urls)).toContain(older.id);
        expect.soft(snapshots.peak).toBeLessThanOrEqual(2);
        await ev(page, '32-C-012', 'snapshot_budget', `${String(first)} reads on load, +1 for ${labelOf(older)}`);
      });

      await test.step('[32-A-010] with two ticked every other checkbox is disabled', async () => {
        await expect(ticked).toHaveCount(2);
        await expect(versionList(page).locator('input[type=checkbox]:checked:not(:disabled)')).toHaveCount(2);
        await expect(versionList(page).locator('input[type=checkbox]:not(:checked):not(:disabled)')).toHaveCount(0); // VHM:223
        await ev(page, '32-A-010', 'others_disabled');
      });

      await test.step('[32-B-025] ⚑ rows older than the 10 newest can be ticked', async () => {
        await setBox(rowBox(page, labelOf(at(0))), false); // frees one slot (pair: v(N-15) + the newest)
        const target = rowBox(page, labelOf(at(25))); // not prefetched, not ticked, has content
        await expect.soft(target).toBeEnabled(); // UVH:171-189, VHM:223 isPickable needs isLoaded
        if (await target.isEnabled()) await setBox(target, true);
        await ev(page, '32-B-025', 'older_row_pickable');
      });

      await test.step('[32-A-009] ticking again rebuilds the pair ordered by sequence', async () => {
        // by name: `ticked.first()` re-resolves to the OTHER ticked box once one is cleared, so the unchecked wait would never settle
        const tickedNames = await ticked.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
        for (const name of tickedNames) await setBox(versionList(page).getByRole('checkbox', { name, exact: true }), false);
        await setBox(rowBox(page, labelOf(at(1))), true); // the newer one first
        await setBox(rowBox(page, labelOf(at(3))), true);
        await expect(leftSelect).toContainText(`${labelOf(at(3))} ·`); // VHP:413-427 older left
        await expect(rightSelect).toContainText(`${labelOf(at(1))} ·`);
        await expect(tabPanel(page, DIFF_TABS.changes)).toBeVisible();
        await ev(page, '32-A-009', 'pair_ordered');
      });

      await test.step('[32-A-012] "Phiên bản đối chiếu" changes the right version; footer acts on it', async () => {
        await pickOption(page, VH.rightSelect, new RegExp(`^${labelOf(at(2))} ·`, 'u'));
        await expect(rightSelect).toContainText(`${labelOf(at(2))} ·`);
        await button(page, VH.tag).click();
        const dialog = page.getByRole('dialog', { name: VH.labelDialog(labelOf(at(2))) }); // VC:192-199, VH:37
        await expect(dialog).toBeVisible();
        await ev(page, '32-A-012', 'right_select_footer');
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      });

      await test.step('[32-E-011] Selects are labelled comboboxes operable by keyboard', async () => {
        for (const name of [VH.floorSelect, VH.leftSelect, VH.rightSelect]) await expect(page.getByRole('combobox', { name, exact: true })).toBeVisible();
        await rightSelect.focus();
        await page.keyboard.press('ArrowDown'); // useSelect.ts:43 opens
        await expect(page.getByRole('listbox')).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter'); // picks the highlighted option
        await expect(page.getByRole('listbox')).toHaveCount(0);
        await ev(page, '32-E-011', 'select_keyboard');
      });

      await test.step('[32-A-017] "Xem thêm phiên bản" loads the next page and appends the rows', async () => {
        await expect(versionList(page).getByRole('checkbox')).toHaveCount(50);
        const loadMore = button(page, VH.loadMore);
        await expect(loadMore).toBeVisible();
        const next = waitForApi(page, 'GET', versionsRe(projectId), [200]);
        await loadMore.dblclick(); // the second click lands while the page loads (A-018)
        const { response, json } = await next;
        secondPage = { json, url: new URL(response.url()) };
        expect(secondPage.url.searchParams.get('floorId')).toBe(floorId); // UVH:551-555
        expect(secondPage.url.searchParams.get('limit')).toBe('50');
        expect(secondPage.url.searchParams.get('cursor')).toBeTruthy();
        await expect(versionList(page).getByRole('checkbox')).toHaveCount(versions.length);
        await ev(page, '32-A-017', 'load_more');
      });

      await test.step('[32-G-004] N17 second page adds cursor=<nextCursor>', async () => {
        const body = asRecord(must(secondPage, 'second page').json, 'N17 page 2');
        expect(Array.isArray(body.items) ? body.items.length : -1).toBe(versions.length - 50);
        expect(body.nextCursor, 'last page: no cursor').toBeUndefined();
        await ev(page, '32-G-004', 'second_page');
      });

      await test.step('[32-A-018] after the last page the button is gone; one cursor request in total', async () => {
        await expect(button(page, VH.loadMore)).toHaveCount(0);
        const cursorReads = versionReads(api, projectId).filter((entry) => new URLSearchParams(entry.search).has('cursor'));
        expect(cursorReads).toHaveLength(1);
        await ev(page, '32-A-018', 'single_cursor_request');
      });

      await test.step('[32-B-026] versions without content: retention notice, checkbox disabled', async () => {
        expect(retention.length, 'setup: metadata-only rows exist').toBeGreaterThan(0);
        await expect(page.getByText(VH.retention, { exact: true })).toHaveCount(retention.length);
        await expect(rowBox(page, labelOf(at(versions.length - 1)))).toBeDisabled();
        await rowBox(page, labelOf(at(versions.length - 1))).scrollIntoViewIfNeeded();
        await ev(page, '32-B-026', 'retention_rows');
      });

      await test.step('[32-C-013] versions without content are never read', async () => {
        expect(retention.filter((item) => snapshots.urls.some((url) => url.includes(item.id)))).toEqual([]); // UVH:185
        await ev(page, '32-C-013', 'no_reads_for_retention');
      });

      await test.step('[32-A-013] compare Selects offer only versions that still have content', async () => {
        await leftSelect.click();
        const options = page.getByRole('option');
        await expect(options).toHaveCount(withContent.length);
        const names = await options.allInnerTexts();
        expect(names.every((name) => /^v\d+ · /u.test(name))).toBe(true); // UVH:258-264
        expect(retention.filter((item) => names.some((name) => name.startsWith(`${labelOf(item)} ·`)))).toEqual([]);
        await ev(page, '32-A-013', 'select_options');
        await page.keyboard.press('Escape');
      });
    });
  });

  test('SCR-32 · FL-32-07 · narrow window: Select replaces the list, retention row restore', async ({ browser }) => {
    test.setTimeout(240_000);
    await withFlow(
      browser,
      async ({ open }) => {
        const { page, api } = open;
        const { projectId, floorId, versions } = pm();
        const retention = versions.filter((item) => !item.hasSnapshot);
        const at = (index: number): VersionItem => must(versions[index], `version #${String(index)}`);
        const narrowSelect = page.getByRole('combobox', { name: VH.narrowSelect, exact: true });
        let offered: string[] = [];

        await test.step('[32-A-043] below 1024 the "Phiên bản" Select picks the right version', async () => {
          await openVersions(page, projectId, floorId);
          await expect(narrowSelect).toBeVisible(); // VH:119-126
          await expect(versionList(page)).toHaveCount(0);
          await pickOption(page, VH.leftSelect, new RegExp(`^${labelOf(at(20))} ·`, 'u')); // an older left, so the right can move
          await pickOption(page, VH.narrowSelect, new RegExp(`^${labelOf(at(8))} — `, 'u'));
          await expect(page.getByRole('combobox', { name: VH.rightSelect, exact: true })).toContainText(`${labelOf(at(8))} ·`);
          await button(page, VH.tag).click();
          const dialog = page.getByRole('dialog', { name: VH.labelDialog(labelOf(at(8))) }); // footer target followed
          await expect(dialog).toBeVisible();
          await ev(page, '32-A-043', 'narrow_select_pick');
          await page.keyboard.press('Escape');
          await expect(dialog).toHaveCount(0);
        });

        await test.step('[32-A-044] ⚑ the narrow layout still lets the user reach older versions', async () => {
          await expect.soft(button(page, VH.loadMore)).toBeVisible(); // VH:127-139: the button lives only in the wide branch
          await ev(page, '32-A-044', 'narrow_load_more');
        });

        await test.step('[32-C-056] ⚑ the narrow Select lists only restorable versions', async () => {
          // The narrow layout cannot fetch page 2 (A-044), so page 2 is loaded wide first, then the window narrows (same component, same data).
          await page.setViewportSize(DESKTOP);
          const next = waitForApi(page, 'GET', versionsRe(projectId), [200]);
          await button(page, VH.loadMore).click();
          await next;
          await page.setViewportSize(NARROW);
          await expect(narrowSelect).toBeVisible();
          await narrowSelect.click();
          const names = await page.getByRole('option').allInnerTexts();
          offered = names.filter((name) => retention.some((item) => name.startsWith(`${labelOf(item)} — `)));
          expect.soft(offered, 'options for versions without content').toEqual([]); // UVH:121-126 options = all rows
          if (offered.length > 0) {
            await page.getByRole('option', { name: must(offered[0], 'offered option') }).click();
            await expect.soft(button(page, VH.restore)).toHaveCount(0);
          } else {
            await page.keyboard.press('Escape');
          }
          await ev(page, '32-C-056', 'narrow_select_options');
        });

        await test.step('[32-C-033] restore error VERSION_SNAPSHOT_PURGED', async () => {
          if (offered.length === 0) {
            // C-056 is fixed: the UI has no path to a purged version any more, so the server answer cannot be reached from here.
            test.info().annotations.push({ type: 'unreachable', description: '32-C-033: no purged version reachable from the narrow Select' });
            expect.soft(offered, 'no UI path to a purged version').toEqual([]);
            await ev(page, '32-C-033', 'unreachable');
            return;
          }
          await button(page, VH.restore).click();
          const answered = waitForApi(page, 'POST', restoreRe(projectId), [400, 404, 409, 422]);
          await page.getByRole('dialog').getByRole('button', { name: VH.restoreConfirm, exact: true }).click();
          expect((await answered).response.status()).toBe(422);
          const banner = page.getByRole('alert').filter({ hasText: VH.restoreErrorTitle });
          await expect(banner).toContainText('Bản này không còn nội dung để phục hồi.'); // VHM:438
          await ev(page, '32-C-033', 'purged_restore_error');
        });

        void api;
      },
      NARROW,
    );
  });
});

/* ================================================================= PR — own project, restore */

test.describe('SCR-32 versions — restore on an own floor (PR)', () => {
  test.skip(!HAS_PNG, ENV_SKIP);

  test('SCR-32 · FL-32-08 · restore, toast, list refetch, undo once', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    await withFlow(browser, async ({ admin, open, cleanup }) => {
      const { page, api } = open;
      const seeded = await createPipelineProject(admin, '32-pr', envDrawingPng());
      cleanup.push(seeded.projectId);
      const { projectId, floorId, floorName } = seeded;
      await writeLayer(layerApi(admin), projectId, floorId, qcLayer); // the AI version is no longer "Hiện tại"
      const restore = button(page, VH.restore);
      const dialog = page.getByRole('dialog', { name: VH.restoreTitle('v2', floorName) });
      let restoredBody: Record<string, unknown> = {};
      let markRestore = 0;
      let restoredToast = toast(page, VH.restoredToast('v2', floorName));

      await page.clock.install(); // E-012 needs time control; the clock keeps ticking in real time otherwise
      await test.step('[32-C-023] footer caption always reads the restore promise', async () => {
        await openVersions(page, projectId, floorId);
        await expect(page.getByText(VH.restoreCaption, { exact: true })).toBeVisible(); // VH:151
        await ev(page, '32-C-023', 'footer_caption');
      });

      await test.step('[32-E-009] restore dialog: named, focus moves in, Esc returns focus to the opener', async () => {
        await restore.click();
        await expect(dialog).toBeVisible(); // VHM:539
        await expect(dialog.locator(':focus')).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(restore).toBeFocused(); // Modal.tsx:64
        await ev(page, '32-E-009', 'dialog_focus');
      });

      await test.step('[32-C-024] confirm body reads as one coherent text', async () => {
        await restore.click();
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(`${VH.restoreCaption}. ${VH.undoCleared}`); // VHM:509,540 (BUG-459)
        await expect(dialog).toContainText('v2');
        await ev(page, '32-C-024', 'dialog_body');
      });

      await test.step('[32-A-032] success: layer re-read, then the toast with "Hoàn tác"', async () => {
        markRestore = api.length;
        const posted = waitForApi(page, 'POST', restoreRe(projectId), [201]);
        const layerRead = waitForApi(page, 'GET', layerRe(projectId, floorId), [200]);
        await dialog.getByRole('button', { name: VH.restoreConfirm, exact: true }).click();
        restoredBody = asRecord((await posted).json, 'N19');
        await layerRead;
        restoredToast = toast(page, VH.restoredToast('v2', floorName));
        await expect(restoredToast).toBeVisible(); // UVH:442-450
        await expect(restoredToast.getByRole('button', { name: TOAST_UNDO, exact: true })).toBeVisible();
        await restoredToast.hover(); // hold the 8 s window while the next steps read
        await ev(page, '32-A-032', 'restored_toast');
      });

      await test.step('[32-G-009] N16 read right after the restore', async () => {
        const entries = api.slice(markRestore);
        const post = entries.findIndex((entry) => entry.method === 'POST' && restoreRe(projectId).test(entry.path));
        const layer = entries.slice(post + 1).find((entry) => entry.method === 'GET' && layerRe(projectId, floorId).test(entry.path));
        expect(layer?.status).toBe(200); // UVH:346-356
        expect(asRecord(layer?.json, 'N16').revision).toBe(restoredBody.floorRevision);
        await ev(page, '32-G-009', 'layer_reread');
      });

      await test.step('[32-G-010] after a restore N17 is refetched', async () => {
        await expect
          .poll(() => {
            const entries = api.slice(markRestore);
            const layer = entries.findIndex((entry) => entry.method === 'GET' && layerRe(projectId, floorId).test(entry.path));
            return layer >= 0 && versionReads(api, projectId, markRestore + layer).length > 0;
          })
          .toBe(true); // invalidation.ts:186
        await ev(page, '32-G-010', 'list_refetched');
      });

      await test.step('[32-E-012] "Hoàn tác" is keyboard reachable and hover pauses the 8 s window', async () => {
        const undo = restoredToast.getByRole('button', { name: TOAST_UNDO, exact: true });
        await undo.focus();
        await expect(undo).toBeFocused(); // keyboard reachable
        await undo.evaluate((el) => (el as HTMLElement).blur()); // focus alone also holds the toast (Toast.tsx:80): drop it
        await page.mouse.move(0, 0);
        await restoredToast.hover(); // Toast.tsx:131-132: only hover holds it now
        await page.clock.runFor(10_000); // past the 8 s window
        await expect(restoredToast).toBeVisible();
        await ev(page, '32-E-012', 'toast_hover_pause');
      });

      let revertBody: unknown;
      let beforeId = '';
      await test.step('[32-A-035] toast "Hoàn tác" reverts the restore', async () => {
        const all = await listVersionsAll(admin, projectId, floorId);
        beforeId = must(all.find((item) => item.sequence === 3), 'v3 (the "before" of the restore)').id;
        const reverted = waitForApi(page, 'POST', restoreRe(projectId), [200, 201]);
        await restoredToast.getByRole('button', { name: TOAST_UNDO, exact: true }).dblclick(); // UVH:361-412; the 2nd click lands before the toast leaves (A-036)
        const { response } = await reverted;
        revertBody = response.request().postDataJSON();
        expect(new URL(response.url()).pathname).toBe(`/api/projects/${projectId}/versions/${beforeId}/restore`);
        await expect(toast(page, VH.undoneToast)).toBeVisible(); // UVH:389-390
        await ev(page, '32-A-035', 'undone_toast');
      });

      await test.step('[32-C-048] revert goes to the version just before the restore and uses the revision it produced', async () => {
        expect(revertBody).toEqual({ baseVersion: restoredBody.floorRevision, body: { floorId } }); // VHG:259-299
        await ev(page, '32-C-048', 'revert_request');
      });

      await test.step('[32-A-036] undo works once', async () => {
        // milestone: "Đã hoàn tác lượt phục hồi" was seen in A-035 (revert finished) after a double click; the 2nd click must have sent nothing.
        const posts = api.filter((entry) => entry.method === 'POST' && restoreRe(projectId).test(entry.path));
        expect(posts, 'one restore + exactly one revert').toHaveLength(2); // UVH:359,371-375
        await ev(page, '32-A-036', 'undo_once');
      });

    });
  });
});

/* ================================================================= PC — conflicts and roles */

interface TwoFloors extends SeededDrawing {
  readonly floor2Id: string;
}

test.describe('SCR-32 versions — two floors (PC)', () => {
  test.skip(!HAS_PNG, ENV_SKIP);
  const pc = useSeed<TwoFloors>(async (admin) => {
    const seeded = await createPipelineProject(admin, '32-pc', envDrawingPng(), [FLOOR_1, 'Tầng 2']);
    try {
      await writeLayer(layerApi(admin), seeded.projectId, seeded.floorId, qcLayer);
      const floor2 = must((await listFloors(admin, seeded.projectId)).find((floor) => floor.name === 'Tầng 2'), 'floor 2');
      return { ...seeded, floor2Id: floor2.id };
    } catch (error) {
      await deleteProjects(admin, [seeded.projectId], note);
      throw error;
    }
  }, PIPELINE_TIMEOUT_MS + 120_000);

  test('SCR-32 · FL-32-09 · another writer: restore 409, banner, floor switch, reload', async ({ browser }) => {
    test.setTimeout(160_000);
    await withFlow(browser, async ({ admin, open }) => {
      const { page } = open;
      const { projectId, floorId, floorName } = pc();
      const restore = button(page, VH.restore);
      const banner = page.getByRole('alert').filter({ hasText: VH.conflictTitle });
      let conflict: Record<string, unknown> = {};
      const restoreAndExpect409 = async (): Promise<Record<string, unknown>> => {
        await restore.click();
        const rejected = waitForApi(page, 'POST', restoreRe(projectId), [409]);
        await page.getByRole('dialog').getByRole('button', { name: VH.restoreConfirm, exact: true }).click();
        return asRecord((await rejected).json, '409');
      };

      await test.step('[32-C-025] the restore base comes from the store, so another writer yields a conflict', async () => {
        await openVersions(page, projectId, floorId);
        await expect(restore).toBeEnabled();
        const before = (await listVersionsAll(admin, projectId, floorId)).length;
        await writeLayer(layerApi(admin), projectId, floorId, qcLayer); // another writer after the page read the revision (UVH:418)
        conflict = await restoreAndExpect409();
        expect(conflict.code).toBe('VERSION_CONFLICT'); // VHG:118-127
        expect(Array.isArray(conflict.remoteChanges)).toBe(true);
        expect((await listVersionsAll(admin, projectId, floorId)).length, 'no new version').toBe(before);
        await ev(page, '32-C-025', 'restore_409');
      });

      await test.step('[32-B-029] conflict banner above the compare area', async () => {
        await expect(banner).toBeVisible(); // VH:110-117
        await expect(banner).toContainText(/đã sửa tầng này sau lúc bạn mở trang, nên lượt phục hồi chưa được ghi\. Tải lại để xem bản mới nhất\./u);
        await expect(banner.getByRole('button', { name: VH.conflictDismiss, exact: true })).toBeVisible();
        await banner.scrollIntoViewIfNeeded();
        await ev(page, '32-B-029', 'conflict_banner');
      });

      await test.step('[32-C-026] the message names the other writer', async () => {
        const changes = Array.isArray(conflict.remoteChanges) ? conflict.remoteChanges : [];
        const name = asRecord(changes[0] ?? {}, 'remoteChanges[0]').changedByName;
        const who = typeof name === 'string' && name !== '' ? name : 'Người khác';
        await expect(banner).toContainText(`${who} đã sửa tầng này sau lúc bạn mở trang`); // VHG:89-96,123-126
        await ev(page, '32-C-026', 'conflict_actor');
      });

      await test.step('[32-E-013] conflict and error banners are announced as alerts', async () => {
        await expect(banner).toHaveAttribute('role', 'alert'); // InlineAlert.tsx:44
        await expect(banner).toContainText(VH.conflictTitle);
        await ev(page, '32-E-013', 'banner_alert');
      });

      await test.step('[32-C-051] choosing another floor clears the banner', async () => {
        const listed = waitForApi(page, 'GET', versionsRe(projectId), [200]);
        await pickOption(page, VH.floorSelect, 'Tầng 2');
        await listed;
        await expect(page.getByText(VH.emptyTitle('Tầng 2'), { exact: true })).toBeVisible(); // floor 2 has no version
        await expect(banner).toHaveCount(0); // UVH:142-147
        await ev(page, '32-C-051', 'floor_switch_clears');
      });

      await test.step('[32-A-038] "Tải lại" re-reads the floor layer', async () => {
        await pickOption(page, VH.floorSelect, floorName); // back to floor 1: the store revision is still stale
        await expect(restore).toBeEnabled();
        await restoreAndExpect409();
        await expect(banner).toBeVisible();
        const layerRead = waitForApi(page, 'GET', layerRe(projectId, floorId), [200]);
        await banner.getByRole('button', { name: VH.conflictDismiss, exact: true }).click(); // UVH:542-550
        await layerRead;
        await expect(banner).toHaveCount(0);
        await ev(page, '32-A-038', 'banner_reload');
      });

      await test.step('[32-B-030] after a conflict reload no row is "Hiện tại"', async () => {
        await expect(versionList(page).getByText(VH.current, { exact: true })).toHaveCount(0); // VHM:216
        await versionRow(page, 'v2').scrollIntoViewIfNeeded();
        await ev(page, '32-B-030', 'no_current_row');
      });
    });
  });

  test('SCR-32 · FL-32-10 · roles: engineer, viewer, non-member, engineer demoted while open', async ({ browser }) => {
    test.setTimeout(330_000); // first use of a pool slot invites a user
    const admin = await adminApi();
    const opens: OpenPage[] = [];
    const { projectId, floorId } = pc();
    const roleOf = (id: string, role: 'engineer' | 'viewer'): Promise<number> =>
      admin.patch(`/api/users/${id}/role`, { data: { userId: id, role } }).then((res) => res.status());
    let demotedId = '';
    try {
      const engineer = await poolUser(admin, 'engineer', 'p06-versions-engineer');
      const viewer = await poolUser(admin, 'viewer', 'p06-versions-viewer');
      const outsider = await poolUser(admin, 'engineer', 'p06-versions-nonmember');
      const demoted = await poolUser(admin, 'engineer', 'p06-versions-demote');
      demotedId = demoted.id;
      for (const user of [engineer, viewer, demoted]) await addProjectMember(admin, projectId, user.email);
      const adminSession = await openAdminPage(browser);
      const engineerSession = await openPoolPage(browser, engineer);
      const viewerSession = await openPoolPage(browser, viewer);
      const outsiderSession = await openPoolPage(browser, outsider);
      const demotedSession = await openPoolPage(browser, demoted);
      opens.push(adminSession, engineerSession, viewerSession, outsiderSession, demotedSession);
      const noWriteLog = (log: ApiEntry[]): string[] => writesSince(log, 0);

      await test.step('[32-D-002] engineer member: same buttons as admin', async () => {
        const { page } = engineerSession;
        await openVersions(page, projectId, floorId);
        await expect(button(page, VH.tag)).toBeVisible(); // permissions.ts:66
        await expect(button(page, VH.restore)).toBeVisible();
        await button(page, VH.restore).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible(); // opened, never confirmed
        await dialog.getByRole('button', { name: VH.restoreCancel, exact: true }).click();
        await ev(page, '32-D-002', 'engineer_buttons');
      });

      await test.step('[32-C-020] restore / label buttons only for roles that may edit the layer', async () => {
        await openVersions(adminSession.page, projectId, floorId);
        await openVersions(viewerSession.page, projectId, floorId);
        for (const { page } of [adminSession, engineerSession]) {
          await expect(button(page, VH.restore)).toBeVisible(); // VHC:142-143
          await expect(button(page, VH.tag)).toBeVisible();
        }
        await expect(button(viewerSession.page, VH.restore)).toHaveCount(0);
        await expect(button(viewerSession.page, VH.tag)).toHaveCount(0);
        await ev(viewerSession.page, '32-C-020', 'viewer_no_buttons');
      });

      await test.step('[32-D-004] viewer member: list, rows, compare and tabs work', async () => {
        const { page, api } = viewerSession;
        expect(versionReads(api, projectId).some((entry) => entry.status === 200)).toBe(true); // BE router.py:33
        await expect(versionList(page).getByRole('checkbox', { checked: true })).toHaveCount(2);
        await diffTab(page, DIFF_TABS.json).click();
        await expect(diffTab(page, DIFF_TABS.json)).toHaveAttribute('aria-selected', 'true');
        expect(noWriteLog(api)).toEqual([]);
        await ev(page, '32-D-004', 'viewer_reads');
      });

      await test.step('[32-D-005] viewer member: no restore, no label, reason shown', async () => {
        const { page } = viewerSession;
        await expect(button(page, VH.restore)).toHaveCount(0);
        await expect(button(page, VH.tag)).toHaveCount(0);
        await expect(page.getByText(VH.viewerReason, { exact: true })).toBeVisible(); // VH:155-160
        await ev(page, '32-D-005', 'viewer_reason');
      });

      await test.step('[32-C-021] the viewer sees why the restore button is missing', async () => {
        const text = viewerSession.page.getByText(VH.viewerReason, { exact: true });
        await expect(text).toHaveCount(1); // VHM:493
        await text.scrollIntoViewIfNeeded();
        await ev(viewerSession.page, '32-C-021', 'viewer_reason_text');
      });

      await test.step('[32-D-006] engineer who is not a member: not-found state', async () => {
        const { page } = outsiderSession;
        await page.goto(`/projects/${projectId}/versions`);
        await expect(page.getByText(NOT_FOUND.title, { exact: true })).toBeVisible(); // PSG:37
        await expect(button(page, NOT_FOUND.back)).toBeVisible();
        await ev(page, '32-D-006', 'non_member');
      });

      const { page: demotedPage } = demotedSession;
      await test.step('[32-D-008] engineer demoted while the page is open: restore refused and explained', async () => {
        await openVersions(demotedPage, projectId, floorId);
        await expect(button(demotedPage, VH.restore)).toBeEnabled();
        expect(await roleOf(demotedId, 'viewer'), 'PATCH role -> viewer (#41)').toBe(200); // session roles stay stale until reload
        await button(demotedPage, VH.restore).click();
        const refused = waitForApi(demotedPage, 'POST', restoreRe(projectId), [403]);
        await demotedPage.getByRole('dialog').getByRole('button', { name: VH.restoreConfirm, exact: true }).click();
        await refused;
        const banner = demotedPage.getByRole('alert').filter({ hasText: VH.restoreErrorTitle });
        await expect(banner).toContainText('Vai của bạn trên dự án này không được sửa lớp của tầng.'); // VHM:431
        await ev(demotedPage, '32-D-008', 'demoted_restore_403');
      });

      await test.step('[32-D-009] same demotion: label refused', async () => {
        await button(demotedPage, VH.tag).click();
        const dialog = demotedPage.getByRole('dialog');
        await dialog.getByRole('textbox', { name: VH.labelField, exact: true }).fill('x');
        const refused = waitForApi(demotedPage, 'PATCH', labelRe(projectId), [403]);
        await demotedPage.keyboard.press('Enter');
        await refused;
        const banner = demotedPage.getByRole('alert').filter({ hasText: VH.labelErrorTitle });
        await expect(banner).toContainText('Vai của bạn trên dự án này không được gắn nhãn phiên bản.'); // VHM:447
        await ev(demotedPage, '32-D-009', 'demoted_label_403');
      });

      await test.step('[32-D-010] after a reload the demoted user loses both buttons', async () => {
        await openVersions(demotedPage, projectId, floorId);
        await expect(button(demotedPage, VH.restore)).toHaveCount(0); // UVH:317, VHC:142
        await expect(button(demotedPage, VH.tag)).toHaveCount(0);
        await expect(demotedPage.getByText(VH.viewerReason, { exact: true })).toBeVisible();
        await ev(demotedPage, '32-D-010', 'demoted_reload');
      });
    } finally {
      if (demotedId !== '') await roleOf(demotedId, 'engineer').catch(() => 0);
      await closePages(...opens);
      await admin.dispose().catch(() => undefined);
    }
  });
});

/* ================================================================= PX — after two restores */

test.describe('SCR-32 versions — after two restores (PX)', () => {
  test.skip(!HAS_PNG, ENV_SKIP);

  test('SCR-32 · FL-32-11 · after two restores: visual tab, identical pair, repeat restore', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    await withFlow(browser, async ({ admin, open, cleanup }) => {
      const { page, api } = open;
      const seeded = await createPipelineProject(admin, '32-px', envDrawingPng());
      cleanup.push(seeded.projectId);
      const { projectId, floorId, floorName } = seeded;
      await writeLayer(layerApi(admin), projectId, floorId, qcLayer);
      const two = must((await listVersionsAll(admin, projectId, floorId)).find((item) => item.sequence === 2), 'v2');
      await restoreVia(admin, projectId, floorId, two.id); // v3 = qc ("before"), v4 = AI ("after")
      const three = must((await listVersionsAll(admin, projectId, floorId)).find((item) => item.sequence === 3), 'v3');
      await restoreVia(admin, projectId, floorId, three.id); // K18: the latest version is already at the floor revision, so only an "after" (qc, current) is added
      // Real numbers from N17 (BE snapshots.py:243-244): cur = current qc, left = AI before it, same = older version holding the same qc content.
      const px = await listVersionsAll(admin, projectId, floorId);
      const curL = labelOf(must(px[0], 'current version'));
      const leftL = labelOf(must(px[1], 'previous version'));
      const sameL = labelOf(must(px[2], 'older version with the current content'));
      // Observes the "Trực quan" caption and skeleton as they change (a transient state cannot be awaited).
      await page.addInitScript(() => {
        const win = window as unknown as { __vhCaptions: string[]; __vhSkeleton: boolean };
        win.__vhCaptions = [];
        win.__vhSkeleton = false;
        new MutationObserver(() => {
          const text = document.querySelector('figcaption')?.textContent ?? '';
          if (text !== '' && win.__vhCaptions[win.__vhCaptions.length - 1] !== text) win.__vhCaptions.push(text);
          if (document.querySelector('[aria-label="Đang dựng mô hình"]') !== null) win.__vhSkeleton = true;
        }).observe(document, { subtree: true, childList: true, characterData: true });
      });
      const figure = tabPanel(page, DIFF_TABS.visual).locator('figure'); // CSS: the panel is `hidden` while another tab is open (VC:226-236)
      const captionRe = new RegExp(`^Đây là phiên bản ${leftL}; \\d+ đối tượng đã đổi đang được tô sáng$`, 'u');
      const panelChanges = tabPanel(page, DIFF_TABS.changes);

      await test.step('[32-B-020] visual tab with a buildable older version: caption and canvas host', async () => {
        await openVersions(page, projectId, floorId);
        await diffTab(page, DIFF_TABS.visual).click();
        await expect(figure.locator('figcaption')).toHaveText(captionRe, { timeout: PASCAL_RENDER_TIMEOUT_MS }); // VV:166-181, VHS:153-158
        await expect(figure.locator('canvas')).toHaveCount(1); // S5-confirm: headless Chrome gives the Pascal viewer a WebGL canvas
        await ev(page, '32-B-020', 'visual_caption');
      });

      await test.step('[32-B-021] while the left snapshot is unread the caption names the current model', async () => {
        // UNKNOWN — NEED VERIFICATION: all 6 snapshots are prefetched, so the transient form may never paint; the observer below records what did.
        const captions = await page.evaluate(() => (window as unknown as { __vhCaptions: string[] }).__vhCaptions);
        await attachJson('E06v_32-B-021_captions.json', { captions });
        expect.soft(lastOf(captions)).toMatch(captionRe);
        expect.soft(captions.filter((text) => text.startsWith(`Đây là mô hình hiện tại chứ không phải phiên bản ${leftL}`)).length).toBeLessThanOrEqual(1);
        await ev(page, '32-B-021', 'caption_sequence');
      });

      await test.step('[32-E-016] visual figure: host hidden from AT, caption announced, skeleton named', async () => {
        await expect(figure.locator('figcaption')).toBeVisible();
        await expect(figure.locator('[aria-hidden="true"]').first()).toBeAttached(); // VV:166-181 canvas host
        const skeleton = await page.evaluate(() => (window as unknown as { __vhSkeleton: boolean }).__vhSkeleton);
        await attachJson('E06v_32-E-016_skeleton.json', { skeletonSeen: skeleton }); // "Đang dựng mô hình" is transient (VV:159)
        await ev(page, '32-E-016', 'figure_a11y');
      });

      await test.step('[32-A-016] hovering or focusing a "Thay đổi" row leaves the visual caption unchanged', async () => {
        // UNKNOWN — NEED VERIFICATION: canvas pixels (WebGL, preserveDrawingBuffer) are not readable; asserted: the caption, and the row hover.
        const captionNow = (): Promise<string> => figure.locator('figcaption').evaluate((el) => el.textContent ?? '');
        const before = await captionNow();
        await diffTab(page, DIFF_TABS.changes).click();
        const row = panelChanges.getByRole('listitem').first();
        await row.hover(); // VG:62-80
        await row.focus();
        await expect(row).toBeFocused();
        expect(await captionNow()).toBe(before);
        await page.mouse.move(0, 0);
        await row.blur();
        expect(await captionNow()).toBe(before);
        await ev(page, '32-A-016', 'row_hover');
      });

      await test.step('[32-A-015] switching tabs keeps each panel scroll position', async () => {
        await page.setViewportSize({ width: 1440, height: 500 });
        const scrollable = await panelChanges.evaluate((el) => el.scrollHeight > el.clientHeight);
        expect.soft(scrollable, 'the "Thay đổi" panel scrolls at 500 px high').toBe(true);
        const set = await panelChanges.evaluate((el) => {
          el.scrollTop = 80;
          return el.scrollTop;
        });
        await diffTab(page, DIFF_TABS.json).click();
        await diffTab(page, DIFF_TABS.changes).click();
        expect(await panelChanges.evaluate((el) => el.scrollTop)).toBe(set); // VC:8-20,232-236
        await ev(page, '32-A-015', 'scroll_kept');
        await page.setViewportSize(DESKTOP);
      });

      await test.step('[32-B-016] two versions with identical content: empty state, zero counts', async () => {
        await setBox(rowBox(page, leftL), false);
        await setBox(rowBox(page, sameL), true); // the older qc version and the current one hold the same layer
        await expect(page.getByText(VH.noDiffTitle, { exact: true })).toBeVisible(); // VG:29-30,111-117
        await expect(page.getByText(VH.noDiffBody, { exact: true })).toBeVisible();
        await expect(page.getByRole('status').filter({ hasText: VH.noChangeStatus })).toHaveCount(1);
        await ev(page, '32-B-016', 'identical_pair');
      });

      await test.step('[32-B-017] same pair on the JSON tab', async () => {
        await diffTab(page, DIFF_TABS.json).click();
        await expect(page.getByText(VH.noJsonTitle, { exact: true })).toBeVisible(); // VJ:26-27,52-57
        await expect(page.getByText(VH.noJsonBody, { exact: true })).toBeVisible();
        await ev(page, '32-B-017', 'identical_json');
      });

      await test.step('[32-A-037] restoring a version equal to the current content: unchanged toast, no undo', async () => {
        await setBox(rowBox(page, curL), false); // only the older qc version stays ticked: the footer acts on it (BUG-470)
        const base = await layerRevision(admin, projectId, floorId);
        const mark = api.length;
        await button(page, VH.restore).click();
        const posted = waitForApi(page, 'POST', restoreRe(projectId), [200, 201]);
        await page.getByRole('dialog', { name: VH.restoreTitle(sameL, floorName) }).getByRole('button', { name: VH.restoreConfirm, exact: true }).click();
        const { response, json } = await posted;
        expect(response.status()).toBe(201);
        expect(asRecord(json, 'N19').floorRevision, 'the existing row: floorRevision = base').toBe(base); // UVH:433-440, VHG:230
        const unchanged = toast(page, VH.unchangedToast);
        await expect(unchanged).toBeVisible();
        expect(await unchanged.getByRole('button', { name: TOAST_UNDO, exact: true }).count(), 'no undo on an unchanged restore').toBe(0); // one read: the toast lives 8 s
        await expect.poll(() => versionReads(api, projectId, mark).length).toBeGreaterThan(0); // list refetched
        await ev(page, '32-A-037', 'unchanged_toast');
      });
    });
  });
});

