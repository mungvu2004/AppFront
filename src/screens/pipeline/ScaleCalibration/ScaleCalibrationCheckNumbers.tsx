/**
 * Ba khối tự kiểm của panel "Kiểm tra con số" (S-11): số tỷ lệ to (mm/px + ≈ 1:N
 * theo DPI + phép tính), kiểm chéo bằng một kích thước đã biết, và bảng đối chiếu
 * mm/px theo DPI. View thuần: mọi chuỗi từ `buildScaleCheck` (scaleCheck.ts).
 */

import { clsx } from 'clsx';
import { Check, TriangleAlert } from 'lucide-react';

import type { ScaleComputationViewModel } from './types';
import type { ScaleCheckViewModel } from './scaleCheck';

const COMPUTATION_ARIA_LABEL = 'Phép tính ra tỷ lệ';

interface Props {
  readonly check: ScaleCheckViewModel | undefined;
  readonly computation: ScaleComputationViewModel;
  /** Dự phòng khi mô hình chưa mang `scaleCheck` (fixture cũ): nhãn và dòng dẫn xuất sẵn có. */
  readonly currentScaleLabel: string;
  readonly derivedLine: string;
}

export function ScaleCalibrationCheckNumbers({ check, computation, currentScaleLabel, derivedLine }: Props) {
  return (
    <>
      <section
        aria-label={check?.title ?? currentScaleLabel}
        className="flex flex-col gap-1 rounded-xl bg-bg-sunken p-4"
      >
        <h3 className="text-[13px] font-medium text-text-secondary">{check?.title ?? currentScaleLabel}</h3>
        <p
          className="text-[28px] font-semibold tabular-nums text-text-primary"
          title={check?.densityValue == null ? undefined : `${check.densityValue} mm/px`}
        >
          {check?.ratioLine ?? currentScaleLabel}
        </p>
        {check == null && <p className="text-[13px] text-text-secondary">{derivedLine}</p>}
        {computation.isComplete && (
        <div
          aria-label={COMPUTATION_ARIA_LABEL}
          className="mt-2 flex flex-wrap items-baseline gap-1.5 border-t border-border-default pt-2 font-mono text-[13px] text-text-primary"
          role="group"
        >
          <span>{computation.numeratorLabel}</span>
          <span aria-hidden="true">÷</span>
          <span>{computation.denominatorLabel}</span>
          <span aria-hidden="true">=</span>
          <span className="font-semibold">{computation.resultLabel}</span>
        </div>
        )}
      </section>

      {check?.knownCheck != null && (
        <p className="flex gap-2 text-[13px]">
          {check.knownCheck.tone === 'verified' ? (
            <Check aria-hidden="true" className="mt-0.5 shrink-0 text-state-verified-text" size={14} />
          ) : (
            <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-state-attention-text" size={14} />
          )}
          <span className="flex flex-col gap-0.5">
            <span
              className={clsx(
                'font-medium',
                check.knownCheck.tone === 'verified' ? 'text-state-verified-text' : 'text-state-attention-text',
              )}
            >
              {check.knownCheck.title}
            </span>
            <span className="text-text-secondary">{check.knownCheck.detail}</span>
          </span>
        </p>
      )}
    </>
  );
}
