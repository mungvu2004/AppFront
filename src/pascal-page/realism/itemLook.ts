/**
 * Bước 2 (thẻ M1): bảng loại vật liệu cho đồ nội thất Pascal.
 * Chỉ dữ liệu + hàm thuần (không three) để vitest kiểm được.
 */

export type MaterialKind =
  | 'fabric'
  | 'leather'
  | 'wood'
  | 'metal'
  | 'ceramic'
  | 'leaf'
  | 'bark'
  | 'plastic'
  | 'matte';

/**
 * Ghi đè theo thư mục mẫu. Khoá: slotId, hoặc ref vật liệu (`library:…`),
 * hoặc `*` = mẫu không có khe (một vật liệu gốc trong GLB).
 */
export const ITEM_KIND: Record<string, Record<string, MaterialKind>> = {
  // Thân sofa/ghế bành là preset-taupe phẳng = khối nâu trơn → bọc vải.
  sofa: { 'library:preset-taupe': 'fabric' },
  'livingroom-chair': { 'library:preset-taupe': 'fabric' },
  'dining-chair': { 'library:preset-taupe': 'fabric' },
  'rectangular-carpet': { 'library:preset-taupe': 'fabric' },
  // Ba mẫu không khe, vật liệu gốc trắng r0.364 + specular ("nhựa trắng").
  'double-bed': { '*': 'fabric' },
  fridge: { '*': 'matte' },
  'ceiling-lamp': { '*': 'matte' },
};

/** Đoán loại theo tên ref (`library:fabric-linen`, `scene:mat_appfront_bark`…). */
export function refKind(ref: string | undefined | null): MaterialKind | null {
  if (!ref) return null;
  const r = ref.toLowerCase();
  if (/leather/.test(r)) return 'leather';
  if (/fabric|linen|wool|velvet|boucle|cotton|suede/.test(r)) return 'fabric';
  if (/bark/.test(r)) return 'bark';
  if (/preset-forest|leaf|foliage/.test(r)) return 'leaf';
  if (/marble|statuar|ceramic|terracotta|porcelain|tile/.test(r)) return 'ceramic';
  if (/wood|oak|walnut|parquet/.test(r)) return 'wood';
  if (/metal|brass|steel|chrome|copper|alumin/.test(r)) return 'metal';
  return null;
}

/** `/items/sofa/model.glb` → `sofa` (cả `/appfront-items/<x>/`). */
export function folderOf(src: string | undefined | null): string | null {
  const m = src ? /\/(?:appfront-)?items\/([^/?#]+)\//.exec(src) : null;
  return m ? m[1] : null;
}

export function itemKindOf(
  folder: string | null,
  slotId: string | null,
  ref: string | undefined | null,
): MaterialKind | null {
  const table = folder ? ITEM_KIND[folder] : undefined;
  if (table) {
    if (slotId != null && table[slotId]) return table[slotId];
    if (ref && table[ref]) return table[ref];
    if (slotId == null && table['*']) return table['*'];
  }
  return refKind(ref);
}

export interface KindLook {
  /** roughness cố định; `null` = nhân `roughnessScale` rồi kẹp ≥ `roughnessMin`. */
  roughness: number | null;
  roughnessScale?: number;
  roughnessMin?: number;
  metalness?: number;
  /** Vật liệu thư viện lấy normalMap/roughnessMap khi bản thân không có. */
  donor?: string;
}

export const KIND_LOOK: Record<MaterialKind, KindLook> = {
  fabric: { roughness: 0.95, donor: 'library:fabric-cotton' },
  leather: { roughness: 0.55, donor: 'library:leather-calf' },
  wood: { roughness: null, roughnessScale: 1.6, roughnessMin: 0.45 },
  metal: { roughness: 0.3, metalness: 1 },
  ceramic: { roughness: 0.25 },
  leaf: { roughness: 0.7 },
  bark: { roughness: 0.9 },
  plastic: { roughness: 0.5 },
  matte: { roughness: 0.8 },
};

export function tunedRoughness(kind: MaterialKind, current: number): number {
  const look = KIND_LOOK[kind];
  if (look.roughness != null) return look.roughness;
  return Math.min(1, Math.max(look.roughnessMin ?? 0, current * (look.roughnessScale ?? 1)));
}
