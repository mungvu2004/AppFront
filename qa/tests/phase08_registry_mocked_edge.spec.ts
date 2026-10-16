/**
 * Phase 08 - SCR-36 Model AI `/admin/training/models`, EDGE layer, MOCKED RESPONSES (QA-08 S3 pack P8):
 * FL-36R-11..15 (flows-C3 / catalog-C3), 41 steps. One `test()` per flow, one `test.step('[<row id>] ...')` per catalog row.
 * Every flow title carries `[mocked response]`; each flow ends on a REAL read (`realRead`: unroute + reload + real 200 of N23).
 *
 * Mocks (support/p08/P8.ts `openMocked`): `/api/admin/ml/**` GETs + the PUT `.../model-families/<f>/active`, answered by the
 * mock. A PUT is never sent to the real server: a lowest-priority guard route aborts and counts any PUT the mock did not
 * fulfil; `realRead` asserts that count is 0 (so the global active version is never written).
 * Real pairs: FL-36R-11 -> FL-36R-01 (read states); FL-36R-12 -> FL-36R-01 (G-002); FL-36R-13/14 -> FL-M-36R-01 (A-011, A-013/A-014);
 * FL-36R-15 -> FL-36R-01/03.
 * Deviations from flows-C3: FL-36R-13: the "Tai lai" re-read check of [36R-C-013] runs inside [36R-B-025] (the notice text must
 * exist to be read, and "Tai lai" removes it). [36R-B-015] triggers the refetch through a failed activation (invalidateQueries).
 *
 * ## Users / budget
 * Shared admin only, 1 `POST /api/auth/login` per flow (5). No invitations, no real write, no dataset.
 * Source (FE): MR src/screens/admin/ModelRegistry/ModelRegistry.tsx, UMR useModelRegistry.ts, MRE modelRegistryErrors.ts, MC src/api/adminMlClient.ts.
 */
import { expect, test } from '@playwright/test';

import {
  LONG,
  activeCard,
  dialog,
  detail,
  fresh,
  gate,
  gotoRegistry,
  openMocked,
  picker,
  rowOf,
  seenSince,
  selectFamily,
  shot,
  toast,
  versionId,
  wireError,
  wireFamily,
  wireVersion,
  type Answer,
  type FamilyId,
  type Json,
} from './support/p08/P8';

const OPENING: FamilyId = 'openingAndFurnitureDetection';
const WALL: FamilyId = 'wallSegmentation';
const READ_FALLBACK = 'Không đọc được danh sách model.'; // MRE:20
const READ_TITLE = 'Không đọc được danh sách model'; // MR:40
const BUSY = 'Máy chủ đang bận. Thử lại sau ít phút.'; // MRE:19
const RETRY = 'Thử lại';
const FORBIDDEN = 'Không có quyền truy cập'; // MR:42
const CLASSIC = 'Quay về đường cổ điển';

/** 200 answer of the default PUT (same shape the mock builds). */
const ok = (family: FamilyId, b: Json): Answer => {
  const inner = (b.body ?? {}) as Json;
  return { status: 200, body: { family, revision: Number(b.baseVersion) + 1, ...(typeof inner.versionId === 'string' ? { activeVersionId: inner.versionId } : {}) } };
};

