/**
 * Chú giải độ dày của canvas — góc trái dưới, LUÔN HIỆN khi lớp Tường bật.
 *
 * View thuần (R-60): chỉ có props vào, không `src/api`, không `src/store`,
 * không `src/domain`, không `src/lib/http`.
 *
 * ## Vì sao có file này thay vì gọi thẳng `WallThicknessLegend`
 *
 * `src/components/canvas/WallThicknessLegend.tsx` đã có sẵn và đúng chỗ
 * (`absolute bottom-16 left-4`), nhưng nó nhận một BỘ TRẠNG THÁI KHÁC bảy
 * trạng thái của A11: nó gọi vai người xem là `'no-permission'` trong khi
 * `WallLayerScreenState` gọi là `'forbidden'`. Ánh xạ giữa hai bộ tên là quyết
 * định của màn, không phải của component dùng chung, nên nó sống ở đây —
 * `src/components/**` nằm ngoài danh sách file được sửa, và cũng không nên sửa:
 * bộ tên của nó đang phục vụ những nơi gọi khác.
 *
 * ## Ba trạng thái được ánh xạ CHỆCH, có chủ đích
 *
 * Nghiệm thu của màn ghi đích danh: "chú giải LUÔN HIỆN khi lớp Tường bật",
 * và ở `collapsed` thì "chỉ còn cụm công cụ trôi và chú giải (chú giải vẫn phải
 * hiện)". Ánh xạ 1:1 sẽ phá cả hai:
 *
 * - `forbidden` → `'no-permission'` khiến component **trả `null`**, tức là chú
 *   giải BIẾN MẤT ở vai Người xem. Nhưng chú giải không phải một quyền sửa —
 *   người xem vẫn cần đọc được tường nào dày bao nhiêu, và canvas ở trạng thái
 *   này vẫn "xem và phóng to được" theo đúng `WallLayerCanvasProps.isInteractive`.
 *   Nên ánh xạ về `'success'`.
 * - `collapsed` → `'collapsed'` khiến component thu về một con chữ "T" duy
 *   nhất, không còn ô màu nào. Nhưng `collapsed` là trạng thái canvas chiếm HẾT
 *   khung — rộng hơn mọi trạng thái khác, không phải chật hơn. Thu nhỏ chú giải
 *   đúng lúc có nhiều chỗ nhất là ngược. Nên ánh xạ về `'success'`.
 *
 * Bốn nhánh còn lại đi 1:1: `loading` vẽ khung xương, `error` và `empty` vẫn là
 * một khối HIỆN RA (chú giải không biến mất, chỉ đổi nội dung), `partial` lọc
 * còn những băng độ dày thật sự có trên tầng này.
 */

import { WallThicknessLegend } from '@/components/canvas/WallThicknessLegend';

import type { WallLayerScreenState, WallThicknessChoice } from './types';

/**
 * Bộ trạng thái của `WallThicknessLegend`.
 *
 * Không có `export` nào ở `WallThicknessLegend.tsx` mang kiểu này ra ngoài
 * (đúng như `docs/contracts/canvas.md` mục C ghi nhận: không props interface
 * nào trong `src/components/canvas/` được `export`), nên nó được chép lại đúng
 * nguyên văn ở đây.
 */
type ThicknessLegendState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'no-permission'
  | 'collapsed';

/** Bảy trạng thái của màn → bộ trạng thái của component dùng chung. Xem đầu file. */
const LEGEND_STATE: Readonly<Record<WallLayerScreenState, ThicknessLegendState>> = {
  empty: 'empty',
  loading: 'loading',
  partial: 'partial',
  error: 'error',
  success: 'success',
  forbidden: 'success',
  collapsed: 'success',
};

export interface WallLayerLegendProps {
  /** Trạng thái màn, để chú giải đi cùng nhịp với phần còn lại của canvas. */
  readonly state: WallLayerScreenState;
  /** Cờ lớp Tường trong cây lớp. Tắt lớp Tường thì chú giải mới được ẩn. */
  readonly isWallLayerVisible: boolean;
  /**
   * Những băng độ dày thật sự có trên tầng đang xem, sinh từ P-07
   * (`generateLegend`) ở hook. Chỉ dùng ở trạng thái `partial`; các trạng thái
   * khác hiện đủ cả thang để người đọc luôn thấy cùng một bảng quy chiếu.
   */
  readonly levels: readonly WallThicknessChoice[];
}

export function WallLayerLegend({ state, isWallLayerVisible, levels }: WallLayerLegendProps) {
  return (
    <WallThicknessLegend
      availableLevels={[...levels]}
      isVisible={isWallLayerVisible}
      state={LEGEND_STATE[state]}
    />
  );
}
