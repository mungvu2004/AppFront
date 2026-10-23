/**
 * Bước 2 (thẻ M1): bảng loại vật liệu cho đồ nội thất Pascal.
 * Chỉ dữ liệu + hàm thuần (không three) để vitest kiểm được.
 */

export type MaterialKind =
  | 'fabric'
  | 'bedding'
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
  // Gói 1: thảm bỏ tua (mẫu `rug-nf`, cùng khe với rectangular-carpet).
  'rug-nf': { 'library:preset-taupe': 'fabric' },
  // Ba mẫu không khe, vật liệu gốc trắng r0.364 + specular ("nhựa trắng").
  // Giường: UV nhỏ → normal vải lặp dày thành hạt giấy nhám (review2) → vải trơn, không map.
  'double-bed': { '*': 'bedding' },
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
  /** Nhân màu (r, g, b): gỗ bớt cam. */
  tint?: readonly [number, number, number];
}

export const KIND_LOOK: Record<MaterialKind, KindLook> = {
  fabric: { roughness: 0.95, donor: 'library:fabric-cotton' },
  bedding: { roughness: 0.92 },
  leather: { roughness: 0.55, donor: 'library:leather-calf' },
  // Gói 1: gỗ đồ (tủ đầu giường, bàn) dưới đèn ấm ra cam rực → kéo về trung tính, tối nhẹ.
  wood: { roughness: null, roughnessScale: 1.6, roughnessMin: 0.45, tint: [0.8, 0.86, 0.95] },
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
