/**
 * Phase 10 — /demo and /design-system, dedicated UI-verification flow (skill `qa-verify-ui`, FL-10D-09), 1920/1440/1024/768.
 * Source: src/App.tsx (shell, nav buttons), src/screens/MotionDemo.tsx, src/screens/system/StateGallery.tsx, DesignSystem.tsx.
 */
import type { Page } from '@playwright/test';

import { devTest as test, expect } from './support/p10/devServer';
import { verifyUi } from './support/ui-verify';
import { DESKTOP_VIEWPORTS } from './support/p10/viewports';
import { openDemo, openDesignSystem, radio, toggle } from './support/p10/P5';

/** No horizontal page scroll at any measured width. */
function expectNoHScroll(metrics: readonly { viewport: string; horizontalOverflowPx: number }[]): void {
  for (const m of metrics) expect.soft(m.horizontalOverflowPx, `h-scroll at ${m.viewport}`).toBeLessThanOrEqual(0);
}

/** `open` for a /demo screen: the shell, then the left-bar button `label` (App.tsx:78) when given, then its marker. */
function demoScreen(label: string, marker: (p: Page) => ReturnType<Page['getByText']>): (p: Page) => Promise<void> {
  return async (p) => {
    await openDemo(p);
    if (label !== '') await p.getByRole('button', { name: label, exact: true }).click();
    await expect(marker(p)).toBeVisible();
  };
}

test('SCR-40 · FL-10D-09 · anon · UI /demo và /design-system 4 khổ', async ({ devPage: page }) => {
  test.setTimeout(240_000);

  await test.step('[10D-F-101] /demo mặc định 4 khổ', async () => {
    const m = await verifyUi(page, 'D10_10D-F-101_demo', demoScreen('', (p) => p.getByText('Foundation Components Demo', { exact: true })), DESKTOP_VIEWPORTS);
    expectNoHScroll(m);
  });

  await test.step('[10D-F-102] MotionDemo 8 mục 4 khổ', async () => {
    const m = await verifyUi(page, 'D10_10D-F-102_motion', demoScreen('Motion & Transitions', (p) => p.getByRole('heading', { name: 'Chuyển cảnh và nhịp', exact: true })), DESKTOP_VIEWPORTS); // MotionDemo:75
    expectNoHScroll(m);
  });

  await test.step('[10D-F-103] State Gallery (QA) 4 khổ', async () => {
    const m = await verifyUi(page, 'D10_10D-F-103_state_gallery', demoScreen('State Gallery (QA)', (p) => p.getByRole('heading', { name: 'State Gallery (QA)', exact: true, level: 1 })), DESKTOP_VIEWPORTS); // StateGallery.tsx:42
    expectNoHScroll(m);
  });

  await test.step('[10D-F-201] /design-system 4 khổ', async () => {
    const m = await verifyUi(page, 'D10_10D-F-201_design_system', openDesignSystem, DESKTOP_VIEWPORTS);
    expectNoHScroll(m);
  });

  await test.step('[10D-F-202] /design-system sau tương tác 4 khổ', async () => {
    const jumps: string[] = [];
    const m = await verifyUi(
      page,
      'D10_10D-F-202_design_system_interacted',
      async (p) => {
        await openDesignSystem(p);
        const before = await p.evaluate(() => document.documentElement.scrollHeight);
        await toggle(p, 'Async Toggle').click(); // pending 800 ms (DS:15)
        await radio(p, '3D View').click();
        await expect(radio(p, '3D View')).toHaveAttribute('aria-checked', 'true');
        const after = await p.evaluate(() => document.documentElement.scrollHeight);
        if (before !== after) jumps.push(`${before}->${after}`);
      },
      DESKTOP_VIEWPORTS,
    );
    expectNoHScroll(m);
    expect.soft(jumps, 'page height unchanged by interaction').toEqual([]);
  });
});
