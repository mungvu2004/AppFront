/**
 * Màn S-18 "Kiểm trục và gốc toạ độ" (`AxisGridManager`) — VIEW THUẦN, khung bàn làm việc
 * S-15 (demo Z/S-18): panel trái (đầu panel + danh sách trục), bản vẽ giữa, cột chi tiết
 * phải với hai khối cố định "Gốc ±0.000" và "Lệch giữa các tầng".
 *
 * Nhận HẾT qua props và chỉ dựng thẻ. Không `@/api`, `@/store`, `@/domain`, `@/lib/http`
 * (R-60). Không tính hình học, không so ngưỡng, không định dạng số: mọi chuỗi tới đây đã
 * xong ở `useAxisGridManager` (A15). Cổng đọc cờ của view-model qua `axisGridGateOf`.
 *
 * ## Ba câu (HOP-DONG-V6)
 * 1. Làm gì: `QcPanelHead` — "Bước 3 · Kiểm tra tầng", H1 "Kiểm trục và gốc toạ độ".
 * 2. Trạng thái: Badge + câu có số trục / gốc tại giao trục nào.
 * 3. Bước tiếp: `FlowGate` — Trục hai hướng / Gốc ±0.000 / Tầng thẳng trục. Chưa đủ: nút
 *    phụ tới việc thiếu ("Vẽ trục ngang", "Xem lệch Tầng 2"); đủ: nút chính "Sang Mô hình 3D".
 *
 * ## Bảy trạng thái (A11)
 * | `state`     | vẽ ở đâu                                                                  |
 * |-------------|----------------------------------------------------------------------------|
 * | `empty`     | thẻ trên bản vẽ "Chưa có trục nào" + "Vẽ trục ngang"                       |
 * | `loading`   | panel trái và cột chi tiết là khung xương                                 |
 * | `partial`   | danh sách trục + thẻ "Chưa có trục ngang…" + "Vẽ trục ngang"               |
 * | `error`     | thẻ lỗi trên bản vẽ: "Thử lại" + "Vẽ trục thủ công"; bản vẽ vẫn xem được   |
 * | `success`   | mặc định; mục lệch tầng tự gắn "Đã duyệt"                                  |
 * | `forbidden` | canvas chỉ xem, panel trái thêm câu giải thích                             |
 * | `collapsed` | panel trái chỉ còn đầu panel + nút bung lại, không cột chi tiết            |
 *
 * Câu chặn 100 mm đi bằng prop riêng `spacingMessage` (không lật màn sang `error`), vẽ
 * thành `InlineAlert role="status"` trên vùng làm việc.
 */

import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { FlowGate } from '@/components/shell/FlowGate';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getButtonStyles } from '@/components/ui/buttonVariants';

import { FloorLayerReadFailureScreen } from '../shared/FloorLayerReadFailureScreen';
import { ProvisionalScaleBanner } from '../shared/ProvisionalScaleBanner';
import { QcPanelHead } from '../shared/QcPanelHead';
import { QcScreenFrame, QcStatusBar, QcWorkspace } from '../shared/QcScreenFrame';
import type { ProvisionalScaleNotice } from '../shared/provisionalScaleNotice';
import type { AxisCanvasBackground } from './useAxisGridManager';
import type { FloorLayerReadFailure } from '../shared/floorLayerReadFailure';

import { AxisGridCanvas, type AxisGridCanvasProps } from './AxisGridCanvas';
import { AxisGridCanvasCard, type AxisGridCanvasCardKind } from './AxisGridCanvasCard';
import { AxisGridFloorAlignList } from './AxisGridFloorAlignList';
import { AXIS_CARD_TEXT, axisGridGateOf, type AxisGridGate } from './axisGridGate';
import { AxisGridLeftPanel } from './AxisGridLeftPanel';
import { AxisGridOriginPanel } from './AxisGridOriginPanel';
import type { AxisGridManagerProps } from './axisGridTypes';

/**
 * Props của view: hợp đồng T3 + `spacingMessage`. `onAxisDrag` lấy hình dạng thô của
 * CANVAS (`number`); container dán nhãn `Pixels` trước khi vào hook (R-60 cấm view chạm
 * `@/domain`).
 */
