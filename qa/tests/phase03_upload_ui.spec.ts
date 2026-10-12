/**
 * Phase 3 — UI verify, SCR-10 floor upload (QA-03d P6): FL-U10-01 … FL-U10-04 of `flow-plan.md`. One `test()` per flow;
 * each catalog row is a `test.step` that captures one state at 1440 / 1024 / 768 / 375 through `verifyUi` (skill
 * `qa-verify-ui`: shot + layout metrics per width, `<name>.json` beside the shots). `verifyUi` re-opens the state per
 * width, so each `open` rebuilds it from the page load; row-specific measures are soft checks inside `open`.
 *
 * Users: P6 pool admin `admin:p06` owns every project (parallel-safe: own slot, no stored admin session file);
 * pool `viewer:shared` is added to one own project (FL-U10-03).
 * Mocks: only FL-U10-04 ("[mocked response]": held / 503 #24, held #6, `context.setOffline`).
 *
 * Deviations from the plan: FL-U10-02 uses a 120-char floor name (BE floors NAME_MAX 120 refuses 130) and the pool
 * admin instead of the shared admin; the removal toast (10-F-015) is shot within its 8 s window instead of under
 * `page.clock` (the shot follows the click directly).
 *
 * Real-backend budget per run: logins 3 per flow (+0) = 12; `POST /api/projects` 1 + 4 (10-F-011, one fresh project per
 * width so the name match has a free floor) + 1 + 1 + 1 = 8, all deleted; upload inits by admin:p06: 10-F-011 4,
 * 10-F-013 4 (422 CAD), 10-F-019 2, FL-U10-03 seed 1, 10-F-010 4 (chunk held) = 15.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson, captureEvidence } from './support/evidence';
import {
  UP,
  assignFromTray,
  badge,
  card,
  chunkRe,
  closeSession,
  dwgFile,
  fireDrag,
  floorAt,
  floorIds,
  fulfillJson,
  holdRequests,
  openCardMenu,
  openPool,
  openUpload,
  pathname,
  pickFiles,
  pngFile,
  projectReadPath,
  textFile,
  threePagePdf,
  tray,
  trayItem,
  withPoolOwner,
  type Hold,
  type Session,
} from './support/p03/P6';
import { addProjectMember, createDrawingProject, createProject, deleteSeededProject, envDrawingPng, poolUser } from './support/phase03Seed';
import { UI_VIEWPORTS, verifyUi, type UiMetrics } from './support/ui-verify';

const CAD_SENTENCE = 'Bản vẽ CAD (.dwg) chưa được hỗ trợ; hãy xuất sang PDF rồi tải lại.'; // FUG:85
const ATTACH_MS = 60_000;
const png = (name: string) => pngFile(name, envDrawingPng());
const width = (page: Page): number => page.viewportSize()?.width ?? 0;
/** "H" rows: the state must have opened at every width (verifyUi itself only fails softly). */
const opened = (all: readonly UiMetrics[]): void => {
  expect(all.filter((m) => m.openError !== undefined).map((m) => `${m.viewport}: ${m.openError ?? ''}`)).toEqual([]);
};
const boxOf = async (page: Page, selector: string): Promise<{ x: number; y: number; width: number; height: number } | null> =>
  page.locator(selector).first().boundingBox();

/* ================================================================= FL-U10-01 */

