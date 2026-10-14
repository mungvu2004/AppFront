/**
 * Panel trái (280px) của màn Duyệt tên phòng — dòng tóm tắt, chip lọc, khối
 * vòng tường hở, nút "Chuẩn hoá tên", rồi danh sách phòng.
 *
 * View THUẦN (R-60): nhận đúng {@link RoomLabelLeftPanelProps} và
 * {@link RoomLabelListProps} của hợp đồng L1 (`roomLabelTypes.ts`, đã đóng
 * băng) rồi chỉ hiển thị. Hai con số của dòng tóm tắt tới nơi ĐÃ ĐỊNH DẠNG
 * (`summary.totalAreaText`), view không gọi một hàm định dạng số nào (A15).
 *
 * Dòng tóm tắt và chip lọc đứng NGOÀI vùng cuộn (`overflow-y-auto` chỉ bọc
 * {@link RoomLabelList}) để luôn nhìn thấy — cùng cách `WallLayerLeftPanel`
 * giữ bộ đếm duyệt.
 *
 * ## Vòng tường hở luôn kèm một bước đi tiếp cụ thể (CẤM TUYỆT ĐỐI)
 *
 * {@link RoomLabelGapViewModel} chủ ý KHÔNG mang callback (xem ghi chú cuối
 * `roomLabelTypes.ts`): mỗi vòng hở hiện khe hở đã định dạng, các mã tường
 * liên quan, và hai lối ra THẬT — "Xem tại lớp tường"
 * (`onNavigateToWalls`) và "Kiểm tra lại vòng hở" (`onCheckWallGaps`). Không
 * có nhánh nào chỉ báo lỗi rồi bỏ người duyệt đứng đó.
 */

import { Unlink } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

import { RoomLabelList } from './RoomLabelList';
import type { RoomLabelGapViewModel, RoomLabelLeftPanelProps, RoomLabelListProps } from './roomLabelTypes';

/**
 * Props của chính component này. Hợp đồng L1 cắt panel trái và danh sách
 * thành HAI lát ({@link RoomLabelLeftPanelProps}, {@link RoomLabelListProps})
 * vì màn cha có thể ghép chúng khác nhau; panel trái ghép cả hai lại đúng một
 * chỗ, đúng khuôn `WallLayerLeftPanel` nhận `{ panel, extras }`.
 */
export interface RoomLabelLeftPanelViewProps {
  readonly panel: RoomLabelLeftPanelProps;
  readonly list: RoomLabelListProps;
  /** Câu rỗng khi bộ lọc "Chưa đặt tên" lọc sạch danh sách (BUG-321); `null` thì vẽ danh sách. */
  readonly emptyListNotice: string | null;
}

const SUMMARY_PREFIX = 'Tổng diện tích sàn';
const SUMMARY_ROOM_SUFFIX = 'phòng';
const UNNAMED_FILTER_LABEL = 'Chưa đặt tên';
const GAPS_TITLE = 'Vòng tường hở';
const GAPS_EMPTY_MESSAGE = 'Chưa thấy vòng tường hở nào ở tầng này.';
/** BUG-407: không có khe giữa hai đầu tường, nhưng có phòng chưa kín — nói rõ phạm vi, không phủ nhận nhắc của phòng. */
const gapsEmptyWithUnclosedRooms = (count: number): string =>
  `Các đầu tường đều đã nối, nhưng ${count} phòng chưa kín vì có cạnh không có tường chạy dọc — chọn phòng để xem nhắc công năng.`;
const GAP_WALLS_LABEL = 'Tường liên quan';
const CHECK_GAPS_LABEL = 'Kiểm tra lại vòng hở';
const NAVIGATE_WALLS_LABEL = 'Xem tại lớp tường';
const NORMALIZE_LABEL = 'Chuẩn hoá tên';
/* BUG-641: không tên nào cần chuẩn hoá thì nút tắt và nói vì sao, không mở hộp thoại chỉ để nói "không có gì". */
const NOTHING_TO_NORMALIZE = 'Mọi tên phòng đã đúng kiểu câu, chưa có gì để chuẩn hoá.';
const NORMALIZE_HINT_ID = 'room-label-normalize-hint';

interface RoomLabelGapRowProps {
  readonly gap: RoomLabelGapViewModel;
  readonly onNavigateToWalls: () => void;
}

