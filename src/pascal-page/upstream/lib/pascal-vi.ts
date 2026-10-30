/**
 * G5-03 (registry part): Vietnamese for the strings Pascal reads from its node registry at
 * render time: tool hints (`def.toolHints`, `def.affordanceHints`, their chips) and the kind
 * name (`def.presentation.label`, shown in inspector titles, tree rows, palette).
 *
 * Done at runtime on the live definitions, so `vendor/pascal` stays byte-for-byte upstream
 * (decision A, `ui-review/fix/debate/DECISIONS.md`). Strings without an entry stay English.
 * Mouse/keyboard `key`s ('Left click', 'Esc', 'Shift'...) are NOT translated: Pascal maps them
 * to icons and matches `key === 'Shift'`; only free-text keys ('Hover gutter') are.
 */

import type { AnyNodeDefinition, ToolHint } from '@pascal-app/core'

/**
 * One name per kind across the 3D editor (RV3 #5): the build palette (`./build-palette.ts`), the
 * scene header and command palette (`scripts/pascal-vi/*.mjs`) use these same words.
 */
const KIND_VI: Record<string, string> = {
  Block: 'Khối',
  Building: 'Toà nhà',
  'Box Vent': 'Lỗ thông gió hộp',
  'Cabinet Module': 'Mô-đun tủ',
  Canopy: 'Mái hiên',
  Capture: 'Bản quét',
  Ceiling: 'Trần',
  Chimney: 'Ống khói',
  Column: 'Cột',
  'Construction Dimension': 'Kích thước thi công',
  Cupola: 'Chòi mái',
  Door: 'Cửa đi',
  Dormer: 'Cửa sổ mái',
  Downspout: 'Ống thoát nước mái',
  Duct: 'Ống gió',
  'Duct Fitting': 'Phụ kiện ống gió',
  'DWV Pipe': 'Ống thoát',
  Elevator: 'Thang máy',
  'Eyebrow Vent': 'Lỗ thông gió mái cong',
  Fence: 'Hàng rào',
  Guide: 'Ảnh tham chiếu',
  Gutter: 'Máng xối',
  'HVAC Unit': 'Máy điều hoà',
  'Imported Mesh': 'Mô hình nhập',
  Item: 'Đồ vật',
  Level: 'Tầng',
  Lineset: 'Ống đồng',
  'Liquid Line': 'Ống lỏng',
  Measurement: 'Thước đo',
  'Modular Cabinet': 'Tủ mô-đun',
  'Pipe Fitting': 'Phụ kiện ống',
  'Procedural item': 'Đồ vật tham số',
  Register: 'Miệng gió',
  'Ridge Vent': 'Thông gió nóc',
  Roof: 'Mái',
  'Roof Segment': 'Mảng mái',
  Shelf: 'Kệ',
  Site: 'Khu đất',
  Skylight: 'Cửa sổ trời',
  Slab: 'Sàn',
  'Solar Panel': 'Tấm pin mặt trời',
  'Spawn Point': 'Điểm xuất phát',
  Stair: 'Cầu thang',
  'Stair Segment': 'Đoạn cầu thang',
  'Structural Grid': 'Lưới trục',
  Trap: 'Bẫy nước',
  'Turbine Vent': 'Quả cầu thông gió',
  Unit: 'Căn hộ',
  Wall: 'Tường',
  Window: 'Cửa sổ',
  Zone: 'Vùng',
}

