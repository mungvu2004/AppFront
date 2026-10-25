/**
 * Màn Xử lý (`ProcessingScreen`) — khung của route `ROUTE_PATTERNS.projectPipeline`
 * (`/projects/:id/pipeline`).
 *
 * View THUẦN (mục D, R-60): chỉ nhận props và vẽ. Không chạm một tầng dữ liệu
 * nào — không api, không store, không domain, không tầng http. Mọi câu tiếng
 * Việt và mọi con số đã định dạng xong ở hook — file này không gọi `toFixed`,
 * không `toLocaleString`, không quy đổi đơn vị (A15).
 *
 * ## Bố cục (bản Z, `ui-review/redesign/Z/S-10`)
 *
 * `PageHead` (eyebrow, H1 động từ + đối tượng, chip + câu trạng thái), rồi hai
 * khung. Trái: bản vẽ của tầng, tab "Bản vẽ" / "Nhật ký". Phải: sáu bước có kết
 * quả trên hàng và cổng "Để sang Kiểm tra tầng" cố định ở đáy khung. Chip, tiêu đề
 * khung, điều kiện và nút chính sinh từ MỘT hàm `deriveProcessingGate`.
 *
 * ## Bảy trạng thái (A11)
 *
 * | `state`     | thân màn                                                        |
 * |-------------|-----------------------------------------------------------------|
 * | `loading`   | bốn khung xương, chưa gọi tới cây bước                           |
 * | `empty`     | `EmptyState` — chưa có bước nào để theo dõi                      |
 * | `partial`   | hai khung đầy đủ; `partialNoticeLine` nói rõ xử lý vẫn tiếp tục  |
 * | `error`     | hai khung đầy đủ, cộng `InlineAlert` kèm mã kỹ thuật ở đầu màn   |
 * | `success`   | hai khung; cổng có đúng một nút chính theo điều kiện tỷ lệ       |
 * | `forbidden` | hai khung đầy đủ; `canCancel` sai nên nút huỷ biến mất hẳn       |
 * | `collapsed` | một thanh bước + "Xem tất cả các bước"; dưới 1024px khung xếp dọc |
 *
 * Không nhánh nào trả `null`: đường dẫn và tiêu đề luôn được vẽ.
 *
 * ## Huỷ xử lý
 *
 * Xác nhận NGAY TẠI CHỖ ở đầu khung bước (`ProcessingGatePanel`), không hộp thoại.
 */

import { ScanLine } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { BACK_TO_PROJECTS_LABEL } from '@/components/feedback/ProjectSpatialGate';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';

import { deriveProcessingGate } from './processingGate';
import { ProcessingFloorChips } from './ProcessingFloorChips';
import { ProcessingCancel, ProcessingGatePanel } from './ProcessingGatePanel';
import { ProcessingLogPanel } from './ProcessingLogPanel';
import { ProcessingPreviewPanel } from './ProcessingPreviewPanel';
import type { ProcessingErrorAlertViewModel, ProcessingScreenProps } from './types';

const BREADCRUMB_PROJECTS = 'Dự án';
const BREADCRUMB_PIPELINE = 'Xử lý';
const EYEBROW = 'Bước 2 · Xử lý';
const TITLE_PREFIX = 'Theo dõi AI đọc bản vẽ';
const DRAWING_PREFIX = 'Bản vẽ';

const RUN_IN_BACKGROUND_LABEL = 'Chạy nền, báo tôi khi xong';
const SUPPORT_LABEL = 'Liên hệ hỗ trợ';
const RETRY_LABEL = 'Thử lại';

const TABS_ARIA_LABEL = 'Bản vẽ hoặc nhật ký';
const TAB_PREVIEW_LABEL = 'Bản vẽ';
const TAB_LOG_LABEL = 'Nhật ký';

const EMPTY_TITLE = 'Chưa có bước nào để theo dõi';
const EMPTY_DESCRIPTION = 'Khi bản vẽ được đưa vào hàng đợi, các bước xử lý sẽ hiện ở đây.';
const EMPTY_ACTION_LABEL = 'Tải bản vẽ';

/** Bao nhiêu khung xương lúc chưa biết bước nào đã xong. */
const SKELETON_ROW_COUNT = 4;

