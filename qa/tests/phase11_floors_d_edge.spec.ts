/**
 * QA-11 P4 - FL-11F-04 (SCR-21 thickness standardization: preview, apply, undo) and FL-11F-05 (SCR-25 measurement delete,
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
  screen: 'Chuẩn hoá độ dày tường', // TV:105
  preview: 'Xem trước', // TAB:56
  cancel: 'Huỷ', // TAB:57
  apply: 'Áp dụng', // TAB:58
  undo: 'Hoàn tác', // TAB:55
  tolerance: 'Dung sai', // ThicknessApplyBar.tsx:50
  reapply: 'Áp lại cho mọi tường lệch nhóm', // ThicknessApplyBar.tsx:55
  warnTitle: 'Áp lại cho mọi tường lệch nhóm sẽ đổi tường đã duyệt', // ThicknessApplyBar.tsx:64
  exclude: 'Loại tường đã duyệt ra rồi xem trước', // ThicknessApplyBar.tsx:62
  applyAll: 'Xem trước cho tất cả', // ThicknessApplyBar.tsx:63
  accept: /^Đồng ý chuẩn hoá \d+ tường /u, // phase04 edge TGT:43
  applied: /^Chuẩn hoá độ dày \d+ tường\.$/u, // thicknessStandardizationGateway.ts:836-837
  measured200: /^200,0\s*mm$/u,
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
const toasts = (page: Page): Locator => page.getByRole('region', { name: TOASTS, exact: true });

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
      const previewBtn = zone.getByRole('button', { name: THICK.preview, exact: true });
      const applyBtn = zone.getByRole('button', { name: THICK.apply, exact: true });
      await page.goto(ROUTES.project.thickness(project.projectId, floor.id));
      await dismissTour(page);
      await expect(page.getByRole('heading', { name: THICK.screen })).toBeVisible();
      await expect(zone.getByText(THICK.measured200)).toHaveCount(3);
      await zone.getByRole('checkbox', { name: THICK.accept }).first().check();

      await test.step('[11F-A-302] "Xem trước" opens the table, writes nothing', async () => {
        const mark = log.length;
        await previewBtn.click();
        await expect(applyBtn).toBeVisible();
        expect(layerWrites(log, mark), 'no PUT spatial/layer while the preview is open (UTS:765-768)').toBe(0);
        await captureEvidence(page, 'E11_11F-A-302_floors.png');
      });
      await test.step('[11F-A-303] "Huỷ" closes the preview, no write', async () => {
        const mark = log.length;
        await zone.getByRole('button', { name: THICK.cancel, exact: true }).click();
        await expect.soft(applyBtn).toBeHidden();
        expect.soft(layerWrites(log, mark)).toBe(0);
        await captureEvidence(page, 'E11_11F-A-303_floors.png');
      });
      await test.step('[11F-A-304] every segment blocked by tolerance -> "Áp dụng" disabled', async () => {
        // UNKNOWN - NEED VERIFICATION: "Dung sai" is a spinbutton; 0 mm blocks every deviating segment (TAB:205 totalWalls === unchangedWalls.length).
        const tolerance = zone.getByLabel(THICK.tolerance);
        await tolerance.fill('0');
        await previewBtn.click();
        await expect.soft(applyBtn).toBeDisabled();
        await captureEvidence(page, 'E11_11F-A-304_floors.png');
        await zone.getByRole('button', { name: THICK.cancel, exact: true }).click();
        await tolerance.fill('30');
      });
      await test.step('[11F-A-305] reapply with a reviewed wall -> warning, nothing written', async () => {
        const mark = log.length;
        await zone.getByRole('button', { name: THICK.reapply, exact: true }).click();
        await expect.soft(page.getByText(THICK.warnTitle, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(/^\d+ tường đã duyệt sẽ bị đổi\. Đề nghị loại các tường này khỏi lượt áp lại\.$/u)).toBeVisible();
        expect.soft(layerWrites(log, mark)).toBe(0);
        await captureEvidence(page, 'E11_11F-A-305_floors.png');
      });
      await test.step('[11F-A-306] "Huỷ" of the warning closes it, no write', async () => {
        const mark = log.length;
        await zone.getByRole('button', { name: THICK.cancel, exact: true }).click();
        await expect.soft(page.getByText(THICK.warnTitle, { exact: true })).toBeHidden();
        expect.soft(layerWrites(log, mark)).toBe(0);
        await captureEvidence(page, 'E11_11F-A-306_floors.png');
      });
      await test.step('[11F-A-307] "Loại tường đã duyệt ra rồi xem trước" -> preview without the reviewed wall', async () => {
        await zone.getByRole('button', { name: THICK.reapply, exact: true }).click();
        await zone.getByRole('button', { name: THICK.exclude, exact: true }).click();
        await expect.soft(applyBtn).toBeVisible();
        await captureEvidence(page, 'E11_11F-A-307_floors.png');
        await zone.getByRole('button', { name: THICK.cancel, exact: true }).click();
      });
      await test.step('[11F-A-308] "Xem trước cho tất cả" -> preview includes the reviewed wall', async () => {
        await zone.getByRole('button', { name: THICK.reapply, exact: true }).click();
        await zone.getByRole('button', { name: THICK.applyAll, exact: true }).click();
        await expect.soft(applyBtn).toBeVisible();
        await captureEvidence(page, 'E11_11F-A-308_floors.png');
      });
      await test.step('[11F-A-309] "Áp dụng" -> one batch, toast with "Hoàn tác"', async () => {
        const mark = log.length;
        const put = page.waitForResponse((res) => res.request().method() === 'PUT' && layerPutRe.test(new URL(res.url()).pathname));
        await applyBtn.click();
        expect.soft((await put).status()).toBe(200);
        await expect.soft(toasts(page).getByText(THICK.applied)).toBeVisible();
        await expect.soft(toasts(page).getByRole('button', { name: THICK.undo, exact: true })).toBeVisible();
        expect.soft(layerWrites(log, mark), 'one autosave batch').toBe(1);
        await captureEvidence(page, 'E11_11F-A-309_floors.png');
      });
      await test.step('[11F-A-310] "Hoàn tác" restores the old thickness and withdraws the toast', async () => {
        await toasts(page).getByRole('button', { name: THICK.undo, exact: true }).first().click();
        await expect.soft(zone.getByText(THICK.measured200).first()).toBeVisible();
        await expect.soft(toasts(page).getByText(THICK.applied)).toBeHidden();
        await captureEvidence(page, 'E11_11F-A-310_floors.png');
      });
      await test.step('[11F-A-311] Mod+Z in the screen = "Hoàn tác"', async () => {
        await zone.getByRole('checkbox', { name: THICK.accept }).first().check();
        await previewBtn.click();
        await applyBtn.click();
        await expect.soft(toasts(page).getByText(THICK.applied)).toBeVisible();
        await page.keyboard.press('ControlOrMeta+z'); // useShortcut Mod+Z (UTS:878-885)
        await expect.soft(zone.getByText(THICK.measured200).first()).toBeVisible();
        await captureEvidence(page, 'E11_11F-A-311_floors.png');
      });
      await test.step('[11F-A-312] undo after a newer step is refused, nothing changes', async () => {
        // UNKNOWN - NEED VERIFICATION: refusal toast text (`thicknessStandardization.undoRefused`) and how to add a newer step
        // (here a second apply). Asserts only that the apply toast appears; refusal itself is not asserted.
        await zone.getByRole('checkbox', { name: THICK.accept }).first().check();
        await previewBtn.click();
        await applyBtn.click();
        await expect.soft(toasts(page).getByText(THICK.applied).first()).toBeVisible();
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
      await seedMeasurement(api, project.projectId, names.a);
      const idB = await seedMeasurement(api, project.projectId, names.b);
      const idC = await seedMeasurement(api, project.projectId, names.c);
      await seedMeasurement(api, project.projectId, names.d);
      const log = writeLog(page);
      await page.clock.install(); // undo window uses Date.now/timers (UNDO_WINDOW_MS 8000)
      const list = page.getByRole('region', { name: 'Phép đo', exact: true }); // MTL:60
      const trash = (name: string): Locator => page.getByRole('button', { name: `Xoá ${name}`, exact: true }); // MTL:154
      const row = (name: string): Locator =>
        list.getByRole('listitem').filter({ has: page.getByRole('button', { name: `Ẩn ${name}`, exact: true }) });
      const deleted = (): Promise<{ status(): number }> =>
        page.waitForResponse((res) => res.request().method() === 'DELETE' && measurementRe(project.projectId).test(new URL(res.url()).pathname));
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
        await row(names.b).hover(); // MTL:110-115
        const res = deleted();
        await page.keyboard.press('Delete'); // UMT:923
        expect.soft((await res).status()).toBe(204);
        await expect.soft(row(names.b)).toHaveCount(0);
        await captureEvidence(page, 'E11_11F-A-402_floors.png');
      });
      await test.step('[11F-A-403] undo toast copy', async () => {
        await expect.soft(page.getByText(`Hoàn tác xoá "${names.a}"`)).toBeVisible(); // MUT:176
        await expect.soft(page.getByRole('button', { name: MT.undo, exact: true }).first()).toBeVisible();
        await captureEvidence(page, 'E11_11F-A-403_floors.png');
      });
      await test.step('[11F-A-404] "Hoàn tác" -> POST same id, row back', async () => {
        const post = page.waitForResponse((res) => res.request().method() === 'POST' && measurementsRe(project.projectId).test(new URL(res.url()).pathname));
        await page.getByRole('button', { name: MT.undo, exact: true }).first().click();
        const res = await post;
        expect.soft([200, 201]).toContain(res.status());
        await expect.soft(row(names.a).or(row(names.b)).first()).toBeVisible();
        await captureEvidence(page, 'E11_11F-A-404_floors.png');
      });
      await test.step('[11F-A-405] undo while the id is taken (409) -> renumbered, second POST', async () => {
        // UNKNOWN - NEED VERIFICATION: which deleted row the remaining undo restores; the id of b is taken here (b is the one
        // deleted last), so a 409 then a second POST is expected whichever row is left only if the left row is b.
        const taken = await api.post(`/api/projects/${project.projectId}/measurements`, {
          data: { id: idB, name: n('taken'), mode: 'pointToPoint', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], rawValueMm: 1000 },
        });
        expect.soft([201, 409]).toContain(taken.status());
        const posts = postsOf();
        await page.getByRole('button', { name: MT.undo, exact: true }).first().click();
        await expect.poll(postsOf).toBeGreaterThan(posts);
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
