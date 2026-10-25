import { AlertCircle, AlertTriangle, Grid3x3 } from 'lucide-react';

import { Button } from '@/components/ui/Button';

import { AXIS_CARD_TEXT } from './axisGridGate';

/**
 * Thẻ trên bản vẽ của màn trục (demo Z/S-18 "thieu"/"loi"): nguyên nhân + nút tới việc
 * còn thiếu, đặt góc trên trái như S-17 (không đè cụm thu phóng góc dưới phải). Ở 1024
 * cột chi tiết là ngăn kéo, nên nút chính phải nằm ở đây mới luôn thấy.
 */
export type AxisGridCanvasCardKind = 'empty' | 'missingHorizontal' | 'missingVertical' | 'error';

interface AxisGridCanvasCardProps {
  readonly kind: AxisGridCanvasCardKind;
  readonly message: string;
  readonly isViewerRole: boolean;
  readonly onAddAxis: (direction: 'horizontal' | 'vertical') => void;
  readonly onRetry: () => void;
}

export function AxisGridCanvasCard({ kind, message, isViewerRole, onAddAxis, onRetry }: AxisGridCanvasCardProps) {
  const isError = kind === 'error';
  const title =
    kind === 'error'
      ? AXIS_CARD_TEXT.errorTitle
      : kind === 'empty'
        ? AXIS_CARD_TEXT.emptyTitle
        : kind === 'missingHorizontal'
          ? AXIS_CARD_TEXT.missingHorizontalTitle
          : AXIS_CARD_TEXT.missingVerticalTitle;
  const Icon = isError ? AlertCircle : kind === 'empty' ? Grid3x3 : AlertTriangle;

  return (
    <div
      className="absolute left-4 top-4 z-10 flex w-[440px] max-w-[calc(100%-32px)] flex-col items-start gap-2 rounded-xl bg-bg-surface p-5 shadow-panel"
      role={isError ? 'alert' : undefined}
    >
      <span
        aria-hidden="true"
        className={
          isError
            ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-state-violation-tint text-state-violation-text'
            : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-state-attention-tint text-state-attention-text'
        }
      >
        <Icon size={18} />
      </span>
      <h2 className="text-heading text-text-primary">{title}</h2>
      <p className="text-body-sm text-text-secondary">{message}</p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {isError ? (
          <>
            <Button onClick={onRetry} type="button" variant="primary">
              {AXIS_CARD_TEXT.retry}
            </Button>
            {isViewerRole ? null : (
              <Button onClick={() => onAddAxis('horizontal')} type="button" variant="secondary">
                {AXIS_CARD_TEXT.drawManual}
              </Button>
            )}
          </>
        ) : isViewerRole ? null : (
          <Button
            onClick={() => onAddAxis(kind === 'missingVertical' ? 'vertical' : 'horizontal')}
            type="button"
            variant="primary"
          >
            {/* Một chữ cho cùng một việc ở thẻ và ở cổng; "Thêm trục…" là nút mở ô nhập của nhóm trục. */}
            {kind === 'missingVertical' ? AXIS_CARD_TEXT.drawVertical : AXIS_CARD_TEXT.drawHorizontal}
          </Button>
        )}
      </div>
    </div>
  );
}
