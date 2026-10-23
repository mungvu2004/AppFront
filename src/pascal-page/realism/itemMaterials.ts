/**
 * Bước 2 (thẻ M1): chỉnh vật liệu đồ nội thất theo loại, lúc chạy.
 * Gọi từ vendor `nodes/src/item/renderer.tsx` (luật scripts/realism/r7-item-materials.mjs)
 * bọc kết quả `resolveItemMaterial`. Không đổi node/JSON: chỉ clone vật liệu
 * (cache theo uuid gốc + loại), giữ màu, đổi roughness/metalness, thêm map vải/da.
 * Cờ `flags.materials` tắt, textures=false (clay), kính → trả nguyên vật liệu.
 */
import type { Material, Texture } from 'three';
import { folderOf, itemKindOf, KIND_LOOK, tunedRoughness } from './itemLook';
import { useRealism } from './store';

type TunableMaterial = Material & {
  roughness?: number;
  metalness?: number;
  normalMap?: Texture | null;
  roughnessMap?: Texture | null;
  specularIntensity?: number;
};

export interface TuneContext {
  src?: string | null;
  slotId: string | null;
  ref?: string | null;
  textures: boolean;
  /** Phân giải ref thư viện (vendor `resolveMaterialRef`). */
  donor?: (ref: string) => Material | null;
}

const cache = new Map<string, Material>();

function copyDonorMaps(target: TunableMaterial, donor: TunableMaterial): boolean {
  let changed = false;
  if (!target.normalMap && donor.normalMap) {
    target.normalMap = donor.normalMap;
    changed = true;
  }
  if (!target.roughnessMap && donor.roughnessMap) {
    target.roughnessMap = donor.roughnessMap;
    changed = true;
  }
  if (changed) target.needsUpdate = true;
  return Boolean(donor.normalMap && donor.roughnessMap);
}

/** Map của vật liệu thư viện gán bất đồng bộ → thử lại vài giây. */
function attachDonor(target: TunableMaterial, donor: TunableMaterial): void {
  if (copyDonorMaps(target, donor)) return;
  let tries = 0;
  const id = setInterval(() => {
    if (copyDonorMaps(target, donor) || ++tries > 40) clearInterval(id);
  }, 250);
}

export function tuneItemMaterial(mat: Material, ctx: TuneContext): Material {
  if (!ctx.textures || !useRealism.getState().flags.materials) return mat;
  const m = mat as TunableMaterial;
  if (typeof m.roughness !== 'number' || m.transparent || m.name.toLowerCase() === 'glass') return mat;
  const kind = itemKindOf(folderOf(ctx.src), ctx.slotId, ctx.ref);
  if (!kind) return mat;

  const key = `${mat.uuid}|${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const look = KIND_LOOK[kind];
  const next = mat.clone() as TunableMaterial;
  next.name = `${mat.name}|${kind}`;
  next.roughness = tunedRoughness(kind, m.roughness);
  if (look.metalness != null) next.metalness = look.metalness;
  // KHR_materials_specular của mẫu gốc làm trắng bóng: đưa về mặc định.
  if (typeof next.specularIntensity === 'number') next.specularIntensity = Math.min(next.specularIntensity, 0.5);
  if (look.donor && ctx.donor && (!next.normalMap || !next.roughnessMap)) {
    const donor = ctx.donor(look.donor) as TunableMaterial | null;
    if (donor) attachDonor(next, donor);
  }
  next.needsUpdate = true;
  cache.set(key, next);
  return next;
}

/** Cho test. */
export function clearItemMaterialCache(): void {
  cache.clear();
}
