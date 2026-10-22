/**
 * Vòng chạy của bản kết hợp. Lenis làm mượt cuộn → timeline.ts đổi chỗ cuộn thành tiến độ câu chuyện (có vùng
 * "dừng chân" quanh mỗi chuyển cảnh, chỉ bằng độ dài cuộn) → vẽ canvas (khung ảnh giải mã sẵn phía trước,
 * frames.ts), chạy chữ. Con trỏ: rê phòng, nâng tầng, thị sai nhẹ (useComboInput).
 * Chỉ bản dev: `__landingSeek(p)`, `__landingReady`, `__comboP()`, `__comboPrintPlan()`.
 */

import Lenis from 'lenis';
import { useEffect, type RefObject } from 'react';

import { requirePlatformFetch } from '@/lib/http';
import { applyBlocks, applyCounters, applySlides, collect, tone } from '@/lib/landing-lab/combo/dom';
import { CH } from '@/lib/landing-lab/combo/layout';
import { renderPrintPlan, type PrintPlan } from '@/lib/landing-lab/combo/printPlan';
import { loadRegistration, openB, openSeq, REG_STANDIN } from '@/lib/landing-lab/combo/sources';
import { createStage, type Stage, type StageInput } from '@/lib/landing-lab/combo/stage';
import { JUMP, LENIS_LERP, NEEDS, scrollAt, storyAt, TRANSITIONS, WHEEL_MULTIPLIER } from '@/lib/landing-lab/combo/timeline';

import { createComboInput } from './useComboInput';

const FONTS = ['300 40px Newsreader', 'italic 300 40px Newsreader', '400 20px "Patrick Hand"', '300 12px "Be Vietnam Pro"', '400 16px "Be Vietnam Pro"'];
const SAMPLE = 'Bản vẽ ữ ạ ẻ ờ đ';

