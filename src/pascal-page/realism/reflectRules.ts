/** Phần thuần của `./reflect` (vitest chạy được): chọn vật liệu bóng + camera có ở trong nhà không. */
import { Box3, type Object3D, type Vector3 } from 'three';

/** Gương/inox/kính/sàn đá bóng: roughness thấp, hoặc kim loại hơi nhám. Lambert/Basic không có roughness → bỏ. */
export const GLOSSY_ROUGHNESS = 0.35;
export function isGlossy(m: { roughness?: unknown; metalness?: unknown; envMap?: unknown } | null | undefined): boolean {
  if (!m || typeof m.roughness !== 'number' || !('envMap' in m)) return false;
  const metal = typeof m.metalness === 'number' ? m.metalness : 0;
  return m.roughness <= GLOSSY_ROUGHNESS || (metal >= 0.5 && m.roughness <= 0.5);
}

const box = new Box3();
/** Trong nhà = dưới một trần (trong hộp xz của trần, thấp hơn trần ≤ 4 m). */
export function reflectProbeWanted(p: Vector3, ceilings: readonly Object3D[]): boolean {
  return ceilings.some((c) => {
    box.setFromObject(c);
    return p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z && p.y < box.max.y && p.y > box.max.y - 4;
  });
}
