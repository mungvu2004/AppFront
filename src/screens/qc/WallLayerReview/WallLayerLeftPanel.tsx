/**
 * Panel trái (280) — đầu panel trả lời câu 1 + 2 (QcPanelHead), rồi lớp/lọc, rồi MỘT hàng đợi
 * tường theo nhóm (demo Z/S-15): Không chuẩn → Đúng chuẩn → Đã duyệt.
 *
 * View THUẦN (R-60): chỉ đọc props. Câu số ("12/48 tường đã duyệt") đã ghép ở hook (A15).
 * Đổi tầng nằm ở breadcrumb "Tầng ▾" của `QcFloorNav`, không lặp trong panel. Lớp khác ở thanh
 * lớp của `QcFloorNav`; cây lớp ở đây chỉ còn bật/tắt lớp Tường (BC-19).
 */

import { useState } from 'react';
import { Check, Eye, EyeOff, Square } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/lib/utils';

import { QcPanelHead } from '../shared/QcPanelHead';
import { WallLayerBulkPreview } from './WallLayerBulkPreview';
import { WallLayerList } from './WallLayerList';
import type { WallLayerFilterKey, WallLayerViewProps, WallRowViewModel } from './types';
import type { WallReviewQueue } from './wallReviewQueue';

/** Bốn lớp khác ngoài "Tường" — đúng năm khoá của `i18n.fragment.json#layerTree`. */
export type WallLayerOtherKind = 'openingsAndFurniture' | 'dimensions' | 'axes' | 'rooms';

/** Một tầng (BC-05). Nhãn đã là tên tầng. Đổi tầng qua breadcrumb của `QcFloorNav`. */
export interface WallLayerFloorItem {
  readonly id: string;
  readonly label: string;
  readonly isCurrent: boolean;
}

/** Những gì panel trái cần mà `WallLayerViewProps` (đóng băng ở L1) không mang. */
export interface WallLayerLeftPanelExtras {
  /** Mọi tầng của bản vẽ — `QcFloorNav` dùng cho "Tầng ▾" (BC-05). */
  readonly floors: readonly WallLayerFloorItem[];
  /** Cờ hiện tim tường (BC-17). */
  readonly showCentrelines: boolean;
  readonly onToggleCentrelines: () => void;
  /** Cờ lớp Tường của cây lớp (BC-19); chú giải độ dày đi theo nó. */
  readonly isWallLayerVisible: boolean;
  readonly onToggleWallLayer: () => void;
  /** Hàng vừa đổi, nháy nền một nhịp (TT-02). */
  readonly flashingWallId: WallRowViewModel['id'] | null;
  /** Ctrl/Cmd-bấm một hàng: thêm/bớt khỏi vùng chọn (NL-07). */
  readonly onToggleSelect: (wallId: WallRowViewModel['id']) => void;
}

export interface WallLayerLeftPanelProps {
  readonly panel: WallLayerViewProps;
  readonly extras: WallLayerLeftPanelExtras;
  readonly queue?: WallReviewQueue | undefined;
  /** Trạng thái lưu đã định dạng ("Đã lưu lúc 14:02") — câu 2 nói luôn đã lưu chưa. */
  readonly saveLabel?: string | undefined;
  readonly saveFailed?: boolean | undefined;
}

const TITLE = 'Duyệt tường';
const TITLE_HINT = 'Duyệt tường AI tìm thấy ở tầng này';
const DONE_LABEL = 'Xong';
const TODO_LABEL = 'Chưa xong';
const ERROR_LABEL = 'Không tải được';
const SAVED_PREFIX = 'Đã lưu';
const LAYER_TREE_ARIA_LABEL = 'Cây lớp';
const WALL_LAYER_LABEL = 'Tường';
const CENTRELINES_LABEL = 'Hiện tim tường';
const SHOW_WALL_LAYER_LABEL = 'Hiện lớp tường';
const HIDE_WALL_LAYER_LABEL = 'Ẩn lớp tường';
const FILTER_LABELS: Readonly<Record<WallLayerFilterKey, string>> = {
  onlyUnreviewed: 'Chỉ hiện chưa duyệt',
  onlyLowConfidence: 'Chỉ hiện chỗ máy chưa chắc',
  onlyNonStandardThickness: 'Chỉ hiện độ dày không chuẩn',
};
const COLUMN_CODE = 'Đoạn';
const COLUMN_LENGTH = 'Dài, mm';
const COLUMN_THICKNESS = 'Dày, mm';

const FOCUS_RING = 'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Câu 2: Badge + câu có số + đã lưu. */
function PanelStatus({ panel, queue, saveLabel, saveFailed }: Omit<WallLayerLeftPanelProps, 'extras'>) {
  if (panel.state === 'loading') {
    return <Skeleton className="h-[18px] w-40" preset="block" />;
  }

  if (panel.state === 'error') {
    return <Badge variant="violation">{ERROR_LABEL}</Badge>;
  }

  const { reviewed, total } = panel.reviewCounter;
  const isDone = total > 0 && reviewed === total;
  const nonStandard = queue?.nonStandardCount ?? 0;

  return (
    <>
      {/* Huy hiệu + số không chuẩn chung một dòng, câu tiến độ một dòng riêng: không gãy giữa câu ở panel 264. */}
      <Badge variant={isDone ? 'verified' : 'attention'}>{isDone ? DONE_LABEL : TODO_LABEL}</Badge>
      {nonStandard > 0 ? (
        <span className="whitespace-nowrap text-body-sm tabular-nums text-state-attention-text">{`${nonStandard} không chuẩn`}</span>
      ) : null}
      <p className="w-full whitespace-nowrap text-body-sm tabular-nums text-text-primary">{panel.reviewProgressLabel}</p>
      {saveLabel === undefined ? null : (
        <p className={cn('flex items-center gap-1 text-caption', saveFailed === true ? 'text-state-violation-text' : 'text-text-secondary')}>
          {saveFailed !== true && saveLabel.startsWith(SAVED_PREFIX) ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : null}
          {saveLabel}
        </p>
      )}
    </>
  );
}

