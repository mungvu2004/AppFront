/**
 * Màn Cổng chất lượng đầu vào — nửa "vẽ" của mục D. Route của nó là
 * `ROUTE_PATTERNS.projectQuality`.
 *
 * {@link InputQualityGateView} nhận props và chỉ vẽ: không store, không mạng,
 * không `src/domain`, không một phép định dạng số nào (R-60). Mọi câu tiếng
 * Việt và mọi con số đã xong ở `useInputQualityGate.ts`; xem `types.ts` để
 * biết chính xác cái gì đến sẵn.
 *
 * ## Bảy trạng thái
 *
 * `model.status` quyết định phần thân:
 *
 * | `status`    | thân màn                                                    |
 * |-------------|--------------------------------------------------------------|
 * | `loading`   | khung xương bốn dòng + vạch quét, chưa gọi ba phần con        |
 * | `error`     | một `InlineAlert` kèm một lối ra (404 dự án: về danh sách)    |
 * | `empty`     | hai cột đầy đủ; `InputQualityGateReportPanel` tự thu về đúng một thẻ đạt, đọc `passNotice` |
 * | `partial`   | hai cột đầy đủ; báo cáo tự nêu còn bao nhiêu tầng chưa đo, đọc `partialNotice` |
 * | `ready`     | hai cột đầy đủ                                                |
 * | `forbidden` | hai cột đầy đủ; chân trang tự ẩn hai nút hành động, đọc `footer.areActionsHidden` |
 * | `collapsed` | cùng hai cột, cột phải đổi thành lớp phủ đáy                  |
 *
 * Không nhánh nào trả `null`: màn trắng là thất bại duy nhất A11 tồn tại để
 * chặn. `empty`/`partial`/`forbidden` không có JSX riêng ở đây vì khác biệt
 * của chúng nằm trong dữ liệu (`passNotice`, `partialNotice`,
 * `footer.areActionsHidden`) mà `InputQualityGateReportPanel` và
 * `InputQualityGateFooter` đọc — hai phần con đó thuộc về lớp kế tiếp, không
 * phải shell này.
 *
 * ## Bố cục hai cột
 *
 * Cột trái (ảnh) chiếm 62%, cột phải (báo cáo) rộng cố định 344px, nội dung
 * giới hạn 1280px. Dưới 1024px cột phải trở thành tấm trượt đáy — cố định vào
 * mép dưới màn hình, cuộn riêng, bo góc trên. Trạng thái `collapsed` áp cùng
 * kiểu tấm trượt đó bất kể bề rộng khung nhìn, vì đó là quyết định của hook
 * (nhúng trong khung hẹp, hoặc ép bằng tay cho story/test), không phải của
 * CSS breakpoint.
 */

import { useEffect, useRef } from 'react';
import { ImageOff } from 'lucide-react';
import { clsx } from 'clsx';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { BACK_TO_PROJECTS_LABEL, PROJECT_NOT_FOUND_TITLE } from '@/components/feedback/ProjectSpatialGate';
import { Skeleton } from '@/components/feedback/Skeleton';

import { InputQualityGateConfirmDialog } from './InputQualityGateConfirmDialog';
import { InputQualityGateFooter } from './InputQualityGateFooter';
import { InputQualityGateImagePanel } from './InputQualityGateImagePanel';
import { InputQualityGateReportPanel } from './InputQualityGateReportPanel';
import type { InputQualityGateViewProps } from './types';

const BREADCRUMB_PROJECTS = 'Dự án';
const BREADCRUMB_QUALITY = 'Kiểm tra chất lượng đầu vào';

/** Tiêu đề của lượt đo chất lượng hỏng — `status === 'error'`, không phải lỗi tệp. */
const LOAD_ERROR_TITLE = 'Không đọc được kết quả kiểm tra chất lượng';
const RETRY_LABEL = 'Thử lại';

/** Dự án chưa có bản vẽ nào (404 `upload`): trạng thái rỗng, không phải lỗi. */
const NO_DRAWING_TITLE = 'Chưa có bản vẽ để kiểm tra';
const NO_DRAWING_ACTION = 'Tải bản vẽ lên';
const WRITE_ERROR_TITLE = 'Chưa xử lý được bản vẽ';

/** Bao nhiêu khung xương lúc chưa biết phép đo nào đã xong. */
const SKELETON_ROW_COUNT = 4;

/** Cùng khuôn `InputQualityGateReportPanel`/`InputQualityGateFooter` — tấm trượt đáy dưới 1024px. */
const BOTTOM_SHEET_CLASSES =
  'fixed inset-x-0 bottom-0 z-10 max-h-[70vh] overflow-y-auto rounded-t-[16px] border-t border-border-default bg-bg-surface p-4';
const BOTTOM_SHEET_RESET_AT_DESKTOP =
  'lg:static lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0';

