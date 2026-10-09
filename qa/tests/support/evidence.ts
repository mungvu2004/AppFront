import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, type Page } from '@playwright/test';

/** `<E2E_RESULTS_DIR>/<E2E_RUN_ID>/evidence/` — same root as the reports in `playwright.config.ts`. */
export const RUN_ID = process.env.E2E_RUN_ID ?? 'run-01';
export const EVIDENCE_DIR = join(process.env.E2E_RESULTS_DIR ?? 'F:/App/qa-results', RUN_ID, 'evidence');

const EVIDENCE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.png$/u;
const JSON_EVIDENCE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.json$/u;
const takenThisProcess = new Set<string>();

/** Hero canvas wait budget; after one miss (no WebGL in this browser) later captures stop waiting. */
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
  const drawn = await page.evaluate(async (timeoutMs) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.bg-scene-backdrop > canvas');
    if (canvas === null || canvas.clientHeight === 0) return true;
    const deadline = performance.now() + timeoutMs;
    while (canvas.width === 300 && canvas.height === 150) {
      if (performance.now() > deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return true;
  }, HERO_FRAME_TIMEOUT_MS);
  if (!drawn) {
    heroUnavailable = true;
    test.info().annotations.push({ type: 'evidence', description: 'login hero canvas never mounted (no WebGL?)' });
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

/**
 * Screenshot named exactly as the Master Matrix "Evidence Name Pattern" (E2E-TEST-PLAN.md §4),
 * attached to the current test so the report traces it back to its test case.
 * Throws when a second test case in the same run reuses a name (never overwrite another case's evidence).
 */
export async function captureEvidence(
  page: Page,
  name: string,
  { fullPage = false }: { readonly fullPage?: boolean } = {},
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
  await page.screenshot({ path, fullPage, animations: 'disabled' });
  await test.info().attach(name, { path, contentType: 'image/png' });

  return path;
}
