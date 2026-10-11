/**
 * Dedicated UI-verification case (skill `qa-verify-ui`): one screen state × the four review viewports
 * (skill `qa-review-ui`). Per viewport it re-opens the state (layouts read the viewport at mount), measures
 * layout defects in the page, captures `<name>_<width>.png` (full page unless `shot.fullPage` is false), and attaches all metrics as
 * `<name>.json` for the reviewer. Hard defects fail softly (horizontal scroll, controls pushed off-screen,
 * broken images); heuristic ones (clipped text, overlapping or small controls) are data for the review.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { EVIDENCE_DIR, captureEvidence } from './evidence';

export const UI_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
] as const;

/**
 * Project target-size rule: every control ≥ 24 px both ways at every width (WCAG 2.5.8 AA); a TEXT button or link
 * (its name is its own visible text) ≥ 44 px below 640 px (`docs/components-ui.md:14` Button md/lg; icon-only buttons
 * keep their size). Switches, checkboxes, fields and icon-only buttons are held to 24 only, so the "Có tầng hầm" switch
 * (36×24, BUG-158) is not a finding. A link inside a sentence is exempt (2.5.8 "inline" exception).
 */
const TARGET_PX = { min: 24, textBelowSm: 44, sm: 640 } as const;

export interface UiMetrics {
  readonly viewport: string;
  /** Set when `open` failed at this width: the shot and metrics are of whatever the page showed instead. */
  readonly openError?: string;
  readonly horizontalOverflowPx: number;
  readonly offscreen: readonly string[];
  readonly brokenImages: readonly string[];
  readonly clipped: readonly string[];
  readonly overlaps: readonly string[];
  /** `<name> <w>×<h> (< <threshold>)` per {@link TARGET_PX}. */
  readonly smallTargets: readonly string[];
}

function measure(target: typeof TARGET_PX): Omit<UiMetrics, 'viewport'> {
  const vw = window.innerWidth;
  const shown = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
  };
  /** Accessible-name order: aria-labelledby (the referenced elements' text), aria-label, <label>, own text. */
  const labelledBy = (el: Element): string =>
    (el.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/u)
      .map((id) => (id === '' ? '' : (document.getElementById(id)?.textContent ?? '')))
      .join(' ')
      .trim();
  const name = (el: Element): string =>
    (
      labelledBy(el) ||
      el.getAttribute('aria-label') ||
      (el as HTMLInputElement).labels?.[0]?.innerText ||
      ((el as HTMLElement).innerText || el.getAttribute('name') || '')
    )
      .trim()
      .replace(/\s+/gu, ' ')
      .slice(0, 60) || el.tagName.toLowerCase();
  const controls = [
    ...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=checkbox]'),
  ].filter(shown);

  const clipped = [...document.querySelectorAll('body *')]
    .filter((el): el is HTMLElement => el instanceof HTMLElement && shown(el) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
    .filter((el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()))
    .filter((el) => {
      const s = getComputedStyle(el);
      const hides = /hidden|clip/u.test(`${s.overflowX} ${s.overflowY}`) || s.textOverflow === 'ellipsis';
      return hides && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    })
    .map((el) => `${name(el)} (${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight})`);

  const overlaps: string[] = [];
  for (let i = 0; i < controls.length; i += 1) {
    for (let j = i + 1; j < controls.length; j += 1) {
      const [a, b] = [controls[i]!, controls[j]!];
      if (a.contains(b) || b.contains(a)) continue;
      const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 2 && h > 2) overlaps.push(`"${name(a)}" ∩ "${name(b)}" (${Math.round(w)}×${Math.round(h)})`);
    }
  }

  return {
    horizontalOverflowPx: Math.max(0, (document.scrollingElement ?? document.documentElement).scrollWidth - vw),
    offscreen: controls
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > vw + 1 || r.left < -1;
      })
      .map(name),
    brokenImages: [...document.images].filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.currentSrc || img.src),
    clipped,
    overlaps,
    smallTargets: controls
      // 2.5.8 inline exception: a link that sits in a sentence (inline, next to text of its own parent).
      .filter((el) => !(getComputedStyle(el).display === 'inline' && [...(el.parentElement?.childNodes ?? [])].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())))
      .map((el) => {
        const r = el.getBoundingClientRect();
        const role = el.getAttribute('role');
        const isText =
          (el.tagName === 'A' || el.tagName === 'BUTTON' || role === 'button' || role === 'link') &&
          role !== 'switch' &&
          (el as HTMLElement).innerText.trim() !== '';
        const threshold = isText && vw < target.sm ? target.textBelowSm : target.min;
        return { el, r, threshold };
      })
      .filter(({ r, threshold }) => r.width < threshold || r.height < threshold)
      .map(({ el, r, threshold }) => `${name(el)} ${Math.round(r.width)}×${Math.round(r.height)} (< ${threshold})`),
  };
}

/**
 * `open` must bring the page to the state AND wait for a visible marker of it (heading, copy, data-*),
 * never just the URL. `name` = `<prefix>_<slug>` (e.g. `U01_login_empty`).
 * BUG-101: a width where `open` fails does not end the case — that width is still measured and shot (what the
 * page showed instead), `openError` goes into `<name>.json`, every width runs, and the case fails softly at the
 * end. A `test.skip()` inside `open` still skips.
 * BUG-161: a full-page shot of a `position: fixed` drawer/sheet adds the page below the fold under it, so the sheet
 * looks like it floats mid-image. States whose subject is fixed to the viewport pass `{ fullPage: false }`.
 */
export async function verifyUi(
  page: Page,
  name: string,
  open: (page: Page) => Promise<void>,
  viewports: readonly { readonly width: number; readonly height: number }[] = UI_VIEWPORTS,
  shot: { readonly fullPage?: boolean } = {},
): Promise<UiMetrics[]> {
  const fullPage = shot.fullPage ?? true;
  const all: UiMetrics[] = [];
  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto('about:blank');
    let openError: string | undefined;
    try {
      await open(page);
    } catch (error) {
      if (test.info().expectedStatus === 'skipped') throw error;
      // First line of the message, without the ANSI colours Playwright puts in it.
      openError = (error instanceof Error ? error.message : String(error)).replace(/\u001b\[[0-9;]*m/gu, '').split('\n')[0];
    }
    // Web fonts change line breaks; measure after they settle.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    all.push({
      viewport: `${vp.width}x${vp.height}`,
      ...(openError === undefined ? {} : { openError }),
      ...(await page.evaluate(measure, TARGET_PX)),
    });
    await captureEvidence(page, `${name}_${vp.width}.png`, { fullPage });
  }
  // Next to the images, so the reviewer reads one small file instead of decoding results.json.
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(EVIDENCE_DIR, `${name}.json`), JSON.stringify(all, null, 2));
  await test.info().attach(`${name}.json`, { body: JSON.stringify(all, null, 2), contentType: 'application/json' });
  for (const m of all) {
    expect.soft(m.openError, `${m.viewport}: the state did not open`).toBeUndefined();
    expect.soft(m.horizontalOverflowPx, `${m.viewport}: page scrolls horizontally`).toBe(0);
    expect.soft(m.offscreen, `${m.viewport}: controls outside the viewport`).toEqual([]);
    expect.soft(m.brokenImages, `${m.viewport}: broken images`).toEqual([]);
  }
  return all;
}