export interface AxisGridManagerViewProps
  extends Omit<AxisGridManagerProps, 'onAxisDrag'> {
  /** Toạ độ thô của canvas; container gắn nhãn `Pixels` trước khi vào hook. */
  readonly onAxisDrag: AxisGridCanvasProps['onAxisDrag'];
  readonly spacingMessage: string | null;
  /** G4b-20: đổi tên / sửa khoảng cách trục; trả câu lỗi hoặc null. */
  readonly onAxisRename?: ((axisId: string, label: string) => string | null) | undefined;
  readonly onAxisSpacingChange?: ((axisId: string, spacingMm: number) => string | null) | undefined;
  /** BUG-578: câu "chỉ giữ trong phiên" — `null` ở vai chỉ xem. */
  readonly unsavedNotice: string | null;
  /** G4b-15: dải "tỷ lệ tạm" kèm nút "Hiệu chỉnh tỷ lệ"; vắng/`null` khi tầng đã có tỷ lệ. */
  readonly provisionalScaleNotice?: ProvisionalScaleNotice | null | undefined;
  /** G4b-16: ảnh bản vẽ dưới lưới. */
  readonly background?: AxisCanvasBackground | null | undefined;
  /** `QcFloorNav titled` (breadcrumb dự án › tầng › lớp + thanh lớp) — route truyền vào. */
  readonly floorNav?: ReactNode;
  /** BUG-594/601: vì sao "Căn tự động" bị khoá; `null` khi bấm được. */
  readonly autoAlignBlockedReason: string | null;
  /** Đọc lớp hỏng khi chưa có tài liệu → cả màn là một trạng thái lỗi (BUG-326). */
  readonly readFailure?: FloorLayerReadFailure | null | undefined;
  /** RV1-7: số tầng của dự án — phân biệt "chỉ một tầng" với "chưa tải tầng khác" ở công tắc bóng ma. */
  readonly projectFloorCount?: number | undefined;
  /** Bước Mô hình 3D — nút chính của cổng khi đủ ba điều kiện. Vắng (story) thì cổng không có nút này. */
  readonly modelStepHref?: string | undefined;
}

/** Tên vùng giữ nguyên (e2e/qa neo theo nó); H1 thấy được là động từ (vòng 6). */
const SCREEN_TITLE = 'Quản lý trục và gốc toạ độ';
const PANEL_TITLE = 'Kiểm trục và gốc toạ độ';
const CANVAS_SECTION_LABEL = 'Khung xem bản vẽ quản lý trục và gốc toạ độ';
const FORBIDDEN_TITLE = 'Không có quyền sửa trục';
const EXPAND_PANEL_LABEL = 'Bảng trục đang thu gọn';
/** BUG-330, BUG-336: tầng chưa có trục thì nói thẳng, không hiện số 0 hay "Đã duyệt" như dữ liệu thật. */
const ORIGIN_UNAVAILABLE_NOTICE = 'Chưa có trục nào nên chưa tính được gốc toạ độ.';
const ALIGN_UNAVAILABLE_NOTICE = 'Chưa có trục nào nên chưa căn chỉnh được giữa các tầng.';
const CANVAS_EMPTY_NOTICE = 'Chưa có trục nào để hiện trên bản vẽ.';
const CANVAS_ERROR_NOTICE = 'Chưa vẽ được trục vì lớp trục của tầng này chưa đọc được.';

const STATUS_TEXT = {
  loading: 'Đang tính trục',
  error: 'Không tính được trục',
  empty: 'Chưa có trục',
  missingHorizontal: 'Thiếu trục ngang',
  missingVertical: 'Thiếu trục dọc',
  lagging: (floor: string): string => `${floor} lệch quá ngưỡng`,
  ready: 'Đủ điều kiện sang 3D',
  notReady: 'Chưa đủ điều kiện',
  axisCount: (count: number): string => `${count} trục`,
  originAt: (anchor: string): string => `gốc ±0.000 tại ${anchor}`,
  noOrigin: 'chưa đặt được gốc',
  noAxisLine: 'Chưa có trục nào để kiểm',
  viewLagging: (floor: string): string => `Xem lệch ${floor}`,
  laggingLine: (floor: string, offset: string): string => `${floor} lệch ${offset} so với tầng gốc.`,
  alignedLine: 'Các tầng thẳng trục trong ngưỡng.',
  toModel: 'Sang Mô hình 3D',
} as const;

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];
const PANEL_CLASS = 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel max-lg:flex-none';
const GATE_PRIMARY_CLASS = getButtonStyles({ variant: 'primary', size: 'sm' });

