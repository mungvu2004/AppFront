/**
 * Bảng dịch + vá đợt impeccable-fix D2: cây Cảnh (site-panel), Cài đặt, tab Đồ vật,
 * thanh nổi khi chọn đối tượng, ẩn Blender / tab Tiện ích. Cùng định dạng với `editor.mjs`.
 * Chuỗi gốc phải khớp từng byte (CRLF tự xử lý trong `applyTable`); `pascal-vi.mjs` nối các bảng.
 */
const UI = 'editor/src/components/ui/';
const SITE = `${UI}sidebar/panels/site-panel/index.tsx`;
const SETTINGS = `${UI}sidebar/panels/settings-panel/index.tsx`;

const DELETE_LEVEL_ON_CLICK = 'onClick={() => deleteLevelWithFallbackSelection(level.id)}';
const CONFIRM_LEVEL =
  "onClick={() => { if (window.confirm('Xoá tầng này cùng mọi thứ trên tầng? Bạn có thể hoàn tác bằng Ctrl+Z.')) deleteLevelWithFallbackSelection(level.id) }}";

/** Thông báo "Đã xoá <tên> · Hoàn tác" (DOM thuần: vendor không có thư viện toast). */
const UNDO_TOAST = `function showDeletedToast(name: string) {
  if (typeof document === 'undefined') return
  document.getElementById('pascal-deleted-toast')?.remove()
  const el = document.createElement('div')
  el.id = 'pascal-deleted-toast'
  el.setAttribute('role', 'status')
  el.style.cssText =
    'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:9999;display:flex;gap:12px;align-items:center;padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--card-foreground);font-size:13px;line-height:20px;box-shadow:0 6px 24px rgba(0,0,0,.18)'
  const text = document.createElement('span')
  text.textContent = 'Đã xoá ' + name
  const undo = document.createElement('button')
  undo.type = 'button'
  undo.textContent = 'Hoàn tác'
  undo.style.cssText = 'font-weight:600;text-decoration:underline;cursor:pointer;background:none;border:0;color:inherit;padding:4px 2px'
  const timer = window.setTimeout(() => el.remove(), 6000)
  undo.onclick = () => {
    window.clearTimeout(timer)
    runUndo()
    el.remove()
  }
  el.append(text, undo)
  document.body.appendChild(el)
}
const DELETE_ONLY_TYPES: string[] = []`;

