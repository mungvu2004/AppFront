/**
 * Panel trái của màn Duyệt tên phòng, nằm trong cột việc `QcStepColumn` (demo Z/S-20): hàng lọc +
 * "Chuẩn hoá tên…", rồi vùng cuộn gồm danh sách phòng (lên đầu, K23) và một dòng "N chỗ tường chưa
 * khép kín" bấm để mở nhóm "Vòng tường hở".
 *
 * View THUẦN (R-60): nhận đúng {@link RoomLabelLeftPanelProps} và {@link RoomLabelListProps}
 * rồi chỉ hiển thị. Tổng diện tích sàn đã nằm ở dòng trạng thái đầu panel, không lặp ở đây.
 *
 * ## Vòng tường hở luôn kèm một bước đi tiếp cụ thể (CẤM TUYỆT ĐỐI)
 *
 * Mỗi vòng hở hiện khe hở đã định dạng, cặp tường, và link "Nối" sang lớp tường chọn sẵn
 * tường đầu (`?wall=`, G4a-39). Vòng hở là CẢNH BÁO, không chặn cổng sang bước sau.
 */

import { ChevronDown, ChevronRight, Unlink } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { RoomId, WallId } from '@/domain/spatial/types';
import type { CommandItem } from '@/hooks/useCommandPalette';
import { useScreenCommands } from '@/hooks/useScreenCommands';
import { cn } from '@/lib/utils';

import { QC_COMMAND_GROUP } from '../shared/qcLayout';

import { RoomLabelList } from './RoomLabelList';
import type { RoomLabelGapViewModel, RoomLabelLeftPanelProps, RoomLabelListProps } from './roomLabelTypes';

export interface RoomLabelLeftPanelViewProps {
  readonly panel: RoomLabelLeftPanelProps;
  readonly list: RoomLabelListProps;
  /** Câu rỗng khi bộ lọc "Chưa đặt tên" lọc sạch danh sách (BUG-321); `null` thì vẽ danh sách. */
  readonly emptyListNotice: string | null;
  /** Cờ phòng chiếm >80 % sàn, đã ghép câu ở hook. */
  readonly oversizedRoom?: { readonly id: RoomId; readonly text: string } | null;
}

const UNNAMED_FILTER_LABEL = 'Chưa đặt tên';
const GAPS_TITLE = 'Vòng tường hở';
const GAPS_HINT = 'Bấm một khe để tới chỗ đó ở lớp tường và nối lại.';
const gapsHeadline = (gaps: number, rooms: number): string =>
  `${gaps} chỗ tường chưa khép kín nên máy chỉ tìm được ${rooms} phòng`;
const GAPS_EMPTY_MESSAGE = 'Chưa thấy vòng tường hở nào ở tầng này.';
/** BUG-407: không có khe giữa hai đầu tường, nhưng có phòng chưa kín — nói rõ phạm vi. */
const gapsEmptyWithUnclosedRooms = (count: number): string =>
  `Các đầu tường đều đã nối, nhưng ${count} phòng chưa kín vì có cạnh không có tường chạy dọc — chọn phòng để xem nhắc công năng.`;
const CHECK_GAPS_LABEL = 'Kiểm tra lại vòng hở';
const gapsToggleLabel = (gaps: number): string => `${gaps} chỗ tường chưa khép kín`;
const NORMALIZE_LABEL = 'Chuẩn hoá tên…';

const LINK_CLASS =
  'inline-flex min-h-8 shrink-0 items-center gap-0.5 rounded-sm text-[13px] text-accent outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2';

function RoomLabelGapRow({ gap, onNavigateToWalls }: { readonly gap: RoomLabelGapViewModel; readonly onNavigateToWalls: (wallId?: WallId) => void }) {
  return (
    /* Bấm cả dòng để tới chỗ hở; không in mã tường (người mới không đọc được), mã nằm ở aria-label. */
    <li>
      <button
        aria-label={`Khe ${gap.gapText}, ${gap.wallCodeLabels.join(' và ')}: nối ở lớp tường`}
        className="flex w-full items-center gap-2 rounded-sm py-1 text-left text-[13px] hover:bg-bg-hover"
        onClick={() => onNavigateToWalls(gap.wallIds[0])}
        type="button"
      >
        <Unlink aria-hidden="true" className="h-4 w-4 shrink-0 text-state-attention-text" />
        <span className="font-mono tabular-nums text-text-primary">{`Khe ${gap.gapText}`}</span>
        <ChevronRight aria-hidden="true" className="ml-auto h-3.5 w-3.5 shrink-0 text-accent" />
      </button>
    </li>
  );
}

interface RoomLabelGapsSectionProps {
  readonly gaps: readonly RoomLabelGapViewModel[];
  readonly unclosedRoomCount: number;
  /** Số phòng máy đã tìm được, để nói "chỉ tìm được M phòng". */
  readonly roomCount?: number;
  readonly onNavigateToWalls: (wallId?: WallId) => void;
  /** Bỏ qua khi nút "Kiểm tra lại vòng hở" đã có chỗ khác trên cùng cột (màn rỗng: nút của EmptyState). */
  readonly onCheckWallGaps?: () => void;
}

/* Gộp các dòng cùng cặp tường (hai đầu hở cùng một cặp chỉ hiện một dòng). */
function uniqueGaps(gaps: readonly RoomLabelGapViewModel[]): readonly RoomLabelGapViewModel[] {
  const seen = new Set<string>();

  return gaps.filter((gap) => {
    const key = gap.wallIds.join('-');

    return seen.has(key) ? false : (seen.add(key), true);
  });
}

