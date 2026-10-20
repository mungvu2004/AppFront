/**
 * Lớp DOM phủ lên canvas, vẽ lại mỗi khung từ `LandingState`.
 *
 * Ghi thẳng vào style của các phần tử đã có (không qua React) vì nó chạy mỗi
 * khung hình khi cuộn; một lượt render React mỗi khung là điều bài này cấm.
 * Mọi giá trị chỉ suy ra từ `p`, khoảng cảnh và `state`, nên đi ngược lại cho
 * đúng khung cũ.
 */

import type { LandingState } from '@/lib/landing/types';

import { copyPhase } from './landing.copy';

export interface SceneSpan {
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

export interface Overlay {
  update(state: LandingState, project: Projector | null): void;
}

export function createOverlay(root: HTMLElement, scenes: readonly SceneSpan[]): Overlay {
  const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-scene]'));
  const parts = sections.map((s) => Array.from(s.querySelectorAll<HTMLElement>('[data-delay]')));
  const exportItems = Array.from(root.querySelectorAll<HTMLElement>('[data-export]'));
  const labels = Array.from(root.querySelectorAll<HTMLElement>('[data-label]'));
  const last = scenes.length - 1;

  return {
    update(state, project) {
      const { p } = state;

      sections.forEach((section, i) => {
        const index = Number(section.dataset.scene);
        const span = scenes[index];
        if (span === undefined) return;
        const inside = p >= span.start && p < span.end;
        section.style.visibility = inside || (index === last && p >= span.start) ? '' : HIDDEN;
        parts[i]?.forEach((part) => {
          const phase = copyPhase(
            p,
            span.start,
            span.end,
            Number(part.dataset.delay),
            index === last,
            index === 0,
          );
          setPhase(part, phase.opacity, phase.y);
        });
      });

      exportItems.forEach((item, i) => {
        const t = clamp01(state.exports * 1.7 - i * 0.14);
        setPhase(item, 1 - (1 - t) ** 3, (1 - t) * 14);
      });

      labels.forEach((label) => {
        const id = label.dataset.label ?? '';
        const wanted = state.labels[id] ?? 0;
        const at = wanted > 0 && project !== null ? project(id) : null;
        if (at === null || !at.visible) {
          label.style.opacity = '0';
          label.style.visibility = HIDDEN;
          return;
        }
        label.style.visibility = '';
        label.style.opacity = String(wanted);
        label.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
      });
    },
  };
}