function RoomLabelGapRow({ gap, onNavigateToWalls }: RoomLabelGapRowProps) {
  return (
    <li className="flex flex-col gap-1.5 rounded-[8px] bg-state-attention-tint px-2.5 py-2">
      <p className="flex items-center gap-2 text-[13px] text-state-attention-text">
        <Unlink aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="font-mono tabular-nums">{gap.gapText}</span>
      </p>
      <p className="flex flex-wrap items-center gap-1 text-[12px] text-text-secondary">
        <span>{GAP_WALLS_LABEL}</span>
        {gap.wallIds.map((wallId, index) => (
          /*
           * Mã tường nằm trong `<code>`: `expectVietnamese` bỏ qua hẳn nội
           * dung thẻ đó (đúng chỗ cho một mã kỹ thuật), và thẻ này cũng nói
           * đúng bản chất chuỗi — một định danh, không phải câu người đọc.
           */
          <code className="rounded-[4px] bg-bg-sunken px-1 font-mono text-text-primary" key={wallId} title={wallId}>
            {gap.wallCodeLabels[index] ?? wallId}
          </code>
        ))}
      </p>
      <Button onClick={onNavigateToWalls} size="sm" variant="ghost">
        {NAVIGATE_WALLS_LABEL}
      </Button>
    </li>
  );
}

interface RoomLabelGapsSectionProps {
  readonly gaps: readonly RoomLabelGapViewModel[];
  readonly unclosedRoomCount: number;
  readonly onNavigateToWalls: () => void;
  /** Bỏ qua khi nút "Kiểm tra lại vòng hở" đã có chỗ khác trên cùng cột (màn rỗng: nút của EmptyState). */
  readonly onCheckWallGaps?: () => void;
}

/** Khối "Vòng tường hở": dùng ở panel trái VÀ ở cột rỗng (20-D-007: tầng rỗng vì vòng hở vẫn cần lối sang lớp tường). */
export function RoomLabelGapsSection({
  gaps,
  unclosedRoomCount,
  onNavigateToWalls,
  onCheckWallGaps,
}: RoomLabelGapsSectionProps) {
  return (
    <section aria-label={GAPS_TITLE} className="flex flex-col gap-2">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">{GAPS_TITLE}</h3>
      {gaps.length === 0 ? (
        <p className="text-[13px] text-text-secondary">
          {unclosedRoomCount > 0 ? gapsEmptyWithUnclosedRooms(unclosedRoomCount) : GAPS_EMPTY_MESSAGE}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {gaps.map((gap) => (
            <RoomLabelGapRow gap={gap} key={gap.wallIds.join('-')} onNavigateToWalls={onNavigateToWalls} />
          ))}
        </ul>
      )}
      {/* Hành động phụ của khối vòng hở là nút chữ, không thêm một nút rộng khác kiểu (BUG-615). */}
      {onCheckWallGaps === undefined ? null : (
        <button
          className="inline-flex min-h-6 w-fit items-center rounded-[4px] text-[13px] text-accent underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          onClick={onCheckWallGaps}
          type="button"
        >
          {CHECK_GAPS_LABEL}
        </button>
      )}
    </section>
  );
}

export function RoomLabelLeftPanel({ panel, list, emptyListNotice }: RoomLabelLeftPanelViewProps) {
  const { summary, gaps, showOnlyUnnamed, onToggleUnnamedFilter, onOpenNormalizePreview, hasNamesToNormalize = true } =
    panel;

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-[12px] bg-bg-surface shadow-panel max-lg:w-full">
      <div className="flex shrink-0 flex-col gap-3 px-5 pb-3 pt-4">
        <p className="text-[13px] text-text-primary">
          <span>{SUMMARY_PREFIX} </span>
          <span className="font-mono font-semibold tabular-nums">{summary.totalAreaText}</span>
          <span className="text-text-secondary"> · </span>
          <span className="font-mono tabular-nums">{summary.roomCount}</span>
          <span className="text-text-secondary"> {SUMMARY_ROOM_SUFFIX}</span>
        </p>

        <button
          aria-pressed={showOnlyUnnamed}
          className={cn(
            'flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px]',
            'transition-colors duration-120 outline-none',
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

        <RoomLabelGapsSection
          gaps={gaps}
          onCheckWallGaps={panel.onCheckWallGaps}
          onNavigateToWalls={panel.onNavigateToWalls}
          unclosedRoomCount={summary.unclosedRoomCount}
        />

        {/* Vai Người xem: KHÔNG hộp thoại, chỉ ẩn nút thao tác hàng loạt. */}
        {!panel.isViewerRole && (
          <>
            <Button
              aria-describedby={hasNamesToNormalize ? undefined : NORMALIZE_HINT_ID}
              disabled={!hasNamesToNormalize}
              fullWidth
              onClick={onOpenNormalizePreview}
              size="sm"
              variant="secondary"
            >
              {NORMALIZE_LABEL}
            </Button>
            {hasNamesToNormalize ? null : (
              <p className="text-[13px] text-text-secondary" id={NORMALIZE_HINT_ID}>
                {NOTHING_TO_NORMALIZE}
              </p>
            )}
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {emptyListNotice !== null ? (
          <p className="px-3 py-4 text-[13px] text-text-secondary" role="status">
            {emptyListNotice}
          </p>
        ) : (
          <RoomLabelList
            isViewerRole={list.isViewerRole}
            onHover={list.onHover}
            onSelect={list.onSelect}
            rooms={list.rooms}
            selectedRoomId={list.selectedRoomId}
          />
        )}
      </div>
    </div>
  );
}
