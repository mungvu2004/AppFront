/**
 * Cuối trang combo: phòng khách 3D nướng sáng (live/viewer.ts, cùng góc máy với khung ảnh cuối) thay khung ảnh,
 * người xem kéo để nhìn quanh. Chỉ tải khi người xem bấm nút: nạp GLB (37 MB) làm trang đứng 2–8 s trên Intel UHD,
 * tự tải giữa lúc cuộn thì người xem thấy giật. Không có WebGL hay tải lỗi thì khung ảnh cuối cứ ở yên.
 */

import { LIVE_AT } from '@/lib/landing-lab/combo/layout';
import type { LiveViewer } from '@/lib/landing-lab/live/viewer';

const SCENE = '/landing-lab/live/house';
const POSE = 'interior';
/** Look around the living room, never out of it: yaw / pitch in degrees around the photographed pose. */
const LIMIT_DEG = [22, 8] as const;
/** Turn on the spot (orbit point 10 cm ahead): orbiting the far focus point walks the camera through the walls. */
const PIVOT_M = 0.1;

export interface ComboLive {
  step(p: number): void;
  dispose(): void;
}

export function createComboLive(root: HTMLElement, canvas: HTMLCanvasElement | null, button: HTMLButtonElement | null, enabled: boolean): ComboLive {
  let viewer: LiveViewer | null = null;
  let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  let on = false;
  let disposed = false;
  let p = 0;

  const show = (): void => {
    root.toggleAttribute('data-end', enabled && p >= LIVE_AT && state !== 'failed');
    const next = state === 'ready' && p >= LIVE_AT;
    if (next === on) return;
    on = next;
    root.toggleAttribute('data-live', on);
    // Back to the photograph: the next hand-over starts again from the photographed pose.
    if (!on) viewer?.setPose(POSE);
  };

  const load = (): void => {
    if (state !== 'idle' || canvas === null) return;
    state = 'loading';
    root.setAttribute('data-live-loading', '');
    import('@/lib/landing-lab/live/viewer')
      .then(async ({ createLiveViewer }) => {
        if (disposed) return;
        viewer = createLiveViewer(canvas, SCENE, POSE, { zoom: false, limitDeg: LIMIT_DEG, pivot: PIVOT_M });
        await viewer.ready;
        state = 'ready';
      })
      .catch(() => {
        state = 'failed'; // no WebGL or a failed load: the last frame stays
      })
      .finally(() => {
        root.removeAttribute('data-live-loading');
        if (!disposed) show();
      });
  };
  button?.addEventListener('click', load);

  return {
    step(next) {
      p = next;
      show();
    },
    dispose() {
      disposed = true;
      button?.removeEventListener('click', load);
      viewer?.dispose();
    },
  };
}
