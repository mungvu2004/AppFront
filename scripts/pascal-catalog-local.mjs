/**
 * Plugin vite cho thư viện đồ nội thất của Pascal dùng mẫu tự host LÚC DỰNG (FE3D-FIX-001 T02).
 *
 * `catalog-items.tsx` trỏ 333 URL tới kho supabase của Pascal; CSP trang 3D chặn, nên ô
 * thư viện mất ảnh và GLB không tải. Không sửa vendor (quyết định A), ta viết lại chính
 * module đó: URL → `/items/<thư mục>/…` (`copy-pascal-assets.mjs` chép
 * `vendor/pascal/assets/items`), ảnh `.png` → `.webp`, bỏ `floorPlanUrl` (chỉ có trên
 * supabase; editor vẽ hộp thay thế), và lọc `CATALOG_ITEMS` còn những mẫu có thư mục
 * trong máy (danh sách đọc bằng `readdirSync` lúc dựng).
 *
 * Báo đỏ thay vì im lặng: còn sót `supabase.co` sau khi viết lại, hoặc cả lượt dựng
 * không gặp module này (upstream đổi tên/chữ) → ném lỗi, lượt dựng hỏng.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';

const CATALOG_ID = /item-catalog\/catalog-items\.tsx$/;
const SUPABASE_URL = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/items\/(?:system|users\/[^/]+)\//g;
const DECLARATION = 'export const CATALOG_ITEMS: CatalogItem[] = [';

export function pascalCatalogLocal({ itemsDir = path.resolve('vendor/pascal/assets/items') } = {}) {
  let transformed = false;
  return {
    name: 'pascal-catalog-local',
    enforce: 'pre',
    transform(source, id) {
      if (!CATALOG_ID.test(id.split('?')[0].replaceAll('\\', '/'))) return null;
      // Bản checkout Windows có thể là CRLF; các mẫu dưới so theo `\n`.
      const code = source.replaceAll('\r\n', '\n');
      const end = code.indexOf('\n]\n', code.indexOf(DECLARATION));
      if (!code.includes(DECLARATION) || end < 0) {
        throw new Error(`pascal-catalog-local: không thấy "${DECLARATION}" trong ${id} — upstream đã đổi, cập nhật scripts/pascal-catalog-local.mjs`);
      }
      const local = readdirSync(itemsDir);
      // Mẫu lấy thư mục từ `src` đã viết lại: `/items/<thư mục>/…`.
      const filter = `\nconst LOCAL_ITEM_FOLDERS = new Set(${JSON.stringify(local)})\nexport const CATALOG_ITEMS = ALL_CATALOG_ITEMS.filter((item) => LOCAL_ITEM_FOLDERS.has(item.src.split('/')[2]))\n`;
      const out = (code.slice(0, end + 3) + filter + code.slice(end + 3))
        .replace(DECLARATION, 'const ALL_CATALOG_ITEMS: CatalogItem[] = [')
        .replace(/^\s*floorPlanUrl:\s*'[^']*',\n/gm, '')
        .replace(SUPABASE_URL, '/items/')
        .replaceAll('thumbnail.png', 'thumbnail.webp');
      if (out.includes('supabase.co')) throw new Error(`pascal-catalog-local: còn sót supabase.co trong ${id} sau khi viết lại`);
      transformed = true;
      return { code: out, map: null };
    },
    buildEnd(error) {
      if (error) return;
      if (!transformed) throw new Error('pascal-catalog-local: lượt dựng không gặp item-catalog/catalog-items.tsx — upstream đã đổi tên, cập nhật scripts/pascal-catalog-local.mjs');
    },
  };
}
