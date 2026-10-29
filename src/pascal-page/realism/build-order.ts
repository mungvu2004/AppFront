/**
 * Thứ tự dựng shader lúc nạp (W2, `warm.ts`): vật lớn trên màn hình dựng trước.
 *
 * Bản dựng chạy nối tiếp, khoảng một bản mỗi khung (đoạn đầu đã quá ngân sách khung). Theo thứ tự danh
 * sách vẽ thì tường, sàn, trần nằm cuối: F1 ở giây 5 mới thấy khung tường và vài món đồ, tường dựng lúc
 * 6,6 s, sàn và trần lúc 8,7–9,2 s (đo 2026-10-29, `F:/App/qa-results/perf-load-editor3d/NGUYEN-NHAN.md`).
 * Tổng thời gian không đổi; chỉ đổi thứ tự để căn phòng hiện đủ sớm.
 */
interface Sphere {
  center: { x: number; y: number; z: number };
  radius: number;
}
interface ObjectLike {
  frustumCulled?: boolean;
  matrixWorld?: { elements: ArrayLike<number> };
  isBatchedMesh?: boolean;
  boundingSphere?: Sphere | null;
  computeBoundingSphere?: () => void;
  geometry?: { boundingSphere: Sphere | null; computeBoundingSphere(): void };
}

/**
 * Vật không cắt theo khung nhìn (`frustumCulled = false`, ngoài BatchedMesh): nền/vật phủ màn hình, ví dụ
 * `Background.mesh` mà three chèn đầu danh sách mỗi khung. Hoãn chúng tới cuối khung thì F1 ra nền đen,
 * nên W2 dựng chúng ngay như cũ (đứng đầu danh sách vẽ nên vốn đã dựng trước).
 */
export const coversScreen = (object: unknown): boolean => {
  const o = object as ObjectLike | null;
  return o?.frustumCulled === false && o.isBatchedMesh !== true;
};

/** Bán kính bao / khoảng cách tới camera, tức cỡ góc của vật trên màn hình. 0 nếu không đo được. */
export function screenSize(object: unknown, camera: unknown): number {
  const o = object as ObjectLike | null;
  const e = o?.matrixWorld?.elements;
  const c = (camera as ObjectLike | null | undefined)?.matrixWorld?.elements;
  if (!o || !e || !c) return 0;
  let s: Sphere | null | undefined;
  if (o.isBatchedMesh) {
    if (!o.boundingSphere) o.computeBoundingSphere?.();
    s = o.boundingSphere;
  } else if (o.geometry) {
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    s = o.geometry.boundingSphere;
  }
  if (!s) return 0;
  const { x, y, z } = s.center;
  const at = (i: number) => e[i] ?? 0;
  const dx = at(0) * x + at(4) * y + at(8) * z + at(12) - (c[12] ?? 0);
  const dy = at(1) * x + at(5) * y + at(9) * z + at(13) - (c[13] ?? 0);
  const dz = at(2) * x + at(6) * y + at(10) * z + at(14) - (c[14] ?? 0);
  const scale = Math.sqrt(
    Math.max(at(0) ** 2 + at(1) ** 2 + at(2) ** 2, at(4) ** 2 + at(5) ** 2 + at(6) ** 2, at(8) ** 2 + at(9) ** 2 + at(10) ** 2),
  );
  return (s.radius * scale) / Math.max(0.1, Math.hypot(dx, dy, dz));
}
