/**
 * Panel phải (344px) — thanh tra phòng đang chọn, màn Duyệt tên phòng.
 *
 * View THUẦN (R-60): nhận đúng {@link RoomLabelInspectorProps} của hợp đồng
 * L1 cộng {@link RoomLabelInspectorExtras}, và chỉ hiển thị. Mọi chuỗi số tới
 * nơi đã định dạng sẵn (A15); mọi thay đổi đi ra bằng callback trong props
 * (A10).
 *
 * ## Vì sao có `extras`
 *
 * `roomLabelTypes.ts` ĐÓNG BĂNG sau lớp L1, và cách mở rộng hợp lệ duy nhất
 * mà file đó cho phép là "mở rộng kiểu ở file riêng". Bốn thứ thanh tra cần
 * mà lát props L1 không mang — vựng chuẩn để gợi ý tên, tám nhãn công năng,
 * chú giải cách tính diện tích (M-07), và phần hình học của gộp/tách — nằm
 * trong {@link RoomLabelInspectorExtras}, đúng khuôn
 * `WallLayerLeftPanelExtras`. Đề nghị đưa chúng vào hợp đồng L1 ghi ở
 * `t7.types.fragment.md`; worker này KHÔNG tự sửa file đã đóng băng.
 *
 * ## Tên phòng: gợi ý, không bao giờ ép
 *
 * Ô nhập tên là {@link RoomLabelNameField} — `Input` chữ tự do cộng một hàng
 * gợi ý, KHÔNG phải `Combobox` (xem docstring file đó cho lý do đầy đủ và
 * quyết định Q5 của điều phối viên). Tám nhãn gợi ý tới bằng props từ
 * `ROOM_USAGE_LABELS`; màn không định nghĩa lại một danh mục công năng nào.
 *
 * ## Công năng điều khiển luật, nên nó là `Select` chứ không phải chữ tự do
 *
 * Tám giá trị `RoomUsage` là một danh mục CỐ ĐỊNH của tầng luật; nhãn tiếng
 * Việt của chúng cũng tới bằng props. `Select` (không phải `Combobox`) vì
 * tám mục thì không cần ô tìm kiếm.
 *
 * ## Nhắc công năng không khoá gì
 *
 * {@link RoomLabelNoticeList} chỉ hiển thị; không nút nào trong file này đọc
 * `room.notices` để tự vô hiệu hoá.
 */

import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

import { RoomLabelMergeDialog, RoomLabelSplitDialog } from './RoomLabelActionDialogs';
import {
  RoomLabelConfidenceBlock,
  RoomLabelMeasureRows,
  RoomLabelNoticeList,
} from './RoomLabelInspectorFields';
import { RoomLabelNameField } from './RoomLabelNameField';
import type {
  RoomLabelInspectorProps,
  RoomLabelReviewProps,
  RoomLabelViewModel,
} from './roomLabelTypes';

/**
 * Sáu thứ thanh tra cần mà lát {@link RoomLabelInspectorProps} không mang.
 *
 * KHÔNG còn là một khai báo độc lập. Lúc T7 viết file này,
 * `roomLabelTypes.ts` chưa mang sáu trường ấy, nên chúng được khai tại chỗ và
 * lý do ghi ở `t7.types.fragment.md`. Điều phối viên đã duyệt lượt mở rộng và
 * giao nó cho T5: sáu trường giờ nằm trong {@link RoomLabelReviewProps} của
 * chính hợp đồng L1. Nên đây chỉ còn là một lát CẮT TỪ hợp đồng đó — một bản
 * sao thứ hai sẽ là đúng thứ trôi khỏi bản gốc ở lượt sửa sau.
 */
export type RoomLabelInspectorExtras = Pick<
  RoomLabelReviewProps,
  | 'areaCaption'
  | 'mergeCandidates'
  | 'nameSuggestions'
  | 'onNavigateToWalls'
  | 'splitPointMm'
  | 'usageOptions'
  | 'viewerRoleNotice'
>;

export interface RoomLabelInspectorViewProps {
  readonly inspector: RoomLabelInspectorProps;
  readonly extras: RoomLabelInspectorExtras;
}

const PANEL_TITLE = 'Phòng';
const USAGE_LABEL = 'Công năng';
const EMPTY_MESSAGE = 'Chọn một phòng trên bản vẽ hoặc trong danh sách để xem chi tiết.';
const APPROVE_PREFIX = 'Duyệt';
const APPROVED_BADGE = 'Đã duyệt';
const MERGE_LABEL = 'Gộp phòng';
const SPLIT_LABEL = 'Tách phòng';
/*
 * Điểm cắt chỉ đến từ một đoạn tường chia phòng, không từ một cú bấm lên ranh (BUG-586): câu chỉ
 * đúng đường, và nút ngay dưới đi tới đó — cũng là lối ra cho toast "Chưa gộp được… Sang lớp tường…"
 * (BUG-605).
 */
const SPLIT_MISSING_POINT = 'Muốn tách phòng, sang lớp tường vẽ một đoạn tường chia phòng rồi quay lại.';
const NAVIGATE_WALLS_LABEL = 'Sang lớp tường';
/* Duyệt một phòng chưa tên không đổi được trạng thái của nó — nói ra, không im lặng (BUG-602). */
const APPROVE_NEEDS_NAME = 'Đặt tên phòng trước khi duyệt.';
const APPROVE_HINT_ID = 'room-label-approve-hint';
const VIEWER_BADGE_LABEL = 'Chỉ xem';

