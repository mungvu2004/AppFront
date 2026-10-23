/**
 * Gói 2B — nắng Ban ngày/Nắng chiều + mặt đất. Vendor gọi qua `@pascal-realism/daylight`
 * (luật `scripts/realism/r9-daylight.mjs`); phần thuần ở `./lighting` để vitest chạy.
 *
 * - `syncCeilingShadows`: trần Pascal không `castShadow` → nắng xuyên trần phủ kín sàn, không có
 *   vệt nắng qua cửa sổ. Bật đổ bóng cho trần khi camera ở dưới trần (`ceilingCastsShadow`).
 * - `groundAlbedo`: tấm site + đĩa chân trời của chủ đề sáng dùng ảnh Cỏ R5 (lặp theo mét) thay
 *   màu be phẳng; đĩa chân trời vẫn tan vào phông như cũ (fade của vendor).
 */
import { type Object3D, RepeatWrapping, SRGBColorSpace, type Texture, TextureLoader } from 'three';
import { color, mix, positionWorld, texture, vec3 } from 'three/tsl';

import { ceilingCastsShadow } from './lighting';
import { useRealism } from './store';

interface RegistryLike {
  nodes: Map<string, Object3D>;
  byType: Record<string, Set<string> | undefined>;
}

/** Gọi mỗi khung từ `Lights` (vendor), trước lượt vẽ bóng. Vài trần mỗi tầng → rẻ. */
export function syncCeilingShadows(registry: RegistryLike, cameraY: number, appearance: string): void {
  const ids = registry.byType.ceiling;
  if (!ids) return;
  const { tier } = useRealism.getState();
  for (const id of ids) {
    const mesh = registry.nodes.get(id);
    if (!mesh) continue;
    // matrixWorld của khung trước — đủ, trần chỉ đổi khi sửa.
    mesh.castShadow = ceilingCastsShadow({ appearance, tier, cameraY, ceilingY: mesh.matrixWorld.elements[13]! });
  }
}

/** Ảnh Cỏ của R5 (`scripts/realism/r5-materials.mjs` `ground-grass`, `sizeM` 2.5). */
export const GROUND_TEXTURE_URL = '/pascal/material/extra/ground-grass/ground-grass_basecolor_512.webp';
export const GROUND_TILE_M = 2.5;

let grass: Texture | null = null;
function grassTexture(): Texture {
  if (!grass) {
    grass = new TextureLoader().load(GROUND_TEXTURE_URL);
    grass.wrapS = RepeatWrapping;
    grass.wrapT = RepeatWrapping;
    grass.colorSpace = SRGBColorSpace;
    grass.anisotropy = 8;
  }
  return grass;
}

/** Ảnh `leafy_grass` lẫn nhiều lá khô (trung bình nâu ~(151,131,89)) → kéo về xanh bãi cỏ theo độ sáng. */
export const GRASS_GREEN = '#7da35a';
export const GRASS_GAIN = 3.5;
export const GRASS_GREEN_MIX = 0.65;

/** Màu nền cho vật liệu đất site: chủ đề tối giữ màu phẳng `base`, chủ đề sáng dùng cỏ. */
export function groundAlbedo(base: string, appearance: string) {
  if (appearance === 'dark') return color(base);
  const tex = texture(grassTexture(), positionWorld.xz.div(GROUND_TILE_M)).rgb;
  const lawn = tex.dot(vec3(0.2126, 0.7152, 0.0722)).mul(color(GRASS_GREEN)).mul(GRASS_GAIN);
  return mix(tex, lawn, GRASS_GREEN_MIX);
}