/** Thẻ trên bản vẽ: lỗi → rỗng → thiếu một hướng; `null` khi lưới đủ hai hướng. */
function cardKindOf(props: AxisGridManagerViewProps, gate: AxisGridGate): AxisGridCanvasCardKind | null {
  if (props.viewModel.state === 'loading') return null;
  if (props.viewModel.errorMessage !== null) return 'error';
  if (props.viewModel.emptyNotice !== null || props.viewModel.hasNoAxes) return 'empty';
  if (gate.missingDirection === 'horizontal') return 'missingHorizontal';
  if (gate.missingDirection === 'vertical') return 'missingVertical';
  return null;
}

/** Chip + câu có số: đọc từ view-model và cổng, cùng một nguồn với FlowGate. */
function AxisGridStatus({ viewModel, gate }: { readonly viewModel: AxisGridManagerViewProps['viewModel']; readonly gate: AxisGridGate }) {
  const axisCount = viewModel.groups.reduce((sum, group) => sum + group.rows.length, 0);
  const anchor = viewModel.origin.anchorOptions.find((option) => option.value === viewModel.origin.selectedAnchor)?.label;
  const [variant, chip] =
    viewModel.state === 'loading'
      ? (['neutral', STATUS_TEXT.loading] as const)
      : viewModel.errorMessage !== null
        ? (['violation', STATUS_TEXT.error] as const)
        : viewModel.hasNoAxes
          ? (['attention', STATUS_TEXT.empty] as const)
          : gate.missingDirection !== null
            ? (['attention', gate.missingDirection === 'horizontal' ? STATUS_TEXT.missingHorizontal : STATUS_TEXT.missingVertical] as const)
            : gate.laggingFloor !== null
              ? (['attention', STATUS_TEXT.lagging(gate.laggingFloor.name)] as const)
              : gate.isReady
                ? (['neutral', STATUS_TEXT.ready] as const)
                : (['attention', STATUS_TEXT.notReady] as const);
  const line =
    viewModel.state === 'loading' || viewModel.hasNoAxes || viewModel.errorMessage !== null
      ? viewModel.state === 'loading'
        ? null
        : STATUS_TEXT.noAxisLine
      : `${STATUS_TEXT.axisCount(axisCount)}, ${anchor === undefined ? STATUS_TEXT.noOrigin : STATUS_TEXT.originAt(anchor)}.`;

  const alignLine =
    line === null || viewModel.hasNoAxes || viewModel.errorMessage !== null
      ? null
      : gate.laggingFloor !== null
        ? STATUS_TEXT.laggingLine(gate.laggingFloor.name, gate.laggingFloor.offsetText)
        : viewModel.floors.length > 1
          ? STATUS_TEXT.alignedLine
          : null;

  return (
    <>
      <Badge variant={variant}>{chip}</Badge>
      {line === null ? null : <p className="w-full">{line}</p>}
      {/* 1024–1279: cột chi tiết là ngăn kéo đóng — tóm tắt lệch tầng ở đây để không phải mở nó. */}
      {alignLine === null ? null : <p className="hidden w-full lg:max-xl:block">{alignLine}</p>}
    </>
  );
}

