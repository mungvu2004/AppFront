/**
 * Phase 10 — /design-system (SCR-40, dev server mock). Flows FL-10D-03, FL-10D-04. Source: src/screens/DesignSystem.tsx (DS),
 * src/components/ui/{Toggle,SegmentedControl,Button,IconButton}.tsx. Evidence `D10_<row id>_<slug>.png`.
 */
import { devTest as test, expect } from './support/p10/devServer';
import { captureEvidence } from './support/evidence';
import { enabledButtonNames, focusedName, openDesignSystem, radio, toggle } from './support/p10/P5';

test('SCR-40 · FL-10D-03 · anon · /design-system: nội dung và trạng thái tĩnh', async ({ devPage: page }) => {
  await test.step('[10D-A-201] mở /design-system', async () => {
    await page.goto('/design-system');
    await expect(page.getByRole('heading', { name: 'Quiet Blueprint v1.1', exact: true, level: 1 })).toBeVisible(); // DS:28
    await expect(page.getByText('Foundation Components Demo', { exact: true })).toBeVisible(); // DS:29
    expect(new URL(page.url()).pathname).toBe('/design-system');
    await captureEvidence(page, 'D10_10D-A-201_open.png');
  });

  await test.step('[10D-A-202] 4 mục h2', async () => {
    const h2 = await page.getByRole('heading', { level: 2 }).allTextContents(); // DS:34,97,114,159
    expect.soft(h2).toEqual(['Buttons', 'Icon Buttons', 'Segmented Control', 'Toggle']);
    await captureEvidence(page, 'D10_10D-A-202_sections.png');
  });

  await test.step('[10D-A-203] lưới 4 cột nút', async () => {
    const h3 = await page.getByRole('heading', { level: 3 }).allTextContents(); // DS:38,48,58,68 first four
    expect.soft(h3.slice(0, 4)).toEqual(['Primary', 'Secondary', 'Ghost', 'Danger']);
    await expect.soft(page.getByRole('button', { name: 'Delete Project', exact: true })).toBeVisible(); // DS:70
    await expect.soft(page.getByRole('button', { name: 'Deleting...', exact: true })).toBeVisible(); // DS:72
    await expect.soft(page.getByRole('button', { name: 'With Icon & Shortcut' })).toBeVisible(); // DS:41
    await captureEvidence(page, 'D10_10D-A-203_button_grid.png');
  });

  await test.step('[10D-A-204] kích cỡ', async () => {
    await expect.soft(page.getByRole('button', { name: 'Small (32px)', exact: true })).toBeVisible(); // DS:81
    await expect.soft(page.getByRole('button', { name: 'Medium (36px)', exact: true })).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Large (44px / 40px from 640px)', exact: true })).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Settings', exact: true }).first()).toBeVisible(); // DS:87
    await expect.soft(page.getByRole('button', { name: 'Loading Settings', exact: true })).toBeVisible(); // DS:88
    await captureEvidence(page, 'D10_10D-A-204_sizes.png');
  });

  await test.step('[10D-A-205] 3 nhóm segmented', async () => {
    await expect.soft(page.getByRole('radiogroup')).toHaveCount(3); // SegmentedControl:108
    await expect.soft(radio(page, '2D Plan')).toHaveAttribute('aria-checked', 'true'); // DS:120
    await expect.soft(radio(page, '110 mm')).toHaveAttribute('aria-checked', 'true'); // DS:132
    await expect.soft(radio(page, 'Draft')).toHaveAttribute('aria-checked', 'true'); // DS:144
    await expect.soft(radio(page, 'Review')).toBeDisabled(); // DS:147
    await captureEvidence(page, 'D10_10D-A-205_segmented.png');
  });

  await test.step('[10D-B-201] bấm nút loading', async () => {
    const loading = page.getByRole('button', { name: 'Loading', exact: true }); // DS:42,52,62 + IconButton DS:105
    const n = await loading.count();
    expect.soft(n).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < n; i += 1) {
      await expect.soft(loading.nth(i)).toBeDisabled(); // Button.tsx:41 isDisabled = disabled || loading
      await loading.nth(i).click({ force: true });
    }
    await expect.soft(page.getByRole('button', { name: 'Deleting...', exact: true })).toBeDisabled();
    await expect.soft(page.getByRole('heading', { name: 'Quiet Blueprint v1.1', level: 1 })).toBeVisible();
    await captureEvidence(page, 'D10_10D-B-201_loading.png');
  });

  await test.step('[10D-B-202] mọi điều khiển Disabled', async () => {
    const disabledBtns = page.getByRole('button', { name: 'Disabled', exact: true }); // DS:43,53,63,73 + IconButton DS:106
    await expect.soft(disabledBtns).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) await expect.soft(disabledBtns.nth(i)).toBeDisabled();
    await expect.soft(toggle(page, 'Disabled Toggle')).toBeDisabled(); // DS:178
    await captureEvidence(page, 'D10_10D-B-202_disabled.png');
  });

  await test.step('[10D-B-203] IconButton active/loading', async () => {
    await expect.soft(page.getByRole('button', { name: 'Check (Active)', exact: true })).toHaveAttribute('aria-pressed', 'true'); // IconButton:36
    const iconLoading = page.getByRole('button', { name: 'Loading', exact: true }).last(); // DS:105; loading => disabled (IconButton:27)
    await expect.soft(iconLoading).toBeDisabled();
    await captureEvidence(page, 'D10_10D-B-203_icon_active_loading.png');
  });
});

