/**
 * Màn S-17 "Duyệt tên phòng" (`RoomLabelReview`) — VIEW THUẦN, vỏ QC ba cột:
 * panel trái 280 (tóm tắt + vòng hở + danh sách phòng), canvas giữa, cột phải
 * 344 (thanh tra phòng đang chọn), cộng một đầu màn mang breadcrumb, tiêu đề
 * và mô tả, và hộp thoại xem trước "Chuẩn hoá tên" treo ở cuối cây.
 *
 * Nhận HẾT qua props ({@link RoomLabelReviewProps} của `roomLabelTypes.ts`, đã
 * đóng băng) và chỉ dựng thẻ. Không `@/api`, không `@/store`, không `@/domain`,
 * không `@/lib/http` (R-60). Không tính hình học, không so ngưỡng, không định
 * dạng một con số nào: mọi chuỗi tới đây đã xong ở `useRoomLabelReview` (A15).
 *
 * ## Vì sao view nhập thẳng ba mảnh con, không nhận qua khe
 *
 * `WallLayerReview.tsx` nhận `canvasSlot?: ReactNode` vì canvas của nó do một
 * worker khác viết SONG SONG và chưa tồn tại lúc view ấy được viết. Ở đây cả ba
 * mảnh (canvas của T6, hai panel cộng hai hộp thoại của T7) đã có sẵn trên
 * nhánh, nên một khe tuỳ chọn mà không nơi gọi nào truyền chỉ còn là một prop
 * chết — đúng thứ R-73 cấm. Cùng lựa chọn `AxisGridManager.tsx` đã chốt.
 *
 * ## Bảy trạng thái (A11, R-63) — nơi từng trạng thái được vẽ
 *
 * | `state`     | vẽ ở đâu                                                             |
 * |-------------|----------------------------------------------------------------------|
 * | `empty`     | cột trái: `EmptyState` mang `emptyNotice`, nút "Kiểm tra lại vòng hở" |
 * | `loading`   | cột trái: sáu dòng `Skeleton`; canvas vẫn vẽ khung chờ của nó         |
 * | `partial`   | mặc định — tóm tắt, vòng hở, danh sách phòng, thanh tra               |
 * | `error`     | cột trái: `InlineAlert` + nút "Thử lại"; canvas VẪN xem được          |
 *
 * Đọc lớp (N16) hỏng khi CHƯA có tài liệu → cả màn là `FloorLayerReadFailureScreen` (BUG-326).
 * | `success`   | mặc định, và mọi dòng danh sách mang chấm xanh "đã duyệt"             |
 * | `forbidden` | canvas chỉ xem (`isInteractive={false}`), cột trái thêm câu giải thích |
 * | `collapsed` | ẩn cột trái + thanh tra; canvas chiếm cả khung, còn nút bung lại      |
 *
 * Không nhánh nào trả `null` cho cả màn: canvas luôn được vẽ, nên màn trắng —
 * thất bại duy nhất A11 tồn tại để chặn — không có chỗ xảy ra.
 *
 * ## Vì sao cột trái đọc BA CÂU chứ không đọc `state`
 *
 * `deriveRoomLabelScreenState` xếp `forbidden` và `collapsed` TRƯỚC `error` và
 * `loading` (vai trò đi trước vì nó vô hiệu mọi hàm sửa). Nên một người xem
 * đang gặp lỗi đọc lớp phòng vẫn mang `state === 'forbidden'`, và một cột trái
 * phân nhánh theo `state` sẽ nuốt mất câu lỗi. Ba câu `errorMessage`,
 * `emptyNotice`, `viewerRoleNotice` là thứ nói đúng sự thật ở mọi tổ hợp, đúng
 * cách `AxisGridManager.tsx` đọc `viewModel.errorMessage`/`emptyNotice`.
 *
 * ## "Thử lại" của trạng thái lỗi là `onCheckWallGaps`, không phải một prop mới
 *
 * Hợp đồng đã đóng băng không có `onRetry`, và thêm một prop cho nó là sửa file
 * đã khoá. Không cần: `onCheckWallGaps` gọi `refetchRoomLayer()` trong hook
 * (`useRoomLabelReview.ts:857-860`), tức nó ĐÚNG LÀ lượt đọc lại lớp phòng —
 * một nút "Thử lại" trỏ vào đó không hứa gì nó không làm (E.10).
 */

import { LayoutGrid } from 'lucide-react';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { cn } from '@/lib/utils';

