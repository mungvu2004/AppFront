/**
 * Vá hành vi nhỏ lúc dựng (FE3D-FIX-004 U2), đi chung đường thay-chuỗi-có-neo của `pascal-vi.mjs`:
 * chuỗi gốc mất thì lượt dựng hỏng, như bảng dịch.
 *
 * L11: bấm lại biểu tượng rail đang mở làm thu gọn cả thanh bên. Giữ bảng mở; thu gọn vẫn có ở nút
 * thu gọn riêng của thanh bên.
 *
 * UX-R3 U37: người chỉ xem (`useScene.readOnly`, do trang bật qua acquireSceneReadOnlyLease) không thấy nút
 * thêm/chèn tầng, tay kéo đổi thứ tự và không đổi tên tầng bằng nháy đúp. Core đã chặn ghi; đây chỉ ẩn nút.
 *
 * editor-hig A: Page Up/Page Down đổi tầng như Cmd/Ctrl+↑/↓ (cùng nhánh, cùng preventDefault; ô nhập
 * đã bị bỏ qua từ đầu bộ xử lý). Neo dòng phím tắt là chữ ĐÃ DỊCH: mergeTables chạy EDITOR_EXTRA_VI trước bảng này.
 * Nút nổi trên vật đang chọn không co dưới 0,8 (0,5 còn ~10 px khi thu nhỏ).
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
    // Không thanh trên (kiểu Figma): cụm trái của thanh trên canvas (về dự án, bước, thu gọn — main.tsx) thành
    // đầu bảng trái; bảng thu gọn thì nổi cạnh rail (vị trí ở pascal-chrome.css: Tailwind không quét scripts/, lớp
    // chỉ có ở đây như left-full/ml-3 không được sinh — đầu bảng từng rơi về x=0, đè rail). Cụm phải giữ chỗ cũ, giờ là bảng Xem (viewer-toolbar.tsx).
    [
      '  sidebarOverlay,\n}: {\n  tabs: SidebarTab[]\n  renderTabContent: (tabId: string) => ReactNode\n  sidebarOverlay?: ReactNode\n}) {',
      '  sidebarOverlay,\n  header,\n}: {\n  tabs: SidebarTab[]\n  renderTabContent: (tabId: string) => ReactNode\n  sidebarOverlay?: ReactNode\n  header?: ReactNode\n}) {',
    ],
    [
      '        tabs={tabs}\n      />\n      {!isCollapsed',
      '        tabs={tabs}\n      />\n      {isCollapsed && header && (\n        <div className="absolute top-3 flex flex-col items-start gap-2" data-appfront-panel-head="floating">{header}</div>\n      )}\n      {!isCollapsed',
    ],
    [
      '          <div className="relative flex flex-1 flex-col overflow-hidden">\n            {renderTabContent(activePanel)}',
      '          {header && (\n            <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--pa-border)] p-3" data-appfront-panel-head="docked">{header}</div>\n          )}\n          <div className="relative flex flex-1 flex-col overflow-hidden">\n            {renderTabContent(activePanel)}',
    ],
    ['            tabs={sidebarTabs}\n          />', '            tabs={sidebarTabs}\n            header={viewerToolbarLeft}\n          />'],
    ['          toolbarLeft={isCaptureMode ? undefined : viewerToolbarLeft}\n', ''],
  ],
  'editor/src/hooks/use-keyboard.ts': [
    [
      "} else if (e.key === 'ArrowUp' && (e.metaKey || e.ctrlKey)) {",
      "} else if (e.key === 'PageUp' || (e.key === 'ArrowUp' && (e.metaKey || e.ctrlKey))) {",
    ],
    [
      "} else if (e.key === 'ArrowDown' && (e.metaKey || e.ctrlKey)) {",
      "} else if (e.key === 'PageDown' || (e.key === 'ArrowDown' && (e.metaKey || e.ctrlKey))) {",
    ],
  ],
  'editor/src/components/ui/sidebar/panels/settings-panel/keyboard-shortcuts-dialog.tsx': [
    [
      "      { keys: ['Cmd/Ctrl', 'B'], action: 'Ẩn/hiện thanh bên' },\n",
      "      { keys: ['Page Up'], action: 'Chọn tầng trên của toà nhà đang mở' },\n      { keys: ['Page Down'], action: 'Chọn tầng dưới của toà nhà đang mở' },\n      { keys: ['Cmd/Ctrl', 'B'], action: 'Ẩn/hiện thanh bên' },\n",
    ],
  ],
  'editor/src/lib/floating-menu-scale.ts': [['const MIN_MENU_SCALE = 0.5\n', 'const MIN_MENU_SCALE = 0.8\n']],
};
