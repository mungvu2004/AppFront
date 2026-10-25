/**
 * Panel trái (280px) của màn Duyệt tên phòng (demo Z/S-20) — MỘT khung: đầu panel (3 câu),
 * hàng lọc + "Chuẩn hoá tên…", rồi vùng cuộn gồm danh sách phòng và nhóm "Vòng tường hở".
 *
 * View THUẦN (R-60): nhận đúng {@link RoomLabelLeftPanelProps} và {@link RoomLabelListProps}
 * rồi chỉ hiển thị. Tổng diện tích sàn đã nằm ở dòng trạng thái đầu panel, không lặp ở đây.
 *
 * ## Vòng tường hở luôn kèm một bước đi tiếp cụ thể (CẤM TUYỆT ĐỐI)
 *
 * Mỗi vòng hở hiện khe hở đã định dạng, cặp tường, và link "Nối" sang lớp tường chọn sẵn
 * tường đầu (`?wall=`, G4a-39). Vòng hở là CẢNH BÁO, không chặn cổng sang bước sau.
 */

import { ChevronRight, Unlink } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import type { RoomId, WallId } from '@/domain/spatial/types';
import { cn } from '@/lib/utils';

import { RoomLabelList } from './RoomLabelList';
import type { RoomLabelGapViewModel, RoomLabelLeftPanelProps, RoomLabelListProps } from './roomLabelTypes';

export interface RoomLabelLeftPanelViewProps {
  readonly panel: RoomLabelLeftPanelProps;
  readonly list: RoomLabelListProps;
  /** Câu rỗng khi bộ lọc "Chưa đặt tên" lọc sạch danh sách (BUG-321); `null` thì vẽ danh sách. */
  readonly emptyListNotice: string | null;
  /** Đầu panel (QcPanelHead) — nằm trong cùng khung, không thành thẻ riêng. */
  readonly head?: ReactNode;
  /** Cờ phòng chiếm >80 % sàn, đã ghép câu ở hook. */
  readonly oversizedRoom?: { readonly id: RoomId; readonly text: string } | null;
}

const UNNAMED_FILTER_LABEL = 'Chưa đặt tên';
const GAPS_TITLE = 'Vòng tường hở';
const GAPS_HINT = 'Khe hở làm phòng không khép kín nên chưa có diện tích. Nối hai tường ở lớp tường.';
const GAPS_EMPTY_MESSAGE = 'Chưa thấy vòng tường hở nào ở tầng này.';
/** BUG-407: không có khe giữa hai đầu tường, nhưng có phòng chưa kín — nói rõ phạm vi. */
const gapsEmptyWithUnclosedRooms = (count: number): string =>
  `Các đầu tường đều đã nối, nhưng ${count} phòng chưa kín vì có cạnh không có tường chạy dọc — chọn phòng để xem nhắc công năng.`;
const CHECK_GAPS_LABEL = 'Kiểm tra lại vòng hở';
const JOIN_LABEL = 'Nối';
/* "…" vì nút mở bảng xem trước. Luôn bấm được: không có gì để đổi thì bảng nói thế (B1-10). */
const NORMALIZE_LABEL = 'Chuẩn hoá tên…';

const LINK_CLASS =
  'inline-flex min-h-8 shrink-0 items-center gap-0.5 rounded-sm text-[13px] text-accent outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2';

function RoomLabelGapRow({ gap, onNavigateToWalls }: { readonly gap: RoomLabelGapViewModel; readonly onNavigateToWalls: (wallId?: WallId) => void }) {
  const codes = gap.wallIds.map((wallId, index) => gap.wallCodeLabels[index] ?? wallId);

  return (
    /* V-06: một hàng trung tính, không thẻ vàng — nhiều khe hở không biến cột thành "bức tường vàng". */
    <li className="flex items-center gap-2 py-1 text-[13px]">
      <Unlink aria-hidden="true" className="h-4 w-4 shrink-0 text-state-attention-text" />
      <span className="shrink-0 font-mono tabular-nums text-text-primary">{gap.gapText}</span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-[12px] text-text-secondary">
        {gap.wallIds.map((wallId, index) => (
          /* Mã tường trong `<code>`: một định danh, không phải câu người đọc (expectVietnamese bỏ qua). */
          <code className="font-mono" key={wallId} title={wallId}>
            {codes[index]}
          </code>
        ))}
      </span>
      <button
        aria-label={`${JOIN_LABEL} ${codes.join(' và ')} ở lớp tường`}
        className={LINK_CLASS}
        onClick={() => onNavigateToWalls(gap.wallIds[0])}
        type="button"
      >
        {JOIN_LABEL}
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

interface RoomLabelGapsSectionProps {
  readonly gaps: readonly RoomLabelGapViewModel[];
  readonly unclosedRoomCount: number;
  readonly onNavigateToWalls: (wallId?: WallId) => void;
  /** Bỏ qua khi nút "Kiểm tra lại vòng hở" đã có chỗ khác trên cùng cột (màn rỗng: nút của EmptyState). */
  readonly onCheckWallGaps?: () => void;
}

/** Khối "Vòng tường hở": dùng ở panel trái VÀ ở cột rỗng (20-D-007: tầng rỗng vì vòng hở vẫn cần lối sang lớp tường). */
export function RoomLabelGapsSection({ gaps, unclosedRoomCount, onNavigateToWalls, onCheckWallGaps }: RoomLabelGapsSectionProps) {
  return (
    <section aria-label={GAPS_TITLE} className="flex flex-col gap-1.5">
      <h2 className="flex items-center gap-2 text-[13px] font-medium text-text-secondary">
        {GAPS_TITLE}
        {gaps.length === 0 ? null : <span className="tabular-nums text-state-attention-text">{gaps.length}</span>}
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

export function RoomLabelLeftPanel({ panel, list, emptyListNotice, head, oversizedRoom = null }: RoomLabelLeftPanelViewProps) {
  const { summary, gaps, showOnlyUnnamed, onToggleUnnamedFilter, onOpenNormalizePreview } = panel;

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel max-lg:w-full">
      {head}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-default px-4 py-3">
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
          <Button onClick={onOpenNormalizePreview} size="sm" variant="secondary">
            {NORMALIZE_LABEL}
          </Button>
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

        <div className="border-t border-border-default px-2 pt-3">
          <RoomLabelGapsSection
            gaps={gaps}
            onCheckWallGaps={panel.onCheckWallGaps}
            onNavigateToWalls={panel.onNavigateToWalls}
            unclosedRoomCount={summary.unclosedRoomCount}
          />
        </div>
      </div>
    </div>
  );
}
