/**
 * Thanh công cụ nổi của màn Đối chiếu bản vẽ — viên thuốc bo `rounded-xl` (12),
 * cao `h-10` (40) khi một hàng, tự xếp hai hàng ở `isStacked` (trạng thái
 * `collapsed`).
 *
 * VIEW THUẦN (R-60): mọi thứ vào bằng `OverlayComparisonToolbarProps`
 * (`types.ts`, đóng băng), không `@/api`, không `@/store`, không `@/domain`
 * (trừ `import type`), không `@/lib/http`. Không con số nào bị định dạng lại
 * ở đây — `scanOpacityText` đã ghép sẵn (A15); phần CSS duy nhất của view là
 * `tabular-nums` cho chữ đều, đúng yêu cầu của đặc tả.
 *
 * ## Vì sao thanh không tự đặt `position: absolute`
 *
 * "Nổi trên cùng giữa" là một quyết định bố cục của `OverlayComparison.tsx`
 * (worker khác), đúng khuôn `WallGeometryEditorToolbar.tsx` +
 * `WallGeometryEditor.tsx:122-123`: view toolbar chỉ là viên thuốc
 * `pointer-events-auto`, còn khung `pointer-events-none absolute inset-x-0 …`
 * đặt nó vào đúng chỗ nằm ở màn cha. Tự định vị ở đây sẽ đặt cược vào một bố
 * cục cha mà file này không kiểm soát được.
 *
 * ## Vì sao tên tầng không có ảnh gốc lại đổi luôn chữ hiển thị
 *
 * `Select` (`src/components/ui/Select.tsx`) chỉ đọc `option.label` — một chuỗi
 * — cho cả ô đóng lẫn từng dòng trong danh sách; không có chỗ nào cho một ghi
 * chú ẩn kèm theo. Nối thẳng `FLOOR_NO_SCAN_SUFFIX` vào label là cách duy nhất
 * để trình đọc màn hình nghe được tình trạng "không có ảnh gốc" dù tầng đó
 * đang đứng ở ô đóng hay đang nằm trong danh sách mở — không cần dựng lại
 * `Select` (R-68 cấm sửa `src/components`).
 *
 * ## Vì sao `Select.Label` là `sr-only`
 *
 * Nhãn hiện của `Select` (`SelectLabel`) chiếm một dòng phía trên ô — thêm nó
 * sẽ đẩy thanh công cụ cao hơn 40. Dùng bộ ghép `Select.Root/Label/Trigger`
 * thay vì API cũ để đặt `Select.Label` ở dạng `sr-only`: tên "chọn tầng" vẫn
 * tới được trình đọc màn hình qua `htmlFor`/`id` mà không chiếm chỗ hiển thị.
 *
 * ## Vì sao lý do tắt kiểu đối chiếu là một dòng `<p>`, không phải `title`
 *
 * Đặc tả: "Caption phải đọc được bằng trình đọc màn hình, không chỉ là title".
 * `SegmentedControlOption` không có chỗ gắn `aria-describedby` cho từng nút
 * (R-68 cấm sửa `SegmentedControl`), nên lý do được in thành văn bản thấy được
 * ngay dưới thanh, đặt tên kiểu ở đầu câu để rõ lý do đó nói về kiểu nào.
 */

import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/lib/utils';

import type { LevelId } from '@/domain/spatial/types';

import { COMPARE_MODE_IDS, COMPARE_MODE_LABELS } from './types';
import type { CompareModeId, OverlayComparisonToolbarProps } from './types';

const TOOLBAR_LABEL = 'thanh công cụ đối chiếu bản vẽ';
const FLOOR_SELECT_LABEL = 'chọn tầng';
const FLOOR_NO_SCAN_SUFFIX = 'không có ảnh bản vẽ gốc';
const COMPARE_MODE_ARIA_LABEL = 'kiểu đối chiếu';
const SCAN_OPACITY_ARIA_LABEL = 'độ mờ ảnh nguồn';
const ALIGNMENT_LOCK_LABEL = 'khoá căn';
const READ_ONLY_NOTICE = 'bạn không có quyền sửa, các điều khiển đang tắt.';

/** Viên thuốc chứa bốn cụm — dùng chung cho cả hai cách xếp (một hàng/hai hàng). */
const CLUSTER_ROW_CLASS = 'flex items-center gap-3';

function floorOptionsOf(floors: OverlayComparisonToolbarProps['floors']): SelectOption[] {
  return floors.map((floor) => ({
    value: floor.levelId,
    label: floor.hasScan ? floor.label : `${floor.label} — ${FLOOR_NO_SCAN_SUFFIX}`,
  }));
}

interface FloorSelectProps {
  readonly floors: OverlayComparisonToolbarProps['floors'];
  readonly activeFloorId: OverlayComparisonToolbarProps['activeFloorId'];
  readonly canEdit: boolean;
  readonly onSelectFloor: OverlayComparisonToolbarProps['onSelectFloor'];
}

