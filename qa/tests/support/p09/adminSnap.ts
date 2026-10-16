/**
 * Phase 09 step E: one DOM snapshot of an admin screen, attached BEFORE the expect that may fail so it survives the failure.
 * Names follow `<id>_<slug>.json` (evidence.ts JSON_EVIDENCE_NAME). Read-only: no click, no wait.
 */
import type { Page } from '@playwright/test';

import { attachJson } from '../evidence';

export async function attachAdminSnap(
  page: Page,
  name: string,
  requests: string[] = [],
): Promise<void> {
  const dom = await page.evaluate(() => {
    const text = (el: Element): string => (el.textContent ?? '').trim().replace(/\s+/gu, ' ').slice(0, 120);
    const all = (selector: string): Element[] => Array.from(document.querySelectorAll(selector));
    return {
      headings: all('h1,h2,h3').map(text),
      alerts: all('[role="alert"]').map(text),
      radios: all('[role="radio"]').map((el) => `${text(el)}|${el.getAttribute('aria-checked')}`),
      tabs: all('[role="tab"]').map((el) => `${text(el)}|${el.getAttribute('aria-selected')}`),
      buttons: all('button').map((el) => el.getAttribute('aria-label') ?? text(el)).slice(0, 40),
      asideLabels: all('aside').map((el) => el.getAttribute('aria-label') ?? ''),
      rowCount: all('tr').length,
      srOnlyListItems: all('li').filter((li) => li.querySelector('.sr-only') !== null).map(text),
    };
  });
  await attachJson(name, { url: page.url(), ...dom, requests });
}
