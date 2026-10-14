/** P11 helpers for the ShellDemo flows (`/shell-demo`, src/screens/ShellDemo.tsx). */
import { expect, type Locator, type Page } from '@playwright/test';

export const SHELL_ROUTE = '/shell-demo';
export const LEFT_KEY = 'appshell:left-collapsed'; // src/hooks/useAppShell.ts:30
export const RIGHT_KEY = 'appshell:right-collapsed'; // src/hooks/useAppShell.ts:32

/** Button labels, chars verbatim from src/components/shell/AppShell.tsx:226-246. */
export const BTN = {
  collapseLeft: 'Thu gọn panel trái ([)',
  expandLeft: 'Mở panel trái ([)',
  collapseRight: 'Thu gọn panel phải (])',
  expandRight: 'Mở panel phải (])',
  help: 'Phím tắt (?)',
  closeHelp: 'Đóng bảng phím tắt',
} as const;

/** Toolbar buttons `${label} (${shortcut})`, AppShell.tsx:51-54,78. */
export const TOOLS = [
  { name: 'Chọn (V)', key: 'v' },
  { name: 'Tường (W)', key: 'w' },
  { name: 'Kích thước (M)', key: 'm' },
  { name: 'Cửa / lỗ mở (D)', key: 'd' },
] as const;

/** Open `/shell-demo` and wait for its named heading (the landmark every flow starts from). */
export async function openShell(page: Page): Promise<void> {
  await page.goto(SHELL_ROUTE);
  await expect(page.getByRole('heading', { name: 'Canvas Area', exact: true, level: 2 })).toBeVisible();
}

/** PanelWrapper (AppShell.tsx:104) = nearest `[aria-hidden]` ancestor of the panel header text. */
export function panelWrapper(page: Page, header: 'Architecture' | 'Properties'): Locator {
  return page.getByText(header, { exact: true }).locator('xpath=ancestor::div[@aria-hidden][1]');
}

/** Width of a panel wrapper (animated by motion, so callers poll). */
export async function widthOf(loc: Locator): Promise<number> {
  return (await loc.boundingBox())?.width ?? -1;
}

/** Leak guard: drop the persisted collapse flags. */
export async function clearShellStorage(page: Page): Promise<void> {
  await page.evaluate((keys) => { for (const k of keys) localStorage.removeItem(k); }, [LEFT_KEY, RIGHT_KEY]);
}
