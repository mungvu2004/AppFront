/**
 * Vá hành vi nhỏ lúc dựng (FE3D-FIX-004 U2), đi chung đường thay-chuỗi-có-neo của `pascal-vi.mjs`:
 * chuỗi gốc mất thì lượt dựng hỏng, như bảng dịch.
 *
 * L11: bấm lại biểu tượng rail đang mở làm thu gọn cả thanh bên. Giữ bảng mở; thu gọn vẫn có ở nút
 * thu gọn riêng của thanh bên.
 *
 * UX-R3 U37: người chỉ xem (`useScene.readOnly`, do trang bật qua acquireSceneReadOnlyLease) không thấy nút
 * thêm/chèn tầng, tay kéo đổi thứ tự và không đổi tên tầng bằng nháy đúp. Core đã chặn ghi; đây chỉ ẩn nút.
 */
const LEVELS = 'editor/src/components/ui/floating-level-selector.tsx';

export const BEHAVIOUR_PATCHES = {
  [LEVELS]: [
    // LevelRow: đọc cờ chỉ xem (neo là dòng ngay sau updateNode của LevelRow, không trùng LevelInlineRename).
    [
      '  const updateNode = useScene((s) => s.updateNode)\n  const { isImperial,',
      '  const updateNode = useScene((s) => s.updateNode)\n  const readOnly = useScene((s) => s.readOnly)\n  const { isImperial,',
    ],
    ["              isDragging && 'cursor-grabbing opacity-100',\n", "              isDragging && 'cursor-grabbing opacity-100',\n              readOnly && 'hidden',\n"],
    [
      '              e.stopPropagation()\n              setIsEditing(true)\n',
      '              e.stopPropagation()\n              if (!readOnly) setIsEditing(true)\n',
    ],
    // SortableLevelRow: tắt kéo-thả khi chỉ xem.
    [
      '  onRequestDelete: () => void\n}) {\n  const {\n    attributes,',
      '  onRequestDelete: () => void\n}) {\n  const readOnly = useScene((s) => s.readOnly)\n  const {\n    attributes,',
    ],
    ['  } = useSortable({ id: level.id })', '  } = useSortable({ id: level.id, disabled: readOnly })'],
    // FloatingLevelSelector: ẩn nút + trên/dưới và nút chèn giữa hai tầng.
    [
      '  const updateNodes = useScene((s) => s.updateNodes)\n',
      '  const updateNodes = useScene((s) => s.updateNodes)\n  const readOnly = useScene((s) => s.readOnly)\n',
    ],
    ['          {!draggingLevelId && (\n', '          {!draggingLevelId && !readOnly && (\n'],
    ['{showGapBelow && !draggingLevelId && (', '{showGapBelow && !draggingLevelId && !readOnly && ('],
  ],
  // U37: mục Tầng trong bảng cài đặt — ẩn hàng nút "Thêm tầng / Thêm tầng hầm" khi chỉ xem.
  'editor/src/components/ui/sidebar/panels/settings-panel/index.tsx': [
    [
      '  const createNode = useScene((state) => state.createNode)\n',
      '  const createNode = useScene((state) => state.createNode)\n  const readOnly = useScene((state) => state.readOnly)\n',
    ],
    ['      <div className="grid grid-cols-2 gap-2">\n', "      <div className={readOnly ? 'hidden' : 'grid grid-cols-2 gap-2'}>\n"],
  ],
  'editor/src/components/editor/editor-layout-v2.tsx': [
    [
      '      if (id === activePanel) {\n        setIsCollapsed(true)\n        return\n      }\n',
      '      if (id === activePanel) return\n',
    ],
  ],
};