test('SCR-10 · FL-U10-01 · upload states on a two-floor project at four widths', async ({ browser }) => {
  test.setTimeout(420_000);
  await withPoolOwner(browser, '10-f-009', 2, async ({ session, project, ownerApi }) => {
    const { page } = session;
    const pid = project.projectId;
    const ids = floorIds(project);
    const [f1, f2] = [floorAt(project, 0), floorAt(project, 1)];
    const extra: string[] = [];
    try {
      await test.step('[10-F-009] empty invitation ×4 (sentence absent below 1024, see 10-F-023)', async () => {
        const shown: Record<number, boolean> = {};
        opened(
          await verifyUi(page, 'U03_10-F-009_empty', async (p) => {
            await openUpload(p, pid, ids);
            shown[width(p)] = await p.getByText(UP.empty, { exact: true }).isVisible();
            if (width(p) >= 1024) await expect.soft(p.getByText(UP.empty, { exact: true })).toBeVisible();
          }),
        );
        await attachJson('U03_10-F-009_invitation_by_width.json', shown);
      });

      await test.step('[10-F-018] dragenter → drag-active drop zone ×4; zone box identical before/after', async () => {
        const moved: string[] = [];
        await verifyUi(page, 'U03_10-F-018_drag_active', async (p) => {
          await openUpload(p, pid, ids);
          const zone = p.getByTestId(UP.dropzone);
          const before = await zone.boundingBox();
          await fireDrag(zone, 'dragenter');
          await expect(zone).toHaveAttribute('data-drag-active', 'true');
          const after = await zone.boundingBox();
          if (JSON.stringify(before) !== JSON.stringify(after)) moved.push(`${String(width(p))}: ${JSON.stringify({ before, after })}`);
        });
        expect.soft(moved, 'FUD ZONE_BOX_CLASSES: colour only, the box never moves').toEqual([]);
      });

      await test.step('[10-F-011] tang-2.png → auto-matched card (attention badge + hint) ×4', async () => {
        opened(
          await verifyUi(page, 'U03_10-F-011_auto_matched', async (p) => {
            const fresh = await createProject(ownerApi, '10-f-011', 2); // a free "Tầng 2" per width
            extra.push(fresh.projectId);
            await openUpload(p, fresh.projectId, floorIds(fresh));
            await pickFiles(p, [png('tang-2.png')]);
            const second = card(p, floorAt(fresh, 1).id);
            await expect(badge(second, UP.attached)).toBeVisible({ timeout: ATTACH_MS });
            await expect(second.getByText(UP.autoMatch, { exact: true })).toBeVisible();
          }),
        );
      });

      await test.step('[10-F-012] 3-page PDF → Tầng 1: "Gán cho tầng khác" + "Chọn trang" ×4; 220 px column full-width when collapsed', async () => {
        const columns: Record<number, { column: number; inner: number }> = {};
        opened(
          await verifyUi(page, 'U03_10-F-012_pdf_card', async (p) => {
            await openUpload(p, pid, ids);
            await pickFiles(p, [threePagePdf('ba-trang.pdf')]);
            await assignFromTray(p, 'ba-trang.pdf', f1.name);
            const c = card(p, f1.id);
            await expect(c.getByRole('combobox', { name: UP.assign })).toBeVisible();
            await expect(c.getByRole('combobox', { name: UP.pickPage })).toBeVisible();
            const m = await c.evaluate((li) => {
              const col = li.querySelector(':scope > div.flex-col.gap-2');
              const s = getComputedStyle(li);
              return {
                column: col?.getBoundingClientRect().width ?? 0,
                inner: li.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight),
              };
            });
            columns[width(p)] = m;
            if (width(p) >= 1024) expect.soft(Math.round(m.column), `${String(width(p))}: FUC w-[220px]`).toBe(220);
            else expect.soft(Math.abs(m.column - m.inner), `${String(width(p))}: collapsed column spans the card`).toBeLessThanOrEqual(1);
          }),
        );
        await attachJson('U03_10-F-012_column_widths.json', columns);
      });

      await test.step('[10-F-014] "Tuỳ chọn của tầng Tầng 2" menu open ×4; 180 px menu not clipped at 375', async () => {
        const verifyMenuBoxes: { width: number; box: unknown }[] = [];
        await verifyUi(page, 'U03_10-F-014_card_menu', async (p) => {
          await openUpload(p, pid, ids);
          await pickFiles(p, [threePagePdf('menu.pdf')]);
          await assignFromTray(p, 'menu.pdf', f2.name);
          const c = await openCardMenu(p, f2.id, f2.name);
          const menu = c.locator('div.absolute.z-10');
          await expect(menu).toBeVisible();
          const box = await menu.boundingBox();
          verifyMenuBoxes.push({ width: width(p), box });
          if (box !== null) {
            expect.soft(box.x, `${String(width(p))}: menu left edge on screen`).toBeGreaterThanOrEqual(0);
            expect.soft(box.x + box.width, `${String(width(p))}: menu right edge on screen`).toBeLessThanOrEqual(width(p));
          }
        });
        await attachJson('U03_10-F-014_menu_boxes.json', { boxes: verifyMenuBoxes });
      });

      await test.step('[10-E-016] tray trash and card "Tuỳ chọn" IconButtons ≥ 24×24 at every width', async () => {
        const sizes: string[] = [];
        await verifyUi(page, 'U03_10-E-016_icon_targets', async (p) => {
          await openUpload(p, pid, ids);
          await pickFiles(p, [textFile('ghi-chu.txt'), threePagePdf('chon-trang.pdf')]);
          await assignFromTray(p, 'chon-trang.pdf', f2.name);
          for (const target of [
            tray(p).getByRole('button', { name: 'Xoá bản vẽ ghi-chu.txt', exact: true }),
            card(p, f2.id).getByRole('button', { name: `Tuỳ chọn của tầng ${f2.name}`, exact: true }),
          ]) {
            const b = await target.boundingBox();
            const label = `${String(width(p))} ${(await target.getAttribute('aria-label')) ?? ''}: ${String(b?.width)}×${String(b?.height)}`;
            sizes.push(label);
            expect.soft((b?.width ?? 0) >= 24 && (b?.height ?? 0) >= 24, label).toBe(true);
          }
        });
        await attachJson('U03_10-E-016_target_sizes.json', { sizes });
      });

      await test.step('[10-F-015] trash ghi-chu.txt → toast "Đã xoá bản vẽ ghi-chu.txt" + "Hoàn tác" ×4; 320 px toast fits at 375', async () => {
        await verifyUi(page, 'U03_10-F-015_removal_toast', async (p) => {
          await openUpload(p, pid, ids);
          await pickFiles(p, [textFile('ghi-chu.txt')]);
          await tray(p).getByRole('button', { name: 'Xoá bản vẽ ghi-chu.txt', exact: true }).click();
          const toast = p.getByRole('status').filter({ hasText: 'Đã xoá bản vẽ ghi-chu.txt' });
          await expect(toast.getByRole('button', { name: UP.undo, exact: true })).toBeVisible();
          const box = await toast.boundingBox();
          expect.soft((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= width(p), `${String(width(p))}: toast on screen ${JSON.stringify(box)}`).toBe(true);
        });
      });

      await test.step('[10-F-013] ban-ve.dwg → Tầng 1: CAD 422 alert inside the card ×4; alert spans the card', async () => {
        opened(
          await verifyUi(page, 'U03_10-F-013_cad_error', async (p) => {
            await openUpload(p, pid, ids);
            await pickFiles(p, [dwgFile('ban-ve.dwg')]);
            await assignFromTray(p, 'ban-ve.dwg', f1.name);
            const c = card(p, f1.id);
            const alert = c.getByRole('alert');
            await expect(alert).toContainText(CAD_SENTENCE, { timeout: 30_000 });
            const m = await c.evaluate((li) => {
              const a = li.querySelector('[role="alert"]');
              const s = getComputedStyle(li);
              return { alert: a?.getBoundingClientRect().width ?? 0, inner: li.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) };
            });
            expect.soft(Math.abs(m.alert - m.inner), `${String(width(p))}: alert spans the card ${JSON.stringify(m)}`).toBeLessThanOrEqual(1);
          }),
        );
      });

      await test.step('[10-F-019] every floor attached → "2 / 2 tầng đã có bản vẽ" ×4', async () => {
        opened(
          await verifyUi(page, 'U03_10-F-019_all_attached', async (p) => {
            await openUpload(p, pid, ids);
            // First width uploads both floors; later widths read them back from the server (FU success state).
            if (!(await badge(card(p, f1.id), UP.attached).isVisible())) {
              await pickFiles(p, [png('ban-ve-a.png'), png('ban-ve-b.png')]);
              await assignFromTray(p, 'ban-ve-a.png', f1.name);
              await assignFromTray(p, 'ban-ve-b.png', f2.name);
            }
            for (const id of ids) await expect(badge(card(p, id), UP.attached)).toBeVisible({ timeout: ATTACH_MS });
            await expect(p.getByTestId(UP.counter)).toHaveText('2 / 2 tầng đã có bản vẽ');
          }),
        );
      });
    } finally {
      for (const id of extra) await deleteSeededProject(ownerApi, id);
    }
  });
});
/* ================================================================= FL-U10-02 */

