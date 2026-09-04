/**
 * Thanh trên của vỏ 3D: breadcrumb · chuyển 2D/3D · chọn góc nhìn.
 *
 * View thuần — không `src/api`, `src/store`, `src/domain`, `src/lib/http`
 * (R-60). Mọi dữ liệu và mọi hàm xử lý đến qua props.
 */

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';

import { ViewerBreadcrumb } from './ViewerChrome';

import type {
  ViewerBreadcrumbItem,
  ViewerPresetId,
  ViewerPresetViewModel,
} from './viewerShellTypes';

/** Nhãn của hai chế độ. Chữ hoa `2D`/`3D` là mã kỹ thuật, ngoại lệ A6 cho phép. */
const VIEW_MODE_OPTIONS = [
  { value: '2d' as const, label: '2D' },
  { value: '3d' as const, label: '3D' },
];

export interface ViewerTopBarProps {
  readonly breadcrumbs: readonly ViewerBreadcrumbItem[];
  readonly viewMode: '2d' | '3d';
  readonly onViewModeChange: (mode: '2d' | '3d') => void;
  readonly presets: readonly ViewerPresetViewModel[];
  readonly activePresetId: ViewerPresetId;
  readonly onPresetChange: (id: ViewerPresetId) => void;
  readonly isLoading: boolean;
}

export function ViewerTopBar({
  breadcrumbs,
  viewMode,
  onViewModeChange,
  presets,
  activePresetId,
  onPresetChange,
  isLoading,
}: ViewerTopBarProps) {
  const options = presets.map((preset) => ({ value: preset.id, label: preset.label }));
  const active = presets.find((preset) => preset.id === activePresetId);

  return (
    <header
      aria-label="Thanh trên khung nhìn"
      className="flex h-14 shrink-0 items-center gap-3 px-4"
    >
      <ViewerBreadcrumb items={breadcrumbs} />

      <div aria-hidden="true" className="flex-1" />

      <SegmentedControl
        aria-label="Chế độ xem"
        isLoading={isLoading}
        onChange={onViewModeChange}
        options={VIEW_MODE_OPTIONS}
        value={viewMode}
      />

      <Select.Root
        onChange={(value: string): void => {
          onPresetChange(value as ViewerPresetId);
        }}
        options={options}
        value={activePresetId}
      >
        <Select.Trigger
          aria-label="Góc nhìn sẵn"
          className="w-[168px]"
          options={options}
          placeholder={active?.label ?? 'Góc nhìn'}
        />
        <Select.Content>
          {options.map((option, index) => (
            <Select.Item index={index} key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </header>
  );
}
