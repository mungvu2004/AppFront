/**
 * Bàn phím của vỏ 3D — bảng I-01 của chín màn, khai một lần ở đây.
 *
 * File `.ts` THUẦN: không JSX, không React. Cùng khuôn `buildGlobalShortcuts`
 * của `src/lib/input/shortcutRegistry.ts` — một hàm nhận bộ xử lý và trả về
 * mảng {@link ShortcutDefinition}, để `useViewerShell.ts` đăng ký cả bảng
 * trong MỘT effect thay vì gọi `useShortcut` mười ba lần.
 *
 * A12: bàn phím là đường đi hạng nhất. Mọi phím ở đây đi qua
 * `appShortcutRegistry`; không nơi nào trong thư mục màn gọi
 * `addEventListener('keydown')` (R-72, R-54).
 *
 * ## Ba chỗ bảng này lệch khỏi prompt, và vì sao
 *
 * **`H` KHÔNG phải "ẩn".** `TOOL_SHORTCUTS.pan` của `src/lib/tools/shortcuts.ts`
 * đã là `'H'`, và "kéo màn" nằm ngay trên ray công cụ của chính vỏ này. Cướp
 * `H` cho "ẩn" nghĩa là một phím làm hai việc tuỳ chỗ con trỏ đang đứng — thứ
 * `shortcutConflicts` sinh ra để chặn. Nên ẩn dời sang {@link HIDE_COMBO}
 * (`Shift+H`), giữ nguyên họ H: `H` kéo màn · `Shift+H` ẩn · `Alt+H` cô lập.
 *
 * **`1`–`4` đổi tầng, không phải sáu góc nhìn chuẩn.** `CAMERA_PRESETS`
 * (`camera/presets.ts:144`) gán `Digit1`–`Digit6` cho sáu góc nhìn, nhưng
 * `rg -ln "CAMERA_PRESETS|presetForKey" src` chỉ ra chính file đó — chưa nơi
 * nào đăng ký, nên không có xung đột lúc chạy. Bốn góc nhìn của vỏ nằm trên
 * `Select` của thanh trên; bốn phím số dành cho tầng, theo đúng đặc tả sản
 * phẩm.
 *
 * **`Escape` chỉ được đăng ký khi đang có đối tượng được chọn.**
 * `SCOPE_PRIORITY` xếp `canvas` TRƯỚC `global`, nên một binding `Escape` ở
 * phạm vi canvas sẽ nuốt mất `global.closeTopLayer` — đúng lời hứa A12 mà
 * không tính năng nào được lấy đi. Nên `useViewerShell` truyền
 * `enabled: false` cho binding này khi chưa chọn gì, và nó luôn để
 * `preventDefault: false` để hành vi Escape của trình duyệt (thoát toàn màn
 * hình) không bị chặn.
 */

import type { ShortcutDefinition } from '@/lib/input/shortcutRegistry';

/* -------------------------------------------------------------------------- */
/* Tổ hợp phím.                                                                */
/* -------------------------------------------------------------------------- */

/** Bốn phím số chọn tầng, từ dưới lên. */
export const STOREY_COMBOS: readonly string[] = Object.freeze(['1', '2', '3', '4']);

/** Xem toàn cảnh. */
export const FIT_ALL_COMBO = '0';

/** Bật tắt phép chiếu trực giao. */
export const ORTHOGRAPHIC_COMBO = 'O';

/** Ẩn đối tượng đang chọn — xem ghi chú đầu file về `H`. */
export const HIDE_COMBO = 'Shift+H';

/** Cô lập đối tượng đang chọn. */
export const ISOLATE_COMBO = 'Alt+H';

/** Khuôn đối tượng đang chọn vào khung hình. */
export const FRAME_COMBO = 'F';

/** Bật tắt tách tầng. */
export const SEPARATION_COMBO = 'E';

/** Bật công cụ đo. */
export const MEASURE_COMBO = 'M';

/** Mở ô tìm đối tượng. */
export const SEARCH_COMBO = '/';

/** Bỏ chọn. */
export const DESELECT_COMBO = 'Escape';

/* -------------------------------------------------------------------------- */
/* Bộ xử lý.                                                                   */
/* -------------------------------------------------------------------------- */

