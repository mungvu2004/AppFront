/**
 * Màn Xử lý (`ProcessingScreen`) — khung của route `ROUTE_PATTERNS.projectPipeline`
 * (`/projects/:id/pipeline`).
 *
 * View THUẦN (mục D, R-60): chỉ nhận props và vẽ. Không chạm một tầng dữ liệu
 * nào — không api, không store, không domain, không tầng http. Mọi câu tiếng
 * Việt và mọi con số đã định dạng xong ở hook — file này không gọi `toFixed`,
 * không `toLocaleString`, không quy đổi đơn vị (A15).
 *
 * ## Bố cục
 *
 * Nội dung giới hạn 1280px trên nền `--bg-app`. Trên cùng là đường dẫn, hàng
 * hành động, và dãy chip tầng chạy ngang qua cả hai cột. Cột trái 60% là cây
 * bước cộng bốn dòng tầng kèm số đối tượng đã nhận; cột phải rộng cố định 344px
 * là hai tab "Xem trước" / "Nhật ký", mặc định Xem trước. Dưới hai cột là khối
 * tổng kết (khi có) rồi một dòng tóm tắt chữ đều.
 *
 * ## Bảy trạng thái (A11)
 *
 * | `state`     | thân màn                                                        |
 * |-------------|-----------------------------------------------------------------|
 * | `loading`   | bốn khung xương, chưa gọi tới cây bước                           |
 * | `empty`     | `EmptyState` — chưa có bước nào để theo dõi                      |
 * | `partial`   | hai cột đầy đủ; `partialNoticeLine` nói rõ xử lý vẫn tiếp tục     |
 * | `error`     | hai cột đầy đủ, cộng `InlineAlert` kèm mã kỹ thuật ở đầu màn     |
 * | `success`   | hai cột đầy đủ, cộng khối tổng kết                               |
 * | `forbidden` | hai cột đầy đủ; `canCancel` sai nên nút huỷ biến mất hẳn         |
 * | `collapsed` | một thanh bước + "Xem tất cả các bước"; dưới 1024px tab xếp dưới  |
 *
 * Không nhánh nào trả `null`: đường dẫn, hàng hành động và dòng tóm tắt luôn
 * được vẽ, nên màn trắng — thất bại duy nhất A11 tồn tại để chặn — không có chỗ
 * xảy ra.
 *
 * ## Huỷ xử lý
 *
 * Xác nhận NGAY TẠI CHỖ: hai nút inline thay cho nút huỷ. Không `Modal`, không
 * `role="dialog"`, không `aria-modal` — mục [CẤM TUYỆT ĐỐI] cấm hộp thoại chặn
 * trong màn này. `Escape` đóng lớp xác nhận đó (A12), vì nó là lớp trên cùng
 * duy nhất màn này dựng ra.
 */

import { ScanLine } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { BACK_TO_PROJECTS_LABEL } from '@/components/feedback/ProjectSpatialGate';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';

import { ProcessingFloorChips } from './ProcessingFloorChips';
import { ProcessingLogPanel } from './ProcessingLogPanel';
import { ProcessingPreviewPanel } from './ProcessingPreviewPanel';
import { ProcessingStepBar } from './ProcessingStepBar';
import { ProcessingStepList } from './ProcessingStepList';
import { ProcessingSummary } from './ProcessingSummary';
import type { ProcessingScreenProps } from './types';

const BREADCRUMB_PROJECTS = 'Dự án';
const BREADCRUMB_PIPELINE = 'Xử lý';

const RUN_IN_BACKGROUND_LABEL = 'Để chạy nền và thông báo cho tôi';
const CANCEL_LABEL = 'Huỷ xử lý';
const CANCEL_CONFIRM_ARIA_LABEL = 'Xác nhận huỷ xử lý';
const CANCEL_CONFIRM_QUESTION = 'Huỷ lượt xử lý này?';
const CANCEL_CONFIRM_LABEL = 'Xác nhận huỷ';
const CANCEL_DISMISS_LABEL = 'Giữ nguyên';