export const EDITOR_EXTRA3_VI = {
  [SITE]: [
    ['>Property Line<', '>Ranh đất<'],
    ['\n            Add point\n', '\n            Thêm điểm\n'],
    ['title="Camera snapshot"', 'title="Góc nhìn đã lưu"'],
    ['View snapshot', 'Xem góc nhìn'],
    ['Update snapshot', 'Cập nhật góc nhìn'],
    ['Take snapshot', 'Lưu góc nhìn'],
    ['Clear snapshot', 'Xoá góc nhìn'],
    ['alt="Capture"', 'alt="Bản quét"'],
    ['alt="Guide"', 'alt="Ảnh dẫn"'],
    ["'Capture' : 'Guide Image'", "'Bản quét' : 'Ảnh dẫn'"],
    ["title={isVisible ? 'Hide' : 'Show'}", "title={isVisible ? 'Ẩn' : 'Hiện'}"],
    ['title="Delete"', 'title="Xoá"'],
    ["`Uploading ${uploadingType}... ${progress}%` : 'Upload scan/floorplan'", "`Đang tải ${uploadingType}… ${progress}%` : 'Tải ảnh bản vẽ'"],
    ['title="Duplicate level"', 'title="Nhân bản tầng"'],
    ['title="Duplicate level with options"', 'title="Nhân bản tầng có tuỳ chọn"'],
    ['\n              Duplicate\n', '\n              Nhân bản\n'],
    ['Duplicate with options...', 'Nhân bản có tuỳ chọn…'],
    ["'Delete level' : 'The ground level cannot be deleted'", "'Xoá tầng' : 'Không thể xoá tầng trệt'"],
    ['\n              Delete\n', '\n              Xoá\n'],
    [DELETE_LEVEL_ON_CLICK, CONFIRM_LEVEL],
    ['label="Base elevation"', 'label="Cao độ nền"'],
    ['<span className="truncate">Add level</span>', '<span className="truncate">Thêm tầng</span>'],
    ['No levels yet', 'Chưa có tầng nào'],
    ['title="New unit"', 'title="Thêm đơn vị"'],
    ['label="New unit"', 'label="Thêm đơn vị"'],
    ['\n            Units\n', '\n            Đơn vị\n'],
    ['alt="Structure"', 'alt="Kết cấu"'],
    ['\n          Structure\n', '\n          Kết cấu\n'],
    ['alt="Furnish"', 'alt="Nội thất"'],
    ['\n          Furnish\n', '\n          Nội thất\n'],
    ['alt="Zones"', 'alt="Khu vực"'],
    ['\n          Zones\n', '\n          Khu vực\n'],
    ["focusedUnit.name || 'Unit'", "focusedUnit.name || 'Đơn vị'"],
    ['title="Clear selection"', 'title="Bỏ chọn"'],
    ['Select a level to view content', 'Chọn một tầng để xem nội dung'],
    ['No zones on this level.', 'Tầng này chưa có khu vực.'],
    ['\n            Add one\n', '\n            Thêm khu vực\n'],
    ['No elements on this level', 'Tầng này chưa có gì'],
    ['alt="Level"', 'alt="Tầng"'],
    ['alt="Building"', 'alt="Toà nhà"'],
    ["building.name || 'Building'", "building.name || 'Toà nhà'"],
    ['alt="Site"', 'alt="Khu đất"'],
    // Tên khu đất lưu chữ thường ("khu đất"): hiện viết hoa chữ đầu.
    ["{siteNode.name || 'Site'}", "{siteNode.name ? siteNode.name.charAt(0).toUpperCase() + siteNode.name.slice(1) : 'Khu đất'}"],
    ['No buildings yet', 'Chưa có toà nhà nào'],
  ],

  [SETTINGS]: [
    ['aria-label={`Remove ${getLevelDisplayName(level)}`}', 'aria-label={`Xoá ${getLevelDisplayName(level)}`}'],
    [DELETE_LEVEL_ON_CLICK, CONFIRM_LEVEL],
    ['<SettingsSubheading>3D model</SettingsSubheading>', '<SettingsSubheading>Mô hình 3D</SettingsSubheading>'],
    [
      'Choose which procedural content is baked into model files. GLB and USDZ use the\n                    textured portable path; STL and OBJ remain geometry-only.',
      'Chọn phần nội dung tạo sinh được đưa vào tệp mô hình. GLB và USDZ có kèm vật liệu;\n                    STL và OBJ chỉ có hình khối.',
    ],
    ['aria-label={`Include ${label} in model files`}', 'aria-label={`Đưa ${label} vào tệp mô hình`}'],
    ['Optional static surroundings are included only in GLB and USDZ.', 'Bối cảnh tĩnh tuỳ chọn chỉ có trong tệp GLB và USDZ.'],
    ['aria-label={`Include ${label} in GLB and USDZ`}', 'aria-label={`Đưa ${label} vào GLB và USDZ`}'],
    ['`Exporting ${label}…` : `Export ${label}`', '`Đang xuất ${label}…` : `Xuất ${label}`'],
    // Ẩn "Send to Blender" + lời nhắc tiện ích của nhà cung cấp (không lộ tên cho người dùng).
    [
      '<div className="space-y-2">\n              <Button\n                aria-busy={sendToBlenderStep !== null}',
      '<div hidden className="space-y-2">\n              <Button\n                aria-busy={sendToBlenderStep !== null}',
    ],
    ["'Default mode' : 'Expert mode'", "'Chế độ mặc định' : 'Chế độ chuyên gia'"],
    ['>Scene Graph</DialogTitle>', '>Cây cảnh</DialogTitle>'],
  ],

  [`${UI}sidebar/panels/settings-panel/print-export-button.tsx`]: [
    ['\n        Export 3D print 3MF\n', '\n        Xuất bản in 3D 3MF\n'],
    ['\n        Export 3D print STL\n', '\n        Xuất bản in 3D STL\n'],
    ["'3D print export failed.'", "'Xuất bản in 3D không thành công.'"],
  ],

  [`${UI}sidebar/panels/items-panel/index.tsx`]: [
    ['placeholder="Search..."', 'placeholder="Tìm đồ vật…"'],
    ['No results for &ldquo;', 'Không có kết quả cho &ldquo;'],
  ],
  [`${UI}sidebar/panels/items-panel/function-tree-panel.tsx`]: [
    ['placeholder="Search..."', 'placeholder="Tìm đồ vật…"'],
    ['No results for &ldquo;', 'Không có kết quả cho &ldquo;'],
  ],

  // Thumbnail đồ vật là ảnh nền đen: đảo màu + nhân với nền kem của panel (bóng đồ vật tối trên nền sáng).
  [`${UI}item-catalog/item-catalog.tsx`]: [
    [
      'className="h-full w-full object-cover"\n                loading="eager"',
      "className=\"h-full w-full object-cover\"\n                style={{ filter: 'invert(1)', mixBlendMode: 'multiply' }}\n                loading=\"eager\"",
    ],
  ],

  // Ẩn tab "Tiện ích" (chỉ có liên kết tới nhà cung cấp).
  [`${UI}sidebar/icon-rail.tsx`]: [
    ['{(pluginPanels?.length || pluginsPanel) && (', '{pluginPanels?.length && ('],
    ['{pluginsPanel && renderExtraPanel(pluginsPanel)}', '{null}'],
  ],

  // Bảng thuộc tính mở sẵn (phần Kích thước thấy ngay), không chỉ còn mỗi tên.
  [`${UI}panels/panel-wrapper.tsx`]: [['desktopInspectorCollapsed = true', 'desktopInspectorCollapsed = false']],

  // Nhãn đã dịch ở materials-ui.mjs; ở đây chỉ đổi kiểu nút Xoá: tách khỏi nhóm Di chuyển/Cắt/Nhân bản (ml-2), màu nguy hiểm.
  'editor/src/components/editor/node-action-menu.tsx': [
    [
      'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
      'ml-2 rounded-md p-1.5 text-destructive transition-colors hover:bg-destructive/10',
    ],
  ],

  // Xoá đối tượng từ thanh nổi: hiện "Đã xoá <tên> · Hoàn tác" (dùng runUndo có sẵn).
  'editor/src/components/editor/floating-action-menu.tsx': [
    ["import { emitDeleteSFX, sfxEmitter } from '../../lib/sfx-bus'", "import { runUndo } from '../../lib/history'\nimport { emitDeleteSFX, sfxEmitter } from '../../lib/sfx-bus'"],
    ['const DELETE_ONLY_TYPES: string[] = []', UNDO_TOAST],
    [
      "      setSelection({ selectedIds: [] })\n      useScene.getState().deleteNode(selectedId as AnyNodeId)\n    },\n    [node?.type, selectedId, setSelection],",
      "      const deletedName =\n        node && 'name' in node && typeof node.name === 'string' && node.name ? node.name : 'đối tượng'\n      setSelection({ selectedIds: [] })\n      useScene.getState().deleteNode(selectedId as AnyNodeId)\n      showDeletedToast(deletedName)\n    },\n    [node, selectedId, setSelection],",
    ],
  ],
  // La bàn mặt bằng: nhãn trình đọc màn hình và tooltip.
  'editor/src/components/viewer/floorplan-compass-button.tsx': [
    ['aria-label="Align view to north"', 'aria-label="Xoay về hướng Bắc"'],
    ['>Align view to north</TooltipContent>', '>Xoay về hướng Bắc</TooltipContent>'],
  ],
};
