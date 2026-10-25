/**
 * Màn tải bản vẽ — nửa "vẽ" của mục D. Route của nó là
 * `ROUTE_PATTERNS.projectUpload`.
 *
 * {@link FloorUploadScreenView} nhận props và chỉ vẽ: không store, không mạng,
 * không `src/domain`, không một phép định dạng số nào (R-60, ép bằng
 * `local/no-data-layer-in-view`). Mọi câu tiếng Việt và mọi con số đã xong ở
 * `useFloorUploadScreen.ts`; xem `types.ts` để biết chính xác cái gì đến sẵn.
 *
 * ## Ba câu của màn (HOP-DONG-V6 §1, demo Z/S-08)
 *
 * 1. Làm gì: `PageHead` — eyebrow "Bước 1 · Tải bản vẽ", H1 động từ.
 * 2. Trạng thái: Badge + một câu, cả hai rút từ {@link deriveUploadGate}.
 * 3. Bước tiếp: khung "Điều kiện để xử lý" cạnh danh sách bản vẽ (ngoại lệ §1: điều kiện gắn với
 *    nội dung), MỘT nút "Bắt đầu xử lý". Thanh bước chỉ nhận thanh + số `n/3` qua `FlowGate`, không
 *    nút, để không có hai chỗ mời bấm. Cả ba chỗ đọc cùng một `gate` nên không thể nói khác nhau.
 *
 * ## Bảy trạng thái, và cái duy nhất không được xảy ra
 *
 * | `state`     | thân màn                                             |
 * |-------------|------------------------------------------------------|
 * | `loading`   | khung xương, vùng thả vẫn còn                        |
 * | `error`     | một `InlineAlert` cho lượt đọc danh sách tầng hỏng    |
 * | `empty`     | vùng thả lớn là tiêu điểm; chưa có tầng thì `EmptyState` |
 * | `partial`   | danh sách tầng, khung điều kiện nói còn thiếu gì     |
 * | `success`   | danh sách tầng đủ, nút chính bật                     |
 * | `forbidden` | danh sách chỉ đọc, không vùng thả                    |
 * | `collapsed` | cùng dữ liệu, một cột, khung điều kiện lên trước     |
 *
 * Không nhánh nào trả `null`: màn trắng là thất bại duy nhất A11 tồn tại để chặn.
 *
 * Lỗi của một tệp ở lại trong `row.error` của chính hàng nó ({@link FloorUploadCard}), không bao
 * giờ thành `state === 'error'`. Kéo tệp qua: vùng thả đổi màu, không đổi kích thước
 * (`FloorUploadDropZone.tsx`). `blockNotice.scrollTo.requestId` tăng sau mỗi lượt bấm bị chặn; hiệu
 * ứng dưới đây cuộn đúng một lần cho mỗi lượt, trên chính hàng tầng.
 */

import { useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { Plus } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { BACK_TO_PROJECTS_LABEL, PROJECT_NOT_FOUND_TITLE } from '@/components/feedback/ProjectSpatialGate';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

import { FloorUploadCard } from './FloorUploadCard';
import { FloorUploadDropZone } from './FloorUploadDropZone';
import { FloorUploadGatePanel } from './FloorUploadGatePanel';
import { SheetGlyph } from './FloorUploadGlyphs';
import { FloorUploadTray } from './FloorUploadTray';
import { deriveUploadGate, type UploadGate } from './floorUploadGate';
import type { FloorUploadActions, FloorUploadRowModel, FloorUploadScreenViewProps } from './types';

/** Mẩu vụn đường dẫn, đúng `floorUpload.breadcrumb.*` trong `vi.json`. */
const BREADCRUMB_PROJECTS = 'Dự án';
const BREADCRUMB_UPLOAD = 'Tải lên bản vẽ';
const EYEBROW = 'Bước 1 · Tải bản vẽ';
const PAGE_TITLE = 'Tải bản vẽ mặt bằng cho từng tầng';
const SECTION_TITLE = 'Bản vẽ theo tầng';

/** Chữ của dòng trạng thái. "Sẵn sàng xử lý" chỉ ở tiêu đề khung điều kiện, không lặp ở đây. */
const STATUS_READY = 'Đủ điều kiện';
const STATUS_PENDING = 'Chưa đủ điều kiện';
const STATUS_NOT_STARTED = 'Chưa bắt đầu';
const STATUS_READ_ONLY = 'Chỉ xem';
const SENTENCE_READY = 'Mọi tầng đã có bản vẽ và cao độ hợp lệ.';

/** Tiêu đề của lượt đọc danh sách tầng hỏng — `state === 'error'`, không phải lỗi tệp. */
const LOAD_ERROR_TITLE = 'Không tải được danh sách tầng';
const RETRY_LABEL = 'Thử lại';

/**
 * Dự án chưa có tầng nào — `floorUpload.noFloors.*` trong `vi.json`. Chữ riêng, không
 * dùng lại tiêu đề vùng thả, để khối này không trông như đích thả thứ hai (BUG-100).
 */
const NO_FLOORS_TITLE = 'Dự án chưa có tầng nào';
const NO_FLOORS_MESSAGE =
  'Bản vẽ được gán theo tầng. Thêm tầng ở màn Quản lý tầng rồi quay lại đây để tải bản vẽ.';
/** Lối tới màn Quản lý tầng — cùng nhãn nút của trạng thái rỗng ở đó (BUG-298). */
const ADD_FLOORS_LABEL = 'Thêm tầng';

/** Bao nhiêu khung xương lúc chưa biết có mấy tầng. */
const SKELETON_ROW_COUNT = 3;

/**
 * Gom các hàm hành động lại thành một đối tượng để chuyền xuống các phần con.
 *
 * Chuyền cả `props` xuống thì phần con nhìn thấy cả mô hình và sẽ bắt đầu đọc
 * những trường không phải việc của nó.
 */
function actionsOf(props: FloorUploadScreenViewProps): FloorUploadActions {
  return {
    onCancelUpload: props.onCancelUpload,
    onDismissError: props.onDismissError,
    onDragEnter: props.onDragEnter,
    onDragLeave: props.onDragLeave,
    onFilesChosen: props.onFilesChosen,
    onFilesDropped: props.onFilesDropped,
    ...(props.onFilesForFloor === undefined ? {} : { onFilesForFloor: props.onFilesForFloor }),
    ...(props.onConfirmMatch === undefined ? {} : { onConfirmMatch: props.onConfirmMatch }),
    onPickPdfPage: props.onPickPdfPage,
    onReassign: props.onReassign,
    onRemoveFile: props.onRemoveFile,
    onRetryUpload: props.onRetryUpload,
    onSubmit: props.onSubmit,
    onRetryLoad: props.onRetryLoad,
  };
}

/** Badge + câu của dòng trạng thái — cùng `gate` với khung điều kiện và thanh bước. */
function statusOf(
  props: FloorUploadScreenViewProps,
  gate: UploadGate,
): { readonly variant: FloorUploadRowModel['statusVariant']; readonly label: string; readonly sentence: string } {
  const sentence =
    props.state === 'empty'
      ? props.emptyMessage
      : gate.isReady
        ? SENTENCE_READY
        : (gate.firstReason?.sentence ?? props.footer.counterLabel);

  if (props.isReadOnly) return { variant: 'neutral', label: STATUS_READ_ONLY, sentence };
  if (gate.isReady) return { variant: 'verified', label: STATUS_READY, sentence };
  if (props.state === 'empty') return { variant: 'neutral', label: STATUS_NOT_STARTED, sentence };

  return { variant: 'attention', label: STATUS_PENDING, sentence };
}

/** Màn tải bản vẽ như một hàm của props — test và story dựng thẳng cái này. */
export function FloorUploadScreenView(props: FloorUploadScreenViewProps) {
  const { blockNotice, footer, state, tray } = props;
  const actions = actionsOf(props);
  const gate = deriveUploadGate(props);
  const status = statusOf(props, gate);
  const isSettled = state !== 'loading' && state !== 'error';

  const cardsRef = useRef(new Map<string, HTMLElement>());
  const scrolledRequestRef = useRef<number | null>(null);

  const registerCard = useCallback((floorId: string, element: HTMLElement | null): void => {
    if (element === null) {
      cardsRef.current.delete(floorId);

      return;
    }

    cardsRef.current.set(floorId, element);
  }, []);

  const showFloor = useCallback((floorId: string): void => {
    cardsRef.current.get(floorId)?.scrollIntoView({ block: 'center' });
  }, []);

  useEffect(() => {
    if (blockNotice === null) {
      scrolledRequestRef.current = null;

      return;
    }

    if (scrolledRequestRef.current === blockNotice.scrollTo.requestId) {
      return;
    }

    scrolledRequestRef.current = blockNotice.scrollTo.requestId;
    cardsRef.current.get(blockNotice.scrollTo.floorId)?.scrollIntoView();
  }, [blockNotice]);

  const body =
    state === 'loading' ? (
      <div className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_unused, index) => (
          <Skeleton key={index} preset="table-row" />
        ))}
      </div>
    ) : props.floors.length === 0 ? (
      <EmptyState
        {...(props.onAddFloors ? { action: { label: ADD_FLOORS_LABEL, onClick: props.onAddFloors } } : {})}
        description={NO_FLOORS_MESSAGE}
        icon={<SheetGlyph />}
        title={NO_FLOORS_TITLE}
      />
    ) : (
      <ul className="flex flex-col divide-y divide-border-default">
        {props.floors.map((row) => (
          <FloorUploadCard
            acceptAttribute={props.dropZone.acceptAttribute}
            actions={actions}
            isCollapsed={props.isCollapsed}
            isReadOnly={props.isReadOnly}
            key={row.floorId}
            registerCard={registerCard}
            row={row}
          />
        ))}
      </ul>
    );

  return (
    <div
      className="min-h-screen bg-bg-app"
      onDragEnter={(event) => {
        event.preventDefault();
        props.onDragEnter();
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        props.onDragLeave();
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        props.onFilesDropped([...event.dataTransfer.files]);
      }}
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6 lg:px-8">
        <Breadcrumb
          items={[
            {
              id: 'projects',
              label: BREADCRUMB_PROJECTS,
              ...(props.onBackToProjects ? { onClick: props.onBackToProjects } : {}),
            },
            ...(props.projectName !== undefined ? [{ id: 'project', label: props.projectName }] : []),
            { id: 'current', label: BREADCRUMB_UPLOAD },
          ]}
        />

        <PageHead
          className="mb-0"
          eyebrow={EYEBROW}
          status={
            // Đủ điều kiện: checklist bên phải đã nói, không lặp chip + câu ở đầu trang.
            isSettled && !gate.isReady ? (
              <>
                <Badge variant={status.variant}>{status.label}</Badge>
                <span>{status.sentence}</span>
              </>
            ) : undefined
          }
          title={PAGE_TITLE}
        />

        {props.offlineNotice !== null && (
          <InlineAlert level="attention" message={props.offlineNotice} />
        )}

        {props.readOnlyNotice !== null && (
          <p className="text-body-sm text-text-secondary">{props.readOnlyNotice}</p>
        )}

        {state === 'error' ? (
          // Một dải lỗi, một lối ra; vùng thả và nút chính ẩn vì chưa có tầng nào để gán (BUG-311).
          <InlineAlert
            {...(props.isProjectMissing && props.onBackToProjects
              ? { action: { label: BACK_TO_PROJECTS_LABEL, onClick: props.onBackToProjects } }
              : props.canRetryLoad
                ? { action: { label: RETRY_LABEL, onClick: props.onRetryLoad } }
                : {})}
            level="violation"
            message={props.errorMessage ?? ''}
            title={props.isProjectMissing ? PROJECT_NOT_FOUND_TITLE : LOAD_ERROR_TITLE}
          />
        ) : (
          <div
            className={clsx(
              'grid items-start gap-6 transition-opacity duration-instant',
              'lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]',
              props.isDragActive && 'opacity-[0.96]',
            )}
          >
            <Section
              actions={
                props.floors.length > 0 && props.onAddFloors !== undefined ? (
                  <Button
                    iconBefore={<Plus aria-hidden="true" />}
                    onClick={props.onAddFloors}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {ADD_FLOORS_LABEL}
                  </Button>
                ) : undefined
              }
              title={SECTION_TITLE}
            >
              <div className="flex flex-col gap-4">
                {props.dropZone.isEnabled && (
                  <FloorUploadDropZone
                    isDragActive={props.isDragActive}
                    isProminent={state === 'empty'}
                    model={props.dropZone}
                    onFilesChosen={props.onFilesChosen}
                  />
                )}
                {body}
                <FloorUploadTray actions={actions} tray={tray} />
              </div>
            </Section>

            {/* Dưới 1024 một cột: khung điều kiện lên trước để câu 3 thấy được không cần cuộn. */}
            <div className="max-lg:order-first lg:sticky lg:top-6">
              <FloorUploadGatePanel
                blockNotice={blockNotice}
                footer={footer}
                gate={gate}
                onOpenFloors={props.onAddFloors}
                onShowFloor={showFloor}
                onSubmit={props.onSubmit}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
