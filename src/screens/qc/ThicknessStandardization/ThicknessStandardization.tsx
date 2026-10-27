/**
 * Màn S-21 "Chuẩn hoá độ dày tường" (`ThicknessStandardization`) — VIEW THUẦN, bản Z (demo
 * đã duyệt ở `ui-review/redesign/Z/S-21`): panel trái + bản vẽ, không rail, không inspector.
 *
 * ```
 * ┌ thanh bước ……………………………………… FlowGate: Tường · 2/81 · [Về duyệt tường] ┐
 * ├ panel trái 400 (320 ở 1024) ──────┬ bản vẽ (≥ 65 % bề ngang) ────────────┤
 * │ QcPanelHead: H1 + Badge + số + lưu │ mặt bằng tô theo nhóm, rê nhóm/cột    │
 * │ biểu đồ phân bố + vạch ngưỡng      │ thì các đoạn cùng sáng; chú giải nổi  │
 * │ ba nhóm (ô đồng ý KHÔNG tích sẵn)  │                                       │
 * │ đoạn không đổi (mã = link)         │                                       │
 * │ chân dính đáy: câu lô + MỘT nút    │                                       │
 * └ thanh trạng thái: Hoàn tác · gợi ý · phím ─────────────────────────────────┘
 * ```
 *
 * Ba câu (HOP-DONG-V6): 1. H1 "Chuẩn hoá độ dày tường"; 2. Badge + "51/81 đoạn không chuẩn,
 * 30 đúng chuẩn" + đã lưu; 3. `FlowGate` giống S-15 (nút phụ "Về duyệt tường"; khi không còn
 * gì để đổi thì nó thành nút chính). Bảng từng đoạn (đổi nhóm tay, gán theo lô) mở trong ngăn
 * kéo. Nhận HẾT qua props, không tính, không định dạng số (R-60, A15).
 */

import { useId, useState } from 'react';
import { ChevronDown, Layers } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Drawer } from '@/components/overlay/Drawer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/utils';

import { FloorLayerSaveBanner } from '../WallLayerReview/FloorLayerSaveBanner';
import { FloorLayerReadFailureScreen } from '../shared/FloorLayerReadFailureScreen';
import { ProvisionalScaleBanner } from '../shared/ProvisionalScaleBanner';
import { FloorReviewGate } from '../shared/FloorReviewGate.container';
import { QcFloorNav, type QcFloorNavProps } from '../shared/QcFloorNav';
import { QcPanelHead } from '../shared/QcPanelHead';
import { QcScreenFrame, QcStatusBar } from '../shared/QcScreenFrame';

import { ThicknessBatchFooter, ThicknessBatchPanel } from './ThicknessBatchPanel';
import { ThicknessHistogram } from './ThicknessHistogram';
import { ThicknessPreviewCanvas } from './ThicknessPreviewCanvas';
import { ThicknessSegmentTable } from './ThicknessSegmentTable';
import type { ThicknessBatchProps, ThicknessBatchStatus } from './thicknessBatch';
import type {
  ThicknessApplyBarProps,
  ThicknessSegmentTableProps,
  ThicknessStandardizationProps,
} from './thicknessTypes';

/**
 * Props của view: hợp đồng toàn màn + phần lô của bản Z + bảy trường chọn hàng của bảng chi
 * tiết — đúng kiểu `useThicknessStandardization` trả về, container trải thẳng xuống.
 */
export type ThicknessStandardizationViewProps = ThicknessStandardizationProps &
  ThicknessBatchProps & {
    readonly floorNav?: Omit<QcFloorNavProps, 'layer'>;
  } & Pick<ThicknessApplyBarProps, 'onDismissReapplyWarning'> &
  Pick<
    ThicknessSegmentTableProps,
    | 'selectedWallIds'
    | 'onToggleRowSelected'
    | 'onToggleAllSelected'
    | 'onClearSelection'
    | 'onChangeNormalizedGroup'
    | 'onApplySelectedGroup'
    | 'flashingWallIds'
  >;

/* -------------------------------------------------------------------------- */
/* Chuỗi tĩnh (A6 — chữ thường kiểu câu, trừ tên riêng và mã).                 */
/* -------------------------------------------------------------------------- */

const SCREEN_TITLE = 'Độ dày tường';
const PANEL_LABEL = 'Bảng chuẩn hoá độ dày';
const CANVAS_REGION_LABEL = 'Bản vẽ theo nhóm độ dày';
const HISTOGRAM_SECTION_LABEL = 'Phân bố độ dày đo được';
/* K30/K08: ngưỡng là việc hiếm — gập vào "nâng cao", mở ra có một câu nói ngưỡng là gì. */
const THRESHOLD_TOGGLE_LABEL = 'Ngưỡng chia nhóm (nâng cao)';
const THRESHOLD_HINT =
  'Máy xếp mỗi đoạn tường vào nhóm độ dày chuẩn gần nhất. Mỗi ngưỡng là ranh giới giữa hai nhóm. Chỉ kéo khi máy xếp sai nhóm.';