/** N5-04 — lối riêng sang màn chất lượng ảnh, không biến bước `qualityCheck` thành link. */
const NO_DRAWING_ARIA_LABEL = 'Tầng chưa có bản vẽ';
const NO_DRAWING_LABEL = 'chưa có bản vẽ';
const UPLOAD_FLOOR_LABEL = 'Tải bản vẽ cho tầng này';
const OPEN_QUALITY_LABEL = 'Kiểm tra chất lượng ảnh đầu vào';

/** Nút chìm cạnh `.ph`: chạy nền, lối sang chất lượng ảnh, huỷ — luôn có mặt kể cả lúc tải. */
function ProcessingHeadActions(props: ProcessingScreenProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {props.onOpenQuality !== undefined ? (
        <Button onClick={props.onOpenQuality} size="sm" variant="ghost">
          {OPEN_QUALITY_LABEL}
        </Button>
      ) : null}
      {props.canRunInBackground ? (
        <Button onClick={props.onRunInBackground} size="sm" variant="ghost">
          {RUN_IN_BACKGROUND_LABEL}
        </Button>
      ) : null}
      <ProcessingCancel {...props} />
    </div>
  );
}

/** Khung trái: bản vẽ của tầng đang xử lý, tab "Nhật ký" thay chỗ. API compound của `Tabs`. */
function ProcessingDrawingSection({
  floorLabel,
  props,
}: {
  readonly floorLabel: string | undefined;
  readonly props: ProcessingScreenProps;
}) {
  return (
    <Tabs.Root
      activeId={props.activeTab}
      onChange={(id) => {
        props.onTabChange(id === 'log' ? 'log' : 'preview');
      }}
    >
      <Section
        actions={
          <Tabs.List aria-label={TABS_ARIA_LABEL}>
            <Tabs.Tab id="preview">{TAB_PREVIEW_LABEL}</Tabs.Tab>
            <Tabs.Tab id="log">{TAB_LOG_LABEL}</Tabs.Tab>
          </Tabs.List>
        }
        className="h-full"
        title={floorLabel === undefined ? DRAWING_PREFIX : `${DRAWING_PREFIX} ${floorLabel}`}
      >
        <Tabs.Panel id="preview">
          <ProcessingPreviewPanel prefersReducedMotion={props.prefersReducedMotion} preview={props.previewPanel} />
        </Tabs.Panel>
        <Tabs.Panel id="log">
          <ProcessingLogPanel
            isAutoScrollLocked={props.isLogAutoScrollLocked}
            logLines={props.logLines}
            {...(props.runs !== undefined ? { runs: props.runs } : {})}
            onCopyLog={props.onCopyLog}
            onToggleAutoScroll={props.onToggleLogAutoScroll}
          />
        </Tabs.Panel>
      </Section>
    </Tabs.Root>
  );
}