import { FloorLayerSaveBanner } from '../WallLayerReview/FloorLayerSaveBanner';
import { FloorReviewGate } from '../shared/FloorReviewGate.container';
import { QcFloorDoneCard } from '../shared/QcFloorDone';
import { FloorLayerReadFailureScreen } from '../shared/FloorLayerReadFailureScreen';
import { ProvisionalScaleBanner } from '../shared/ProvisionalScaleBanner';
import { QcFloorNav, type QcFloorNavProps } from '../shared/QcFloorNav';
import { QcScreenFrame, QcStatusBar, QcWorkspace } from '../shared/QcScreenFrame';
import { QcQueueAskCard } from '../shared/QcAskCard';
import { QcAskSlot } from '../shared/qcAsk';
import { QcStepColumn } from '../shared/QcStepColumn';
import { isL23Layout } from '../shared/qcLayout';

import { RoomLabelCanvas } from './RoomLabelCanvas';
import { RoomLabelPanelHead } from './RoomLabelHead';
import { RoomLabelInspector } from './RoomLabelInspector';
import { RoomLabelGapsSection, RoomLabelLeftPanel } from './RoomLabelLeftPanel';
import { RoomLabelNormalizePreview } from './RoomLabelNormalizePreview';
import { ROOM_REASON_TITLE, byRoomReason } from './roomReviewReasons';
import type { RoomLabelReviewProps } from './roomLabelTypes';

/**
 * Props của view: ĐÚNG hợp đồng đã đóng băng, không thêm một lát nào.
 *
 * `useRoomLabelReview` trả về chính kiểu này (`UseRoomLabelReviewResult`), nên
 * container chuyền thẳng kết quả hook xuống đây mà không phải nắn hình dạng —
 * và story dựng view bằng cùng một vật.
 */
export type RoomLabelReviewViewProps = RoomLabelReviewProps & {
  /** Breadcrumb dự án › tầng › lớp và thanh lớp (P14). */
  readonly floorNav?: Omit<QcFloorNavProps, 'layer'>;
};

/* -------------------------------------------------------------------------- */
/* Chuỗi tĩnh của vỏ màn (A6 — chữ thường kiểu câu, trừ tên riêng và mã).      */
/* -------------------------------------------------------------------------- */

const SCREEN_TITLE = 'Duyệt phòng';
const L23_TASK = 'Đặt tên cho từng phòng máy tìm thấy. Tên đúng thì giữ, sai thì sửa.';
const CANVAS_SECTION_LABEL = 'Khung xem bản vẽ duyệt phòng';
const EMPTY_TITLE = 'Chưa dò ra phòng nào';
const EMPTY_ACTION_LABEL = 'Kiểm tra lại vòng hở';
const ERROR_TITLE = 'Không đọc được lớp phòng';
const ERROR_ACTION_LABEL = 'Thử lại';
const FORBIDDEN_TITLE = 'Không có quyền sửa lớp phòng';
const EXPAND_PANEL_LABEL = 'Bảng phòng đang thu gọn';

/** Sáu dòng khung xương của cột trái lúc đang tải — đúng khuôn `AxisGridManager`. */
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

/** Nút chữ của màn: cùng khuôn nút bung bảng của `AxisGridManager` (A1, A2). */
const LINK_CLASS_NAME = cn(
  'self-center rounded-md px-1.5 py-0.5 text-[13px] text-accent',
  'transition-colors duration-120 hover:bg-accent-wash',
  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);

/** Khung chung của cột trái, để bốn nhánh thay thế không mỗi chỗ một bề rộng. */
const LEFT_COLUMN_CLASS_NAME =
  'flex h-full w-full flex-col overflow-y-auto rounded-xl bg-bg-surface shadow-panel max-lg:h-auto max-lg:w-full';