/** Hint labels, chip labels and chip tooltips. */
const HINT_VI: Record<string, string> = {
  // shared
  Cancel: 'Huỷ',
  Exit: 'Thoát',
  Rotate: 'Xoay',
  Placement: 'Vị trí đặt',
  'Placement type': 'Kiểu đặt',
  'Force place': 'Đặt bắt buộc',
  'Exit drawing': 'Thoát vẽ',
  'Step back or cancel': 'Lùi một bước hoặc huỷ',
  'Cancel run / exit': 'Huỷ đường ống / thoát',
  // 'Cycle snapping mode' cố ý không dịch: `useVisibleToolHints` (panel-tool-options.ts) giấu
  // hint Shift theo đúng nhãn tiếng Anh này, dịch đi thì dòng bị giấu hiện ra (RV3 #2).
  'Bypass snapping': 'Bỏ qua bắt điểm',
  'Free placement': 'Đặt tự do',
  // wall, fence, measurement
  'Set wall start / end': 'Đặt điểm đầu / cuối tường',
  Shape: 'Hình dạng',
  'Shape: Line': 'Hình dạng: Đường thẳng',
  'Shape: Rectangle': 'Hình dạng: Hình chữ nhật',
  'Wall shape — click or press R to toggle': 'Hình dạng tường: bấm hoặc nhấn R để đổi',
  'Split at the marks': 'Cắt tại các vạch',
  Cuts: 'Số vết cắt',
  'Number of cuts — scroll or click to change': 'Số vết cắt: cuộn hoặc bấm để đổi',
  'Set fence start / end': 'Đặt điểm đầu / cuối hàng rào',
  'Place measurement point': 'Đặt điểm đo',
  'Finish measurement': 'Kết thúc phép đo',
  'Remove last point': 'Xoá điểm cuối',
  'Finish and continue': 'Kết thúc và đo tiếp',
  // slab, ceiling, roof, grid
  'Trace slab outline': 'Vẽ đường bao sàn',
  'Finish slab': 'Hoàn tất sàn',
  'Trace ceiling outline': 'Vẽ đường bao trần',
  'Finish ceiling': 'Hoàn tất trần',
  'Set roof footprint': 'Đặt phạm vi mái',
  'Rotate roof direction 90°': 'Xoay hướng mái 90°',
  'Placement: Auto': 'Vị trí đặt: Tự động',
  'Placement: Ground': 'Vị trí đặt: Mặt đất',
  'Placement: Roof': 'Vị trí đặt: Mái',
  'Placement surface - click or press P to cycle': 'Mặt đặt: bấm hoặc nhấn P để đổi',
  'Create from': 'Tạo từ',
  Draw: 'Vẽ',
  Room: 'Phòng',
  'Start grid axis': 'Bắt đầu trục lưới',
  'Finish grid axis': 'Kết thúc trục lưới',
  // place-on-click kinds
  'Place block': 'Đặt khối',
  'Place cabinet': 'Đặt tủ',
  'Type: Cabinet': 'Kiểu: Tủ',
  'Type: Island': 'Kiểu: Đảo bếp',
  'Placement type — click or press I to toggle': 'Kiểu đặt: bấm hoặc nhấn I để đổi',
  'Place column': 'Đặt cột',
  'Place door on wall': 'Đặt cửa đi lên tường',
  'Place window on wall': 'Đặt cửa sổ lên tường',
  'Flip side': 'Lật mặt',
  'Place elevator': 'Đặt thang máy',
  'Place item': 'Đặt đồ vật',
  'Place shelf': 'Đặt kệ',
  'Place stairs': 'Đặt cầu thang',
  'Place spawn point': 'Đặt điểm xuất phát',
  'Rotate spawn point': 'Xoay điểm xuất phát',
  'Place unit': 'Đặt căn hộ',
  'Rotate ghost ±15°': 'Xoay bản xem trước ±15°',
  // roof accessories
  'Place box vent on roof': 'Đặt lỗ thông gió hộp lên mái',
  'Place chimney on roof': 'Đặt ống khói lên mái',
  'Place cupola on roof': 'Đặt chòi mái lên mái',
  'Place dormer on roof': 'Đặt cửa sổ mái lên mái',
  'Place eyebrow vent on roof': 'Đặt lỗ thông gió cong lên mái',
  'Place gutter on roof eave': 'Đặt máng xối lên mép mái',
  'Place ridge vent on roof': 'Đặt thông gió nóc lên mái',
  'Place skylight on roof': 'Đặt cửa sổ trời lên mái',
  'Place solar panel array on roof': 'Đặt dãy pin mặt trời lên mái',
  'Place turbine vent on roof': 'Đặt quả cầu thông gió lên mái',
  'Highlight outlet': 'Tô sáng cửa thoát',
  'Drop downspout from outlet': 'Thả ống thoát từ cửa thoát',
  'Place canopy or set the next run point': 'Đặt mái hiên hoặc điểm kế tiếp',
  'Rotate or flip the run side': 'Xoay hoặc lật phía đường chạy',
  'Cycle mono / gable / butterfly': 'Đổi mái một dốc / hai dốc / chữ V',
  'End run / cancel': 'Kết thúc đường chạy / huỷ',
  // dimensions
  'Pick witness point': 'Chọn điểm gióng',
  'Finish multi-point witnesses': 'Kết thúc gióng nhiều điểm',
  'Place dimension line when needed': 'Đặt đường kích thước khi cần',
  'Remove last witness': 'Xoá điểm gióng cuối',
  // MEP
  'Place fitting': 'Đặt phụ kiện',
  'Snap onto the run': 'Bắt vào đường ống',
  'Rotate ±45°': 'Xoay ±45°',
  'Switch rotation axis (Y → X → Z)': 'Đổi trục xoay (Y → X → Z)',
  'Start segment': 'Bắt đầu đoạn',
  'Place and continue': 'Đặt và vẽ tiếp',
  'Go vertical ↕, click to place': 'Đi thẳng đứng ↕, bấm để đặt',
  'Duct diameter down / up': 'Giảm / tăng cỡ ống gió',
  'Round / rectangular / oval': 'Tròn / chữ nhật / bầu dục',
  'Place register': 'Đặt miệng gió',
  'Mount: floor / ceiling / wall': 'Gắn: sàn / trần / tường',
  'Rotate ±45° (floor / ceiling)': 'Xoay ±45° (sàn / trần)',
  'Start lineset': 'Bắt đầu ống đồng',
  'Place it (locked to 45°)': 'Đặt (khoá theo góc 45°)',
  'Cancel start point': 'Huỷ điểm đầu',
  'Start liquid line': 'Bắt đầu ống lỏng',
  'Follow: trace a lineset': 'Bám theo: vẽ dọc ống đồng',
  'Start run': 'Bắt đầu đường ống',
  'Waste / vent': 'Thoát / thông hơi',
  'Slope / level': 'Dốc / phẳng',
  'Pipe size down / up': 'Giảm / tăng cỡ ống',
  'Vertical stack ↕, click to place': 'Ống đứng ↕, bấm để đặt',
  'Place trap': 'Đặt bẫy nước',
  'Auto hangers': 'Tự thêm móc treo',
  'Auto hangers: Off': 'Tự thêm móc treo: Tắt',
  'Auto hangers: On': 'Tự thêm móc treo: Bật',
  'Auto hangers - click or press H to toggle': 'Tự thêm móc treo: bấm hoặc nhấn H để đổi',
}

