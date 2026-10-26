/**
 * Bước 2 (thẻ M1): chỉnh vật liệu đồ nội thất theo loại, lúc chạy.
 * Gọi từ vendor `nodes/src/item/renderer.tsx` (luật scripts/realism/r7-item-materials.mjs)
 * bọc kết quả `resolveItemMaterial`. Không đổi node/JSON: chỉ clone vật liệu
 * (cache theo uuid gốc + loại), giữ màu, đổi roughness/metalness, thêm map vải/da.
 * Mẫu không có trong bảng (mẫu lạ/người dùng tải lên) vẫn qua luật chung `autoPatch` + anisotropy.
 * Cờ `flags.materials` tắt, textures=false (clay), kính thư viện → trả nguyên vật liệu.
 */
import { Color, LinearSRGBColorSpace, SRGBColorSpace } from 'three';
import type { Material, Texture } from 'three';
import { AUTO, autoPatch, folderOf, itemKindOf, KIND_LOOK, nameKind, tunedRoughness } from './itemLook';
import { useRealism } from './store';

type TunableMaterial = Material & {
  color?: Color;
  roughness?: number;
  metalness?: number;
  normalMap?: Texture | null;
  roughnessMap?: Texture | null;
  specularIntensity?: number;
} & Partial<Record<MapKey, Texture | null>>;

/** Ảnh của vật liệu gốc mà bản clone phải theo (vật liệu thư viện gán map bất đồng bộ). */
const SOURCE_MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'] as const;
type MapKey = (typeof SOURCE_MAPS)[number];

export interface TuneContext {
  src?: string | null;
  slotId: string | null;
  ref?: string | null;
  textures: boolean;
  /** Phân giải ref thư viện (vendor `resolveMaterialRef`). */
  donor?: (ref: string) => Material | null;
}

const cache = new Map<string, Material>();

function copyDonorMaps(target: TunableMaterial, donor: TunableMaterial): boolean {
  let changed = false;
  if (!target.normalMap && donor.normalMap) {
    target.normalMap = donor.normalMap;
    changed = true;
  }
  if (!target.roughnessMap && donor.roughnessMap) {
    target.roughnessMap = donor.roughnessMap;
    changed = true;
  }
  if (changed) {
    sharpen(target);
    target.needsUpdate = true;
  }
  return Boolean(donor.normalMap && donor.roughnessMap);
}

/** Chép ảnh gốc còn thiếu sang bản clone; trả true khi gốc đã có `map` (nạp xong). */
function copySourceMaps(target: TunableMaterial, source: TunableMaterial): boolean {
  let changed = false;
  for (const key of SOURCE_MAPS) {
    if (!target[key] && source[key]) {
      target[key] = source[key];
      changed = true;
    }
  }
  if (changed) {
    sharpen(target);
    target.needsUpdate = true;
  }
  return Boolean(source.map);
}

/** Ảnh không anisotropy → mờ ở góc xiên (sàn/mặt bàn nhìn chếch). Texture dùng chung → sửa một lần. */
function sharpen(m: TunableMaterial): void {
  for (const key of SOURCE_MAPS) {
    const t = m[key];
    if (!t || t.anisotropy >= AUTO.anisotropy) continue;
    t.anisotropy = AUTO.anisotropy;
    if (t.version > 0) t.needsUpdate = true;
  }
}

/** Nhịp thử lại: 40 lần × 250 ms ≈ 10 s (thời gian chờ, không phải chuyển động). */
const RETRY_EVERY_MS = 250;

/** Map của vật liệu thư viện gán bất đồng bộ → thử lại vài giây (tối đa 10 s). */
function retry(step: () => boolean): void {
  if (step()) return;
  let tries = 0;
  const id = setInterval(() => {
    if (step() || ++tries > 40) clearInterval(id);
  }, RETRY_EVERY_MS);
}

