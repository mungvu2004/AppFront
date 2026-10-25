/**
 * Panel trái rộng 296 của màn Đối chiếu bản vẽ (demo Z/S-28): đầu màn (`head` — eyebrow, H1,
 * trạng thái), câu trạng thái của màn (`notice`), dung sai + hai con số sai số, rồi danh sách
 * vùng lệch gom "Vượt dung sai" / "Trong dung sai", tệ nhất lên đầu (thứ tự hook đã sắp).
 *
 * VIEW THUẦN (R-60): mọi chuỗi đã định dạng ở hook (A15). Số vùng vượt dung sai nằm ở câu
 * trạng thái của đầu panel (số chạy khi đổi dung sai), không lặp thành ô thứ ba ở đây.
 * Nút xác nhận nằm ở cổng (FlowGate) trên thanh bước, không ở panel này.
 *
 * Danh sách dùng thẳng họ `Table`: `selected`/`isAttention` của `Table.Row` khớp
 * `row.isSelected`/`row.statusCode === 'attention'`; khuôn bấm-cộng-`Enter` như `ProjectDashboard`.
 */

import { Link } from 'react-router-dom';

import { getButtonStyles } from '@/components/ui/buttonVariants';
import { NumericField } from '@/components/ui/NumericField';
import { Table } from '@/components/ui/Table';

import type { DeviationRowViewModel, OverlayComparisonPanelProps } from './types';

const PANEL_LABEL = 'Kết quả đối chiếu bản vẽ và mô hình';
const DEVIATION_LIST_LABEL = 'Danh sách vùng lệch';
const METRICS_LABEL = 'Sai số đo được';
const NO_DEVIATIONS_NOTICE = 'Không có vùng lệch nào được ghi nhận.';
/** Chưa đo thì một dòng nói thẳng, không ô gạch ngang (BUG-331, AES-13). */
const UNMEASURED_NOTICE = 'Máy chưa đo được độ lệch. So hai lớp bằng mắt; thấy khớp thì xác nhận.';
/** G4b-25: lối đi căn ảnh, không để người dùng kẹt ở câu "cần căn trước". */
const ALIGN_LINK_LABEL = 'Lệch nhiều? Đặt tỷ lệ';
/** G4b-28: ô mm chỉ nhận chữ số, dấu phẩy/chấm thập phân và dấu trừ (dấu trừ có câu báo riêng). */
const NON_NUMERIC_INPUT = /[^\d.,-]/;

/** Dưới 1024 panel nằm trên canvas, cao tối đa 40 % để canvas còn chỗ. */
const PANEL_CLASS =
  'flex min-h-0 w-[296px] shrink-0 flex-col overflow-y-auto border-r border-border-default bg-bg-surface ' +
  'max-lg:max-h-[40%] max-lg:w-full max-lg:border-b max-lg:border-r-0';

function MetricStat({ valueText, label }: { readonly valueText: string; readonly label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-bg-sunken px-3 py-2">
      <p className="text-body-sm text-text-secondary">{label}</p>
      <span className="font-mono text-[20px] font-semibold leading-tight tabular-nums text-text-primary">{valueText}</span>
    </div>
  );
}

function RowGroup({
  title,
  rows,
  onSelectRegion,
}: {
  readonly title: string;
  readonly rows: readonly DeviationRowViewModel[];
  readonly onSelectRegion: (id: string | null) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <Table.Body>
      <tr>
        <th
          className="px-3 pb-1 pt-3 text-left text-caption font-medium uppercase tracking-[0.06em] text-text-secondary"
          colSpan={3}
          scope="rowgroup"
        >
          {`${title} ${String(rows.length)}`}
        </th>
      </tr>
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
          <Table.Cell className="max-w-[132px] truncate" title={row.referenceLabel}>
            {row.referenceLabel}
          </Table.Cell>
          <Table.Cell className="whitespace-nowrap text-right font-mono tabular-nums">{row.deviationText}</Table.Cell>
          <Table.Cell className="font-mono">{row.affectedObjectCode}</Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
  );
}

export function OverlayComparisonPanel({
  head,
  showUnmeasuredNotice = true,
  metrics,
  toleranceMm,
  toleranceLabel,
  rows,
  canEdit,
  onSetToleranceMm,
  onSelectRegion,
  notice,
  alignHref,
  action,
}: OverlayComparisonPanelProps) {
  const isUnmeasured = metrics.overToleranceCount === null;
  const overRows = rows.filter((row) => row.statusCode === 'attention');
  const withinRows = rows.filter((row) => row.statusCode !== 'attention');

  return (
    <div aria-label={PANEL_LABEL} className={PANEL_CLASS} role="region">
      {head}
      {notice === undefined ? null : <div className="px-4 pt-4">{notice}</div>}

      <div className="flex flex-col items-start gap-2 px-4 pt-4">
        {isUnmeasured && showUnmeasuredNotice && <p className="text-body-sm text-text-secondary">{UNMEASURED_NOTICE}</p>}
        {action}
        {isUnmeasured && showUnmeasuredNotice && alignHref !== undefined && (
          <Link className={getButtonStyles({ variant: 'secondary', size: 'sm' })} to={alignHref}>
            {ALIGN_LINK_LABEL}
          </Link>
        )}
      </div>

      {(!isUnmeasured || !showUnmeasuredNotice) && (
      <div className="flex flex-col gap-3 border-b border-border-default px-4 py-4">
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
        {!isUnmeasured && (
          <div aria-label={METRICS_LABEL} className="grid grid-cols-2 gap-2" role="group">
            <MetricStat label={metrics.labels.mean} valueText={metrics.meanText} />
            <MetricStat label={metrics.labels.max} valueText={metrics.maxText} />
          </div>
        )}
      </div>
      )}

      <div className="px-1 pb-3">
        {rows.length === 0 ? (
          /* Chưa đo thì dòng trên đã nói; không lặp lần hai ở đây. */
          isUnmeasured ? null : <p className="px-3 py-4 text-body-sm text-text-secondary">{NO_DEVIATIONS_NOTICE}</p>
        ) : (
          <Table.Root aria-label={DEVIATION_LIST_LABEL} className="h-auto overflow-visible">
            <Table.Header>
              <tr>
                <Table.Head>Vị trí</Table.Head>
                <Table.Head className="text-right">Độ lệch</Table.Head>
                <Table.Head>Mã</Table.Head>
              </tr>
            </Table.Header>
            <RowGroup onSelectRegion={onSelectRegion} rows={overRows} title="Vượt dung sai" />
            <RowGroup onSelectRegion={onSelectRegion} rows={withinRows} title="Trong dung sai" />
          </Table.Root>
        )}
      </div>
    </div>
  );
}