test.describe('SCR-36 registry [mocked response]', () => {
  test('SCR-36 · FL-36R-11 · [mocked response] read states and read errors', async ({ browser }) => {
    test.setTimeout(120_000);
    const s = await openMocked(browser);
    const { page, mock } = s;
    try {
      const hold = gate();
      await test.step('[36R-B-013] hold families: loading skeleton, picker already shown', async () => {
        mock.families = () => hold.wait.then(() => ({ status: 200, body: { items: mock.data.families } }));
        await gotoRegistry(page);
        const busy = page.locator('[aria-busy="true"]');
        await expect(busy).toHaveCount(1); // MR:97
        await expect(picker(page)).toBeVisible();
        await expect(busy.locator('> div').nth(1).locator('> div')).toHaveCount(8); // SKELETON_ROW_COUNT, MR:98-102
        await shot(page, '36R-B-013');
      });
      await test.step('[36R-E-012] busy flag', async () => {
        await expect.soft(page.locator('[aria-busy="true"]')).toHaveAttribute('aria-busy', 'true');
        await shot(page, '36R-E-012');
        hold.open();
        mock.families = null;
        await expect.soft(activeCard(page)).toBeVisible();
      });
      await test.step('[36R-G-008] families body with an unknown key', async () => {
        mock.families = () => ({ status: 200, body: { items: [{ family: WALL, revision: 1, bogus: true }] } }); // strict schema, adminMl.ts
        await page.reload();
        await expect.soft(page.getByText(READ_TITLE, { exact: true })).toBeVisible(LONG);
        await expect.soft(page.getByText(READ_FALLBACK, { exact: true })).toBeVisible();
        await shot(page, '36R-G-008');
      });
      await test.step('[36R-B-014] families 500: message + "Thử lại"; picker stays', async () => {
        mock.families = () => wireError(500);
        await page.reload();
        await expect.soft(page.getByText(READ_FALLBACK, { exact: true })).toBeVisible(LONG);
        await expect.soft(page.getByRole('button', { name: RETRY, exact: true })).toBeVisible();
        await expect.soft(picker(page)).toBeVisible();
        await shot(page, '36R-B-014');
      });
      await test.step('[36R-C-018] 429, network abort, 500', async () => {
        const retry = async (answer: Answer, text: string): Promise<void> => {
          const mark = mock.log.length;
          mock.families = () => answer;
          await page.getByRole('button', { name: RETRY, exact: true }).click(); // MR:121 onRetry
          await seenSince(mock.log, mark, /model-families/u);
          await expect.soft(page.getByText(text, { exact: true })).toBeVisible(LONG);
        };
        await retry(wireError(429), BUSY);
        await retry(wireError(500), READ_FALLBACK); // old and new text always differ
        await retry({ abort: true }, BUSY);
        await shot(page, '36R-C-018');
      });
      await test.step('[36R-A-021] "Thử lại" with real answers: alert gone, picker + table back', async () => {
        mock.families = null;
        mock.real = true;
        const families = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/admin/ml/model-families');
        const versions = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/admin/ml/model-versions');
        await page.getByRole('button', { name: RETRY, exact: true }).click();
        expect.soft((await families).status(), 'real GET model-families').toBe(200);
        expect.soft((await versions).status(), 'real GET model-versions').toBe(200);
        await expect.soft(page.getByText(READ_TITLE, { exact: true })).toHaveCount(0);
        await expect.soft(picker(page)).toBeVisible();
        // Q13: the stack's wall family has no versions (none may be activated) -> catalog 36R-B-012 empty state instead of the table
        const count = ((await (await versions).json()) as { items: unknown[] }).items.length;
        if (count === 0) await expect.soft(page.getByText('Chưa có phiên bản', { exact: true })).toBeVisible(); // MR:148-149
        else await expect.soft(page.getByRole('table')).toBeVisible();
        await shot(page, '36R-A-021');
      });
      await test.step('[36R-B-015] loaded page, next refetch fails: rows kept, inline "Thử lại"', async () => {
        mock.real = false;
        await page.reload();
        await expect(rowOf(page, 'Bản tường 1')).toBeVisible();
        // a failed activation invalidates versions(wall): the refetch is the certain trigger (cache is fresh for 30 s)
        mock.versions = (url) => (url.searchParams.get('family') === WALL ? wireError(500) : null);
        mock.put = () => wireError(500);
        await rowOf(page, 'Bản tường 2').getByRole('button', { name: 'Kích hoạt', exact: true }).click();
        await dialog(page).getByRole('button', { name: 'Kích hoạt', exact: true }).click();
        await expect(dialog(page).getByText('Chưa kích hoạt được bản này. Thử lại sau.', { exact: true })).toBeVisible(LONG);
        await dialog(page).getByRole('button', { name: 'Huỷ', exact: true }).click();
        await expect.soft(page.getByRole('button', { name: RETRY, exact: true })).toBeVisible(LONG);
        await expect.soft(rowOf(page, 'Bản tường 1')).toBeVisible();
        await shot(page, '36R-B-015');
      });
      await test.step('[36R-D-005] families 403: forbidden state, no "Thử lại"; ends on a real read', async () => {
        mock.versions = null;
        mock.families = () => wireError(403);
        await page.reload();
        await expect.soft(page.getByText(FORBIDDEN, { exact: true })).toBeVisible(LONG);
        await expect.soft(page.getByRole('button', { name: RETRY, exact: true })).toHaveCount(0);
        await shot(page, '36R-D-005');
        await s.realRead();
      });
    } finally {
      await s.close();
    }
  });

  test('SCR-36 · FL-36R-12 · [mocked response] "Xem thêm"', async ({ browser }) => {
    test.setTimeout(120_000);
    const s = await openMocked(browser);
    const { page, mock } = s;
    const mk = (n: number, label: string): Json => wireVersion(n, OPENING, label);
    const page1 = [mk(10, 'Bản cửa A'), mk(11, 'Bản cửa B'), mk(12, 'Bản cửa C')];
    const page2 = [mk(13, 'Bản cửa D'), mk(14, 'Bản cửa E')];
    let cursorCalls = 0;
    let onCursor = (_n: number): Answer => ({ status: 200, body: { items: page2 } });
    const wire = (first: Json[]): void => {
      mock.versions = (url) => {
        if (url.searchParams.get('family') !== OPENING) return null;
        if (!url.searchParams.has('cursor')) return { status: 200, body: { items: first, nextCursor: 'cur1' } };
        cursorCalls += 1;
        return onCursor(cursorCalls);
      };
    };
    const more = page.getByRole('button', { name: 'Xem thêm', exact: true });
    const loadError = page.getByText(READ_FALLBACK, { exact: true });
    const openOpening = async (first: Json[] = page1): Promise<void> => {
      cursorCalls = 0;
      wire(first);
      await fresh(s);
      await selectFamily(page, OPENING);
      await expect(rowOf(page, 'Bản cửa A')).toBeVisible();
    };
    try {
      await test.step('[36R-A-020] "Xem thêm": rows appended, button gone without nextCursor', async () => {
        await openOpening();
        await expect(page.getByRole('row')).toHaveCount(4);
        await more.click();
        await expect(rowOf(page, 'Bản cửa E')).toBeVisible();
        await expect(page.getByRole('row')).toHaveCount(6);
        await expect(more).toHaveCount(0);
        await shot(page, '36R-A-020');
      });
      await test.step('[36R-G-003] request carries family + cursor', async () => {
        expect.soft(mock.log.some((l) => /^GET \/api\/admin\/ml\/model-versions\?family=openingAndFurnitureDetection&cursor=cur1$/u.test(l)), mock.log.join(' | ')).toBe(true);
        await shot(page, '36R-G-003');
      });
      await test.step('[36R-B-016] next page 500: message beside the button, table unchanged', async () => {
        await openOpening();
        onCursor = () => wireError(500);
        await more.click();
        await expect.soft(loadError).toBeVisible(LONG);
        await expect.soft(page.getByRole('row')).toHaveCount(4);
        await expect.soft(more).toBeVisible();
        await shot(page, '36R-B-016');
      });
      await test.step('[36R-C-016] CURSOR_INVALID once: no alert, list re-read from page 1', async () => {
        await openOpening();
        onCursor = (n) => (n === 1 ? wireError(400, 'CURSOR_INVALID') : { status: 200, body: { items: page2 } });
        const mark = mock.log.length;
        await more.click();
        await expect
          .poll(() => {
            const l = mock.log.slice(mark);
            const i = l.findIndex((x) => x.includes('cursor='));
            return i >= 0 && l.slice(i + 1).some((x) => /model-versions\?family=openingAndFurnitureDetection$/u.test(x));
          })
          .toBe(true);
        await expect.soft(page.getByRole('row')).toHaveCount(4);
        await expect.soft(more).toBeVisible();
        await expect.soft(loadError).toHaveCount(0);
        await shot(page, '36R-C-016');
      });
      await test.step('[36R-C-017] CURSOR_INVALID twice: load-more error shown', async () => {
        await openOpening();
        onCursor = () => wireError(400, 'CURSOR_INVALID');
        const mark = mock.log.length;
        await more.click();
        await expect.poll(() => cursorCalls).toBe(1);
        await seenSince(mock.log, mark, /model-versions\?family=openingAndFurnitureDetection$/u);
        await more.click();
        await expect.poll(() => cursorCalls).toBe(2);
        await expect.soft(loadError).toBeVisible(LONG);
        await shot(page, '36R-C-017');
      });
      await test.step('[36R-B-027] one malformed item: other rows render', async () => {
        // 1 bad of 6 = 16.7% <= MAX_INVALID_RATIO 0.2 (decode.ts:7); 1 of 4 (25%) fails the whole read (RR d5f9c7d8: error alert, no table).
        await openOpening([page1[0] ?? {}, page1[1] ?? {}, { id: 'bad', label: 7 }, page1[2] ?? {}, page2[0] ?? {}, page2[1] ?? {}]);
        await expect.soft(page.getByRole('table')).toBeVisible();
        await expect.soft(page.getByRole('row')).toHaveCount(6);
        await expect.soft(rowOf(page, 'Bản cửa C')).toBeVisible();
        await shot(page, '36R-B-027');
        await s.realRead();
      });
    } finally {
      await s.close();
    }
  });

  test('SCR-36 · FL-36R-13 · [mocked response] activate PUT answers', async ({ browser }) => {
    test.setTimeout(140_000);
    const s = await openMocked(browser);
    const { page, mock } = s;
    const confirm = () => dialog(page).getByRole('button', { name: 'Kích hoạt', exact: true });
    const openDialog = async (): Promise<void> => {
      await rowOf(page, 'Bản cửa B').getByRole('button', { name: 'Kích hoạt', exact: true }).click();
      await expect(dialog(page)).toBeVisible();
    };
    /** Answers the PUT with `answer`, confirms (dialog stays open on 422/404/5xx) and returns the PUT count seen. */
    const answerWith = async (answer: Answer): Promise<void> => {
      mock.put = () => answer;
      await confirm().click();
    };
    const inDialog = (text: string) => dialog(page).getByText(text, { exact: true });
    try {
      mock.data.versions[OPENING] = [wireVersion(10, OPENING, 'Bản cửa A'), wireVersion(11, OPENING, 'Bản cửa B')];
      await fresh(s);
      await selectFamily(page, OPENING);
      await expect(rowOf(page, 'Bản cửa B')).toBeVisible();
      const release = gate();
      let cardBefore = '';
      await test.step('[36R-B-024] hold PUT, confirm: disabled + loading, "Huỷ" enabled', async () => {
        mock.put = async () => {
          await release.wait;
          return wireError(422, 'MODEL_VERSION_NOT_EVALUATED');
        };
        await openDialog();
        cardBefore = await activeCard(page).innerText();
        await confirm().click();
        await expect(confirm()).toBeDisabled();
        await expect.soft(confirm().locator('svg.animate-spin')).toHaveCount(1);
        await expect(dialog(page).getByRole('button', { name: 'Huỷ', exact: true })).toBeEnabled();
        await shot(page, '36R-B-024');
      });
      await test.step('[36R-B-026] while pending: card and row badge unchanged', async () => {
        await expect.soft(activeCard(page)).toHaveText(cardBefore, { useInnerText: true });
        await expect.soft(page.locator('tr', { hasText: 'Bản cửa A' })).toContainText('Đang dùng');
        await expect.soft(page.locator('tr', { hasText: 'Bản cửa B' })).not.toContainText('Đang dùng');
        await shot(page, '36R-B-026');
      });
      await test.step('[36R-C-019] confirm clicked twice: exactly one PUT', async () => {
        await confirm().click({ force: true });
        await confirm().click({ force: true });
        expect.soft(mock.puts, 'PUTs while pending').toHaveLength(1);
        await shot(page, '36R-C-019');
      });
      await test.step('[36R-C-006] 422 MODEL_VERSION_NOT_EVALUATED, dialog open', async () => {
        release.open();
        await expect
          .soft(inDialog('Bản này chưa đánh giá xong nên chưa kích hoạt được. Bản gốc chỉ được đánh giá khi dịch vụ học máy đã chạy.'))
          .toBeVisible(LONG);
        expect.soft(mock.puts, 'still exactly one PUT after the answer').toHaveLength(1);
        await expect.soft(dialog(page)).toBeVisible();
        await shot(page, '36R-C-006');
      });
      await test.step('[36R-C-007] 422 MODEL_FORMAT_UNSUPPORTED', async () => {
        await answerWith(wireError(422, 'MODEL_FORMAT_UNSUPPORTED'));
        await expect.soft(inDialog('Chỉ kích hoạt được bản định dạng onnx.')).toBeVisible(LONG);
        await shot(page, '36R-C-007');
      });
      await test.step('[36R-C-008] 422 MODEL_VERSION_FAMILY_MISMATCH', async () => {
        await answerWith(wireError(422, 'MODEL_VERSION_FAMILY_MISMATCH'));
        await expect.soft(inDialog('Bản này không thuộc họ model đang chọn.')).toBeVisible(LONG);
        await shot(page, '36R-C-008');
      });
      await test.step('[36R-C-009] 404 modelVersion', async () => {
        await answerWith(wireError(404, 'NOT_FOUND', 'modelVersion'));
        await expect.soft(inDialog('Không tìm thấy phiên bản này.')).toBeVisible(LONG);
        await shot(page, '36R-C-009');
      });
      await test.step('[36R-C-010] 404 modelFamily', async () => {
        await answerWith(wireError(404, 'NOT_FOUND', 'modelFamily'));
        await expect.soft(inDialog('Không tìm thấy họ model này.')).toBeVisible(LONG);
        await shot(page, '36R-C-010');
      });
      await test.step('[36R-C-011] 503', async () => {
        await answerWith(wireError(503));
        await expect.soft(inDialog(BUSY)).toBeVisible(LONG);
        await shot(page, '36R-C-011');
      });
      await test.step('[36R-C-012] 500 with an unknown code: fallback, raw code absent, versions re-read', async () => {
        const mark = mock.log.length;
        await answerWith(wireError(500, 'WEIRD_UNKNOWN_CODE'));
        await expect.soft(inDialog('Chưa kích hoạt được bản này. Thử lại sau.')).toBeVisible(LONG);
        await expect.soft(dialog(page)).not.toContainText('WEIRD_UNKNOWN_CODE');
        await seenSince(mock.log, mark, /^GET \/api\/admin\/ml\/model-versions\?family=/u);
        await shot(page, '36R-C-012');
      });
      await test.step('[36R-C-013] 409 VERSION_CONFLICT: dialog closes', async () => {
        await answerWith(wireError(409, 'VERSION_CONFLICT'));
        await expect.soft(dialog(page)).toHaveCount(0, LONG);
        await shot(page, '36R-C-013');
      });
      await test.step('[36R-B-025] conflict notice text; "Tải lại" re-reads families + versions, notice gone', async () => {
        const notice = page.getByText('Nhận diện cửa và đồ đạc vừa được đổi ở nơi khác. Tải lại để thấy bản đang dùng.', { exact: true });
        await expect.soft(notice).toBeVisible();
        await shot(page, '36R-B-025', 'conflict notice; the "Tải lại" re-read of C-013 follows');
        const mark = mock.log.length;
        await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
        await seenSince(mock.log, mark, /model-families/u);
        await seenSince(mock.log, mark, /model-versions\?family=openingAndFurnitureDetection/u);
        await expect.soft(notice).toHaveCount(0);
      });
      await test.step('[36R-C-014] 403: forbidden state; ends on a real read', async () => {
        await openDialog();
        await answerWith(wireError(403));
        await expect.soft(page.getByText(FORBIDDEN, { exact: true })).toBeVisible(LONG);
        await shot(page, '36R-C-014');
        await s.realRead();
      });
    } finally {
      await s.close();
    }
  });

  test('SCR-36 · FL-36R-14 · [mocked response] success toasts, undo, revert wire', async ({ browser }) => {
    test.setTimeout(120_000);
    const s = await openMocked(browser);
    const { page, mock } = s;
    const confirm = () => dialog(page).getByRole('button', { name: 'Kích hoạt', exact: true });
    const activate = async (label: string): Promise<void> => {
      await rowOf(page, label).getByRole('button', { name: 'Kích hoạt', exact: true }).click();
      await expect(dialog(page)).toBeVisible();
    };
    const closeDialog = async (): Promise<void> => {
      await dialog(page).getByRole('button', { name: 'Huỷ', exact: true }).click();
      await expect(dialog(page)).toHaveCount(0);
    };
    const undo = () => page.getByRole('status').getByRole('button', { name: 'Hoàn tác', exact: true });
    try {
      await test.step('[36R-C-005] candidate "Gốc": title "Kích hoạt gốc cho tách lớp tường?"', async () => {
        await fresh(s, 'Gốc');
        await activate('Gốc');
        await expect(page.getByRole('dialog', { name: 'Kích hoạt gốc cho tách lớp tường?', exact: true })).toBeVisible();
        await shot(page, '36R-C-005');
        await closeDialog();
      });
      await test.step('[36R-B-023] hold GET model-versions/<activeId>: confirm disabled, enabled after release', async () => {
        const g = gate();
        // active id 9 is NOT in the list, so the confirm waits for N27 (isActiveWaiting)
        mock.data.families[0] = wireFamily(WALL, 3, 9);
        mock.version = (id) => (id === versionId(9) ? g.wait.then(() => ({ status: 200, body: wireVersion(9, WALL, 'Bản tường 9') })) : null);
        await fresh(s, 'Gốc');
        await activate('Gốc');
        await expect.soft(confirm()).toBeDisabled();
        await expect.soft(confirm().locator('svg.animate-spin')).toHaveCount(0);
        await shot(page, '36R-B-023');
        g.open();
        await expect.soft(confirm()).toBeEnabled(LONG);
        await closeDialog();
      });
      await test.step('[36R-B-022] active version not completed: warning in the dialog', async () => {
        mock.reset();
        mock.data.versions[WALL][0] = wireVersion(1, WALL, 'Bản tường 1', { status: 'running', format: 'safetensors' });
        await fresh(s, 'Gốc');
        await activate('Gốc');
        await expect.soft(dialog(page).getByText('Bản đang dùng chưa đánh giá xong nên sau khi đổi sẽ chưa kích hoạt lại được.', { exact: true })).toBeVisible();
        await shot(page, '36R-B-022');
      });
      await test.step('[36R-C-002] confirm with unevaluated previous: no-undo description, no undo action', async () => {
        await confirm().click();
        await expect.soft(toast(page, 'Bản trước chưa đánh giá xong nên lượt đổi này không hoàn tác được.')).toBeVisible();
        await expect.soft(undo()).toHaveCount(0);
        await shot(page, '36R-C-002');
      });
      await test.step('[36R-C-003] non-wall family with no previous active: no-undo description', async () => {
        mock.reset();
        mock.data.families[1] = wireFamily(OPENING, 5);
        await fresh(s);
        await selectFamily(page, OPENING);
        await expect(rowOf(page, 'Bản cửa A')).toBeVisible();
        await activate('Bản cửa A');
        await confirm().click();
        await expect.soft(toast(page, 'Họ này trước đó chưa có bản nào nên lượt đổi này không hoàn tác được.')).toBeVisible();
        await shot(page, '36R-C-003');
      });
      await test.step('[36R-C-004] wall with no previous active: undo sends versionId null', async () => {
        mock.reset();
        mock.data.families[0] = wireFamily(WALL, 3);
        await fresh(s, 'Bản tường 1');
        const base = mock.puts.length;
        await activate('Bản tường 1');
        await confirm().click();
        await undo().click();
        await expect.poll(() => mock.puts.length).toBe(base + 2);
        expect.soft(mock.puts[base + 1]).toEqual({ baseVersion: 4, body: { versionId: null } });
        await shot(page, '36R-C-004');
      });
      await test.step('[36R-C-015] undo PUT 500: failure toast with the fallback text', async () => {
        mock.reset();
        mock.data.families[0] = wireFamily(WALL, 3);
        await fresh(s, 'Bản tường 1');
        const base = mock.puts.length;
        mock.put = (b, nth) => (nth === base ? ok(WALL, b) : wireError(500));
        await activate('Bản tường 1');
        await confirm().click();
        await undo().click();
        await expect.soft(toast(page, 'Chưa hoàn tác được lượt đổi model')).toBeVisible(LONG);
        await expect.soft(toast(page, 'Chưa kích hoạt được bản này. Thử lại sau.')).toBeVisible();
        await shot(page, '36R-C-015');
      });
      await test.step('[36R-A-019] wall "Quay về đường cổ điển": PUT body + success toast; ends on a real read', async () => {
        mock.reset();
        await fresh(s, 'Bản tường 1');
        const base = mock.puts.length;
        await activeCard(page).getByRole('button', { name: CLASSIC, exact: true }).click();
        await dialog(page).getByRole('button', { name: CLASSIC, exact: true }).click();
        await expect.poll(() => mock.puts.length).toBe(base + 1);
        expect.soft(mock.puts[base]).toEqual({ baseVersion: 3, body: { versionId: null } });
        await expect.soft(toast(page, 'Đã quay về đường cổ điển cho tách lớp tường')).toBeVisible();
        await expect.soft(toast(page, 'Chuỗi xử lý tách tường bằng thuật toán cổ điển.')).toBeVisible();
        await shot(page, '36R-A-019');
        await s.realRead();
      });
    } finally {
      await s.close();
    }
  });

  test('SCR-36 · FL-36R-15 · [mocked response] data-shaped states', async ({ browser }) => {
    test.setTimeout(120_000);
    const s = await openMocked(browser);
    const { page, mock } = s;
    const BASE = 'Họ này chưa có phiên bản nào. Tải trọng số bằng công cụ dòng lệnh, hoặc chờ một lượt huấn luyện xong.';
    try {
      await test.step('[36R-B-002] wall without activeVersionId: card "Đường cổ điển", no revert button', async () => {
        mock.data.families[0] = wireFamily(WALL, 3);
        await fresh(s, 'Bản tường 1');
        await expect(activeCard(page)).toContainText('Đường cổ điển');
        await expect(page.getByRole('button', { name: CLASSIC, exact: true })).toHaveCount(0);
        await shot(page, '36R-B-002');
      });
      await test.step('[36R-B-009] completed non-onnx row: disabled "Kích hoạt" + reason', async () => {
        mock.reset();
        mock.data.versions[WALL].push(wireVersion(4, WALL, 'Bản safetensors', { format: 'safetensors' }));
        await fresh(s, 'Bản safetensors');
        const row = rowOf(page, 'Bản safetensors');
        await expect.soft(row.getByRole('button', { name: 'Kích hoạt', exact: true })).toBeDisabled();
        await expect.soft(row).toContainText('Chỉ kích hoạt được bản định dạng onnx.');
        await shot(page, '36R-B-009');
      });
      await test.step('[36R-B-011] empty opening family: empty state text', async () => {
        mock.reset();
        mock.data.families[1] = wireFamily(OPENING, 5);
        mock.data.versions[OPENING] = [];
        await fresh(s, 'Bản tường 1');
        await selectFamily(page, OPENING);
        await expect.soft(page.getByText('Chưa có phiên bản', { exact: true })).toBeVisible();
        await expect.soft(page.getByText(BASE, { exact: true })).toBeVisible();
        await shot(page, '36R-B-011');
      });
      await test.step('[36R-B-012] empty wall without active: text + classic sentence', async () => {
        mock.reset();
        mock.data.families[0] = wireFamily(WALL, 3);
        mock.data.versions[WALL] = [];
        await fresh(s);
        await expect.soft(page.getByText('Chưa có phiên bản', { exact: true })).toBeVisible(LONG);
        await expect.soft(page.getByText(`${BASE} Đang dùng đường cổ điển.`, { exact: true })).toBeVisible();
        await shot(page, '36R-B-012');
      });
      await test.step('[36R-B-019] failed version detail: badge + fixed failure note', async () => {
        mock.reset();
        mock.data.versions[WALL].push(wireVersion(5, WALL, 'Bản lỗi', { status: 'failed', format: 'safetensors' }));
        await fresh(s, 'Bản lỗi');
        await rowOf(page, 'Bản lỗi').getByRole('button', { name: 'Bản lỗi', exact: true }).click();
        await expect.soft(detail(page)).toContainText('Đánh giá không thành công');
        await expect.soft(detail(page).getByText('Lượt đánh giá không thành công. Lý do chi tiết chỉ có trong nhật ký máy chủ.', { exact: true })).toBeVisible();
        await shot(page, '36R-B-019');
      });
      await test.step('[36R-B-021] detail read 404 while the row exists: error text (correct behaviour); ends on a real read', async () => {
        mock.reset();
        mock.version = (id) => (id === versionId(2) ? wireError(404, undefined, 'modelVersion') : null);
        await fresh(s, 'Bản tường 2');
        await rowOf(page, 'Bản tường 2').getByRole('button', { name: 'Bản tường 2', exact: true }).click();
        await expect.soft(detail(page)).toContainText('Bản tường 2'); // list fields still shown
        await expect.soft(detail(page)).toContainText('Không tìm thấy phiên bản này.');
        await shot(page, '36R-B-021');
        await s.realRead();
      });
    } finally {
      await s.close();
    }
  });
});
