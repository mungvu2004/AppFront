/**
 * QA-11 P4 - FL-11F-04 (SCR-21 thickness standardization, bản Z: tick a group, "Đổi N đoạn", undo; reviewed walls never in the batch) and FL-11F-05 (SCR-25 measurement delete,
 * undo, id conflict). Engineer on own project, 1440 px. Slot: `p11-floors-d` (engineer). Destructive steps last.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { dismissTour } from '../../e2e/fixtures/tour';
import { TEST_DATA_PREFIX, captureEvidence } from './support/evidence';
import { qcLayer, writeLayer } from './support/layerSeed';
import { seedMeasurement, seedThicknessLayer, withSlotMember, writeLog } from './support/p11/P4';

const SLOT = 'floors-d';
const THICK = {
  screen: 'Chuẩn hoá độ dày tường', // TV:SCREEN_TITLE
  undo: 'Hoàn tác',
  tolerance: 'Dung sai', // removed in bản Z (fixed 30 mm)
  accept: /^Đồng ý đổi các đoạn .+ về 220 mm$/u, // TBP:TEXT.acceptGroup
  selectGroup: /^Chọn (cả \d+ nhóm|nhóm này) \(\d+ đoạn\)$/u, // TBP:TEXT.selectAll
  change: /^Đổi \d+ đoạn/u, // TBP:TEXT.apply (+ Enter key cap)
  detail: /^Xem bảng từng đoạn \(\d+\)$/u, // TBP:TEXT.detail
  drawer: 'Bảng từng đoạn tường', // TV:DETAIL_TITLE
  reviewedOut: /1 tường đã duyệt không nằm trong lô\.$/u, // TB:batchSentenceOf
  applied: /^Chuẩn hoá độ dày \d+ tường\.$/u, // thicknessStandardizationGateway.ts standardizeDescription
  before: '3/4 đoạn không chuẩn, 1 đúng chuẩn', // 260, 260, reviewed 260 off (40 off 220); 220 standard (TB:statusSentenceOf)
  afterBatch: '1/4 đoạn không chuẩn, 3 đúng chuẩn',
} as const;
const TOASTS = 'Thông báo'; // components/feedback/Toast.tsx:176
const MT = {
  gone: 'Phép đo này đã bị xoá ở nơi khác', // UMT:216
  undo: 'Hoàn tác',
} as const;

const layerPutRe = /^\/api\/projects\/[^/]+\/floors\/[^/]+\/spatial\/layer$/u;
const measurementsRe = (pid: string): RegExp => new RegExp(`^/api/projects/${pid}/measurements$`, 'u');
const measurementRe = (pid: string): RegExp => new RegExp(`^/api/projects/${pid}/measurements/[^/]+$`, 'u');
const layerWrites = (log: readonly { method: string; path: string }[], mark: number): number =>
  log.slice(mark).filter((entry) => entry.method === 'PUT' && layerPutRe.test(entry.path)).length;
const region = (page: Page): Locator => page.getByRole('region', { name: THICK.screen, exact: true });
// two "Thông báo" regions exist (Toast.Provider in main + NotificationHost); take the one holding a toast (role=status)
const toasts = (page: Page): Locator => page.getByRole('region', { name: TOASTS, exact: true }).filter({ has: page.getByRole('status') });
/**
 * sr-only checkbox: the custom box's svg intercepts pointer events (R1/D `locator.check` log), so force the click (it lands on the label
 * and toggles the input). R3: focus + Space ended unchecked in R1/RR1/RR2 on the stack ("Expected checked, Received unchecked"), yet the
 * same keys tick it once in Chromium on Vite (e2e/qa11/floors.vite.spec.ts, green) - keyboard path moved there. Idempotent retry.
 */
