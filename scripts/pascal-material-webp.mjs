// Vật liệu thư viện Pascal được thay ktx2 (thiếu trong upstream) bằng webp 512 sinh từ ảnh gốc
// trong vendor/pascal/assets/material/** (FE3D-FIX-002 J2; FE3D-FIX-004 V12: rút từ bản kê thay vì
// gõ tay 14 id — 35 vật liệu như terrazzo bị bỏ sót và 404).
// Dùng chung bởi copy-pascal-assets.mjs (sinh webp + ảnh xem trước) và pascal-material-local.mjs.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'pascal', 'assets');
export const LIBRARY_FILE = resolve(ASSETS, '..', 'packages', 'core', 'src', 'material-library.ts');

/** `[{ id, maps, thumb }]` của mọi vật liệu trong `material-library.ts` (maps = đường `.ktx2` trước `mapProperties`). */
export function parseLibrary(code) {
  return code
    .replaceAll('\r\n', '\n')
    .split(/\n {4}id: '/)
    .slice(1)
    .map((block) => {
      const cut = block.indexOf('mapProperties');
      const body = cut < 0 ? block : block.slice(0, cut);
      return {
        id: block.slice(0, block.indexOf("'")),
        maps: [...body.matchAll(/'(\/material\/[^']+\.ktx2)'/g)].map((m) => m[1]),
        thumb: /previewThumbnailUrl: '([^']+)'/.exec(block)?.[1],
      };
    });
}

export const LIBRARY_MATERIALS = Object.freeze(parseLibrary(readFileSync(LIBRARY_FILE, 'utf8')));

export function webpPathOf(ktx2Path) {
  if (!/_512\.ktx2$/.test(ktx2Path)) throw new Error(`webpPathOf: không phải đường dẫn _512.ktx2: ${ktx2Path}`);
  return ktx2Path.replace(/\.ktx2$/, '.webp');
}

// Vai trò lấy từ hậu tố tên ktx2 (…_<role>_512.ktx2); ảnh gốc đặt tên không đều nên so bằng regex.
const ROLE_SOURCE = {
  basecolor: /basecolor|diffuse|albedo|color/i,
  normal: /normal/i,
  roughness: /roughness/i,
  ao: /ambientocclusion|(^|[-_ ])ao([-_. ]|$)/i,
  metallic: /metallic|metalness/i,
};

export const roleOf = (ktx2Path) => /_([a-z]+)_512\.ktx2$/.exec(ktx2Path)?.[1];

export function sourceFor(ktx2Path) {
  const role = roleOf(ktx2Path);
  const re = ROLE_SOURCE[role];
  if (!re) throw new Error(`sourceFor: không rõ vai trò map "${role}" trong ${ktx2Path}`);
  const dir = join(ASSETS, dirname(ktx2Path));
  let files;
  try {
    files = readdirSync(dir);
  } catch {
    throw new Error(`sourceFor: thiếu thư mục ảnh gốc ${dir} (cho ${ktx2Path})`);
  }
  const hits = files.filter((f) => /\.(webp|jpe?g|png)$/i.test(f) && !/thumb/i.test(f) && re.test(f));
  if (hits.length !== 1) {
    throw new Error(`sourceFor: cần đúng 1 ảnh "${role}" trong ${dir} cho ${ktx2Path}, thấy ${hits.length}: ${hits.join(', ')}`);
  }
  return join(dir, hits[0]);
}

const hasSource = (map) => {
  try {
    sourceFor(map);
    return true;
  } catch {
    return false;
  }
};

/** id thiếu ít nhất một `.ktx2` trong repo mà mọi map đều có ảnh gốc → dựng webp cho cả bộ map. */
export const WEBP_MATERIAL_IDS = Object.freeze(
  LIBRARY_MATERIALS.filter(
    ({ maps }) =>
      maps.length > 0 &&
      maps.some((map) => !existsSync(join(ASSETS, map))) &&
      maps.every((map) => /_512\.ktx2$/.test(map) && hasSource(map)),
  ).map(({ id }) => id),
);
