/**
 * Cuộn → p (0..1) → vẽ lại canvas và đặt độ mờ/độ dời cho các khối chữ có `data-win`.
 * p hiển thị bám theo p thật bằng giảm chấn theo thời gian (cảm giác có quán tính, không giật).
 * Chỉ bản dev: `window.__landingSeek(p)` và `window.__landingReady` để chụp tất định.
 */

import { useEffect, type RefObject } from 'react';

import { createScene } from '@/lib/landing-lab/blueprint/scene';
import { applyWindows, placeCaption } from '@/lib/landing-lab/blueprint/windows';

const FONTS = ['300 40px Newsreader', 'italic 300 40px Newsreader', '400 20px "Patrick Hand"', '300 12px "Be Vietnam Pro"'];
const SAMPLE = 'Bản vẽ ữ ạ ẻ ờ đ';

declare global {
  interface Window {
    __landingSeek?: (p: number) => Promise<void>;
    __landingReady?: Promise<void>;
  }
}

function loadPaper(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/landing-lab/blueprint/paper.webp';
  });
}

export function useBlueprint(rootRef: RefObject<HTMLElement | null>, trackRef: RefObject<HTMLElement | null>, canvasRef: RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') ?? null;
    if (root === null || track === null || canvas === null || ctx === null) return undefined;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const windows = Array.from(root.querySelectorAll<HTMLElement>('[data-win]'));
    const caption = root.querySelector<HTMLElement>('[data-caption]');
    let scene: ReturnType<typeof createScene> | null = null;
    let paper: HTMLImageElement | null = null;
    let target = 0;
    let shown = -1;
    let drawn = -1;
    let frames = 0;
    let raf = 0;
    let last = performance.now();
    let disposed = false;
    /** 0..1 on-load inking of the axes and exterior walls (700 ms); static when motion is reduced. */
    let intro = reduce ? 1 : 0;
    let drawnIntro = -1;

    const progress = (): number => {
      const top = track.getBoundingClientRect().top + scrollY;
      const range = track.offsetHeight - innerHeight;
      return range > 0 ? Math.min(1, Math.max(0, (scrollY - top) / range)) : 0;
    };

    const build = (): void => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const css = getComputedStyle(root);
      const pal = { paper: css.getPropertyValue('--bp-paper').trim(), ink: css.getPropertyValue('--bp-ink').trim(), red: css.getPropertyValue('--bp-red').trim() };
      scene = createScene({ ctx, W, H, dpr, pal, paper });
      drawn = -1;
    };

    const paint = (p: number): void => {
      if (scene === null) return;
      if (Math.abs(p - drawn) > 1e-6 || intro !== drawnIntro) {
        scene.draw(p, intro);
        drawnIntro = intro;
        applyWindows(windows, p);
        if (caption !== null) placeCaption(caption, p, canvas.clientWidth, canvas.clientHeight);
        drawn = p;
      }
      frames += 1;
    };

    const tick = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      shown = shown < 0 || reduce ? target : shown + (target - shown) * (1 - Math.exp(-dt * 9));
      if (Math.abs(target - shown) < 1e-4) shown = target;
      paint(shown);
      raf = shown === target && drawn === shown ? 0 : requestAnimationFrame(tick);
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

    const ready = (async (): Promise<void> => {
      await Promise.all([...FONTS.map((f) => document.fonts.load(f, SAMPLE).catch(() => [])), loadPaper().then((img) => (paper = img))]);
      if (disposed) return;
      build();
      target = progress();
      shown = target;
      paint(shown);
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const step = (now: number): void => {
          if (disposed) return resolve();
          intro = Math.min(1, (now - t0) / 700);
          paint(shown);
          if (intro < 1) requestAnimationFrame(step);
          else resolve();
        };
        if (intro < 1) requestAnimationFrame(step);
        else resolve();
      });
    })();

    const observer = new ResizeObserver(() => {
      if (paper !== null || scene !== null) {
        build();
        paint(shown);
      }
    });
    observer.observe(canvas);
    addEventListener('scroll', onScroll, { passive: true });

    if (import.meta.env.DEV) {
      window.__landingReady = ready;
      window.__landingSeek = async (p: number): Promise<void> => {
        await ready;
        const clamped = Math.min(1, Math.max(0, p));
        const top = track.getBoundingClientRect().top + scrollY;
        scrollTo({ top: top + clamped * (track.offsetHeight - innerHeight), behavior: 'instant' });
        target = clamped;
        shown = clamped;
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
      cancelAnimationFrame(raf);
      observer.disconnect();
      removeEventListener('scroll', onScroll);
      if (import.meta.env.DEV) {
        delete window.__landingSeek;
        delete window.__landingReady;
      }
    };
  }, [rootRef, trackRef, canvasRef]);
}
