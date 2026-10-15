/**
 * Phase 3 — SCR-09 Floor Manager, dedicated UI-verification flows (skill `qa-verify-ui`; QA-03d P4, flow-plan.md
 * "phase03_floors_ui.spec.ts"). One test per flow, one `test.step('[<row id>] …')` per catalog row; each state is shot at
 * 1440 / 1024 / 768 / 375 by `verifyUi` (`U03_<row id>_<slug>_<width>.png` + `.json`), extra measurements as JSON.
 *
 * Source (FE @ c16f2428): FM src/screens/qc/FloorManager/FloorManager.tsx · FT …/FloorTable.tsx · FTR …/FloorTableRow.tsx
 * · FSC …/FloorSectionCut.tsx · UFM …/useFloorManager.ts · FMG …/floorManagerGateway.ts (toast copy) · PSGATE copy.
 *
 * Data: own projects through the real API (`phase03Seed.ts`), deleted in `finally`. FL-U09-05 needs a finished run, so a
 * pool engineer in its OWN slot (`p4_floors_ui`, own drawings_init bucket) creates the project and uploads the env PNG.
 * Mock: FL-U09-03 only ("[mocked response]": GET floors 500; the held GET is the real request, delayed).
 * Deviation: the plan's `page.clock.install` for the toast state is not used — the undo toast lives 8 s (A8), longer
 * than one capture; the toast/"Thêm tầng" overlap is measured right after the toast shows, at every width.
 *
 * Budget per run: logins 6 API (admin `signedInApi` once per flow ×5, the engineer once) + 2 browser (`signInPoolUser`:
 * viewer, engineer) + 3 admin browser logins (U09-01/03/04; own context, no shared session file);
 * `POST /api/auth/refresh` ≈ 1 per page load (≈ 50); `POST /api/projects` 5 (+5 DELETE); `POST …/members` 1;
 * floor writes: 1 + 1 PATCH (setup), 4 POST floors ("Thêm tầng" at each width); 1 upload (init/chunks/complete) + one
 * fake-ML run by the engineer. Invitations: 0, or 1 when the `engineer:p4_floors_ui` pool slot is empty.
 */