/** Màn Cổng chất lượng đầu vào như một hàm của props — test và story dựng thẳng cái này. */
export function InputQualityGateView({ actions, model }: InputQualityGateViewProps) {
  const isCollapsed = model.status === 'collapsed';
  const rootRef = useRef<HTMLDivElement>(null);
  const writeErrorRef = useRef<HTMLDivElement>(null);
  const retryFocus = model.retryFocus ?? null;

  // Lỗi ghi: hộp thoại đóng lúc nút gốc đã bị thay (đánh dấu xong, rồi đọc lại),
  // nên tiêu điểm tự rơi vào phần tử đầu tiên của trang. Trả về đúng nút vừa
  // bấm; nút không còn thì về dải báo lỗi.
  // Người dùng đã tự bấm/gõ từ lúc có lỗi thì không kéo tiêu điểm của họ đi.
  const hasUserActedRef = useRef(false);

  useEffect(() => {
    hasUserActedRef.current = false;

    if (model.writeError === null) {
      return undefined;
    }

    const markActed = (): void => {
      hasUserActedRef.current = true;
    };

    document.addEventListener('pointerdown', markActed, true);
    document.addEventListener('keydown', markActed, true);

    return () => {
      document.removeEventListener('pointerdown', markActed, true);
      document.removeEventListener('keydown', markActed, true);
    };
  }, [model.writeError]);

  useEffect(() => {
    if (retryFocus === null || hasUserActedRef.current) {
      return;
    }

    const button = rootRef.current?.querySelector<HTMLElement>(`[data-quality-action="${retryFocus}"]`);

    (button ?? writeErrorRef.current)?.focus();
  }, [retryFocus, model.writeError]);

  const body =
    model.status === 'loading' ? (
      <div className="flex flex-col gap-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-bg-sunken" role="presentation">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-border-default motion-reduce:animate-none" />
        </div>
        {Array.from({ length: SKELETON_ROW_COUNT }, (_unused, index) => (
          <Skeleton key={index} preset="table-row" />
        ))}
      </div>
    ) : model.status === 'error' ? (
      // Một dải lỗi, một lối ra — chân trang ẩn hai nút ở trạng thái này (BUG-074).
      <InlineAlert
        action={
          model.isProjectMissing
            ? { label: BACK_TO_PROJECTS_LABEL, onClick: actions.onBackToProjects }
            : model.canRetryLoad
              ? { label: RETRY_LABEL, onClick: actions.onRetryLoad }
              : { label: model.footer.secondaryLabel, onClick: actions.onUploadAnother }
        }
        level="violation"
        message={model.errorMessage ?? ''}
        title={model.isProjectMissing ? PROJECT_NOT_FOUND_TITLE : LOAD_ERROR_TITLE}
      />
    ) : model.noDrawingNotice !== null ? (
      <EmptyState
        {...(model.footer.areActionsHidden
          ? {}
          : { action: { label: NO_DRAWING_ACTION, onClick: actions.onUploadAnother } })}
        description={model.noDrawingNotice}
        icon={<ImageOff aria-hidden="true" />}
        title={NO_DRAWING_TITLE}
      />
    ) : (
      <div className="flex flex-col gap-6">
        {model.writeError !== null && (
          <div
            className="rounded-[8px] outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            ref={writeErrorRef}
            tabIndex={-1}
          >
            <InlineAlert level="violation" message={model.writeError} title={WRITE_ERROR_TITLE} />
          </div>
        )}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="lg:w-[62%]">
            <InputQualityGateImagePanel
              actions={{
                onChangeReveal: actions.onChangeReveal,
                onDragCorner: actions.onDragCorner,
                onHoverRegion: actions.onHoverRegion,
              }}
              image={model.image}
            />
          </div>
          <div
            className={clsx('lg:w-[344px]', BOTTOM_SHEET_CLASSES, !isCollapsed && BOTTOM_SHEET_RESET_AT_DESKTOP)}
          >
            <InputQualityGateReportPanel
              actions={{
                onHoverFinding: actions.onHoverFinding,
                onHoverRegion: actions.onHoverRegion,
                onPickCorners: actions.onPickCorners,
                onSelectFloor: actions.onSelectFloor,
                onStraighten: actions.onStraighten,
              }}
              findings={model.findings}
              floors={model.floors}
              forecast={model.forecast}
              metrics={model.metrics}
              partialNotice={model.partialNotice}
              passNotice={model.passNotice}
              remainingFindingCount={model.remainingFindingCount}
            />
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-bg-app" ref={rootRef}>
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-8">
        <Breadcrumb
          items={[
            { id: 'projects', label: BREADCRUMB_PROJECTS, onClick: actions.onBackToProjects },
            { id: 'current', label: BREADCRUMB_QUALITY },
          ]}
        />

        {body}

        <InputQualityGateFooter
          actions={{
            onContinue: actions.onContinue,
            onToggleAcknowledgement: actions.onToggleAcknowledgement,
            onUploadAnother: actions.onUploadAnother,
          }}
          footer={model.footer}
        />

        <InputQualityGateConfirmDialog
          actions={{ onCancelWrite: actions.onCancelWrite, onConfirmWrite: actions.onConfirmWrite }}
          confirm={model.confirm}
        />
      </div>
    </div>
  );
}