/** MỘT khung cho cột trái (NGUYEN-TAC-BO-CUC §2): đầu panel (3 câu) rồi nội dung của nhánh. */
function LeftCard({ head, children, embedded = false }: { readonly head: ReactNode; readonly children: ReactNode; readonly embedded?: boolean }) {
  return (
    <div className={embedded ? 'flex min-h-0 flex-1 flex-col overflow-y-auto' : LEFT_COLUMN_CLASS_NAME}>
      {head}
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cột trái — bốn nhánh loại trừ nhau, nhánh cuối là panel phòng thật.         */
/* -------------------------------------------------------------------------- */

/** `embedded`: bố cục L23, cột nằm trong `QcStepColumn` (H1 ở đầu cột, không khung thẻ riêng). */
function RoomLabelLeftColumn({ embedded = false, ...props }: RoomLabelReviewViewProps & { readonly embedded?: boolean }) {
  const {
    emptyNotice,
    errorMessage,
    gaps,
    hasNamesToNormalize,
    onCheckWallGaps,
    onHover,
    onNavigateToWalls,
    onOpenNormalizePreview,
    onSelect,
    onToggleUnnamedFilter,
    rooms,
    selectedRoomId,
    showOnlyUnnamed,
    state,
    summary,
    viewerRoleNotice,
  } = props;
  /* Tầng thiếu tỷ lệ: danh sách vẫn xem được, chỉ mất nút sửa — như vai người xem (UX-R1 r3). */
  const isViewerRole = props.isViewerRole || props.scaleLock != null;
  const head = embedded ? null : (
    <RoomLabelPanelHead roomProgress={props.roomProgress} saveStatus={props.saveStatus} state={state} summary={summary} />
  );

  if (errorMessage !== null) {
    return (
      <LeftCard embedded={embedded} head={head}>
        <InlineAlert
          action={{ label: ERROR_ACTION_LABEL, onClick: onCheckWallGaps }}
          level="violation"
          message={errorMessage}
          title={ERROR_TITLE}
        />
      </LeftCard>
    );
  }

  /*
   * BUG-321: rỗng vì bộ lọc "Chưa đặt tên" thì câu rỗng bảo tắt bộ lọc — nên
   * panel (có công tắc) vẫn phải hiện, câu rỗng nằm ở chỗ danh sách.
   */
  if (emptyNotice !== null && !showOnlyUnnamed) {
    return (
      <LeftCard embedded={embedded} head={head}>
        {viewerRoleNotice === null ? null : (
          <InlineAlert level="attention" message={viewerRoleNotice} title={FORBIDDEN_TITLE} />
        )}
        <EmptyState
          action={{ label: EMPTY_ACTION_LABEL, onClick: onCheckWallGaps }}
          description={emptyNotice}
          icon={<LayoutGrid />}
          title={EMPTY_TITLE}
        />
        {/* 20-D-007: rỗng vì vòng hở thì phải còn lối "Xem tại lớp tường". */}
        <RoomLabelGapsSection
          gaps={gaps}
          onNavigateToWalls={onNavigateToWalls}
          unclosedRoomCount={summary.unclosedRoomCount}
        />
      </LeftCard>
    );
  }

  if (state === 'loading') {
    return (
      <LeftCard embedded={embedded} head={head}>
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} preset="table-row" />
        ))}
      </LeftCard>
    );
  }

  return (
    <div className="flex h-full min-h-0 shrink-0 flex-col gap-2 max-lg:h-auto">
      {viewerRoleNotice === null ? null : (
        <InlineAlert
          className="w-full"
          level="attention"
          message={viewerRoleNotice}
          title={FORBIDDEN_TITLE}
        />
      )}

      <div className="min-h-0 flex-1">
        <RoomLabelLeftPanel
          embedded={embedded}
          emptyListNotice={emptyNotice}
          head={head}
          oversizedRoom={props.oversizedRoom ?? null}
          list={{ rooms, selectedRoomId, onSelect, onHover, isViewerRole }}
          panel={{
            summary,
            gaps,
            showOnlyUnnamed,
            onToggleUnnamedFilter,
            onOpenNormalizePreview,
            ...(hasNamesToNormalize === undefined ? {} : { hasNamesToNormalize }),
            onCheckWallGaps,
            onNavigateToWalls,
            isViewerRole,
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Màn.                                                                        */
/* -------------------------------------------------------------------------- */

export function RoomLabelReview(props: RoomLabelReviewViewProps) {
  const {
    areaCaption,
    backgroundImageAlt,
    backgroundImageSizeMm,
    backgroundImageUrl,
    hoveredRoomId,
    isCollapsed,
    mergeCandidates,
    millimetresPerPixel,
    nameSuggestions,
    normalizePreview,
    onApplyNormalize,
    onApprove,
    onCancelNormalize,
    onChangeUsage,
    onHover,
    onMerge,
    onNavigateToWalls,
    onRename,
    onSelect,
    onSplit,
    onToggleCollapsed,
    rooms,
    selectedRoomId,
    splitPointMm,
    usageOptions,
    viewerRoleNotice,
  } = props;

  /*
   * Thanh tra nhận PHÒNG ĐÃ CHỌN, không nhận cả mảng: lát
   * `RoomLabelInspectorProps` cố ý chỉ mang một `room | null` (xem docstring
   * `roomLabelTypes.ts`). Phép tìm này là tra một phần tử theo khoá, không phải
   * một phép tính bị R-60 cấm — cùng cách `RoomLabelCanvas.tsx` tra phòng đang
   * chọn để đặt vòng sáng.
   */
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  /* Tầng thiếu tỷ lệ: bản vẽ và chi tiết vẫn xem được, nút chính thành lối sang bước Tỷ lệ (UX-R1 r3). */
  const scaleLock = props.scaleLock ?? null;
  const isViewerRole = props.isViewerRole || scaleLock !== null;

  if (props.readFailure != null) {
    return (
      <QcScreenFrame label={SCREEN_TITLE}>
        <FloorLayerReadFailureScreen failure={props.readFailure} />
      </QcScreenFrame>
    );
  }

  const nav = props.floorNav;
  const l23 = isL23Layout() && nav != null;
  const selectedStatus = rooms.find((room) => room.id === selectedRoomId)?.status;
  const inspectorView = (
    <RoomLabelInspector
      extras={{
        nameSuggestions,
        usageOptions,
        areaCaption,
        mergeCandidates,
        onNavigateToWalls,
        splitPointMm,
        viewerRoleNotice,
        scaleLock,
      }}
      inspector={{
        room: selectedRoom,
        isViewerRole,
        onRename,
        onChangeUsage,
        onMerge,
        onSplit,
        onApprove,
      }}
    />
  );
  const ask =
    l23 && !isCollapsed && selectedRoomId !== null ? (
      <QcQueueAskCard
        items={byRoomReason(rooms).map((room) => ({ id: room.id, pending: room.status !== 'confirmed' }))}
        onSelect={onSelect}
        reason={selectedStatus === undefined || selectedStatus === 'confirmed' ? null : ROOM_REASON_TITLE[selectedStatus]}
        selectedId={selectedRoomId}
        unit="Phòng"
      >
        {inspectorView}
      </QcQueueAskCard>
    ) : null;
  const gate = (inline: boolean) =>
    nav == null || props.state === 'loading' ? null : (
        <FloorReviewGate
          inline={inline}
          floorId={nav.floorId}
          nextLabel={props.nextPendingRoom == null ? undefined : `Duyệt tiếp ${props.nextPendingRoom.codeLabel}`}
          onNext={props.nextPendingRoom == null ? undefined : () => onSelect(props.nextPendingRoom!.id)}
          projectId={nav.projectId}
        />
    );

  return (
    <QcScreenFrame label={SCREEN_TITLE}>
      {props.floorNav != null && <QcFloorNav {...props.floorNav} layer="rooms" minimal={l23} titled={l23 || !isCollapsed} />}
      {l23 ? null : gate(false)}

      {props.saveBlock != null && (
        <div className="px-2 pt-2">
          <FloorLayerSaveBanner saveBlock={props.saveBlock} />
        </div>
      )}

      {props.provisionalScaleNotice != null && (
        <div className="px-2 pt-2">
          <ProvisionalScaleBanner notice={props.provisionalScaleNotice} />
        </div>
      )}

      {/* Khe chung (A3): panel trái | bản vẽ | chi tiết; 1024-1279 chi tiết phủ mép phải bản vẽ. */}
      <QcAskSlot value={ask}>
      <QcWorkspace
        canvas={
          <RoomLabelCanvas
            backgroundImageAlt={backgroundImageAlt}
            backgroundImageSizeMm={backgroundImageSizeMm}
            backgroundImageUrl={backgroundImageUrl}
            hoveredRoomId={hoveredRoomId}
            isInteractive={!isViewerRole}
            millimetresPerPixel={millimetresPerPixel}
            onHover={onHover}
            onSelect={onSelect}
            rooms={rooms}
            selectedRoomId={selectedRoomId}
          />
        }
        wideLeft
        canvasLabel={CANVAS_SECTION_LABEL}
        canvasOverlay={l23 ? <QcFloorDoneCard floorId={nav.floorId} projectId={nav.projectId} /> : null}
        inspector={
          isCollapsed ? (
            <div className="flex shrink-0 items-start justify-end p-1">
              <button className={LINK_CLASS_NAME} onClick={onToggleCollapsed} type="button">
                {EXPAND_PANEL_LABEL}
              </button>
            </div>
          ) : (
            l23 ? null : inspectorView
          )
        }
        column={l23}
        left={
          isCollapsed ? null : l23 && nav != null ? (
            <QcStepColumn activeStep="rooms" floorId={nav.floorId} gate={gate(true)} projectId={nav.projectId} task={L23_TASK}>
              <RoomLabelLeftColumn {...props} embedded />
            </QcStepColumn>
          ) : (
            <RoomLabelLeftColumn {...props} />
          )
        }
        selectionKey={selectedRoomId}
      />
      </QcAskSlot>

      <QcStatusBar onUndo={isViewerRole ? undefined : props.onUndo} saveLabel={false} />

      {/*
       * Hộp thoại xem trước treo NGOÀI ba cột và luôn được gắn: nó tự đóng khi
       * `preview === null` (`Modal.Root isOpen`), nên "thao tác hàng loạt luôn
       * xem trước trước khi áp" không phụ thuộc vào việc cột trái có đang hiện
       * hay không — kể cả ở trạng thái thu gọn.
       */}
      <RoomLabelNormalizePreview
        onApply={onApplyNormalize}
        onCancel={onCancelNormalize}
        preview={normalizePreview}
      />
    </QcScreenFrame>
  );
}
