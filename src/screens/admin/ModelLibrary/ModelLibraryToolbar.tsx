/**
 * Thanh công cụ đầu bảng: ô tìm, bộ lọc danh mục, chuyển đổi bảng/lưới.
 *
 * KHÔNG có nút "Tải lên model" — `model.capabilities.canUploadModel` bằng `false` trong
 * bản này (không có đường tải `.glb` lên ở bất kỳ tầng nào, xem docblock `types.ts`), và
 * theo R-69 affordance thiếu năng lực phải RỜI KHỎI DOM, không ẩn bằng `disabled`.
 *
 * `Select` và `Input` đều tự mang `label` thật (không phải `FieldRow`), nên cả hai tự đạt
 * `expectAccessible` mà không cần thêm `aria-label` (xem `contract-ui.md` mục 1.4, 1.5).
 */
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';

import type { LibraryFilterId, ModelLibraryActions, ModelLibraryModel, ModelLibraryViewMode } from './types';

const SEARCH_LABEL = 'tìm model';
const SEARCH_PLACEHOLDER = 'Tìm theo tên model...';
const CATEGORY_LABEL = 'danh mục';
const VIEW_MODE_LABEL = 'chế độ xem';

const VIEW_MODE_OPTIONS: readonly SegmentedControlOption<ModelLibraryViewMode>[] = [
  { label: 'Bảng', value: 'table' },
  { label: 'Lưới', value: 'grid' },
];

const filterOptionLabel = (label: string, count: number): string => `${label} (${count})`;

export interface ModelLibraryToolbarProps {
  readonly model: ModelLibraryModel;
  readonly actions: ModelLibraryActions;
}

export function ModelLibraryToolbar({ model, actions }: ModelLibraryToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Input
        className="w-[240px]"
        label={SEARCH_LABEL}
        onChange={(event) => actions.setSearchText(event.target.value)}
        placeholder={SEARCH_PLACEHOLDER}
        value={model.searchText}
      />

      <Select
        className="w-[220px]"
        label={CATEGORY_LABEL}
        onChange={(value) => actions.setFilter(value as LibraryFilterId)}
        options={model.filterOptions.map((option) => ({
          label: filterOptionLabel(option.label, option.count),
          value: option.id,
        }))}
        value={model.filterId}
      />

      <SegmentedControl
        aria-label={VIEW_MODE_LABEL}
        onChange={actions.setViewMode}
        options={[...VIEW_MODE_OPTIONS]}
        value={model.viewMode}
      />
    </div>
  );
}
