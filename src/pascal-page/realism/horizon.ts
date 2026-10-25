/**
 * Chân trời: mặt đất tan dần vào phông trời. Vendor gọi qua `@pascal-realism/horizon`
 * (luật `scripts/realism/r9h-horizon.mjs`) trong `site/renderer.tsx`.
 *
 * Đĩa chân trời của vendor tan theo bán kính khu đất (1,05R → 5R). Khu đất của AppFront chỉ rộng
 * hơn nhà 2,5 m nên 5R ≈ 60 m: nhìn ngang mắt, quá 60 m là một dải phông phẳng rồi cắt sang trời.
 * - `horizonFade`: thêm sương mù tuyến tính theo khoảng cách camera, CHỈ cho đĩa (không chạm
 *   tấm site, không chạm nhà) và chỉ ngoài khu đất → đất xa hoà dần vào màu phông/trời.
 * - `farGround`: sỏi/cỏ ở xa pha về màu trung bình của ảnh → giảm tương phản,
 *   không lộ lặp ô 2,5 m.
 * Mức Thấp: trả nguyên nút cũ (không thêm phép tính, không thêm lần lấy mẫu ảnh).
 */
import { Color } from 'three';
import type { Node } from 'three/webgpu';
import { cameraPosition, color, float, max, mix, positionWorld, smoothstep, vec3 } from 'three/tsl';

import { REALISM_PALETTE } from '@/lib/pascal/scenePalette';
import { GRASS_GAIN, GRASS_GREEN, GRASS_GREEN_MIX } from './daylight';
import { type GroundMode, useRealism } from './store';

/** Sương mù đất: bắt đầu / đủ đặc (m, tính từ camera). */
export const HORIZON_FOG_START_M = 30;
export const HORIZON_FOG_END_M = 220;
/** Sương mù chỉ ngoài khu đất: 0 ở mép (R), đủ ở 1,6R. */
export const HORIZON_FOG_EDGE = [1, 1.6] as const;
/** Đất xa giảm tương phản: bắt đầu / hết hẳn (m từ camera). */
export const FAR_GROUND_START_M = 12;
export const FAR_GROUND_END_M = 60;
/** Phần pha tối đa về màu trung bình (giữ chút vân ở xa). */
export const FAR_GROUND_MIX = 0.7;

const isLow = (): boolean => useRealism.getState().tier === 'low';

/** Đổi mức → vật liệu đất dựng lại. */
export const useHorizonTier = () => useRealism((s) => s.tier === 'low');

const camDist = () => positionWorld.sub(cameraPosition).length();

/**
 * Hệ số tan của đĩa chân trời: max(fade của vendor, sương mù camera × mặt nạ ngoài khu đất).
 * `dist` = khoảng cách tới tâm khu đất (nút của vendor), `radius` = bán kính khu đất.
 */
export function horizonFade(fade: Node<'float'>, dist: Node<'float'>, radius: number): Node<'float'> {
  if (isLow()) return fade;
  const fog = smoothstep(float(HORIZON_FOG_START_M), float(HORIZON_FOG_END_M), camDist());
  const outside = smoothstep(float(radius * HORIZON_FOG_EDGE[0]), float(radius * HORIZON_FOG_EDGE[1]), dist);
  return max(fade, fog.mul(outside));
}

/** Màu trung bình (sRGB, hộp 1×1) của ảnh nền R5 — đo một lần từ `*_basecolor_512.webp`. */
export const GROUND_AVERAGE = { gravel: REALISM_PALETTE.gravelAverage, grass: REALISM_PALETTE.grassAverage } as const;

/**
 * Sỏi/cỏ ở xa pha về màu trung bình của ảnh (cỏ qua cùng phép kéo xanh của `groundAlbedo`) →
 * giảm tương phản, không lộ lặp ô. Nền trơn / chủ đề tối / mức Thấp: giữ nguyên.
 */
export function farGround(albedo: Node<'vec3'>, appearance: string, mode: GroundMode): Node<'vec3'> {
  if (isLow() || mode === 'plain' || appearance === 'dark' || !useRealism.getState().flags.materials) return albedo;
  const base = color(GROUND_AVERAGE[mode]);
  // Màu trung bình là hằng số → độ sáng tính sẵn trên CPU (cùng hệ số với `groundAlbedo`).
  const c = new Color(GROUND_AVERAGE[mode]);
  const luma = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const average = mode === 'grass' ? mix(base, color(GRASS_GREEN).mul(luma * GRASS_GAIN), GRASS_GREEN_MIX) : base;
  const k = smoothstep(float(FAR_GROUND_START_M), float(FAR_GROUND_END_M), camDist()).mul(FAR_GROUND_MIX);
  return mix(albedo, average, k);
}
