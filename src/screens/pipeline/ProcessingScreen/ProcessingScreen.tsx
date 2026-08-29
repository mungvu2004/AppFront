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
 * | `collapsed` | hai cột, cột phải thành tấm trượt đáy bất kể bề rộng khung nhìn   |
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
import { clsx } from 'clsx';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
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

/** Bao nhiêu khung xương lúc chưa biết bước nào đã xong. */
const SKELETON_ROW_COUNT = 4;

/** Cùng khuôn `InputQualityGate.tsx:66-70` — tấm trượt đáy dưới 1024px. */
const BOTTOM_SHEET_CLASSES =
  'fixed inset-x-0 bottom-0 z-10 max-h-[70vh] overflow-y-auto rounded-t-[16px] border-t border-border-default bg-bg-surface p-4';
const BOTTOM_SHEET_RESET_AT_DESKTOP =
  'lg:static lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0';

/** Hàng hành động đầu trang: nút chìm chạy nền LUÔN có, nút huỷ thì tuỳ quyền. */
function ProcessingActions(props: ProcessingScreenProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button onClick={props.onRunInBackground} size="sm" variant="ghost">
        {RUN_IN_BACKGROUND_LABEL}
      </Button>

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
        description={EMPTY_DESCRIPTION}
        icon={<ScanLine aria-hidden="true" />}
        title={EMPTY_TITLE}
      />
    ) : (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-[60%]">
          {isSheet ? (
            <ProcessingStepBar prefersReducedMotion={props.prefersReducedMotion} steps={props.steps} />
          ) : (
            <ProcessingStepList prefersReducedMotion={props.prefersReducedMotion} steps={props.steps} />
          )}
          <ProcessingFloorObjectRows floors={props.floors} />
        </div>
        <div className={clsx('lg:w-[344px]', BOTTOM_SHEET_CLASSES, !isSheet && BOTTOM_SHEET_RESET_AT_DESKTOP)}>
          <ProcessingPanels {...props} />
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-bg-app">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav aria-label={BREADCRUMB_PIPELINE} className="text-[13px] text-text-secondary">
            <span>{BREADCRUMB_PROJECTS}</span>
            <span aria-hidden="true"> › </span>
            <span className="text-text-primary">{BREADCRUMB_PIPELINE}</span>
          </nav>
          <ProcessingActions {...props} />
        </div>

        {props.queueLine !== undefined ? (
          <p className="text-[13px] text-text-secondary">{props.queueLine}</p>
        ) : null}

        {errorAlert !== undefined ? (
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

        <ProcessingFloorChips floors={props.floors} />

        {body}

        {props.summary !== undefined ? <ProcessingSummary summary={props.summary} /> : null}

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[14px] text-text-primary">{props.overallSummaryLine}</p>
          {props.partialNoticeLine !== undefined ? (
            <p className="text-[13px] text-text-secondary">{props.partialNoticeLine}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
