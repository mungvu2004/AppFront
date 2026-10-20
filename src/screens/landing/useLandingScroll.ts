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
import type { FrameGovernor, Quality, Stage } from '@/lib/landing/stage';
// Không kéo three: chỉ hằng số và hàm thuần.
import { benchmarkTier, dampProgress, QUIET_MS, SCROLL_FEEL } from '@/lib/landing/stage/quality';
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
    /** Chỉ bản dev: p thô, p đang vẽ (sau tầng giảm chấn), số khung đã vẽ, khung trung vị của benchmark. */
    __landingP?: () => { raw: number; shown: number; frames: number; bench: number | null };
  }
}

const IDLE_MS = 100;
/** Mất context lần nữa trong khoảng này (Chrome trả context chết khi back/forward nhanh) thì về bản tĩnh. */
const LOSS_WINDOW_MS = 10_000;
/** Mất context thưa (GPU bị chiếm, TDR) vẫn dựng lại, tối đa chừng này lần một lượt xem. */
const MAX_REBUILDS = 3;
/** Benchmark lúc mở đầu (màn đầu đứng yên): bỏ vài khung đầu, lấy trung vị phần còn lại. */
const BENCH_FRAMES = 30;
const BENCH_SKIP = 6;

/** Chỉ bản dev: `?lerp=0.1&k=8` để A/B cảm giác cuộn (tools/feel.mjs). */
function devFeel(): { lerp: number; k: number } {
  const q = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
  const lerp = Number(q?.get('lerp'));
  const k = Number(q?.get('k'));
  return { lerp: lerp > 0 ? lerp : SCROLL_FEEL.lerp, k: k > 0 ? k : SCROLL_FEEL.k };
}

/** Chỉ bản dev: `?quality=full|balanced|lite` để đo từng bậc. */
function devQuality(): 'full' | 'balanced' | 'lite' | null {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(location.search).get('quality');
  return q === 'full' || q === 'balanced' || q === 'lite' ? q : null;
}

