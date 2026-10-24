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

/** Bán kính quầng (m) và độ sáng cộng thêm ở tâm khi đèn 100 %. */
export const HALO_RADIUS = 0.9;
export const HALO_STRENGTH = 0.35;
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

const geometry = new CircleGeometry(HALO_RADIUS, 48);
// Tâm 1 → mép 0, rơi bậc hai cho mềm.
const falloff = float(1).sub(uv().sub(0.5).length().mul(2)).clamp(0, 1).pow(2);
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
    const target = shown(object) && src.isEligible() ? haloLevel(src.getIntensity(), sceneTheme) * HALO_STRENGTH : 0;
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
