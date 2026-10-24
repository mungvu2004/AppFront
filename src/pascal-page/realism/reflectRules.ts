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

/**
 * Kính kiểu Lambert (vendor `glassMaterial`, vai `glazing`, kính vách kính…): Lambert chỉ nhận môi trường
 * khuếch tán, không có phản xạ gương → kính phẳng, không thấy trời. Nhận diện: Lambert + (tên/transmission
 * như `isGlassLike`, hoặc trong suốt opacity < 0,6 như ngưỡng fresnel của vendor).
 */
export const GLASS_OPACITY_MAX = 0.6;
export function isLambertGlass(m: any): boolean {
  if (!m || !(m.isMeshLambertNodeMaterial || m.isMeshLambertMaterial)) return false;
  return (m.transmission ?? 0) > 0 || /glass|vetro/i.test(m.name ?? '') || (m.transparent === true && m.opacity < GLASS_OPACITY_MAX);
}

/** Tham số bản Standard thay kính Lambert: giữ màu/ảnh/opacity/mặt/depthWrite, thêm bóng (roughness thấp, metalness 0). */
export const GLASS_ROUGHNESS = 0.05;
export function glassTwinParams(m: any) {
  return {
    name: m.name ?? '',
    color: m.color,
    map: m.map ?? null,
    opacity: m.opacity,
    transparent: m.transparent,
    side: m.side,
    depthWrite: m.depthWrite,
    roughness: GLASS_ROUGHNESS,
    metalness: 0,
  };
}
