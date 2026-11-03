/**
 * Panel phải neo (bố cục hai panel, `docs/figma-layout-spec.md`) của phòng đang chọn, màn Duyệt tên phòng:
 * `QcQueueAskCard` (mã + huy hiệu + ‹ K › J ×), các mục "Tên phòng", "Diện tích", "Độ tin cậy",
 * "Thông số nâng cao" (gập), chân ghim Duyệt/Gộp. Một component giữ cả thân lẫn chân vì nút duyệt
 * đọc tên đang gõ dở (UX-24). Chưa chọn phòng → `QcInspectorEmpty` ở `RoomLabelReview`.
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
 * mà lát props L1 không mang — vựng chuẩn để gợi ý tên, chín nhãn công năng,
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

import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

import { QcQueueAskCard, type QcQueueAskCardProps } from '../shared/QcAskCard';
import { QcInspectorSection } from '../shared/QcInspectorSection';

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
  | 'scaleLock'
>;

export interface RoomLabelInspectorViewProps {
  readonly inspector: RoomLabelInspectorProps & { readonly room: RoomLabelViewModel };
  readonly extras: RoomLabelInspectorExtras;
  /** Hàng đợi + lý do của đầu panel (`QcQueueAskCard`). */
  readonly card: Pick<
    QcQueueAskCardProps<RoomLabelViewModel['id']>,
    'items' | 'onSelect' | 'reason'
  >;
}

const NAME_SECTION = 'Tên phòng';
const AREA_SECTION = 'Diện tích';
const CONFIDENCE_SECTION = 'Độ tin cậy';
const ADVANCED_SECTION = 'Thông số nâng cao';
const USAGE_LABEL = 'Công năng';
const PENDING_BADGE = 'Cần xem';
const APPROVE_PREFIX = 'Duyệt';
const APPROVED_BADGE = 'Đã duyệt';
const MERGE_LABEL = 'Gộp phòng';
const SPLIT_LABEL = 'Tách phòng';
/*
 * Điểm cắt chỉ đến từ một đoạn tường chia phòng, không từ một cú bấm lên ranh (BUG-586): câu chỉ
 * đúng đường, và nút ngay dưới đi tới đó — cũng là lối ra cho toast "Chưa gộp được… Sang lớp tường…"
 * (BUG-605).
 */
const SPLIT_MISSING_POINT =
  'Muốn tách phòng, sang lớp tường vẽ một đoạn tường chia phòng rồi quay lại.';
const NAVIGATE_WALLS_LABEL = 'Sang lớp tường';
/* Duyệt một phòng chưa tên không đổi được trạng thái của nó — nói ra, không im lặng (BUG-602). */
const APPROVE_NEEDS_NAME = 'Đặt tên phòng trước khi duyệt.';
const APPROVE_HINT_ID = 'room-label-approve-hint';
const VIEWER_BADGE_LABEL = 'Chỉ xem';
/* K10: đường bao tràn ra ngoài nhà thì duyệt là sai — việc chính là sửa tường cho phòng khép đúng. */
const OUTLINE_SPILL_NOTICE =
  'Đường bao tràn ra ngoài tường bao. Sửa tường ở lớp tường để máy dò lại phòng, rồi mới duyệt.';
const FIX_OUTLINE_LABEL = 'Sửa đường bao';
const OUTLINE_SPILL_HINT_ID = 'room-label-outline-spill-hint';
const OPEN_SCALE_LABEL = 'Đặt tỷ lệ';

