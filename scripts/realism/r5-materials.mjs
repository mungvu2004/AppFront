/**
 * R5 (GĐ5) — vật liệu mới cho thư viện Pascal, chèn lúc dựng vào `MATERIAL_CATALOG`
 * (`core/src/material-library.ts`), không sửa `vendor/pascal`.
 *
 * Ảnh nguồn: Poly Haven (CC0), 1k jpg trong `vendor-extra/materials/<id>/` (giấy phép ở
 * `vendor-extra/materials/LICENSE.md`). `copy-pascal-assets.mjs` dựng webp 512 + ảnh xem trước
 * 128 vào `public/pascal/material/extra/<id>/`.
 *
 * `repeatX/Y` = 1 / cạnh thật của ảnh (m), vì UV của tường/sàn Pascal tính theo mét.
 * Cạnh thật lấy theo `size_m` đã chỉnh mắt ở cảnh cinema (homepage-v6 `build_scene.py`).
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EXTRA_SOURCE = join(ROOT, 'vendor-extra', 'materials');

export const R5_MATERIALS = Object.freeze([
  { id: 'plaster-white', label: 'Thạch cao trắng', category: 'concrete', surfaces: ['wall', 'ceiling'], description: 'Trát thạch cao trắng mịn', sizeM: 2.5, roughness: 0.9, polyhaven: 'white_plaster_02' },
  { id: 'stone-stacked', label: 'Đá ốp chồng lớp', category: 'stone', surfaces: ['wall', 'outdoor'], description: 'Đá chẻ xếp chồng ốp tường', sizeM: 1.6, roughness: 0.85, polyhaven: 'stacked_stone_wall' },
  { id: 'ground-gravel', label: 'Sỏi', category: 'ground', surfaces: ['floor', 'outdoor'], description: 'Nền sỏi rải', sizeM: 2.5, roughness: 0.95, polyhaven: 'gravel_floor_02' },
  { id: 'ground-soil', label: 'Đất', category: 'ground', surfaces: ['floor', 'outdoor'], description: 'Đất trồng xới', sizeM: 1.5, roughness: 1, polyhaven: 'farm_soil' },
  { id: 'ground-grass', label: 'Cỏ', category: 'ground', surfaces: ['floor', 'outdoor'], description: 'Thảm cỏ lá', sizeM: 2.5, roughness: 0.95, polyhaven: 'leafy_grass' },
]);

/** Vai trò ảnh → khoá map trong `preset.maps` của Pascal. */
export const ROLES = Object.freeze({ basecolor: 'albedoMap', normal: 'normalMap', roughness: 'roughnessMap', ao: 'aoMap' });

const dirOf = (id) => `/material/extra/${id}`;
/** Đường map lúc chạy (viewer ghép tiền tố `/pascal`; đuôi `.webp` → TextureLoader). */
export const mapPath = (id, role) => `${dirOf(id)}/${id}_${role}_512.webp`;
/** `<img>` dùng thẳng, không qua resolveCdnUrl → ghi sẵn `/pascal` (pascal-material-local chỉ đổi `'/material/`). */
export const thumbPath = (id) => `/pascal${dirOf(id)}/${id}_thumb.webp`;
export const sourceOf = (id, role) => join(EXTRA_SOURCE, id, `${id}_${role}_1k.jpg`);

const round = (n) => Math.round(n * 1000) / 1000;

export function entryCode(m) {
  const repeat = round(1 / m.sizeM);
  const maps = Object.entries(ROLES).map(([role, key]) => `        ${key}: '${mapPath(m.id, role)}',`).join('\n');
  return `  {
    id: '${m.id}',
    label: '${m.label}',
    category: '${m.category}',
    surfaces: ${JSON.stringify(m.surfaces).replaceAll('"', "'").replaceAll(',', ', ')},
    description: '${m.description}',
    previewThumbnailUrl: '${thumbPath(m.id)}',
    preset: {
      maps: {
${maps}
      },
      mapProperties: {
        color: '#ffffff',
        roughness: ${m.roughness},
        metalness: 0,
        repeatX: ${repeat},
        repeatY: ${repeat},
        rotation: 0,
        wrapS: 'Repeat',
        wrapT: 'Repeat',
        normalScaleX: 1,
        normalScaleY: 1,
        emissiveIntensity: 1,
        displacementScale: 0,
        transparent: false,
        flipY: false,
        bumpScale: 1,
        emissiveColor: '#000000',
        aoMapIntensity: 1,
        side: 0,
        opacity: 1,
        lightMapIntensity: 1,
      },
    },
  },
`;
}

/** Neo: cuối mảng `MATERIAL_CATALOG`, ngay trước khi tập id tĩnh được dựng. */
export const ANCHOR = '\n]\n\nconst STATIC_CATALOG_IDS = new Set(MATERIAL_CATALOG.map((item) => item.id))';

const ENTRIES = R5_MATERIALS.map(entryCode).join('').replace(/\n$/, '');

/**
 * Luật cho `scripts/pascal-realism.mjs` (thẻ R1): `[gốc, mới, sốLần]`. `sốLần = 0` khẳng định id mới
 * CHƯA có trong upstream (upstream thêm trùng id → lượt dựng đỏ); sau đó chèn khối mục ở neo cuối mảng.
 */
export const RULES = {
  'core/src/material-library.ts': [
    ...R5_MATERIALS.map(({ id }) => [`id: '${id}',`, `id: '${id}',`, 0]),
    [ANCHOR, `\n${ENTRIES}${ANCHOR}`, 1],
  ],
};

/** Áp `RULES` như plugin (đúng sốLần, giữ CRLF) — để test không phụ thuộc plugin. */
export function applyR5(source) {
  const crlf = source.includes('\r\n');
  const fix = (s) => (crlf ? s.replaceAll('\n', '\r\n') : s);
  let out = source;
  for (const [rawFrom, rawTo, times] of RULES['core/src/material-library.ts']) {
    const from = fix(rawFrom);
    const count = out.split(from).length - 1;
    if (count !== times) throw new Error(`r5-materials: ${JSON.stringify(rawFrom.slice(0, 40))} gặp ${count} lần (cần ${times}) — ${times === 0 ? 'id đã có' : 'neo mất'}`);
    out = out.split(from).join(fix(rawTo));
  }
  return out;
}