test('SCR-40 · FL-10D-04 · anon · /design-system: Toggle, Segmented, bàn phím', async ({ devPage: page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.clock.install(); // timers keep real time until fast-forwarded; DEMO_LATENCY_MS = 800 (DS:9)
  await openDesignSystem(page);
  await page.clock.pauseAt(Date.now() + 1000); // freeze timers: only runFor advances the 800 ms

  await test.step('[10D-B-204] Simple Toggle', async () => {
    const t = toggle(page, 'Simple Toggle');
    await expect(t).toHaveAttribute('aria-checked', 'false');
    await t.click();
    await expect(t).toHaveAttribute('aria-checked', 'true'); // Toggle.tsx:36-50, no onChange => instant
    await captureEvidence(page, 'D10_10D-B-204_simple_on.png');
    await t.click();
    await expect(t).toHaveAttribute('aria-checked', 'false');
  });

  await test.step('[10D-B-205] Async Toggle', async () => {
    const t = toggle(page, 'Async Toggle');
    await expect.soft(t).toHaveAttribute('aria-checked', 'false');
    await t.click();
    await page.clock.runFor(900);
    await expect.soft(t).toHaveAttribute('aria-checked', 'true'); // DS:15-16
    await captureEvidence(page, 'D10_10D-B-205_async_on.png');
  });

  await test.step('[10D-B-206] Error Toggle', async () => {
    const t = toggle(page, 'Error Toggle');
    await t.click();
    await expect.soft(t).toHaveAttribute('aria-checked', 'true'); // optimistic, Toggle.tsx:34
    await captureEvidence(page, 'D10_10D-B-206_error_optimistic.png');
    await page.clock.runFor(900);
    await expect.soft(t).toHaveAttribute('aria-checked', 'false'); // rollback Toggle.tsx:51-56
    expect.soft(pageErrors, 'no uncaught page error').toEqual([]);
  });

  await test.step('[10D-C-204] Async Toggle bấm 2 lần trong 800 ms', async () => {
    const t = toggle(page, 'Async Toggle'); // true after B-205
    await t.click();
    await t.click();
    await page.clock.runFor(2000);
    const first = await t.getAttribute('aria-checked');
    await page.clock.runFor(2000);
    await expect.soft(t).toHaveAttribute('aria-checked', first ?? 'unreachable'); // stable, not stuck optimistic
    expect.soft(first, 'two toggles cancel out').toBe('true');
    await captureEvidence(page, 'D10_10D-C-204_race.png');
  });

  await test.step('[10D-C-201] segmented click', async () => {
    await radio(page, '3D View').click();
    await expect.soft(radio(page, '3D View')).toHaveAttribute('aria-checked', 'true');
    await expect.soft(radio(page, '2D Plan')).toHaveAttribute('aria-checked', 'false');
    await expect.soft(radio(page, '110 mm')).toHaveAttribute('aria-checked', 'true'); // groups independent
    await captureEvidence(page, 'D10_10D-C-201_segmented_click.png');
  });

  await test.step('[10D-C-203] bấm Review (disabled)', async () => {
    await radio(page, 'Review').click({ force: true });
    await expect.soft(radio(page, 'Review')).toHaveAttribute('aria-checked', 'false');
    await expect.soft(radio(page, 'Draft')).toHaveAttribute('aria-checked', 'true');
    await captureEvidence(page, 'D10_10D-C-203_review_disabled.png');
  });

  await test.step('[10D-C-202] segmented ArrowRight/Left', async () => {
    await radio(page, '3D View').focus(); // current = 3D View
    await page.keyboard.press('ArrowRight'); // SegmentedControl.tsx:131
    await expect.soft(radio(page, 'Data')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight'); // wraps (i+1)%n
    await expect.soft(radio(page, '2D Plan')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowLeft'); // wraps back
    await expect.soft(radio(page, 'Data')).toHaveAttribute('aria-checked', 'true');
    await radio(page, 'Draft').focus(); // Draft -> Review (disabled) is never selected
    await page.keyboard.press('ArrowRight');
    await expect.soft(radio(page, 'Review')).toHaveAttribute('aria-checked', 'false');
    await expect.soft(radio(page, 'Draft')).toHaveAttribute('aria-checked', 'true');
    await captureEvidence(page, 'D10_10D-C-202_segmented_kbd.png');
  });

  await test.step('[10D-E-201] tên truy cập', async () => {
    for (const n of ['Settings', 'Check (Active)', 'Loading', 'Disabled']) {
      await expect.soft(page.getByRole('button', { name: n, exact: true }).first()).toBeVisible(); // DS:102-106
    }
    for (const n of ['Simple Toggle', 'Async Toggle', 'Error Toggle', 'Disabled Toggle']) {
      await expect.soft(toggle(page, n)).toBeVisible(); // DS:163-178
    }
    await captureEvidence(page, 'D10_10D-E-201_a11y_names.png');
  });

  await test.step('[10D-E-202] Tab/Space/Enter', async () => {
    const expected = await enabledButtonNames(page); // DOM order of every enabled control
    await page.getByRole('heading', { name: 'Quiet Blueprint v1.1', level: 1 }).click(); // sets the sequential focus start
    const seen: string[] = [];
    for (let i = 0; i < expected.length; i += 1) {
      await page.keyboard.press('Tab');
      seen.push(await focusedName(page));
    }
    expect.soft(seen).toEqual(expected);
    const t = toggle(page, 'Simple Toggle');
    await t.focus();
    await page.keyboard.press('Space');
    await expect.soft(t).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Enter');
    await expect.soft(t).toHaveAttribute('aria-checked', 'false');
    await captureEvidence(page, 'D10_10D-E-202_keyboard.png');
  });
});
