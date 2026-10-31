/**
 * S4 "lights" (render look B): bóng nắng mềm + đèn ấm mỗi phòng. Vendor gọi qua luật
 * `scripts/realism/r10-lights.mjs` (`lights.tsx`).
 *
 * 1) Bóng đèn chính: three 0.186 đã bỏ PCFSoftShadowMap (cả WebGPU lẫn WebGL2 rơi về PCF); VSM tốn
 *    thêm 2 lượt mờ và lọt sáng qua tường/trần mỏng chồng nhau. Giữ PCF (5 mẫu Vogel xoay theo IGN,
 *    TRAA làm mịn) nhưng đặt `shadow.radius` theo bề rộng khung bóng → vùng nửa tối ~`KEY_SHADOW_PENUMBRA_M`
 *    ngoài đời, bất kể căn hộ to/nhỏ hay bản đồ 1024/2048. `radius` là uniform → đổi mỗi khung không
 *    biên dịch lại shader.
 * 2) Buổi tối (chủ đề `night`, chế độ Rendered, mức Vừa/Cao): mỗi phòng (zone) một PointLight ấm
 *    #ffc98a ở tâm phòng dưới trần, không đổ bóng, cường độ theo diện tích, tầm kẹp theo kích thước phòng
 *    → ít lọt sang phòng bên. Theo bản Blender `F:/runs/login-tour/apt3.py` (`add_spot`, 5 W/m², 30–150 W).
 *    Pool đèn cố định như `windowLight.ts` (đèn thừa cường độ 0) → số đèn không đổi theo khung.
 */
import { type Object3D, PointLight, type Scene, Vector3 } from 'three';

import { NIGHT_THEME_ID } from '../renderLook';
import { useRealism } from './store';

/** Bề rộng vùng nửa tối mong muốn (m) của bóng nắng. */
export const KEY_SHADOW_PENUMBRA_M = 0.1;
/** = bán kính tĩnh của `r9-daylight` — không bao giờ cứng hơn hôm nay. */
export const KEY_SHADOW_RADIUS_MIN = 3;
/** PCF chỉ 5 mẫu: rộng hơn ~6 texel thì hạt nhiễu IGN lộ trước khi TRAA kịp làm mịn. */
export const KEY_SHADOW_RADIUS_MAX = 6;

/** Bán kính PCF (texel) cho khung bóng trực giao nửa cạnh `halfSize` m, bản đồ `mapSize` px. */
export function keyShadowRadius(halfSize: number, mapSize: number): number {
  if (!(halfSize > 0) || !(mapSize > 0)) return KEY_SHADOW_RADIUS_MIN;
  const texelM = (2 * halfSize) / mapSize;
  return Math.min(KEY_SHADOW_RADIUS_MAX, Math.max(KEY_SHADOW_RADIUS_MIN, KEY_SHADOW_PENUMBRA_M / texelM));
}

export const ROOM_LIGHT_MAX = 12;
export const ROOM_LIGHT_COLOR = 0xffc98a;
/** Núm chỉnh tay: cd mỗi m² sàn (Blender 5 W/m² ↔ ~0,5 cd/m² trên thang đèn của chủ đề `night`). */
export const ROOM_LIGHT_CD_PER_M2 = 0.5;
export const ROOM_LIGHT_MIN_CD = 3;
export const ROOM_LIGHT_MAX_CD = 15;
/** Độ cao đèn trên sàn phòng (m): dưới trần ~2,7–3 m, ngang tường mờ của zone. */
export const ROOM_LIGHT_HEIGHT_M = 2.3;
/** Tầm = khoảng từ đèn tới góc xa nhất × hệ số (three tắt mượt tới `distance`). */
export const ROOM_LIGHT_RANGE_SCALE = 1.15;
export const ROOM_LIGHT_RANGE_MIN_M = 2.5;
export const ROOM_LIGHT_RANGE_MAX_M = 7;
/** Ban công/lô gia: ngoài trời, Blender cũng bỏ. */
const OUTDOOR_ROOM = /ban công|balcony|lô ?gia|loggia/i;

export type Polygon = ReadonlyArray<readonly [number, number]>;

export function roomLightsOn(themeId: string, shading: string | undefined, tier: string): boolean {
  // Núm đo trước/sau (`window.__realismRoomLights = false`).
  if ((globalThis as { __realismRoomLights?: boolean }).__realismRoomLights === false) return false;
  return themeId === NIGHT_THEME_ID && shading !== 'solid' && tier !== 'low';
}

export function polygonArea(poly: Polygon): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i]!;
    const [x1, z1] = poly[(i + 1) % poly.length]!;
    s += x0 * z1 - x1 * z0;
  }
  return Math.abs(s) / 2;
}

