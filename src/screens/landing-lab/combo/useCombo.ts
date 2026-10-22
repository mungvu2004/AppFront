/**
 * Cuộn → p (0..1) → vẽ canvas của bản kết hợp và chạy chữ (lộ từng dòng, đếm số, trượt khung sách).
 * p hiển thị bám p thật bằng giảm chấn theo thời gian. Khung ảnh A/B nạp dần; ảnh về thì vẽ lại.
 * Chỉ bản dev: `__landingSeek(p)`, `__landingReady`, `__comboPrintPlan()` (hợp đồng 1: tờ bản vẽ in cho A).
 */

import { useEffect, type RefObject } from 'react';

import { requirePlatformFetch } from '@/lib/http';
import { applyBlocks, applyCounters, applySlides, collect, tone } from '@/lib/landing-lab/combo/dom';
import { renderPrintPlan, type PrintPlan } from '@/lib/landing-lab/combo/printPlan';
import { loadRegistration, openSeq } from '@/lib/landing-lab/combo/sources';
import { CH, createStage } from '@/lib/landing-lab/combo/stage';

const FONTS = ['300 40px Newsreader', 'italic 300 40px Newsreader', '400 20px "Patrick Hand"', '300 12px "Be Vietnam Pro"', '400 16px "Be Vietnam Pro"'];
const SAMPLE = 'Bản vẽ ữ ạ ẻ ờ đ';

declare global {
  interface Window {
    __landingSeek?: (p: number) => Promise<void>;
    __landingReady?: Promise<void>;
    __comboPrintPlan?: () => Promise<PrintPlan>;
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
    const pal = { paper: css.getPropertyValue('--cb-paper').trim(), ink: css.getPropertyValue('--cb-ink').trim(), red: css.getPropertyValue('--cb-red').trim() };
    let stage: ReturnType<typeof createStage> | null = null;
    let parts: Omit<Parameters<typeof createStage>[0], 'ctx' | 'layer' | 'W' | 'H' | 'dpr'> | null = null;
    let target = 0;
    let shown = -1;
    let drawn = -1;
    let dirty = true;
    let intro = reduce ? 1 : 0;
    let frames = 0;
    let raf = 0;
    let last = performance.now();
    let disposed = false;

    const progress = (): number => {
      const top = track.getBoundingClientRect().top + scrollY;
      const range = track.offsetHeight - innerHeight;
      return range > 0 ? Math.min(1, Math.max(0, (scrollY - top) / range)) : 0;
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
      if (stage !== null && (dirty || Math.abs(p - drawn) > 1e-6)) {
        dirty = !stage.draw(p, intro);
        drawn = p;
        applyBlocks(blocks, p, intro);
        applyCounters(counters, p);
        applySlides(slides, p, CH.cut[0], CH.cut[0] + 0.035);
        root.dataset['tone'] = tone(p);
      }
      frames += 1;
    };

    const tick = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      shown = shown < 0 || reduce ? target : shown + (target - shown) * (1 - Math.exp(-dt * 8));
      if (Math.abs(target - shown) < 1e-4) shown = target;
      paint(shown);
      raf = shown === target && !dirty ? 0 : requestAnimationFrame(tick);
    };
    const wake = (): void => {
      if (raf === 0 && !disposed) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const onScroll = (): void => {
      target = progress();
      wake();
    };
    const onFrame = (): void => {
      dirty = true;
      wake();
    };

    const ready = (async (): Promise<void> => {
      const http = requirePlatformFetch('combo: fetch unavailable');
      const wide = canvas.clientWidth * Math.min(2, devicePixelRatio || 1) > 1500;
      const [img, a, b, reg] = await Promise.all([
        loadImage('/landing-lab/blueprint/paper.webp'),
        openSeq(http, 'a', wide, onFrame),
        openSeq(http, 'b', wide, onFrame),
        loadRegistration(http),
        ...FONTS.map((f) => document.fonts.load(f, SAMPLE).catch(() => [])),
      ]);
      if (disposed) return;
      const paper = img === null ? pal.paper : (ctx.createPattern(img, 'repeat') ?? pal.paper);
      parts = { pal, paper, a, b, reg };
      build();
      target = progress();
      shown = target;
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
        requestAnimationFrame(step);
      });
      await Promise.all([a?.store.first, b?.store.first]);
    })();

    const observer = new ResizeObserver(() => {
      build();
      paint(shown < 0 ? 0 : shown);
    });
    observer.observe(canvas);
    addEventListener('scroll', onScroll, { passive: true });

    if (import.meta.env.DEV) {
      window.__landingReady = ready;
      window.__comboPrintPlan = () => Promise.resolve(renderPrintPlan(pal));
      window.__landingSeek = async (p: number): Promise<void> => {
        await ready;
        const clamped = Math.min(1, Math.max(0, p));
        const top = track.getBoundingClientRect().top + scrollY;
        scrollTo({ top: top + clamped * (track.offsetHeight - innerHeight), behavior: 'instant' });
        target = clamped;
        shown = clamped;
        dirty = true;
        const from = frames;
        await new Promise<void>((resolve) => {
          const wait = (): void => {
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
      parts?.a?.store.stop();
      parts?.b?.store.stop();
      cancelAnimationFrame(raf);
      observer.disconnect();
      removeEventListener('scroll', onScroll);
      if (import.meta.env.DEV) {
        delete window.__landingSeek;
        delete window.__landingReady;
        delete window.__comboPrintPlan;
      }
    };
  }, [rootRef, trackRef, canvasRef]);
}
