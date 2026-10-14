import { expect, type Locator, type Page } from '@playwright/test';

/** The `<div>` that wraps one `<h3>` caption of DataEntryDemo and its control (src/screens/DataEntryDemo.tsx:27-95). */
export function demoBlock(page: Page, h3: string): Locator {
  return page.getByRole('heading', { name: h3, level: 3, exact: true }).locator('xpath=..');
}

/** Two animation frames: lets the render after a focus land (BUG-224, support/numeric-field.ts). */
export async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

/**
 * Focus a NumericField, replace its text with `text` ('' clears it), check the box shows exactly that, then optionally Tab out
 * (blur commits, src/hooks/useNumericField.ts:handleBlur). Like support/numeric-field.ts `typeHeight`, but Tab is optional.
 */
export async function typeInto(field: Locator, text: string, tabOut: boolean): Promise<void> {
  await field.focus();
  await settleFrames(field.page());
  await field.press('Control+A');
  if (text === '') await field.press('Delete');
  else await field.page().keyboard.insertText(text);
  await expect(field).toHaveValue(text);
  if (tabOut) await field.press('Tab');
}
