/**
 * Kích thước đồ vật theo mm cho `HomeownerCard`. Pascal chỉ co giãn đồ bằng `node.scale` × `asset.dimensions`
 * (mét, thứ tự trục [rộng x, cao y, sâu z]); hàm ở đây đổi qua lại giữa mm người dùng gõ và `scale`.
 * Lượt về (`toSpatial`) tự đổi `scale` thành hộp bao / `heightMm` — thẻ chỉ ghi `scale`.
 */

export type Vec3 = readonly [number, number, number];
export type Axis = 0 | 1 | 2;

/** Trường Pascal của node đồ vật mà thẻ cần (kiểu `HomeownerNode` không khai). */
export interface SizedItem {
  readonly scale?: Vec3;
  readonly asset?: { readonly dimensions?: Vec3; readonly category?: string; readonly attachTo?: string };
}

/** Thứ tự hiển thị Dài × Sâu × Cao = trục Pascal x, z, y. */
export const SIZE_FIELDS: readonly { readonly axis: Axis; readonly label: string }[] = [
  { axis: 0, label: 'Dài' },
  { axis: 2, label: 'Sâu' },
  { axis: 1, label: 'Cao' },
];

export const MAX_SIZE_MM = 10_000;
export const RIGID_HINT = 'Đồ cứng không kéo méo quá 25%';

/**
 * `toPascal` nạp lại đồ cứng với mỗi trục mặt bằng trong [0,8; 1,25] × trung bình nhân hai trục, tức
 * tỉ lệ rộng/sâu trong [0,64; 1,5625]. Dãy tủ (`STRETCH_FOLDERS`: tủ áo, tủ bếp…) kéo dài tự do.
 * ponytail: nhận dãy tủ qua `asset.category` (= `furniture.kind`); toPascal xuất bộ thư mục thì dùng thẳng.
 */
const STRETCH_CATEGORIES: ReadonlySet<string> = new Set(['wardrobe', 'kitchenCabinet']);
const AXIS_MIN = 0.8;
const AXIS_MAX = 1.25;
const RATIO_MIN = AXIS_MIN / AXIS_MAX;
const RATIO_MAX = AXIS_MAX / AXIS_MIN;

export const isRigidItem = (category: string | undefined): boolean => !STRETCH_CATEGORIES.has(category ?? '');

/** mm đang thấy của từng trục Pascal. */
export const sizeMmOf = (dimensions: Vec3, scale: Vec3): Vec3 => [
  Math.round(dimensions[0] * scale[0] * 1000),
  Math.round(dimensions[1] * scale[1] * 1000),
  Math.round(dimensions[2] * scale[2] * 1000),
];

/** 1200 → "1.200" (nhóm nghìn kiểu Việt). */
export const formatMm = (mm: number): string => String(Math.round(mm)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** "1.200" / "1200" / "1 200" → 1200; "12,5" → 13. Không phải số → NaN. */
export const parseMm = (text: string): number => {
  const cleaned = text.replace(/[\s.]/g, '').replace(',', '.');
  return cleaned === '' ? Number.NaN : Math.round(Number(cleaned));
};

export type ResizeResult =
  | { readonly ok: true; readonly scale: Vec3; readonly clamped: boolean }
  | { readonly ok: false; readonly reason: string };

const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * `scale` mới khi đặt trục `axis` thành `mm`. Giữ tỉ lệ: nhân đều ba trục. Không giữ: chỉ trục đó; đồ
 * cứng kẹp trục mặt bằng vừa sửa vào khung tỉ lệ nạp lại được (`clamped` = đã kẹp).
 */
export const resizedScale = (
  dimensions: Vec3,
  scale: Vec3,
  axis: Axis,
  mm: number,
  keepRatio: boolean,
  rigid: boolean,
): ResizeResult => {
  const invalid = `Nhập số từ 1 đến ${formatMm(MAX_SIZE_MM)} mm`;
  if (!Number.isFinite(mm) || mm <= 0 || mm > MAX_SIZE_MM) return { ok: false, reason: invalid };
  if (!dimensions.every((d) => d > 0) || !scale.every((s) => s > 0)) return { ok: false, reason: invalid };

  const target = mm / 1000 / dimensions[axis];
  let next: [number, number, number];
  let clamped = false;
  if (keepRatio) {
    const k = target / scale[axis];
    next = [scale[0] * k, scale[1] * k, scale[2] * k];
  } else {
    next = [scale[0], scale[1], scale[2]];
    next[axis] = target;
    if (rigid && axis !== 1) {
      // So độ méo trên `scale` (đồ theo bản vẽ mở ra với scale [1,1,1], dáng mẫu nằm trong `asset.scale`),
      // không trên số đo thật: giường 1,6 × 2,0 m vốn không vuông.
      // ponytail: xấp xỉ — toPascal so với số đo mẫu catalog; mẫu đã sát biên thì nạp lại vẫn co chút ít.
      const other = next[axis === 0 ? 2 : 0];
      const kept = clampTo(target, other * RATIO_MIN, other * RATIO_MAX);
      clamped = kept !== target;
      next[axis] = kept;
    }
  }
  if (sizeMmOf(dimensions, next).some((v) => v < 1 || v > MAX_SIZE_MM)) return { ok: false, reason: invalid };
  return { ok: true, scale: next, clamped };
};
