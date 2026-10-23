/**
 * Cuộn → p (0..1) → vẽ khung ảnh thật gần nhất, rồi phủ khung nét bản vẽ qua mặt nạ tan dần (chỉ ở đầu cú máy).
 * p hiển thị bám p thật bằng giảm chấn theo thời gian (có quán tính, không giật).
 * Chỉ bản dev: `window.__landingSeek(p)` và `window.__landingReady` để chụp tất định.
 */

import { useEffect, type RefObject } from 'react';

import { Dissolve } from '@/lib/landing-lab/cinema/dissolve';
import { applyWindows, clamp01, drawCover, drawSequence, FRAME_COUNT, frameBase, FrameStore, frameUrl, LINE_COUNT, smooth } from '@/lib/landing-lab/cinema/frames';

declare global {
  interface Window {
    __landingSeek?: (p: number) => Promise<void>;
    __landingReady?: Promise<void>;
  }
}

/** Keep the house (right side of each frame) when a narrower viewport crops the 16:9 frames. */
const ANCHOR_X = 0.74;
/** The drawing burns away while the camera cranes from top-down to the oblique view. */
const DISSOLVE_FROM = 0.05;
const DISSOLVE_TO = 0.37;

export function useCinema(rootRef: RefObject<HTMLElement | null>, trackRef: RefObject<HTMLElement | null>, canvasRef: RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false }) ?? null;
    const layer = document.createElement('canvas');
    const lctx = layer.getContext('2d');
    if (root === null || track === null || canvas === null || ctx === null || lctx === null) return undefined;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const windows = Array.from(root.querySelectorAll<HTMLElement>('[data-win]'));
    const blueprint = getComputedStyle(root).getPropertyValue('--cn-blueprint').trim();
    const dissolve = new Dissolve();
    // A second, later mask: white lines linger over the photo (screen blend) just behind the burn edge.
    const linger = new Dissolve();
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
      return range > 0 ? clamp01((scrollY - top) / range) : 0;
    };

    const size = (): void => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      layer.width = canvas.width;
      layer.height = canvas.height;
      ctx.imageSmoothingQuality = 'high';
      dirty = true;
    };
    size();

    const draw = (p: number): boolean => {
      const w = canvas.width;
      const h = canvas.height;
      const f = p * (FRAME_COUNT - 1);
      const t = smooth(clamp01((p - DISSOLVE_FROM) / (DISSOLVE_TO - DISSOLVE_FROM)));
      ctx.fillStyle = blueprint;
      ctx.fillRect(0, 0, w, h);
      const real = drawSequence(ctx, beauty, f, w, h, ANCHOR_X);
      if (t >= 1 || f > LINE_COUNT - 1) return real;
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, w, h);
      const ink = drawSequence(lctx, lines, f, w, h, ANCHOR_X);
      if (!ink) return real;
      if (t > 0) {
        // Knock the blue paper out to black so only the white ink adds onto the photo.
        lctx.globalCompositeOperation = 'difference';
        lctx.fillStyle = blueprint;
        lctx.fillRect(0, 0, w, h);
        lctx.globalCompositeOperation = 'destination-in';
        drawCover(lctx, linger.update(clamp01(t * 1.3 - 0.15)), linger.width, linger.height, w, h, ANCHOR_X);
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(layer, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        lctx.globalCompositeOperation = 'source-over';
        lctx.clearRect(0, 0, w, h);
        drawSequence(lctx, lines, f, w, h, ANCHOR_X);
        lctx.globalCompositeOperation = 'destination-in';
        drawCover(lctx, dissolve.update(clamp01(t * 1.3)), dissolve.width, dissolve.height, w, h, ANCHOR_X);
      }
      ctx.drawImage(layer, 0, 0);
      return real || t === 0;
    };

    const paint = (p: number): void => {
      if (dirty || Math.abs(p - drawn) > 1e-6) {
        if (draw(p)) {
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
    const onFrame = (): void => {
      dirty = true;
      wake();
    };
    const base = frameBase(canvas.clientWidth, Math.min(2, devicePixelRatio || 1));
    const lines = new FrameStore((i) => frameUrl(base, 'l', i), LINE_COUNT, onFrame, 2);
    const beauty = new FrameStore((i) => frameUrl(base, 'b', i), FRAME_COUNT, onFrame, 4);

    const fonts = ['300 40px "Be Vietnam Pro"', '400 16px "Be Vietnam Pro"', '500 14px "Be Vietnam Pro"'];
    const ready = (async (): Promise<void> => {
      await Promise.all([lines.first, beauty.first, ...fonts.map((f) => document.fonts.load(f, 'Từ bản vẽ, thành ngôi nhà').catch(() => []))]);
      if (disposed) return;
      target = progress();
      shown = target;
      paint(shown);
      await Promise.all([lines.all, beauty.all]);
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
        const clamped = clamp01(p);
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
      lines.stop();
      beauty.stop();
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