/** Lỗi đọc tiến độ của cả màn (bước hỏng là S-14, gắn thay ở container). */
function ProcessingErrorAlert({ errorAlert }: { readonly errorAlert: ProcessingErrorAlertViewModel }) {
  if (errorAlert.isProjectMissing === true) {
    // Dự án không có: một câu, một lối về danh sách — không "Thử lại", không mã nội bộ (BUG-312).
    return (
      <InlineAlert
        action={{ label: BACK_TO_PROJECTS_LABEL, onClick: errorAlert.onBackToProjects ?? errorAlert.onRetry }}
        level="violation"
        message={errorAlert.message}
        title={errorAlert.title}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <InlineAlert
        action={{ label: RETRY_LABEL, onClick: errorAlert.onRetry }}
        level="violation"
        message={errorAlert.message}
        title={errorAlert.title}
      />
      <div className="flex flex-wrap items-center gap-3">
        {errorAlert.technicalCode === 'INTERNAL' ? null : (
          <span className="font-mono text-[12px] font-medium text-text-muted">{errorAlert.technicalCode}</span>
        )}
        <Button onClick={errorAlert.onGoToSupport} size="sm" variant="ghost">
          {SUPPORT_LABEL}
        </Button>
      </div>
    </div>
  );
}

/** Màn Xử lý như một hàm của props (mục D) — test và story dựng thẳng cái này. */
export function ProcessingScreen(props: ProcessingScreenProps) {
  const { errorAlert } = props;
  const gate = deriveProcessingGate(props);
  const isSheet = props.isCompact || props.state === 'collapsed';
  const isProjectMissing = errorAlert?.isProjectMissing === true;
  const showsState = !isProjectMissing && props.state !== 'loading' && props.state !== 'empty';
  const floorLabel = (props.floors.find((floor) => floor.isActive) ?? props.floors[0])?.label;

  const body =
    props.state === 'loading' ? (
      <div className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_unused, index) => (
          <Skeleton key={index} preset="table-row" />
        ))}
      </div>
    ) : props.state === 'empty' ? (
      <EmptyState
        action={{ label: EMPTY_ACTION_LABEL, onClick: props.onUploadDrawings }}
        description={EMPTY_DESCRIPTION}
        icon={<ScanLine aria-hidden="true" />}
        title={EMPTY_TITLE}
      />
    ) : (
      // Dưới 1024px hai khung xếp dọc trong dòng chảy trang (BUG-294, BUG-285).
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <ProcessingDrawingSection floorLabel={floorLabel} props={props} />
        <ProcessingGatePanel gate={gate} isSheet={isSheet} props={props} />
      </div>
    );

  return (
    <div className="min-h-screen bg-bg-app">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 p-8">
        {/* Đường dẫn chung: "Dự án" bấm được về danh sách (BUG-546). */}
        <Breadcrumb
          ariaLabel={BREADCRUMB_PIPELINE}
          items={[
            {
              id: 'projects',
              label: BREADCRUMB_PROJECTS,
              ...(props.onBackToProjects !== undefined ? { onClick: props.onBackToProjects } : {}),
            },
            ...(props.projectName !== undefined ? [{ id: 'project', label: props.projectName }] : []),
            { id: 'current', label: BREADCRUMB_PIPELINE },
          ]}
        />

        <PageHead
          className="mb-2"
          eyebrow={EYEBROW}
          next={<ProcessingHeadActions {...props} />}
          status={
            showsState ? (
              <>
                <Badge variant={gate.chipVariant}>{gate.chipLabel}</Badge>
                {/* Thời gian còn lại đổi mỗi giây nên đứng ngoài vùng `role=status` (R1-03). */}
                <p>
                  <span role="status">{props.overallSummaryLine}</span>
                  {props.remainingLine !== undefined ? ` · ${props.remainingLine}` : null}
                </p>
              </>
            ) : undefined
          }
          title={floorLabel === undefined ? TITLE_PREFIX : `${TITLE_PREFIX} ${floorLabel}`}
        />

        {props.queueLine !== undefined ? <p className="text-[13px] text-text-secondary">{props.queueLine}</p> : null}

        {errorAlert !== undefined ? <ProcessingErrorAlert errorAlert={errorAlert} /> : null}

        {isProjectMissing ? null : (
          <>
            {/* Dải chip tầng chỉ khi dự án có từ hai tầng (GHI-CHU S-10). */}
            {props.floors.length > 1 ? <ProcessingFloorChips floors={props.floors} /> : null}

            {props.floorsWithoutDrawing !== undefined && props.floorsWithoutDrawing.length > 0 ? (
              <ul aria-label={NO_DRAWING_ARIA_LABEL} className="flex flex-col gap-1">
                {props.floorsWithoutDrawing.map((floor) => (
                  <li className="flex flex-wrap items-center gap-2 text-[13px]" key={floor.id}>
                    <span className="font-medium text-text-primary">{floor.label}</span>
                    <span className="text-text-secondary">{NO_DRAWING_LABEL}</span>
                    {/* Tên riêng theo tầng (RV2#8), vẫn chứa chữ nhìn thấy (label-in-name). */}
                    <Button
                      aria-label={`${UPLOAD_FLOOR_LABEL}: ${floor.label}`}
                      onClick={props.onUploadDrawings}
                      size="sm"
                      variant="ghost"
                    >
                      {UPLOAD_FLOOR_LABEL}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div role="status">
              {props.partialNoticeLine !== undefined ? (
                <p className="text-[13px] text-text-secondary">{props.partialNoticeLine}</p>
              ) : null}
            </div>

            {body}
          </>
        )}
      </div>
    </div>
  );
}