test('SCR-10 · FL-U10-02 · long names and a long floor list at four widths', async ({ browser }) => {
  test.setTimeout(240_000);
  // BE floors/schemas.py NAME_MAX 120: the longest floor name that exists (the plan's 130 is refused).
  const longFloor = `Tầng 6 ${'khu văn phòng điều hành phía đông '.repeat(4)}`.slice(0, 119) + 'A';
  const longFile = `${'banvematbangkhuvanphongdieuhanhphiadong'.repeat(4)}`.slice(0, 126) + '.png';
  await withPoolOwner(browser, '10-b-042', ['Tầng 1', 'Tầng 2', 'Tầng 3', 'Tầng 4', 'Tầng 5', longFloor], async ({ session, project }) => {
    const { page } = session;
    const pid = project.projectId;
    const ids = floorIds(project);
    const last = floorAt(project, 5);
    const openLong = async (p: Page): Promise<void> => {
      await openUpload(p, pid, ids);
      await pickFiles(p, [pngFile(longFile, Buffer.from('qa'))]);
      await expect(trayItem(p, longFile.slice(0, 20))).toBeVisible();
    };

    await test.step('[10-B-042] floor h3 and the file summary line truncate (ellipsis); trash and menu stay on screen', async () => {
      await openLong(page);
      const cut = async (selector: string, scope: ReturnType<typeof card>): Promise<{ wide: boolean; ellipsis: boolean }> =>
        scope.locator(selector).first().evaluate((el) => ({ wide: el.scrollWidth > el.clientWidth, ellipsis: getComputedStyle(el).textOverflow === 'ellipsis' }));
      const h3 = await cut('h3', card(page, last.id));
      const line = await cut('p.truncate', tray(page));
      await attachJson('E03_10-B-042_truncation.json', { h3, line });
      expect(h3, 'FUC h3.truncate').toEqual({ wide: true, ellipsis: true });
      expect(line, 'FUT summary p.truncate').toEqual({ wide: true, ellipsis: true });
      const trash = await tray(page).getByRole('button', { name: `Xoá bản vẽ ${longFile}`, exact: true }).boundingBox();
      expect(trash !== null && trash.x + trash.width <= width(page), `trash on screen ${JSON.stringify(trash)}`).toBe(true);
      await captureEvidence(page, 'E03_10-B-042_long_names.png', { fullPage: true });
    });

    await test.step('[10-F-020] long floor + file names ×4: truncation, no horizontal overflow', async () => {
      await verifyUi(page, 'U03_10-F-020_long_names', openLong);
    });

    await test.step('[10-F-024] at 768 and 375, scrolled to the end, the sticky footer never covers the last card or tray controls', async () => {
      const covered: string[] = [];
      await verifyUi(
        page,
        'U03_10-F-024_sticky_footer',
        async (p) => {
          await openLong(p);
          await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await p.waitForTimeout(300);
          const targets = [
            card(p, last.id).locator('h3'),
            tray(p).getByRole('combobox', { name: UP.assign }),
            tray(p).getByRole('button', { name: `Xoá bản vẽ ${longFile}`, exact: true }),
          ];
          for (const t of targets) {
            const hit = await t.evaluate((el) => {
              const r = el.getBoundingClientRect();
              const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return top !== null && (el === top || el.contains(top));
            });
            if (!hit) covered.push(`${String(width(p))}: ${await t.evaluate((el) => el.outerHTML.slice(0, 80))}`);
          }
        },
        UI_VIEWPORTS.filter((v) => v.width === 768 || v.width === 375),
        { fullPage: false },
      );
      expect.soft(covered, 'FUF sticky bottom-0 covers nothing at the end of the page').toEqual([]);
    });
  });
});

