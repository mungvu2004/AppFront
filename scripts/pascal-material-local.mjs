/**
 * Plugin vite cho thư viện vật liệu của Pascal (`core/src/material-library.ts`), vá lúc dựng:
 *
 * 1. Vật liệu thiếu `.ktx2` dùng `.webp` tự dựng (FE3D-FIX-002 U04; FE3D-FIX-004 V12 — danh sách
 *    rút từ bản kê, xem `pascal-material-webp.mjs`). `copy-pascal-assets.mjs` dựng `…_512.webp`
 *    từ ảnh nguồn bằng sharp; viewer tải URL không đuôi `.ktx2` bằng `THREE.TextureLoader`.
 * 2. Ảnh xem trước của bảng chọn (L8): `previewThumbnailUrl` được `<img>` dùng thẳng, không qua
 *    `resolveCdnUrl`, nên `'/material/…'` thiếu tiền tố `/pascal` của tài sản tự host → 404.
 * 3. Độ lặp vân vải/da (L7): Bouclé 3.3 làm vòng len to như nắm tay trên ghế; vân dệt cần đọc
 *    ở cỡ 1–2 cm, nên tăng `repeatX/Y` theo `FABRIC_REPEAT`.
 *
 * Báo đỏ thay vì im lặng: id không còn trong tệp, id không có thứ cần vá, hoặc cả lượt dựng
 * không gặp module này (upstream đổi tên) → ném lỗi, lượt dựng hỏng.
 */
import { WEBP_MATERIAL_IDS, webpPathOf } from './pascal-material-webp.mjs';

const LIBRARY_ID = /\/core\/src\/material-library\.ts$/;
const KTX2_MAP = /'(\/material\/[^']+_512\.ktx2)'/g;
const THUMB_FROM = "previewThumbnailUrl: '/material/";
const THUMB_TO = "previewThumbnailUrl: '/pascal/material/";

/** Số lần lặp vân trên một đơn vị UV (gốc: Bouclé 3.3, len/nhung 2.5, còn lại ~2). */
export const FABRIC_REPEAT = Object.freeze({
  'fabric-boucle': 9,
  'fabric-wool': 6,
  'fabric-linen': 6,
  'fabric-cotton': 6,
  'fabric-velvet': 4,
  'fabric-suede': 4,
  'leather-black': 4,
  'leather-calf': 4,
});

/** Áp `edit` lên khối của vật liệu `id` (tới `id:` kế tiếp); khối không đổi thì ném lỗi về `what`. */
function editBlock(code, id, what, edit) {
  const start = code.indexOf(`id: '${id}',`);
  if (start < 0) throw new Error(`pascal-material-local: không thấy vật liệu "${id}" trong material-library.ts — upstream đã đổi, cập nhật scripts/pascal-material-local.mjs`);
  const next = code.indexOf("id: '", start + 1);
  const end = next < 0 ? code.length : next;
  const block = code.slice(start, end);
  const rewritten = edit(block);
  if (rewritten === block) throw new Error(`pascal-material-local: vật liệu "${id}" không có ${what} — upstream đã đổi, cập nhật scripts/pascal-material-local.mjs`);
  return code.slice(0, start) + rewritten + code.slice(end);
}

/** Vá map webp, tiền tố ảnh xem trước và độ lặp vân vải; phần còn lại giữ nguyên. */
export function rewriteMaterialLibrary(code) {
  let out = code;
  for (const id of WEBP_MATERIAL_IDS) {
    out = editBlock(out, id, 'map _512.ktx2', (block) => block.replace(KTX2_MAP, (_, p) => `'${webpPathOf(p)}'`));
  }
  for (const [id, repeat] of Object.entries(FABRIC_REPEAT)) {
    out = editBlock(out, id, 'repeatX/repeatY', (block) =>
      block.replace(/(repeat[XY]): [\d.]+,/g, (_, key) => `${key}: ${String(repeat)},`),
    );
  }
  if (!out.includes(THUMB_FROM)) throw new Error(`pascal-material-local: không thấy ${THUMB_FROM} — upstream đã đổi, cập nhật scripts/pascal-material-local.mjs`);
  return out.replaceAll(THUMB_FROM, THUMB_TO);
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
