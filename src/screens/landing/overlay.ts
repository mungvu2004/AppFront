/**
 * Lớp DOM phủ lên canvas, vẽ lại mỗi khung từ `LandingState`.
 *
 * Ghi thẳng vào style của các phần tử đã có (không qua React) vì nó chạy mỗi
 * khung hình khi cuộn; một lượt render React mỗi khung là điều bài này cấm.
 * Mọi giá trị chỉ suy ra từ `p`, khoảng cảnh và `state`, nên đi ngược lại cho
 * đúng khung cũ. Nhãn và thẻ kiểm tra chỉ có sau khi dữ liệu căn nhà tải, nên
 * đọc qua HTMLCollection sống thay vì chụp một lần lúc tạo.
 */

import type { LandingState } from '@/lib/landing/types';

import { copyPhase, SCENE_STEP } from './landing.copy';

export interface SceneSpan {
  readonly id?: string;
  readonly start: number;
  readonly end: number;
}

export type Projector = (anchorId: string) => { x: number; y: number; visible: boolean } | null;

const HIDDEN = 'hidden';
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

function setPhase(el: HTMLElement, opacity: number, y: number): void {
  el.style.opacity = String(opacity);
  el.style.transform = `translate3d(0, ${y}px, 0)`;
}

/** Độ đậm lớp giấy: theo độ cao máy quay (trong nhà thấp, ngoài nhà cao); S08 đậm hơn vì gần vật nhất. */
export function scrimAt(state: Pick<LandingState, 'camera' | 'scene'> & { build?: { material: number } }): number {
  const h = state.camera.position[1];
  const inside = 1 - Math.min(1, Math.max(0, (h - 6) / 3));
  // Khi nhà đã có vật liệu, hình khối hay chạy dưới cột chữ: giữ một vùng giấy đặc tối thiểu.
  return Math.max(inside * (state.scene === 7 ? 0.92 : 0.72), FLOOR * (state.build?.material ?? 0));
}
const FLOOR = 0.8;

/** Bước đang ở và tiến độ trong bước (từ đầu cảnh đầu tới cuối cảnh cuối của bước). */
export function stepAt(p: number, scenes: readonly SceneSpan[]): { step: number; t: number } {
  const spans = new Map<number, { start: number; end: number }>();
  scenes.forEach((s) => {
    const step = SCENE_STEP[s.id ?? '']?.step;
    if (step === undefined) return;
    const was = spans.get(step);
    spans.set(step, { start: Math.min(was?.start ?? s.start, s.start), end: Math.max(was?.end ?? s.end, s.end) });
  });
  let found = { step: 0, t: 0 };
  spans.forEach((span, step) => {
    if (p >= span.start) found = { step, t: clamp01((p - span.start) / (span.end - span.start)) };
  });
  return found;
}

/** p để nhảy tới bước `step`: đầu cảnh đầu của bước, sau đoạn chữ vào. */
export function stepStartP(step: number, scenes: readonly SceneSpan[], enter: number): number {
  const s = scenes.find((x) => SCENE_STEP[x.id ?? '']?.step === step);
  if (s === undefined || step === 0) return 0;
  return s.start + (s.end - s.start) * enter;
}

export interface Overlay {
  update(state: LandingState, project: Projector | null): void;
}

export function createOverlay(root: HTMLElement, scenes: readonly SceneSpan[]): Overlay {
  const sections = root.getElementsByClassName('landing-phase') as HTMLCollectionOf<HTMLElement>;
  const labels = root.getElementsByClassName('landing-label') as HTMLCollectionOf<HTMLElement>;
  const exportItems = Array.from(root.querySelectorAll<HTMLElement>('[data-export]'));
  const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
  const header = root.querySelector<HTMLElement>('.landing-header');
  // Thẻ kiểm tra vào cảnh S08 khi dữ liệu tới: đọc lại phần của một cảnh khi số con của nó đổi.
  const parts = new WeakMap<HTMLElement, { n: number; list: HTMLElement[] }>();
  const partsOf = (s: HTMLElement): HTMLElement[] => {
    let found = parts.get(s);
    if (found?.n !== s.childElementCount) {
      found = { n: s.childElementCount, list: Array.from(s.querySelectorAll<HTMLElement>('[data-delay]')) };
      parts.set(s, found);
    }
    return found.list;
  };
  const last = scenes.length - 1;
  let activeStep = -1;

  return {
    update(state, project) {
      const { p } = state;
      root.style.setProperty('--l-scrim', String(scrimAt(state)));
      header?.toggleAttribute('data-scrolled', state.scene > 0);

      for (const section of sections) {
        const index = Number(section.dataset.scene);
        const span = scenes[index];
        if (span === undefined) continue;
        const inside = p >= span.start && p < span.end;
        section.style.visibility = inside || (index === last && p >= span.start) ? '' : HIDDEN;
        partsOf(section).forEach((part) => {
          const phase = copyPhase(p, span.start, span.end, Number(part.dataset.delay), index === last, index === 0);
          setPhase(part, phase.opacity, phase.y);
        });
      }

      exportItems.forEach((item, i) => {
        const t = clamp01(state.exports * 1.7 - i * 0.14);
        setPhase(item, 1 - (1 - t) ** 3, (1 - t) * 14);
      });

      const { step, t } = stepAt(p, scenes);
      if (step !== activeStep) {
        steps.forEach((li, i) => {
          li.toggleAttribute('data-active', i === step);
          const link = li.firstElementChild;
          if (i === step) link?.setAttribute('aria-current', 'step');
          else link?.removeAttribute('aria-current');
        });
        activeStep = step;
        root.dataset.step = String(step);
      }
      steps[step]?.style.setProperty('--l-fill', String(t));

      for (const label of labels) {
        const id = label.dataset.label ?? '';
        const wanted = state.labels[id] ?? 0;
        const at = wanted > 0 && project !== null ? project(id) : null;
        if (at === null || !at.visible) {
          label.style.opacity = '0';
          label.style.visibility = HIDDEN;
          continue;
        }
        label.style.visibility = '';
        label.style.opacity = String(wanted);
        label.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
      }
    },
  };
}
