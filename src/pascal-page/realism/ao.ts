/**
 * S5 (render-look B): AO rẻ khi SSGI tắt (mức `low`, iGPU) + trọng số AO "chỉ làm tối ánh sáng gián tiếp".
 * Vendor đọc qua `@pascal-realism/ao` (luật `scripts/realism/r10-ao.mjs`, `post-processing.tsx`).
 *
 * - Ai có AO gì: `aoModeFor` — SSGI bật → AO của SSGI; SSGI tắt mà vẫn có hậu kỳ (WebGPU, `rendered`) →
 *   GTAO nửa độ phân giải, ít mẫu (ngân sách ≤2 ms; SSGI đầy đủ tốn 382 ms p50 trên iGPU). WebGL2 không dựng
 *   chuỗi hậu kỳ (`isWebGpuBackend`) → không AO. `?disable=ao` / `?disable=gtao` tắt GTAO để so A/B.
 * - Trọng số: chỉ có ảnh đã chiếu sáng + albedo (MRT `diffuseColor`), không tách trực tiếp/gián tiếp. Ước độ rọi
 *   E = độ sáng(ảnh) / độ sáng(albedo): chỗ nắng chiếu E cao → AO mờ dần về 1; góc/chân đồ chỉ có ambient → AO đủ.
 */
import { float, luminance, max, mix, smoothstep } from 'three/tsl';
import type { Node } from 'three/webgpu';

export type AoMode = 'ssgi' | 'gtao' | 'none';

/** Nửa độ phân giải: GTAO chỉ cần tần số thấp (góc tường, chân đồ), lấy mẫu song tuyến khi ghép. */
export const GTAO_RESOLUTION_SCALE = 0.5;
/** GTAONode: < 30 mẫu → 3 hướng × ceil(mẫu/3) bước; 6 = 3 × 2, rẻ nhất còn ra bóng góc. */
export const GTAO_SAMPLES = 6;
/** Bán kính (m): đủ ôm góc tường-trần và khe chân sofa/giường, không loang ra giữa sàn. */
export const GTAO_RADIUS_M = 0.5;
/** Độ dày (m) coi là che: nhỏ hơn mặc định 1 để mép bàn mỏng không đổ quầng lên tường phía sau. */
export const GTAO_THICKNESS_M = 0.5;
/** Mũ đậm (ao^k) — cùng vai trò `TRAA_AO_POW` của nhánh SSGI. */
export const GTAO_POW = 1.4;

/** Albedo tối hơn mức này coi như bằng nó (tránh chia cho ~0 ở đồ đen). */
export const AO_ALBEDO_FLOOR = 0.04;
/**
 * Ngưỡng độ rọi E (tuyến tính, trước tone map): dưới `LO` = chỉ ambient/hemi → AO đủ; trên `HI` = nắng/đèn trực
 * tiếp → không AO. ponytail: ước lượng theo tỉ lệ ảnh/albedo, specular cũng bị tính là "sáng"; chỉnh theo mắt trên
 * cảnh thật nếu góc trong nắng còn tối hoặc góc khuất bị nhạt.
 */
export const AO_DIRECT_LO = 0.6;
export const AO_DIRECT_HI = 1.2;

export interface AoInput {
  /** `isWebGpuBackend(renderer)` — WebGL2 không có chuỗi hậu kỳ. */
  webGpu: boolean;
  /** `tierConfig(tier).postFx` và không bị host tắt. */
  postFx: boolean;
  shading: string;
  /** SSGI có thực sự dựng trong pipeline này không. */
  ssgiEnabled: boolean;
  /** `location.search` (cờ `?disable=`). */
  search: string;
}

export function aoModeFor(input: AoInput): AoMode {
  if (!input.webGpu || !input.postFx || input.shading !== 'rendered') return 'none';
  if (input.ssgiEnabled) return 'ssgi';
  const disable = (new URLSearchParams(input.search).get('disable') ?? '').split(',');
  return disable.includes('ao') || disable.includes('gtao') ? 'none' : 'gtao';
}

/** Cờ vendor dùng lúc dựng pipeline (đã qua kiểm WebGPU + postFx ở trên đó). */
export function gtaoOn(shading: string, ssgiEnabled: boolean): boolean {
  const search = typeof location === 'undefined' ? '' : location.search;
  return aoModeFor({ webGpu: true, postFx: true, shading, ssgiEnabled, search }) === 'gtao';
}

const smooth = (lo: number, hi: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/** Bản số thuần của `aoIndirect` (cho test): hệ số nhân màu tại một điểm. */
export function aoFactor(ao: number, litLum: number, albedoLum: number): number {
  const direct = smooth(AO_DIRECT_LO, AO_DIRECT_HI, litLum / Math.max(albedoLum, AO_ALBEDO_FLOOR));
  return ao + (1 - ao) * direct;
}

/** Nút TSL: AO đã giảm ở chỗ nắng/đèn trực tiếp. `lit`, `albedo` là vec3 tuyến tính. */
export function aoIndirect(ao: Node<'float'>, lit: Node<'vec3'>, albedo: Node<'vec3'>) {
  const irradiance = luminance(lit).div(max(luminance(albedo), float(AO_ALBEDO_FLOOR)));
  return mix(ao, float(1), smoothstep(float(AO_DIRECT_LO), float(AO_DIRECT_HI), irradiance));
}
