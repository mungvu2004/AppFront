/**
 * Bốn góc camera cố định của bộ đo editor-realism (R0). Toạ độ tính bằng một công thức cố định
 * từ hộp bao tường của dự án (m, toạ độ cảnh: x, y lên, z), nên cùng fixture luôn ra cùng số.
 * Số đã giải cho từng dự án được ghi vào `metrics.json` (`poses`) để đợt sau so lại.
 */
export type Vec3 = [number, number, number];
export interface Pose {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number | 'top-ortho';
}
export interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export const POSE_NAMES = ['top', 'high-diag', 'eye-outside', 'interior'] as const;
export type PoseName = (typeof POSE_NAMES)[number];

const r2 = (v: number) => Math.round(v * 100) / 100;
const v = (x: number, y: number, z: number): Vec3 => [r2(x), r2(y), r2(z)];

export function posesFor(b: Bounds): Record<PoseName, Pose> {
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 4);
  return {
    // Trên xuống: chiếu trực giao, cao 2 × cạnh lớn.
    top: { position: v(cx, span * 2, cz + 0.01), target: v(cx, 0, cz), fov: 'top-ortho' },
    // Chéo cao: góc 45° phía +x +z, cao ~0,9 × cạnh.
    'high-diag': { position: v(cx + span * 0.8, span * 0.9, cz + span * 0.8), target: v(cx, 0, cz), fov: 50 },
    // Ngang mắt ngoài nhà: cách mép +z 0,6 × cạnh, cao 1,6 m.
    'eye-outside': { position: v(cx + span * 0.2, 1.6, b.maxZ + span * 0.6), target: v(cx, 1.4, cz), fov: 55 },
    // Trong phòng: tâm hộp bao, cao 1,6 m, nhìn về phía +x.
    interior: { position: v(cx, 1.6, cz), target: v(cx + 3, 1.3, cz + 0.5), fov: 70 },
  };
}
