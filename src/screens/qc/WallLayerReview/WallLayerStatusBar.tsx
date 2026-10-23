/**
 * Thanh trạng thái (32px) của màn Duyệt lớp tường — ĐÚNG BA MỤC: toạ độ con
 * trỏ · tỷ lệ · trạng thái lưu.
 *
 * {@link WallLayerStatusBarProps} là phần MỞ RỘNG ngoài `types.ts` (đóng băng):
 * `WallLayerViewProps` và `WallLayerCanvasProps` không mang toạ độ con trỏ, tỷ lệ
 * hay trạng thái lưu — ba thứ này đến từ theo dõi chuột trên canvas và từ
 * autosave (A7), không phải dữ liệu nghiệp vụ của lớp tường. Quyết định của
 * điều phối viên: khai props riêng ở đây, T8/hook cấp đủ ba chuỗi khi ghép màn.
 *
 * Không dùng `StatusBar` (`src/components/shell/StatusBar.tsx`) trực tiếp vì
 * component đó nhận toạ độ THÔ (`x: number, y: number`) rồi tự làm tròn/định
 * dạng lấy — đúng việc `local/no-raw-number` cấm ở tầng giao diện (component đó nằm trong
 * sổ nợ đã ghi ở CLAUDE.md, không phải khuôn để chép). Ba trường dưới đây là
 * CHUỖI ĐÃ ĐỊNH DẠNG SẴN (A15) — view chỉ hiển thị.
 */

import { AlertCircle, Check } from 'lucide-react';

import { QcStatusBar } from '../shared/QcScreenFrame';

export interface WallLayerStatusBarProps {
  /** Toạ độ con trỏ, đã định dạng sẵn — ví dụ "X: 124,50 · Y: 89,12". */
  readonly cursorLabel: string;
  /** Tỷ lệ, đã định dạng sẵn — ví dụ "12 mm/px". */
  readonly scaleLabel: string;
  /** Trạng thái lưu, đã định dạng sẵn — ví dụ "Đã lưu lúc 14:32". */
  readonly saveLabel: string;
  /** Lượt lưu gần nhất thất bại — nhãn đổi sang màu vi phạm kèm biểu tượng (BUG-616). */
  readonly saveFailed: boolean;
  /** Hoàn tác thao tác gần nhất (khe chung của thanh trạng thái). */
  readonly onUndo?: (() => void) | undefined;
}

/** G4a-19: gợi ý kéo/phóng bản vẽ — khớp `wallLayerReview.statusBar.panHint`. */
const PAN_HINT = 'Kéo nền hoặc giữ Space để di chuyển · lăn chuột để phóng';
const SAVED_PREFIX = 'Đã lưu';

export function WallLayerStatusBar({ cursorLabel, scaleLabel, saveLabel, saveFailed, onUndo }: WallLayerStatusBarProps) {
  return (
    <QcStatusBar onUndo={onUndo} saveFailed={saveFailed} saveLabel={saveLabel}>
      {/*
        Sans + tabular-nums, không mono: nhãn này cũng là câu ("Chưa rê chuột lên bản vẽ") — BUG-612.
        Dưới 640 chỉ giữ trạng thái lưu, hai mục kia không gãy thành nhiều dòng (BUG-324).
      */}
      <span className="hidden min-w-0 truncate text-caption tabular-nums text-text-secondary sm:block">{cursorLabel}</span>
      <span className="hidden min-w-0 truncate text-caption tabular-nums text-text-secondary sm:block">{scaleLabel}</span>
      <span className="hidden min-w-0 truncate text-caption text-text-muted xl:block">{PAN_HINT}</span>
      {/* G4a-14 (A7): không thêm nút lưu — chỉ báo tự lưu đậm hơn, có biểu tượng. */}
      {saveFailed ? (
        <AlertCircle aria-hidden="true" className="ml-auto h-3.5 w-3.5 shrink-0 text-state-violation" />
      ) : saveLabel.startsWith(SAVED_PREFIX) ? (
        <Check aria-hidden="true" className="ml-auto h-3.5 w-3.5 shrink-0 text-state-verified-text" />
      ) : null}
    </QcStatusBar>
  );
}
