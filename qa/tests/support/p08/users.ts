/**
 * Shared users helpers (P9, P10, P11). Re-exported by each P<n>.ts so specs keep their imports.
 *
 * Exports:
 *   type Json = Record<string, unknown>
 *   pickOption(page: Page, combobox: Locator, option: string): Promise<void>   open the combobox, click the exact option (P9 + P11)
 * Kept per pack (different signature or meaning): asList/str (P9 strict, P11 lenient), userRow, inviteUser/inviteApi, removeUser/deleteUser,
 *   recordGets/recordWrites, ROLE_LABEL/STATUS_LABEL (P9) vs ROLE/STATUS (P11), wireError (P10).
 */
import type { Locator, Page } from '@playwright/test';

export type Json = Record<string, unknown>;

export async function pickOption(page: Page, combobox: Locator, option: string): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
