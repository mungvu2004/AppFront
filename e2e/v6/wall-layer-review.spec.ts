import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { dismissTour } from '../fixtures/tour';

import { openWallsWithScale, QC_FLOOR, QC_PROJECT, seedQc } from './seedQc';

/**
 * `projectWalls` — Duyệt lớp tường (`plan.md` V6 mục 1).
 *
 * Hai loại bài, và tên bài nói ra mình thuộc loại nào:
 * - **đường nạp thật** — KHÔNG bơm. Từ B-V6-01 màn đọc N16 (`spatial.readLayer`) khi kho
 *   rỗng; đây là chỗ các "ca mồi" của `plan.md` 6.1 đỏ lên đúng thiết kế, nên chúng thành
 *   bài khẳng định đường thật. Bộ mẫu dev phục vụ bộ mẫu chuẩn A14 cho các tầng `L-LEVEL…`
 *   và lớp rỗng cho tầng khác (`src/api/__mocks__/client.ts`, `makeLayerDocument`).
 * - **[bơm]** — bộ mẫu riêng của màn qua `seedQc` (48 tường, 12 đã duyệt), vì các ca thao
 *   tác đếm trên đúng bộ ấy. Ràng buộc 6.1: `goto` rồi bơm, không `Ctrl+Z` thừa.
 *
 * Không kiểm lại thứ 61 bài đơn vị đã phủ (đếm, độ dày, vé hoàn tác, vai).
 */

/** Lần tải đầu một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/** Tầng 2 của bộ mẫu A14: 48 tường chia đều bốn tầng ⇒ 12 tường. */
const A14_FLOOR = 'L-LEVEL000001';
const A14_WALLS_ON_FLOOR = 12;

const FIXTURE_WALLS = 48;
const FIXTURE_REVIEWED = 12;

const list = (page: Page) => page.getByRole('listbox', { name: 'Danh sách đoạn tường' });
/**
 * Tiến độ ở dòng bước Tường của cột việc ("36 cần xem"). Danh sách ảo hoá và nhóm "Đã duyệt" thu gọn
 * (S-15), nên đếm `option` không ra đủ 48 — đếm bằng số còn cần xem của hook.
 */
const progress = (page: Page, reviewed: number, total: number) =>
  page.getByRole('region', { name: 'Tường' }).getByText(`${String(total - reviewed)} cần xem`, { exact: true });
/**
 * Số tường còn trong hàng đợi = tổng số ở tiêu đề các nhóm lý do ("Đứng riêng, …: 12"), trừ nhóm "Đã duyệt".
 * Tầng chưa có tỷ lệ nên dòng bước Tường nói "chờ tỷ lệ" chứ không nói "N cần xem".
 */
const queued = (page: Page) =>
  page
    .getByRole('region', { name: 'Tường', exact: true })
    .innerText()
    .then((text) =>
      [...text.matchAll(/^(.+): (\d+)$/gmu)]
        .filter((match) => !match[1]!.startsWith('Đã duyệt'))
        .reduce((sum, match) => sum + Number(match[2]), 0),
    );
/** Ô chọn độ dày trong thẻ hỏi của tường đang chọn. */
const thickness = (page: Page) => page.getByRole('combobox', { name: 'Độ dày tường' });
/** Thanh trạng thái đáy màn: trạng thái tự lưu (A7) nằm ở đây từ bố cục L23. */
const panelHead = (page: Page) => page.getByRole('status', { name: 'Thanh trạng thái' });

