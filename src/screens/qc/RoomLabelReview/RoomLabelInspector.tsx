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

import { RoomLabelMergeDialog, RoomLabelSplitDialog, type RoomLabelMergeCandidate } from './RoomLabelActionDialogs';
import {
  RoomLabelConfidenceBlock,
  RoomLabelMeasureRows,
  RoomLabelNoticeList,
} from './RoomLabelInspectorFields';
import { RoomLabelNameField } from './RoomLabelNameField';
import type { RoomLabelInspectorProps, RoomLabelViewModel } from './roomLabelTypes';

/** Một mục của `Select` công năng. Nhãn lấy từ `ROOM_USAGE_LABELS`, không gõ lại trong màn. */
export interface RoomLabelUsageOption {
  readonly value: RoomLabelViewModel['usage'];
  readonly label: string;
}

/** Những gì thanh tra cần mà lát props L1 (đã đóng băng) không mang. */
export interface RoomLabelInspectorExtras {
  /** Vựng chuẩn gợi ý tên phòng — tám nhãn của `ROOM_USAGE_LABELS`. */
  readonly nameSuggestions: readonly string[];
  /** Tám giá trị `RoomUsage` kèm nhãn tiếng Việt. */
  readonly usageOptions: readonly RoomLabelUsageOption[];
  /** Chú giải cách tính diện tích (M-07), ví dụ "tính theo mép trong tường". */
  readonly areaCaption: string;
  /** Các phòng khác có thể gộp vào phòng đang chọn. */
  readonly mergeCandidates: readonly RoomLabelMergeCandidate[];
  /**
   * Điểm cắt trên ranh phòng, do hook chọn — view KHÔNG tính hình học (R-60).
   * `null` khi chưa có điểm nào: thanh tra nói ra điều đó thay vì hiện một nút
   * tách bấm được nhưng không làm gì.
   */
  readonly splitPointMm: RoomLabelViewModel['outlineMm'][number] | null;
  /** Câu giải thích thay các nút sửa ở vai Người xem. `null` ngoài vai đó. */
  readonly viewerRoleNotice: string | null;
}

export interface RoomLabelInspectorViewProps {
  readonly inspector: RoomLabelInspectorProps;
  readonly extras: RoomLabelInspectorExtras;
}

const PANEL_TITLE = 'Phòng';
const USAGE_LABEL = 'Công năng';
const EMPTY_MESSAGE = 'Chọn một phòng trên bản vẽ hoặc trong danh sách để xem chi tiết.';
const APPROVE_LABEL = 'Duyệt phòng này';
const APPROVED_BADGE = 'đã duyệt';
const MERGE_LABEL = 'Gộp phòng';
const SPLIT_LABEL = 'Tách phòng';
const SPLIT_MISSING_POINT =
  'Bấm lên ranh phòng trên bản vẽ để chọn điểm cắt, rồi quay lại đây để tách phòng.';

export function RoomLabelInspector({ inspector, extras }: RoomLabelInspectorViewProps) {
  const { room, isViewerRole, onRename, onChangeUsage, onMerge, onSplit, onApprove } = inspector;
  const [isMergeOpen, setMergeOpen] = useState(false);
  const [isSplitOpen, setSplitOpen] = useState(false);
  const [mergeCandidateId, setMergeCandidateId] = useState<RoomLabelViewModel['id'] | null>(null);

  return (
    <div className="flex h-full w-[344px] shrink-0 flex-col overflow-hidden rounded-[12px] bg-bg-surface shadow-panel">
      <div className="flex h-14 shrink-0 items-center px-5">
        <h3 className="text-[16px] font-semibold text-text-primary">{PANEL_TITLE}</h3>
      </div>

      {room === null ? (
        <p className="px-5 text-[13px] text-text-secondary">{EMPTY_MESSAGE}</p>
      ) : (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
          <div className="flex items-center justify-between gap-2">
            {/* Chữ hoa trong mã phòng là ngoại lệ được phép của A6. */}
            <p className="font-mono text-[16px] text-text-primary">{room.codeLabel}</p>
            {room.status === 'confirmed' && <Badge variant="verified">{APPROVED_BADGE}</Badge>}
          </div>

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

          <div className="mt-auto flex flex-col gap-2 pt-2">
            {isViewerRole ? (
              extras.viewerRoleNotice !== null && (
                <p className="text-[13px] text-text-secondary">{extras.viewerRoleNotice}</p>
              )
            ) : (
              <>
                <Button
                  disabled={room.status === 'confirmed'}
                  fullWidth
                  onClick={() => onApprove(room.id)}
                  variant="primary"
                >
                  {APPROVE_LABEL}
                </Button>
                <Button fullWidth onClick={() => setMergeOpen(true)} variant="secondary">
                  {MERGE_LABEL}
                </Button>
                {extras.splitPointMm === null ? (
                  <p className="text-[13px] text-text-secondary">{SPLIT_MISSING_POINT}</p>
                ) : (
                  <Button fullWidth onClick={() => setSplitOpen(true)} variant="secondary">
                    {SPLIT_LABEL}
                  </Button>
                )}
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
        </div>
      )}
    </div>
  );
}
