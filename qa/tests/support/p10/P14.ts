/** P14 helpers (phase 10, QA-10): geometry asserts for the dev c_ui spec. */
import { expect, type Locator, type Page } from '@playwright/test';

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Box of a locator that must already be visible (the caller awaits visibility first). */
async function boxOf(target: Locator, what: string): Promise<Box> {
  const box = await target.boundingBox();
  expect(box, `${what}: has a layout box`).not.toBeNull();
  return box as Box;
}

/** Soft: the element lies inside the current viewport (1px rounding slack). */
export async function expectInViewport(page: Page, target: Locator, what: string): Promise<void> {
  const box = await boxOf(target, what);
  const vp = page.viewportSize() as { width: number; height: number };
  expect.soft(box.x, `${what}: left edge`).toBeGreaterThanOrEqual(-1);
  expect.soft(box.y, `${what}: top edge`).toBeGreaterThanOrEqual(-1);
  expect.soft(box.x + box.width, `${what}: right edge`).toBeLessThanOrEqual(vp.width + 1);
  expect.soft(box.y + box.height, `${what}: bottom edge`).toBeLessThanOrEqual(vp.height + 1);
}

/** Soft: `inner` lies inside `outer`. */
export async function expectInside(outer: Locator, inner: Locator, what: string): Promise<void> {
  const o = await boxOf(outer, `${what} container`);
  const i = await boxOf(inner, what);
  expect.soft(i.x, `${what}: left`).toBeGreaterThanOrEqual(o.x - 1);
  expect.soft(i.y, `${what}: top`).toBeGreaterThanOrEqual(o.y - 1);
  expect.soft(i.x + i.width, `${what}: right`).toBeLessThanOrEqual(o.x + o.width + 1);
  expect.soft(i.y + i.height, `${what}: bottom`).toBeLessThanOrEqual(o.y + o.height + 1);
}

/** Soft: no two of the given elements overlap. */
export async function expectNoOverlap(items: readonly { readonly name: string; readonly target: Locator }[]): Promise<void> {
  const boxes: { name: string; box: Box }[] = [];
  for (const it of items) boxes.push({ name: it.name, box: await boxOf(it.target, it.name) });
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const p = (boxes[a] as { box: Box }).box;
      const q = (boxes[b] as { box: Box }).box;
      const overlaps = p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
      expect.soft(overlaps, `${(boxes[a] as { name: string }).name} overlaps ${(boxes[b] as { name: string }).name}`).toBe(false);
    }
  }
}

/** Soft: the page has no horizontal scroll right now. */
export async function expectNoHScroll(page: Page, what: string): Promise<void> {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect.soft(over, `${what}: horizontal overflow px`).toBeLessThanOrEqual(0);
}

/** Soft: the element's text is not clipped (scroll size within client size). */
export async function expectNotClipped(target: Locator, what: string): Promise<void> {
  const clipped = await target.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
  expect.soft(clipped, `${what}: text is clipped`).toBe(false);
}
