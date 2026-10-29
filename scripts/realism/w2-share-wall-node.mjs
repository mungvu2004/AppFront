/**
 * W2 (share-wall-node): lớp chấm mờ của tường ẩn tạo nút `opacityNode` mới cho MỖI vật liệu. Khoá shader
 * của three băm theo từng nút, nên F1 dựng TSL 6 lần ra cùng một mã, đúng lúc gần xong nạp (~9,5 s). Nút chỉ
 * có hằng số và mẫu chấm theo toạ độ, không có uniform riêng của vật liệu (màu đi qua `color`/`emissive`),
 * nên dùng chung một nút thì hình y nguyên.
 */
export const RULES = {
  'viewer/src/systems/wall/wall-materials.ts': [
    [
      'function createInvisibleWallMaterial(color: string, shading: RenderShading): Material {\n',
      'let invisibleWallOpacity: ReturnType<typeof mix> | null = null\n\n' +
        'function createInvisibleWallMaterial(color: string, shading: RenderShading): Material {\n',
    ],
    [
      '  material.opacityNode = mix(float(0.0), float(0.24), dotPattern())\n',
      '  material.opacityNode = invisibleWallOpacity ??= mix(float(0.0), float(0.24), dotPattern())\n',
    ],
  ],
};
