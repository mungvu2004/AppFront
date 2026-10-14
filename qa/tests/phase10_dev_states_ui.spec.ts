/**
 * Phase 10 · SCR-40 · /design-system/states — UI at four widths (FL-10D-10, skill qa-verify-ui). Dev server mock.
 * Evidence: verifyUi writes `<name>_<width>.png` + `<name>.json` per viewport.
 */
import { devTest as test, expect } from './support/p10/devServer';
import { DESKTOP_VIEWPORTS } from './support/p10/viewports';
import { verifyUi } from './support/ui-verify';
import {
  ACCOUNT_SCREEN,
  frames,
  freezeQuickCheckTimer,
  openStates,
  runCheck,
  runQuickCheckAndWait,
  selectScreen,
  toggle,
  tree,
} from './support/p10/P6';

test('SCR-40 · FL-10D-10 · anon · UI states 4 khổ', async ({ devPage }) => {
  test.setTimeout(240_000);

  await test.step('[10D-F-301] states empty 4 khổ', async () => {
    const metrics = await verifyUi(
      devPage,
      'D10_10D-F-301_states_empty',
      async (page) => {
        await openStates(page);
        await expect(page.getByText('Chưa chọn màn nào', { exact: true })).toBeVisible();
      },
      DESKTOP_VIEWPORTS,
    );
    for (const m of metrics) expect.soft(m.horizontalOverflowPx, m.viewport).toBeLessThanOrEqual(0);
  });

  await test.step('[10D-F-302] states success 4 khổ', async () => {
    const metrics = await verifyUi(
      devPage,
      'D10_10D-F-302_states_success',
      async (page) => {
        await openStates(page);
        await selectScreen(page, ACCOUNT_SCREEN);
        await expect(page.getByText('Không màn nào còn thiếu trạng thái.', { exact: true })).toBeVisible();
        await expect(frames(page).locator('figure')).toHaveCount(7);
      },
      DESKTOP_VIEWPORTS,
    );
    for (const m of metrics) expect.soft(m.horizontalOverflowPx, m.viewport).toBeLessThanOrEqual(0);
  });

  await test.step('[10D-F-303] states collapsed 4 khổ', async () => {
    const metrics = await verifyUi(
      devPage,
      'D10_10D-F-303_states_collapsed',
      async (page) => {
        await openStates(page);
        await page.getByRole('button', { name: 'Thu gọn cây màn' }).click();
        await expect(page.getByRole('button', { name: 'Mở rộng cây màn' }).first()).toBeVisible();
        await expect(tree(page)).toHaveCount(0); // StateGallery.tsx: CollapsedRail replaces the tree
      },
      DESKTOP_VIEWPORTS,
    );
    for (const m of metrics) expect.soft(m.horizontalOverflowPx, m.viewport).toBeLessThanOrEqual(0);
    // rail = `w-10` (StateGallery.tsx:CollapsedRail) = 40 px; the page is still in the last viewport's collapsed state
    const box = await devPage
      .getByRole('button', { name: 'Mở rộng cây màn' })
      .last()
      .locator('xpath=ancestor::div[contains(@class,"w-10")][1]')
      .boundingBox();
    expect.soft(box?.width).toBe(40);
  });

  await test.step('[10D-F-304] states bảng kiểm mở 4 khổ', async () => {
    const metrics = await verifyUi(
      devPage,
      'D10_10D-F-304_states_check_table',
      async (page) => {
        await openStates(page);
        await runQuickCheckAndWait(page);
      },
      DESKTOP_VIEWPORTS,
    );
    for (const m of metrics) expect.soft(m.horizontalOverflowPx, m.viewport).toBeLessThanOrEqual(0);
  });

  await test.step('[10D-F-305] states loading 4 khổ (timer đóng băng)', async () => {
    const metrics = await verifyUi(
      devPage,
      'D10_10D-F-305_states_loading',
      async (page) => {
        await openStates(page);
        await freezeQuickCheckTimer(page);
        await runCheck(page).click();
        await expect(page.getByRole('status', { name: 'Đang tải bảng trạng thái' })).toBeVisible();
      },
      DESKTOP_VIEWPORTS,
    );
    for (const m of metrics) expect.soft(m.horizontalOverflowPx, m.viewport).toBeLessThanOrEqual(0);
  });

  await test.step('[10D-F-306] states lưới đo bật 4 khổ', async () => {
    const metrics = await verifyUi(
      devPage,
      'D10_10D-F-306_states_spacing_grid',
      async (page) => {
        await openStates(page);
        await selectScreen(page, ACCOUNT_SCREEN);
        const before = await frames(page).locator('figure').first().boundingBox();
        await toggle(page, 'Lưới đo khoảng cách').setChecked(true);
        await expect(frames(page).getByText('Lưới đo khoảng cách', { exact: true })).toBeVisible();
        const after = await frames(page).locator('figure').first().boundingBox();
        // the grid is an absolute overlay inside each frame: frame width must not change
        expect.soft(after?.width, 'frame width unchanged by grid').toBe(before?.width);
      },
      DESKTOP_VIEWPORTS,
    );
    for (const m of metrics) expect.soft(m.horizontalOverflowPx, m.viewport).toBeLessThanOrEqual(0);
  });

  await test.step('[10D-F-307] states chủ đề tối 4 khổ', async () => {
    const metrics = await verifyUi(
      devPage,
      'D10_10D-F-307_states_dark',
      async (page) => {
        await openStates(page);
        await selectScreen(page, ACCOUNT_SCREEN);
        await toggle(page, 'Chủ đề tối').setChecked(true);
        await expect(page.locator('html')).toHaveClass(/\bdark\b/u); // StateGalleryToolbar.tsx header: `dark` class on <html>
      },
      DESKTOP_VIEWPORTS,
    );
    for (const m of metrics) expect.soft(m.horizontalOverflowPx, m.viewport).toBeLessThanOrEqual(0);
  });
});