async function accept(_page: Page, box: Locator): Promise<void> {
  await expect(async () => {
    await box.setChecked(true, { force: true, timeout: 3_000 });
    await expect(box).toBeChecked({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe('P4 floors D edge', () => {
  test('SCR-21 · FL-11F-04 · engineer · chuẩn hoá độ dày: xem trước, áp, hoàn tác', async ({ browser }) => {
    test.setTimeout(240_000);
    await withSlotMember(browser, 'engineer', SLOT, 'p4-thick', 1, async ({ session, project, layerApi }) => {
      const { page } = session;
      const floor = project.floors[0];
      if (floor === undefined) throw new Error('setup: no floor');
      const seed = await seedThicknessLayer(layerApi, project.projectId, floor.id);
      const log = writeLog(page);
      const zone = region(page);
      const changeBtn = zone.getByRole('button', { name: THICK.change });
      const selectBtn = zone.getByRole('button', { name: THICK.selectGroup });
      const statusLine = zone.getByText(/đoạn không chuẩn,/u);
      const box = zone.getByRole('checkbox', { name: THICK.accept });
      const drawer = page.getByRole('dialog', { name: THICK.drawer, exact: true });
      await page.goto(ROUTES.project.thickness(project.projectId, floor.id));
      await dismissTour(page);
      await expect(page.getByRole('heading', { name: THICK.screen })).toBeVisible();
      await expect(statusLine).toHaveText(THICK.before);

      await test.step('[11F-A-302] ticking the group shows "Đổi N đoạn", writes nothing', async () => {
        const mark = log.length;
        await accept(page, box);
        await expect(changeBtn).toBeVisible();
        expect(layerWrites(log, mark), 'no PUT spatial/layer before "Đổi"').toBe(0);
        await captureEvidence(page, 'E11_11F-A-302_floors.png');
      });
      await test.step('[11F-A-303] unticking drops the batch, no write', async () => {
        const mark = log.length;
        await box.setChecked(false, { force: true });
        await expect.soft(changeBtn).toBeHidden();
        expect.soft(layerWrites(log, mark)).toBe(0);
        await captureEvidence(page, 'E11_11F-A-303_floors.png');
      });
      await test.step('[11F-A-304] nothing ticked: no dead button, the main button leads to the missing step', async () => {
        await expect.soft(selectBtn).toHaveText('Chọn nhóm này (2 đoạn)');
        await expect.soft(changeBtn).toBeHidden();
        await expect.soft(zone.getByLabel(THICK.tolerance)).toHaveCount(0); // bản Z: tolerance fixed at 30 mm
        await captureEvidence(page, 'E11_11F-A-304_floors.png');
      });
      await test.step('[11F-A-305] a reviewed wall in the group: the sentence says it stays out, nothing written', async () => {
        const mark = log.length;
        await accept(page, box);
        await expect.soft(zone.getByText(THICK.reviewedOut)).toBeVisible();
        expect.soft(layerWrites(log, mark)).toBe(0);
        await captureEvidence(page, 'E11_11F-A-305_floors.png');
      });
      await test.step('[11F-A-306] Esc with a group ticked writes nothing (no warning layer any more)', async () => {
        const mark = log.length;
        await page.keyboard.press('Escape');
        expect.soft(layerWrites(log, mark)).toBe(0);
        await captureEvidence(page, 'E11_11F-A-306_floors.png');
      });
      await test.step('[11F-A-307] the batch excludes the reviewed wall: "Đổi 2 đoạn"', async () => {
        await expect.soft(changeBtn).toHaveText(/^Đổi 2 đoạn/u);
        await captureEvidence(page, 'E11_11F-A-307_floors.png');
      });
      await test.step('[11F-A-308] the reviewed wall is still listed (4 rows) in the per-wall table, the only place to change it', async () => {
        await zone.getByRole('button', { name: THICK.detail }).click();
        await expect(drawer).toBeVisible();
        await expect.soft(drawer.locator('tbody tr')).toHaveCount(4);
        await captureEvidence(page, 'E11_11F-A-308_floors.png');
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();
      });
      await test.step('[11F-A-309] "Đổi" -> one batch, toast with "Hoàn tác"', async () => {
        const mark = log.length;
        const put = page.waitForResponse((res) => res.request().method() === 'PUT' && layerPutRe.test(new URL(res.url()).pathname));
        await changeBtn.click();
        expect.soft((await put).status()).toBe(200);
        await expect.soft(toasts(page).getByText(THICK.applied)).toBeVisible();
        await expect.soft(toasts(page).getByRole('button', { name: THICK.undo, exact: true })).toBeVisible();
        await expect.soft(statusLine).toHaveText(THICK.afterBatch);
        expect.soft(layerWrites(log, mark), 'one autosave batch').toBe(1);
        await captureEvidence(page, 'E11_11F-A-309_floors.png');
      });
      await test.step('[11F-A-310] "Hoàn tác" restores the old thickness and withdraws the toast', async () => {
        await toasts(page).getByRole('button', { name: THICK.undo, exact: true }).first().click();
        await expect.soft(statusLine).toHaveText(THICK.before);
        await expect.soft(toasts(page).getByText(THICK.applied)).toBeHidden();
        await captureEvidence(page, 'E11_11F-A-310_floors.png');
      });
      await test.step('[11F-A-311] Mod+Z in the screen = "Hoàn tác"', async () => {
        await accept(page, box);
        await changeBtn.click();
        await expect.soft(toasts(page).getByText(THICK.applied)).toBeVisible();
        await page.keyboard.press('ControlOrMeta+z'); // useShortcut Mod+Z
        await expect.soft(statusLine).toHaveText(THICK.before);
        await captureEvidence(page, 'E11_11F-A-311_floors.png');
      });
      await test.step('[11F-A-312] undo after a newer step is refused, nothing changes', async () => {
        await accept(page, box);
        await changeBtn.click(); // apply 1 (the unreviewed walls; reviewed walls never enter the batch)
        await expect(toasts(page).getByText(THICK.applied)).toHaveCount(1);
        // same-type publishes inside 5 s fold into one toast (notificationBus.ts): let the window pass so each apply keeps its ticket
        await page.waitForTimeout(5_300); // fixed-wait-ok: real clock on the stack; notificationBus DEFAULT_GROUP_WINDOW_MS 5000
        await zone.getByRole('button', { name: THICK.detail }).click();
        await expect(drawer).toBeVisible();
        await drawer.getByRole('combobox', { name: /^Độ dày chuẩn hoá của đoạn /u }).last().click(); // apply 2 on purpose: a row of the table
        await page.getByRole('option', { name: '400 mm', exact: true }).click();
        await page.keyboard.press('Escape');
        await expect(toasts(page).getByText(THICK.applied)).toHaveCount(2);
        const mark = log.length;
        // ticket of apply 1: the older toast is a peek under the newest one, so a pointer click would land on apply 2 (phase03 P3.ts:251-260)
        await toasts(page).getByRole('button', { name: THICK.undo, exact: true }).first().dispatchEvent('click');
        await expect(toasts(page).getByText('Chưa hoàn tác: đã có 1 thay đổi sau thay đổi này. Dùng Ctrl+Z để hoàn tác lần lượt.')).toBeVisible();
        expect(layerWrites(log, mark), 'no layer write after the refusal').toBe(0);
        await captureEvidence(page, 'E11_11F-A-312_floors.png');
      });
      await test.step('[11F-B-301] reload keeps the new thickness (server)', async () => {
        await page.reload();
        await expect.soft(page.getByRole('heading', { name: THICK.screen })).toBeVisible();
        const read = await layerApi.request.get(`/api/projects/${project.projectId}/floors/${floor.id}/spatial/layer`);
        expect(read.status()).toBe(200);
        const body = JSON.stringify(await read.json());
        expect.soft(body).toContain(seed.ids[0] ?? '');
        expect.soft(body).toContain('"thicknessMm":220');
        await captureEvidence(page, 'E11_11F-B-301_floors.png');
      });
    });
  });

  test('SCR-25 · FL-11F-05 · engineer · xoá phép đo, hoàn tác, xung đột id', async ({ browser }) => {
    test.setTimeout(240_000);
    await withSlotMember(browser, 'engineer', SLOT, 'p4-meas', 1, async ({ session, project, api, layerApi }) => {
      const { page } = session;
      const floor = project.floors[0];
      if (floor === undefined) throw new Error('setup: no floor');
      await writeLayer(layerApi, project.projectId, floor.id, qcLayer);
      const n = (tag: string): string => `${TEST_DATA_PREFIX}p4-${tag}`;
      const names = { a: n('a'), b: n('b'), c: n('c'), d: n('d') };
      const idA = await seedMeasurement(api, project.projectId, names.a);
      const idB = await seedMeasurement(api, project.projectId, names.b);
      const idC = await seedMeasurement(api, project.projectId, names.c);
      await seedMeasurement(api, project.projectId, names.d);
      const log = writeLog(page);
      await page.clock.install(); // undo window uses Date.now/timers (UNDO_WINDOW_MS 8000)
      const list = page.getByRole('region', { name: 'Phép đo', exact: true }); // MTL:60
      const trash = (name: string): Locator => page.getByRole('button', { name: `Xoá ${name}`, exact: true }); // MTL:154
      const row = (name: string): Locator =>
        list.getByRole('listitem').filter({ has: page.getByRole('button', { name: `Ẩn ${name}`, exact: true }) });
      const deleted = (timeout = 30_000): Promise<{ status(): number }> =>
        page.waitForResponse((res) => res.request().method() === 'DELETE' && measurementRe(project.projectId).test(new URL(res.url()).pathname), { timeout });
      const postsOf = (): number => log.filter((e) => e.method === 'POST' && measurementsRe(project.projectId).test(e.path)).length;
      await page.goto(ROUTES.project.measure(project.projectId));
      await dismissTour(page);
      await expect(row(names.a)).toBeVisible();

      await test.step('[11F-A-401] trash -> DELETE 204, row gone, no dialog', async () => {
        const res = deleted();
        await trash(names.a).click();
        expect((await res).status()).toBe(204);
        await expect.soft(row(names.a)).toHaveCount(0);
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await captureEvidence(page, 'E11_11F-A-401_floors.png');
      });
      await test.step('[11F-A-402] Delete key on the hovered row deletes like the button', async () => {
        // RR copy 1: Delete sent no request (hover lost while the list re-flowed after 401). Re-hover + press until the DELETE shows;
        // a press with no hovered row sends nothing, so retrying never deletes a second row. Key itself: useMeasurementTool.test.tsx:516.
        let status = 0;
        await expect(async () => {
          await row(names.b).hover(); // MTL:110-115
          const res = deleted(4_000);
          await page.keyboard.press('Delete'); // UMT:923
          status = (await res).status();
        }).toPass({ timeout: 25_000 });
        expect.soft(status).toBe(204);
        await expect.soft(row(names.b)).toHaveCount(0);
        await captureEvidence(page, 'E11_11F-A-402_floors.png');
      });
      await test.step('[11F-A-403] undo toast copy', async () => {
        // a and b were deleted inside the group window: same-type toasts merge and show the newest title (b)
        await expect.soft(page.getByText(`Hoàn tác xoá "${names.b}"`)).toBeVisible(); // MUT:176 + notificationBus.ts publish
        await expect.soft(page.getByRole('button', { name: MT.undo, exact: true }).first()).toBeVisible();
        await captureEvidence(page, 'E11_11F-A-403_floors.png');
      });
      await test.step('[11F-A-404] "Hoàn tác" -> POST same id, row back', async () => {
        // R3: a and b share ONE merged undo ticket (403 comment), so this press re-POSTs BOTH records with their old ids. RR2 got
        // MS-4234 (a) as the first POST where this step expected idB; the E11_11F-A-404 shot shows 4 rows (a, c, b, d) = both back.
        // BE creates -> 201 (measurements/router.py:30-38). Order of the two POSTs is not asserted.
        const posted: { id: string; status: number }[] = [];
        page.on('response', (res) => {
          if (res.request().method() === 'POST' && measurementsRe(project.projectId).test(new URL(res.url()).pathname)) {
            posted.push({ id: (res.request().postDataJSON() as { id: string }).id, status: res.status() });
          }
        });
        await page.getByRole('button', { name: MT.undo, exact: true }).first().click();
        await expect.poll(() => posted.length).toBe(2);
        expect.soft(posted.map((p) => p.id).sort()).toEqual([idA, idB].sort());
        expect.soft(posted.map((p) => p.status)).toEqual([201, 201]);
        await expect.soft(row(names.a)).toBeVisible();
        await expect.soft(row(names.b)).toBeVisible();
        await captureEvidence(page, 'E11_11F-A-404_floors.png');
      });
      await test.step('[11F-A-405] undo while the id is taken (409) -> renumbered, second POST', async () => {
        // RR copy 2 (E11_11F-A-404 shot: 4 rows): the 404 press undid the merged a+b ticket, so a exists again and its id is not free.
        // Delete a again (own toast, new group), THEN take its id through the API.
        const gone = deleted();
        await trash(names.a).click();
        expect((await gone).status()).toBe(204);
        await expect(row(names.a)).toHaveCount(0);
        const taken = await api.post(`/api/projects/${project.projectId}/measurements`, {
          data: { id: idA, name: n('taken'), mode: 'pointToPoint', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], rawValueMm: 1000 },
        });
        expect(taken.status()).toBe(201);
        const posts: number[] = [];
        page.on('response', (res) => {
          if (res.request().method() === 'POST' && measurementsRe(project.projectId).test(new URL(res.url()).pathname)) posts.push(res.status());
        });
        await page.getByRole('button', { name: MT.undo, exact: true }).first().click(); // MUT:184-195
        await expect.poll(() => posts.length).toBe(2);
        expect(posts).toEqual([409, 201]);
        // R3: the 409 path re-issues id AND name ("Phép đo N"): measurementToolGateway.ts:688-691 resolveUndoConflict -> freshIdentity
        // (:625-633), name pattern pinned in measurementToolGateway.test.ts:123; E11_11F-A-405 RR2 shot shows "Phép đo 8.093" in place of a.
        const taken2 = new Set([...Object.values(names), n('taken')]);
        const list = (await (await api.get(`/api/projects/${project.projectId}/measurements`)).json()) as { id: string; name: string }[];
        const renumbered = list.filter((r) => !taken2.has(r.name));
        expect.soft(renumbered, 'one restored record under a fresh identity').toHaveLength(1);
        expect.soft(renumbered[0]?.id, 'renumbered id differs from the taken one').not.toBe(idA);
        expect.soft(list.find((r) => r.name === n('taken'))?.id, 'the API-created record keeps the contested id').toBe(idA);
        if (renumbered[0] !== undefined) await expect.soft(row(renumbered[0].name)).toBeVisible();
        await captureEvidence(page, 'E11_11F-A-405_floors.png');
      });
      await test.step('[11F-A-406] double click on the trash -> exactly one DELETE', async () => {
        const mark = log.length;
        const res = deleted();
        await trash(names.c).dblclick();
        await res;
        await expect(row(names.c)).toHaveCount(0);
        expect.soft(log.slice(mark).filter((e) => e.method === 'DELETE' && measurementRe(project.projectId).test(e.path))).toHaveLength(1);
        await captureEvidence(page, 'E11_11F-A-406_floors.png');
      });
      await test.step('[11F-A-407] after 8 s the undo button disappears; list has no deleted id', async () => {
        await page.clock.fastForward(9_000); // UNDO_WINDOW_MS 8000 (page.clock instead of sleeping)
        await expect.soft(page.getByRole('button', { name: MT.undo, exact: true })).toHaveCount(0);
        const read = await api.get(`/api/projects/${project.projectId}/measurements`);
        expect(read.status()).toBe(200);
        expect.soft(JSON.stringify(await read.json())).not.toContain(idC);
        await captureEvidence(page, 'E11_11F-A-407_floors.png');
      });
      await test.step('[11F-B-401] deleted elsewhere -> 404 -> "Phép đo này đã bị xoá ở nơi khác"', async () => {
        const all = await api.get(`/api/projects/${project.projectId}/measurements`);
        const records = (await all.json()) as { id: string; name: string }[];
        const target = records.find((r) => r.name === names.d);
        expect(target, 'measurement d exists').toBeDefined();
        expect((await api.delete(`/api/projects/${project.projectId}/measurements/${target?.id ?? ''}`)).status()).toBe(204);
        const res = deleted();
        await trash(names.d).click();
        expect.soft((await res).status()).toBe(404);
        await expect.soft(page.getByText(MT.gone, { exact: true })).toBeVisible();
        await expect.soft(row(names.d)).toHaveCount(0);
        await captureEvidence(page, 'E11_11F-B-401_floors.png');
      });
      await test.step('[11F-E-401] trash has label "Xoá {name}", reachable by Tab, Enter deletes', async () => {
        const name = n('e');
        await seedMeasurement(api, project.projectId, name);
        await page.reload();
        await dismissTour(page);
        await expect(trash(name)).toBeVisible();
        let reached = false;
        for (let i = 0; i < 80 && !reached; i += 1) {
          await page.keyboard.press('Tab');
          reached = await page.evaluate((label) => document.activeElement?.getAttribute('aria-label') === label, `Xoá ${name}`);
        }
        expect(reached, 'trash focused by Tab').toBe(true);
        const res = deleted();
        await page.keyboard.press('Enter');
        expect.soft((await res).status()).toBe(204);
        await captureEvidence(page, 'E11_11F-E-401_floors.png');
      });
    });
  });
});
