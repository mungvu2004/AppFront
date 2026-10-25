/**
 * Thẻ "đơn vị đo": đơn vị chiều dài, đơn vị diện tích, dung sai bắt điểm,
 * ngưỡng tin cậy và tỷ lệ bản vẽ.
 *
 * View thuần (R-60). Mọi con số đọc được — "50 mm", "75%", "100 điểm ảnh ứng
 * với 250 mm" — do `useProjectSettings` dựng; ở đây chỉ có ô nhập và nhãn.
 * Biên của từng ô do hook kiểm (`PROJECT_SETTINGS_LIMITS`, R-71), không do ô tự chặn (G3-10).
 *
 * Đơn vị diện tích là dòng chữ chứ không phải ô chọn: sản phẩm này chỉ có mét
 * vuông, và một ô chọn một lựa chọn là lời hứa suông.
 */

import { NumericField } from '@/components/ui/NumericField';
import { Select } from '@/components/ui/Select';

import type { ProjectSettingsViewProps } from './useProjectSettings';

export type UnitsTabProps = Pick<
  ProjectSettingsViewProps,
  | 'lengthUnit'
  | 'lengthUnitOptions'
  | 'areaUnitLabel'
  | 'snapToleranceMm'
  | 'confidenceThreshold'
  | 'confidenceThresholdLabel'
  | 'scaleMmPerPx'
  | 'scaleLabel'
  | 'scalePreviewLabel'
  | 'problems'
  | 'isReadOnly'
  | 'setLengthUnit'
  | 'setSnapToleranceMm'
  | 'setConfidenceThreshold'
  | 'setScaleMmPerPx'
>;

export function UnitsTab(props: UnitsTabProps) {
  const { isReadOnly, problems } = props;

  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Đơn vị chiều dài"
        options={[...props.lengthUnitOptions]}
        value={props.lengthUnit}
        onChange={props.setLengthUnit}
        isReadOnly={isReadOnly}
      />

      <div className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text-secondary">Đơn vị diện tích</span>
        <p className="text-[14px] text-text-primary">{props.areaUnitLabel}</p>
      </div>

      <details
        className="flex flex-col gap-4 rounded-md border border-border-default px-4 py-3"
        open={Boolean(problems.snapToleranceMm || problems.confidenceThreshold || problems.scaleMmPerPx) || undefined}
      >
        <summary className="cursor-pointer text-[14px] font-medium text-text-secondary">Nâng cao</summary>
        <p className="mt-2 text-[13px] text-text-secondary">Chỉ đổi khi máy đọc sai nhiều.</p>
        <div className="mt-3 flex flex-col gap-4">
      {/* G3-10: không truyền min/max cho ô — ô tự chặn thì giá trị sai không tới hook, nên viên lưu vẫn
          "Đã lưu" và thẻ không có số lỗi. Hook kiểm khoảng (snap/confidence/scaleProblemFor) và chặn tự lưu. */}
      <NumericField
        label="Dung sai bắt điểm"
        value={props.snapToleranceMm ?? undefined}
        onChange={props.setSnapToleranceMm}
        unit="mm"
        error={problems.snapToleranceMm}
        isReadOnly={isReadOnly}
      />

      <NumericField
        label="Ngưỡng tin cậy"
        value={props.confidenceThreshold}
        onChange={(value) => props.setConfidenceThreshold(value ?? props.confidenceThreshold)}
        hint={props.confidenceThresholdLabel}
        error={problems.confidenceThreshold}
        isReadOnly={isReadOnly}
      />

      <NumericField
        label="Tỷ lệ bản vẽ"
        value={props.scaleMmPerPx ?? undefined}
        onChange={props.setScaleMmPerPx}
        hint={props.scaleLabel}
        error={problems.scaleMmPerPx}
        isReadOnly={isReadOnly}
      />
      <p className="text-[13px] text-text-secondary">{props.scalePreviewLabel}</p>
        </div>
      </details>
    </div>
  );
}
