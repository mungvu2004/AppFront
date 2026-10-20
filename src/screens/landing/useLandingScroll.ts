/**
 * Dây nối cuộn → khung hình: Lenis (cuộn mượt) + ScrollTrigger (p) + stage.
 *
 * Một ScrollTrigger phủ cả đoạn cuộn cao, `scrub: true`, không snap: nó chỉ cho
 * ra `p`. Mỗi nhịp ticker, nếu `p` hay kích thước đổi, ta tính `stateAt(p)` rồi
 * vẽ. Không có gì chạy theo thời gian, nên cuộn ngược ra đúng khung cũ.
 * Lenis đi theo cách tài liệu ghi (`scroll → ScrollTrigger.update`, ticker của
 * gsap lái `raf`) để hai bên không giành nhau một vòng lặp.
 *
 * Stage tải sau khung hình đầu (động) vì kéo theo three; chữ vẫn chạy khi chưa
 * có stage. Lỗi khi dựng (không WebGL2…) hay mất context → `onFallback`.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useEffect, useRef } from 'react';

import { stateAt, SCENES } from '@/lib/landing/timeline';
import type { FrameGovernor, Stage } from '@/lib/landing/stage';
import type { LandingHouse } from '@/lib/landing/types';

import { createOverlay } from './overlay';



export interface LandingScrollOptions {
  readonly enabled: boolean;
  readonly track: React.RefObject<HTMLElement | null>;
  readonly stickyRoot: React.RefObject<HTMLElement | null>;
  readonly canvas: React.RefObject<HTMLCanvasElement | null>;
  readonly onReady: (house: LandingHouse) => void;
  readonly onFallback: () => void;
  /** Gọi khi người dùng bấm "Bỏ qua": nhảy tới hết đoạn cuộn. */
  readonly skipRef: React.MutableRefObject<(() => void) | null>;
  /** Quay lại bằng back/forward hoặc tải lại: trả người xem về chỗ đã cuộn. */
  readonly restore: boolean;
}

const SCROLL_KEY = 'landing:scrollY';
const store = (y: number): void => {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(y));
  } catch {
    /* chế độ riêng tư: bỏ qua, chỉ mất khôi phục cuộn */
  }
};
const saved = (): number => {
  try {
    return Number(sessionStorage.getItem(SCROLL_KEY)) || 0;
  } catch {
    return 0;
  }
};

declare global {
  interface Window {
    /** Chỉ bản dev: cuộn tức thì tới `p` và chờ hai khung đã vẽ. */
    __landingSeek?: (p: number) => Promise<void>;
    /** Chỉ bản dev: resolve sau khung đầu tiên của stage. */
    __landingReady?: Promise<void>;
  }
}

const IDLE_MS = 100;

function pickQuality(): 'full' | 'balanced' {
  return navigator.hardwareConcurrency >= 8 && window.devicePixelRatio <= 1.5 ? 'full' : 'balanced';
}

