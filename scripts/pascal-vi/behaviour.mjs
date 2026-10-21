/**
 * Vá hành vi nhỏ lúc dựng (FE3D-FIX-004 U2), đi chung đường thay-chuỗi-có-neo của `pascal-vi.mjs`:
 * chuỗi gốc mất thì lượt dựng hỏng, như bảng dịch.
 *
 * L11: bấm lại biểu tượng rail đang mở làm thu gọn cả thanh bên. Giữ bảng mở; thu gọn vẫn có ở nút
 * thu gọn riêng của thanh bên.
 */
export const BEHAVIOUR_PATCHES = {
  'editor/src/components/editor/editor-layout-v2.tsx': [
    [
      '      if (id === activePanel) {\n        setIsCollapsed(true)\n        return\n      }\n',
      '      if (id === activePanel) return\n',
    ],
  ],
};