export function tuneItemMaterial(mat: Material, ctx: TuneContext): Material {
  if (!ctx.textures || !useRealism.getState().flags.materials) return mat;
  const m = mat as TunableMaterial;
  if (typeof m.roughness !== 'number') return mat;
  sharpen(m);
  // Bảng ITEM_KIND (ngoại lệ) trước, rồi đoán theo tên vật liệu; còn lại chỉ luật chung `autoPatch`.
  const tableKind = itemKindOf(folderOf(ctx.src), ctx.slotId, ctx.ref);
  const kind = tableKind ?? nameKind(m.name, Boolean(m.map));
  // Kính thư viện vendor giữ nguyên; riêng gương: khe `glass` là kính thư viện trong suốt → nhìn xuyên ra tấm đáy đen.
  if (kind !== 'mirror' && m.name.toLowerCase() === 'glass') return mat;
  // Kính trong suốt: không đổi loại, chỉ kẹp kim loại (kính PBR metal 1 ra gương đen).
  const look = kind && (kind === 'mirror' || !m.transparent) ? KIND_LOOK[kind] : null;
  const patch = autoPatch({
    metalness: m.metalness ?? 0,
    roughness: m.roughness,
    metalnessMap: Boolean(m.metalnessMap),
    roughnessMap: Boolean(m.roughnessMap),
    transparent: m.transparent,
  });
  if (!look && patch.metalness == null && patch.roughness == null) return mat;

  const key = `${mat.uuid}|${look ? kind : 'auto'}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const next = mat.clone() as TunableMaterial;
  // Clone lúc gốc chưa nạp ảnh thì mất ảnh mãi (đồ gỗ ra trắng) → theo gốc tới khi có map.
  retry(() => copySourceMaps(next, m));
  next.name = `${mat.name}|${look ? kind : 'auto'}`;
  // Loại không tự đặt kim loại/nhám → luật chung.
  if (patch.metalness != null && look?.metalness == null) next.metalness = patch.metalness;
  if (!look) {
    if (patch.roughness != null) next.roughness = patch.roughness;
    next.needsUpdate = true;
    cache.set(key, next);
    return next;
  }
  next.roughness = tunedRoughness(kind!, m.roughness);
  if (look.metalness != null) next.metalness = look.metalness;
  if (kind === 'mirror') {
    next.transparent = false;
    next.opacity = 1;
    next.depthWrite = true;
  }
  // clone() đã chép màu sang Color riêng; nhân thẳng (tuyến tính, không qua setRGB/sRGB).
  if (look.tint && next.color) {
    next.color.r *= look.tint[0];
    next.color.g *= look.tint[1];
    next.color.b *= look.tint[2];
  }
  // Color.set nhận hex sRGB, tự đổi sang tuyến tính. Khe có ref thư viện giữ màu người chọn.
  if (look.color && next.color && !ctx.ref) next.color.set(look.color);
  // KHR_materials_specular của mẫu gốc làm trắng bóng: đưa về mặc định.
  if (typeof next.specularIntensity === 'number') next.specularIntensity = Math.min(next.specularIntensity, 0.5);
  // Loại đoán theo tên không lấy normal donor: UV lạ → vải lấm tấm (giường review2).
  if (tableKind && look.donor && ctx.donor && (!next.normalMap || !next.roughnessMap)) {
    const donor = ctx.donor(look.donor) as TunableMaterial | null;
    if (donor) retry(() => copyDonorMaps(next, donor));
  }
  next.needsUpdate = true;
  cache.set(key, next);
  return next;
}

/**
 * three bỏ `KHR_materials_pbrSpecularGlossiness` (r147): GLTFLoader coi là metal/rough mặc định
 * (metalness 1, roughness 1) → đồ trắng như kim loại. Plugin đổi lúc nạp: khuếch tán → màu/ảnh màu,
 * bóng → nhám = 1 − gloss, kim loại 0. Ảnh specularGlossiness (gloss ở kênh A, ngược nhám) bỏ qua.
 */
const SPEC_GLOSS = 'KHR_materials_pbrSpecularGlossiness';

interface GltfParserLike {
  json: { materials?: { extensions?: Record<string, unknown> }[] };
  assignTexture(params: Record<string, unknown>, key: string, def: unknown, colorSpace?: string): Promise<unknown>;
}

interface SpecGlossDef {
  diffuseFactor?: [number, number, number, number];
  diffuseTexture?: unknown;
  glossinessFactor?: number;
  specularGlossinessTexture?: unknown;
}

export function specGlossPlugin(parser: GltfParserLike) {
  return {
    name: SPEC_GLOSS,
    extendMaterialParams(index: number, params: Record<string, unknown>): Promise<unknown> {
      const ext = parser.json.materials?.[index]?.extensions?.[SPEC_GLOSS] as SpecGlossDef | undefined;
      if (!ext) return Promise.resolve();
      const gloss = ext.glossinessFactor ?? 1;
      params.metalness = 0;
      // Có ảnh gloss: hệ số thường để 1 → nhám 0 bóng gương; lấy giữa.
      params.roughness = ext.specularGlossinessTexture ? Math.max(0.5, 1 - gloss) : 1 - gloss;
      const pending: Promise<unknown>[] = [];
      if (ext.diffuseFactor) {
        const [r, g, b, a] = ext.diffuseFactor;
        params.color = new Color().setRGB(r, g, b, LinearSRGBColorSpace);
        params.opacity = a;
      }
      if (ext.diffuseTexture) pending.push(parser.assignTexture(params, 'map', ext.diffuseTexture, SRGBColorSpace));
      return Promise.all(pending);
    },
  };
}

/** Gọi từ vendor `configureItemModelLoader` (luật r7). Cùng tham chiếu hàm → GLTFLoader.register không đăng ký trùng. */
export function registerItemLoaderPlugins(loader: { register(cb: typeof specGlossPlugin): unknown }): void {
  loader.register(specGlossPlugin);
}

/** Cho test. */
export function clearItemMaterialCache(): void {
  cache.clear();
}