export function useLandingScroll(opts: LandingScrollOptions): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const { enabled } = opts;

  useEffect(() => {
    const { track, stickyRoot, canvas, skipRef } = optsRef.current;
    const trackEl = track.current;
    const rootEl = stickyRoot.current;
    const canvasEl = canvas.current;
    if (!enabled || trackEl === null || rootEl === null || canvasEl === null) return undefined;

    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ autoRaf: false });
    const onScroll = (): void => ScrollTrigger.update();
    lenis.on('scroll', onScroll);
    const tick = (t: number): void => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const overlay = createOverlay(rootEl, SCENES);
    let stage: Stage | null = null;
    let p = 0;
    let aspect = rootEl.clientWidth / Math.max(1, rootEl.clientHeight) || 16 / 10;
    let dirty = true;
    let frames = 0;
    let disposed = false;
    let governor: FrameGovernor | null = null;
    let lastDraw = 0;

    // Ghi lúc rời (bấm liên kết, đóng/tải lại trang) chứ không theo từng nhịp cuộn:
    // khi route đổi, trang bị đưa về 0 trước khi ta kịp gỡ và sẽ ghi đè mất chỗ cũ.
    const leave = (): void => store(Math.round(window.scrollY));
    document.addEventListener('click', leave, true);
    window.addEventListener('pagehide', leave);
    const back = optsRef.current.restore ? saved() : 0; // đọc trước: onUpdate đầu sẽ ghi đè bằng 0
    const trigger = ScrollTrigger.create({
      trigger: trackEl,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        p = self.progress;
        dirty = true;
      },
    });
    // Route lazy: đoạn cuộn mới có chiều cao sau lần dựng đầu, nên tự khôi phục thay trình duyệt.
    if (back > 0) {
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        lenis.scrollTo(back, { immediate: true, force: true });
      });
    }

    const draw = (): void => {
      if (!dirty) return;
      dirty = false;
      const state = stateAt(p, aspect);
      if (stage !== null) {
        stage.apply(state);
        stage.render();
        // Chỉ đo khi các khung vẽ liền nhau (đang cuộn); khoảng nghỉ không phải khung chậm.
        const now = performance.now();
        if (governor !== null && now - lastDraw < IDLE_MS) {
          const next = governor.sample(now - lastDraw, now);
          if (next !== null) stage.setQuality(next);
        }
        lastDraw = now;
      }
      overlay.update(state, stage === null ? null : (id) => stage?.project(id) ?? null);
      frames += 1;
    };
    gsap.ticker.add(draw);

    const scrollToP = (target: number): void => {
      const y = trigger.start + (trigger.end - trigger.start) * target;
      lenis.scrollTo(y, { immediate: true, force: true });
      p = target;
      dirty = true;
    };
    skipRef.current = () => scrollToP(1);

    const resize = (): void => {
      const w = rootEl.clientWidth;
      const h = rootEl.clientHeight;
      aspect = w / Math.max(1, h) || aspect;
      stage?.resize(w, h, Math.min(window.devicePixelRatio, 2));
      ScrollTrigger.refresh();
      dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(rootEl);

    let resolveReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    if (import.meta.env.DEV) {
      window.__landingReady = ready;
      window.__landingSeek = async (target) => {
        await ready;
        scrollToP(Math.min(1, Math.max(0, target)));
        const from = frames;
        await new Promise<void>((resolve) => {
          const wait = (): void => {
            if (frames >= from + 2) return resolve();
            dirty = true; // vẽ lại đúng p này để đếm đủ hai khung
            requestAnimationFrame(wait);
          };
          wait();
        });
      };
    }

    const load = async (): Promise<void> => {
      try {
        const [{ LANDING_HOUSE }, { createStage, createFrameGovernor }] = await Promise.all([
          import('@/lib/landing/house'),
          import('@/lib/landing/stage'),
        ]);
        const quality = pickQuality();
        const created = await createStage(canvasEl, LANDING_HOUSE, { quality });
        if (disposed) {
          created.dispose();
          return;
        }
        stage = created;
        governor = createFrameGovernor(quality);
        created.onContextLost(() => optsRef.current.onFallback());
        resize();
        optsRef.current.onReady(LANDING_HOUSE);
        draw();
        resolveReady();
      } catch {
        // Không WebGL2 (NoWebGL2Error) hay lỗi dựng: bản tĩnh thay thế.
        if (!disposed) optsRef.current.onFallback();
      }
    };
    // Sau khung hình đầu: giấy và chữ lên trước, three đến sau.
    const first = requestAnimationFrame(() => {
      void load();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(first);
      document.removeEventListener('click', leave, true);
      window.removeEventListener('pagehide', leave);
      observer.disconnect();
      gsap.ticker.remove(draw);
      gsap.ticker.remove(tick);
      lenis.off('scroll', onScroll);
      trigger.kill();
      lenis.destroy();
      stage?.dispose();
      skipRef.current = null;
      if (import.meta.env.DEV) {
        delete window.__landingSeek;
        delete window.__landingReady;
      }
    };
  }, [enabled]);
}
