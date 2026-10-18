/**
 * Step 3 of the "tạo dự án mới" wizard — xem lại.
 *
 * Split out of `CreateProjectModal.tsx` when that file neared R-22's 400-line
 * ceiling (mục D); `index.ts` keeps every caller's import path unchanged.
 * A pure view: every value arrives already computed on
 * {@link CreateProjectModalViewProps}.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { FieldRow } from '@/components/ui/FieldRow';

import type { CreateProjectModalViewProps } from './useCreateProjectModal';

/** A read-only value in a text {@link FieldRow} (`isText`, BUG-121). A long code or address breaks anywhere rather than overflowing its column. */
function ReviewValue({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="block text-[14px] text-text-primary [overflow-wrap:anywhere]">
      {children}
    </span>
  );
}

export function StepReview(props: CreateProjectModalViewProps) {
  const buildingTypeLabel =
    props.buildingTypeOptions.find((option) => option.value === props.buildingType)?.label ?? props.buildingType;

  return (
    <div className="flex flex-col">
      {props.notice !== null && (
        <div className="mb-4">
          <InlineAlert
            level={props.notice.level}
            message={props.notice.message}
            {...(props.notice.actionLabel !== undefined
              ? { action: { label: props.notice.actionLabel, onClick: props.goToFixStep } }
              : {})}
          />
        </div>
      )}
      <FieldRow isText label="Tên dự án">
        <ReviewValue>{props.name}</ReviewValue>
      </FieldRow>
      <FieldRow isText label="Mã dự án">
        <ReviewValue>{props.code === '' ? '—' : props.code}</ReviewValue>
      </FieldRow>
      <FieldRow isText label="Địa chỉ">
        <ReviewValue>{props.address === '' ? '—' : props.address}</ReviewValue>
      </FieldRow>
      <FieldRow isText label="Loại công trình">
        <ReviewValue>{buildingTypeLabel}</ReviewValue>
      </FieldRow>
      <FieldRow isText label="Ghi chú">
        <ReviewValue>{props.notes === '' ? '—' : props.notes}</ReviewValue>
      </FieldRow>
      <FieldRow isText label="Số tầng" isLast>
        <ReviewValue>{props.floorRows.length}</ReviewValue>
      </FieldRow>

      <div className="mt-4 flex flex-col gap-1 rounded-lg border border-border-default p-3">
        {/* The numbers are floor levels — named as step 2 names them (BUG-121). */}
        <div className="flex items-center justify-between text-[12px] font-medium leading-[18px] text-text-secondary">
          <span className="flex-1">Tầng</span>
          <span className="w-28 text-right">Chiều cao thông thuỷ</span>
          <span className="w-20 text-right">Cao độ</span>
        </div>
        {props.floorRows.map((row) => (
          <div key={row.id} className="flex items-center justify-between text-[13px]">
            <span className="flex-1 text-text-primary">{row.name}</span>
            <span className="w-28 text-right text-text-secondary">{row.clearHeightLabel ?? '—'}</span>
            <span className="w-20 text-right text-text-secondary">{row.elevationLabel ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
