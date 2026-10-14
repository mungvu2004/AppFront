import type { Locator, Page } from '@playwright/test';

/** Left-nav labels of /demo in render order (src/App.tsx:44-54). */
export const DEMO_SCREENS = [
  'Design System',
  'Canvas & Overlays',
  'Data Entry',
  'Shared Controls',
  'Feedback & States',
  'List & Review',
  'App Shell',
  'Motion & Transitions',
  'State Gallery (QA)',
] as const;

/** Left nav buttons (App.tsx:70, the `w-[240px]` column). */
export const navButtons = (page: Page): Locator => page.locator('div.w-\\[240px\\] button');

/** One nav button by its exact label. */
export const navButton = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });

/** ScreenCrashFallback is an EmptyState with the violation-tint icon inside the right pane (App.tsx:33,106). */
export const crashFallback = (page: Page): Locator =>
  page.locator('div.absolute.inset-0.bg-bg-app .bg-state-violation-tint');

/** Phase caption of MotionDemo (MotionDemo.tsx:131, aria-live=polite span). */
export const phaseCaption = (page: Page): Locator => page.locator('span[aria-live="polite"]');

/** Rows of the staggered list (MotionDemo.tsx:158-170). */
export const motionRows = (page: Page): Locator => page.locator('ul > li');

/** Delay values 'trễ Xms' of every row. */
export async function rowDelays(page: Page): Promise<number[]> {
  const texts = await page.locator('ul > li span.font-mono').allTextContents();
  return texts.map((t) => Number(/trễ (\d+)ms/u.exec(t)?.[1] ?? Number.NaN));
}

/** Records every caption text from now on into `window.__phases` (phases last only ~100s of ms). */
export async function recordCaption(page: Page): Promise<void> {
  await page.evaluate(() => {
    const el = document.querySelector('span[aria-live="polite"]');
    const w = window as unknown as { __phases: string[] };
    w.__phases = [el?.textContent ?? ''];
    new MutationObserver(() => w.__phases.push(el?.textContent ?? '')).observe(el as Node, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
}

/** Captions recorded by `recordCaption`. */
export const recordedCaptions = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __phases: string[] }).__phases);