/** Hai dòng đầu của hàng đợi, khoá theo mã đọc từ tên dòng (danh sách ảo hoá vẽ lại khi chọn). */
async function firstTwoRows(page: Page) {
  const codes = await list(page)
    .getByRole('option')
    .evaluateAll((rows) => rows.slice(0, 2).map((row) => /^#W-\d+/u.exec(row.getAttribute('aria-label') ?? '')?.[0] ?? ''));
  expect(codes.length === 2 && codes.every((code) => code !== ''), JSON.stringify(codes)).toBe(true);
  const row = (code: string | undefined) => list(page).getByRole('option', { name: new RegExp(`^${code ?? ''} `, 'u') });
  return [row(codes[0]), row(codes[1])] as const;
}

async function openSeeded(page: Page): Promise<void> {
  await page.goto(ROUTES.project.walls(QC_PROJECT, QC_FLOOR.walls));
  await expect(page.getByRole('region', { name: 'Duyệt lớp tường' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedQc(page, 'walls');
  await expect(progress(page, FIXTURE_REVIEWED, FIXTURE_WALLS)).toBeVisible();
  /* Tour hướng dẫn phủ màn tường (W02): bỏ nó trước cú bấm đầu, không để cú bấm bỏ hộ. */
  await dismissTour(page);
}

test.describe('đường nạp thật (không bơm)', () => {
  test('mở thẳng màn ở một tầng có lớp thì danh sách hiện đúng các tường đọc từ máy chủ, không treo skeleton', async ({
    page,
  }) => {
    await page.goto(ROUTES.project.walls(QC_PROJECT, A14_FLOOR));

    /* Danh sách L23 ảo hoá trong cột việc (chỉ vẽ hàng trong tầm nhìn), nên số tường đọc ở dòng bước Tường. */
    await expect(list(page).getByRole('option', { name: /^#W-001 / })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
    await expect.poll(() => queued(page)).toBe(A14_WALLS_ON_FLOOR);
    await expect(page.getByRole('status', { name: 'Danh sách đoạn tường' })).toHaveCount(0);
  });

  /*
   * Trước B-V6-03 cổng khai `persistWallLayer: false`: tự lưu NÉM, chữ ở lại "Có thay đổi
   * chưa lưu" mãi (đo 0,5 s và 2 s sau xoá). Nay lưu qua #35 — máy chủ dev là mock trong
   * tiến trình, nên điều quan sát được là chữ của thanh trạng thái, không phải lượt HTTP.
   */
  test('xoá một tường thì hệ thống tự lưu, thanh trạng thái nói câu "chờ" chung rồi "Đã lưu lúc …" (A7, B-V6-03, B-V1-47)', async ({ page }) => {
    await openWallsWithScale(page, QC_PROJECT, A14_FLOOR, 'L-LEVEL000000');
    await expect(list(page).getByRole('option').first()).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
    await expect.poll(() => queued(page)).toBe(A14_WALLS_ON_FLOOR);
    await dismissTour(page);

    const statusBar = panelHead(page);
    // Ghi mọi lần chữ đổi TRƯỚC thao tác: câu "chờ" chỉ sống 800 ms (khuôn `account.spec.ts` AC-1).
    await statusBar.evaluate((node) => {
      const log: string[] = [];
      (window as unknown as { __statusLog: string[] }).__statusLog = log;
      new MutationObserver(() => log.push(node.textContent ?? '')).observe(node, {
        subtree: true,
        characterData: true,
        childList: true,
      });
    });

    await list(page).getByRole('option').first().click();
    await page.keyboard.press('Backspace');
    await expect.poll(() => queued(page)).toBe(A14_WALLS_ON_FLOOR - 1);

    await expect(statusBar).toContainText(/Đã lưu lúc \d{2}:\d{2}/u);
    await expect(statusBar).not.toContainText('Có thay đổi chờ đồng bộ');

    /* B-V1-47: thanh trạng thái (nhãn hook) và viên chỉ báo lưu nói CÙNG một câu "chờ" —
       trước sửa thanh nói "Có thay đổi chưa lưu" còn viên nói "Có thay đổi chờ đồng bộ". */
    const log = await page.evaluate(() => (window as unknown as { __statusLog: string[] }).__statusLog);
    expect(log.some((text) => text.includes('Có thay đổi chờ đồng bộ')), JSON.stringify(log)).toBe(true);
    expect(log.some((text) => text.includes('Có thay đổi chưa lưu')), JSON.stringify(log)).toBe(false);
  });

  test('tầng chưa có lớp thì màn nói thật "Chưa có đoạn tường nào"', async ({ page }) => {
    await page.goto(ROUTES.project.walls(QC_PROJECT, 'L1'));

    await expect(page.getByText('Chưa có đoạn tường nào', { exact: true })).toBeVisible({
      timeout: FIRST_PAINT_TIMEOUT_MS,
    });
  });
});

test.describe('[bơm] bộ mẫu riêng của màn tường', () => {
  test('[bơm] Backspace xoá tường đang chọn, Ctrl+Z trả lại — qua sổ phím thật (A12, A8)', async ({ page }) => {
    await openSeeded(page);

    await list(page).getByRole('option').first().click();
    await page.keyboard.press('Backspace');
    await expect(progress(page, FIXTURE_REVIEWED, FIXTURE_WALLS - 1)).toBeVisible();

    await page.keyboard.press('Control+z');
    await expect(progress(page, FIXTURE_REVIEWED, FIXTURE_WALLS)).toBeVisible();
  });

  test('[bơm] toast xoá gọi tường bằng nhãn của danh sách, không lộ mã máy (B-V6-02)', async ({ page }) => {
    await openSeeded(page);

    /* Hàng đợi L23 xếp theo lý do máy nghi: lấy dòng đầu danh sách, đọc mã của nó từ tên dòng. */
    const first = list(page).getByRole('option').first();
    const code = /#W-\d+/u.exec(await first.innerText())?.[0];
    expect(code).toBeDefined();
    await first.click();
    await page.keyboard.press('Backspace');

    const toasts = page.getByRole('region', { name: 'Thông báo' });
    await expect(toasts.getByText(`Đã xoá tường ${String(code)}.`, { exact: true })).toBeVisible();
    await expect(toasts).not.toContainText(/W-\d{6}WALL/u);
  });

  test('[bơm] J/K đi giữa các hàng và phím 1 đổi độ dày của tường đang chọn', async ({ page }) => {
    await openSeeded(page);

    /* Hàng đợi L23 xếp theo lý do máy nghi: J/K đi theo đúng thứ tự dòng của danh sách, không gõ cứng mã. */
    const [first, second] = await firstTwoRows(page);
    await first.click();
    await page.keyboard.press('j');
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await expect(first).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('k');
    await expect(first).toHaveAttribute('aria-selected', 'true');

    /* Phím 1 = bậc nhỏ nhất của thang sáu bậc (100 mm). */
    await page.keyboard.press('1');
    await expect(thickness(page)).toHaveValue('100');
  });

  /*
   * Trước B-V7-09 vé hoàn tác trả vùng chọn TRƯỚC lần chọn gần nhất (dòng đầu), không phải
   * vùng chọn lúc lệnh chạy (dòng kế theo hàng đợi) — hoàn tác nhảy vùng chọn về hàng cũ.
   */
  test('[bơm] Ctrl+Z trả độ dày và giữ tường đang chọn lúc đổi (B-V7-09, A8)', async ({ page }) => {
    await openSeeded(page);

    const [first, second] = await firstTwoRows(page);
    await first.click();
    await page.keyboard.press('j');
    await expect(second).toHaveAttribute('aria-selected', 'true');
    /* Dòng kế của bộ mẫu chưa dày 100 mm (các hàng nghi đầu lệch bậc: 330, 235…), nên phím 1 là thay đổi thật. */
    await expect(thickness(page)).not.toHaveValue('100');

    await page.keyboard.press('1');
    await expect(thickness(page)).toHaveValue('100');

    await page.keyboard.press('Control+z');

    await expect(thickness(page)).not.toHaveValue('100');
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await expect(list(page).getByRole('option', { selected: true })).toHaveCount(1);
  });

  test('[bơm] Escape bỏ chọn tường (B-V6-11)', async ({ page }) => {
    await openSeeded(page);

    /* Dòng đầu của hàng đợi L23 (xếp theo lý do), không gõ cứng một mã. */
    const first = list(page).getByRole('option').first();
    await first.click();
    await expect(first).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Escape');
    await expect(list(page).getByRole('option', { selected: true })).toHaveCount(0);
  });

  /*
   * Trước B-V6-12 `IconButton` (components/ui) nhận `isActive` mà không phát `aria-pressed`:
   * sau W/M/V không phần tử nào mang `aria-pressed="true"` — chỉ màu nói công cụ nào bật.
   */
  test('[bơm] phím W bật công cụ vẽ và ray nói ra công cụ đang bật bằng aria-pressed (B-V6-12)', async ({ page }) => {
    await openSeeded(page);
    const rail = page.getByRole('toolbar', { name: 'Công cụ lớp tường' });
    await expect(rail.getByRole('button', { name: 'vẽ tường (phím W)' })).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press('w');

    await expect(rail.getByRole('button', { name: 'vẽ tường (phím W)', pressed: true })).toBeVisible();
    await expect(rail.getByRole('button', { pressed: true })).toHaveCount(1);
  });

  /* L23: công tắc lớp nằm trong popover "Hiển thị" — ô "Lớp tường" thay cho nút "Ẩn lớp tường" cũ. */
  test('[bơm] công tắc lớp viết hoa chữ đầu, tên lớp viết thường: "Lớp tường" trong "Hiển thị" (A6, B-V6-04)', async ({ page }) => {
    await openSeeded(page);
    await page.getByRole('button', { name: 'Hiển thị', exact: true }).click();
    const popover = page.getByRole('dialog', { name: 'Hiển thị trên bản vẽ' });
    const toggle = popover.getByRole('checkbox', { name: 'Lớp tường', exact: true });
    await expect(toggle).toBeChecked();
    /* Ô thật là input sr-only: bấm vào nhãn như người dùng. */
    await popover.getByText('Lớp tường', { exact: true }).click();
    await expect(toggle).not.toBeChecked();
  });
});