/** Nội dung panel trái dưới đầu panel. */
function AxisGridLeftBody(props: AxisGridManagerViewProps) {
  const { viewModel } = props;

  if (viewModel.state === 'loading') {
    return (
      <div className="flex flex-col gap-1 p-3">
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} preset="table-row" />
        ))}
      </div>
    );
  }

  if (viewModel.errorMessage !== null || viewModel.emptyNotice !== null) {
    return (
      <p className="p-4 text-body-sm text-text-secondary">
        {viewModel.errorMessage !== null ? CANVAS_ERROR_NOTICE : CANVAS_EMPTY_NOTICE}
      </p>
    );
  }

  return (
    <>
      {viewModel.viewerRoleNotice === null ? null : (
        <InlineAlert className="m-3 shrink-0" level="attention" message={viewModel.viewerRoleNotice} title={FORBIDDEN_TITLE} />
      )}
      <AxisGridLeftPanel
        ghostEnabled={viewModel.ghostEnabled}
        groups={viewModel.groups}
        hasGhostFloors={viewModel.canvas.ghostFloors.length > 0}
        isViewerRole={viewModel.isViewerRole}
        projectFloorCount={props.projectFloorCount}
        onAxisAdd={props.onAxisAdd}
        onAxisRemove={props.onAxisRemove}
        onAxisRename={props.onAxisRename}
        onAxisSpacingChange={props.onAxisSpacingChange}
        onAxisToggleVisibility={props.onAxisToggleVisibility}
        onGhostToggle={props.onGhostToggle}
        onViewOnDrawing={props.onViewOnDrawing}
      />
    </>
  );
}

/** MỘT nút của cổng: đủ → chính "Sang Mô hình 3D"; chưa đủ → phụ tới việc còn thiếu. */
function AxisGridGateButton({ props, gate }: { readonly props: AxisGridManagerViewProps; readonly gate: AxisGridGate }) {
  if (gate.isReady) {
    return props.modelStepHref === undefined ? null : (
      <Link className={GATE_PRIMARY_CLASS} to={props.modelStepHref}>
        {STATUS_TEXT.toModel}
      </Link>
    );
  }
  if (props.viewModel.errorMessage !== null) {
    return (
      <Button onClick={props.onRetry} size="sm" type="button" variant="secondary">
        {AXIS_CARD_TEXT.retry}
      </Button>
    );
  }
  if (gate.missingDirection !== null && !props.viewModel.isViewerRole) {
    const direction = gate.missingDirection;
    return (
      <Button onClick={() => props.onAxisAdd(direction)} size="sm" type="button" variant="secondary">
        {direction === 'horizontal' ? AXIS_CARD_TEXT.drawHorizontal : AXIS_CARD_TEXT.drawVertical}
      </Button>
    );
  }
  const lagging = gate.laggingFloor;
  return lagging === null ? null : (
    <Button onClick={() => props.onViewFloorOnDrawing(lagging.levelId)} size="sm" type="button" variant="secondary">
      {STATUS_TEXT.viewLagging(lagging.name)}
    </Button>
  );
}

