/**
 * Panel phải rộng 344 của màn Đối chiếu bản vẽ — bốn khối từ trên xuống: ba con
 * số khớp, ô dung sai, danh sách vùng lệch, và chân xác nhận.
 *
 * VIEW THUẦN (R-60): mọi thứ vào bằng `OverlayComparisonPanelProps`
 * (`types.ts`, đóng băng), không `@/api`, không `@/store`, không `@/domain`
 * (trừ `import type`), không `@/lib/http`. Mọi chuỗi hiển thị đã định dạng
 * xong ở hook (A15) — `meanText`/`maxText`/`deviationText` tới đây là chuỗi,
 * không phải số; số duy nhất view đọc là `overToleranceCount` (một phép đếm,
 * xem {@link OverToleranceStat}) và `toleranceMm` (giá trị ô nhập).
 *
 * ## Vì sao danh sách vùng lệch dùng thẳng họ `Table`
 *
 * Khác với khuôn "hàng tự dựng" của `RoomAreaPanel.rows.tsx`/
 * `HistoryPanel.chrome.tsx` (né `Table.Row` vì viền tiêu điểm hỏng), điều phối
 * viên đã duyệt vá `src/components/ui/Table.tsx` song song (worker
 * `overlay-a11y`) và Lớp 3 sẽ gộp bản vá trước khi `expectAccessible` cấp màn
 * chạy — xem `COMMON-layer2.md` mục E. Nên ở đây `Table.Row` được dùng như thể
 * đã đúng, không dựng bản thay thế cục bộ. `selected`/`isAttention` của
 * `TableRowProps` khớp thẳng `row.isSelected`/`row.statusCode === 'attention'`,
 * và khuôn bấm-cộng-`Enter` chép nguyên từ `ProjectDashboard.tsx:280-294`.
 *
 * ## Vì sao chỉ ô dung sai đọc `canEdit`
 *
 * `confirmation.canConfirm` đã tự mang hết lý do nút xác nhận có bấm được hay
 * không — "sai khi không có quyền, khi chưa đo được, hoặc khi đang tải"
 * (`types.ts:327`) — nên nút xác nhận chỉ đọc đúng cờ đó, không cộng thêm
 * `canEdit` (cộng thêm là suy luận lại một quyết định hook đã làm xong, khác
 * R-61). Chọn một hàng để xem trên canvas là xem, không phải sửa, nên không bị
 * `canEdit` chặn. Việc duy nhất còn lại `canEdit` cần chặn là đổi dung sai.
 *
 * ## Vì sao ba con số không phải một mảng lặp như `ThicknessSummary`
 *
 * `overToleranceCount` là số nguyên CHẠY được (`useCountUp`); `meanText`/
 * `maxText` là chuỗi đã xong, không có số thô nào để chạy. Gộp ba ô vào một
 * vòng lặp sẽ buộc `MetricStat` nhận cả hai hình dạng (chuỗi và số), đúng thứ
 * kiểu `MatchMetricsViewModel` cố tình tách ra để tránh (xem docstring
 * `types.ts:284-309`).
 */

import { Link } from 'react-router-dom';

import { useCountUp } from '@/hooks/useCountUp';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { NumericField } from '@/components/ui/NumericField';
import { Table } from '@/components/ui/Table';

import type { OverlayComparisonPanelProps } from './types';

const PANEL_LABEL = 'Kết quả đối chiếu bản vẽ và mô hình';
const DEVIATION_LIST_LABEL = 'Danh sách vùng lệch';
const HEADER_REFERENCE = 'Vị trí tham chiếu';
const HEADER_DEVIATION = 'độ lệch';
const HEADER_OBJECT = 'đối tượng';
const NO_DEVIATIONS_NOTICE = 'Không có vùng lệch nào được ghi nhận.';
const CONFIRM_BADGE_LABEL = 'Đã duyệt';
/** Ba ô gạch ngang nổi hơn cả nhãn của chúng: chưa đo thì một dòng nói thẳng (BUG-331, AES-13). */
const UNMEASURED_NOTICE = 'Chưa đo được độ lệch tự động — so hai lớp bằng mắt, khớp thì bấm xác nhận.';
/** G4b-25: lối đi căn ảnh, không để người dùng kẹt ở câu "cần căn trước". */
const ALIGN_LINK_LABEL = 'Đo lại tỷ lệ ở màn Hiệu chỉnh tỷ lệ';
/** G4b-28: ô mm chỉ nhận chữ số, dấu phẩy/chấm thập phân và dấu trừ (dấu trừ có câu báo riêng). */
const NON_NUMERIC_INPUT = /[^\d.,-]/;

/** Bốn lớp chung của mọi panel 344 trong repo — `HistoryPanel.chrome.tsx:91-92`. */
const PANEL_CLASS =
  'flex h-full min-h-0 w-[344px] shrink-0 flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel max-lg:h-auto max-lg:max-h-[45%] max-lg:w-full';

/** `mono-lg` không có thật trong repo; đây là lớp chữ đều lớn nhất đang chạy — `FloorSectionCut.tsx:25`. */
const METRIC_NUMBER_CLASS = 'font-mono text-[24px] font-semibold leading-none tabular-nums text-text-primary';

const COUNT_FORMAT = { fractionDigits: 0 };

/** Con số không chạy — `meanText`/`maxText` đã là chuỗi xong xuôi (A15). */
function MetricStat({ valueText, label }: { readonly valueText: string; readonly label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={METRIC_NUMBER_CLASS}>{valueText}</span>
      <p className="text-[13px] text-text-secondary">{label}</p>
    </div>
  );
}

