/**
 * Màn Xử lý (`ProcessingScreen`) — khung của route `ROUTE_PATTERNS.projectPipeline`
 * (`/projects/:id/pipeline`).
 *
 * NHIỆM VỤ NÀY LÀ NỀN MÓNG (S4): file này chỉ dựng đủ khung để biên dịch được và
 * để `ProcessingFloorChips` / `ProcessingStepList` / `ProcessingPreviewPanel` /
 * `ProcessingLogPanel` / `ProcessingSummary` có chỗ cắm vào. Bố cục thật, màu, chuyển
 * động, và cách bảy trạng thái (A11) khác nhau trên màn hình thuộc về nhiệm vụ kế
 * tiếp (V5/V6). `types.ts` là hợp đồng props DUY NHẤT; sửa hình dạng props phải qua
 * đó, không qua file này (mục D).
 *
 * TUYỆT ĐỐI không nhập `@/api`, `@/store`, `@/domain`, `@/lib/http` (R-60).
 */

import { ProcessingFloorChips } from './ProcessingFloorChips';
import { ProcessingLogPanel } from './ProcessingLogPanel';
import { ProcessingPreviewPanel } from './ProcessingPreviewPanel';
import { ProcessingStepList } from './ProcessingStepList';
import { ProcessingSummary } from './ProcessingSummary';
import type { ProcessingScreenProps } from './types';

const BREADCRUMB_PROJECTS = 'Dự án';
const BREADCRUMB_PIPELINE = 'Xử lý';

/** Màn Xử lý như một hàm của props (mục D) — test và story dựng thẳng cái này. */
export function ProcessingScreen(props: ProcessingScreenProps) {
  const { errorAlert } = props;

  if (props.state === 'error' && errorAlert !== undefined) {
    return (
      <div className="min-h-screen bg-bg-app p-8">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3">
          <p className="text-[16px] font-semibold text-text-primary">{errorAlert.title}</p>
          <p className="text-[14px] text-text-secondary">{errorAlert.message}</p>
          <p className="text-[12px] text-text-muted">{errorAlert.technicalCode}</p>
          <div className="flex gap-2">
            <button onClick={errorAlert.onRetry} type="button">
              Thử lại
            </button>
            <button onClick={errorAlert.onGoToSupport} type="button">
              Liên hệ hỗ trợ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-app">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-8">
        <nav aria-label={BREADCRUMB_PIPELINE} className="text-[13px] text-text-secondary">
          <span>{BREADCRUMB_PROJECTS}</span>
          <span aria-hidden="true"> › </span>
          <span className="text-text-primary">{BREADCRUMB_PIPELINE}</span>
        </nav>

        <p className="text-[14px] text-text-secondary">{props.overallSummaryLine}</p>
        {props.queueLine !== undefined ? <p className="text-[13px] text-text-secondary">{props.queueLine}</p> : null}
        {props.partialNoticeLine !== undefined ? (
          <p className="text-[13px] text-text-secondary">{props.partialNoticeLine}</p>
        ) : null}

        <ProcessingFloorChips floors={props.floors} />

        <div className={props.isCompact ? 'flex flex-col gap-6' : 'flex gap-6'}>
          <div className={props.isCompact ? '' : 'flex-1'}>
            <ProcessingStepList prefersReducedMotion={props.prefersReducedMotion} steps={props.steps} />
          </div>
          <div className={props.isCompact ? '' : 'w-[360px]'}>
            <div aria-label="Chuyển tab cột phải" className="flex gap-2" role="tablist">
              <button
                aria-selected={props.activeTab === 'preview'}
                onClick={() => props.onTabChange('preview')}
                role="tab"
                type="button"
              >
                Xem trước
              </button>
              <button
                aria-selected={props.activeTab === 'log'}
                onClick={() => props.onTabChange('log')}
                role="tab"
                type="button"
              >
                Nhật ký
              </button>
            </div>

            {props.activeTab === 'preview' ? (
              <ProcessingPreviewPanel preview={props.previewPanel} prefersReducedMotion={props.prefersReducedMotion} />
            ) : (
              <ProcessingLogPanel
                isAutoScrollLocked={props.isLogAutoScrollLocked}
                logLines={props.logLines}
                onCopyLog={props.onCopyLog}
                onToggleAutoScroll={props.onToggleLogAutoScroll}
              />
            )}
          </div>
        </div>

        {props.summary !== undefined ? <ProcessingSummary summary={props.summary} /> : null}

        <div className="flex items-center justify-end gap-3">
          <button onClick={props.onRunInBackground} type="button">
            Chạy nền
          </button>
          {props.canCancel ? (
            <button onClick={props.onRequestCancel} type="button">
              Huỷ xử lý
            </button>
          ) : null}
        </div>

        {props.isCancelConfirming ? (
          <div aria-label="Xác nhận huỷ xử lý" role="alertdialog">
            <p>Bạn có chắc muốn huỷ xử lý?</p>
            <button onClick={props.onConfirmCancel} type="button">
              Xác nhận huỷ
            </button>
            <button onClick={props.onDismissCancel} type="button">
              Đóng
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