/** Cây lớp còn một hàng "Tường" + nút con mắt đứng CẠNH hàng (không lồng nút trong nút). */
function WallLayerTreeRow({ isVisible, onToggle }: { readonly isVisible: boolean; readonly onToggle: () => void }) {
  return (
    <div aria-label={LAYER_TREE_ARIA_LABEL} role="tree">
      <div className="flex items-center gap-1" role="none">
        <button
          aria-current="page"
          aria-label={WALL_LAYER_LABEL}
          aria-selected
          className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-accent-wash px-2 py-1.5 text-left text-[13px] text-accent', FOCUS_RING)}
          role="treeitem"
          type="button"
        >
          <Square aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="truncate">{SHOW_WALL_LAYER_LABEL}</span>
        </button>
        <button
          aria-label={isVisible ? HIDE_WALL_LAYER_LABEL : SHOW_WALL_LAYER_LABEL}
          aria-pressed={isVisible}
          className={cn('shrink-0 rounded-lg p-1.5 text-text-secondary transition-colors duration-120 hover:bg-bg-hover hover:text-text-primary', FOCUS_RING)}
          onClick={onToggle}
          type="button"
        >
          {isVisible ? <Eye aria-hidden="true" className="h-4 w-4" /> : <EyeOff aria-hidden="true" className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function WallLayerLeftPanel({ panel, extras, queue, saveLabel, saveFailed }: WallLayerLeftPanelProps) {
  const { filters, onToggleFilter } = panel;
  const [isBulkOpen, setBulkOpen] = useState(false);
  /* Mọi đoạn cùng độ tin cậy thì lọc theo nó không giúp gì: ẩn (vẫn hiện khi đang bật để tắt được). */
  const filterKeys: readonly WallLayerFilterKey[] = [
    'onlyUnreviewed',
    ...(queue?.showConfidence !== false || filters.onlyLowConfidence ? (['onlyLowConfidence'] as const) : []),
    'onlyNonStandardThickness',
  ];
  const canBulk = !panel.isViewerRole && (queue?.bulk.changeCount ?? 0) > 0;

  return (
    /*
     * Dưới 1024 panel cao theo nội dung, vùng ngoài cuộn (BUG-395). Từ 1024 panel cao bằng bản
     * vẽ, chỉ danh sách cuộn bên trong (G4a-07). Con CUỐI luôn là vùng danh sách (BUG-621).
     */
    <div className="order-1 flex w-full shrink-0 flex-col rounded-xl bg-bg-surface shadow-panel lg:order-0 lg:h-full lg:min-h-0 lg:w-full lg:overflow-hidden">
      <QcPanelHead
        eyebrow={null}
        status={<PanelStatus panel={panel} queue={queue} saveFailed={saveFailed} saveLabel={saveLabel} />}
        title={<span title={TITLE_HINT}>{TITLE}</span>}
      />

      <div className="flex shrink-0 flex-col gap-1 border-b border-border-default px-4 py-3">
        {/* Hàng lớp riêng một dòng (tên lớp không bị cắt); tim tường đứng cùng nhịp với các ô lọc. */}
        <WallLayerTreeRow isVisible={extras.isWallLayerVisible} onToggle={extras.onToggleWallLayer} />
        <Checkbox
          aria-label={CENTRELINES_LABEL}
          checked={extras.showCentrelines}
          label={CENTRELINES_LABEL}
          onChange={extras.onToggleCentrelines}
          size="sm"
        />
        {filterKeys.map((key) => (
          <Checkbox
            aria-label={FILTER_LABELS[key]}
            checked={filters[key]}
            key={key}
            label={FILTER_LABELS[key]}
            onChange={() => onToggleFilter(key)}
            size="sm"
          />
        ))}
      </div>

      {isBulkOpen && queue !== undefined && canBulk ? (
        <WallLayerBulkPreview
          bulk={queue.bulk}
          onApply={() => {
            queue.onBulkStandardize();
            setBulkOpen(false);
          }}
          onClose={() => setBulkOpen(false)}
        />
      ) : null}

      {/* Tiêu đề cột: số căn phải, đơn vị ở tiêu đề (demo Z/S-15 vòng 9). */}
      {panel.rows.length > 0 && panel.state !== 'loading' && (
        <div aria-hidden="true" className="flex shrink-0 items-center gap-2 px-5 pb-1 pt-3 text-caption text-text-secondary">
          <span className="min-w-0 flex-1 pl-5">{COLUMN_CODE}</span>
          <span className="w-12 shrink-0 text-right">{COLUMN_LENGTH}</span>
          <span className="w-14 shrink-0 text-right">{COLUMN_THICKNESS}</span>
        </div>
      )}

      {/* Dưới 1024 vùng danh sách cao theo nội dung (BUG-621); từ 1024 nó cuộn bên trong. */}
      <div className="overflow-y-auto px-3 pb-4 lg:min-h-0 lg:flex-1 lg:pb-2">
        {panel.state === 'error' && panel.errorMessage !== null && (
          <div className="px-2 pb-2 pt-1">
            <InlineAlert level="violation" message={panel.errorMessage} />
          </div>
        )}
        <WallLayerList
          flashingWallId={extras.flashingWallId}
          onOpenBulk={canBulk ? () => setBulkOpen(true) : undefined}
          onToggleSelect={extras.onToggleSelect}
          panel={panel}
          queue={queue}
        />
      </div>
    </div>
  );
}