const SUPPORT_LABEL = 'Liên hệ hỗ trợ';
const RETRY_LABEL = 'Thử lại';

const TABS_ARIA_LABEL = 'Xem trước hoặc nhật ký';
const TAB_PREVIEW_LABEL = 'Xem trước';
const TAB_LOG_LABEL = 'Nhật ký';

const FLOOR_OBJECTS_ARIA_LABEL = 'Số đối tượng đã nhận theo tầng';

const EMPTY_TITLE = 'Chưa có bước nào để theo dõi';
const EMPTY_DESCRIPTION = 'Khi bản vẽ được đưa vào hàng đợi, các bước xử lý sẽ hiện ở đây.';
const EMPTY_ACTION_LABEL = 'Tải bản vẽ';

/** Bao nhiêu khung xương lúc chưa biết bước nào đã xong. */
const SKELETON_ROW_COUNT = 4;

const ALL_STEPS_LABEL = 'Xem tất cả các bước';

/** Hàng hành động đầu trang: nút chìm chạy nền khi còn lượt đang chạy, nút huỷ thì tuỳ quyền. */
function ProcessingActions(props: ProcessingScreenProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {props.canRunInBackground ? (
        <Button onClick={props.onRunInBackground} size="sm" variant="ghost">
          {RUN_IN_BACKGROUND_LABEL}
        </Button>
      ) : null}

      {!props.canCancel ? null : props.isCancelConfirming ? (
        <div
          aria-label={CANCEL_CONFIRM_ARIA_LABEL}
          className="flex flex-wrap items-center gap-2 rounded-[8px] border border-border-default bg-bg-surface px-3 py-1.5"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              props.onDismissCancel();
            }
          }}
          role="group"
        >
          <span className="text-[13px] text-text-secondary">{CANCEL_CONFIRM_QUESTION}</span>
          <Button onClick={props.onConfirmCancel} size="sm" variant="danger">
            {CANCEL_CONFIRM_LABEL}
          </Button>
          <Button onClick={props.onDismissCancel} size="sm" variant="ghost">
            {CANCEL_DISMISS_LABEL}
          </Button>
        </div>
      ) : (
        <Button onClick={props.onRequestCancel} size="sm" variant="secondary">
          {CANCEL_LABEL}
        </Button>
      )}
    </div>
  );
}

/** Cột phải: hai tab, mặc định "Xem trước". API compound của `Tabs`, không phải dạng legacy. */
function ProcessingPanels(props: ProcessingScreenProps) {
  return (
    <Tabs.Root
      activeId={props.activeTab}
      onChange={(id) => {
        props.onTabChange(id === 'log' ? 'log' : 'preview');
      }}
    >
      <Tabs.List aria-label={TABS_ARIA_LABEL}>
        {/* Vùng chạm 44 dưới 640 px, cùng khuôn `Button` (h-11 sm:h-9). */}
        <Tabs.Tab id="preview">{TAB_PREVIEW_LABEL}</Tabs.Tab>
        <Tabs.Tab id="log">{TAB_LOG_LABEL}</Tabs.Tab>
      </Tabs.List>
      <div className="relative pt-4">
        <Tabs.Panel id="preview">
          <ProcessingPreviewPanel prefersReducedMotion={props.prefersReducedMotion} preview={props.previewPanel} />
        </Tabs.Panel>
        <Tabs.Panel id="log">
          <ProcessingLogPanel
            isAutoScrollLocked={props.isLogAutoScrollLocked}
            logLines={props.logLines}
            onCopyLog={props.onCopyLog}
            onToggleAutoScroll={props.onToggleLogAutoScroll}
          />
        </Tabs.Panel>
      </div>
    </Tabs.Root>
  );
}