/**
 * Số vùng vượt ngưỡng — con số CHẠY khi đổi dung sai.
 *
 * `count === null` (chưa đo được) tắt hẳn phần chạy số: đích của `useCountUp`
 * rơi về `0` nhưng chữ hiện ra là dấu gạch ngang, không phải "0" chạy tới —
 * đúng yêu cầu "không chạy số" của đặc tả. Số hiện (`aria-hidden`) và số đọc
 * (`role="status"`) tách nhau, đúng khuôn `ThicknessSummary.tsx:40-58`: một
 * con số đang chạy giữa chừng mà trình đọc màn hình đọc luôn sẽ thành một dãy
 * số vô nghĩa.
 */
function OverToleranceStat({ count, label }: { readonly count: number | null; readonly label: string }) {
  const sample = useCountUp(count ?? 0, { format: COUNT_FORMAT });
  const displayText = count === null ? '—' : sample.text;

  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden="true" className={METRIC_NUMBER_CLASS}>
        {displayText}
      </span>
      {/* Nhãn không mang dấu giá trị: '— số vùng vượt ngưỡng' cũ thừa gạch (BUG-331). */}
      <p className="text-[13px] text-text-secondary" role="status">
        {label}
        {count === null ? null : <span className="sr-only">: {count}</span>}
      </p>
    </div>
  );
}

export function OverlayComparisonPanel({
  metrics,
  toleranceMm,
  toleranceLabel,
  rows,
  confirmation,
  canEdit,
  onSetToleranceMm,
  onSelectRegion,
  onConfirmMatch,
  notice,
  alignHref,
}: OverlayComparisonPanelProps) {
  const isUnmeasured = metrics.overToleranceCount === null;

  return (
    <div aria-label={PANEL_LABEL} className={PANEL_CLASS} role="region">
      {notice === undefined ? null : <div className="px-4 pt-4">{notice}</div>}
      {isUnmeasured ? (
        <div className="flex flex-col items-start gap-1 px-4 pt-4">
          <p className="text-[13px] text-text-secondary">{UNMEASURED_NOTICE}</p>
          {alignHref !== undefined && (
            <Link
              className="rounded-md text-[13px] text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              to={alignHref}
            >
              {ALIGN_LINK_LABEL}
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 px-4 pt-4">
          <MetricStat label={metrics.labels.mean} valueText={metrics.meanText} />
          <MetricStat label={metrics.labels.max} valueText={metrics.maxText} />
          <OverToleranceStat count={metrics.overToleranceCount} label={metrics.labels.overTolerance} />
        </div>
      )}

      <div className="px-4 pt-4">
        <NumericField
          disabled={!canEdit}
          label={toleranceLabel}
          min={0}
          onBeforeInput={(event) => {
            const typed = (event.nativeEvent as InputEvent).data;
            if (typed !== null && typed !== undefined && NON_NUMERIC_INPUT.test(typed)) {
              event.preventDefault();
            }
          }}
          onChange={(value) => {
            if (value !== undefined) {
              onSetToleranceMm(value);
            }
          }}
          unit="mm"
          value={toleranceMm}
        />
      </div>

      <div className="min-h-0 flex-1 px-2 pt-3">
        {rows.length === 0 ? (
          /* Chưa đo thì dòng trên đã nói; không lặp lần hai ở đây. */
          isUnmeasured ? null : (
            <p className="px-2 py-4 text-[13px] text-text-secondary">{NO_DEVIATIONS_NOTICE}</p>
          )
        ) : (
          <Table.Root aria-label={DEVIATION_LIST_LABEL}>
            <Table.Header>
              <tr>
                <Table.Head>{HEADER_REFERENCE}</Table.Head>
                <Table.Head>{HEADER_DEVIATION}</Table.Head>
                <Table.Head>{HEADER_OBJECT}</Table.Head>
              </tr>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row
                  className="cursor-pointer"
                  isAttention={row.statusCode === 'attention'}
                  key={row.id}
                  onClick={() => {
                    onSelectRegion(row.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      onSelectRegion(row.id);
                    }
                  }}
                  selected={row.isSelected}
                  tabIndex={0}
                >
                  <Table.Cell>{row.referenceLabel}</Table.Cell>
                  <Table.Cell className="text-right font-mono tabular-nums">{row.deviationText}</Table.Cell>
                  <Table.Cell className="font-mono">{row.affectedObjectCode}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border-default px-4 py-3">
        {/* Bọc lại chứ không truyền thẳng: `onConfirmMatch` khai `() => void`, còn
            `onClick` sẽ đưa một `SyntheticEvent` vào đối số đầu. Cùng cách hàng
            danh sách ngay trên đây và `Toggle` của thanh công cụ đang làm. */}
        <Button
          disabled={!confirmation.canConfirm}
          fullWidth
          onClick={() => {
            onConfirmMatch();
          }}
          variant="primary"
        >
          {confirmation.buttonLabel}
        </Button>
        {confirmation.disabledReason !== null && (
          <p className="text-[12px] text-text-muted">{confirmation.disabledReason}</p>
        )}
        {confirmation.confirmedNotice !== null && (
          <div className="flex items-start gap-2">
            <Badge className="shrink-0" variant="verified">{CONFIRM_BADGE_LABEL}</Badge>
            <p className="text-[13px] text-text-secondary">{confirmation.confirmedNotice.text}</p>
          </div>
        )}
      </div>
    </div>
  );
}
