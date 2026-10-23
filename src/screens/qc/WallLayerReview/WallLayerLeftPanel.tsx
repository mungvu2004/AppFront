/**
 * Panel trái (280px) — bộ đếm duyệt, cây lớp, bộ lọc và danh sách tường ảo hoá.
 *
 * View THUẦN (R-60): nhận nguyên `WallLayerViewProps` (đúng khuôn
 * `ScaleCalibrationPanel`) và chỉ hiển thị. Bộ đếm duyệt đứng NGOÀI vùng cuộn
 * (`overflow-y-auto` chỉ bọc `WallLayerList`) để luôn nhìn thấy — đúng yêu cầu
 * "12/48 tường đã duyệt ... Luôn nhìn thấy".
 *
 * Số chạy 12→13 dùng lớp bọc React của `useCountUp`
 * (`src/hooks/useCountUp.ts` — xem `docs/contracts/ui.md` mục D để phân biệt
 * với bản kỹ thuật thuần ở `src/lib/motion`). Câu "12/48 tường đã duyệt" đã
 * ghép sẵn ở hook (`reviewProgressLabel`, A15) — chuỗi đó làm `aria-label` cho
 * trình đọc màn hình LUÔN đúng, phần hiển thị trực quan tách số ra để chạy số
 * (các mảnh `aria-hidden`, tránh trình đọc màn hình đọc hai lần).
 *
 * {@link WallLayerOtherKind}/`onNavigateLayer` là phần MỞ RỘNG ngoài
 * `types.ts` (đóng băng): năm mục cây lớp là nội dung CỐ ĐỊNH (đúng năm khoá
 * của `i18n.fragment.json#layerTree`, không phải dữ liệu nghiệp vụ), nhưng
 * điều hướng sang bốn lớp còn lại cần một callback không có trong hợp đồng L1
 * — T8/hook truyền khi ghép màn; thiếu thì bốn mục đó chỉ hiển thị, không làm
 * gì khi bấm.
 */

import type { ReactNode } from 'react';
import { Eye, EyeOff, Layers, Square } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

import { WallLayerList } from './WallLayerList';
import type { WallLayerFilterKey, WallLayerViewProps, WallRowViewModel } from './types';

/** Bốn lớp khác ngoài "Tường" — đúng năm khoá của `i18n.fragment.json#layerTree`. */
export type WallLayerOtherKind = 'openingsAndFurniture' | 'dimensions' | 'axes' | 'rooms';

/** Một tầng trong khối điều hướng tầng (BC-05). Nhãn đã là tên tầng, không ghép ở view. */
export interface WallLayerFloorItem {
  readonly id: string;
  readonly label: string;
  readonly isCurrent: boolean;
}

/**
 * Những gì panel trái cần mà `WallLayerViewProps` (đóng băng ở L1) không mang.
 *
 * Cùng khuôn mở rộng mà `WallLayerToolRailProps` và `WallLayerStatusBarProps`
 * đã dùng: component con tự khai props của chính nó trong file của nó, thay vì
 * sửa `types.ts`. Hook dựng đủ bộ này và trả nó ra ở trường `leftPanel`.
 */
export interface WallLayerLeftPanelExtras {
  /** Mọi tầng của bản vẽ, để đổi tầng ngay trong panel (BC-05). */
  readonly floors: readonly WallLayerFloorItem[];
  /** Cờ hiện tim tường (BC-17) — người dùng đè lên được mặc định của công cụ. */
  readonly showCentrelines: boolean;
  readonly onToggleCentrelines: () => void;
  /** Cờ lớp Tường của cây lớp (BC-19); chú giải độ dày đi theo nó. */
  readonly isWallLayerVisible: boolean;
  readonly onToggleWallLayer: () => void;
  /** Hàng vừa đổi, nháy nền một nhịp rồi tắt (TT-02). `null` khi không có. */
  readonly flashingWallId: WallRowViewModel['id'] | null;
  /** Ctrl/Cmd-bấm một hàng: thêm/bớt khỏi vùng chọn (NL-07). */
  readonly onToggleSelect: (wallId: WallRowViewModel['id']) => void;
}

