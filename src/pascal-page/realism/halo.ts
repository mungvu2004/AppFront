/**
 * Quầng hắt sáng quanh đèn âm trần: trần Pascal là MeshBasic (không nhận đèn) nên đèn âm trần
 * không để lại vệt sáng nào. Thêm đĩa cộng sáng (additive, gradient tròn) sát mặt dưới trần, cường
 * độ theo đèn (`itemLightIntensity` → Ban ngày = 0 → quầng tắt). Không thêm đèn, không bóng.
 * Vendor `item-light-system.tsx` gọi `syncRecessedHalos` mỗi khung (luật r10-surfaces.mjs).
 */
import { AdditiveBlending, CircleGeometry, Group, MathUtils, Mesh, type Object3D, Vector3 } from 'three';
import { color, float, uv } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

import { ITEM_LIGHT_SCALE, itemLightIntensity } from './itemLights';
import { useRealism } from './store';

/** Bán kính quầng tối đa (m, đèn 100 %) và độ sáng cộng thêm ở tâm khi đèn 100 %. */
export const HALO_RADIUS = 0.55;
export const HALO_STRENGTH = 0.35;
/** Bán kính lõi tương đối (0..1 của bán kính quầng): lõi sáng nhỏ, ngoài lõi rơi ~1/d². */
export const HALO_CORE = 0.12;
/** Cường độ tối đa của đèn âm trần trong catalog (`intensityRange[1]`). */
const LIGHT_MAX = 2;

interface HaloSource {
  key: string;
  nodeId: string;
  color: string;
  getIntensity: () => number;
  isEligible: () => boolean;
}

/** Độ mạnh quầng 0..1 theo cường độ đèn sau realism. */
export function haloLevel(intensity: number, sceneTheme?: string): number {
  return MathUtils.clamp(itemLightIntensity(intensity, sceneTheme) / (LIGHT_MAX * ITEM_LIGHT_SCALE), 0, 1);
}

/**
 * Bán kính quầng (m) theo mức đèn: vùng sáng vượt một ngưỡng của nguồn ~1/d² co theo √cường độ,
 * nên đèn yếu cho quầng nhỏ thay vì cùng một đĩa to mờ.
 */
export function haloRadius(level: number): number {
  return HALO_RADIUS * Math.sqrt(MathUtils.clamp(level, 0, 1));
}

/**
 * Độ sáng tương đối tại khoảng cách chuẩn hoá `d` (0 tâm .. 1 mép): lõi mềm kiểu 1/(1+(d/c)²)
 * (≈1/d² ngoài lõi) nhân cửa sổ (1−d²)² để về 0 đúng mép, không có viền đĩa.
 */
export function haloFalloff(d: number): number {
  const x = MathUtils.clamp(d, 0, 1);
  const w = (1 - x * x) ** 2;
  return w / (1 + (x / HALO_CORE) ** 2);
}

const geometry = new CircleGeometry(1, 48); // bán kính đơn vị, co theo `haloRadius` qua scale
const _d = uv().sub(0.5).length().mul(2).clamp(0, 1);
const _w = float(1).sub(_d.mul(_d)).pow(2);
const falloff = _w.div(float(1).add(_d.div(HALO_CORE).pow(2)));
const groups = new WeakMap<Object3D, Group>();
const _pos = new Vector3();

function makeHalo(hex: string): Mesh {
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 });
  mat.colorNode = color(hex).mul(falloff);
  const mesh = new Mesh(geometry, mat);
  mesh.rotation.x = Math.PI / 2; // mặt nhìn xuống
  mesh.raycast = () => {};
  mesh.renderOrder = 1;
  return mesh;
}

function shown(object: Object3D | null): boolean {
  for (let o = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export function syncRecessedHalos(
  scene: Object3D,
  sources: ReadonlyMap<string, HaloSource>,
  objects: ReadonlyMap<string, Object3D>,
  nodes: Readonly<Record<string, unknown>>,
  sceneTheme: string | undefined,
  dt: number,
): void {
  let group = groups.get(scene);
  if (!useRealism.getState().flags.materials) {
    if (group) group.visible = false;
    return;
  }
  if (!group) {
    group = new Group();
    group.name = 'realism-recessed-halos';
    groups.set(scene, group);
  }
  if (group.parent !== scene) scene.add(group);
  group.visible = true;

  const seen = new Set<string>();
  for (const [key, src] of sources) {
    const asset = (nodes[src.nodeId] as { asset?: { recessed?: boolean } } | undefined)?.asset;
    const object = objects.get(src.nodeId);
    if (!asset?.recessed || !object) continue;
    seen.add(key);
    let halo = group.getObjectByName(key) as Mesh | undefined;
    if (!halo) {
      halo = makeHalo(src.color);
      halo.name = key;
      group.add(halo);
    }
    object.getWorldPosition(_pos);
    halo.position.set(_pos.x, _pos.y - 0.004, _pos.z);
    const level = shown(object) && src.isEligible() ? haloLevel(src.getIntensity(), sceneTheme) : 0;
    const target = level * HALO_STRENGTH;
    if (level > 0) halo.scale.setScalar(haloRadius(level));
    const mat = halo.material as MeshBasicNodeMaterial;
    mat.opacity = MathUtils.lerp(mat.opacity, target, Math.min(1, dt * 12));
    halo.visible = mat.opacity > 0.002;
  }
  for (const child of [...group.children]) {
    if (seen.has(child.name)) continue;
    group.remove(child);
    ((child as Mesh).material as MeshBasicNodeMaterial).dispose();
  }
}
