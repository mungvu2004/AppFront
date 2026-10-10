import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/** `<E2E_RESULTS_DIR>/<E2E_RUN_ID>/evidence/` — same root as the reports in `playwright.config.ts`. */
export const RUN_ID = process.env.E2E_RUN_ID ?? 'run-01';
export const EVIDENCE_DIR = join(process.env.E2E_RESULTS_DIR ?? 'F:/App/qa-results', RUN_ID, 'evidence');

/** `qa.config.json` `rules` — the run's test-data prefix and mail domain (Mailpit catches that domain). */
const RULES = (
  JSON.parse(readFileSync(new URL('../../qa.config.json', import.meta.url), 'utf8')) as {
    rules: { testDataPrefix: string; testEmailDomain: string };
  }
).rules;
/** `rules.testDataPrefix` with this run's id (`qa-run-08-`): cleanup and Mailpit sweeps match on it. */
export const TEST_DATA_PREFIX = RULES.testDataPrefix.replace('{runId}', RUN_ID);
/** `rules.testEmailDomain` (`example.test`). */
export const TEST_EMAIL_DOMAIN = RULES.testEmailDomain;

/**
 * BUG-064: the ONE place a test address is made — `qa-<runId>-<slug>-<unique>@<testEmailDomain>`, unique per call,
 * so an address that must take exactly one attempt never collides with another test or an earlier run.
 */
