/**
 * Plugin vite cho thư viện vật liệu của Pascal: 14 vật liệu gỗ/gạch dùng `.webp` tự dựng
 * (FE3D-FIX-002 U04).
 *
 * Repo Pascal không commit `.ktx2` của các vật liệu này, nên tham chiếu `library:` tới
 * chúng là 404 im lặng và mặt ra không vân. `copy-pascal-assets.mjs` dựng `…_512.webp`
 * từ ảnh nguồn bằng sharp; viewer tải URL không đuôi `.ktx2` bằng `THREE.TextureLoader`,
 * nên chỉ cần viết lại đường dẫn map của đúng các id trong `WEBP_MATERIAL_IDS` trong
 * `core/src/material-library.ts`. Vật liệu khác giữ nguyên từng byte.
 *
 * Báo đỏ thay vì im lặng: id không còn trong tệp, id không có map `_512.ktx2`, hoặc cả
 * lượt dựng không gặp module này (upstream đổi tên) → ném lỗi, lượt dựng hỏng.
 */
import { WEBP_MATERIAL_IDS, webpPathOf } from './pascal-material-webp.mjs';

const LIBRARY_ID = /\/core\/src\/material-library\.ts$/;
const KTX2_MAP = /'(\/material\/[^']+_512\.ktx2)'/g;

/** Viết lại map `_512.ktx2` → `_512.webp` của các id trong `WEBP_MATERIAL_IDS`; phần còn lại giữ nguyên. */
export function rewriteMaterialLibrary(code) {
  let out = code;
  for (const id of WEBP_MATERIAL_IDS) {
    const start = out.indexOf(`id: '${id}',`);
    if (start < 0) throw new Error(`pascal-material-local: không thấy vật liệu "${id}" trong material-library.ts — upstream đã đổi, cập nhật scripts/pascal-material-webp.mjs`);
    // Khối của một vật liệu kéo tới `id:` kế tiếp (hoặc hết tệp).
    const next = out.indexOf("id: '", start + 1);
    const end = next < 0 ? out.length : next;
    const block = out.slice(start, end);
    const rewritten = block.replace(KTX2_MAP, (_, p) => `'${webpPathOf(p)}'`);
    if (rewritten === block) throw new Error(`pascal-material-local: vật liệu "${id}" không có map _512.ktx2 — upstream đã đổi, cập nhật scripts/pascal-material-webp.mjs`);
    out = out.slice(0, start) + rewritten + out.slice(end);
  }
  return out;
}

export function pascalMaterialLocal() {
  let transformed = false;
  return {
    name: 'pascal-material-local',
    enforce: 'pre',
    transform(source, id) {
      if (!LIBRARY_ID.test(id.split('?')[0].replaceAll('\\', '/'))) return null;
      transformed = true;
      return { code: rewriteMaterialLibrary(source), map: null };
    },
    buildEnd(error) {
      if (error) return;
      if (!transformed) throw new Error('pascal-material-local: lượt dựng không gặp core/src/material-library.ts — upstream đã đổi tên, cập nhật scripts/pascal-material-local.mjs');
    },
  };
}
