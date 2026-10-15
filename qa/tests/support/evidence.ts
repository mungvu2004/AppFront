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

/**
 * `--repeat-each` copies of one test run in parallel (RR: 4 workers): same evidence file (EBUSY), same pool user (429 buckets).
 * `''` for copy 0 (RF and R1 keep today's names), `-rep<N>` for copy N > 0.
 */
export const repSuffix = (): string => {
  const index = test.info().repeatEachIndex;
  return index > 0 ? `-rep${String(index)}` : '';
};
/** `slot` + `-rep<N>`; a slot that already carries it (it went through another helper) is left alone. */
export const repSlot = (slot: string): string => {
  const suffix = repSuffix();
  return suffix === '' || slot.endsWith(suffix) ? slot : `${slot}${suffix}`;
};
/** `<id>_<slug>.png` / `.json` → `<id>_<slug>-rep<N>.png` for copy N > 0. */
export const repName = (name: string): string => {
  const suffix = repSuffix();
  return suffix === '' ? name : name.replace(/(\.[a-z]+)$/u, `${suffix}$1`);
};

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
 * BUG-214: next to an open right-hand drawer the strip keeps to the room on the drawer's left.
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
      // BUG-172: toasts / alerts sit on the bottom edge — a strip over them cuts their text. When one is under the
      // strip it goes to the top edge instead (no padding then: it covers the header, not the page's last element).
      const sr = strip.getBoundingClientRect();
      const coversNotice = [...document.querySelectorAll('[role="status"], [role="alert"]')].some((el) => {
        if (strip.contains(el)) return false;
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        const shown = r.width > 8 && r.height > 8 && st.visibility !== 'hidden' && Number(st.opacity) > 0;
        return shown && r.bottom > sr.top && r.top < sr.bottom && r.right > sr.left && r.left < sr.right;
      });
      if (coversNotice) {
        strip.style.top = '0';
        strip.style.bottom = 'auto';
      } else {
        // BUG-214: a right-hand drawer pins its footer button ("Xem tất cả") to the bottom edge, under the strip. When
        // an open dialog under the strip leaves at least MIN_ROOM px on its left, the strip keeps to that room.
        const MIN_ROOM = 320;
        const dialog = [...document.querySelectorAll('[role="dialog"]')]
          .map((el) => el.getBoundingClientRect())
          .find((r) => r.width > 8 && r.bottom > sr.top && r.top < sr.bottom && r.right > sr.left);
        if (dialog !== undefined && dialog.left >= MIN_ROOM) strip.style.right = `${window.innerWidth - dialog.left}px`;
        document.body.style.paddingBottom = `${strip.offsetHeight}px`;
      }
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
 * BUG-172: toasts (`[role=status]`) and list cards re-flow after a mutation (entrance, stacking, reorder). Waits until
 * their boxes and opacity hold still for 3 frames so the shot is not taken mid-fade or with two cards stacked.
 * Best effort: gives up after `budgetMs` and shoots anyway (a moving page must not fail the case here).
 */
async function waitForVisualRest(page: Page, budgetMs = 3_000): Promise<void> {
  await page
    .evaluate(async (budget) => {
      const deadline = performance.now() + budget;
      const sample = (): string =>
        [...document.querySelectorAll('[role="status"], [role="listitem"], li')]
          .slice(0, 80)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)},${getComputedStyle(el).opacity}`;
          })
          .join('|');
      let last = sample();
      let steady = 0;
      while (steady < 3 && performance.now() < deadline) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = sample();
        steady = now === last ? steady + 1 : 0;
        last = now;
      }
    }, budgetMs)
    .catch(() => undefined);
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
  name = repName(name); // repeat copy N > 0 shoots its own file (the pattern still holds: `-rep<N>` is [A-Za-z0-9_-])
  if (takenThisProcess.has(name)) {
    throw new Error(`Evidence "${name}" was already captured by another step in this run`);
  }
  takenThisProcess.add(name);

  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const path = join(EVIDENCE_DIR, name);
  await waitForHeroFrame(page);
  await waitForVisualRest(page);
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

/**
 * BUG-223: Playwright's own `test-failed-1.png` is taken after the test body ends, once the dialog, sheet or wizard the
 * test opened is closed again, so a failed `expect.soft` shows a bare page. Runs `check` (its soft expectations) and,
 * when that added a failure, shoots `name` right away with the broken state still on screen.
 */
export async function shootOnSoftFail(page: Page, name: string, caption: string, check: () => unknown): Promise<void> {
  const before = test.info().errors.length;
  await check();
  if (test.info().errors.length > before) await captureEvidence(page, name, { caption: `SOFT FAIL: ${caption}` });
}
