/**
 * Ba khối tự kiểm của panel "Kiểm tra con số" (S-11): số tỷ lệ to (mm/px + ≈ 1:N
 * theo DPI + phép tính), kiểm chéo bằng một kích thước đã biết, và bảng đối chiếu
 * mm/px theo DPI. View thuần: mọi chuỗi từ `buildScaleCheck` (scaleCheck.ts).
 */

import { clsx } from 'clsx';
import { Check, Info, TriangleAlert } from 'lucide-react';

import type { ScaleComputationViewModel } from './types';
import type { ScaleCheckViewModel } from './scaleCheck';

const COMPUTATION_ARIA_LABEL = 'Phép tính ra tỷ lệ';
const COMPUTATION_INCOMPLETE = 'Còn thiếu một vế, nên chưa ra được tỷ lệ.';
const UNIT = 'mm/px';
const TABLE_CAPTION = 'Đối chiếu nhanh: 1 px bằng bao nhiêu mm';

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
        {check?.densityValue != null ? (
          <p className="flex items-baseline gap-1 text-text-primary">
            <span className="font-mono text-[32px] font-semibold tabular-nums">{check.densityValue}</span>
            <span className="text-[13px] text-text-secondary">{UNIT}</span>
          </p>
        ) : (
          <p className="text-[16px] font-semibold text-text-primary">{currentScaleLabel}</p>
        )}
        <p className="text-[13px] text-text-secondary">{check?.ratioLine ?? derivedLine}</p>
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
        {!computation.isComplete && <p className="text-[12px] text-text-secondary">{COMPUTATION_INCOMPLETE}</p>}
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
      {check?.knownCheckMissing != null && (
        <p className="flex gap-2 text-[13px] text-text-secondary">
          <Info aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
          <span>{check.knownCheckMissing}</span>
        </p>
      )}

      {check?.table != null && (
        <section aria-label={TABLE_CAPTION} className="flex flex-col gap-1">
          <h3 className="text-[13px] font-medium text-text-secondary">{TABLE_CAPTION}</h3>
          <table className="w-full text-[13px] tabular-nums [&_td]:py-1 [&_th]:py-1">
            <thead>
              <tr>
                <th scope="col" />
                {check.table.headers.map((header) => (
                  <th className="text-right font-normal text-text-secondary" key={header} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {check.table.rows.map((row) => (
                <tr key={row.ratio}>
                  <th className="text-left font-normal text-text-secondary" scope="row">
                    {row.ratio}
                  </th>
                  {row.cells.map((cell, index) => (
                    <td
                      className={clsx('text-right', index === row.cells.length - 1 && 'font-semibold')}
                      key={check.table?.headers[index]}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