export function RoomLabelInspector({ inspector, extras }: RoomLabelInspectorViewProps) {
  const { room, isViewerRole, onRename, onChangeUsage, onMerge, onSplit, onApprove } = inspector;
  const [isMergeOpen, setMergeOpen] = useState(false);
  const [isSplitOpen, setSplitOpen] = useState(false);
  const [mergeCandidateId, setMergeCandidateId] = useState<RoomLabelViewModel['id'] | null>(null);

  return (
    /* `h-full` cả ở 1024 (ngăn kéo có chiều cao chặn): khối nút ghim đáy luôn thấy (Z/S-20). */
    <div className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel max-lg:h-auto">
      <div className="flex h-14 shrink-0 items-center gap-2 px-5">
        <h2 className="text-[13px] font-medium text-text-secondary">{PANEL_TITLE}</h2>
        {room === null ? null : (
          <>
            {/* Chữ hoa trong mã phòng là ngoại lệ được phép của A6. */}
            <span className="text-heading tabular-nums text-text-primary">{room.codeLabel}</span>
            {room.status === 'confirmed' && <Badge variant="verified">{APPROVED_BADGE}</Badge>}
          </>
        )}
      </div>

      {room === null ? (
        // `pb-5` như khối có phòng: câu không sát đáy thẻ (BUG-329).
        <p className="px-5 pb-5 text-[13px] text-text-secondary">{EMPTY_MESSAGE}</p>
      ) : (
        <>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">

          <RoomLabelNameField
            isReadOnly={isViewerRole}
            key={room.id}
            name={room.name}
            onCommit={(name) => onRename(room.id, name)}
            suggestions={extras.nameSuggestions}
          />

          <Select
            isReadOnly={isViewerRole}
            label={USAGE_LABEL}
            onChange={(value) => onChangeUsage(room.id, value as RoomLabelViewModel['usage'])}
            options={extras.usageOptions.map((option) => ({ label: option.label, value: option.value }))}
            value={room.usage}
          />

          <RoomLabelMeasureRows
            areaCaption={extras.areaCaption}
            areaText={room.areaText}
            clearHeightText={room.clearHeightText}
            perimeterText={room.perimeterText}
          />

          <RoomLabelConfidenceBlock
            confidence={room.confidence}
            confidenceLabel={room.confidenceLabel}
            crop={room.crop}
            nameFromOcr={room.nameFromOcr}
          />

          <RoomLabelNoticeList notices={room.notices} />

          {/* Tách và sang lớp tường: việc hiếm, ở cuối vùng cuộn — khối ghim đáy chỉ giữ việc lặp lại. */}
          {isViewerRole ? null : (
            <div className="flex flex-col gap-2 border-t border-border-default pt-3">
              {extras.splitPointMm === null ? (
                <p className="text-[13px] text-text-secondary">{SPLIT_MISSING_POINT}</p>
              ) : (
                <Button fullWidth onClick={() => setSplitOpen(true)} variant="secondary">
                  {SPLIT_LABEL}
                </Button>
              )}
              <Button fullWidth onClick={() => extras.onNavigateToWalls()} size="sm" variant="ghost">
                {NAVIGATE_WALLS_LABEL}
              </Button>
            </div>
          )}
        </div>

          {/* Khối nút NGOÀI vùng cuộn, ghim đáy panel: nút duyệt luôn thấy ở 1024×768. */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-border-default px-5 py-3">
            {isViewerRole ? (
              /* Câu đầy đủ đã ở băng cảnh báo đầu cột trái — ở đây chỉ một nhãn, không lặp đoạn văn (BUG-636). */
              extras.viewerRoleNotice !== null && (
                <Badge className="self-start" variant="neutral">
                  {VIEWER_BADGE_LABEL}
                </Badge>
              )
            ) : (
              <>
                <Button
                  aria-describedby={room.status === 'unnamed' ? APPROVE_HINT_ID : undefined}
                  aria-keyshortcuts="A"
                  disabled={room.status === 'confirmed' || room.status === 'unnamed'}
                  fullWidth
                  onClick={() => onApprove(room.id)}
                  {...(room.status === 'suggested' ? { shortcut: 'A' } : {})}
                  variant={room.status === 'confirmed' ? 'secondary' : 'primary'}
                >
                  {room.status === 'confirmed' ? APPROVED_BADGE : `${APPROVE_PREFIX} ${room.codeLabel}`}
                </Button>
                {room.status === 'unnamed' && (
                  <p className="text-[13px] text-text-secondary" id={APPROVE_HINT_ID}>
                    {APPROVE_NEEDS_NAME}
                  </p>
                )}
                <Button
                  fullWidth
                  onClick={() => {
                    /* Mỗi lần hỏi là một câu hỏi mới (A9): lựa chọn của lần trước —
                       có khi của một phòng khác — không được chọn sẵn (B-V7-03). */
                    setMergeCandidateId(null);
                    setMergeOpen(true);
                  }}
                  variant="secondary"
                >
                  {MERGE_LABEL}
                </Button>
              </>
            )}
          </div>

          <RoomLabelMergeDialog
            candidates={extras.mergeCandidates}
            isOpen={isMergeOpen}
            onCancel={() => setMergeOpen(false)}
            onConfirm={() => {
              if (mergeCandidateId === null) {
                return;
              }

              setMergeOpen(false);
              onMerge(room.id, mergeCandidateId);
            }}
            onSelectCandidate={setMergeCandidateId}
            roomCodeLabel={room.codeLabel}
            selectedCandidateId={mergeCandidateId}
          />

          <RoomLabelSplitDialog
            isOpen={isSplitOpen}
            onCancel={() => setSplitOpen(false)}
            onConfirm={() => {
              const at = extras.splitPointMm;

              if (at === null) {
                return;
              }

              setSplitOpen(false);
              onSplit(room.id, at);
            }}
            roomCodeLabel={room.codeLabel}
          />
        </>
      )}
    </div>
  );
}