declare global {
  interface Window {
    __landingSeek?: (p: number) => Promise<void>;
    __landingReady?: Promise<void>;
    __comboPrintPlan?: () => Promise<PrintPlan>;
    __comboP?: () => { target: number; shown: number; lenis: number; transitions: typeof TRANSITIONS; a: string; b: string };
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = src;
  return img.decode().then(
    () => img,
    () => null,
  );
}

export function useCombo(rootRef: RefObject<HTMLElement | null>, trackRef: RefObject<HTMLElement | null>, canvasRef: RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') ?? null;
    const layer = document.createElement('canvas').getContext('2d');
    if (root === null || track === null || canvas === null || ctx === null || layer === null) return undefined;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { blocks, counters, slides } = collect(root);
    const css = getComputedStyle(root);
    const v = (name: string): string => css.getPropertyValue(name).trim();
    const pal = { paper: v('--cb-paper'), ink: v('--cb-ink'), red: v('--cb-red'), clay: v('--cb-clay') };
    const lenis = new Lenis({ autoRaf: false, lerp: reduce ? 1 : LENIS_LERP, wheelMultiplier: WHEEL_MULTIPLIER });
    let stage: Stage | null = null;
    let parts: Omit<StageInput, 'ctx' | 'layer' | 'W' | 'H' | 'dpr'> | null = null;
    let target = 0;
    let prevTarget = 0;
    let prevScroll = 0;
    let shown = 0;
    let drawn = -1;
    let dirty = true;
    let intro = reduce ? 1 : 0;
    let frames = 0;
    let raf = 0;
    let last = performance.now();
    let disposed = false;
    const wake = (): void => {
      if (raf === 0 && !disposed) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const input = createComboInput(root, () => stage, wake);

    const range = (): { top: number; len: number } => ({ top: track.getBoundingClientRect().top + scrollY, len: Math.max(1, track.offsetHeight - innerHeight) });
    const storyNow = (): number => {
      const r = range();
      return storyAt((lenis.scroll - r.top) / r.len);
    };

    const build = (): void => {
      if (parts === null) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      layer.canvas.width = canvas.width;
      layer.canvas.height = canvas.height;
      ctx.imageSmoothingQuality = 'high';
      stage = createStage({ ctx, layer, W, H, dpr, ...parts });
      dirty = true;
    };

    const paint = (p: number): void => {
      if (stage !== null && (dirty || input.moving() || Math.abs(p - drawn) > 1e-6)) {
        dirty = !stage.draw(p, intro, input.ui());
        drawn = p;
        applyBlocks(blocks, p, intro);
        applyCounters(counters, p);
        applySlides(slides, p, CH.cut[0], CH.cut[0] + 0.035);
        input.place(stage.hits());
        const tn = tone(p);
        if (root.dataset['tone'] !== tn) root.dataset['tone'] = tn;
      }
      frames += 1;
    };

    function tick(now: number): void {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      lenis.raf(now);
      target = storyNow();
      input.step(dt);
      // The picture sits exactly where the Lenis-smoothed scroll is (timeline.ts says why there is no cap/gate).
      // A jump of the scroll itself (Home/End, scrollbar drag) lands behind a 340 ms fade.
      if (Math.abs(target - prevTarget) > JUMP) fadeIn();
      prevTarget = target;
      stage?.prefetch(target, Math.abs(target - prevScroll) > 1e-5 || lenis.isScrolling !== false);
      prevScroll = target;
      shown = target;
      paint(shown);
      const busy = lenis.isScrolling !== false || dirty || input.moving();
      raf = busy ? requestAnimationFrame(tick) : 0;
    }
    const onScroll = (): void => wake();
    /** The 340 ms fade a jump lands behind (token duration). */
    const fadeIn = (): void => {
      canvas.classList.remove('cb-jump');
      void canvas.offsetWidth;
      canvas.classList.add('cb-jump');
    };
    // A frame that lands only matters while photographs are on screen; on the drawings it must not cost a redraw.
    const onFrame = (): void => {
      if (shown < NEEDS.a.from - 0.01) return;
      dirty = true;
      wake();
    };

    const ready = (async (): Promise<void> => {
      const http = requirePlatformFetch('combo: fetch unavailable');
      const wide = canvas.clientWidth * Math.min(2, devicePixelRatio || 1) > 1500;
      const [img, a, b, reg] = await Promise.all([
        loadImage('/landing-lab/blueprint/paper.webp'),
        openSeq(http, 'a', wide, onFrame),
        openB(http, wide, onFrame),
        loadRegistration(http),
        ...FONTS.map((f) => document.fonts.load(f, SAMPLE).catch(() => [])),
      ]);
      if (disposed) return;
      const paper = img === null ? pal.paper : (ctx.createPattern(img, 'repeat') ?? pal.paper);
      // A's registration describes A's real intro frame; with the maquette stand-in keep the eyeballed rect.
      parts = { pal, paper, a, b: b.main, clay: b.clay, reg: a === null || a.standIn ? REG_STANDIN : reg };
      build();
      shown = target = prevTarget = storyNow();
      paint(shown);
      // Headline lines and the exterior walls ink in on load (700 ms), then the scroll takes over.
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const step = (now: number): void => {
          if (disposed) return resolve();
          intro = Math.min(1, (now - t0) / 700);
          dirty = true;
          paint(shown);
          if (intro < 1) requestAnimationFrame(step);
          else resolve();
        };
        if (intro < 1) requestAnimationFrame(step);
        else resolve();
      });
    })();

    const observer = new ResizeObserver(() => {
      build();
      paint(shown);
    });
    observer.observe(canvas);
    // Lenis only moves inside our rAF: any input that can start a scroll must wake the loop.
    lenis.on('scroll', onScroll);
    lenis.on('virtual-scroll', onScroll);
    addEventListener('scroll', onScroll, { passive: true });
    for (const ev of ['wheel', 'touchmove', 'keydown'] as const) addEventListener(ev, onScroll, { passive: true });

    if (import.meta.env.DEV) {
      window.__landingReady = ready;
      window.__comboPrintPlan = () => Promise.resolve(renderPrintPlan(pal));
      window.__comboP = () => ({ target, shown, lenis: lenis.scroll, transitions: TRANSITIONS, a: parts?.a?.loaded() ?? '', b: parts?.b?.loaded() ?? '' });
      window.__landingSeek = async (p: number): Promise<void> => {
        await ready;
        const clamped = Math.min(1, Math.max(0, p));
        const r = range();
        lenis.scrollTo(r.top + scrollAt(clamped) * r.len, { immediate: true, force: true });
        target = clamped;
        prevTarget = clamped;
        shown = clamped;
        dirty = true;
        stage?.prefetch(clamped);
        const t0 = performance.now();
        while (stage !== null && !stage.ready(clamped) && performance.now() - t0 < 8000) {
          // eslint-disable-next-line local/no-raw-duration -- dev-only poll while frames decode, not motion
          await new Promise((res) => setTimeout(res, 50));
        }
        const from = frames;
        await new Promise<void>((resolve) => {
          const wait = (): void => {
            dirty = true;
            paint(shown);
            if (frames >= from + 2) resolve();
            else requestAnimationFrame(wait);
          };
          requestAnimationFrame(wait);
        });
      };
    }

    return () => {
      disposed = true;
      parts?.a?.stop();
      parts?.b?.stop();
      parts?.clay?.stop();
      cancelAnimationFrame(raf);
      observer.disconnect();
      input.dispose();
      lenis.destroy();
      removeEventListener('scroll', onScroll);
      for (const ev of ['wheel', 'touchmove', 'keydown'] as const) removeEventListener(ev, onScroll);
      if (import.meta.env.DEV) {
        delete window.__landingSeek;
        delete window.__landingReady;
        delete window.__comboPrintPlan;
        delete window.__comboP;
      }
    };
  }, [rootRef, trackRef, canvasRef]);
}
