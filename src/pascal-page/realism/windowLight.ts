/**
 * Ánh sáng cửa sổ (Ban ngày, mức Vừa/Cao): phòng thật được chiếu chủ yếu bởi ánh trời lọt qua ô
 * kính — sáng gần cửa, tối dần vào sâu, mặt hướng cửa sáng hơn. Mỗi cửa sổ gần camera nhất (tối đa
 * `WINDOW_LIGHT_MAX`) có một PointLight không đổ bóng ở tâm ô cửa, cường độ theo diện tích ô, màu
 * trời (màu bầu trời của hemisphereLight); ambient/hemi phẳng giảm theo `WINDOW_AMBIENT_SCALE`.
 * Pool đèn cố định (đèn thừa cường độ 0) → số đèn không đổi theo khung, không biên dịch lại shader.
 * Vendor gọi qua luật `scripts/realism/r9w-window-light.mjs`. Mức Thấp, chủ đề khác: không gì cả.
 */
import { Box3, type HemisphereLight, type Object3D, PointLight, type Scene, Vector3 } from 'three';

import { DAY_THEME_ID } from '../renderLook';
import { useRealism } from './store';

export const WINDOW_LIGHT_MAX = 8;
/** cd mỗi m² ô cửa (decay 2 → độ rọi I/d²). */
export const WINDOW_LIGHT_PER_M2 = 4;
export const WINDOW_LIGHT_RANGE_M = 7;
export const WINDOW_AMBIENT_SCALE = 0.6;

export function windowLightsOn(themeId: string, appearance: string, tier: string): boolean {
  // Núm đo trước/sau trong cùng một lượt chụp (`window.__realismWindowLight = false`).
  if ((globalThis as { __realismWindowLight?: boolean }).__realismWindowLight === false) return false;
  return themeId === DAY_THEME_ID && appearance !== 'dark' && tier !== 'low';
}

/** Hệ số nhân ambient/hemi của vendor (1 khi tắt) — áp vào giá trị đích nên lerp không cộng dồn. */
export function windowAmbientScale(themeId: string, appearance: string): number {
  return windowLightsOn(themeId, appearance, useRealism.getState().tier) ? WINDOW_AMBIENT_SCALE : 1;
}

export interface WindowPane {
  x: number;
  y: number;
  z: number;
  area: number;
}

/** Chỉ số các ô gần camera nhất (≤ max), gần trước. */
export function pickWindows(panes: readonly WindowPane[], cam: { x: number; y: number; z: number }, max = WINDOW_LIGHT_MAX): number[] {
  const d = (p: WindowPane) => (p.x - cam.x) ** 2 + (p.y - cam.y) ** 2 + (p.z - cam.z) ** 2;
  return panes
    .map((p, i) => [d(p), i] as const)
    .sort((a, b) => a[0] - b[0])
    .slice(0, max)
    .map(([, i]) => i);
}

export const windowIntensity = (area: number): number => Math.min(Math.max(area, 0), 6) * WINDOW_LIGHT_PER_M2;

/** Ô cửa từ hộp bao: cửa nằm trong mặt tường → rộng = cạnh ngang lớn hơn, cao = dy. */
export function paneFromBox(min: { x: number; y: number; z: number }, max: { x: number; y: number; z: number }): WindowPane {
  const w = Math.max(max.x - min.x, max.z - min.z);
  return { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2, area: w * (max.y - min.y) };
}

interface RegistryLike {
  nodes: Map<string, Object3D>;
  byType: Record<string, Set<string> | undefined>;
}

const box = new Box3();
const cache = new WeakMap<Object3D, { key: string; pane: WindowPane }>();
function paneOf(o: Object3D): WindowPane {
  const e = o.matrixWorld.elements;
  const key = `${e[12]},${e[13]},${e[14]},${e[0]},${e[10]}`;
  const hit = cache.get(o);
  if (hit && hit.key === key) return hit.pane;
  box.setFromObject(o);
  const pane = box.isEmpty() ? { x: e[12]!, y: e[13]!, z: e[14]!, area: 0 } : paneFromBox(box.min, box.max);
  cache.set(o, { key, pane });
  return pane;
}

let pool: PointLight[] = [];
const camPos = new Vector3();

/** Gọi mỗi khung từ `Lights` (vendor). */
export function syncWindowLights(
  registry: RegistryLike,
  scene: Scene,
  camera: Object3D,
  themeId: string,
  appearance: string,
  hemi: HemisphereLight | null,
): void {
  const on = windowLightsOn(themeId, appearance, useRealism.getState().tier);
  if (!on) {
    if (pool.length) {
      for (const l of pool) l.removeFromParent();
      pool = [];
    }
    return;
  }
  if (!pool.length) {
    pool = Array.from({ length: WINDOW_LIGHT_MAX }, () => {
      const l = new PointLight(0xffffff, 0, WINDOW_LIGHT_RANGE_M, 2);
      l.castShadow = false;
      l.name = 'realism-window-light';
      return l;
    });
  }
  for (const l of pool) if (l.parent !== scene) scene.add(l);
  const objs = [...(registry.byType.window ?? [])].map((id) => registry.nodes.get(id)).filter(Boolean) as Object3D[];
  const panes = objs.map(paneOf);
  camera.getWorldPosition(camPos);
  const picked = pickWindows(panes, camPos);
  pool.forEach((l, i) => {
    const p = picked[i] === undefined ? undefined : panes[picked[i]!];
    if (!p) {
      l.intensity = 0;
      return;
    }
    l.position.set(p.x, p.y, p.z);
    l.intensity = windowIntensity(p.area);
    if (hemi) l.color.copy(hemi.color);
  });
}
