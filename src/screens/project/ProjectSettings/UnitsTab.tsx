/**
 * Thẻ "đơn vị đo": đơn vị chiều dài, đơn vị diện tích, dung sai bắt điểm,
 * ngưỡng tin cậy và tỉ lệ bản vẽ.
 *
 * View thuần (R-60). Mọi con số đọc được — "50 mm", "75%", "100 điểm ảnh ứng
 * với 250 mm" — do `useProjectSettings` dựng; ở đây chỉ có ô nhập và nhãn.
 * Biên của từng ô lấy từ `PROJECT_SETTINGS_LIMITS` chứ không viết thẳng (R-71).
 *
 * Đơn vị diện tích là dòng chữ chứ không phải ô chọn: sản phẩm này chỉ có mét
 * vuông, và một ô chọn một lựa chọn là lời hứa suông.
 */

import { NumericField } from '@/components/ui/NumericField';
import { Select } from '@/components/ui/Select';

import { PROJECT_SETTINGS_LIMITS, type ProjectSettingsViewProps } from './useProjectSettings';

export type UnitsTabProps = Pick<
  ProjectSettingsViewProps,
  | 'lengthUnit'
  | 'lengthUnitOptions'
  | 'areaUnitLabel'
  | 'snapToleranceMm'
  | 'snapToleranceLabel'
  | 'snapToleranceMinMm'
  | 'snapToleranceMaxMm'
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
        label="đơn vị chiều dài"
        options={[...props.lengthUnitOptions]}
        value={props.lengthUnit}
        onChange={props.setLengthUnit}
        isReadOnly={isReadOnly}
      />

      <div className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text-secondary">đơn vị diện tích</span>
        <p className="text-[14px] text-text-primary">{props.areaUnitLabel}</p>
      </div>

      <NumericField
        label="dung sai bắt điểm"
        value={props.snapToleranceMm ?? undefined}
        onChange={props.setSnapToleranceMm}
        min={props.snapToleranceMinMm}
        max={props.snapToleranceMaxMm}
        unit="mm"
        hint={props.snapToleranceLabel}
        error={problems.snapToleranceMm}
        isReadOnly={isReadOnly}
      />

      <NumericField
        label="ngưỡng tin cậy"
        value={props.confidenceThreshold}
        onChange={(value) => props.setConfidenceThreshold(value ?? props.confidenceThreshold)}
        min={PROJECT_SETTINGS_LIMITS.confidenceMin}
        max={PROJECT_SETTINGS_LIMITS.confidenceMax}
        hint={props.confidenceThresholdLabel}
        error={problems.confidenceThreshold}
        isReadOnly={isReadOnly}
      />

      <NumericField
        label="tỉ lệ bản vẽ"
        value={props.scaleMmPerPx ?? undefined}
        onChange={props.setScaleMmPerPx}
        min={PROJECT_SETTINGS_LIMITS.scaleMinMmPerPx}
        max={PROJECT_SETTINGS_LIMITS.scaleMaxMmPerPx}
        hint={props.scaleLabel}
        error={problems.scaleMmPerPx}
        isReadOnly={isReadOnly}
      />
      <p className="text-[13px] text-text-secondary">{props.scalePreviewLabel}</p>
    </div>
  );
}