/* ================================================================= FL-U10-03 */

test('SCR-10 · FL-U10-03 · viewer read-only at four widths', async ({ browser }) => {
  test.setTimeout(180_000);
  await withPoolOwner(browser, '10-f-017', 0, async ({ admin, ownerApi }) => {
    const viewer = await poolUser(admin, 'viewer');
    const drawn = await createDrawingProject(ownerApi, '10-f-017', envDrawingPng(), ['Tầng 1']);
    let session: Session | undefined;
    try {
      await addProjectMember(ownerApi, drawn.projectId, viewer.email);
      const viewerSession = await openPool(browser, viewer);
      session = viewerSession;
      await test.step('[10-F-017] read-only line ×4, no drop zone', async () => {
        opened(
          await verifyUi(viewerSession.page, 'U03_10-F-017_viewer_read_only', async (p) => {
            await openUpload(p, drawn.projectId, [drawn.floorId]);
            await expect(p.getByText(UP.readOnly, { exact: true })).toBeVisible();
            await expect(p.getByTestId(UP.dropzone)).toHaveCount(0);
          }),
        );
      });
    } finally {
      await closeSession(session);
      await deleteSeededProject(ownerApi, drawn.projectId);
    }
  });
});

/* ================================================================= FL-U10-04 */

test('SCR-10 · FL-U10-04 · [mocked response] loading, load error, uploading, offline at four widths', async ({ browser }) => {
  test.setTimeout(480_000);
  await withPoolOwner(browser, '10-f-007', 1, async ({ session, project }) => {
    const { context, page } = session;
    const pid = project.projectId;
    const ids = floorIds(project);
    const f1 = floorAt(project, 0);
    const readPath = projectReadPath(pid);
    let hold: Hold | undefined;
    const releaseHold = async (): Promise<void> => {
      await hold?.release('abort');
      hold = undefined;
    };

    try {
      await test.step('[10-F-007] GET held → loading skeleton ×4', async () => {
        opened(
          await verifyUi(page, 'U03_10-F-007_loading', async (p) => {
            await releaseHold();
            hold = await holdRequests(p, (r) => r.method() === 'GET' && pathname(r) === readPath);
            await p.goto(ROUTES.project.upload(pid));
            await hold.seen();
            await expect(p.locator('.animate-pulse.w-8')).toHaveCount(3);
          }),
        );
        await releaseHold();
      });

      await test.step('[10-F-008] GET 503 ×4 → load error with "Thử lại" ×4', async () => {
        const matcher = (url: URL): boolean => url.pathname === readPath;
        await page.route(matcher, (route) =>
          route.request().method() === 'GET' ? fulfillJson(route, 503, { code: 'SERVICE_UNAVAILABLE', requestId: 'qa-p06-mock' }) : route.fallback(),
        );
        try {
          await verifyUi(page, 'U03_10-F-008_load_error', async (p) => {
            await p.goto(ROUTES.project.upload(pid));
            const alert = p.getByRole('alert').filter({ hasText: UP.loadError });
            await expect(alert).toBeVisible({ timeout: 60_000 });
            // run-33-P6: a 503 after the transport retries comes back without "Thử lại" (app-bug candidate, see FL-10-16).
            await expect.soft(alert.getByRole('button', { name: UP.retry, exact: true }), `${String(p.viewportSize()?.width)}: "Thử lại"`).toBeVisible({ timeout: 1_000 });
          });
        } finally {
          await page.unroute(matcher);
        }
      });

      await test.step('[10-F-010] PNG on Tầng 1 with its chunk held → "Đang tải lên" card with rail ×4', async () => {
        await verifyUi(page, 'U03_10-F-010_uploading', async (p) => {
          await releaseHold();
          await openUpload(p, pid, ids);
          hold = await holdRequests(p, (r) => r.method() === 'POST' && chunkRe.test(pathname(r)));
          await pickFiles(p, [png('ban-ve.png')]);
          await assignFromTray(p, 'ban-ve.png', f1.name);
          await hold.seen();
          await expect(badge(card(p, f1.id), UP.uploading)).toBeVisible();
          await expect(card(p, f1.id).getByRole('progressbar')).toHaveCount(1);
        });
        await releaseHold();
      });

      await test.step('[10-F-016] offline → banner "Đang làm việc ngoại tuyến" ×4', async () => {
        await verifyUi(page, 'U03_10-F-016_offline', async (p) => {
          await context.setOffline(false);
          await openUpload(p, pid, ids);
          await context.setOffline(true);
          await expect(p.getByText(UP.offline, { exact: true })).toBeVisible();
        });
      });
    } finally {
      await releaseHold();
      await context.setOffline(false);
    }
  });
});
