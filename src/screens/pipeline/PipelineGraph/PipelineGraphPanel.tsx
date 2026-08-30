/**
 * Panel phải của chế độ Chi tiết kỹ thuật — rộng 344.
 *
 * View THUẦN (mục D, R-60). Nó kể lại nút đang chọn: đầu vào, tham số, số đầu
 * ra, ảnh của bước trung gian nếu có; rồi hai việc người dùng làm được — chạy
 * lại từ bước này, và mở nhật ký.
 *
 * ## Chạy lại phải cảnh báo TRƯỚC
 *
 * Chạy lại một bước dựng lại mọi thứ phía sau nó, kể cả những tường người duyệt
 * đã xác nhận. Việc đó **không hoàn tác được**, nên A9 bắt hỏi trước bằng một
 * lớp xác nhận, và câu hỏi phải nêu **đúng số** mục đã duyệt bị ảnh hưởng — con
 * số đó do hook đếm qua P-03, không phải một lời cảnh báo chung chung.
 *
 * Xác nhận NGAY TẠI CHỖ, không `Modal`: panel này đã là một lớp phụ, chồng thêm
 * một hộp thoại chặn lên nó chỉ làm đường thoát bằng bàn phím dài thêm. `Escape`
 * đóng lớp xác nhận — nó là lớp trên cùng duy nhất panel dựng ra (A12).
 *
 * ## Nhật ký
 *
 * Khối gấp, chữ đều 13, trên nền `--bg-sunken`. Trạng thái mở nằm ở hook nên
 * story dựng thẳng được cả hai nhánh.
 */

import { clsx } from 'clsx';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';

import { PIPELINE_GRAPH_TEXT } from './pipelineGraphText';
import type { PipelineNodePanelViewModel } from './types';

export interface PipelineGraphPanelProps {
  readonly panel: PipelineNodePanelViewModel;
  readonly onToggleLog: () => void;
  readonly onRequestRerun: () => void;
  readonly onToggleKeepApproved: () => void;
  readonly onConfirmRerun: () => void;
  readonly onDismissRerun: () => void;
}

/** Một mục có tiêu đề nhỏ và nội dung dưới nó. */
function PanelSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-1">
      {/* KHÔNG `uppercase`: A6 nói nhãn giao diện viết thường, kiểu câu, và ngoại
          lệ chữ hoa chỉ dành cho mã trục, mã lỗi và tên phím. */}
      <h3 className="text-[12px] tracking-wide text-text-muted">{title}</h3>
      {children}
    </section>
  );
}

/** Lớp xác nhận chạy lại, cộng lựa chọn giữ lại phần đã duyệt. */
function RerunConfirm({
  onConfirmRerun,
  onDismissRerun,
  onToggleKeepApproved,
  panel,
}: Pick<
  PipelineGraphPanelProps,
  'onConfirmRerun' | 'onDismissRerun' | 'onToggleKeepApproved' | 'panel'
>) {
  const warning = panel.rerunWarning;

  if (warning === undefined) {
    return null;
  }

  return (
    <div
      aria-label={warning.title}
      className="flex flex-col gap-2 rounded-[8px] border border-danger-border bg-danger-tint p-3"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onDismissRerun();
        }
      }}
      role="group"
    >
      <span className="text-[13px] font-medium text-state-violation-text">{warning.title}</span>
      <span className="text-[13px] text-text-primary">{warning.message}</span>

      <Checkbox
        checked={warning.isKeepingApproved}
        label={warning.keepApprovedLabel}
        onChange={onToggleKeepApproved}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirmRerun} size="sm" variant="danger">
          {warning.confirmLabel}
        </Button>
        <Button onClick={onDismissRerun} size="sm" variant="ghost">
          {warning.dismissLabel}
        </Button>
      </div>
    </div>
  );
}

export function PipelineGraphPanel(props: PipelineGraphPanelProps) {
  const { onRequestRerun, onToggleLog, panel } = props;

  return (
    <aside
      aria-label={PIPELINE_GRAPH_TEXT.detailPanelAriaLabel}
      className="flex w-full flex-col gap-4 rounded-[12px] border border-border-default bg-bg-surface p-4 lg:w-[344px] lg:shrink-0"
    >
      <h2 className="text-[15px] font-medium text-text-primary">{panel.title}</h2>

      {panel.inputLines.length === 0 ? null : (
        <PanelSection title={PIPELINE_GRAPH_TEXT.panelInputHeader}>
          <ul className="flex flex-col gap-0.5">
            {panel.inputLines.map((line) => (
              <li className="text-[13px] text-text-secondary" key={line}>
                {line}
              </li>
            ))}
          </ul>
        </PanelSection>
      )}

      {panel.parameterRows.length === 0 ? null : (
        <PanelSection title={PIPELINE_GRAPH_TEXT.panelParameterHeader}>
          <dl className="flex flex-col">
            {panel.parameterRows.map((row) => (
              <div
                className="flex items-baseline justify-between gap-3 border-b border-border-default py-1.5 last:border-b-0"
                key={row.id}
              >
                <dt className="text-[13px] text-text-secondary">{row.label}</dt>
                {/* `<code>` chứ không phải `span` chữ đều: giá trị tham số là
                    ký hiệu máy (`L2`, `300 dpi`, `3000 × 3000`), và `<code>` là
                    thẻ `expectVietnamese` bỏ qua — cùng lý lẽ với `Ctrl`. */}
                <dd>
                  <code className="font-mono text-[13px] text-text-primary">{row.value}</code>
                </dd>
              </div>
            ))}
          </dl>
        </PanelSection>
      )}

      <PanelSection title={PIPELINE_GRAPH_TEXT.panelOutputHeader}>
        <span className="text-[13px] text-text-primary">
          {panel.outputCountLabel ?? PIPELINE_GRAPH_TEXT.unknownValue}
        </span>
      </PanelSection>

      {panel.thumbnail === undefined ? null : (
        <PanelSection title={PIPELINE_GRAPH_TEXT.panelThumbnailHeader}>
          <img
            alt={panel.thumbnail.alt}
            className="max-h-[160px] w-full rounded-[8px] border border-border-default bg-bg-sunken object-contain"
            src={panel.thumbnail.url}
          />
        </PanelSection>
      )}

      <div className="flex flex-col gap-2">
        {panel.rerunWarning === undefined ? (
          <Button onClick={onRequestRerun} size="sm" variant="secondary">
            {panel.rerunLabel}
          </Button>
        ) : (
          <RerunConfirm
            onConfirmRerun={props.onConfirmRerun}
            onDismissRerun={props.onDismissRerun}
            onToggleKeepApproved={props.onToggleKeepApproved}
            panel={panel}
          />
        )}

        {panel.rerunUnavailableLine !== undefined ? (
          <p className="text-[12px] text-text-secondary">{panel.rerunUnavailableLine}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-border-default pt-3">
        <Button
          aria-controls="pipeline-graph-log"
          aria-expanded={panel.isLogOpen}
          onClick={onToggleLog}
          size="sm"
          variant="ghost"
        >
          {PIPELINE_GRAPH_TEXT.panelLogLabel}
        </Button>

        <pre
          className={clsx(
            'max-h-[200px] overflow-auto rounded-[8px] bg-bg-sunken p-3',
            'font-mono text-[13px] text-text-secondary',
          )}
          hidden={!panel.isLogOpen}
          id="pipeline-graph-log"
        >
          {panel.logLines.join('\n')}
        </pre>
      </div>
    </aside>
  );
}
