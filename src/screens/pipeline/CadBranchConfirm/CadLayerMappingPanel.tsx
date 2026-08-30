/**
 * Panel trái 420 của giai đoạn 2 — bảng lớp CAD đọc từ tệp và ô gán vai trò.
 *
 * View thuần của mục D (R-60): mọi thứ vào bằng {@link CadLayerMappingPanelProps},
 * không `src/api`, không `src/store`, không `src/domain`, không `src/lib/http`.
 * Bảng này không tự đếm, không tự định dạng, không tự dịch: `model.roleOptions`
 * đã mang sẵn bảy nhãn tiếng Việt, và dòng tóm tắt "Đã ánh xạ 4/9 lớp" thuộc về
 * vỏ màn chứ không thuộc panel này.
 *
 * ## Vì sao `<tr>` thô thay vì `Table.Row`
 *
 * `Table.Row` vẽ vòng tiêu điểm bằng state (`focused && 'ring-2'`) chứ không
 * bằng `focus-visible:` của CSS, nên nó rớt `expectAccessible` (R-72). Bảng này
 * không có hàng chọn được nên không mất gì khi dựng `<tr>` thô kèm `Table.Cell`:
 * ô vẫn lấy đúng đệm, chiều cao và màu chữ của hệ thống bảng.
 *
 * ## Vì sao hàng phát tín hiệu nổi bật cả khi rê chuột lẫn khi nhận tiêu điểm
 *
 * A12 nói bàn phím là đường đi hạng nhất, không phải phương án dự phòng. Rê
 * chuột vào hàng thì thực thể của lớp đó sáng lên trên canvas; người dùng bàn
 * phím phải có đúng đường đó, nên khi tiêu điểm rơi vào ô chọn vai trò của hàng
 * (`onFocus` nổi bọt lên `<tr>`) thì hàng phát cùng một `onHoverLayer(id)`.
 * `onBlur` chỉ tắt nổi bật khi tiêu điểm thật sự rời khỏi hàng — kiểm bằng
 * `contains(relatedTarget)` — nếu không thì di chuyển giữa hai phần tử trong
 * cùng một hàng sẽ làm canvas nhấp nháy.
 *
 * ## Vì sao ô màu đặt màu bằng style nội tuyến
 *
 * `layer.sourceColor` là **màu CAD gốc đọc từ tệp**, không phải token giao diện,
 * nên nó chỉ có thể tới nơi bằng một biến lúc chạy. A1 và `local/no-raw-color`
 * cấm **viết** mã màu vào mã nguồn, không cấm một giá trị màu do dữ liệu mang
 * tới. Ràng buộc đi kèm, quan trọng hơn: màu này chỉ được vẽ ô nhỏ trong bảng —
 * canvas xem trước tô theo VAI TRÒ, và không bao giờ chạm `sourceColor`.
 *
 * ## Vì sao lớp chưa gán chỉ được nhắc nhẹ
 *
 * Một lớp còn ở vai trò "Bỏ qua" mà vẫn có thực thể là thứ người dùng nên biết,
 * không phải thứ chặn họ lại: gợi ý hiện ngay dưới hàng, chữ mờ, không tô đỏ, và
 * không đụng tới điều kiện bật nút "Nhập hình học" (nút đó ở vỏ màn). Ngưỡng
 * "nhiều thực thể" không có nguồn nào trong repo nên không có ngưỡng nào được
 * bịa ra ở đây — gợi ý hiện cho mọi lớp chưa gán còn thực thể, kèm đúng số thực
 * thể của lớp đó để người dùng tự lượng.
 */

import { useMemo } from 'react';
import type { FocusEvent } from 'react';

import type { SelectOption } from '@/components/ui/Select';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { cn } from '@/lib/utils';

import {
  ENTITY_COUNT_COLUMN,
  LAYER_NAME_COLUMN,
  LAYER_ROLE_COLUMN,
  ORIGINAL_COLOR_COLUMN,
  PHASE_2_PANEL_TITLE,
  UNASSIGNED_LAYER_HINT,
  layerRoleSelectAriaLabel,
  layerSourceColorAriaLabel,
} from './cadBranchConfirmText';
import type {
  CadLayer,
  CadLayerMappingPanelProps,
  CadLayerRole,
  CadSelectOption,
} from './types';

/** Bốn cột: tên lớp · số thực thể · màu gốc · vai trò. Dùng cho `colSpan` của dòng gợi ý. */
const TABLE_COLUMN_COUNT = 4;

/** Vai trò của một lớp chưa được gán. Lớp ở vai trò này là lớp sẽ không được nhập. */
const UNASSIGNED_ROLE: CadLayerRole = 'ignore';

const PANEL_TITLE_ID = 'cad-layer-mapping-panel-title';

/** Dấu ngăn giữa hai vế của một dòng ghi chú, cùng dấu vỏ màn dùng cho dòng tóm tắt. */
const HINT_SEPARATOR = ' · ';

