/**
 * Thẻ "chung" của màn cài đặt dự án: tên, mã, địa chỉ, loại công trình, ghi chú.
 *
 * View thuần (R-60): mọi giá trị và mọi câu phàn nàn đều đã dựng xong ở
 * `useProjectSettings`, nên file này không gọi `formatNumber` và không biết gì
 * về tầng dữ liệu. Ba ô đầu là ba trường duy nhất hiện đi được lên máy chủ —
 * xem `projectSettingsGateway.ts`.
 */

import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';

import { PROJECT_SETTINGS_LIMITS, type ProjectSettingsViewProps } from './useProjectSettings';

export type GeneralTabProps = Pick<
  ProjectSettingsViewProps,
  | 'name'
  | 'code'
  | 'address'
  | 'buildingType'
  | 'buildingTypeOptions'
  | 'notes'
  | 'notesCountLabel'
  | 'problems'
  | 'isReadOnly'
  | 'setName'
  | 'setCode'
  | 'setAddress'
  | 'setBuildingType'
  | 'setNotes'
>;

export function GeneralTab(props: GeneralTabProps) {
  const { isReadOnly, problems } = props;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="tên dự án"
        value={props.name}
        onChange={(event) => props.setName(event.target.value)}
        maxLength={PROJECT_SETTINGS_LIMITS.nameMaxLength}
        error={problems.name}
        isReadOnly={isReadOnly}
      />
      <Input
        label="mã dự án"
        value={props.code}
        onChange={(event) => props.setCode(event.target.value)}
        maxLength={PROJECT_SETTINGS_LIMITS.codeMaxLength}
        error={problems.code}
        hint="mã ngắn để tra cứu nhanh; bỏ trống cũng được"
        isReadOnly={isReadOnly}
      />
      <Input
        label="địa chỉ"
        value={props.address}
        onChange={(event) => props.setAddress(event.target.value)}
        maxLength={PROJECT_SETTINGS_LIMITS.addressMaxLength}
        error={problems.address}
        isReadOnly={isReadOnly}
      />
      <Select
        label="loại công trình"
        options={[...props.buildingTypeOptions]}
        value={props.buildingType}
        onChange={props.setBuildingType}
        isReadOnly={isReadOnly}
      />
      {isReadOnly ? (
        // Không dựng `Textarea` ở chế độ chỉ đọc: bản chỉ đọc của nó vẫn là một
        // `<textarea readonly>` — phím Tab vẫn tới, nhưng lớp `focus-visible:ring-0`
        // của nó bỏ mất viền tiêu điểm mà A12 đòi. Một đoạn văn nói đúng nội dung
        // ấy mà không hứa một ô nhập không nhập được.
        <div className="flex flex-col gap-1">
          <span className="text-[14px] font-medium text-text-secondary">ghi chú</span>
          <p className="text-[14px] text-text-primary">{props.notes === '' ? '—' : props.notes}</p>
        </div>
      ) : (
        <Textarea
          label="ghi chú"
          value={props.notes}
          onChange={(event) => props.setNotes(event.target.value)}
          hint={props.notesCountLabel}
          placeholder="không bắt buộc"
          {...(problems.notes !== null ? { error: problems.notes } : {})}
        />
      )}
    </div>
  );
}
