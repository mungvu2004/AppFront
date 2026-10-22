/**
 * R4 (GĐ4) ánh sáng: HDRI tự host thay trời gradient cho chủ đề SÁNG (Ban ngày, Nắng chiều).
 * Phần thuần (quyết định tải, pha gradient) ở đây để vitest chạy; phần nạp ở `./lighting-hdri`.
 */

/** Chép từ `vendor/pascal/assets/hdri/venice_sunset_1k.hdr` bởi `scripts/copy-pascal-assets.mjs`. */
export const HDRI_URL = '/pascal/hdri/venice-sunset-v1-1k.hdr';
/** Quá hạn này giữ môi trường cũ (trời gradient / RoomEnvironment), bỏ kết quả về muộn. */
export const HDRI_TIMEOUT_MS = 10_000;

/**
 * Biến thể: `pure` = HDRI nguyên; `gradient` = HDRI pha trời gradient dọc của
 * `scene-environment.tsx` (giữ ý mặt hướng lên mát, mặt đứng ấm).
 * Chọn `gradient`: xem `qa-results/editor-realism/R-R4.md` (lý do + ảnh so).
 */
export type HdriVariant = 'pure' | 'gradient';
export const HDRI_VARIANT: HdriVariant = 'gradient';
/** Tỉ lệ gradient khi pha (0 = HDRI thuần, 1 = gradient thuần). */
export const HDRI_GRADIENT_WEIGHT = 0.5;

/** Chỉ WebGPU (có PMREM + hậu kỳ), cờ `viewer.realism-hdri` bật, chủ đề sáng (tối dùng RoomEnvironment). */
export function shouldLoadHdri(opts: { backend: string; flag: boolean; appearance: string }): boolean {
  return opts.backend === 'webgpu' && opts.flag && opts.appearance !== 'dark';
}

// Cùng điểm dừng (tuyến tính) với `scene-environment.tsx` của vendor.
const ZENITH = [0.4, 0.56, 0.78] as const;
const HORIZON = [0.95, 0.84, 0.66] as const;
const GROUND = [0.38, 0.35, 0.3] as const;

/** Màu trời gradient ở vĩ độ `lat` ∈ [-1, 1] (−1 = đáy, 1 = đỉnh) — cùng công thức vendor. */
export function gradientAt(lat: number): [number, number, number] {
  if (lat <= 0) {
    const k = 1 + lat * 0.35;
    return [GROUND[0] * k, GROUND[1] * k, GROUND[2] * k];
  }
  const t = lat ** 0.65;
  return [0, 1, 2].map((c) => HORIZON[c] + (ZENITH[c] - HORIZON[c]) * t) as [number, number, number];
}

/**
 * Pha gradient vào ảnh equirect RGBA float tại chỗ. HDRLoader cho hàng 0 = đỉnh (flipY = false),
 * khác DataTexture của vendor (hàng 0 = đáy).
 */
export function mixGradient(data: Float32Array, width: number, height: number, weight = HDRI_GRADIENT_WEIGHT): void {
  for (let y = 0; y < height; y++) {
    const g = gradientAt(1 - ((y + 0.5) / height) * 2);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = data[i + c] * (1 - weight) + g[c] * weight;
    }
  }
}