/** Mục của hợp đồng đổi sang mục `Select` nhận. Chỉ đổi kiểu chứa, không đổi nội dung. */
function toSelectOptions(options: readonly CadSelectOption<CadLayerRole>[]): SelectOption[] {
  return options.map((option) => ({ label: option.label, value: option.value }));
}

interface CadLayerRowProps {
  readonly layer: CadLayer;
  readonly isHighlighted: boolean;
  readonly roleOptions: readonly CadSelectOption<CadLayerRole>[];
  readonly roleSelectOptions: SelectOption[];
  readonly onAssignRole: (layerId: string, role: CadLayerRole) => void;
  readonly onHoverLayer: (layerId: string | null) => void;
}

function CadLayerRow({
  isHighlighted,
  layer,
  onAssignRole,
  onHoverLayer,
  roleOptions,
  roleSelectOptions,
}: CadLayerRowProps) {
  const handleRoleChange = (value: string): void => {
    const nextRole = roleOptions.find((option) => option.value === value)?.value ?? null;

    if (nextRole !== null) {
      onAssignRole(layer.id, nextRole);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLTableRowElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      onHoverLayer(null);
    }
  };

  const hasUnassignedHint = layer.role === UNASSIGNED_ROLE && layer.entityCount > 0;

  return (
    <>
      <tr
        className={cn(
          'h-10 border-b border-border-default/50 transition-colors duration-180 motion-reduce:transition-none',
          isHighlighted ? 'bg-bg-hover' : 'hover:bg-bg-hover',
        )}
        onBlur={handleBlur}
        onFocus={() => onHoverLayer(layer.id)}
        onMouseEnter={() => onHoverLayer(layer.id)}
        onMouseLeave={() => onHoverLayer(null)}
      >
        <Table.Cell className="font-mono text-[13px] text-text-primary">{layer.name}</Table.Cell>
        <Table.Cell className="text-right font-mono text-[13px] tabular-nums text-text-secondary">
          {layer.entityCount}
        </Table.Cell>
        <Table.Cell>
          <span
            aria-label={layerSourceColorAriaLabel(layer.name)}
            className="block h-4 w-4 rounded-[3px] border border-border-default"
            role="img"
            style={{ backgroundColor: layer.sourceColor }}
          />
        </Table.Cell>
        <Table.Cell className="w-[148px]">
          <Select.Root onChange={handleRoleChange} options={roleSelectOptions} value={layer.role}>
            <Select.Trigger
              aria-label={layerRoleSelectAriaLabel(layer.name)}
              options={roleSelectOptions}
            />
            <Select.Content>
              {roleSelectOptions.map((option, index) => (
                <Select.Item index={index} key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Table.Cell>
      </tr>

      {hasUnassignedHint ? (
        <tr className="border-b border-border-default/50">
          <Table.Cell className="h-auto whitespace-normal pb-2 pt-0" colSpan={TABLE_COLUMN_COUNT}>
            <p className="text-[12px] leading-snug text-text-muted">
              {UNASSIGNED_LAYER_HINT}
              {HINT_SEPARATOR}
              {ENTITY_COUNT_COLUMN}:{' '}
              <span className="font-mono tabular-nums">{layer.entityCount}</span>
            </p>
          </Table.Cell>
        </tr>
      ) : null}
    </>
  );
}

export function CadLayerMappingPanel({ actions, model }: CadLayerMappingPanelProps) {
  const { onAssignRole, onHoverLayer } = actions;
  const { hoveredLayerId, layers, roleOptions } = model;

  const roleSelectOptions = useMemo(() => toSelectOptions(roleOptions), [roleOptions]);

  return (
    <section
      aria-labelledby={PANEL_TITLE_ID}
      className="flex w-[420px] shrink-0 flex-col gap-3 overflow-hidden"
    >
      <h2 className="text-[15px] font-semibold text-text-primary" id={PANEL_TITLE_ID}>
        {PHASE_2_PANEL_TITLE}
      </h2>

      <Table.Root className="rounded-[12px] border border-border-default">
        <Table.Header>
          <tr>
            <Table.Head>{LAYER_NAME_COLUMN}</Table.Head>
            <Table.Head className="text-right">{ENTITY_COUNT_COLUMN}</Table.Head>
            <Table.Head>{ORIGINAL_COLOR_COLUMN}</Table.Head>
            <Table.Head>{LAYER_ROLE_COLUMN}</Table.Head>
          </tr>
        </Table.Header>
        <Table.Body>
          {layers.length === 0 ? (
            <Table.Empty colSpan={TABLE_COLUMN_COUNT} />
          ) : (
            layers.map((layer) => (
              <CadLayerRow
                isHighlighted={hoveredLayerId === layer.id}
                key={layer.id}
                layer={layer}
                onAssignRole={onAssignRole}
                onHoverLayer={onHoverLayer}
                roleOptions={roleOptions}
                roleSelectOptions={roleSelectOptions}
              />
            ))
          )}
        </Table.Body>
      </Table.Root>
    </section>
  );
}