export function testEmail(slug: string): string {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${TEST_DATA_PREFIX}${slug}-${unique}@${TEST_EMAIL_DOMAIN}`;
}

const EVIDENCE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.png$/u;
const JSON_EVIDENCE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.json$/u;
const takenThisProcess = new Set<string>();

/** Hero canvas wait budget. Only a browser WITHOUT WebGL stops later captures from waiting (review-1). */
const HERO_FRAME_TIMEOUT_MS = 10_000;
let heroUnavailable = false;

/**
 * BUG-061 / BUG-034: the `/login` hero (`ValuePanel.tsx` `HouseModel`) is a WebGL canvas mounted AFTER the form
 * (three.js chunk + plan fetch), so a shot taken as soon as the h1 shows can catch the empty dark frame.
 * `mount.ts` `resize()` calls `renderer.setSize(...)`, which moves the canvas off the default 300x150 buffer, then
 * `loop.invalidate()` owes the first frame; two rAFs later that frame is composited. No hero on the screen, or the
 * panel hidden (< lg) → returns at once. Pixels are not read back: the renderer has no `preserveDrawingBuffer`.
 */
async function waitForHeroFrame(page: Page): Promise<void> {
  if (heroUnavailable) return;
  const outcome = await page.evaluate(async (timeoutMs) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.bg-scene-backdrop > canvas');
    if (canvas === null || canvas.clientHeight === 0) return 'drawn';
    const probe = document.createElement('canvas');
    if ((probe.getContext('webgl2') ?? probe.getContext('webgl')) === null) return 'no-webgl';
    const deadline = performance.now() + timeoutMs;
    while (canvas.width === 300 && canvas.height === 150) {
      if (performance.now() > deadline) return 'timeout';
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return 'drawn';
  }, HERO_FRAME_TIMEOUT_MS);
  if (outcome === 'no-webgl') {
    // This browser cannot draw the hero at all: no later capture in this process can wait it out.
    heroUnavailable = true;
    test.info().annotations.push({ type: 'evidence', description: 'login hero: no WebGL in this browser' });
  } else if (outcome === 'timeout') {
    // WebGL is there but the hero did not draw in time: a soft failure on THIS shot; the next shot waits again.
    expect.soft(outcome, `login hero canvas not drawn within ${HERO_FRAME_TIMEOUT_MS} ms`).toBe('drawn');
  }
}

/**
 * qa-evidence rule 9: a claim the screenshot cannot show (URL, request count/body, cookie expiry) is also
 * attached as JSON next to the shot. Never put a password, token or cookie VALUE in `data`.
 */
export async function attachJson(name: string, data: Record<string, unknown>): Promise<void> {
  if (!JSON_EVIDENCE_NAME.test(name)) {
    throw new Error(`Evidence JSON name "${name}" does not match <id>_<slug>.json`);
  }
  await test.info().attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
}

const CAPTION_ID = 'qa-evidence-caption';

/**
 * BUG-034 / BUG-102: a claim the screen cannot show (URL, request count, cookie) is written ON the shot — a fixed
 * strip at the bottom edge with the page URL first (token values masked), then `lines`. Added just before the screenshot and removed
 * right after (also on failure), so it never takes part in the test. Inline styles: the app's tokens are not
 * guaranteed on every page this runs on. While the strip is up, `body` gets a bottom padding of the strip's height,
 * so the strip covers that padding instead of the page's last element (review-1); the old padding is put back after.
 * ponytail: something the app itself pins `position: fixed` near the bottom can still sit under the strip.
 */
async function withCaption(page: Page, lines: readonly string[], shoot: () => Promise<void>): Promise<void> {
  await page.evaluate(
    ([id, text]) => {
      const strip = document.createElement('div');
      strip.id = id;
      strip.setAttribute('aria-hidden', 'true');
      // A one-time token in the URL is a secret (qa-evidence rule 5): its value never reaches the image.
      const url = `${location.pathname}${location.search}${location.hash}`.replace(/(token=)[^&#]*/gu, '$1…');
      strip.textContent = `[QA evidence] URL: ${url}\n${text}`;
      strip.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647', 'pointer-events:none',
        'padding:6px 10px', 'white-space:pre-wrap', 'word-break:break-all', 'font:12px/16px monospace',
        'background:rgba(0,0,0,0.85)', 'color:#fff',
      ].join(';');
      document.body.append(strip);
      strip.dataset.bodyPaddingBottom = document.body.style.paddingBottom;
      document.body.style.paddingBottom = `${strip.offsetHeight}px`;
    },
    [CAPTION_ID, lines.join('\n')] as const,
  );
  try {
    await shoot();
  } finally {
    await page
      .evaluate((id) => {
        const strip = document.getElementById(id);
        if (strip === null) return;
        document.body.style.paddingBottom = strip.dataset.bodyPaddingBottom ?? '';
        strip.remove();
      }, CAPTION_ID)
      .catch(() => undefined);
  }
}

/**
 * Screenshot named exactly as the Master Matrix "Evidence Name Pattern" (E2E-TEST-PLAN.md §4),
 * attached to the current test so the report traces it back to its test case.
 * Throws when a second test case in the same run reuses a name (never overwrite another case's evidence).
 */
export async function captureEvidence(
  page: Page,
  name: string,
  { fullPage = false, caption }: { readonly fullPage?: boolean; readonly caption?: string | readonly string[] } = {},
): Promise<string> {
  if (!EVIDENCE_NAME.test(name)) {
    throw new Error(`Evidence name "${name}" does not match the Master Matrix pattern (<id>_<slug>.png)`);
  }
  if (takenThisProcess.has(name)) {
    throw new Error(`Evidence "${name}" was already captured by another step in this run`);
  }
  takenThisProcess.add(name);

  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const path = join(EVIDENCE_DIR, name);
  await waitForHeroFrame(page);
  // Finite CSS animations/transitions jump to their end state, so an entrance fade (RecoveryShell
  // `animate-panel-rise`, 340 ms) is never captured half-transparent. JS-driven (motion) animations are not affected.
  const shoot = async (): Promise<void> => {
    await page.screenshot({ path, fullPage, animations: 'disabled' });
  };
  if (caption === undefined) await shoot();
  else await withCaption(page, typeof caption === 'string' ? [caption] : caption, shoot);
  await test.info().attach(name, { path, contentType: 'image/png' });

  return path;
}