import { expect, test, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { attachJson, captureEvidence } from './support/evidence';
import {
  addProjectMember,
  createPipelineDrawingProject,
  createProject,
  deleteSeededProject,
  envDrawingPng,
  poolUser,
} from './support/phase03Seed';
import { adminApi, closePage, errorBody, floorRow, floorRows, holdFirst, openAdminPage, openPoolPage, patchFloor, unknownProjectId, type OpenPage } from './support/p03/P4';
import { UI_VIEWPORTS, verifyUi } from './support/ui-verify';

const SECTION_REGION = 'Lát cắt các tầng theo đúng tỷ lệ chiều cao'; // FSC
const ELEVATION_SCALE = 'Thang cao độ'; // FSC
const COLLAPSE = 'Thu gọn lát cắt';
const EXPAND = 'Hiện lát cắt';
const AUTO_ELEVATION = 'Tự động tính cao độ';
const CAPTION_AUTO = 'Cao độ tính tự động từ chiều cao các tầng dưới.'; // FT:82
const REFUSED_MARK = 'Chưa đặt được'; // FTR ELEVATION_REFUSED_LABEL
const ADD_FLOOR = 'Thêm tầng';
const ADD_TOAST = 'Đã thêm tầng.'; // FMG:594
const FLOOR_LIST_ERROR = 'Không đọc được danh sách tầng'; // FT:77
const NOT_FOUND_TITLE = 'Không tìm thấy dự án này'; // PSGATE:37
const FORBIDDEN_TITLE = 'Không có quyền sửa tầng'; // FM:76
/** ui-verify.ts TARGET_PX: 24 px, a TEXT button 44 px below 640 px; icon-only buttons stay at 24. */
const TARGET = { min: 24, textBelowSm: 44, sm: 640 } as const;

type Box = { x: number; y: number; width: number; height: number } | null;
const intersects = (a: Box, b: Box): boolean =>
  a !== null && b !== null && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function openFloors(page: Page, projectId: string, rows: number): Promise<void> {
  await page.goto(ROUTES.project.floors(projectId));
  await expect(floorRows(page)).toHaveCount(rows);
}

test.describe('SCR-09 floors — UI verify', () => {
  test('SCR-09 · FL-U09-01 · Editor states: override geometry, auto ON, refusal strip, toast, target size, not found', async ({ browser }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    let projectId = '';
    try {
      const project = await createProject(admin, 'u09-01', 3);
      projectId = project.projectId;
      const [, middle, top] = project.floors;
      if (middle === undefined || top === undefined) throw new Error('seed: fewer than 3 floors');
      await patchFloor(admin, projectId, top.id, { elevationMm: 7_000 }); // override: 1 m gap under the top floor
      open = await openAdminPage(browser);
      const { page } = open;
      let rows = 3;

      await test.step('[09-C-030] section cut: band height ∝ floor height, override gap under the top band, a tick per elevation + top', async () => {
        const geometry: Record<string, unknown>[] = [];
        await verifyUi(page, 'U03_09-C-030_section_cut', async (p) => {
          await openFloors(p, projectId, rows);
          const section = p.getByRole('region', { name: SECTION_REGION, exact: true });
          await expect(section).toBeVisible();
          geometry.push({
            viewport: `${String(p.viewportSize()?.width)}`,
            ...(await section.evaluate((root, scaleLabel) => {
              const bands = [...root.querySelectorAll<HTMLElement>('[role="button"][aria-pressed]')];
              return {
                bands: bands.map((band) => ({
                  label: band.getAttribute('aria-label'),
                  height: Math.round(band.getBoundingClientRect().height),
                  gapBelow: Math.round((band.previousElementSibling?.getBoundingClientRect().height ?? 0) * 10) / 10,
                })),
                ticks: [...(root.querySelector(`[aria-label="${scaleLabel}"]`)?.children ?? [])].map((tick) => tick.textContent?.trim() ?? ''),
              };
            }, ELEVATION_SCALE)),
          });
        });
        await attachJson('U03_09-C-030_section_geometry.json', { geometry });
        const desktop = geometry[0] as { bands: { height: number; gapBelow: number }[]; ticks: string[] } | undefined;
        const heights = desktop?.bands.map((band) => band.height) ?? [];
        expect.soft(Math.max(...heights) - Math.min(...heights), '1440: three 3 m floors → equal band heights (±2 px)').toBeLessThanOrEqual(2);
        // `flex-col-reverse`: DOM order is bottom-up, so the last band is the top floor and its gap sits below it.
        expect.soft(desktop?.bands.at(-1)?.gapBelow ?? 0, '1440: the override draws a gap under the top band').toBeGreaterThan(0);
        expect.soft(desktop?.bands.slice(0, -1).every((band) => band.gapBelow === 0), '1440: no gap under the stacked floors').toBe(true);
        expect.soft(desktop?.ticks.length ?? 0, '1440: ticks 0 / 3 / 7 m + stack top 10 m').toBe(4);
      });

      await test.step('[09-E-015] grip, kebab, "Tải lên", "Thu gọn lát cắt", "Hiện lát cắt" meet the target size at each width', async () => {
        const sizes: { viewport: number; control: string; width: number; height: number; threshold: number }[] = [];
        const first = project.floors[0]?.name ?? '';
        for (const vp of UI_VIEWPORTS) {
          await page.setViewportSize(vp);
          await openFloors(page, projectId, rows);
          const textMin = vp.width < TARGET.sm ? TARGET.textBelowSm : TARGET.min;
          const controls = [
            { control: 'grip', locator: page.getByRole('button', { name: `Đổi thứ tự tầng ${first}`, exact: true }), threshold: TARGET.min },
            { control: 'kebab', locator: page.getByRole('button', { name: `Thao tác khác cho tầng ${first}`, exact: true }), threshold: TARGET.min },
            { control: 'Tải lên', locator: page.getByRole('button', { name: 'Tải lên', exact: true }).first(), threshold: textMin },
            { control: COLLAPSE, locator: page.getByRole('button', { name: COLLAPSE, exact: true }), threshold: textMin },
          ];
          for (const c of controls) {
            const box = await c.locator.boundingBox();
            sizes.push({ viewport: vp.width, control: c.control, width: Math.round(box?.width ?? 0), height: Math.round(box?.height ?? 0), threshold: c.threshold });
          }
          await page.getByRole('button', { name: COLLAPSE, exact: true }).click();
          const expand = page.getByRole('button', { name: EXPAND, exact: true });
          const box = await expand.boundingBox();
          sizes.push({ viewport: vp.width, control: EXPAND, width: Math.round(box?.width ?? 0), height: Math.round(box?.height ?? 0), threshold: textMin });
        }
        await page.setViewportSize(UI_VIEWPORTS[0]);
        await attachJson('U03_09-E-015_targets.json', { sizes });
        const small = sizes.filter((s) => s.width < s.threshold || s.height < s.threshold);
        expect.soft(small, 'controls under the target size').toEqual([]);
      });

      await test.step('[09-F-009] "Tự động tính cao độ" ON: text elevations + the auto caption', async () => {
        await verifyUi(page, 'U03_09-F-009_auto_elevation_on', async (p) => {
          await openFloors(p, projectId, rows);
          await p.getByRole('switch', { name: AUTO_ELEVATION, exact: true }).click();
          await expect(p.getByText(CAPTION_AUTO, { exact: true })).toBeVisible();
          await expect(p.getByRole('textbox', { name: /^Cao độ tầng /u })).toHaveCount(0);
        });
      });

      await test.step('[09-F-010] elevation refusal strip + "Chưa đặt được"; the long strip wraps at 375 px', async () => {
        const strips: Record<string, unknown>[] = [];
        await verifyUi(page, 'U03_09-F-010_elevation_refused', async (p) => {
          await openFloors(p, projectId, rows);
          const elevation = p.getByRole('textbox', { name: `Cao độ tầng ${middle.name}`, exact: true });
          await elevation.focus();
          await elevation.press('ArrowDown'); // 2 m: into "Tầng 1" (0–3 m) → findElevationConflict (UFM:1224-1232), no PATCH
          await elevation.blur();
          await expect(p.getByText(REFUSED_MARK, { exact: true })).toBeVisible();
          // The violation InlineAlert (FM:181-185, role=status, no title); not the session strip, not the announcer region.
          const strip = p.locator('[role="status"]:not([data-announcer])').filter({ hasText: /Tầng/u }).filter({ hasNotText: 'Một số thay đổi' }).first();
          await expect(strip).toBeVisible();
          strips.push({ viewport: p.viewportSize()?.width, text: await strip.innerText(), box: await strip.boundingBox() });
        });
        await attachJson('U03_09-F-010_strip.json', { strips });
      });

      await test.step('[09-F-016] undo toast over the table: it does not hide "Thêm tầng" at 375 px', async () => {
        const overlaps: { viewport: number | undefined; toast: Box; add: Box; overlap: boolean }[] = [];
        await verifyUi(page, 'U03_09-F-016_undo_toast', async (p) => {
          await openFloors(p, projectId, rows);
          const post = p.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/projects/${projectId}/floors`);
          await p.getByRole('button', { name: ADD_FLOOR, exact: true }).click();
          expect((await post).status(), 'POST floors').toBe(201);
          rows += 1;
          const toast = p.getByRole('status').filter({ hasText: ADD_TOAST }).first();
          await expect(toast).toBeVisible();
          const [toastBox, addBox] = [await toast.boundingBox(), await p.getByRole('button', { name: ADD_FLOOR, exact: true }).boundingBox()];
          overlaps.push({ viewport: p.viewportSize()?.width, toast: toastBox, add: addBox, overlap: intersects(toastBox, addBox) });
        });
        await attachJson('U03_09-F-016_toast_overlap.json', { overlaps });
        expect.soft(overlaps.filter((o) => o.overlap).map((o) => o.viewport), 'widths where the toast covers "Thêm tầng"').toEqual([]);
      });

      await test.step('[09-F-013] unknown project → not-found alert "Không tìm thấy dự án này"', async () => {
        const unknown = unknownProjectId();
        await verifyUi(page, 'U03_09-F-013_not_found', async (p) => {
          await p.goto(ROUTES.project.floors(unknown));
          await expect(p.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE })).toBeVisible();
        });
      });
    } finally {
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-09 · FL-U09-02 · Viewer read-only screen with banner', async ({ browser }) => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    let projectId = '';
    try {
      const project = await createProject(admin, 'u09-02', 2);
      projectId = project.projectId;
      const viewer = await poolUser(admin, 'viewer');
      await addProjectMember(admin, projectId, viewer.email);
      open = await openPoolPage(browser, viewer);

      await test.step('[09-F-014] read-only table + banner "Không có quyền sửa tầng"', async () => {
        await verifyUi(open!.page, 'U03_09-F-014_viewer_readonly', async (p) => {
          await openFloors(p, projectId, 2);
          await expect(p.getByRole('heading', { name: FORBIDDEN_TITLE, exact: true })).toBeVisible();
          await expect(p.getByRole('button', { name: ADD_FLOOR, exact: true })).toHaveCount(0);
        });
      });
    } finally {
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-09 · FL-U09-03 · [mocked response] Loading skeleton and load error', async ({ browser }) => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    let projectId = '';
    try {
      const project = await createProject(admin, 'u09-03', 2);
      projectId = project.projectId;
      open = await openAdminPage(browser);
      const { page } = open;
      const listPath = `/api/projects/${projectId}/floors`;

      await test.step('[09-F-011] loading skeleton (held GET floors)', async () => {
        let release: (() => Promise<void>) | null = null;
        try {
          await verifyUi(page, 'U03_09-F-011_loading', async (p) => {
            if (release !== null) await release();
            const hold = await holdFirst(p, (url, method) => method === 'GET' && url.pathname === listPath);
            release = hold.release;
            await p.goto(ROUTES.project.floors(projectId));
            await hold.seen;
            await expect(p.getByRole('table').locator('tbody tr')).toHaveCount(4);
          });
        } finally {
          if (release !== null) await (release as () => Promise<void>)();
        }
      });

      await test.step('[09-F-012] load error alert "Không đọc được danh sách tầng" + "Thử lại"', async () => {
        const handler = async (route: Route): Promise<void> => {
          if (route.request().method() !== 'GET') return route.fallback();
          await route.fulfill({ status: 500, contentType: 'application/json', body: errorBody('INTERNAL') });
        };
        const matcher = (url: URL): boolean => url.pathname === listPath;
        await page.route(matcher, handler);
        try {
          await verifyUi(page, 'U03_09-F-012_load_error', async (p) => {
            await p.goto(ROUTES.project.floors(projectId));
            const alert = p.getByRole('alert').filter({ hasText: FLOOR_LIST_ERROR });
            await expect(alert).toBeVisible();
            await expect(alert.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible();
          });
        } finally {
          await page.unroute(matcher, handler);
        }
      });
    } finally {
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-09 · FL-U09-04 · 50 floors with a 120-character name', async ({ browser }) => {
    test.setTimeout(150_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    let projectId = '';
    try {
      const project = await createProject(admin, 'u09-04', 50);
      projectId = project.projectId;
      const target = project.floors[49];
      if (target === undefined) throw new Error('seed: fewer than 50 floors');
      const longName = `Tầng mái kỹ thuật ${'dài '.repeat(40)}`.slice(0, 120);
      await patchFloor(admin, projectId, target.id, { name: longName });
      open = await openAdminPage(browser);

      await test.step('[09-F-017] long name truncated, the table scrolls inside its frame, no page overflow', async () => {
        const frames: Record<string, unknown>[] = [];
        await verifyUi(open!.page, 'U03_09-F-017_fifty_floors_long_name', async (p) => {
          await openFloors(p, projectId, 50);
          const nameInput = p.getByRole('textbox', { name: `Tên tầng ${longName}`, exact: true });
          await expect(nameInput).toHaveValue(longName);
          const frame = p.getByRole('table').locator('xpath=ancestor::div[contains(@class,"overflow-auto")][1]');
          frames.push({
            viewport: p.viewportSize()?.width,
            frame: await frame.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })),
            nameInput: await nameInput.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })),
            longRowLabel: (await floorRow(p, longName).getAttribute('aria-label'))?.length ?? 0,
          });
        });
        await attachJson('U03_09-F-017_frames.json', { frames });
        for (const f of frames as { viewport: number; frame: { scrollHeight: number; clientHeight: number }; nameInput: { scrollWidth: number; clientWidth: number } }[]) {
          expect.soft(f.nameInput.scrollWidth, `${String(f.viewport)}: the 120-char name is cut inside its field`).toBeGreaterThan(f.nameInput.clientWidth);
          expect.soft(f.frame.scrollHeight, `${String(f.viewport)}: 50 rows scroll inside the table frame`).toBeGreaterThan(f.frame.clientHeight);
        }
      });
    } finally {
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-09 · FL-U09-05 · Floors with drawings after a finished run', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 180_000);
    const admin = await adminApi();
    const engineer = await poolUser(admin, 'engineer', 'p4_floors_ui');
    await admin.dispose();
    const engApi = await signedInApi(engineer.email, engineer.password);
    let open: OpenPage | undefined;
    let projectId = '';
    try {
      const seeded = await createPipelineDrawingProject(engApi, 'u09-05', envDrawingPng());
      projectId = seeded.projectId;
      open = await openPoolPage(browser, engineer);

      await test.step('[09-F-015] floor row with "1 bản vẽ", wall/room counts, area m², QC % bar, verified badge', async () => {
        const rowsText: string[] = [];
        await verifyUi(open!.page, 'U03_09-F-015_floors_with_drawing', async (p) => {
          await openFloors(p, projectId, 1);
          const row = floorRow(p, seeded.floorName);
          await expect(row).toContainText('1 bản vẽ');
          rowsText.push(await row.innerText());
        });
        await attachJson('U03_09-F-015_row_text.json', { rowsText });
        expect.soft(rowsText[0] ?? '', '1440: QC progress shown as a percentage').toMatch(/\d+\s*%/u);
        expect.soft(rowsText[0] ?? '', '1440: area in m²').toMatch(/m²/u);
      });
    } finally {
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(engApi, projectId);
      await engApi.dispose();
    }
  });
});
