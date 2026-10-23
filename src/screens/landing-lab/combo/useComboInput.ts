/**
 * Con trỏ và bàn phím của bản kết hợp (không phải hook React: vòng chạy trong useCombo gọi nó mỗi khung).
 * Rê lên một phòng trên mặt bằng → tô nhẹ + tên, diện tích; rê/bấm một tầng ở cảnh tách tầng → tầng nâng lên;
 * nút "Tầng n" (Tab tới, Enter) làm điều tương tự cho bàn phím; thị sai ≤ 8 px theo con trỏ.
 */

import type { V2 } from '@/lib/landing-lab/blueprint/model';
import { NO_UI, pickFloor, pickRoom, type Hits, type RoomRef, type Ui } from '@/lib/landing-lab/combo/interact';
import type { Stage } from '@/lib/landing-lab/combo/stage';

export interface ComboInput {
  readonly ui: () => Ui;
  readonly step: (dt: number) => void;
  /** Still easing (parallax, lifts) or the hover changed: draw again. */
  readonly moving: () => boolean;
  /** Keeps the floor buttons on top of the floor labels the stage drew. */
  readonly place: (hits: Hits) => void;
  readonly dispose: () => void;
}

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-3;

export function createComboInput(root: HTMLElement, stage: () => Stage | null, wake: () => void): ComboInput {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-floor]'));
  let par: V2 = [0, 0];
  let parTo: V2 = [0, 0];
  let room: RoomRef | null = null;
  let hover = -1;
  let focus = -1;
  const chosen = [false, false, false];
  const lift = [0, 0, 0];
  let changed = false;

  const liftTo = (i: number): number => (chosen[i] === true || hover === i || focus === i ? 1 : 0);

  const onMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    if (!reduce) parTo = [(e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1];
    const hits = stage()?.hits();
    if (hits !== undefined) {
      const r = pickRoom(hits, e.clientX, e.clientY);
      if (r?.id !== room?.id || r?.level !== room?.level) {
        room = r;
        changed = true;
      }
      const f = pickFloor(hits, e.clientX, e.clientY);
      if (f !== hover) {
        hover = f;
        changed = true;
      }
      root.style.cursor = f >= 0 ? 'pointer' : '';
    }
    wake();
  };
  const onLeave = (): void => {
    parTo = [0, 0];
    room = null;
    hover = -1;
    changed = true;
    wake();
  };
  const onClick = (e: MouseEvent): void => {
    if ((e.target as HTMLElement | null)?.closest('a, button') !== null || hover < 0) return;
    chosen[hover] = !(chosen[hover] ?? false);
    changed = true;
    wake();
  };
  const listeners = buttons.map((b) => {
    const i = Number(b.dataset['floor']);
    const click = (): void => {
      chosen[i] = !(chosen[i] ?? false);
      b.setAttribute('aria-pressed', String(chosen[i]));
      changed = true;
      wake();
    };
    const onFocus = (): void => {
      focus = i;
      wake();
    };
    const onBlur = (): void => {
      if (focus === i) focus = -1;
      wake();
    };
    b.addEventListener('click', click);
    b.addEventListener('focus', onFocus);
    b.addEventListener('blur', onBlur);
    return () => {
      b.removeEventListener('click', click);
      b.removeEventListener('focus', onFocus);
      b.removeEventListener('blur', onBlur);
    };
  });
  addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  root.addEventListener('click', onClick);

  return {
    ui: () => (par[0] === 0 && par[1] === 0 && room === null && lift.every((l) => l === 0) ? NO_UI : { parallax: par, room, lift: [...lift] }),
    step: (dt) => {
      const a = 1 - Math.exp(-6 * dt);
      par = [par[0] + (parTo[0] - par[0]) * a, par[1] + (parTo[1] - par[1]) * a];
      if (near(par[0], parTo[0]) && near(par[1], parTo[1])) par = parTo;
      const b = reduce ? 1 : 1 - Math.exp(-8 * dt);
      lift.forEach((l, i) => {
        const to = liftTo(i);
        lift[i] = near(l, to) ? to : l + (to - l) * b;
      });
    },
    moving: () => {
      const m = changed || par[0] !== parTo[0] || par[1] !== parTo[1] || lift.some((l, i) => l !== liftTo(i));
      changed = false;
      return m;
    },
    place: (hits) => {
      buttons.forEach((b) => {
        const at = hits.labels[Number(b.dataset['floor'])];
        b.style.visibility = at === null || at === undefined ? 'hidden' : 'visible';
        if (at !== null && at !== undefined) b.style.transform = `translate3d(${String(Math.round(at[0] - 8))}px, ${String(Math.round(at[1] - 22))}px, 0)`;
      });
    },
    dispose: () => {
      removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      root.removeEventListener('click', onClick);
      listeners.forEach((off) => off());
    },
  };
}
