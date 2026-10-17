/**
 * Phase 11 — SCR-09 Floor Manager, FL-11F-03 (QA-11 pack P3): delete a floor, undo, delete again, restore-window expiry.
 * One test, one admin, one own project (4 floors, 10 walls on "Tầng 2"); destructive steps last; project deleted in `finally`.
 * Sources (FE master 5fcaf502): UFM src/screens/qc/FloorManager/useFloorManager.ts, FT …/FloorTable.tsx, FGW …/floorManagerGateway.ts,
 * FTR …/FloorTableRow.tsx; BE floors/service.py (delete soft-marks, restore window 600 s).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson, captureEvidence } from './support/evidence';
import { layerPathOf } from './support/layerSeed';
import { DESKTOP } from './support/p11/common';
import {
  apiAddFloor,
  apiDeleteFloor,
  callsSince,
  createStack,
  nthCall,
  readFloors,
  seedFloorLayer,
  undoFromToast,
  wallCount,
  withFloorsAdmin,
} from './support/p11/P3';

const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const MENU_NAME = 'Tuỳ chọn'; // CM:150
const REMOVE = 'Xoá tầng'; // FT:180-184
const EMPTY_TITLE = 'Chưa có tầng nào'; // FT:76
const removed = (name: string): string => `Đã xoá tầng ${name}.`; // FGW:584
const T = {
  persistFailed: 'Chưa lưu được thay đổi tầng', // UFM:181
  undoRefused: 'Chưa hoàn tác được thay đổi tầng', // UFM:189
  idTaken: 'Mã tầng đã có trong dự án, thao tác vừa rồi đã được huỷ.', // UFM:190
  floorGone: 'Tầng này không còn trên máy chủ.', // UFM:195
  undoExpired: 'Đã quá thời gian khôi phục tầng, tầng đã xoá không lấy lại được.', // UFM:196
  undoNotLatest: 'Thay đổi này không còn là thay đổi gần nhất nên không hoàn tác được từ thông báo.', // UFM:197-198
} as const;
const RESTORE_WINDOW_MS = 570_000; // UFM:205 FLOOR_RESTORE_WINDOW_MS

const floorsRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}/floors$`, 'u');
const deleteOf = (floorId: string): RegExp => new RegExp(`^/api/floors/${esc(floorId)}$`, 'u');
const floorRows = (page: Page): Locator => page.getByRole('row', { name: /, cao độ /u }); // FTR:204
const floorRow = (page: Page, name: string): Locator => page.getByRole('row', { name: new RegExp(`^${esc(name)}, cao độ `, 'u') });
const kebab = (page: Page, name: string): Locator => page.getByRole('button', { name: `Thao tác khác cho tầng ${name}`, exact: true }); // FTR:396
const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text }); // TST:120
const selectRow = (page: Page, name: string): Promise<void> => floorRow(page, name).getByText('Chưa có bản vẽ', { exact: true }).click(); // FTR:214
const nameInput = (page: Page, name: string): Locator => page.getByRole('textbox', { name: `Tên tầng ${name}`, exact: true }); // FTR:258

async function openMenu(page: Page, floorName: string): Promise<Locator> {
  await kebab(page, floorName).click(); // FTR:398-401
  return page.getByRole('menu', { name: MENU_NAME });
}
async function removeViaMenu(page: Page, floorName: string): Promise<void> {
  await (await openMenu(page, floorName)).getByRole('menuitem', { name: REMOVE, exact: true }).click();
}

test.describe('SCR-09 floor manager — delete / undo (QA-11 P3)', () => {
  test('SCR-09 · FL-11F-03 · admin · xoá tầng, hoàn tác, xoá lại, hết hạn', async ({ browser }) => {
    test.setTimeout(240_000);
    await withFloorsAdmin(
      browser,
      async (admin) => {
        const { page, log, api } = admin;
        const stack = await createStack(
          admin,
          '11f-fl03',
          [1, 2, 3, 4].map((n) => ({ name: `Tầng ${String(n)}`, elevationMm: (n - 1) * 3_000, heightMm: 3_000 })),
        );
        const projectId = stack.id;
        const [f1, f2, f3, f4] = stack.floors;
        if (f1 === undefined || f2 === undefined || f3 === undefined || f4 === undefined) throw new Error('setup: 4 floors');
        await seedFloorLayer(api, projectId, f2.id);
        const wallsBefore = await wallCount(api, projectId, f2.id);
        expect(wallsBefore, 'setup: 10 seeded walls on Tầng 2').toBe(10);
        await page.clock.install(); // time flows; fastForward / setSystemTime move Date.now (UFM gateway.now)
        await page.goto(ROUTES.project.floors(projectId));
        await expect(floorRows(page)).toHaveCount(4);
        let renamed = 'Tầng 1';

        await test.step('[11F-A-201] menu "Xoá tầng" → DELETE at once, no dialog', async () => {
          const mark = log.length;
          await removeViaMenu(page, 'Tầng 2');
          const del = await nthCall(log, mark, 'DELETE', deleteOf(f2.id));
          expect(del.status).toBe(200);
          await expect(floorRow(page, 'Tầng 2')).toHaveCount(0);
          await expect(toastWith(page, removed('Tầng 2')).first()).toBeVisible();
          expect(await page.getByRole('alertdialog').count()).toBe(0); // UFM:62-67
          await captureEvidence(page, 'E11_11F-A-201_floors.png');
        });

        await test.step('[11F-A-202] toast "Đã xoá tầng Tầng 2." with a "Hoàn tác" button', async () => {
          const toast = toastWith(page, removed('Tầng 2')).first();
          await expect.soft(toast).toBeVisible(); // FGW:586
          await expect.soft(toast.getByRole('button', { name: 'Hoàn tác', exact: true })).toBeVisible();
          await captureEvidence(page, 'E11_11F-A-202_floors.png');
        });

        await test.step('[11F-A-203] "Hoàn tác" → POST /projects/:id/floors 201 with the same id; row back', async () => {
          const mark = log.length;
          await undoFromToast(page, removed('Tầng 2'));
          const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
          expect(post.status).toBe(201);
          expect.soft(post.body?.id).toBe(f2.id);
          await expect(floorRow(page, 'Tầng 2')).toHaveCount(1);
          await captureEvidence(page, 'E11_11F-A-203_floors.png');
        });

        await test.step('[11F-A-204] floor contents are back: same wall count as before the delete', async () => {
          expect.soft(await wallCount(api, projectId, f2.id), 'walls after undo').toBe(wallsBefore); // FGW:771-830 `before` snapshot
          await captureEvidence(page, 'E11_11F-A-204_floors.png');
        });

        await test.step('[11F-A-205] delete the selected floor → no selected row, "Nhân bản tầng" gone', async () => {
          await selectRow(page, 'Tầng 2');
          await expect(page.getByRole('button', { name: 'Nhân bản tầng', exact: true })).toBeVisible(); // FT:233-244
          const mark = log.length;
          await removeViaMenu(page, 'Tầng 2');
          await nthCall(log, mark, 'DELETE', deleteOf(f2.id));
          await expect(floorRow(page, 'Tầng 2')).toHaveCount(0);
          await expect.soft(page.locator('tr[aria-selected="true"]')).toHaveCount(0); // UFM:1464
          await expect.soft(page.getByRole('button', { name: 'Nhân bản tầng', exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E11_11F-A-205_floors.png');
          await undoFromToast(page, removed('Tầng 2')); // put the floor back for the next steps
          await expect(floorRow(page, 'Tầng 2')).toHaveCount(1);
        });

        await test.step('[11F-A-206] double click "Xoá tầng" → exactly ONE DELETE', async () => {
          const mark = log.length;
          const menu = await openMenu(page, 'Tầng 3');
          await menu.getByRole('menuitem', { name: REMOVE, exact: true }).dblclick();
          await nthCall(log, mark, 'DELETE', deleteOf(f3.id));
          await expect(floorRow(page, 'Tầng 3')).toHaveCount(0);
          await expect(toastWith(page, removed('Tầng 3')).first()).toBeVisible(); // milestone: the whole delete finished
          expect.soft(callsSince(log, mark, 'DELETE', deleteOf(f3.id))).toHaveLength(1); // UFM:998 runExclusive
          await captureEvidence(page, 'E11_11F-A-206_floors.png');
        });

        await test.step('[11F-A-207] toast gone (+9 s), Mod+Z still restores within 570 s', async () => {
          await page.clock.fastForward(9_000);
          await expect.soft(toastWith(page, removed('Tầng 3'))).toHaveCount(0);
          const mark = log.length;
          await floorRow(page, 'Tầng 1').focus();
          await page.keyboard.press('Control+z'); // UFM:1015-1022
          const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
          expect(post.status).toBe(201);
          expect.soft(post.body?.id).toBe(f3.id);
          await expect(floorRow(page, 'Tầng 3')).toHaveCount(1);
          await captureEvidence(page, 'E11_11F-A-207_floors.png');
        });

        await test.step('[11F-A-208] after 570 s Mod+Z is refused with the expiry sentence, no POST', async () => {
          const delMark = log.length;
          await removeViaMenu(page, 'Tầng 3');
          await nthCall(log, delMark, 'DELETE', deleteOf(f3.id));
          const pageNow = await page.evaluate(() => Date.now());
          await page.clock.setSystemTime(pageNow + RESTORE_WINDOW_MS + 1_000);
          const mark = log.length;
          await floorRow(page, 'Tầng 1').focus();
          await page.keyboard.press('Control+z'); // UFM:952-967 isExpired
          await expect.soft(toastWith(page, `${T.undoRefused} — ${T.undoExpired}`).first()).toBeVisible();
          expect.soft(callsSince(log, mark, 'POST', floorsRe(projectId))).toEqual([]); // milestone: refusal toast shown
          await expect.soft(floorRow(page, 'Tầng 3')).toHaveCount(0);
          await captureEvidence(page, 'E11_11F-A-208_floors.png');
        });

        await test.step('[11F-A-209] delete the restored floor again → second DELETE 200, new toast', async () => {
          const mark = log.length;
          await removeViaMenu(page, 'Tầng 2');
          const del = await nthCall(log, mark, 'DELETE', deleteOf(f2.id));
          expect(del.status).toBe(200);
          await expect(floorRow(page, 'Tầng 2')).toHaveCount(0);
          await expect.soft(toastWith(page, removed('Tầng 2')).first()).toBeVisible();
          await captureEvidence(page, 'E11_11F-A-209_floors.png');
        });

        await test.step('[11F-A-210] toast "Hoàn tác" after a newer step → refused, no request', async () => {
          renamed = 'Tầng 1 đổi';
          const input = nameInput(page, 'Tầng 1');
          await input.fill(renamed);
          await input.press('Enter');
          await expect(nameInput(page, renamed)).toBeVisible();
          const mark = log.length;
          await undoFromToast(page, removed('Tầng 2'));
          await expect.soft(toastWith(page, T.undoNotLatest).first()).toBeVisible(); // UFM:202
          expect.soft(callsSince(log, mark, 'POST', floorsRe(projectId))).toEqual([]);
          await captureEvidence(page, 'E11_11F-A-210_floors.png');
        });

        await test.step('[11F-B-201] floor already deleted elsewhere → DELETE 404, row stays, failure toast', async () => {
          expect(await apiDeleteFloor(api, f4.id), 'setup: API delete of Tầng 4').toBe(200);
          const mark = log.length;
          await removeViaMenu(page, 'Tầng 4');
          const del = await nthCall(log, mark, 'DELETE', deleteOf(f4.id));
          expect(del.status).toBe(404);
          await expect.soft(floorRow(page, 'Tầng 4')).toHaveCount(1); // UFM:751-763 reverted
          await expect.soft(toastWith(page, `${T.persistFailed} — ${T.floorGone}`).first()).toBeVisible();
          await captureEvidence(page, 'E11_11F-B-201_floors.png');
        });

        await test.step('[11F-B-202] undo when the id was re-created elsewhere → 409 sentence', async () => {
          const mark = log.length;
          await removeViaMenu(page, renamed);
          await nthCall(log, mark, 'DELETE', deleteOf(f1.id));
          const readd = await apiAddFloor(api, projectId, { id: f1.id, name: renamed, order: 0, elevationMm: 0, heightMm: 3_000 });
          expect(readd.status, 'API re-creates the same id').toBe(201);
          // evidence (E), RR2: the one-shot snapshots above/below cannot say WHEN the failure toast comes and goes. Record every DOM change of the
          // toast stack (ms since now) from before the undo click; the hook side is green (useFloorManager.test.ts [11F-B-202]).
          await page.evaluate(() => {
            const store = window as unknown as { __toastLog?: { ms: number; toasts: string[] }[] };
            const log: { ms: number; toasts: string[] }[] = [];
            store.__toastLog = log;
            const t0 = Date.now();
            const snap = (): void => {
              const toasts = Array.from(document.querySelectorAll('[role="status"]:not([data-announcer])')).map((el) => (el.textContent ?? '').trim());
              log.push({ ms: Date.now() - t0, toasts });
            };
            new MutationObserver(snap).observe(document.body, { subtree: true, childList: true, characterData: true });
            snap();
          });
          await undoFromToast(page, removed(renamed));
          const post = await nthCall(log, mark, 'POST', floorsRe(projectId));
          expect(post.status).toBe(409); // BE service.py FLOOR_ID_TAKEN
          // evidence (E): what the 409 body says and which toasts exist at the moment of the check (attached before the expect so it survives a red)
          await attachJson('E11_11F-B-202_floors.json', {
            url: page.url(),
            callsSinceMark: log.slice(mark).map((c) => ({ method: c.method, path: c.path, status: c.status })),
            post409Json: post.json ?? null,
            toastsNow: await page.getByRole('status').filter({ hasNot: page.locator('[data-announcer]') }).allInnerTexts(),
            rowsNow: await page.getByRole('row').allInnerTexts(),
          });
          await expect.soft(toastWith(page, `${T.persistFailed} — ${T.idTaken}`).first()).toBeVisible(); // UFM:190
          // evidence (E): toasts AFTER the 15 s wait (R1/D snapshot was taken before it): is the failure toast merged into an older same-type one?
          await attachJson('E11_11F-B-202_after.json', {
            toastsAfter: await page.getByRole('status').filter({ hasNot: page.locator('[data-announcer]') }).allInnerTexts(),
          });
          await attachJson('E11_11F-B-202_toastlog.json', {
            changes: await page.evaluate(() => (window as unknown as { __toastLog?: unknown[] }).__toastLog ?? []),
          });
          await captureEvidence(page, 'E11_11F-B-202_floors.png');
        });

        await test.step('[11F-B-203] delete the last floor → "Chưa có tầng nào"', async () => {
          await page.goto(ROUTES.project.floors(projectId));
          await expect(floorRows(page)).toHaveCount(1); // server holds only the re-created floor (Tầng 2/3 deleted, Tầng 4 gone)
          await removeViaMenu(page, renamed);
          await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible(); // UFM:326-327
          await captureEvidence(page, 'E11_11F-B-203_floors.png');
        });

        await test.step('[11F-B-204] server: list has no floor; GET of a deleted floor → 404 resource floor; reload stays empty', async () => {
          const left = await readFloors(api, projectId);
          expect(left.map((f) => f.id)).not.toContain(f1.id);
          expect(left.map((f) => f.id)).not.toContain(f2.id);
          const res = await api.get(layerPathOf(projectId, f2.id));
          expect(res.status()).toBe(404);
          expect(JSON.stringify(await res.json())).toContain('"floor"'); // BE service.py:165 NOT_FOUND resource="floor"
          await page.reload();
          await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
          await captureEvidence(page, 'E11_11F-B-204_floors.png');
        });

        await test.step('[11F-B-205] stale URL of the deleted floor → not-found message, not stuck', async () => {
          await page.goto(ROUTES.project.objects(projectId, f2.id));
          // floorLayerReadFailure.ts:21-24 + hooks/useFloorLayer.ts:31
          await expect(page.getByText('Không mở được tầng này', { exact: true })).toBeVisible();
          await expect.soft(page.getByText('Tầng này không còn tồn tại. Mở Quản lý tầng để chọn một tầng khác.', { exact: true })).toBeVisible();
          await expect.soft(page.getByRole('button', { name: 'Về quản lý tầng', exact: true })).toBeVisible();
          await expect.soft(page).not.toHaveURL(/khong-co-quyen/u);
          await captureEvidence(page, 'E11_11F-B-205_floors.png');
        });

        await test.step('[11F-E-201] keyboard: kebab → "Xoá tầng" with Enter; toast "Hoàn tác" reachable by Tab', async () => {
          const added = await apiAddFloor(api, projectId, { name: 'Tầng K', order: 0, elevationMm: 0, heightMm: 3_000 });
          expect(added.status).toBe(201);
          // RR3 evidence: deleting the ONLY floor draws the empty state (FT:193-203), which has no toolbar switch (FT:321). Keep a second floor.
          const keeper = await apiAddFloor(api, projectId, { name: 'Tầng L', order: 1, elevationMm: 3_000, heightMm: 3_000 });
          expect(keeper.status).toBe(201);
          await page.goto(ROUTES.project.floors(projectId));
          await expect(floorRows(page)).toHaveCount(2);
          await kebab(page, 'Tầng K').focus();
          await page.keyboard.press('Enter');
          const item = page.getByRole('menu', { name: MENU_NAME }).getByRole('menuitem', { name: REMOVE, exact: true });
          await item.focus();
          const mark = log.length;
          await page.keyboard.press('Enter');
          await nthCall(log, mark, 'DELETE', deleteOf(added.id));
          const toast = toastWith(page, removed('Tầng K')).first();
          const undo = toast.getByRole('button', { name: 'Hoàn tác', exact: true });
          await expect(undo).toBeVisible();
          await expect.soft(toast).toHaveAttribute('aria-live', 'polite'); // TST:120-121
          await page.getByRole('switch', { name: 'Tự động tính cao độ', exact: true }).focus(); // FT:84 — toolbar before the toast
          let reached = false;
          for (let i = 0; i < 60 && !reached; i += 1) {
            await page.keyboard.press('Tab');
            reached = await undo.evaluate((button) => button === document.activeElement).catch(() => false);
          }
          expect.soft(reached, '"Hoàn tác" of the toast is in the Tab order').toBe(true);
          await captureEvidence(page, 'E11_11F-E-201_floors.png');
        });
      },
      DESKTOP,
    );
  });
});
