/**
 * Panel trái — nằm trong cột việc (`QcStepColumn`, H1 ở đầu cột): bộ lọc, rồi MỘT hàng đợi tường
 * theo nhóm (demo Z/S-15): Không chuẩn → Đúng chuẩn → Đã duyệt.
 *
 * View THUẦN (R-60): chỉ đọc props. Đổi tầng nằm ở breadcrumb "Tầng ▾" của `QcFloorNav`; hai công
 * tắc lớp Tường / Tim tường ở popover Hiển thị trên bản vẽ (BC-19, K29).
 */

import { useMemo } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Checkbox } from '@/components/ui/Checkbox';
import type { CommandItem } from '@/hooks/useCommandPalette';
import { useScreenCommands } from '@/hooks/useScreenCommands';

import { QC_COMMAND_GROUP } from '../shared/qcLayout';
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
  /** Số hàng đợi của tường còn chờ, cùng thứ tự với thẻ hỏi và ghim số. */
  readonly queueNumbers?: ReadonlyMap<WallRowViewModel['id'], number> | undefined;
}

const FILTER_LABELS: Readonly<Record<WallLayerFilterKey, string>> = {
  onlyUnreviewed: 'Chỉ hiện chưa duyệt',
  onlyLowConfidence: 'Chỉ hiện chỗ máy chưa chắc',
  onlyNonStandardThickness: 'Chỉ hiện độ dày không chuẩn',
};
const COLUMN_CODE = 'Đoạn';
const COLUMN_LENGTH = 'Dài, mm';
const COLUMN_THICKNESS = 'Dày';

export function WallLayerLeftPanel({ panel, extras, queue, queueNumbers }: WallLayerLeftPanelProps) {
  const { filters, onToggleFilter } = panel;
  /* Mọi đoạn cùng độ tin cậy thì lọc theo nó không giúp gì: ẩn (vẫn hiện khi đang bật để tắt được). */
  const filterKeys: readonly WallLayerFilterKey[] = [
    'onlyUnreviewed',
    ...(queue?.showConfidence !== false || filters.onlyLowConfidence ? (['onlyLowConfidence'] as const) : []),
    'onlyNonStandardThickness',
  ];
  /* "Đưa N tường về chuẩn" mở màn Độ dày (UX-R2): chỉ khi có N > 0 đoạn đổi được. */
  const onOpenThickness = queue?.onOpenThickness;
  const canBulk = !panel.isViewerRole && (queue?.bulk.changeCount ?? 0) > 0 && onOpenThickness !== undefined;
  const bulkCount = queue?.bulk.changeCount ?? 0;
  const commands = useMemo<CommandItem[]>(
    () =>
      canBulk && onOpenThickness !== undefined
        ? [{ id: 'qc-walls-bulk-thickness', group: QC_COMMAND_GROUP, label: `Đưa ${bulkCount} đoạn về độ dày chuẩn…`, keywords: ['độ dày', 'chuẩn'], onSelect: onOpenThickness }]
        : [],
    [bulkCount, canBulk, onOpenThickness],
  );
  useScreenCommands(commands);

  return (
    /*
     * Dưới 1024 panel cao theo nội dung, vùng ngoài cuộn (BUG-395). Từ 1024 panel cao bằng bản
     * vẽ, chỉ danh sách cuộn bên trong (G4a-07). Con CUỐI luôn là vùng danh sách (BUG-621).
     */
    <div className="order-1 flex min-h-0 w-full flex-1 shrink-0 flex-col lg:order-0 lg:h-full lg:min-h-0 lg:w-full lg:overflow-hidden">

      <div className="flex shrink-0 flex-col gap-1 border-b border-border-default px-4 py-3">
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

      {/* Tiêu đề cột: số căn phải, đơn vị ở tiêu đề (demo Z/S-15 vòng 9). */}
      {panel.rows.length > 0 && panel.state !== 'loading' && (
        <div aria-hidden="true" className="flex shrink-0 items-center gap-2 px-5 pb-1 pt-3 text-caption text-text-secondary">
          {/* Khớp cột của hàng: mẫu 20 + khoảng 8 + mã 48; cột dài co giãn, cột dày 36 (K28). */}
          <span className="w-[4.75rem] shrink-0 pl-7">{COLUMN_CODE}</span>
          <span className="min-w-0 flex-1 text-right">{COLUMN_LENGTH}</span>
          {panel.scaleLock != null ? null : (
            <span className="w-9 shrink-0 text-right" title="Độ dày, mm">{COLUMN_THICKNESS}</span>
          )}
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
          onOpenBulk={canBulk ? onOpenThickness : undefined}
          onToggleSelect={extras.onToggleSelect}
          panel={panel}
          queue={queue}
          queueNumbers={queueNumbers}
        />
      </div>
    </div>
  );
}