export interface WallLayerLeftPanelProps {
  readonly panel: WallLayerViewProps;
  readonly extras: WallLayerLeftPanelExtras;
  readonly onNavigateLayer?: ((layer: WallLayerOtherKind) => void) | undefined;
  /** Mở lớp tường của một tầng khác. Container tra `ROUTES.project.walls` (R-65). */
  readonly onNavigateFloor?: ((floorId: string) => void) | undefined;
}

const FILTER_LABELS: Readonly<Record<WallLayerFilterKey, string>> = {
  onlyUnreviewed: 'Chỉ hiện chưa duyệt',
  onlyLowConfidence: 'Chỉ hiện độ tin cậy thấp',
  onlyNonStandardThickness: 'Chỉ hiện độ dày không chuẩn',
};

const FILTER_KEYS: readonly WallLayerFilterKey[] = [
  'onlyUnreviewed',
  'onlyLowConfidence',
  'onlyNonStandardThickness',
];

const LAYER_TREE_ARIA_LABEL = 'Cây lớp';
const FLOOR_NAV_ARIA_LABEL = 'Tầng của bản vẽ';
const CENTRELINES_LABEL = 'Hiện tim tường';
const FILTER_GROUP_TITLE = 'Bộ lọc';
const SHOW_WALL_LAYER_LABEL = 'Hiện lớp tường';
const HIDE_WALL_LAYER_LABEL = 'Ẩn lớp tường';
const REVIEWED_SUFFIX = ' tường đã duyệt';
/** Cùng hành động với mục cây lớp "cửa và nội thất" — xem `onNavigateLayer`. */
const SUCCESS_CONTINUE_LABEL = 'Sang lớp cửa và nội thất';
const COLUMN_CODE = 'Mã';
const COLUMN_THICKNESS = 'Độ dày';
const COLUMN_CONFIDENCE = 'Độ tin cậy';
const COLUMN_STATUS = 'Trạng thái';

/**
 * Một hàng cây lớp — dựng tại chỗ thay vì gọi `TreeItem` dùng chung.
 *
 * `src/components/ui/TreeItem.tsx` gắn một nút con mắt bật/tắt lớp mang
 * `tabIndex={-1}` và `aria-label="Ẩn layer"`. Hai thứ đó làm hỏng hai bộ soát
 * bắt buộc của R-72 cùng lúc, và cả hai đều là lỗi thật chứ không phải chuyện
 * hình thức:
 *
 * - `tabIndex={-1}` → một nút bàn phím KHÔNG tới được, đúng thứ A12 tồn tại để
 *   chặn ("bàn phím là đường đi hạng nhất, không phải phương án dự phòng");
 * - `"Ẩn layer"` → chữ tiếng Anh trong nhãn người đọc, phạm A6/mục B.
 *
 * Màn này lại KHÔNG truyền `onToggleVisible`, nên nút đó còn không làm gì —
 * `src/components/**` nằm ngoài danh sách file được sửa (R-68), và sửa nó ở đây
 * cũng sai chỗ: bộ tên và hành vi của nó đang phục vụ những nơi gọi khác. Nên
 * màn dùng hàng của riêng nó: một `<button role="treeitem">` thật, bàn phím tới
 * được, nhãn tiếng Việt có dấu, không có nút phụ nào chết bên trong.
 *
 * Cờ hiện/ẩn lớp tường KHÔNG mất đi — nó sống ở cây lớp của kho
 * (`hiddenLayers`), và chú giải độ dày đọc thẳng cờ đó.
 */