const ERROR_TITLE = 'Không đọc được lớp số đo độ dày';
const FORBIDDEN_TITLE = 'Không có quyền sửa độ dày tường';
const NAVIGATE_WALLS_LABEL = 'Về duyệt tường';
const EMPTY_TITLE = 'Chưa có đoạn tường nào để chuẩn hoá';
const EMPTY_DESCRIPTION = 'Sang lớp tường để dò lại các đoạn tường, rồi quay lại đây.';
const EXPAND_PREVIEW_LABEL = 'Mở khung xem trước';
const DETAIL_TITLE = 'Bảng từng đoạn tường';
const STATUS_HINT = 'Rê một nhóm hoặc một cột để sáng các đoạn trên bản vẽ';
const KEY_HINTS = [
  { key: 'Enter', label: 'đổi' },
  { key: 'Ctrl+Z', label: 'hoàn tác' },
] as const;

const STATUS_BADGE: Readonly<
  Record<ThicknessBatchStatus, { readonly variant: 'verified' | 'attention' | 'neutral'; readonly label: string }>
> = {
  empty: { variant: 'neutral', label: 'Chưa có số đo' },
  pending: { variant: 'attention', label: 'Chưa chuẩn hoá' },
  manual: { variant: 'attention', label: 'Còn đoạn xem tay' },
  done: { variant: 'verified', label: 'Đã chuẩn hoá' },
};
/* K08: tỷ lệ còn tạm thì số đo chưa tin được — không gắn xanh "Đã chuẩn hoá" lên đó. */
const DONE_PROVISIONAL_BADGE = { variant: 'attention', label: 'Chuẩn hoá theo tỷ lệ tạm' } as const;

const SKELETON_ROWS = [0, 1, 2, 3];

/* -------------------------------------------------------------------------- */
/* Màn.                                                                        */
/* -------------------------------------------------------------------------- */

