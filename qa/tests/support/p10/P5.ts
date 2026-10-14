/** P5 helpers for /design-system (src/screens/DesignSystem.tsx) and /demo (src/App.tsx). */
import { expect, type Locator, type Page } from '@playwright/test';

/** Opens /design-system and waits for the named h1 (DesignSystem.tsx:28). */
export async function openDesignSystem(page: Page): Promise<void> {
  await page.goto('/design-system');
  await expect(page.getByRole('heading', { name: 'Quiet Blueprint v1.1', exact: true, level: 1 })).toBeVisible();
}

/** Opens /demo and waits for the shell h1 (App.tsx:70). */
export async function openDemo(page: Page): Promise<void> {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Demo App', exact: true, level: 1 })).toBeVisible();
}

/** Toggle switch by aria-label (DesignSystem.tsx:163-178). */
export const toggle = (page: Page, name: string): Locator => page.getByRole('switch', { name, exact: true });

/** Segmented radio by its visible label (SegmentedControl.tsx:69, role=radio + aria-checked). */
export const radio = (page: Page, name: string): Locator => page.getByRole('radio', { name, exact: true });

/** Every enabled button of the page in DOM order, as a name list (for the Tab-order check). */
export async function enabledButtonNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button:not([disabled])')).map(
      (b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? '',
    ),
  );
}

/** Name of the focused element (aria-label, else text). */
export async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? '';
  });
}