/** Những việc bàn phím của vỏ gọi tới. Vỏ cấp đủ mười, không cái nào tuỳ chọn. */
export interface ViewerShortcutHandlers {
  /** Chọn tầng thứ `index` tính từ dưới lên (0 là tầng dưới cùng). */
  selectStorey(index: number): void;
  fitAll(): void;
  toggleOrthographic(): void;
  hideSelection(): void;
  isolateSelection(): void;
  frameSelection(): void;
  toggleSeparation(): void;
  activateMeasure(): void;
  openSearch(): void;
  clearSelection(): void;
}

/* -------------------------------------------------------------------------- */
/* Bảng.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Mười ba binding của vỏ 3D.
 *
 * Mã `id` mang tiền tố `viewer.` và nói RÕ chỗ đăng ký, vì đó là cái tên mà
 * cảnh báo trùng phím của `reportOverlaps()` in ra.
 *
 * `description` là câu tiếng Việt viết thường kiểu câu (A6) cho bảng phím tắt.
 */
export function buildViewerShortcuts(
  handlers: ViewerShortcutHandlers,
): readonly ShortcutDefinition[] {
  const storeyBindings = STOREY_COMBOS.map((combo, index): ShortcutDefinition => ({
    id: `viewer.storey.${combo}`,
    combo,
    scope: 'canvas',
    description: `xem tầng thứ ${combo} tính từ dưới lên`,
    onTrigger: (): void => {
      handlers.selectStorey(index);
    },
  }));

  return [
    ...storeyBindings,
    {
      id: 'viewer.camera.fitAll',
      combo: FIT_ALL_COMBO,
      scope: 'canvas',
      description: 'đưa toàn bộ mô hình vào khung hình',
      onTrigger: (): void => {
        handlers.fitAll();
      },
    },
    {
      id: 'viewer.camera.orthographic',
      combo: ORTHOGRAPHIC_COMBO,
      scope: 'canvas',
      description: 'bật tắt phép chiếu trực giao',
      onTrigger: (): void => {
        handlers.toggleOrthographic();
      },
    },
    {
      id: 'viewer.selection.hide',
      combo: HIDE_COMBO,
      scope: 'canvas',
      description: 'ẩn đối tượng đang chọn',
      onTrigger: (): void => {
        handlers.hideSelection();
      },
    },
    {
      id: 'viewer.selection.isolate',
      combo: ISOLATE_COMBO,
      scope: 'canvas',
      description: 'chỉ hiện đối tượng đang chọn',
      onTrigger: (): void => {
        handlers.isolateSelection();
      },
    },
    {
      id: 'viewer.camera.frameSelection',
      combo: FRAME_COMBO,
      scope: 'canvas',
      description: 'khuôn đối tượng đang chọn vào khung hình',
      onTrigger: (): void => {
        handlers.frameSelection();
      },
    },
    {
      id: 'viewer.storey.separation',
      combo: SEPARATION_COMBO,
      scope: 'canvas',
      description: 'bật tắt tách tầng',
      onTrigger: (): void => {
        handlers.toggleSeparation();
      },
    },
    {
      id: 'viewer.tool.measure',
      combo: MEASURE_COMBO,
      scope: 'canvas',
      description: 'bật công cụ đo',
      onTrigger: (): void => {
        handlers.activateMeasure();
      },
    },
    {
      id: 'viewer.search.open',
      combo: SEARCH_COMBO,
      scope: 'canvas',
      description: 'mở ô tìm đối tượng',
      onTrigger: (): void => {
        handlers.openSearch();
      },
    },
  ];
}

/**
 * Binding `Escape` riêng, vì nó bật tắt theo trạng thái chọn.
 *
 * Tách khỏi {@link buildViewerShortcuts} để `useViewerShell` truyền `enabled`
 * cho riêng nó — xem ghi chú đầu file: đăng ký thường trực sẽ lấy mất
 * `global.closeTopLayer` của A12.
 */
export function buildDeselectShortcut(
  handlers: Pick<ViewerShortcutHandlers, 'clearSelection'>,
): ShortcutDefinition {
  return {
    id: 'viewer.selection.clear',
    combo: DESELECT_COMBO,
    scope: 'canvas',
    preventDefault: false,
    description: 'bỏ chọn đối tượng trên mô hình',
    onTrigger: (): void => {
      handlers.clearSelection();
    },
  };
}
