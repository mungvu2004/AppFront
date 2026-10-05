/**
 * Cột phải: chi tiết lượt đang chọn (N34), số đo (N36), nhật ký (N37), và hộp thoại A9 "Huỷ
 * lượt". Dưới 1024 nó nằm trong `Drawer` — nơi ráp quyết định chỗ đặt.
 *
 * Hai bảng là `Table.Virtual` cao 320: một lượt có tới 200 000 điểm. Nhật ký tự cuộn xuống
 * CHỈ khi người đọc đang ở cuối.
 */

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Modal } from '@/components/overlay/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { cn } from '@/lib/utils';

import type { CancelDialogModel, JobDetailModel, TrainingJobsActions } from './types';

const TEXT = {
  placeholder: 'Chọn một lượt để xem chi tiết.',
  cancel: 'Huỷ lượt',
  keep: 'Giữ lại',
  cancelTitle: 'Huỷ lượt huấn luyện này?',
  cancelBody: 'Lượt dừng ở vòng hiện tại, không chạy tiếp được.',
  metrics: 'Số đo',
  logs: 'Nhật ký',
  noMetrics: 'Chưa có số đo.',
  noLogs: 'Chưa có dòng nhật ký.',
} as const;

const METRIC_HEADERS = ['Bước', 'Vòng', 'Tập', 'Loss'] as const;
const METRIC_TAIL = 'Lúc';
const LOG_HEADERS = ['Lúc', 'Mức', 'Nội dung'] as const;
/** Cách mép dưới bao nhiêu px thì vẫn tính là "đang ở cuối". */
const BOTTOM_SLACK_PX = 8;
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

function Section({ children, title }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold text-text-primary">{title}</h3>
      {children}
    </section>
  );
}

