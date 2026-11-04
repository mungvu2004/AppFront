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
import { Color, ExtrudeGeometry, Shape } from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, type Node, ShadowNodeMaterial } from 'three/webgpu';
import { cameraPosition, color, float, max, mix, positionWorld, smoothstep, uniform } from 'three/tsl';

import { REALISM_PALETTE } from '@/lib/pascal/scenePalette';
import { GRASS_GAIN, GRASS_GREEN, GRASS_GREEN_MIX } from './daylight';
import { type GroundMode, useRealism } from './store';
import {
  applyStudioGround,
  outsetRing,
  PLINTH_BEVEL_M,
  PLINTH_BEVEL_SEGMENTS,
  PLINTH_HEIGHT_M,
  PLINTH_OUTSET_M,
  PLINTH_TOP_Y,
  STUDIO_PALETTE,
  STUDIO_SHADOW_OPACITY,
} from './studio';

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

/**
 * Studio (luật `r10-studio.mjs`): bật khi mặt đất = nền trơn và cờ materials bật; sỏi/cỏ giữ
 * đĩa chân trời cũ. Đất studio không qua đèn (không ngả nâu dưới đèn ấm), bóng nhà vẽ bằng một
 * tấm hứng bóng trong suốt đè lên, nhà đứng trên đế vát cạnh.
 */
export const useStudioGround = () => useRealism((s) => s.ground === 'plain' && s.flags.materials);

/** Màu đĩa đất là uniform: đổi chủ đề không dựng lại shader. */
const studioGround = uniform(new Color(STUDIO_PALETTE.ground));
/** Gọi mỗi khung từ `syncRoomLights` (`Lights`). */
export function syncStudioGround(themeId: string): void {
  applyStudioGround(studioGround.value, themeId);
}

/** Đĩa đất studio: không chiếu sáng, màu theo chủ đề (`applyStudioGround`), xa thì tan vào phông như đĩa của vendor. */
export function studioDisc(fade: Node<'float'>, backdrop: Node<'vec3'>): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  material.colorNode = mix(studioGround, backdrop, fade);
  material.polygonOffset = true;
  material.polygonOffsetFactor = 2;
  material.polygonOffsetUnits = 2;
  return material;
}

/** Tấm hứng bóng: chỉ vẽ phần bị che nắng (giống ShadowMaterial của Blender/three). */
export function studioShadowCatcher(): ShadowNodeMaterial {
  const material = new ShadowNodeMaterial({ color: STUDIO_PALETTE.shadow, opacity: STUDIO_SHADOW_OPACITY });
  material.depthWrite = false;
  return material;
}

export function studioPlinthMaterial(): MeshStandardNodeMaterial {
  return new MeshStandardNodeMaterial({ color: STUDIO_PALETTE.plinth, roughness: 0.9, metalness: 0 });
}

/**
 * Đế vát cạnh dưới đường bao (x, z) của sàn tầng thấp nhất (đã hợp). Đỉnh đế ở y = PLINTH_TOP_Y,
 * chân ở y = −PLINTH_HEIGHT_M; mép vát nhô thêm PLINTH_BEVEL_M ngoài PLINTH_OUTSET_M.
 */
export function studioPlinthGeometry(rings: ReadonlyArray<ReadonlyArray<[number, number]>>): ExtrudeGeometry | null {
  const shapes: Shape[] = [];
  for (const ring of rings) {
    const pts = outsetRing(ring, PLINTH_OUTSET_M);
    if (pts.length < 3) continue;
    // Cùng quy ước với `addSlabHoles` của vendor: shape (x, −z), xoay −90° quanh X.
    const shape = new Shape();
    shape.moveTo(pts[0]![0], -pts[0]![1]);
    for (const [x, z] of pts.slice(1)) shape.lineTo(x, -z);
    shape.closePath();
    shapes.push(shape);
  }
  if (shapes.length === 0) return null;
  const depth = PLINTH_HEIGHT_M - 2 * PLINTH_BEVEL_M;
  const geometry = new ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: true,
    bevelThickness: PLINTH_BEVEL_M,
    bevelSize: PLINTH_BEVEL_M,
    bevelSegments: PLINTH_BEVEL_SEGMENTS,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, PLINTH_TOP_Y - (depth + PLINTH_BEVEL_M), 0);
  return geometry;
}