export function ThicknessStandardization(props: ThicknessStandardizationViewProps) {
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [isThresholdOpen, setThresholdOpen] = useState(false);
  const thresholdId = useId();
  const { segmentRows, saveLabel } = props;
  /* Vai người xem, hoặc tầng khoá vì thiếu tỷ lệ (K49): không ô đồng ý, không nút đổi, không gợi ý phím. */
  const isReadOnly = props.isViewerRole || props.isScaleLocked === true;
  const segmentCount = segmentRows.length;

  /* Đọc lớp hỏng khi chưa có tài liệu: một trạng thái lỗi, một lối ra (BUG-326). */
  if (props.readFailure != null) {
    return (
      <QcScreenFrame label={SCREEN_TITLE}>
        {props.floorNav != null && <QcFloorNav {...props.floorNav} layer="thickness" />}
        <FloorLayerReadFailureScreen failure={props.readFailure} />
      </QcScreenFrame>
    );
  }

  const badge =
    props.batchStatus === 'done' && props.provisionalScaleNotice != null
      ? DONE_PROVISIONAL_BADGE
      : STATUS_BADGE[props.batchStatus];

  return (
    <QcScreenFrame label={SCREEN_TITLE}>
      {props.floorNav != null && <QcFloorNav {...props.floorNav} layer="thickness" titled />}

      {/* Câu 3: cổng chung của tầng. */}
      {props.floorNav != null && <FloorReviewGate floorId={props.floorNav.floorId} projectId={props.floorNav.projectId} />}

      <div className="flex min-h-0 flex-1 gap-2 p-2">
        <aside
          aria-label={PANEL_LABEL}
          className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel lg:w-[320px] xl:w-[400px]"
        >
          <QcPanelHead
            status={
              <>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {segmentCount === 0 ? null : (
                  <span className="font-medium tabular-nums text-text-primary">{props.statusSentence}</span>
                )}
                {saveLabel === null ? null : <span className="text-text-muted">{saveLabel}</span>}
              </>
            }
            title={SCREEN_TITLE}
          />

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-4">
            {props.saveBlock == null ? null : <FloorLayerSaveBanner saveBlock={props.saveBlock} />}
            {props.provisionalScaleNotice == null ? null : (
              <ProvisionalScaleBanner notice={props.provisionalScaleNotice} />
            )}
            {props.errorMessage === null ? null : (
              <InlineAlert level="violation" message={props.errorMessage} title={ERROR_TITLE} />
            )}
            {props.viewerRoleNotice === null ? null : (
              <InlineAlert level="attention" message={props.viewerRoleNotice} title={FORBIDDEN_TITLE} />
            )}

            <section aria-label={HISTOGRAM_SECTION_LABEL} className="flex flex-col gap-2">
              <button
                aria-controls={thresholdId}
                aria-expanded={isThresholdOpen}
                className="flex w-full items-center justify-between rounded-md py-1 text-[13px] font-medium text-text-secondary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => setThresholdOpen((open) => !open)}
                type="button"
              >
                {THRESHOLD_TOGGLE_LABEL}
                <ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform duration-180', isThresholdOpen && 'rotate-180')} />
              </button>
              {isThresholdOpen && (
                <div className="flex flex-col gap-2" id={thresholdId}>
                  <h2 className="text-body font-medium text-text-primary">{HISTOGRAM_SECTION_LABEL}</h2>
                  <p className="text-body-sm text-text-secondary">{THRESHOLD_HINT}</p>
                  <ThicknessHistogram
                    bins={props.bins}
                    hoveredBinIndex={props.hoveredBinIndex}
                    isLoading={props.isLoading}
                    onHoverBin={props.onHoverBin}
                    onThresholdDrag={props.onThresholdDrag}
                    thresholdLabels={props.thresholdLabels}
                    thresholds={props.thresholds}
                  />
                </div>
              )}
            </section>

            {props.state === 'loading' ? (
              <div className="flex flex-col gap-2">
                {SKELETON_ROWS.map((row) => (
                  <Skeleton key={row} preset="table-row" />
                ))}
              </div>
            ) : segmentCount === 0 ? (
              <EmptyState
                {...(props.onNavigateToWalls === undefined
                  ? {}
                  : {
                      action: { label: NAVIGATE_WALLS_LABEL, onClick: props.onNavigateToWalls, variant: 'secondary' as const },
                    })}
                description={props.emptyNotice ?? EMPTY_DESCRIPTION}
                icon={<Layers />}
                title={EMPTY_TITLE}
              />
            ) : (
              <ThicknessBatchPanel
                hoveredGroup={props.hoveredGroup}
                isReadOnly={isReadOnly}
                manualRows={props.manualRows}
                onHoverGroup={props.onHoverGroup}
                onOpenDetail={() => setDetailOpen(true)}
                onOpenWall={props.onOpenWall}
                onToggleGroupAccepted={props.onToggleGroupAccepted}
                segmentCount={segmentCount}
                targetGroups={props.targetGroups}
              />
            )}
          </div>

          {segmentCount === 0 ? null : (
            <ThicknessBatchFooter
              batchCount={props.batchCount}
              batchSentence={props.batchSentence}
              candidateCount={props.candidateCount}
              groupCount={props.targetGroups.length}
              isReadOnly={isReadOnly}
              onAcceptAllGroups={props.onAcceptAllGroups}
              onApplyBatch={props.onApplyBatch}
            />
          )}
        </aside>

        <section aria-label={CANVAS_REGION_LABEL} className="relative min-h-0 min-w-0 flex-1">
          {props.isCollapsed ? (
            <div className="flex h-full items-center justify-center rounded-xl bg-bg-sunken">
              <Button onClick={props.onToggleCollapsed} size="sm" variant="secondary">
                {EXPAND_PREVIEW_LABEL}
              </Button>
            </div>
          ) : (
            <ThicknessPreviewCanvas
              attentionWallIds={[
                ...props.targetGroups.flatMap((group) => group.wallIds),
                ...props.manualRows.map((row) => row.wallId),
              ]}
              hoveredBinWallIds={props.hoveredBinIndex === null ? undefined : props.bins[props.hoveredBinIndex]?.wallIds}
              hoveredGroup={props.hoveredGroup}
              hoveredWallId={props.hoveredWallId}
              isCollapsed={false}
              legend={props.legend}
              onHoverWall={props.onHoverWall}
              shapes={props.shapes}
            />
          )}
        </section>
      </div>

      <Drawer.Root isOpen={isDetailOpen} label={DETAIL_TITLE} onClose={() => setDetailOpen(false)} size={1080}>
        <Drawer.Header>
          <h2 className="text-heading text-text-primary">{DETAIL_TITLE}</h2>
        </Drawer.Header>
        <Drawer.Body>
          <ThicknessSegmentTable
            flashingWallIds={props.flashingWallIds}
            hoveredWallId={props.hoveredWallId}
            isReadOnly={isReadOnly}
            onApplySelectedGroup={props.onApplySelectedGroup}
            onChangeNormalizedGroup={props.onChangeNormalizedGroup}
            onChangeSortKey={props.onChangeSortKey}
            onClearSelection={props.onClearSelection}
            onHoverRow={props.onHoverWall}
            onToggleAllSelected={props.onToggleAllSelected}
            onToggleRowSelected={props.onToggleRowSelected}
            rows={segmentRows}
            selectedWallIds={props.selectedWallIds}
            sortKey={props.sortKey}
          />
        </Drawer.Body>
      </Drawer.Root>

      <QcStatusBar onUndo={isReadOnly ? undefined : props.onUndo} saveLabel={false}>
        <span className="truncate text-body-sm text-text-secondary max-lg:hidden">{STATUS_HINT}</span>
        <span className="ml-auto flex items-center gap-3 text-caption text-text-secondary">
          {isReadOnly
            ? null
            : KEY_HINTS.map((hint) => (
                <span key={hint.key} className="flex items-center gap-1">
                  <Kbd>{hint.key}</Kbd>
                  {hint.label}
                </span>
              ))}
        </span>
      </QcStatusBar>
    </QcScreenFrame>
  );
}
