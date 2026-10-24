/**
 * R4 (GĐ4) ánh sáng: HDRI tự host thay trời gradient cho chủ đề SÁNG (Ban ngày, Nắng chiều).
 * Phần thuần (quyết định tải, pha gradient) ở đây để vitest chạy; phần nạp ở `./lighting-hdri`.
 */
import { DAY_THEME_ID } from '../renderLook';

/** Chép từ `vendor/pascal/assets/hdri/venice_sunset_1k.hdr` bởi `scripts/copy-pascal-assets.mjs`. */
export const HDRI_URL = '/pascal/hdri/venice-sunset-v1-1k.hdr';
/** Gói 2B: trời trưa có mây cho Ban ngày (`assets/hdri/`, Poly Haven CC0). Nắng chiều giữ Venice. */
export const DAY_HDRI_URL = '/pascal/hdri/kloofendal-puresky-v1-1k.hdr';
/** HDRI theo chủ đề: Ban ngày (`DAY_THEME_ID`) → trời trưa, chủ đề sáng khác → Venice. */
export const hdriUrlFor = (themeId: string): string => (themeId === DAY_THEME_ID ? DAY_HDRI_URL : HDRI_URL);
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
/**
 * Hệ số thêm sau khi chuẩn hoá (`hdriAutoScale`): 1 = môi trường HDRI sáng TRUNG BÌNH bằng trời
 * gradient của master. F4 (Q1-01): hằng 0.4 cũ làm Ban ngày tối hơn master ~29 %.
 */
export const HDRI_SCALE = 1;

/**
 * Gói 2B: trần chỉ đổ bóng nắng khi camera ở DƯỚI trần (góc trong nhà) — nhìn từ trên xuống trần
 * vốn vô hình (BackSide), đổ bóng thì cả nhà tối. Chủ đề tối và mức Thấp giữ như cũ.
 */
export function ceilingCastsShadow(o: { appearance: string; tier: string; cameraY: number; ceilingY: number }): boolean {
  return o.appearance !== 'dark' && o.tier !== 'low' && o.cameraY < o.ceilingY;
}

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Hệ số đưa độ sáng trung bình (theo diện tích cầu, cos vĩ độ) của HDRI về bằng trời gradient
 * vendor → ánh sáng môi trường giữ mức master, HDRI chỉ đổi hướng/màu/phản chiếu.
 * Venice hoàng hôn nguyên sáng hơn gradient nhiều (Nắng chiều cháy trắng); hằng cố định thì lệch.
 */
export function hdriAutoScale(data: Float32Array, width: number, height: number): number {
  let h = 0;
  let g = 0;
  for (let y = 0; y < height; y++) {
    const lat = 1 - ((y + 0.5) / height) * 2;
    const area = Math.cos((lat * Math.PI) / 2);
    const gc = gradientAt(lat);
    let row = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row += luma(data[i]!, data[i + 1]!, data[i + 2]!);
    }
    h += (row / width) * area;
    g += luma(gc[0], gc[1], gc[2]) * area;
  }
  return h > 0 ? g / h : 1;
}

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
  return [0, 1, 2].map((c) => HORIZON[c]! + (ZENITH[c]! - HORIZON[c]!) * t) as [number, number, number];
}

/**
 * Pha gradient vào ảnh equirect RGBA float tại chỗ. HDRLoader cho hàng 0 = đỉnh (flipY = false),
 * khác DataTexture của vendor (hàng 0 = đáy).
 */
export function mixGradient(data: Float32Array, width: number, height: number, weight = HDRI_GRADIENT_WEIGHT, scale = 1): void {
  for (let y = 0; y < height; y++) {
    const g = gradientAt(1 - ((y + 0.5) / height) * 2);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = data[i + c]! * scale * (1 - weight) + g[c]! * weight;
    }
  }
}
