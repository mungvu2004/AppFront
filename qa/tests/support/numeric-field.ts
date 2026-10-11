import { expect } from '@playwright/test';
import type { Locator } from '@playwright/test';

/**
 * Types into a NumericField (`src/components/ui/NumericField.tsx`) and blurs: `src/hooks/useNumericField.ts` commits on
 * blur. BUG-224: focusing the box makes `handleFocus` write the committed value back into it; a `fill()` fired right
 * after the focus raced that render and left "32.500" / "10abc". So: focus, let the render land (two frames), select
 * all, insert the text in one go (`''` clears it), check it is exactly what was typed, then Tab.
 */
export async function typeHeight(field: Locator, text: string): Promise<void> {
  const page = field.page();
  await field.focus();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await field.press('Control+A');
  if (text === '') await field.press('Delete');
  else await page.keyboard.insertText(text);
  await expect(field).toHaveValue(text);
  await field.press('Tab');
}
