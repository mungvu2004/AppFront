/**
 * DOM side of the scroll: page blocks with `data-win="a,b,c,d"` fade in over a→b and out
 * over c→d with a small lift; the figure caption follows the figure's left edge.
 */

import { figureRect } from './scene';

/** Opacity / lift of a block whose `data-win="a,b,c,d"` fades in over a→b and out over c→d. */
export function applyWindows(els: readonly HTMLElement[], p: number): void {
  for (const el of els) {
    const [a = 0, b = 0, c = 1, d = 1] = (el.dataset['win'] ?? '').split(',').map(Number);
    const fin = b > a ? Math.min(1, Math.max(0, (p - a) / (b - a))) : p >= a ? 1 : 0;
    const fout = d > c ? Math.min(1, Math.max(0, (p - c) / (d - c))) : p >= c ? 1 : 0;
    const o = fin * (1 - fout);
    const ease = (t: number): number => 1 - (1 - t) ** 3;
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translate3d(0, ${((1 - ease(fin)) * 26 - ease(fout) * 26).toFixed(1)}px, 0)`;
    el.style.visibility = o < 0.005 ? 'hidden' : 'visible';
  }
}

/** Keep the caption under the figure's left edge. */
export function placeCaption(caption: HTMLElement, p: number, W: number, H: number): void {
  const foot = caption.parentElement?.getBoundingClientRect();
  if (foot === undefined) return;
  // Never push the caption (and "Dữ liệu minh hoạ") past the folio on narrow sheets.
  const room = foot.width - caption.offsetWidth - 48;
  caption.style.marginLeft = `${Math.max(0, Math.min(room, figureRect(p, W, H).x - foot.left)).toFixed(1)}px`;
}