function FloorSelect({ floors, activeFloorId, canEdit, onSelectFloor }: FloorSelectProps) {
  const options = floorOptionsOf(floors);

  return (
    <Select.Root
      className="w-[176px] shrink-0"
      disabled={!canEdit}
      onChange={(value) => onSelectFloor(value as LevelId)}
      options={options}
      value={activeFloorId ?? undefined}
    >
      <Select.Label className="sr-only">{FLOOR_SELECT_LABEL}</Select.Label>
      <Select.Trigger options={options} />
      <Select.Content>
        {options.length === 0 ? (
          <Select.Empty />
        ) : (
          options.map((option, index) => (
            <Select.Item index={index} key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))
        )}
      </Select.Content>
    </Select.Root>
  );
}

interface CompareModeClusterProps {
  readonly compareMode: CompareModeId;
  readonly disabledCompareModes: OverlayComparisonToolbarProps['disabledCompareModes'];
  readonly canEdit: boolean;
  readonly onSetCompareMode: OverlayComparisonToolbarProps['onSetCompareMode'];
}

function CompareModeCluster({
  compareMode,
  disabledCompareModes,
  canEdit,
  onSetCompareMode,
}: CompareModeClusterProps) {
  const options: SegmentedControlOption<CompareModeId>[] = COMPARE_MODE_IDS.map((mode) => ({
    value: mode,
    label: COMPARE_MODE_LABELS[mode],
    disabled: disabledCompareModes[mode] !== undefined,
  }));

  const disabledModes = COMPARE_MODE_IDS.filter((mode) => disabledCompareModes[mode] !== undefined);

  return (
    <div className="flex flex-col gap-1">
      <SegmentedControl
        aria-label={COMPARE_MODE_ARIA_LABEL}
        disabled={!canEdit}
        onChange={onSetCompareMode}
        options={options}
        value={compareMode}
      />
      {disabledModes.map((mode) => (
        <p className="max-w-[220px] text-[12px] leading-[16px] text-text-muted" key={mode}>
          {COMPARE_MODE_LABELS[mode]} — {disabledCompareModes[mode]}
        </p>
      ))}
    </div>
  );
}

interface ScanOpacityClusterProps {
  readonly scanOpacityPercent: number;
  readonly scanOpacityText: string;
  readonly canEdit: boolean;
  readonly onSetScanOpacity: OverlayComparisonToolbarProps['onSetScanOpacity'];
}

function ScanOpacityCluster({
  scanOpacityPercent,
  scanOpacityText,
  canEdit,
  onSetScanOpacity,
}: ScanOpacityClusterProps) {
  return (
    <div className="flex w-[176px] shrink-0 items-center gap-2">
      <Slider
        aria-label={SCAN_OPACITY_ARIA_LABEL}
        disabled={!canEdit}
        max={100}
        min={0}
        onChange={onSetScanOpacity}
        value={scanOpacityPercent}
      />
      <span className="w-10 shrink-0 text-right text-[13px] tabular-nums text-text-secondary">
        {scanOpacityText}
      </span>
    </div>
  );
}

export function OverlayComparisonToolbar({
  floors,
  activeFloorId,
  compareMode,
  disabledCompareModes,
  scanOpacityPercent,
  scanOpacityText,
  isAlignmentLocked,
  isStacked,
  canEdit,
  onSelectFloor,
  onSetCompareMode,
  onSetScanOpacity,
  onToggleAlignmentLock,
}: OverlayComparisonToolbarProps) {
  return (
    <div
      aria-label={TOOLBAR_LABEL}
      className={cn(
        'pointer-events-auto inline-flex items-center gap-3 rounded-xl bg-bg-surface px-3 shadow-float',
        isStacked ? 'flex-col items-stretch gap-2 py-2' : 'h-10',
      )}
      role="toolbar"
    >
      <div className={CLUSTER_ROW_CLASS}>
        <FloorSelect
          activeFloorId={activeFloorId}
          canEdit={canEdit}
          floors={floors}
          onSelectFloor={onSelectFloor}
        />
        <CompareModeCluster
          canEdit={canEdit}
          compareMode={compareMode}
          disabledCompareModes={disabledCompareModes}
          onSetCompareMode={onSetCompareMode}
        />
      </div>

      <div className={CLUSTER_ROW_CLASS}>
        <ScanOpacityCluster
          canEdit={canEdit}
          onSetScanOpacity={onSetScanOpacity}
          scanOpacityPercent={scanOpacityPercent}
          scanOpacityText={scanOpacityText}
        />
        <Toggle
          checked={isAlignmentLocked}
          disabled={!canEdit}
          label={ALIGNMENT_LOCK_LABEL}
          onChange={() => {
            onToggleAlignmentLock();
          }}
        />
      </div>

      {!canEdit && <p className="text-[12px] leading-[16px] text-text-muted">{READ_ONLY_NOTICE}</p>}
    </div>
  );
}