export function useLandingScroll(opts: LandingScrollOptions): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const { enabled } = opts;

  useEffect(() => {
    const { track, stickyRoot, canvas, skipRef } = optsRef.current;
    const trackEl = track.current;
    const rootEl = stickyRoot.current;
    const canvasEl0 = canvas.current;
    if (!enabled || trackEl === null || rootEl === null || canvasEl0 === null) return undefined;

    gsap.registerPlugin(ScrollTrigger);
    const feel = devFeel();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = new Lenis({ autoRaf: false, lerp: feel.lerp });
    const onScroll = (): void => ScrollTrigger.update();
    lenis.on('scroll', onScroll);
    const tick = (t: number): void => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const overlay = createOverlay(rootEl, SCENES);
    let stage: Stage | null = null;
    let p = 0; // p thô từ ScrollTrigger
    let shown = 0; // p đang vẽ: tầng giảm chấn thứ hai, xem quality.ts dampProgress
    let aspect = rootEl.clientWidth / Math.max(1, rootEl.clientHeight) || 16 / 10;
    let dirty = true;
    let frames = 0;
    let disposed = false;
    let governor: FrameGovernor | null = null;
    let lastDraw = 0;
    let pending: Quality | null = null; // governor đề nghị hạ bậc: chỉ đổi khi người dùng ngừng cuộn
    let lastInput = 0;
    let bench: number[] | null = null;
    let benchMs: number | null = null;
    let visible = true;
    const touched = (): void => {
      lastInput = performance.now();
      if (bench !== null) bench = null; // đang benchmark mà người dùng cuộn: bỏ, governor lo tiếp
    };
    const inputs = ['wheel', 'touchmove', 'keydown', 'pointerdown'] as const;
    for (const type of inputs) window.addEventListener(type, touched, { passive: true });
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    seen.observe(rootEl);

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
    const restoring =
      back > 0
        ? requestAnimationFrame(() => {
            ScrollTrigger.refresh();
            lenis.scrollTo(back, { immediate: true, force: true });
            shown = p;
          })
        : 0;

    const draw = (_time: number, deltaMs: number): void => {
      if (shown !== p) {
        shown = reduced ? p : dampProgress(shown, p, deltaMs / 1000, feel.k);
        dirty = true;
      }
      const quiet = performance.now() - lastInput >= QUIET_MS;
      if (stage !== null && pending !== null && quiet) {
        stage.setQuality(pending);
        pending = null;
      }
      if (stage !== null && bench !== null && quiet) {
        bench.push(deltaMs);
        dirty = true;
        if (bench.length >= BENCH_FRAMES) finishBench(stage, bench.slice(BENCH_SKIP));
      }
      // Tab ẩn thì rAF tự dừng; canvas ra khỏi màn hình thì giữ `dirty` tới khi quay lại.
      if (!visible || document.hidden) return;
      // Gợn nước + cá koi: chỉ vẽ lại khi site báo có chuyển động (dừng khi ẩn / giảm chuyển động).
      if (!reduced) stage?.ambient(_time * 1000);
      if (!dirty) {
        stage?.render(); // stage tự bỏ qua khi không có gì đổi (ảnh, mô hình đến muộn vẫn được vẽ)
        return;
      }
      dirty = false;
      const state = stateAt(shown, aspect);
      if (stage !== null) {
        stage.apply(state);
        stage.render();
        // Chỉ đo khi các khung vẽ liền nhau (đang cuộn); khoảng nghỉ không phải khung chậm.
        const now = performance.now();
        if (governor !== null && now - lastDraw < IDLE_MS) {
          const next = governor.sample(now - lastDraw, now);
          if (next !== null) pending = next;
        }
        lastDraw = now;
      }
      overlay.update(state, stage === null ? null : (id) => stage?.project(id) ?? null);
      frames += 1;
    };
    gsap.ticker.add(draw);

    const finishBench = (s: Stage, frameMs: number[]): void => {
      bench = null;
      const sorted = [...frameMs].sort((a, b) => a - b);
      benchMs = sorted[Math.floor(sorted.length / 2)] ?? null;
      const from = governor?.quality ?? null;
      if (benchMs === null || from === null) return;
      const tier = benchmarkTier(from, benchMs);
      if (tier !== from) {
        s.setQuality(tier);
        governor = createGovernor(tier);
      }
    };
    let createGovernor: (q: Quality) => FrameGovernor = () => {
      throw new Error('stage chưa tải');
    };

    const scrollToP = (target: number): void => {
      const y = trigger.start + (trigger.end - trigger.start) * target;
      lenis.scrollTo(y, { immediate: true, force: true });
      p = target;
      shown = target;
      dirty = true;
    };
    skipRef.current = () => scrollToP(1);

    const resize = (): void => {
      const w = rootEl.clientWidth;
      const h = rootEl.clientHeight;
      aspect = w / Math.max(1, h) || aspect;
      stage?.resize(w, h, Math.min(window.devicePixelRatio, 2));
      ScrollTrigger.refresh();
      shown = p;
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
      window.__landingP = () => ({ raw: p, shown, frames, bench: benchMs });
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

    let canvasEl = canvasEl0;
    let lastLoss = -Infinity;
    let rebuilds = 0;
    const build = async (): Promise<void> => {
      const [{ LANDING_HOUSE }, { createStage, createFrameGovernor, pickStageQuality }] = await Promise.all([
        import('@/lib/landing/house'),
        import('@/lib/landing/stage'),
      ]);
      const quality = devQuality() ?? pickStageQuality();
      const created = await createStage(canvasEl, LANDING_HOUSE, { quality });
      if (disposed) {
        created.dispose();
        return;
      }
      stage = created;
      createGovernor = createFrameGovernor;
      // Bản dev `?quality=` ghim bậc: không benchmark, không governor (để xem đúng bậc đã chọn).
      governor = devQuality() === null ? createFrameGovernor(quality) : null;
      // Mọi bậc đã biên dịch xong thì đo ngay lúc màn đầu còn đứng yên; đổi bậc lúc này không ai thấy.
      void created.warmed.then(() => {
        if (!disposed && stage === created && devQuality() === null) bench = [];
      });
      // Chrome trả lại context chết cho cùng một canvas khi back/forward nhanh: thay canvas mới, dựng lại.
      // Mất lại ngay (trong LOSS_WINDOW_MS) hay quá MAX_REBUILDS lần mới về bản tĩnh; một lần mất lẻ
      // (GPU đầy vì máy khác cũng vẽ) không được đẩy cả trang sang bản tĩnh — trước đây lần mất thứ hai
      // bất kỳ làm vậy, và gỡ luôn các hook dev (__landingSeek biến mất giữa lượt chụp).
      created.onContextLost(() => {
        if (disposed) return;
        const now = performance.now();
        if (import.meta.env.DEV) console.warn('[landing] WebGL context lost', { rebuilds });
        if (now - lastLoss < LOSS_WINDOW_MS || rebuilds >= MAX_REBUILDS) return optsRef.current.onFallback();
        lastLoss = now;
        rebuilds += 1;
        stage = null;
        created.dispose();
        const fresh = canvasEl.cloneNode(false) as HTMLCanvasElement;
        canvasEl.replaceWith(fresh);
        canvasEl = fresh;
        void build().then(() => dirty = true, () => !disposed && optsRef.current.onFallback());
      });
      resize();
      optsRef.current.onReady(LANDING_HOUSE);
      draw(0, 0);
      resolveReady();
    };
    const load = async (): Promise<void> => {
      try {
        await build();
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
      cancelAnimationFrame(restoring);
      for (const type of inputs) window.removeEventListener(type, touched);
      seen.disconnect();
      document.removeEventListener('click', leave, true);
      window.removeEventListener('pagehide', leave);
      observer.disconnect();
      gsap.ticker.remove(draw);
      gsap.ticker.remove(tick);
      // Trang khác không dùng gsap: tắt hẳn vòng rAF của ticker (autoSleep không kịp ngủ; tools/release.mjs đo 146 rAF/s ở /login).
      gsap.ticker.lagSmoothing(500, 33); // Trả lại mặc định của GSAP; trang này tắt nó trong lúc chạy.
      gsap.ticker.sleep();
      lenis.off('scroll', onScroll);
      trigger.kill();
      lenis.destroy();
      stage?.dispose();
      skipRef.current = null;
      if (import.meta.env.DEV) {
        delete window.__landingSeek;
        delete window.__landingReady;
        delete window.__landingP;
      }
    };
  }, [enabled]);
}
