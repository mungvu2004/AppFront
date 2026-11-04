/**
 * Một bộ icon ở chỗ dễ thấy nhất (04/11): ảnh màu Pascal và icon iconify trên thanh công cụ đáy, thanh nổi đổi về lucide
 * (thư viện chính của app, không thêm gói). Thanh trái và nút 3D/2D sửa thẳng ở `src/pascal-page/upstream`.
 * Nút Chọn: màu xanh dương riêng của Pascal về `primary` (lớp khai ở `@source inline` của `pascal.css`).
 * `use-select-exits-measure` vẫn nhận ra nút Chọn nhờ `data-guide-target`.
 */
export const RULES = {
  'editor/src/components/ui/action-menu/control-modes.tsx': [
    ["import { type LucideIcon, Trash2 } from 'lucide-react'\n", "import { type LucideIcon, MousePointer2, Pentagon, Trash2 } from 'lucide-react'\n"],
    ["    imageSrc: '/icons/select.webp',\n", '    icon: MousePointer2,\n'],
    ["    imageSrc: '/icons/zone.webp',\n", '    icon: Pentagon,\n'],
    ["    color: 'hover:bg-blue-500/20 hover:text-blue-400',\n", "    color: 'hover:bg-primary/15 hover:text-primary',\n"],
    ["    activeColor: 'bg-blue-500/20 text-blue-400',\n", "    activeColor: 'bg-primary/15 text-primary',\n"],
  ],
  // Icon đầu bảng thuộc tính là ảnh màu theo loại vật (tường: tím): bỏ màu, không đổi hình.
  'editor/src/components/ui/panels/panel-wrapper.tsx': [
    ['className="shrink-0 object-contain"', 'className="shrink-0 object-contain saturate-0"'],
  ],
  'editor/src/components/editor/node-action-menu.tsx': [
    [
      "import { Copy, Group, Move, PencilRuler, Search, Spline, Trash2, Ungroup } from 'lucide-react'\n",
      "import { Copy, Group, Move, PencilRuler, Scissors, Search, Spline, Trash2, Ungroup } from 'lucide-react'\n",
    ],
    ['          <Icon height={16} icon="carbon:cut-out" width={16} />\n', '          <Scissors className="h-4 w-4" />\n'],
  ],
};
