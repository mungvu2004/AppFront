// Danh sách 14 vật liệu thư viện Pascal được thay ktx2 (thiếu trong upstream) bằng webp 512 sinh
// từ ảnh gốc trong vendor/pascal/assets/material/** (FE3D-FIX-002 J2, v2/Q1.md).
// Dùng chung bởi copy-pascal-assets.mjs (sinh webp) và pascal-material-local.mjs (đổi đường dẫn).
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'pascal', 'assets');

export const WEBP_MATERIAL_IDS = Object.freeze([
  'wood-woodplank48',
  'wood-floorplank1',
  'wood-hungarianparquet10',
  'wood-woodplank19',
  'wood-finewood27',
  'wood-hungarianparquet2',
  'wood-woodenparquet11',
  'flooring-woodparquet76',
  'flooring-tile79',
  'flooring-tiles4',
  'flooring-lightceramic24',
  'flooring-statuarettowhite',
  'flooring-tile20',
  'flooring-ceramic53',
]);

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
