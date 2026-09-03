/**
 * Thanh áp dụng của màn "Chuẩn hoá độ dày tường" (2.4 của brief T7): ô dung
 * sai, nút "áp dụng lại bộ lọc" (kèm cảnh báo tại chỗ khi ảnh hưởng tường đã
 * duyệt), tóm tắt xem trước, danh sách tường không đổi được, và nút áp dụng.
 *
 * VIEW THUẦN — nhận đúng `ThicknessApplyBarProps` (T4 khai). Hai state cục bộ
 * (`isReapplyOpen`, `expandedWallId`) chỉ điều khiển việc HIỆN/ẨN — đúng khuôn
 * `FloorTable.tsx` (`duplicatingFloorId`) — không phải nơi quyết định nghiệp
 * vụ; mọi thay đổi thật đi qua `onApplyPreview`/`onReapplyFilter`/`onUndo`.
 *
 * ## CẤM TUYỆT ĐỐI vẫn giữ nguyên trong file này
 *
 * - Nút "Áp dụng" trong khối xem trước là NƠI DUY NHẤT gọi `onApplyPreview` —
 *   không có đường tắt nào khác áp thay đổi.
 * - "Áp dụng lại bộ lọc" không bao giờ âm thầm ghi đè tường đã duyệt: bấm nút
 *   chỉ MỞ khối cảnh báo/xác nhận cục bộ; `onReapplyFilter` chỉ được gọi sau
 *   khi người dùng chọn rõ một trong hai đường (loại tường đã duyệt ra, hoặc
 *   xác nhận áp cho tất cả).
 *
 * ## Vì sao khối cảnh báo không dùng `Modal`
 *
 * Đặc tả (2.4) nói rõ "cảnh báo NGAY TẠI CHỖ (không phải dialog rời)" — khác
 * khuôn `RoomLabelNormalizePreview` (dùng `Modal.Root`). Khối xem trước và
 * khối cảnh báo ở đây đều là `<div>` thường, xếp ngay trong thanh.
 */

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { NumericField } from '@/components/ui/NumericField';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import type { WallId } from '@/domain/spatial/types';

import type { ThicknessApplyBarProps, ThicknessSegmentRow } from './thicknessTypes';

const TOLERANCE_LABEL = 'Dung sai';
const REAPPLY_FILTER_LABEL = 'Áp dụng lại bộ lọc';
const UNDO_LABEL = 'Hoàn tác';
const OPEN_PREVIEW_LABEL = 'Xem trước';
const CANCEL_LABEL = 'Huỷ';
const APPLY_LABEL = 'Áp dụng';
const VIEW_LABEL = 'Xem';
const HIDE_LABEL = 'Ẩn';
const CONFIRM_REAPPLY_LABEL = 'Áp dụng lại';
const EXCLUDE_AND_REAPPLY_LABEL = 'Loại tường đã duyệt ra rồi áp lại';
const APPLY_TO_ALL_LABEL = 'Vẫn áp dụng cho tất cả';
const REAPPLY_WARNING_TITLE = 'Áp dụng lại bộ lọc sẽ đổi tường đã duyệt';
const NO_REVIEWED_AFFECTED_MESSAGE = 'Áp dụng lại bộ lọc sẽ không ảnh hưởng tường nào đã duyệt.';

const reapplyWarningMessage = (affectedReviewedCount: number): string =>
  `${affectedReviewedCount} tường đã duyệt sẽ bị đổi. Đề nghị loại các tường này khỏi lượt áp dụng lại.`;

const unchangedHeading = (count: number): string => `${count} tường không đổi được:`;

const unchangedDetail = (wall: ThicknessSegmentRow): string =>
  `Lệch ${wall.deviationLabel} · Độ tin cậy: ${wall.confidenceLabel} · ${wall.floorName}`;