/** Free-text keys only (see the header comment). */
const KEY_VI: Record<string, string> = {
  'Click again': 'Bấm lần nữa',
  'Alt + drag': 'Alt + kéo',
  'Hover gutter': 'Rê lên máng xối',
  'Hover a duct end': 'Rê lên đầu ống gió',
  'Hover a pipe end': 'Rê lên đầu ống',
}

/**
 * UX41 U51: node type id → kind name for running text ("6 tường · 4 cửa đi"), from the same KIND_VI.
 * Used by the multi-select summary (`scripts/pascal-vi/editor-extra4.mjs` patches `selection-breakdown.ts`).
 * Vietnamese has no plural; unknown ids keep upstream's "roof-segment" → "roof segment".
 */
export function kindNameVi(type: string): string {
  const en = type
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const vi = KIND_VI[en]
  return vi ? vi.toLocaleLowerCase('vi') : type.replace(/-/g, ' ')
}

/** Exact entry, else the wall split pattern "Cuts: 3, even", else unchanged. */
export function viHint(text: string): string {
  const exact = HINT_VI[text]
  if (exact) return exact
  const cuts = /^Cuts: (\d+)(, even)?$/.exec(text)
  return cuts ? `Số vết cắt: ${cuts[1]}${cuts[2] ? ', chia đều' : ''}` : text
}

function translateHint(hint: ToolHint): void {
  hint.label = viHint(hint.label)
  hint.key = KEY_VI[hint.key] ?? hint.key
  const chip = hint.chip
  if (!chip) return
  for (const value of Object.keys(chip.labels)) chip.labels[value] = viHint(chip.labels[value] ?? '')
  if (chip.tooltip) chip.tooltip = viHint(chip.tooltip)
}

/**
 * In place and idempotent (Vietnamese text has no entry, so a second pass is a no-op).
 * `../page.tsx` runs it over `nodeRegistry` on start and on every `onRegistryChange`.
 */
export function translateDefinition(def: AnyNodeDefinition): void {
  if (def.presentation) def.presentation.label = KIND_VI[def.presentation.label] ?? def.presentation.label
  for (const hint of def.toolHints ?? []) translateHint(hint)
  for (const hints of Object.values(def.affordanceHints ?? {})) for (const hint of hints) translateHint(hint)
}
