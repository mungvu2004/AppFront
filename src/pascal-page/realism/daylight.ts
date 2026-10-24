/**
 * Gói 2B — nắng Ban ngày/Nắng chiều + mặt đất. Vendor gọi qua `@pascal-realism/daylight`
 * (luật `scripts/realism/r9-daylight.mjs`); phần thuần ở `./lighting` để vitest chạy.
 *
 * - `syncCeilingShadows`: trần Pascal không `castShadow` → nắng xuyên trần phủ kín sàn, không có
 *   vệt nắng qua cửa sổ. Bật đổ bóng cho trần khi camera ở dưới trần (`ceilingCastsShadow`).
 *   Trần được node-batch gộp vào `BatchedMesh` (nguồn ẩn khỏi mọi camera, kể cả camera bóng) →
 *   phải bật trên lô chứa vật liệu trần, bật trên mesh nguồn không có tác dụng.
 * - `isGlassLike`: kính của mô hình đồ (cửa kính, khung ảnh, chao đèn) không đổ bóng đặc chặn nắng.
 * - `groundAlbedo`: tấm site + đĩa chân trời của chủ đề sáng dùng ảnh Cỏ R5 (lặp theo mét) thay
 *   màu be phẳng; đĩa chân trời vẫn tan vào phông như cũ (fade của vendor).
 */
import { type Material, type Mesh, type Object3D, RepeatWrapping, SRGBColorSpace, type Texture, TextureLoader } from 'three';
import { color, mix, positionWorld, texture, vec3 } from 'three/tsl';

import { ceilingCastsShadow } from './lighting';
import { type GroundMode, useRealism } from './store';

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
    const mesh = registry.nodes.get(id) as Mesh | undefined;
    if (!mesh) continue;
    // matrixWorld của khung trước — đủ, trần chỉ đổi khi sửa.
    const cast = ceilingCastsShadow({ appearance, tier, cameraY, ceilingY: mesh.matrixWorld.elements[13]! });
    mesh.castShadow = cast;
    setBatchShadow(mesh, cast);
  }
}

/** Lô `BatchedMesh` cùng vật liệu nằm dưới gốc tầng (tổ tiên gần của trần) — tìm vài cấp. */
function setBatchShadow(mesh: Mesh, cast: boolean): void {
  let parent = mesh.parent;
  for (let depth = 0; parent && depth < 3; depth++, parent = parent.parent) {
    for (const child of parent.children) {
      if ((child as Mesh & { isBatchedMesh?: boolean }).isBatchedMesh && (child as Mesh).material === mesh.material) {
        child.castShadow = cast;
      }
    }
  }
}

/** Vendor chỉ coi tên đúng "glass" là kính; GLB thật đặt `m_glass_door`, `*_glass`, `Vetro`… */
export function isGlassLike(material: Material): boolean {
  const m = material as Material & { transmission?: number };
  return (m.transmission ?? 0) > 0 || /glass|vetro/i.test(material.name);
}

/** Ảnh nền của R5 (`scripts/realism/r5-materials.mjs`, `sizeM` 2.5). */
const groundUrl = (id: 'ground-grass' | 'ground-gravel') => `/pascal/material/extra/${id}/${id}_basecolor_512.webp`;
export const GROUND_TILE_M = 2.5;
/** Nền trơn: xám sáng hơi lạnh thay màu đất be của chủ đề (be dưới nắng ấm đọc ra "mặt phẳng nâu vô tận"). */
export const PLAIN_GROUND = '#d6d9db';
export const PLAIN_GROUND_MIX = 1;

const textures = new Map<string, Texture>();
function groundTexture(url: string): Texture {
  let t = textures.get(url);
  if (!t) {
    t = new TextureLoader().load(url);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    textures.set(url, t);
  }
  return t;
}

/** Ảnh `leafy_grass` lẫn nhiều lá khô (trung bình nâu ~(151,131,89)) → kéo về xanh bãi cỏ theo độ sáng. */
export const GRASS_GREEN = '#7da35a';
export const GRASS_GAIN = 3.5;
export const GRASS_GREEN_MIX = 0.65;

/** Đổi mặt đất → site renderer dựng lại vật liệu. */
export const useGroundMode = (): GroundMode => useRealism((s) => s.ground);

/**
 * Màu nền cho vật liệu đất site. Chủ đề tối hoặc cờ materials tắt: màu phẳng `base` như vendor.
 * Chủ đề sáng: theo lựa chọn mặt đất của dự án.
 */
export function groundAlbedo(base: string, appearance: string, mode: GroundMode = 'plain') {
  if (appearance === 'dark' || !useRealism.getState().flags.materials) return color(base);
  if (mode === 'plain') return mix(color(base), color(PLAIN_GROUND), PLAIN_GROUND_MIX);
  const uv = positionWorld.xz.div(GROUND_TILE_M);
  if (mode === 'gravel') return texture(groundTexture(groundUrl('ground-gravel')), uv).rgb;
  const tex = texture(groundTexture(groundUrl('ground-grass')), uv).rgb;
  const lawn = tex.dot(vec3(0.2126, 0.7152, 0.0722)).mul(color(GRASS_GREEN)).mul(GRASS_GAIN);
  return mix(tex, lawn, GRASS_GREEN_MIX);
}