function MetricsTable({ detail }: { readonly detail: JobDetailModel }) {
  const headers = [...METRIC_HEADERS, detail.scoreName, METRIC_TAIL];

  return (
    <div className="h-[320px] overflow-auto rounded-[8px] border border-border-default">
      <Table.Root className="h-auto overflow-visible">
        <Table.Header>
          <Table.Row>
            {headers.map((header) => (
              <Table.Head key={header}>{header}</Table.Head>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Virtual
          colSpan={headers.length}
          renderRow={(row) => (
            <Table.Row className="h-10 tabular-nums">
              <Table.Cell>{row.step}</Table.Cell>
              <Table.Cell>{row.epoch}</Table.Cell>
              <Table.Cell>{row.split}</Table.Cell>
              <Table.Cell>{row.loss}</Table.Cell>
              <Table.Cell>{row.score}</Table.Cell>
              <Table.Cell className="text-text-secondary">{row.at}</Table.Cell>
            </Table.Row>
          )}
          rows={[...detail.metricRows]}
        />
      </Table.Root>
    </div>
  );
}

function LogsTable({ detail }: { readonly detail: JobDetailModel }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const count = detail.logRows.length;

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element !== null && atBottomRef.current) element.scrollTop = element.scrollHeight;
  }, [count]);

  return (
    <div
      className="h-[320px] overflow-auto rounded-[8px] border border-border-default"
      onScroll={(event) => {
        const element = event.currentTarget;
        atBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_SLACK_PX;
      }}
      ref={scrollRef}
    >
      <Table.Root className="h-auto overflow-visible">
        <Table.Header>
          <Table.Row>
            {LOG_HEADERS.map((header) => (
              <Table.Head key={header}>{header}</Table.Head>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Virtual
          colSpan={LOG_HEADERS.length}
          renderRow={(row) => (
            <Table.Row className="h-10">
              <Table.Cell className="text-text-secondary">{row.at}</Table.Cell>
              <Table.Cell>
                <Badge variant={row.levelVariant}>{row.levelLabel}</Badge>
              </Table.Cell>
              <Table.Cell className="break-words">{row.message}</Table.Cell>
            </Table.Row>
          )}
          rows={[...detail.logRows]}
        />
      </Table.Root>
    </div>
  );
}

export interface TrainingJobDetailProps {
  readonly detail: JobDetailModel | null;
  readonly actions: TrainingJobsActions;
}

export function TrainingJobDetail({ actions, detail }: TrainingJobDetailProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const seenKeyRef = useRef(detail?.focusKey ?? 0);
  const focusKey = detail?.focusKey ?? 0;

  // Sau lượt huỷ, nút "Huỷ lượt" biến mất: tiêu điểm về tiêu đề thay vì rơi về `body`. Chỉ
  // khi khoá ĐỔI trong lúc cột đang gắn — gắn lại không cướp tiêu điểm (A12).
  useEffect(() => {
    if (focusKey === seenKeyRef.current) return;
    seenKeyRef.current = focusKey;
    headingRef.current?.focus();
  }, [focusKey]);

  if (detail === null) return <p className="text-[13px] text-text-secondary">{TEXT.placeholder}</p>;

  if (detail.fields.length === 0) {
    return detail.notice !== null ? <InlineAlert level="violation" message={detail.notice} /> : <Skeleton preset="property-panel" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className={cn('min-w-0 flex-1 break-words text-base font-semibold text-text-primary', FOCUS_RING)} ref={headingRef} tabIndex={-1}>
          {detail.title}
        </h2>
        <Badge variant={detail.statusVariant}>{detail.statusLabel}</Badge>
      </div>
      {detail.notice !== null && <InlineAlert level="attention" message={detail.notice} />}
      {detail.failureText !== null && <InlineAlert level="violation" message={detail.failureText} />}
      <dl className="grid grid-cols-2 gap-3 text-[13px]">
        {detail.fields.map((field) => (
          <div className="flex flex-col gap-1" key={field.label}>
            <dt className="text-text-secondary">{field.label}</dt>
            <dd className={cn('text-text-primary', field.isCode && 'break-all font-mono')}>
              {field.isCode ? <code>{field.value}</code> : field.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        {detail.resultLink !== null && (
          <a className="text-[13px] text-accent hover:underline" href={detail.resultLink.href}>
            {detail.resultLink.label}
          </a>
        )}
        {detail.canCancel && (
          <Button className="ml-auto" onClick={actions.onRequestCancel} size="sm" variant="secondary">
            {TEXT.cancel}
          </Button>
        )}
      </div>
      <Section title={TEXT.metrics}>
        <p className="text-[13px] tabular-nums text-text-secondary">{detail.metricsSummary ?? TEXT.noMetrics}</p>
        <MetricsTable detail={detail} />
      </Section>
      <Section title={TEXT.logs}>
        {detail.logRows.length === 0 && <p className="text-[13px] text-text-secondary">{TEXT.noLogs}</p>}
        <LogsTable detail={detail} />
      </Section>
    </div>
  );
}

export interface TrainingJobCancelDialogProps {
  readonly dialog: CancelDialogModel | null;
  readonly actions: TrainingJobsActions;
}

/** A9: huỷ không hoàn tác được. Esc đóng (Modal, A12), tiêu điểm về nút đã mở. */
export function TrainingJobCancelDialog({ actions, dialog }: TrainingJobCancelDialogProps) {
  return (
    <Modal.Root isOpen={dialog !== null} onClose={actions.onCloseCancel} width={480}>
      {dialog !== null && (
        <>
          <Modal.Header>{TEXT.cancelTitle}</Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4 pb-2">
              <p>{TEXT.cancelBody}</p>
              {dialog.errorMessage !== null && <InlineAlert level="violation" message={dialog.errorMessage} />}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={actions.onCloseCancel} variant="ghost">
              {TEXT.keep}
            </Button>
            <Button disabled={dialog.isSubmitting} loading={dialog.isSubmitting} onClick={actions.onConfirmCancel} variant="primary">
              {TEXT.cancel}
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal.Root>
  );
}
