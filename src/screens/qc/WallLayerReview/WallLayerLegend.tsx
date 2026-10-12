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

import type { WallLayerScreenState } from './types';
import type { WallLayerLegendLevels } from './wallLayerHatch';

/** Mục cho tường ngoài ba băng chuẩn (BUG-416). */
const OTHER_THICKNESS_LABEL = 'Khác';

/**
 * Ở `collapsed` ray công cụ nổi ở góc trái trên khung (`left-4`, rộng 56 px) và chú giải ở góc
 * trái dưới cao ~150 px: khung thấp (1024, 375) là chúng chồng nhau, chú giải che nút "Mở lại hai
 * panel" (BUG-398). Dời chú giải sang phải đúng bề ngang ray — bằng `style`, không thêm lớp CSS.
 */
const COLLAPSED_RAIL_CLEARANCE = { position: 'absolute', left: 64, top: 0, bottom: 0 } as const;

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
   * Những băng độ dày thật sự có trên tầng đang xem (chỉ dùng ở trạng thái `partial`; các trạng
   * thái khác hiện đủ cả thang), cộng cờ mục "Khác" cho tường ngoài ba băng — ở MỌI trạng thái.
   */
  readonly levels: WallLayerLegendLevels;
}

export function WallLayerLegend({ state, isWallLayerVisible, levels }: WallLayerLegendProps) {
  const legend = (
    <WallThicknessLegend
      availableLevels={[...levels.levels]}
      /* Khối bọc ở `collapsed` rộng 0: không cho chữ "110 mm" gãy dòng theo nó. */
      className="whitespace-nowrap"
      isVisible={isWallLayerVisible}
      otherLabel={levels.hasUnbanded ? OTHER_THICKNESS_LABEL : undefined}
      state={LEGEND_STATE[state]}
    />
  );

  return state === 'collapsed' ? <div style={COLLAPSED_RAIL_CLEARANCE}>{legend}</div> : legend;
}
