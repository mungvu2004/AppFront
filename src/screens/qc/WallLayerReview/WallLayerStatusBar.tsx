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

export interface WallLayerStatusBarProps {
  /** Toạ độ con trỏ, đã định dạng sẵn — ví dụ "X: 124,50 · Y: 89,12". */
  readonly cursorLabel: string;
  /** Tỷ lệ, đã định dạng sẵn — ví dụ "12 mm/px". */
  readonly scaleLabel: string;
  /** Trạng thái lưu, đã định dạng sẵn — ví dụ "Đã lưu lúc 14:32". */
  readonly saveLabel: string;
}

const STATUS_BAR_ARIA_LABEL = 'Thanh trạng thái';

export function WallLayerStatusBar({ cursorLabel, scaleLabel, saveLabel }: WallLayerStatusBarProps) {
  return (
    <div
      aria-label={STATUS_BAR_ARIA_LABEL}
      className="flex h-8 shrink-0 select-none items-center justify-between border-t border-border-default bg-bg-surface px-4"
      role="status"
    >
      <span className="font-mono text-[12px] leading-none tabular-nums text-text-secondary">
        {cursorLabel}
      </span>
      <span className="text-[12px] tabular-nums text-text-secondary">{scaleLabel}</span>
      <span aria-live="polite" className="text-[12px] text-text-muted">
        {saveLabel}
      </span>
    </div>
  );
}
