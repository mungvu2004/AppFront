/**
 * Thanh công cụ nổi của màn Đối chiếu bản vẽ — viên thuốc bo `rounded-xl` (12),
 * cao `h-10` (40) khi một hàng, tự xếp hai hàng ở `isStacked` (trạng thái
 * `collapsed`).
 *
 * VIEW THUẦN (R-60): mọi thứ vào bằng `OverlayComparisonToolbarProps`
 * (`types.ts`, đóng băng), không `@/api`, không `@/store`, không `@/domain`
 * (trừ `import type`), không `@/lib/http`. Không con số nào bị định dạng lại
 * ở đây — `modelOpacityText` đã ghép sẵn (A15); phần CSS duy nhất của view là
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

const TOOLBAR_LABEL = 'Thanh công cụ đối chiếu bản vẽ';
const FLOOR_SELECT_LABEL = 'Chọn tầng';
const FLOOR_NO_SCAN_SUFFIX = 'Không có ảnh bản vẽ gốc';
const COMPARE_MODE_ARIA_LABEL = 'Kiểu đối chiếu';
const MODEL_OPACITY_ARIA_LABEL = 'Độ đậm lớp mô hình';
const ALIGNMENT_LOCK_LABEL = 'Khoá căn';

/**
 * Viên thuốc chứa bốn cụm — dùng chung cho cả hai cách xếp (một hàng/hai hàng).
 * `flex-wrap`: khung hẹp thì cụm xuống dòng thay vì tràn ra ngoài khung (BUG-318).
 */
const CLUSTER_ROW_CLASS = 'flex flex-wrap items-center justify-center gap-3';

function floorOptionsOf(floors: OverlayComparisonToolbarProps['floors']): SelectOption[] {
  return floors.map((floor) => ({
    value: floor.levelId,
    label: floor.hasScan ? floor.label : `${floor.label} — ${FLOOR_NO_SCAN_SUFFIX}`,
  }));
}

interface FloorSelectProps {
  readonly floors: OverlayComparisonToolbarProps['floors'];
  readonly activeFloorId: OverlayComparisonToolbarProps['activeFloorId'];
  readonly onSelectFloor: OverlayComparisonToolbarProps['onSelectFloor'];
}

function FloorSelect({ floors, activeFloorId, onSelectFloor }: FloorSelectProps) {
  const options = floorOptionsOf(floors);

  return (
    <Select.Root
      // Gọn như demo S-28 ("Tầng 1 ▾"): canvas giữa hai panel còn ~880 px ở 1440.
      className="w-[200px] max-w-full shrink-0"
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
  readonly onSetCompareMode: OverlayComparisonToolbarProps['onSetCompareMode'];
}

function CompareModeCluster({
  compareMode,
  disabledCompareModes,
  onSetCompareMode,
}: CompareModeClusterProps) {
  const options: SegmentedControlOption<CompareModeId>[] = COMPARE_MODE_IDS.map((mode) => ({
    value: mode,
    label: COMPARE_MODE_LABELS[mode],
    disabled: disabledCompareModes[mode] !== undefined,
  }));

  return (
    <SegmentedControl
      aria-label={COMPARE_MODE_ARIA_LABEL}
      // Nhãn hai chữ ("Chồng lớp", "Cạnh nhau") không xuống dòng khi thanh hẹp (ảnh 1024 vòng 6).
      className="[&_button]:whitespace-nowrap"
      onChange={onSetCompareMode}
      options={options}
      value={compareMode}
    />
  );
}

/** Lý do kiểu bị tắt: một dòng riêng cuối thanh, không kéo cụm kiểu thành ba hàng chữ. */
function DisabledModeCaptions({ disabledCompareModes }: Pick<CompareModeClusterProps, 'disabledCompareModes'>) {
  const disabledModes = COMPARE_MODE_IDS.filter((mode) => disabledCompareModes[mode] !== undefined);
  return disabledModes.map((mode) => (
    <p className="w-full text-center text-[12px] leading-4 text-text-secondary" key={mode}>
      {COMPARE_MODE_LABELS[mode]} — {disabledCompareModes[mode]}
    </p>
  ));
}

interface ModelOpacityClusterProps {
  readonly modelOpacityPercent: number;
  readonly modelOpacityText: string;
  readonly onSetModelOpacity: OverlayComparisonToolbarProps['onSetModelOpacity'];
}

function ModelOpacityCluster({
  modelOpacityPercent,
  modelOpacityText,
  onSetModelOpacity,
}: ModelOpacityClusterProps) {
  return (
    <div className="flex w-44 shrink-0 items-center gap-2">
      <Slider
        aria-label={MODEL_OPACITY_ARIA_LABEL}
        max={100}
        min={0}
        onChange={onSetModelOpacity}
        value={modelOpacityPercent}
      />
      <span className="w-10 shrink-0 text-right text-[13px] tabular-nums text-text-secondary">
        {modelOpacityText}
      </span>
    </div>
  );
}

export function OverlayComparisonToolbar({
  floors,
  activeFloorId,
  compareMode,
  disabledCompareModes,
  modelOpacityPercent,
  modelOpacityText,
  isAlignmentLocked,
  canLockAlignment = false,
  isStacked,
  canEdit,
  onSelectFloor,
  onSetCompareMode,
  onSetModelOpacity,
  onToggleAlignmentLock,
}: OverlayComparisonToolbarProps) {
  return (
    <div
      aria-label={TOOLBAR_LABEL}
      className={cn(
        'pointer-events-auto flex max-w-full items-center gap-3 rounded-xl bg-bg-surface px-3 shadow-float',
        // Không ép cao 40: chú thích kiểu bị tắt nằm TRONG thanh, không tràn đè xuống (BUG-318, BUG-327).
        isStacked ? 'flex-col items-stretch gap-2 py-2' : 'min-h-10 flex-wrap justify-center py-1',
      )}
      role="toolbar"
    >
      <div className={CLUSTER_ROW_CLASS}>
        {/* G4b-28: một tầng thì không có gì để chọn; breadcrumb QcFloorNav đã ghi tầng đang xem. */}
        {floors.length > 1 && (
          <FloorSelect
            activeFloorId={activeFloorId}
            floors={floors}
            onSelectFloor={onSelectFloor}
          />
        )}
        <CompareModeCluster
          compareMode={compareMode}
          disabledCompareModes={disabledCompareModes}
          onSetCompareMode={onSetCompareMode}
        />
      </div>

      <div className={CLUSTER_ROW_CLASS}>
        {/* G4b-26: độ mờ chỉ có nghĩa khi xem chồng; "trượt"/"cạnh nhau" luôn hiện đủ ảnh. */}
        {compareMode === 'overlay' && (
          <ModelOpacityCluster
            onSetModelOpacity={onSetModelOpacity}
            modelOpacityPercent={modelOpacityPercent}
            modelOpacityText={modelOpacityText}
          />
        )}
        {/* Ẩn tới khi đặt được ảnh vào mô hình: bật/tắt mà không đổi gì là điều khiển chết (BUG-599). */}
        {canLockAlignment && (
          <div className="shrink-0 whitespace-nowrap">
            <Toggle
              checked={isAlignmentLocked}
              disabled={!canEdit}
              label={ALIGNMENT_LOCK_LABEL}
              onChange={() => {
                onToggleAlignmentLock();
              }}
            />
          </div>
        )}
      </div>

      <DisabledModeCaptions disabledCompareModes={disabledCompareModes} />

      {/* Vai người xem: lý do đã ở băng cảnh báo của màn — thanh công cụ không lặp câu thứ hai (BUG-636). */}
    </div>
  );
}