export function RoomLabelInspector({ inspector, extras, card }: RoomLabelInspectorViewProps) {
  const { room, isViewerRole, onRename, onChangeUsage, onMerge, onSplit, onApprove } = inspector;
  const [isMergeOpen, setMergeOpen] = useState(false);
  const [isSplitOpen, setSplitOpen] = useState(false);
  const [mergeCandidateId, setMergeCandidateId] = useState<RoomLabelViewModel['id'] | null>(null);
  const spills = room.outlineSpills === true;
  /* Chặn duyệt khi chưa tên hoặc đường bao tràn (K10) — cùng điều kiện với `onApprove` của hook. */
  /* UX-24: tên đang gõ dở của phòng chưa tên — có chữ là duyệt được (đổi tên trước, duyệt ngay sau). */
  const [draft, setDraft] = useState<{
    readonly roomId: RoomLabelViewModel['id'];
    readonly name: string;
  } | null>(null);
  const lastCommitRef = useRef<{
    readonly roomId: RoomLabelViewModel['id'];
    readonly name: string;
  } | null>(null);
  const pendingApproveRef = useRef<RoomLabelViewModel['id'] | null>(null);
  const draftName = draft?.roomId === room.id ? draft.name.trim() : '';
  const canApproveTyped = room.status === 'unnamed' && draftName !== '' && !spills;
  const canApprove = (room.status === 'suggested' && !spills) || canApproveTyped;

  /* Đổi tên xong (phòng thành "chờ duyệt") thì duyệt luôn — một cú bấm cho người vừa gõ tên. */
  useEffect(() => {
    if (pendingApproveRef.current === null) {
      return;
    }

    if (room.id !== pendingApproveRef.current) {
      pendingApproveRef.current = null;

      return;
    }

    if (room.status === 'suggested') {
      pendingApproveRef.current = null;
      onApprove(room.id);
    }
  }, [onApprove, room]);

  const commitName = (roomId: RoomLabelViewModel['id'], name: string) => {
    lastCommitRef.current = { roomId, name: name.trim() };
    onRename(roomId, name);
  };

  const approve = (roomId: RoomLabelViewModel['id']) => {
    if (!canApproveTyped) {
      onApprove(roomId);

      return;
    }

    /* Rời ô (blur) có thể đã cam kết đúng tên này — không đổi tên lần hai. */
    const last = lastCommitRef.current;

    if (last?.roomId !== roomId || last.name !== draftName) {
      commitName(roomId, draftName);
    }

    pendingApproveRef.current = roomId;
  };
  const approveHintId = canApproveTyped
    ? undefined
    : room.status === 'unnamed'
      ? APPROVE_HINT_ID
      : room.status === 'suggested' && spills
        ? OUTLINE_SPILL_HINT_ID
        : undefined;

  const badge =
    room.status === 'confirmed' ? (
      <Badge variant="verified">{APPROVED_BADGE}</Badge>
    ) : (
      <Badge variant="attention">{PENDING_BADGE}</Badge>
    );
  const footer = (
    /* Chân ghim NGOÀI vùng cuộn (`QcAskCard.footer`): nút duyệt luôn thấy ở 1024×768. */
    <div className="flex flex-col gap-2">
      {extras.scaleLock != null ? (
        /* Tầng thiếu tỷ lệ: nút chính là lối sang bước Tỷ lệ, kèm lý do (UX-R1 r3). */
        <>
          <p className="text-[13px] text-state-violation-text">{extras.scaleLock.reason}</p>
          {extras.scaleLock.onOpenScale === null ? null : (
            <Button fullWidth onClick={extras.scaleLock.onOpenScale} variant="primary">
              {OPEN_SCALE_LABEL}
            </Button>
          )}
        </>
      ) : isViewerRole ? (
        /* Câu đầy đủ đã ở băng cảnh báo đầu cột trái — ở đây chỉ một nhãn, không lặp đoạn văn (BUG-636). */
        extras.viewerRoleNotice !== null && (
          <Badge className="self-start" variant="neutral">
            {VIEWER_BADGE_LABEL}
          </Badge>
        )
      ) : (
        <>
          {spills && (
            <Button fullWidth onClick={() => extras.onNavigateToWalls()} variant="primary">
              {FIX_OUTLINE_LABEL}
            </Button>
          )}
          <Button
            aria-describedby={approveHintId}
            aria-keyshortcuts="A"
            disabled={!canApprove}
            fullWidth
            onClick={() => approve(room.id)}
            {...(room.status === 'suggested' && !spills ? { shortcut: 'A' } : {})}
            variant={room.status === 'confirmed' || spills ? 'secondary' : 'primary'}
          >
            {room.status === 'confirmed' ? APPROVED_BADGE : `${APPROVE_PREFIX} ${room.codeLabel}`}
          </Button>
          {room.status === 'unnamed' && !canApproveTyped && (
            <p className="text-[13px] text-text-secondary" id={APPROVE_HINT_ID}>
              {APPROVE_NEEDS_NAME}
            </p>
          )}
          {room.status === 'suggested' && spills && (
            <p className="text-[13px] text-state-attention-text" id={OUTLINE_SPILL_HINT_ID}>
              {OUTLINE_SPILL_NOTICE}
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
  );

  return (
    /* Chữ hoa trong mã phòng là ngoại lệ được phép của A6. */
    <QcQueueAskCard
      {...card}
      badge={badge}
      code={room.codeLabel}
      footer={footer}
      selectedId={room.id}
      unit="Phòng"
    >
      <QcInspectorSection title={NAME_SECTION}>
        <div className="flex flex-col gap-3">
          <RoomLabelNameField
            isReadOnly={isViewerRole}
            key={room.id}
            /* UX-24: tên giả "phòng 5" của máy không hiện như đã có tên — ô trống, chỉ chữ gợi ý. */
            name={room.hasName ? room.name : ''}
            onCommit={(name) => commitName(room.id, name)}
            onDraftChange={(name) => setDraft({ roomId: room.id, name })}
            suggestions={extras.nameSuggestions}
          />
          <Select
            isReadOnly={isViewerRole}
            label={USAGE_LABEL}
            onChange={(value) => onChangeUsage(room.id, value as RoomLabelViewModel['usage'])}
            options={extras.usageOptions.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            value={room.usage}
          />
        </div>
      </QcInspectorSection>

      <QcInspectorSection title={AREA_SECTION}>
        <RoomLabelMeasureRows
          areaCaption={extras.areaCaption}
          areaText={room.areaText}
          centerlineAreaText={room.centerlineAreaText}
          clearHeightText={room.clearHeightText}
          perimeterText={room.perimeterText}
        />
      </QcInspectorSection>

      <QcInspectorSection title={CONFIDENCE_SECTION}>
        <div className="flex flex-col gap-3">
          <RoomLabelConfidenceBlock
            confidence={room.confidence}
            confidenceLabel={room.confidenceLabel}
            crop={room.crop}
            nameFromOcr={room.nameFromOcr}
          />
          <RoomLabelNoticeList notices={room.notices} />
        </div>
      </QcInspectorSection>

      {/* Tách và sang lớp tường: việc hiếm, gập ở cuối — chân ghim chỉ giữ việc lặp lại. */}
      {isViewerRole ? null : (
        <QcInspectorSection collapsible defaultOpen={false} title={ADVANCED_SECTION}>
          <div className="flex flex-col gap-2">
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
        </QcInspectorSection>
      )}

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
    </QcQueueAskCard>
  );
}