/** Khối "Vòng tường hở": dùng ở panel trái VÀ ở cột rỗng (20-D-007: tầng rỗng vì vòng hở vẫn cần lối sang lớp tường). */
export function RoomLabelGapsSection({ gaps: allGaps, unclosedRoomCount, roomCount, onNavigateToWalls, onCheckWallGaps }: RoomLabelGapsSectionProps) {
  const gaps = uniqueGaps(allGaps);

  return (
    <section aria-label={GAPS_TITLE} className="flex flex-col gap-1.5">
      <h2 className="text-[13px] font-medium text-text-secondary">
        {gaps.length === 0 || roomCount === undefined ? GAPS_TITLE : gapsHeadline(gaps.length, roomCount)}
      </h2>
      {gaps.length === 0 ? (
        <p className="text-[13px] text-text-secondary">
          {unclosedRoomCount > 0 ? gapsEmptyWithUnclosedRooms(unclosedRoomCount) : GAPS_EMPTY_MESSAGE}
        </p>
      ) : (
        <>
          <p className="text-[12px] text-text-secondary">{GAPS_HINT}</p>
          {/* QA-1: hai tường có thể hở ở HAI chỗ (mỗi đầu một khe) — khoá kèm vị trí khe. */}
          <ul className="flex flex-col">
            {gaps.map((gap) => (
              <RoomLabelGapRow
                gap={gap}
                key={`${gap.wallIds.join('-')}@${gap.positionMm.x},${gap.positionMm.y}`}
                onNavigateToWalls={onNavigateToWalls}
              />
            ))}
          </ul>
        </>
      )}
      {onCheckWallGaps === undefined ? null : (
        <button className={cn(LINK_CLASS, 'w-fit')} onClick={onCheckWallGaps} type="button">
          {CHECK_GAPS_LABEL}
        </button>
      )}
    </section>
  );
}

export function RoomLabelLeftPanel({ panel, list, emptyListNotice, oversizedRoom = null }: RoomLabelLeftPanelViewProps) {
  const { summary, gaps, showOnlyUnnamed, onToggleUnnamedFilter, onOpenNormalizePreview } = panel;
  const commands = useMemo<CommandItem[]>(
    () => [{ id: 'qc-rooms-normalize', group: QC_COMMAND_GROUP, label: 'Chuẩn hoá tên phòng…', keywords: ['tên', 'chuẩn hoá'], onSelect: onOpenNormalizePreview }],
    [onOpenNormalizePreview],
  );
  useScreenCommands(commands);
  const [gapsOpen, setGapsOpen] = useState(false);
  const gapCount = uniqueGaps(gaps).length;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-default px-4 py-3">
        <button
          aria-pressed={showOnlyUnnamed}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px]',
            'transition-colors duration-120 outline-hidden',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            showOnlyUnnamed
              ? 'border-accent bg-accent-wash text-accent'
              : 'border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary',
          )}
          onClick={onToggleUnnamedFilter}
          type="button"
        >
          <span>{UNNAMED_FILTER_LABEL}</span>
          <span className="font-mono tabular-nums">{summary.unnamedCount}</span>
        </button>
        {/* Vai Người xem: KHÔNG hộp thoại, chỉ ẩn nút thao tác hàng loạt. */}
        {panel.isViewerRole ? null : (
          <button className={cn(LINK_CLASS, 'ml-auto')} onClick={onOpenNormalizePreview} type="button">
            {NORMALIZE_LABEL}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-4 pt-2">
        {emptyListNotice !== null ? (
          <p className="px-3 py-4 text-[13px] text-text-secondary" role="status">
            {emptyListNotice}
          </p>
        ) : (
          <RoomLabelList
            isViewerRole={list.isViewerRole}
            oversizedRoom={oversizedRoom}
            onHover={list.onHover}
            onSelect={list.onSelect}
            rooms={list.rooms}
            selectedRoomId={list.selectedRoomId}
          />
        )}
        {/* K23: việc chính là duyệt phòng, nên danh sách lên đầu; các khe thu về một dòng mở ra được. */}
        <div className={cn('rounded-lg px-3 py-2', gapCount > 0 && 'bg-state-attention-tint')}>
          {gapCount > 0 && (
            <button
              aria-expanded={gapsOpen}
              className="flex w-full items-center gap-2 rounded-sm py-1 text-left text-[13px] text-text-primary outline-hidden hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              onClick={() => setGapsOpen((open) => !open)}
              type="button"
            >
              <Unlink aria-hidden="true" className="h-4 w-4 shrink-0 text-state-attention-text" />
              <span className="min-w-0 flex-1">{gapsToggleLabel(gapCount)}</span>
              <ChevronDown
                aria-hidden="true"
                className={cn('h-3.5 w-3.5 shrink-0 text-accent transition-transform duration-120', gapsOpen && 'rotate-180')}
              />
            </button>
          )}
          {(gapCount === 0 || gapsOpen) && (
            <RoomLabelGapsSection
              gaps={gaps}
              onCheckWallGaps={panel.onCheckWallGaps}
              onNavigateToWalls={panel.onNavigateToWalls}
              roomCount={summary.roomCount}
              unclosedRoomCount={summary.unclosedRoomCount}
            />
          )}
        </div>
      </div>
    </div>
  );
}
