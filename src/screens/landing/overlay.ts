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

/**
 * Độ đậm lớp giấy: theo độ cao máy quay (trong nhà thấp, ngoài nhà cao), nhân với lượng chữ đang hiện
 * (`copy` 0..1: cảnh chỉ có dòng mắt thì không phủ gì). Cảnh 2D gần (S03/S04) cần giấy đặc sau chữ;
 * đi trong nhà (S06) trần 0.6 để nội thất không bị lên màu; S08 đậm hơn vì gần vật nhất.
 */
export function scrimAt(state: Pick<LandingState, 'camera' | 'scene'> & { build?: { material: number } }, copy = 1): number {
  const h = state.camera.position[1];
  const inside = 1 - Math.min(1, Math.max(0, (h - 6) / 3));
  let base = Math.max(inside * (state.scene === 7 ? 0.92 : 0.72), FLOOR * (state.build?.material ?? 0));
  if (state.scene === 2 || state.scene === 3) base = Math.max(base, 0.85);
  else if (state.scene === 5) base = Math.min(base, 0.6);
  return base * clamp01(copy);
}
const FLOOR = 0.8;
const MAX_LABELS = 64;
const LABEL_GAP = 30; // px dọc tối thiểu giữa hai nhãn gần nhau theo chiều ngang

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
  const widths = new WeakMap<HTMLElement, number>();
  const px = new Float64Array(MAX_LABELS);
  const py = new Float64Array(MAX_LABELS);
  const pw = new Float64Array(MAX_LABELS);
  let activeStep = -1;

  return {
    update(state, project) {
      const { p } = state;
      header?.toggleAttribute('data-scrolled', state.scene > 0);
      let shown = 0;

      for (const section of sections) {
        const index = Number(section.dataset.scene);
        const span = scenes[index];
        if (span === undefined) continue;
        const inside = p >= span.start && p < span.end;
        section.style.visibility = inside || (index === last && p >= span.start) ? '' : HIDDEN;
        partsOf(section).forEach((part) => {
          const phase = copyPhase(p, span.start, span.end, Number(part.dataset.delay), index === last, index === 0);
          setPhase(part, phase.opacity, phase.y);
          if (inside && !part.classList.contains('landing-eyebrow')) shown = Math.max(shown, phase.opacity);
        });
      }
      const scrim = scrimAt(state, shown);
      root.style.setProperty('--l-scrim', String(scrim));
      // Tờ bản vẽ 2D chạy dưới đầu trang ở S01..S04: nền giấy đặc, không phụ thuộc lớp giấy cột chữ.
      root.style.setProperty('--l-head-bg', state.scene <= 3 ? '0.95' : String(scrim));

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

      // Nhãn: vị trí chiếu, rồi đẩy nhãn đến sau lên (kéo dài đường dẫn) nếu đè nhãn đã đặt. Không cấp phát mỗi khung.
      let placed = 0;
      for (const label of labels) {
        const id = label.dataset.label ?? '';
        const wanted = state.labels[id] ?? 0;
        const at = wanted > 0 && project !== null ? project(id) : null;
        if (at === null || !at.visible) {
          label.style.opacity = '0';
          label.style.visibility = HIDDEN;
          continue;
        }
        let w = widths.get(label);
        if (w === undefined || w === 0) {
          w = label.offsetWidth;
          widths.set(label, w);
        }
        let off = 0;
        for (let pass = 0; pass < 4; pass++) {
          let moved = false;
          for (let k = 0; k < placed && k < MAX_LABELS; k++) {
            if (Math.abs(at.x - px[k]!) < (w + pw[k]!) / 2 + 6 && Math.abs(at.y - off - py[k]!) < LABEL_GAP) {
              off = at.y - py[k]! + LABEL_GAP;
              moved = true;
            }
          }
          if (!moved) break;
        }
        if (placed < MAX_LABELS) {
          px[placed] = at.x;
          py[placed] = at.y - off;
          pw[placed] = w;
          placed++;
        }
        label.style.visibility = '';
        label.style.opacity = String(wanted);
        label.style.setProperty('--l-off', `${off}px`);
        label.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
      }
    },
  };
}
