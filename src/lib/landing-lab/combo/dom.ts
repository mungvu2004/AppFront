/**
 * DOM motion for the combo, driven by p: text blocks with `data-win="a,b,c,d"` reveal line by line through masks
 * (`.cb-line > span` slides up out of its clip, staggered; reversed on the way out), get ≤ 12 px parallax, and
 * hide when off. `data-win="load,…"` reveals on load time (`intro`) instead of scroll. Numbers with
 * `data-count="to,a,b"` count up over p a→b. The page tone (paper / desk / photo) switches the text palette.
 */

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const ease = (t: number): number => 1 - (1 - t) ** 3;

export interface Block {
  readonly el: HTMLElement;
  readonly lines: readonly HTMLElement[];
  readonly rest: readonly HTMLElement[];
  readonly win: readonly [number, number, number, number];
  readonly onLoad: boolean;
}

export function collect(root: HTMLElement): { blocks: Block[]; counters: HTMLElement[]; slides: HTMLElement[] } {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-win]')).map((el): Block => {
    const raw = (el.dataset['win'] ?? '').split(',');
    const onLoad = raw[0] === 'load';
    const [a = 0, b = 0, c = 2, d = 2] = raw.map((v) => (v === 'load' ? 0 : Number(v)));
    return {
      el,
      lines: Array.from(el.querySelectorAll<HTMLElement>('.cb-line > span')),
      rest: Array.from(el.querySelectorAll<HTMLElement>('[data-rest]')),
      win: [a, b, c, d],
      onLoad,
    };
  });
  return {
    blocks,
    counters: Array.from(root.querySelectorAll<HTMLElement>('[data-count]')),
    slides: Array.from(root.querySelectorAll<HTMLElement>('[data-slide]')),
  };
}

export function applyBlocks(blocks: readonly Block[], p: number, intro: number): void {
  for (const bl of blocks) {
    const [a, b, c, d] = bl.win;
    const fin = bl.onLoad ? intro : b > a ? clamp01((p - a) / (b - a)) : p >= a ? 1 : 0;
    const fout = d > c ? clamp01((p - c) / (d - c)) : p >= c ? 1 : 0;
    const on = fin > 0.001 && fout < 0.999;
    bl.el.style.visibility = on ? 'visible' : 'hidden';
    if (!on) continue;
    // Parallax: the block drifts up ≤ 12 px across its window.
    const mid = (a + d) / 2;
    const span = Math.max(0.05, d - a);
    bl.el.style.transform = `translate3d(0, ${(-24 * clamp01((p - mid) / span + 0.5) + 12).toFixed(1)}px, 0)`;
    bl.lines.forEach((ln, i) => {
      const li = ease(clamp01(fin * 1.5 - i * 0.12));
      const lo = ease(clamp01(fout * 1.5 - i * 0.08));
      ln.style.transform = `translate3d(0, ${((1 - li) * 110 - lo * 110).toFixed(1)}%, 0)`;
    });
    const r = ease(clamp01(fin * 1.6 - 0.5)) * (1 - ease(fout));
    for (const el of bl.rest) {
      el.style.opacity = r.toFixed(3);
      el.style.transform = `translate3d(0, ${((1 - r) * 10).toFixed(1)}px, 0)`;
    }
  }
}

/** Counters: `data-count="17,0.16,0.24"`. */
export function applyCounters(els: readonly HTMLElement[], p: number): void {
  for (const el of els) {
    const [to = 0, a = 0, b = 1] = (el.dataset['count'] ?? '').split(',').map(Number);
    el.textContent = String(Math.round(to * ease(clamp01((p - a) / (b - a)))));
  }
}

/** Book chrome (`data-slide="up|down"`) slides off the page during the match cut p a→b. */
export function applySlides(els: readonly HTMLElement[], p: number, a: number, b: number): void {
  const t = ease(clamp01((p - a) / (b - a)));
  for (const el of els) {
    const dir = el.dataset['slide'] === 'up' ? -1 : 1;
    el.style.transform = `translate3d(0, ${(dir * t * 140).toFixed(1)}%, 0)`;
    el.style.opacity = (1 - t).toFixed(3);
  }
}

export function tone(p: number): 'paper' | 'desk' | 'photo' {
  return p < 0.36 ? 'paper' : p < 0.5 ? 'desk' : 'photo';
}
