/**
 * Khối gấp "Tuỳ chọn nhập" của giai đoạn 2 — đơn vị bản vẽ và gốc toạ độ.
 *
 * View thuần của mục D (R-60): mọi thứ vào bằng {@link CadImportOptionsProps},
 * không `src/api`, không `src/store`, không `src/domain`, không `src/lib/http`.
 * Không `useState` nào ở đây: trạng thái mở/đóng nằm ở `model.isExpanded`, và
 * việc đổi nó là của hook qua `actions.onToggleImportOptions`.
 *
 * ## Vì sao `<details>` thô chứ không phải một component gấp
 *
 * Repo không có `Collapsible` hay `Accordion`, và R-68 cấm dựng component chung
 * mới trong lúc dựng màn. Cặp `<details>` và `<summary>` là phần tử sẵn có của
 * HTML: nó tự
 * mang bàn phím (Enter/Space mở đóng), tự mang ngữ nghĩa cho trình đọc màn hình,
 * và không thêm một dòng phụ thuộc nào. Điều phối viên đã chốt hướng này.
 *
 * ## Vì sao đơn vị tự nhận là GỢI Ý chứ không phải giá trị mặc định câm
 *
 * `model.detectedUnit` là thứ hệ thống đọc được từ tệp, và tệp CAD thường không
 * khai đơn vị (xem `CadFileDiagnostics.hasMissingUnitDeclaration`). Chọn sai đơn
 * vị thì toàn bộ hình học sai tỷ lệ, nên con số máy đoán được nói ra thành lời
 * ngay cạnh ô chọn thay vì lặng lẽ nằm sẵn trong ô — người dùng thấy nó là gợi
 * ý và biết mình đang xác nhận hay đang sửa.
 */

import { useMemo } from 'react';
import type { SyntheticEvent } from 'react';

import type { SelectOption } from '@/components/ui/Select';
import { Select } from '@/components/ui/Select';

import {
  ADVANCED_OPTIONS_LABEL,
  COORDINATE_ORIGIN_LABEL,
  DETECTED_UNIT_HINT_LABEL,
  DRAWING_UNIT_LABEL,
} from './cadBranchConfirmText';
import type {
  CadDrawingUnit,
  CadImportOptionsProps,
  CadOriginMode,
  CadSelectOption,
} from './types';

/** Ô chọn đơn vị được nối với ghi chú gợi ý bằng `aria-describedby`. */
const DETECTED_UNIT_HINT_ID = 'cad-import-options-detected-unit-hint';

/**
 * Mục của hợp đồng (`readonly`, giá trị hẹp) đổi sang mục `Select` nhận
 * (`SelectOption`, giá trị `string`). Chỉ đổi kiểu chứa, không đổi nội dung.
 */
function toSelectOptions<TValue extends string>(
  options: readonly CadSelectOption<TValue>[],
): SelectOption[] {
  return options.map((option) => ({ label: option.label, value: option.value }));
}

/**
 * `Select` trả về một `string` bất kỳ; hợp đồng đòi một giá trị hẹp.
 *
 * Tìm ngược trong chính danh sách mục thay vì ép kiểu: giá trị nào không có
 * trong danh sách thì không phát hành động nào, nên một `Select` hỏng cũng
 * không đẩy được giá trị lạ vào hook.
 */
function narrowToOption<TValue extends string>(
  options: readonly CadSelectOption<TValue>[],
  value: string,
): TValue | null {
  return options.find((option) => option.value === value)?.value ?? null;
}

export function CadImportOptions({ actions, model }: CadImportOptionsProps) {
  const { onChangeOrigin, onChangeUnit, onToggleImportOptions } = actions;
  const { detectedUnit, isExpanded, origin, originOptions, unit, unitOptions } = model;

  const unitSelectOptions = useMemo(() => toSelectOptions(unitOptions), [unitOptions]);
  const originSelectOptions = useMemo(() => toSelectOptions(originOptions), [originOptions]);

  const detectedUnitLabel =
    detectedUnit === null
      ? null
      : (unitOptions.find((option) => option.value === detectedUnit)?.label ?? null);

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>): void => {
    onToggleImportOptions(event.currentTarget.open);
  };

  const handleUnitChange = (value: string): void => {
    const nextUnit: CadDrawingUnit | null = narrowToOption(unitOptions, value);

    if (nextUnit !== null) {
      onChangeUnit(nextUnit);
    }
  };

  const handleOriginChange = (value: string): void => {
    const nextOrigin: CadOriginMode | null = narrowToOption(originOptions, value);

    if (nextOrigin !== null) {
      onChangeOrigin(nextOrigin);
    }
  };

  return (
    <details
      className="w-full rounded-[12px] border border-border-default bg-bg-surface"
      onToggle={handleToggle}
      open={isExpanded}
    >
      <summary className="cursor-pointer select-none rounded-[12px] px-3 py-2 text-[14px] font-medium text-text-secondary transition-colors duration-120 hover:bg-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none">
        {ADVANCED_OPTIONS_LABEL}
      </summary>

      <div className="flex flex-col gap-4 px-3 pb-3 pt-2">
        <Select.Root onChange={handleUnitChange} options={unitSelectOptions} value={unit}>
          <Select.Label>{DRAWING_UNIT_LABEL}</Select.Label>
          <Select.Trigger
            aria-describedby={detectedUnitLabel === null ? undefined : DETECTED_UNIT_HINT_ID}
            options={unitSelectOptions}
          />
          <Select.Content>
            {unitSelectOptions.map((option, index) => (
              <Select.Item index={index} key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>

        {detectedUnitLabel === null ? null : (
          <p className="-mt-2 text-[12px] leading-snug text-text-muted" id={DETECTED_UNIT_HINT_ID}>
            {DETECTED_UNIT_HINT_LABEL}: {detectedUnitLabel}
          </p>
        )}

        <Select.Root onChange={handleOriginChange} options={originSelectOptions} value={origin}>
          <Select.Label>{COORDINATE_ORIGIN_LABEL}</Select.Label>
          <Select.Trigger options={originSelectOptions} />
          <Select.Content>
            {originSelectOptions.map((option, index) => (
              <Select.Item index={index} key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>
    </details>
  );
}
