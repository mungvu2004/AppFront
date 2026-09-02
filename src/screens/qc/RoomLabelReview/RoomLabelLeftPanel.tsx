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
}

const SUMMARY_PREFIX = 'Tổng diện tích sàn';
const SUMMARY_ROOM_SUFFIX = 'phòng';
const UNNAMED_FILTER_LABEL = 'Chưa đặt tên';
const GAPS_TITLE = 'Vòng tường hở';
const GAPS_EMPTY_MESSAGE = 'Chưa thấy vòng tường hở nào ở tầng này.';
const GAP_WALLS_LABEL = 'tường liên quan';
const CHECK_GAPS_LABEL = 'Kiểm tra lại vòng hở';
const NAVIGATE_WALLS_LABEL = 'Xem tại lớp tường';
const NORMALIZE_LABEL = 'Chuẩn hoá tên';

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
        {gap.wallIds.map((wallId) => (
          /*
           * Mã tường nằm trong `<code>`: `expectVietnamese` bỏ qua hẳn nội
           * dung thẻ đó (đúng chỗ cho một mã kỹ thuật), và thẻ này cũng nói
           * đúng bản chất chuỗi — một định danh, không phải câu người đọc.
           */
          <code className="rounded-[4px] bg-bg-sunken px-1 font-mono text-text-primary" key={wallId}>
            {wallId}
          </code>
        ))}
      </p>
      <Button onClick={onNavigateToWalls} size="sm" variant="ghost">
        {NAVIGATE_WALLS_LABEL}
      </Button>
    </li>
  );
}

export function RoomLabelLeftPanel({ panel, list }: RoomLabelLeftPanelViewProps) {
  const { summary, gaps, showOnlyUnnamed, onToggleUnnamedFilter, onOpenNormalizePreview } = panel;

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-[12px] bg-bg-surface shadow-panel">
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

        <section aria-label={GAPS_TITLE} className="flex flex-col gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">{GAPS_TITLE}</h3>
          {gaps.length === 0 ? (
            <p className="text-[13px] text-text-secondary">{GAPS_EMPTY_MESSAGE}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {gaps.map((gap) => (
                <RoomLabelGapRow gap={gap} key={gap.wallIds.join('-')} onNavigateToWalls={panel.onNavigateToWalls} />
              ))}
            </ul>
          )}
          <Button fullWidth onClick={panel.onCheckWallGaps} size="sm" variant="ghost">
            {CHECK_GAPS_LABEL}
          </Button>
        </section>

        {/* Vai Người xem: KHÔNG hộp thoại, chỉ ẩn nút thao tác hàng loạt. */}
        {!panel.isViewerRole && (
          <Button fullWidth onClick={onOpenNormalizePreview} variant="secondary">
            {NORMALIZE_LABEL}
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <RoomLabelList
          isViewerRole={list.isViewerRole}
          onHover={list.onHover}
          onSelect={list.onSelect}
          rooms={list.rooms}
          selectedRoomId={list.selectedRoomId}
        />
      </div>
    </div>
  );
}