function WallLayerTreeRow({
  icon,
  label,
  isCurrent = false,
  onOpen,
  visibility,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly isCurrent?: boolean;
  readonly onOpen?: (() => void) | undefined;
  /** Nút con mắt của riêng hàng này. Vắng mặt thì hàng không có nút nào. */
  readonly visibility?:
    | { readonly isVisible: boolean; readonly onToggle: () => void }
    | undefined;
}) {
  const row = (
    <button
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={label}
      aria-selected={isCurrent}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]',
        'transition-colors duration-120',
        'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        isCurrent
          ? 'bg-accent-wash text-accent'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
      )}
      onClick={onOpen}
      role="treeitem"
      type="button"
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );

  if (visibility === undefined) {
    return row;
  }

  /*
   * Nút con mắt đứng CẠNH hàng, không lồng trong nó: một `<button>` bên trong
   * một `<button>` không hợp lệ, và trình đọc màn hình sẽ chỉ thấy một trong
   * hai. Vỏ ngoài mang `role="none"` để cây lớp vẫn thấy `treeitem` là con của
   * nó. Khác hẳn nút con mắt của `TreeItem` dùng chung: nút này có
   * `tabIndex` mặc định (bàn phím tới được, A12) và nhãn tiếng Việt có dấu (A6).
   */
  return (
    <div className="flex items-center gap-1" role="none">
      <div className="min-w-0 flex-1">{row}</div>
      <button
        aria-label={visibility.isVisible ? HIDE_WALL_LAYER_LABEL : SHOW_WALL_LAYER_LABEL}
        aria-pressed={visibility.isVisible}
        className={cn(
          'shrink-0 rounded-lg p-1.5 text-text-secondary',
          'transition-colors duration-120 hover:bg-bg-hover hover:text-text-primary',
          'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
        onClick={visibility.onToggle}
        type="button"
      >
        {visibility.isVisible ? (
          <Eye aria-hidden="true" className="h-4 w-4" />
        ) : (
          <EyeOff aria-hidden="true" className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

/**
 * Khối điều hướng tầng — giữa bộ đếm duyệt và cây lớp (BC-05).
 *
 * Danh sách tầng đến từ chính đồ thị màn đang sửa (`levelsOf` ở hook), không
 * phải một lượt đọc máy chủ thứ hai. Lối ra đi qua `onNavigateFloor`, và
 * container tra `ROUTES.project.walls` — panel không ghép một đường dẫn nào.
 */
function WallLayerFloorNav({
  floors,
  onNavigateFloor,
}: {
  readonly floors: readonly WallLayerFloorItem[];
  readonly onNavigateFloor?: ((floorId: string) => void) | undefined;
}) {
  if (floors.length === 0) {
    return null;
  }

  return (
    /* Hai cột: bốn tầng chiếm hai dòng, nhường chỗ cho danh sách tường (G4a-06). */
    <nav aria-label={FLOOR_NAV_ARIA_LABEL} className="grid grid-cols-2 gap-0.5">
      {floors.map((floor) => (
        <button
          aria-current={floor.isCurrent ? 'page' : undefined}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]',
            'transition-colors duration-120',
            'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            floor.isCurrent
              ? 'bg-accent-wash text-accent'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
          )}
          key={floor.id}
          onClick={() => onNavigateFloor?.(floor.id)}
          type="button"
        >
          <Layers aria-hidden="true" className="h-4 w-4 shrink-0" />
          {/* Tên tầng dài bị cắt: tên đầy đủ ở `title` (BUG-639). */}
          <span className="truncate" title={floor.label}>
            {floor.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

/** Lớp đang mở. Sang lớp khác đi qua thanh lớp của `QcFloorNav` ở đầu màn (G4a-24): cây chỉ còn bật/tắt lớp Tường. */
const WALL_LAYER_LABEL = 'Tường';

export function WallLayerLeftPanel({
  panel,
  extras,
  onNavigateLayer,
  onNavigateFloor,
}: WallLayerLeftPanelProps) {
  const { reviewCounter, reviewProgressLabel, filters, onToggleFilter } = panel;
  // Phân số tiến độ: view được PHÉP tính tại chỗ (eslint-rules/no-raw-number.js:21).
  const progressFraction = reviewCounter.total === 0 ? 0 : reviewCounter.reviewed / reviewCounter.total;
  const { text: reviewedText } = useCountUp(reviewCounter.reviewed, { format: { fractionDigits: 0 } });
  /*
   * Xong thì bộ đếm ĐỔI HÌNH THỨC, không chỉ đứng ở 48/48 (BT-08).
   *
   * A5 vẫn nguyên: xanh "đã xác minh" ở đây chỉ xuất hiện vì `reviewed === total`
   * — tức việc của người duyệt — chứ không vì một điểm số nào của AI.
   */
  const isComplete = panel.state === 'success';

  return (
    /*
     * Dưới 1024 panel cao theo nội dung và vùng ngoài cuộn — không nén danh sách còn ~3 hàng (BUG-395).
     * Từ 1024 panel đứng cạnh bản vẽ, cao bằng nó, danh sách cuộn bên trong; chỉ thanh tra xuống
     * dòng dưới (G4a-07).
     */
    <div className="order-1 flex w-full shrink-0 flex-col rounded-xl bg-bg-surface shadow-panel lg:order-0 lg:h-[60vh] lg:min-h-80 lg:w-[280px] lg:overflow-hidden xl:h-full xl:min-h-0">
      <div className="flex shrink-0 flex-col gap-3 px-5 pb-2 pt-4">
        <div aria-label={reviewProgressLabel} className="flex flex-col gap-1.5" role="img">
          {/* Đang tải thì chưa có số: "0/0" trông như tầng không có tường (G4a-02). */}
          {panel.state === 'loading' ? (
            <Skeleton className="h-[18px] w-40" preset="block" />
          ) : (
          <p className="text-[13px] text-text-primary">
            <span
              aria-hidden="true"
              className={cn(
                'font-semibold tabular-nums',
                isComplete && 'text-state-verified',
              )}
            >
              {reviewedText}
            </span>
            <span aria-hidden="true" className="tabular-nums text-text-muted">
              /{reviewCounter.total}
            </span>
            <span aria-hidden="true" className="text-text-secondary">
              {REVIEWED_SUFFIX}
            </span>
          </p>
          )}
          <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-bg-sunken">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-340',
                isComplete ? 'bg-state-verified' : 'bg-accent',
              )}
              style={{ width: `${progressFraction * 100}%` }}
            />
          </div>
        </div>

        {panel.state === 'success' && (
          <Button fullWidth onClick={() => onNavigateLayer?.('openingsAndFurniture')} variant="primary">
            {SUCCESS_CONTINUE_LABEL}
          </Button>
        )}

        <WallLayerFloorNav floors={extras.floors} onNavigateFloor={onNavigateFloor} />

        <div aria-label={LAYER_TREE_ARIA_LABEL} role="tree">
          <WallLayerTreeRow
            icon={<Square className="h-4 w-4" />}
            isCurrent
            label={WALL_LAYER_LABEL}
            visibility={{
              isVisible: extras.isWallLayerVisible,
              onToggle: extras.onToggleWallLayer,
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          {/* Nhãn 13 px ngang cây lớp, và một tiêu đề cho nhóm lọc (BUG-614). */}
          <Checkbox
            checked={extras.showCentrelines}
            label={CENTRELINES_LABEL}
            onChange={extras.onToggleCentrelines}
            size="sm"
          />
          <p className="pt-2 text-[12px] text-text-muted">{FILTER_GROUP_TITLE}</p>
          {FILTER_KEYS.map((key) => (
            <Checkbox
              checked={filters[key]}
              key={key}
              label={FILTER_LABELS[key]}
              onChange={() => onToggleFilter(key)}
              size="sm"
            />
          ))}
        </div>
      </div>

      {/* Tiêu đề cột: "0,76" là độ tin cậy, không để người dùng đoán (G4a-06). */}
      {panel.rows.length > 0 && panel.state !== 'loading' && (
        <div
          aria-hidden="true"
          className="flex shrink-0 items-center gap-1 border-b border-border-default px-5 pb-1 text-[11px] text-text-muted"
        >
          <span className="w-12 shrink-0">{COLUMN_CODE}</span>
          <span className="w-[76px] shrink-0">{COLUMN_THICKNESS}</span>
          <span className="min-w-0 flex-1">{COLUMN_CONFIDENCE}</span>
          <span className="shrink-0">{COLUMN_STATUS}</span>
        </div>
      )}

      {/* px-3: chữ của hàng thẳng lề với tiêu đề và ô chọn ở trên (BUG-396). */}
      {/* Dưới 1024 vùng danh sách cao theo nội dung (không flex-1 cơ sở 0) — câu rỗng không bị viền thẻ cắt (BUG-621). */}
      <div className="overflow-y-auto px-3 pb-4 lg:min-h-0 lg:flex-1 lg:pb-2">
        {panel.state === 'error' && panel.errorMessage !== null && (
          <div className="px-3 pb-2 pt-1">
            <InlineAlert level="violation" message={panel.errorMessage} />
          </div>
        )}
        <WallLayerList
          flashingWallId={extras.flashingWallId}
          onToggleSelect={extras.onToggleSelect}
          panel={panel}
        />
      </div>
    </div>
  );
}