export function ThicknessApplyBar({
  preview,
  toleranceMm,
  onChangeTolerance,
  onOpenPreview,
  onApplyPreview,
  onCancelPreview,
  onUndo,
  reapplyWarning,
  onReapplyFilter,
}: ThicknessApplyBarProps) {
  const [isReapplyOpen, setIsReapplyOpen] = useState(false);
  const [expandedWallId, setExpandedWallId] = useState<WallId | null>(null);

  const closeReapply = (): void => setIsReapplyOpen(false);

  const confirmReapply = (excludeReviewed: boolean): void => {
    onReapplyFilter(excludeReviewed);
    closeReapply();
  };

  const cancelPreview = (): void => {
    setExpandedWallId(null);
    onCancelPreview();
  };

  const toggleExpanded = (wallId: WallId): void => {
    setExpandedWallId((current) => (current === wallId ? null : wallId));
  };

  /**
   * `NumericField` (qua `useNumericField`) báo `undefined` khi ô bị xoá
   * trắng — `ThicknessApplyBarProps.onChangeTolerance` (T4 khai) chỉ nhận
   * `number`. Bỏ qua lượt báo trống thay vì đẩy `undefined` lên hook; ô vẫn
   * hiện `toleranceMm` hiện tại cho tới khi người dùng gõ một số hợp lệ.
   */
  const handleToleranceChange = (value: number | undefined): void => {
    if (value !== undefined) {
      onChangeTolerance(value);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border-default bg-bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <NumericField
          className="w-32"
          label={TOLERANCE_LABEL}
          onChange={handleToleranceChange}
          unit="mm"
          value={toleranceMm}
        />
        <Button onClick={() => setIsReapplyOpen(true)} size="sm" variant="secondary">
          {REAPPLY_FILTER_LABEL}
        </Button>

        <div className="flex-1" />

        <Button onClick={onUndo} size="sm" variant="ghost">
          {UNDO_LABEL}
        </Button>
        {preview === null && (
          <Button onClick={onOpenPreview} size="sm" variant="primary">
            {OPEN_PREVIEW_LABEL}
          </Button>
        )}
      </div>

      {isReapplyOpen &&
        (reapplyWarning !== null ? (
          <div className="flex flex-col gap-2">
            <InlineAlert
              action={{ label: EXCLUDE_AND_REAPPLY_LABEL, onClick: () => confirmReapply(true) }}
              level="attention"
              message={reapplyWarningMessage(reapplyWarning.affectedReviewedCount)}
              title={REAPPLY_WARNING_TITLE}
            />
            <div className="flex items-center gap-3 pl-3">
              <button
                className="rounded text-[13px] text-text-secondary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                onClick={() => confirmReapply(false)}
                type="button"
              >
                {APPLY_TO_ALL_LABEL}
              </button>
              <button
                className="rounded text-[13px] text-text-secondary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                onClick={closeReapply}
                type="button"
              >
                {CANCEL_LABEL}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-[13px] text-text-secondary">{NO_REVIEWED_AFFECTED_MESSAGE}</p>
            <Button onClick={() => confirmReapply(false)} size="sm" variant="secondary">
              {CONFIRM_REAPPLY_LABEL}
            </Button>
            <Button onClick={closeReapply} size="sm" variant="ghost">
              {CANCEL_LABEL}
            </Button>
          </div>
        ))}

      {preview !== null && (
        <div className="flex flex-col gap-3 rounded-[8px] border border-border-default bg-bg-sunken p-3">
          <p className="text-[14px] text-text-primary">{preview.sentence}</p>

          {preview.unchangedWalls.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] font-medium text-text-secondary">
                {unchangedHeading(preview.unchangedWalls.length)}
              </p>
              <ul className="flex flex-col gap-1">
                {preview.unchangedWalls.map((wall) => {
                  const isExpanded = expandedWallId === wall.wallId;

                  return (
                    <li className="flex flex-col gap-1" key={wall.wallId}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13px] text-text-secondary">{wall.code}</span>
                        <span className="font-mono text-[13px] text-text-secondary">{wall.measuredLabel}</span>
                        <button
                          aria-expanded={isExpanded}
                          className="ml-auto rounded text-[13px] text-accent underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                          onClick={() => toggleExpanded(wall.wallId)}
                          type="button"
                        >
                          {isExpanded ? HIDE_LABEL : VIEW_LABEL}
                        </button>
                      </div>
                      {isExpanded && <p className="pl-1 text-[13px] text-text-secondary">{unchangedDetail(wall)}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button onClick={cancelPreview} size="sm" variant="ghost">
              {CANCEL_LABEL}
            </Button>
            <Button onClick={onApplyPreview} size="sm" variant="primary">
              {APPLY_LABEL}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
