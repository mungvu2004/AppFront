/**
 * Màn tải bản vẽ — nửa "vẽ" của mục D. Route của nó là
 * `ROUTE_PATTERNS.projectUpload`.
 *
 * {@link FloorUploadScreenView} nhận props và chỉ vẽ: không store, không mạng,
 * không `src/domain`, không một phép định dạng số nào (R-60, ép bằng
 * `local/no-data-layer-in-view`). Mọi câu tiếng Việt và mọi con số đã xong ở
 * `useFloorUploadScreen.ts`; xem `types.ts` để biết chính xác cái gì đến sẵn.
 *
 * ## Bảy trạng thái, và cái duy nhất không được xảy ra
 *
 * `state` quyết định phần thân:
 *
 * | `state`     | thân màn                                             |
 * |-------------|------------------------------------------------------|
 * | `loading`   | khung xương, vùng thả vẫn còn                        |
 * | `error`     | một `InlineAlert` cho lượt đọc danh sách tầng hỏng    |
 * | `empty`     | `EmptyState` mời thả tệp đầu tiên                     |
 * | `partial`   | danh sách thẻ, chân trang nói còn thiếu bao nhiêu     |
 * | `success`   | danh sách thẻ đủ                                     |
 * | `forbidden` | danh sách chỉ đọc, không vùng thả                    |
 * | `collapsed` | cùng dữ liệu, xếp dọc cho khung dưới 1024px          |
 *
 * Không nhánh nào trả `null`: màn trắng là thất bại duy nhất A11 tồn tại để
 * chặn, nên mọi nhánh đều vẽ ra ít nhất mẩu vụn đường dẫn và một câu.
 *
 * ## Lỗi của một tệp không bao giờ là lỗi của cả trang
 *
 * `state === 'error'` chỉ dành cho lượt đọc danh sách tầng. Một tệp quá khổ hay
 * một tệp không đọc được ở lại trong `row.error` của chính thẻ nó, và
 * {@link FloorUploadCard} vẽ nó tại chỗ — không hộp thoại, không chặn thao tác
 * với ba tệp còn lại.
 *
 * ## Kéo tệp qua: đổi màu, không đổi kích thước
 *
 * Sự kiện kéo-thả bắt ở khung ngoài cùng nên tệp lơ lửng bất cứ đâu trên trang
 * cũng đánh thức vùng thả, đúng như đặc tả. Phần còn lại của trang mờ đi; vùng
 * thả chỉ đổi màu viền và nền — lý do và cách canh nằm ở
 * `FloorUploadDropZone.tsx`.
 *
 * ## Cuộn tới tầng bị chặn
 *
 * `blockNotice.scrollTo.requestId` tăng sau **mỗi** lượt bấm bị chặn. Hiệu ứng
 * dưới đây so nó với con số đã dùng lần trước, nên mỗi lượt bấm cuộn đúng một
 * lần, và cuộn trên chính thẻ tầng chứ không trên cửa sổ.
 */

import { useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';

import { FloorUploadCard } from './FloorUploadCard';
import { FloorUploadDropZone } from './FloorUploadDropZone';
import { FloorUploadFooter } from './FloorUploadFooter';
import { UploadGlyph } from './FloorUploadGlyphs';
import { FloorUploadTray } from './FloorUploadTray';
import type { FloorUploadActions, FloorUploadScreenViewProps } from './types';

/** Mẩu vụn đường dẫn, đúng `floorUpload.breadcrumb.*` trong `vi.json`. */
const BREADCRUMB_PROJECTS = 'Dự án';
const BREADCRUMB_UPLOAD = 'Tải lên bản vẽ';

/** Tiêu đề của lượt đọc danh sách tầng hỏng — `state === 'error'`, không phải lỗi tệp. */
const LOAD_ERROR_TITLE = 'Không tải được danh sách tầng';

/** Bao nhiêu khung xương lúc chưa biết có mấy tầng. */
const SKELETON_ROW_COUNT = 3;

/**
 * Gom mười hàm hành động lại thành một đối tượng để chuyền xuống các phần con.
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
    onPickPdfPage: props.onPickPdfPage,
    onReassign: props.onReassign,
    onRemoveFile: props.onRemoveFile,
    onRetryUpload: props.onRetryUpload,
    onSubmit: props.onSubmit,
  };
}

/** Màn tải bản vẽ như một hàm của props — test và story dựng thẳng cái này. */
export function FloorUploadScreenView(props: FloorUploadScreenViewProps) {
  const { blockNotice, footer, state, tray } = props;
  const actions = actionsOf(props);

  const cardsRef = useRef(new Map<string, HTMLElement>());
  const scrolledRequestRef = useRef<number | null>(null);

  const registerCard = useCallback((floorId: string, element: HTMLElement | null): void => {
    if (element === null) {
      cardsRef.current.delete(floorId);

      return;
    }

    cardsRef.current.set(floorId, element);
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
    state === 'error' ? (
      <InlineAlert
        level="violation"
        message={props.errorMessage ?? ''}
        title={LOAD_ERROR_TITLE}
      />
    ) : state === 'loading' ? (
      <div className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_unused, index) => (
          <Skeleton key={index} preset="table-row" />
        ))}
      </div>
    ) : props.floors.length === 0 ? (
      <EmptyState
        description={props.emptyMessage}
        icon={<UploadGlyph />}
        title={props.dropZone.title}
      />
    ) : (
      <>
        {/* Dự án có tầng nhưng chưa tầng nào có bản vẽ: câu mời đi TRƯỚC danh
            sách chứ không thay chỗ nó — bốn thẻ tầng rỗng chính là thứ nói cho
            người dùng biết họ đang phải điền vào đâu. */}
        {state === 'empty' && (
          <p className="text-[14px] text-text-secondary">{props.emptyMessage}</p>
        )}
        <ul className={clsx('flex flex-col', props.isCollapsed ? 'gap-2' : 'gap-3')}>
          {props.floors.map((row) => (
            <FloorUploadCard
              actions={actions}
              isCollapsed={props.isCollapsed}
              isReadOnly={props.isReadOnly}
              key={row.floorId}
              registerCard={registerCard}
              row={row}
            />
          ))}
        </ul>
      </>
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
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 p-8">
        <nav aria-label={BREADCRUMB_UPLOAD} className="text-[13px] text-text-secondary">
          <span>{BREADCRUMB_PROJECTS}</span>
          <span aria-hidden="true"> › </span>
          <span className="text-text-primary">{BREADCRUMB_UPLOAD}</span>
        </nav>

        {props.offlineNotice !== null && (
          <InlineAlert level="attention" message={props.offlineNotice} />
        )}

        {props.readOnlyNotice !== null && (
          <p className="text-[13px] text-text-secondary">{props.readOnlyNotice}</p>
        )}

        {props.dropZone.isEnabled && (
          <FloorUploadDropZone
            isDragActive={props.isDragActive}
            model={props.dropZone}
            onFilesChosen={props.onFilesChosen}
          />
        )}

        <div
          className={clsx(
            'flex flex-col gap-6 transition-opacity duration-instant',
            props.isDragActive && 'opacity-[0.96]',
          )}
        >
          {body}

          <FloorUploadTray actions={actions} tray={tray} />

          <FloorUploadFooter blockNotice={blockNotice} footer={footer} onSubmit={props.onSubmit} />
        </div>
      </div>
    </div>
  );
}