export function AxisGridManager(props: AxisGridManagerViewProps) {
  const { viewModel, spacingMessage } = props;
  const [unsavedDismissed, setUnsavedDismissed] = useState(false);
  const isCollapsed = viewModel.isCollapsed;
  const hasNoAxis = viewModel.hasNoAxes;

  if (props.readFailure != null) {
    return (
      <QcScreenFrame label={SCREEN_TITLE}>
        <FloorLayerReadFailureScreen failure={props.readFailure} />
      </QcScreenFrame>
    );
  }

  const gate = axisGridGateOf(viewModel);
  const cardKind = cardKindOf(props, gate);
  /* Một nút chính mỗi màn: thẻ trên bản vẽ (việc thiếu) > cổng đủ (sang 3D) > "Căn tự động". */
  const isAutoAlignPrimary =
    cardKind === null && !gate.isReady && gate.laggingFloor !== null && props.autoAlignBlockedReason === null;

  const left = (
    <section aria-label={PANEL_TITLE} className={PANEL_CLASS}>
      <QcPanelHead status={<AxisGridStatus gate={gate} viewModel={viewModel} />} title={PANEL_TITLE} />
      {isCollapsed ? (
        <div className="p-4">
          <Button onClick={props.onToggleCollapsed} size="sm" type="button" variant="secondary">
            {EXPAND_PANEL_LABEL}
          </Button>
        </div>
      ) : (
        <AxisGridLeftBody {...props} />
      )}
    </section>
  );

  const inspector = isCollapsed ? null : viewModel.state === 'loading' ? (
    /* Đang tải: khung xương, không in "0 px / 0 mm" và danh sách tầng như dữ liệu thật (BUG-618). */
    <div aria-hidden="true" className="flex flex-col gap-2 rounded-xl bg-bg-surface p-5 shadow-panel">
      {SKELETON_ROWS.map((row) => (
        <Skeleton key={row} preset="table-row" />
      ))}
    </div>
  ) : (
    <div className="flex flex-col divide-y divide-border-default rounded-xl bg-bg-surface shadow-panel">
      <AxisGridOriginPanel
        onAnchorChange={props.onAnchorChange}
        origin={viewModel.origin}
        unavailableNotice={hasNoAxis ? ORIGIN_UNAVAILABLE_NOTICE : null}
      />
      <AxisGridFloorAlignList
        blockedReason={props.autoAlignBlockedReason}
        floors={viewModel.floors}
        isPrimaryAction={isAutoAlignPrimary}
        onAutoAlign={props.onAutoAlign}
        onFloorRowHover={props.onFloorRowHover}
        onViewFloorOnDrawing={props.onViewFloorOnDrawing}
        unavailableNotice={hasNoAxis ? ALIGN_UNAVAILABLE_NOTICE : null}
        warningBanner={viewModel.warningBanner}
      />
    </div>
  );

  return (
    <QcScreenFrame label={SCREEN_TITLE}>
      {props.floorNav}
      <FlowGate conditions={gate.conditions} done={gate.conditions.filter((c) => c.done).length} progressLabel="Điều kiện sang Mô hình 3D" total={gate.conditions.length}>
        <AxisGridGateButton gate={gate} props={props} />
      </FlowGate>

      {props.provisionalScaleNotice == null ? null : (
        <div className="shrink-0 px-4 pb-1">
          <ProvisionalScaleBanner notice={props.provisionalScaleNotice} />
        </div>
      )}

      {/* BUG-578: nói thật — chưa có chỗ lưu lưới trục lên máy chủ. G4b-17: ẩn được để trả chỗ. */}
      {props.unsavedNotice === null || unsavedDismissed ? null : (
        <div className="shrink-0 px-4 pb-1">
          <InlineAlert level="attention" message={props.unsavedNotice} onDismiss={() => setUnsavedDismissed(true)} role="note" />
        </div>
      )}

      {/* Câu chặn 100 mm — nói ra ngay, và không lật màn sang trạng thái lỗi. */}
      {spacingMessage === null ? null : (
        <div className="shrink-0 px-4 pb-1">
          <InlineAlert level="violation" message={spacingMessage} role="status" />
        </div>
      )}

      <QcWorkspace
        canvas={
          <>
            <AxisGridCanvas
              background={props.background ?? null}
              canvas={viewModel.canvas}
              isInteractive={!viewModel.isViewerRole}
              onAxisDrag={props.onAxisDrag}
              onAxisSelect={props.onAxisSelect}
              viewerRoleNotice={viewModel.viewerRoleNotice}
            />
            {cardKind === null ? null : (
              <AxisGridCanvasCard
                isViewerRole={viewModel.isViewerRole}
                kind={cardKind}
                message={
                  cardKind === 'error'
                    ? (viewModel.errorMessage ?? '')
                    : cardKind === 'empty'
                      ? (viewModel.emptyNotice ?? CANVAS_EMPTY_NOTICE)
                      : cardKind === 'missingHorizontal'
                        ? AXIS_CARD_TEXT.missingHorizontalBody
                        : AXIS_CARD_TEXT.missingVerticalBody
                }
                onAddAxis={(direction) => props.onAxisAdd(direction)}
                onRetry={props.onRetry}
              />
            )}
          </>
        }
        canvasLabel={CANVAS_SECTION_LABEL}
        inspector={inspector}
        left={left}
        selectionKey={viewModel.groups.flatMap((group) => group.rows).find((row) => row.isSelected)?.id ?? null}
      />

      {/* Khe chung (A3): lưới trục chưa có ngăn hoàn tác — nút đứng cùng chỗ, tắt. */}
      <QcStatusBar />
    </QcScreenFrame>
  );
}
