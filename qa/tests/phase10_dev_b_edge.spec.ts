/**
 * Phase 10 · SCR-40e-1..5 — dev routes of group 2 (DataEntryDemo + smoke of the five routes), dev server, anon.
 * FL-10E-01 smoke · FL-10E-02 static states · FL-10E-03 NumericField typing.
 */
import { pathOf } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { demoBlock, settleFrames, typeInto } from './support/p10/P8';
import { devTest as test, expect } from './support/p10/devServer';

const DE_ROUTE = '/data-entry-demo';

test.describe('SCR-40e dev routes b', () => {
  test('SCR-40e-1..5 · FL-10E-01 · anon · Smoke năm route + cổng ẩn danh', async ({ devPage: page }) => {
    test.setTimeout(120_000);
    const landed: string[] = [];
    const visit = async (route: string): Promise<void> => {
      await page.goto(route);
    };
    // Recorded AFTER the landmark is asserted, so a late redirect to /login is seen.
    const record = (): void => {
      landed.push(pathOf(page.url()));
    };

    await test.step('[10E-A-001] mở /data-entry-demo', async () => {
      await visit(DE_ROUTE);
      await expect(page.getByRole('heading', { name: 'Data Entry Components', level: 1 })).toBeVisible(); // DataEntryDemo.tsx:23
      expect(pathOf(page.url())).toBe(DE_ROUTE);
      record();
      await captureEvidence(page, 'E10_10E-A-001_smoke_data-entry-demo.png');
    });
    await test.step('[10E-A-011] mở /list-review-demo', async () => {
      await visit('/list-review-demo');
      // ⚑ N-1: useToast without Toast.Provider may land on RouteErrorScreen — correct behaviour is the demo.
      await expect.soft(page.getByText('States:', { exact: true })).toBeVisible(); // ListReviewDemo.tsx:64
      record();
      await captureEvidence(page, 'E10_10E-A-011_smoke_list-review-demo.png');
    });
    await test.step('[10E-A-027] mở /shell-demo', async () => {
      await visit('/shell-demo');
      await expect.soft(page.getByRole('heading', { name: 'Canvas Area', level: 2 })).toBeVisible(); // ShellDemo.tsx:55
      record();
      await captureEvidence(page, 'E10_10E-A-027_smoke_shell-demo.png');
    });
    await test.step('[10E-A-043] mở /demo/canvas-overlays', async () => {
      await visit('/demo/canvas-overlays');
      await expect.soft(page.getByRole('heading', { name: 'Canvas Overlays Demo', level: 1 })).toBeVisible(); // CanvasOverlaysDemo.tsx:87
      record();
      await captureEvidence(page, 'E10_10E-A-043_smoke_canvas-overlays.png');
    });
    await test.step('[10E-A-054] mở /feedback-demo', async () => {
      await visit('/feedback-demo');
      await expect.soft(page.getByRole('button', { name: 'Test Undo Toast', exact: true })).toBeVisible(); // FeedbackDemo.tsx:59
      record();
      await captureEvidence(page, 'E10_10E-A-054_smoke_feedback-demo.png');
    });
    await test.step('[10E-A-075] URL cuối mỗi lần = route, không /login', async () => {
      expect.soft(landed).toEqual([DE_ROUTE, '/list-review-demo', '/shell-demo', '/demo/canvas-overlays', '/feedback-demo']);
      await captureEvidence(page, 'E10_10E-A-075_smoke_urls-kept.png');
    });
    await test.step('[10E-A-076] /khong-ton-tai ẩn danh về /login', async () => {
      await page.goto('/khong-ton-tai');
      await expect.soft(page).toHaveURL(/\/login(?:[/?#]|$)/u); // paths.ts DEV_PUBLIC_ROUTE_PATTERNS: only dev routes are public
      expect.soft(pathOf(page.url()).startsWith('/login')).toBe(true);
      await captureEvidence(page, 'E10_10E-A-076_smoke_unknown-route-login.png');
    });
  });

  test('SCR-40e-1 · FL-10E-02 · anon · Trạng thái tĩnh của DataEntryDemo', async ({ devPage: page }) => {
    await page.goto(DE_ROUTE);
    await expect(page.getByRole('heading', { name: 'Data Entry Components', level: 1 })).toBeVisible();

    await test.step('[10E-B-001] NumericField #1 rỗng', async () => {
      const b = demoBlock(page, '1. Empty');
      await expect(b.getByPlaceholder('Nhập giá trị...')).toHaveValue('');
      await expect(b.getByText('mm', { exact: true })).toBeVisible();
      await captureEvidence(page, 'E10_10E-B-001_data_entry_empty.png');
    });
    await test.step('[10E-B-002] #2 đã commit', async () => {
      const b = demoBlock(page, '2. Valid / Committed');
      await expect.soft(b.getByRole('textbox')).toHaveValue('248,6');
      await expect.soft(b.getByText('m2', { exact: true })).toBeVisible();
      await captureEvidence(page, 'E10_10E-B-002_data_entry_valid.png');
    });
    await test.step('[10E-B-003] #3 lúc nghỉ chưa có lỗi', async () => {
      const b = demoBlock(page, '3. Invalid (Min: 50)');
      await expect.soft(b.getByRole('textbox')).toHaveValue('48');
      await expect.soft(b.getByText('mm', { exact: true })).toBeVisible();
      // ⚑ N-3: the caption says "Invalid" but validate only runs on typing/commit — correct behaviour: no message at rest
      await expect.soft(b.getByRole('alert')).toHaveCount(0);
      await captureEvidence(page, 'E10_10E-B-003_data_entry_invalid-rest.png');
    });
    await test.step('[10E-B-004] #4 có gợi ý', async () => {
      const b = demoBlock(page, '4. With Hint');
      await expect.soft(b.getByText('Giá trị thường nằm trong khoảng 8 - 20 mm/px', { exact: true })).toBeVisible();
      await expect.soft(b.getByRole('textbox')).toHaveValue('21');
      await captureEvidence(page, 'E10_10E-B-004_data_entry_hint.png');
    });
    await test.step('[10E-B-005] #5 disabled', async () => {
      const input = demoBlock(page, '5. Disabled').getByRole('textbox');
      await expect.soft(input).toBeDisabled();
      await expect.soft(input).toHaveValue('34');
      await captureEvidence(page, 'E10_10E-B-005_data_entry_disabled.png');
    });
    await test.step('[10E-B-006] #6 chỉ đọc', async () => {
      const b = demoBlock(page, '6. Read-only');
      // Input.tsx:67-72 — read-only renders text, not an input
      await expect.soft(b.getByText('14', { exact: true })).toBeVisible();
      await expect.soft(b.getByRole('textbox')).toHaveCount(0);
      await captureEvidence(page, 'E10_10E-B-006_data_entry_readonly.png');
    });
    await test.step('[10E-B-007] #7 và Select đang tải là skeleton', async () => {
      const nf = demoBlock(page, '7. Loading');
      await expect.soft(nf.locator('.animate-pulse')).toBeVisible();
      await expect.soft(nf.getByRole('textbox')).toHaveCount(0);
      const sel = demoBlock(page, 'Select (Loading)');
      await expect.soft(sel.locator('.animate-pulse')).toBeVisible(); // Select.tsx:324
      await expect.soft(sel.getByRole('textbox')).toHaveCount(0);
      await expect.soft(sel.getByRole('button')).toHaveCount(0);
      await captureEvidence(page, 'E10_10E-B-007_data_entry_loading.png');
    });
    await test.step('[10E-B-008] Combobox disabled', async () => {
      const trigger = demoBlock(page, 'Combobox (Disabled)').getByRole('button', { name: 'Vách gỗ công nghiệp' });
      await expect.soft(trigger).toBeDisabled();
      await captureEvidence(page, 'E10_10E-B-008_data_entry_combobox-disabled.png');
    });
    await test.step('[10E-B-009] FieldRow', async () => {
      const sec = page.getByRole('heading', { name: 'FieldRow Layout (Property Panel)', level: 2 }).locator('xpath=..');
      for (const label of ['Diện tích', 'Mã trục', 'Loại tường', 'Khoảng cách']) {
        await expect.soft(sec.getByText(label, { exact: true })).toBeVisible();
      }
      const boxes = sec.getByRole('textbox');
      await expect.soft(boxes.nth(0)).toHaveValue('248,6');
      await expect.soft(boxes.nth(1)).toHaveValue('A1-B2');
      await expect.soft(sec.getByRole('button', { name: 'Tường gạch 220' })).toBeVisible();
      await expect.soft(boxes.nth(2)).toHaveValue('14');
      await expect.soft(sec.getByText('Giá trị thường nằm trong khoảng 8 - 20 mm', { exact: true })).toBeVisible();
      await captureEvidence(page, 'E10_10E-B-009_data_entry_fieldrow.png');
    });
    await test.step('[10E-E-003] tên truy cập các ô NumericField', async () => {
      // ⚑ a11y: the h3 captions are not tied to the inputs (DataEntryDemo.tsx:30-55); correct behaviour is a non-empty name
      const boxes = await page.getByRole('textbox').all();
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) await expect.soft(box).toHaveAccessibleName(/\S/u);
      await captureEvidence(page, 'E10_10E-E-003_data_entry_accessible-names.png');
    });
  });

  test('SCR-40e-1 · FL-10E-03 · anon · NumericField: gõ, mũi tên, Esc, lỗi', async ({ devPage: page }) => {
    test.setTimeout(120_000);
    await page.goto(DE_ROUTE);
    await expect(page.getByRole('heading', { name: 'Data Entry Components', level: 1 })).toBeVisible();
    const two = demoBlock(page, '2. Valid / Committed').getByRole('textbox');
    const three = demoBlock(page, '3. Invalid (Min: 50)').getByRole('textbox');
    const threeAlert = demoBlock(page, '3. Invalid (Min: 50)').getByRole('alert');

    await test.step('[10E-A-002] #2 gõ 300 + Tab', async () => {
      await typeInto(two, '300', true);
      await expect(two).toHaveValue('300'); // useNumericField.ts:handleBlur → commit
      await captureEvidence(page, 'E10_10E-A-002_numeric_typed-300.png');
    });
    await test.step('[10E-A-003] ArrowUp / Shift+ArrowUp / ArrowDown', async () => {
      await two.focus();
      await settleFrames(page);
      await two.press('ArrowUp');
      await expect.soft(two).toHaveValue('301'); // useNumericField.ts:handleKeyDown step 1, Shift ×10
      await two.press('Shift+ArrowUp');
      await expect.soft(two).toHaveValue('311');
      await two.press('ArrowDown');
      await expect.soft(two).toHaveValue('310');
      await two.press('Tab'); // commit 310 so the next step has a known last commit
      await expect.soft(two).toHaveValue('310');
      await captureEvidence(page, 'E10_10E-A-003_numeric_arrows.png');
    });
    await test.step('[10E-A-004] gõ 999 rồi Esc', async () => {
      await typeInto(two, '999', false);
      await two.press('Escape'); // useNumericField.ts:handleKeyDown Escape
      await expect.soft(two).toHaveValue('310');
      await two.press('Tab');
      await captureEvidence(page, 'E10_10E-A-004_numeric_escape.png');
    });
    await test.step('[10E-A-009] Input "A1-B2" không ghi được', async () => {
      const row = page.getByText('Mã trục', { exact: true }).locator('xpath=ancestor::div[contains(@class,"min-h-[36px]")][1]').getByRole('textbox'); // FieldRow.tsx
      await expect.soft(row).toHaveValue('A1-B2');
      await row.focus();
      await page.keyboard.type('XY'); // DataEntryDemo.tsx:89 — value without onChange
      await expect.soft(row).toHaveValue('A1-B2');
      await captureEvidence(page, 'E10_10E-A-009_numeric_axis-input.png');
    });
    await test.step('[10E-A-010] Tab không dừng ở ô/Combobox disabled', async () => {
      await expect.soft(page.locator('input:disabled')).toHaveCount(1);
      await expect.soft(page.locator('button:disabled')).toHaveCount(1);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const stops = (await page.locator('input:not(:disabled), button:not(:disabled)').count()) + 1;
      for (let i = 0; i < stops; i++) {
        await page.keyboard.press('Tab');
        const disabledFocused = await page.evaluate(() => document.activeElement?.matches(':disabled') ?? false);
        expect.soft(disabledFocused).toBe(false);
      }
      await captureEvidence(page, 'E10_10E-A-010_numeric_tab-order.png');
    });
    await test.step('[10E-C-001] #3 gõ 30', async () => {
      await typeInto(three, '30', false);
      await expect.soft(threeAlert).toHaveText('Giá trị không nhỏ hơn 50 mm.'); // useNumericField.ts:validate
      await captureEvidence(page, 'E10_10E-C-001_numeric_below-min.png');
    });
    await test.step('[10E-C-002] #3 gõ abc', async () => {
      await typeInto(three, 'abc', false);
      await expect.soft(threeAlert).toHaveText('Nhập một số.');
      await captureEvidence(page, 'E10_10E-C-002_numeric_not-a-number.png');
    });
    await test.step('[10E-C-006] #3 xoá hết chữ', async () => {
      await typeInto(three, '', false);
      await expect.soft(threeAlert).toHaveCount(0);
      await captureEvidence(page, 'E10_10E-C-006_numeric_cleared.png');
    });
    await test.step('[10E-C-003] #3 gõ 30 rồi Tab', async () => {
      await typeInto(three, '30', true);
      await expect.soft(three).toHaveValue('30'); // refused value stays beside its message
      await expect.soft(threeAlert).toHaveText('Giá trị không nhỏ hơn 50 mm.');
      await captureEvidence(page, 'E10_10E-C-003_numeric_error-kept.png');
    });
    await test.step('[10E-C-004] #3 sửa thành 60 + Tab', async () => {
      await typeInto(three, '60', true);
      await expect.soft(three).toHaveValue('60');
      await expect.soft(threeAlert).toHaveCount(0);
      await captureEvidence(page, 'E10_10E-C-004_numeric_fixed.png');
    });
    await test.step('[10E-C-005] #3 đặt lại 48 rồi ArrowDown', async () => {
      await typeInto(three, '48', true);
      await three.focus();
      await settleFrames(page);
      await three.press('ArrowDown'); // useNumericField.ts: clamp to min → 50
      await expect.soft(three).toHaveValue('50');
      await expect.soft(threeAlert).toHaveCount(0);
      await captureEvidence(page, 'E10_10E-C-005_numeric_clamp-min.png');
    });
  });
});