/** Trọng tâm diện tích; đa giác suy biến → trung bình đỉnh. */
// ponytail: phòng chữ L có thể có trọng tâm ngoài phòng; khi gặp thì lấy điểm trong (pole of inaccessibility).
export function polygonCentroid(poly: Polygon): { x: number; z: number } {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i]!;
    const [x1, z1] = poly[(i + 1) % poly.length]!;
    const k = x0 * z1 - x1 * z0;
    a += k;
    cx += (x0 + x1) * k;
    cz += (z0 + z1) * k;
  }
  if (Math.abs(a) < 1e-9) {
    const n = Math.max(poly.length, 1);
    return { x: poly.reduce((s, p) => s + p[0], 0) / n, z: poly.reduce((s, p) => s + p[1], 0) / n };
  }
  return { x: cx / (3 * a), z: cz / (3 * a) };
}

export const roomLightIntensity = (area: number): number =>
  Math.min(ROOM_LIGHT_MAX_CD, Math.max(ROOM_LIGHT_MIN_CD, area * ROOM_LIGHT_CD_PER_M2));

/** Tầm sáng: tới góc xa nhất (tính cả độ cao đèn) × hệ số, kẹp [min, max]. */
export function roomLightRange(poly: Polygon, c: { x: number; z: number }, height = ROOM_LIGHT_HEIGHT_M): number {
  const far2 = poly.reduce((m, [x, z]) => Math.max(m, (x - c.x) ** 2 + (z - c.z) ** 2), 0);
  const reach = Math.sqrt(far2 + height * height) * ROOM_LIGHT_RANGE_SCALE;
  return Math.min(ROOM_LIGHT_RANGE_MAX_M, Math.max(ROOM_LIGHT_RANGE_MIN_M, reach));
}

export interface RoomInput {
  polygon: Polygon;
  name?: string;
}
export interface RoomLightPlan {
  /** Chỉ số trong mảng vào. */
  index: number;
  x: number;
  z: number;
  intensity: number;
  range: number;
}

/** Phòng nào có đèn: bỏ ngoài trời/suy biến, lớn trước (ổn định khi xoay camera), tối đa `max`. */
export function planRoomLights(rooms: readonly RoomInput[], max = ROOM_LIGHT_MAX): RoomLightPlan[] {
  return rooms
    .map((r, index) => ({ r, index, area: r.polygon.length >= 3 ? polygonArea(r.polygon) : 0 }))
    .filter(({ r, area }) => area > 0 && !OUTDOOR_ROOM.test(r.name ?? ''))
    .sort((a, b) => b.area - a.area)
    .slice(0, max)
    .map(({ r, index, area }) => {
      const c = polygonCentroid(r.polygon);
      return { index, x: c.x, z: c.z, intensity: roomLightIntensity(area), range: roomLightRange(r.polygon, c) };
    });
}

interface RegistryLike {
  nodes: Map<string, Object3D>;
  byType: Record<string, Set<string> | undefined>;
}
type ZoneNodeLike = { polygon?: Array<[number, number]>; name?: string } | undefined;

const shown = (o: Object3D | null): boolean => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

let pool: PointLight[] = [];
const pos = new Vector3();

/** Gọi mỗi khung từ `Lights` (vendor). `nodes` = `useScene.getState().nodes`. */
export function syncRoomLights(
  registry: RegistryLike,
  nodes: Record<string, unknown>,
  scene: Scene,
  themeId: string,
  shading: string | undefined,
): void {
  if (!roomLightsOn(themeId, shading, useRealism.getState().tier)) {
    if (pool.length) {
      for (const l of pool) l.removeFromParent();
      pool = [];
    }
    return;
  }
  if (!pool.length) {
    pool = Array.from({ length: ROOM_LIGHT_MAX }, () => {
      const l = new PointLight(ROOM_LIGHT_COLOR, 0, ROOM_LIGHT_RANGE_MIN_M, 2);
      l.castShadow = false;
      l.name = 'realism-room-light';
      return l;
    });
  }
  for (const l of pool) if (l.parent !== scene) scene.add(l);
  // ponytail: dùng `polygon` đã lưu của zone (không giải lại autoFromWalls) — đủ cho căn hộ nạp từ backend.
  const zones: { obj: Object3D; room: RoomInput }[] = [];
  for (const id of registry.byType.zone ?? []) {
    const obj = registry.nodes.get(id);
    const node = nodes[id] as ZoneNodeLike;
    if (obj && node?.polygon && shown(obj)) zones.push({ obj, room: { polygon: node.polygon, name: node.name } });
  }
  const plan = planRoomLights(zones.map((z) => z.room));
  pool.forEach((l, i) => {
    const p = plan[i];
    if (!p) {
      l.intensity = 0;
      return;
    }
    zones[p.index]!.obj.localToWorld(pos.set(p.x, ROOM_LIGHT_HEIGHT_M, p.z));
    l.position.copy(pos);
    l.intensity = p.intensity;
    l.distance = p.range;
  });
}
