/**
 * Cuộn → p (0..1) → vẽ khung hình gần nhất của chuỗi ảnh lên canvas, đặt độ mờ cho các khối chữ `data-win`.
 * p hiển thị bám theo p thật bằng giảm chấn theo thời gian (có quán tính, không giật).
 * Chỉ bản dev: `window.__landingSeek(p)` và `window.__landingReady` để chụp tất định.
 */

import { useEffect, type RefObject } from 'react';

import { applyWindows, drawProgress, FRAME_COUNT, frameBase, FrameStore } from '@/lib/landing-lab/maquette/frames';

declare global {
  interface Window {
    __landingSeek?: (p: number) => Promise<void>;
    __landingReady?: Promise<void>;
  }
}

/** Keep the model (right side of each frame) when a narrower viewport crops the 16:9 frames. */
const ANCHOR_X = 0.72;

export function useMaquette(rootRef: RefObject<HTMLElement | null>, trackRef: RefObject<HTMLElement | null>, canvasRef: RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false }) ?? null;
    if (root === null || track === null || canvas === null || ctx === null) return undefined;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const windows = Array.from(root.querySelectorAll<HTMLElement>('[data-win]'));
    let target = 0;
    let shown = -1;
    let drawn = -1;
    let dirty = true;
    let frames = 0;
    let raf = 0;
    let last = performance.now();
    let disposed = false;

    const progress = (): number => {
      const top = track.getBoundingClientRect().top + scrollY;
      const range = track.offsetHeight - innerHeight;
      return range > 0 ? Math.min(1, Math.max(0, (scrollY - top) / range)) : 0;
    };

    const size = (): void => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.imageSmoothingQuality = 'high';
      dirty = true;
    };
    size();

    const paint = (p: number): void => {
      if (dirty || Math.abs(p - drawn) > 1e-6) {
        if (drawProgress(ctx, store, p, canvas.width, canvas.height, ANCHOR_X)) {
          drawn = p;
          dirty = false;
        }
        applyWindows(windows, p);
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

    // A frame that lands may be nearer than the one on screen: redraw on the next tick.
    const store = new FrameStore(frameBase(canvas.clientWidth, Math.min(2, devicePixelRatio || 1)), FRAME_COUNT, () => {
      dirty = true;
      wake();
    });

    const fonts = ['300 40px "Be Vietnam Pro"', '400 16px "Be Vietnam Pro"', '500 14px "Be Vietnam Pro"'];
    const ready = (async (): Promise<void> => {
      await Promise.all([store.first, ...fonts.map((f) => document.fonts.load(f, 'Bản vẽ dựng thành nhà').catch(() => []))]);
      if (disposed) return;
      target = progress();
      shown = target;
      paint(shown);
      await store.all;
    })();

    const observer = new ResizeObserver(() => {
      size();
      paint(shown < 0 ? 0 : shown);
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
      store.stop();
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