/** Bốn dòng tầng dưới stepper, kèm số đối tượng đã nhận khi đã đếm được. */
function ProcessingFloorObjectRows({ floors }: Pick<ProcessingScreenProps, 'floors'>) {
  if (floors.length === 0) {
    return null;
  }

  return (
    <ul aria-label={FLOOR_OBJECTS_ARIA_LABEL} className="mt-4 flex flex-col">
      {floors.map((floor) => (
        <li
          className="flex items-baseline justify-between gap-3 border-b border-border-default py-2 text-[13px] last:border-b-0"
          key={floor.id}
        >
          <span className="text-text-primary">{floor.label}</span>
          {floor.objectCountLabel !== undefined ? (
            <span className="text-text-secondary">{floor.objectCountLabel}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Màn Xử lý như một hàm của props (mục D) — test và story dựng thẳng cái này. */
export function ProcessingScreen(props: ProcessingScreenProps) {
  const { errorAlert } = props;
  const isSheet = props.isCompact || props.state === 'collapsed';

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
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-[60%]">
          {isSheet ? (
            // Một thanh cho bước hiện tại, và cả sáu bước vẫn mở ra được ở khổ hẹp (BUG-294).
            <div className="flex flex-col gap-2">
              <ProcessingStepBar prefersReducedMotion={props.prefersReducedMotion} steps={props.steps} />
              <details>
                <summary className="cursor-pointer select-none min-h-11 rounded-[8px] px-1 py-3 text-[14px] sm:min-h-0 sm:py-2 font-medium text-text-secondary hover:bg-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  {ALL_STEPS_LABEL}
                </summary>
                <ProcessingStepList prefersReducedMotion={props.prefersReducedMotion} steps={props.steps} />
              </details>
            </div>
          ) : (
            <ProcessingStepList prefersReducedMotion={props.prefersReducedMotion} steps={props.steps} />
          )}
          <ProcessingFloorObjectRows floors={props.floors} />
        </div>
        {/* Dưới 1024px hai tab xếp dưới các bước, trong dòng chảy trang: tấm cố định 70vh
            che khối tổng kết và để trống 400-600 px phía trên (BUG-294, BUG-285). */}
        <div className="lg:w-[344px]">
          <ProcessingPanels {...props} />
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-bg-app">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Đường dẫn chung: "Dự án" bấm được về danh sách, như ở Tải bản vẽ và Cổng chất lượng (BUG-546). */}
          <div className="min-w-0">
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
          </div>
          <ProcessingActions {...props} />
        </div>

        {props.queueLine !== undefined ? (
          <p className="text-[13px] text-text-secondary">{props.queueLine}</p>
        ) : null}

        {errorAlert?.isProjectMissing === true ? (
          // Dự án không có: một câu, một lối về danh sách — không "Thử lại", không mã nội bộ (BUG-312).
          <InlineAlert
            action={{ label: BACK_TO_PROJECTS_LABEL, onClick: errorAlert.onBackToProjects ?? errorAlert.onRetry }}
            level="violation"
            message={errorAlert.message}
            title={errorAlert.title}
          />
        ) : errorAlert !== undefined ? (
          <div className="flex flex-col gap-2">
            <InlineAlert
              action={{ label: RETRY_LABEL, onClick: errorAlert.onRetry }}
              level="violation"
              message={errorAlert.message}
              title={errorAlert.title}
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[12px] font-medium text-text-muted">{errorAlert.technicalCode}</span>
              <Button onClick={errorAlert.onGoToSupport} size="sm" variant="ghost">
                {SUPPORT_LABEL}
              </Button>
            </div>
          </div>
        ) : null}

        {errorAlert?.isProjectMissing === true ? null : (
          <>
            <ProcessingFloorChips floors={props.floors} />

            {body}

            {props.summary !== undefined ? <ProcessingSummary summary={props.summary} /> : null}

            {/* Vùng thông báo tiến độ nằm NGOÀI hai tab: tab "Xem trước" mặc định giấu nhật ký (BUG-554). */}
            <div className="flex flex-col items-center gap-1 text-center" role="status">
              <p className="text-[14px] text-text-primary">{props.overallSummaryLine}</p>
              {props.partialNoticeLine !== undefined ? (
                <p className="text-[13px] text-text-secondary">{props.partialNoticeLine}</p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
