/**
 * Thẻ M1 (bước 2): vật liệu đồ nội thất theo loại, thay lúc chạy.
 * Bọc `resolveItemMaterial` của item renderer bằng `tuneItemMaterial`
 * (src/pascal-page/realism/itemMaterials.ts, alias @pascal-realism). Bản gốc đổi tên
 * thành `resolveItemMaterialBase`; `materialOptions` mang thêm `src` để biết thư mục mẫu.
 * Cờ `flags.materials` tắt / textures=false → vật liệu y cũ.
 */
const IMPORT = "import { tuneItemMaterial } from '@pascal-realism/itemMaterials'\n";

const WRAPPER = `const resolveItemMaterial = (
  authoredMaterial: Material,
  slotId: string | null,
  curatedRef: string | undefined,
  opts: Parameters<typeof resolveItemMaterialBase>[3] & { src?: string },
): Material =>
  tuneItemMaterial(resolveItemMaterialBase(authoredMaterial, slotId, curatedRef, opts), {
    src: opts.src,
    slotId,
    ref: slotId != null ? (opts.nodeSlots?.[slotId] ?? curatedRef) : undefined,
    textures: opts.textures,
    donor: (ref: string) => resolveMaterialRef(ref, opts.sceneMaterials, opts.shading),
  })

const resolveItemMaterialBase = (`;

// Neo chỉ dùng "\n" ở đầu (vendor có thể CRLF).
export const RULES = {
  'nodes/src/item/renderer.tsx': [
    ["\nimport { BlockFaceHostFrame } from '../shared/block-face-host'", '\n' + IMPORT + "import { BlockFaceHostFrame } from '../shared/block-face-host'", 1],
    ['\nconst resolveItemMaterial = (', '\n' + WRAPPER, 1],
    ['\n    const materialOptions = {', '\n    const materialOptions = {\n      src: node.asset.src,', 1],
  ],
};
