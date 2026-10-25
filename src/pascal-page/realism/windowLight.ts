/**
 * Ánh sáng cửa sổ (Ban ngày, mức Vừa/Cao): phòng thật được chiếu chủ yếu bởi ánh trời lọt qua ô
 * kính — sáng gần cửa, tối dần vào sâu, mặt hướng cửa sáng hơn. Mỗi cửa sổ gần camera nhất (tối đa
 * `WINDOW_LIGHT_MAX`) có một PointLight không đổ bóng ở tâm ô cửa, cường độ theo diện tích ô, màu
 * trời (màu bầu trời của hemisphereLight); ambient/hemi phẳng giảm theo `WINDOW_AMBIENT_SCALE`.
 * Đèn lùi vào trong phòng `WINDOW_LIGHT_INSET_M` theo pháp tuyến ô cửa.
 * Pool đèn cố định (đèn thừa cường độ 0) → số đèn không đổi theo khung, không biên dịch lại shader.
 * Vendor gọi qua luật `scripts/realism/r9w-window-light.mjs`. Mức Thấp, chủ đề khác: không gì cả.
 */
import { Box3, type HemisphereLight, type Object3D, PointLight, type Scene, Vector3 } from 'three';

import { DAY_THEME_ID } from '../renderLook';
import { useRealism } from './store';

export const WINDOW_LIGHT_MAX = 8;
/** cd mỗi m² ô cửa (decay 2 → độ rọi I/d²). */
export const WINDOW_LIGHT_PER_M2 = 3;
export const WINDOW_LIGHT_RANGE_M = 7;
export const WINDOW_AMBIENT_SCALE = 0.6;
/** Lùi đèn vào trong phòng theo pháp tuyến ô cửa → rèm/khung sát cửa không bị đốm cháy. */
export const WINDOW_LIGHT_INSET_M = 0.7;

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
  /** Pháp tuyến ngang của ô cửa (dấu chưa định; `insetPoint` chọn phía trong). */
  nx: number;
  nz: number;
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
  const dx = max.x - min.x;
  const dz = max.z - min.z;
  const alongX = dx >= dz; // ô cửa trải theo x → pháp tuyến theo z
  return { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2, area: Math.max(dx, dz) * (max.y - min.y), nx: alongX ? 0 : 1, nz: alongX ? 1 : 0 };
}

/**
 * Điểm đặt đèn: lùi `inset` m theo pháp tuyến về phía `inside` (tâm các cửa sổ — cửa bao quanh nhà
 * nên tâm của chúng nằm trong nhà; chỉ một cửa thì dùng camera). Cùng phía với pháp tuyến → +.
 */
export function insetPoint(p: WindowPane, inside: { x: number; z: number }, inset = WINDOW_LIGHT_INSET_M): { x: number; y: number; z: number } {
  const dot = (inside.x - p.x) * p.nx + (inside.z - p.z) * p.nz;
  const s = dot >= 0 ? inset : -inset;
  return { x: p.x + p.nx * s, y: p.y, z: p.z + p.nz * s };
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
  const pane = box.isEmpty() ? { x: e[12]!, y: e[13]!, z: e[14]!, area: 0, nx: 0, nz: 0 } : paneFromBox(box.min, box.max);
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
  // ponytail: "trong nhà" = tâm các cửa sổ; nhà chữ L/U lệch nhiều có thể sai phía — khi đó dùng zone.
  const inside = panes.length > 1
    ? { x: panes.reduce((a, p) => a + p.x, 0) / panes.length, z: panes.reduce((a, p) => a + p.z, 0) / panes.length }
    : { x: camPos.x, z: camPos.z };
  pool.forEach((l, i) => {
    const p = picked[i] === undefined ? undefined : panes[picked[i]!];
    if (!p) {
      l.intensity = 0;
      return;
    }
    const q = insetPoint(p, inside);
    l.position.set(q.x, q.y, q.z);
    l.intensity = windowIntensity(p.area);
    if (hemi) l.color.copy(hemi.color);
  });
}
