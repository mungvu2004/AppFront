/**
 * Cột phải của màn Xử lý: sáu bước (kết quả trên hàng) và cổng "Để sang Kiểm tra
 * tầng" cố định ở đáy khung, mọi trạng thái cùng một chỗ. Mọi chữ của cổng đến từ
 * `deriveProcessingGate` (một nguồn trạng thái).
 */

import { ArrowRight, Check, Circle, Ruler, TriangleAlert } from 'lucide-react';

import { Section } from '@/components/shell/Section';
import { Button } from '@/components/ui/Button';

import { GATE_LABEL, WAITING_NOTE, type ProcessingGateModel } from './processingGate';
import { ProcessingStepBar } from './ProcessingStepBar';
import { ProcessingStepList } from './ProcessingStepList';
import type { ProcessingScreenProps } from './types';

const CANCEL_LABEL = 'Huỷ xử lý';
const CANCEL_CONFIRM_ARIA_LABEL = 'Xác nhận huỷ xử lý';
const CANCEL_CONFIRM_QUESTION = 'Huỷ lượt xử lý này?';
const CANCEL_CONFIRM_LABEL = 'Xác nhận huỷ';
const CANCEL_DISMISS_LABEL = 'Giữ nguyên';
const ALL_STEPS_LABEL = 'Xem tất cả các bước';
const AI_DONE_LABEL = 'AI xử lý xong';
const SCALE_LABEL = 'Tỷ lệ bản vẽ';
const CONFIDENCE_LABEL = 'Độ tin cậy';
const ADVISORY_LABEL = 'khuyến nghị';

/** Huỷ xác nhận TẠI CHỖ, không hộp thoại; `Escape` đóng lớp xác nhận (A12). */
export function ProcessingCancel(props: ProcessingScreenProps) {
  if (!props.canCancel) return null;
  if (!props.isCancelConfirming) {
    return (
      <Button onClick={props.onRequestCancel} size="sm" variant="ghost">
        {CANCEL_LABEL}
      </Button>
    );
  }
  return (
    <div
      aria-label={CANCEL_CONFIRM_ARIA_LABEL}
      className="flex flex-wrap items-center gap-2"
      onKeyDown={(event) => {
        if (event.key === 'Escape') props.onDismissCancel();
      }}
      role="group"
    >
      <span className="text-[13px] text-text-secondary">{CANCEL_CONFIRM_QUESTION}</span>
      <Button onClick={props.onConfirmCancel} size="sm" variant="danger">
        {CANCEL_CONFIRM_LABEL}
      </Button>
      <Button onClick={props.onDismissCancel} size="sm" variant="ghost">
        {CANCEL_DISMISS_LABEL}
      </Button>
    </div>
  );
}

function Condition({
  isOk,
  label,
  note,
  value,
}: {
  readonly isOk: boolean;
  readonly label: string;
  readonly note?: string | undefined;
  readonly value: string;
}) {
  return (
    <li className="flex items-start gap-2">
      {isOk ? (
        <Check aria-hidden="true" className="mt-0.5 shrink-0 text-state-verified-text" size={16} />
      ) : (
        <Circle aria-hidden="true" className="mt-0.5 shrink-0 text-text-muted" size={16} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 text-[14px]">
          <span className="text-text-primary">{label}</span>
          <span className={isOk ? 'text-text-secondary' : 'text-state-attention-text'}>{value}</span>
        </div>
        {note !== undefined ? <p className="text-[13px] text-text-secondary">{note}</p> : null}
      </div>
    </li>
  );
}

export function ProcessingGatePanel({
  gate,
  isSheet,
  props,
}: {
  readonly gate: ProcessingGateModel;
  readonly isSheet: boolean;
  readonly props: ProcessingScreenProps;
}) {
  const lowConfidence = gate.isAiDone ? props.summary?.lowConfidenceSentence : undefined;
  const metrics = props.summary?.metricLabels ?? [];
  const list = (
    <ProcessingStepList
      prefersReducedMotion={props.prefersReducedMotion}
      resultByStepId={gate.resultByStepId}
      steps={props.steps}
      warnStepIds={gate.warnStepIds}
    />
  );

  return (
    <Section
      aria-label={gate.title}
      // Cột dính, cao tối đa phần khung nhìn còn lại (1024x768: 768 - 288 px đầu trang); thân khung
      // (div cuối của Section) là cột flex để danh sách bước cuộn trong cột còn cổng luôn thấy.
      className="flex flex-col lg:sticky lg:top-4 lg:max-h-[calc(100vh-18rem)] lg:self-start [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col"
      flush
      title={gate.title}
    >
      <div className="order-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5 lg:order-1">
        {isSheet ? (
          // Một thanh cho bước hiện tại, và cả sáu bước vẫn mở ra được ở khổ hẹp (BUG-294).
          <div className="flex flex-col gap-2">
            <ProcessingStepBar prefersReducedMotion={props.prefersReducedMotion} steps={props.steps} />
            <details>
              <summary className="min-h-11 cursor-pointer select-none rounded-lg px-1 py-3 text-[14px] font-medium text-text-secondary hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid sm:min-h-0 sm:py-2">
                {ALL_STEPS_LABEL}
              </summary>
              {list}
            </details>
          </div>
        ) : (
          list
        )}
        {gate.isAiDone && gate.resultByStepId.size === 0 && metrics.length > 0 ? (
          <p className="text-[13px] text-text-secondary">{metrics.join(', ')}</p>
        ) : null}
      </div>

      {/* Dưới 1024 px cổng đứng TRÊN danh sách bước; từ 1024 px dính đáy cột. */}
      <div
        className="order-1 flex shrink-0 flex-col gap-3 border-b border-border-default p-5 lg:order-2 lg:border-t lg:border-b-0"
        id="viec-tiep"
      >
        <p className="text-caption font-medium uppercase tracking-[0.06em] text-text-muted">{GATE_LABEL}</p>
        <ul className="flex flex-col gap-2">
          <Condition isOk={gate.isAiDone} label={AI_DONE_LABEL} value={gate.doneStepsLabel} />
          <Condition isOk={gate.isScaleOk} label={SCALE_LABEL} note={gate.scaleNote} value={gate.scaleValue} />
          {lowConfidence !== undefined ? (
            <li className="flex items-start gap-2">
              <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-state-attention-text" size={16} />
              <div className="min-w-0 flex-1 text-[14px]">
                <span className="text-text-primary">{CONFIDENCE_LABEL}</span>{' '}
                <span className="text-[12px] text-text-secondary">{ADVISORY_LABEL}</span>
                <p className="text-[13px] text-text-secondary">{lowConfidence}</p>
              </div>
            </li>
          ) : null}
        </ul>
        {gate.action !== undefined ? (
          <div className="flex flex-col gap-1">
            <Button
              className="w-full"
              onClick={gate.action.onClick}
              variant="primary"
              {...(gate.action.isForward
                ? { iconAfter: <ArrowRight aria-hidden="true" size={16} /> }
                : { iconBefore: <Ruler aria-hidden="true" size={16} /> })}
            >
              {gate.action.label}
            </Button>
            {gate.action.note !== undefined ? (
              <p className="text-center text-[13px] text-text-secondary">{gate.action.note}</p>
            ) : null}
          </div>
        ) : gate.kind === 'running' ? (
          <p className="rounded-lg bg-bg-sunken px-3 py-2 text-[13px] text-text-secondary">{WAITING_NOTE}</p>
        ) : null}
      </div>
    </Section>
  );
}
