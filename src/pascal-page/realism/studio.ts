/**
 * Trình bày "studio" (dáng ảnh sản phẩm, đối chiếu Blender `apt3.py` build_floors + `build.py`):
 * mặt đất không nhận màu đèn (xám trung tính sáng, chỉ hứng bóng) và một đế vát cạnh dưới
 * chân nhà. Phần thuần (màu, kích thước, đường bao đế) ở đây; phần three/TSL ở `horizon.ts`,
 * luật vendor ở `scripts/realism/r10-studio.mjs`.
 */
import { SCENE_PALETTE } from '@/lib/pascal/scenePalette';

import { SUNSET_THEME_ID } from '../renderLook';

/** Màu studio (sRGB). Đất không qua đèn nên giữ đúng xám trung tính trên ảnh. */
export const STUDIO_PALETTE = {
  ground: SCENE_PALETTE.studioGround,
  shadow: SCENE_PALETTE.studioShadow,
  plinth: SCENE_PALETTE.studioPlinth,
} as const;

/** Nắng chiều: đất studio theo nền ấm của chủ đề `sunset`, không giữ xám như Ban ngày/Buổi tối. */
export const studioGroundColor = (themeId: string): string => (themeId === SUNSET_THEME_ID ? SCENE_PALETTE.studioGroundSunset : STUDIO_PALETTE.ground);

/** Đế: cao (m), vát cạnh (m), nhô ra ngoài mép sàn tầng thấp nhất (m, chưa tính vát). */
export const PLINTH_HEIGHT_M = 0.5;
export const PLINTH_BEVEL_M = 0.06;
export const PLINTH_OUTSET_M = 0.12;
/** Số đoạn của mép vát. */
export const PLINTH_BEVEL_SEGMENTS = 2;
/** Đỉnh đế thấp hơn cao độ 0 một chút: sàn vendor nằm ở 0, trùng mặt là chập hình (z-fighting). */
export const PLINTH_TOP_Y = -0.02;
/** Mặt đất studio hạ xuống chân đế. */
export const STUDIO_GROUND_Y = PLINTH_TOP_Y - PLINTH_HEIGHT_M;
/** Tấm hứng bóng nhấc khỏi đĩa đất một chút để không z-fight. */
export const STUDIO_SHADOW_LIFT_M = 0.002;
/** Độ đậm bóng trên đất studio (0 = không bóng, 1 = đen hẳn). */
export const STUDIO_SHADOW_OPACITY = 0.35;
/** Góc nhọn: đỉnh lệch tối đa = MITER_LIMIT × khoảng nhô. */
export const MITER_LIMIT = 2;

const EPS = 1e-9;

type Pt = [number, number];

interface SceneNodeLike {
  type?: string;
  parentId?: string | null;
  level?: number;
  visible?: boolean;
  polygon?: ReadonlyArray<readonly [number, number]>;
}

/** Đa giác sàn (x, z) của tầng thấp nhất — đường bao nhà để dựng đế. Không có tầng: mọi sàn. */
export function lowestLevelSlabs(nodes: Readonly<Record<string, SceneNodeLike>>): Pt[][] {
  const list = Object.values(nodes);
  let lowest = Number.POSITIVE_INFINITY;
  for (const n of list) if (n.type === 'level' && typeof n.level === 'number') lowest = Math.min(lowest, n.level);
  const lowestIds = new Set(
    Object.entries(nodes)
      .filter(([, n]) => n.type === 'level' && n.level === lowest)
      .map(([id]) => id),
  );
  return list
    .filter(
      (n) =>
        n.type === 'slab' &&
        n.visible !== false &&
        (n.polygon?.length ?? 0) >= 3 &&
        (lowestIds.size === 0 || lowestIds.has(n.parentId ?? '')),
    )
    .map((n) => (n.polygon ?? []).map(([x, z]): Pt => [x, z]));
}

/** Diện tích có dấu (công thức dây giày). */
function signedArea(ring: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * Nới đa giác ra ngoài `d` mét (góc vuông giữ góc vuông, góc nhọn giới hạn theo MITER_LIMIT).
 * Chiều vòng nào cũng được; điểm trùng liền nhau bị bỏ.
 */
export function outsetRing(ring: readonly Pt[], d: number): Pt[] {
  const pts = ring.filter((p, i) => {
    const q = ring[(i + ring.length - 1) % ring.length]!;
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > EPS;
  });
  if (pts.length < 3 || d === 0) return pts.map((p): Pt => [p[0], p[1]]);
  const s = Math.sign(signedArea(pts)) || 1;
  const normal = (a: Pt, b: Pt): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    return [(s * dy) / len, (-s * dx) / len];
  };
  return pts.map((p, i) => {
    const n1 = normal(pts[(i + pts.length - 1) % pts.length]!, p);
    const n2 = normal(p, pts[(i + 1) % pts.length]!);
    let mx = n1[0] + n2[0];
    let my = n1[1] + n2[1];
    const ml = Math.hypot(mx, my);
    if (ml < EPS) [mx, my] = n1;
    else [mx, my] = [mx / ml, my / ml];
    const k = d / Math.max(mx * n1[0] + my * n1[1], 1 / MITER_LIMIT);
    return [p[0] + mx * k, p[1] + my * k];
  });
}
