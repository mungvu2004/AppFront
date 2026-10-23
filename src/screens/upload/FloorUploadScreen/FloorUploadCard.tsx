/**
 * Một thẻ tầng — đơn vị mà danh sách lặp qua.
 *
 * ## Lỗi của một tệp dừng lại trong thẻ của nó
 *
 * `row.error` vẽ ra một `InlineAlert` **bên trong** thẻ. Không có hộp thoại nào
 * cho một tệp hỏng, và không có nhánh nào để lỗi ấy leo lên trạng thái của cả
 * màn: bảy trạng thái của A11 đến qua `props.state`, không qua đây.
 *
 * ## Không tự chọn màu theo `status`
 *
 * Huy hiệu lấy `row.statusVariant`. Một tệp ghép tự động từ tên tệp là đầu ra
 * của máy, nên hook trả `'attention'` chứ không phải xanh — A5 nói xanh "đã xác
 * minh" chỉ đánh dấu việc người duyệt. Thẻ này không được đoán lại điều đó.
 *
 * ## Hai con số thô duy nhất
 *
 * `row.percent` cho chiều rộng thanh 2px, và `row.revealDelayMs` cùng
 * `row.revealDurationMs` cho lúc thẻ hiện ra. Mọi thứ khác đã là chuỗi tiếng
 * Việt dựng sẵn ở hook (A15).
 */

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { MoreHorizontal, RotateCcw, Trash2, X } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { motion } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Select';

import { SheetGlyph } from './FloorUploadGlyphs';
import type { FloorUploadActions, FloorUploadRowModel } from './types';

/** Nhãn trường, đúng như `floorUpload.floorCard.*` và `common.*` trong `vi.json`. */
const LABEL_ELEVATION = 'cao độ';
const LABEL_HEIGHT = 'Chiều cao thông thuỷ';
const LABEL_REASSIGN = 'Gán cho tầng khác';
const LABEL_PAGE_PICKER = 'Chọn trang';
const LABEL_CAD_PILL = 'Bản vẽ CAD · độ chính xác cao';
const LABEL_MENU_PREFIX = 'Tuỳ chọn của tầng';
const LABEL_UPLOAD_FOR_FLOOR = 'Tải bản vẽ cho tầng này';
const LABEL_CANCEL = 'Huỷ';
const LABEL_RETRY = 'Thử lại';
const LABEL_DISMISS = 'Đóng';

/** Lớp dùng chung của một mục trong bảng tuỳ chọn. */
const MENU_ITEM_CLASSES =
  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ' +
  'hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2';

export interface FloorUploadCardProps {
  readonly row: FloorUploadRowModel;
  readonly isCollapsed: boolean;
  readonly isReadOnly: boolean;
  readonly actions: FloorUploadActions;
  /** Giá trị `accept` của ô chọn tệp. */
  readonly acceptAttribute?: string;
  /** Danh sách giữ tham chiếu tới từng thẻ để cuộn tới đúng tầng bị chặn. */
  readonly registerCard: (floorId: string, element: HTMLElement | null) => void;
}

/** Chip "Bản vẽ CAD" — hiện theo cờ của hook, thẻ không bao giờ tự đọc đuôi tệp. */
function CadPill() {
  return (
    <span className="inline-flex h-[22px] items-center rounded-md bg-bg-sunken px-2 text-[12px] text-text-secondary">
      {LABEL_CAD_PILL}
    </span>
  );
}

/**
 * Bảng tuỳ chọn của một thẻ.
 *
 * Esc đóng nó (A12). Phím bắt bằng `onKeyDown` trên chính khối này chứ không
 * phải `addEventListener` toàn cục — R-72 cấm cái sau, và một lớp phủ gọn trong
 * một thẻ thì chưa tới mức cần sổ đăng ký phím tắt.
 */
function CardMenu({
  row,
  actions,
  isOpen,
  setOpen,
}: {
  row: FloorUploadRowModel;
  actions: FloorUploadActions;
  isOpen: boolean;
  setOpen: (update: (open: boolean) => boolean) => void;
}) {
  const fileId = row.file === null ? null : row.file.id;
  const canRemove = row.canRemoveFile && row.removeLabel !== null;

  // Không mục nào để chọn (bản vẽ có sẵn trên máy chủ) thì không có nút: một nút
  // mở ra bảng rỗng là lời hứa không giữ (B-V4-07).
  if (fileId === null || !(row.canCancelUpload || row.canRetryUpload || canRemove)) {
    return null;
  }

  const close = (): void => setOpen(() => false);

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <IconButton
        // Trình đọc màn hình nghe được bảng đang mở hay đóng (B-V4-07).
        aria-expanded={isOpen}
        aria-label={`${LABEL_MENU_PREFIX} ${row.name}`}
        icon={<MoreHorizontal />}
        isActive={isOpen}
        onClick={() => setOpen((open) => !open)}
        size="sm"
      />

      {isOpen && (
        <div className="absolute right-0 top-full z-10 mt-1 flex min-w-[180px] flex-col rounded-lg border border-border-default bg-bg-surface p-1">
          {row.canCancelUpload && (
            <button
              className={clsx(MENU_ITEM_CLASSES, 'text-text-primary')}
              onClick={() => {
                actions.onCancelUpload(fileId);
                close();
              }}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" />
              {LABEL_CANCEL}
            </button>
          )}
          {row.canRetryUpload && (
            <button
              className={clsx(MENU_ITEM_CLASSES, 'text-text-primary')}
              onClick={() => {
                actions.onRetryUpload(fileId);
                close();
              }}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              {LABEL_RETRY}
            </button>
          )}
          {canRemove && (
            <button
              className={clsx(MENU_ITEM_CLASSES, 'text-state-violation-text')}
              onClick={() => {
                actions.onRemoveFile(fileId);
                close();
              }}
              type="button"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              {row.removeLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Thanh 2px chạy dọc mép dưới thẻ — tiến trình có số đo, không phải vòng xoay. */
function ProgressRail({ row }: { row: FloorUploadRowModel }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-xl bg-bg-sunken"
      >
        <div
          className="h-full origin-left bg-accent transition-transform duration-instant"
          style={{ transform: `scaleX(${String(row.percent / 100)})` }}
        />
      </div>
      {/* Thanh tiến độ phải mang giá trị (ARIA 1.2, BUG-533), không chỉ một nhãn. */}
      <span
        aria-label={row.progressAriaLabel}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={row.percent}
        className="sr-only"
        role="progressbar"
      >
        {row.percentLabel}
      </span>
    </>
  );
}

export function FloorUploadCard({
  row,
  isCollapsed,
  isReadOnly,
  actions,
  acceptAttribute,
  registerCard,
}: FloorUploadCardProps) {
  const cardRef = useRef<HTMLLIElement | null>(null);
  const pickerRef = useRef<HTMLInputElement | null>(null);
  // Bảng tuỳ chọn mở thì thẻ nổi trên chân trang dính (`z-20`): thẻ là một ngữ cảnh xếp chồng
  // (`panel-rise` giữ `transform`), nên `z-10` của bảng không thoát ra được (BUG-526).
  const [isMenuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    registerCard(row.floorId, cardRef.current);

    return () => {
      registerCard(row.floorId, null);
    };
  }, [registerCard, row.floorId]);

  const file = row.file;
  const canPickPage = file !== null && file.pageOptions.length > 0 && !isReadOnly;

  return (
    <li
      className={clsx(
        'animate-panel-rise motion-reduce:animate-none relative rounded-xl border border-border-default bg-bg-surface p-5',
        isMenuOpen && 'z-30',
        isCollapsed ? 'flex flex-col gap-3' : 'flex min-h-24 flex-row flex-wrap items-center gap-4',
      )}
      data-floor-id={row.floorId}
      ref={cardRef}
      style={{
        animationDelay: `${String(row.revealDelayMs)}ms`,
        animationDuration: `${String(row.revealDurationMs)}ms`,
      }}
    >
      {/* Wraps, and the text keeps a floor: at 375 px the badge drops under the thumbnail instead of
          squeezing the floor name to "Tầng t…" and the subtitle to five lines (BUG-261). */}
      <div className={clsx('flex min-w-0 flex-1 flex-wrap items-center gap-4', isCollapsed && 'w-full')}>
        <motion.div
          className="flex h-[72px] w-24 shrink-0 items-center justify-center rounded-lg bg-bg-sunken"
          {...(file === null ? {} : { layoutId: `floor-upload-thumb-${file.id}` })}
        >
          {file?.previewUrl ? (
            <img alt="" className="h-full w-full rounded-lg object-contain" src={file.previewUrl} />
          ) : (
            <SheetGlyph />
          )}
        </motion.div>

        <div className="flex min-w-24 flex-1 flex-col gap-1">
          <h3 className="truncate text-[15px] font-medium text-text-primary">{row.name}</h3>
          <p className="text-[13px] text-text-muted">
            {LABEL_ELEVATION} {row.elevationLabel} · {LABEL_HEIGHT} {row.storeyHeightLabel}
          </p>
          {file !== null && (
            <p className="truncate text-[13px] text-text-secondary">{file.summaryLine}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={row.statusVariant}>
            {row.status === 'uploading' ? `${row.statusLabel} ${row.percentLabel}` : row.statusLabel}
          </Badge>
          {file === null && !isReadOnly && actions.onFilesForFloor !== undefined && (
            <>
              <input
                accept={acceptAttribute}
                aria-label={`${LABEL_UPLOAD_FOR_FLOOR} ${row.name}`}
                className="sr-only"
                onChange={(event) => {
                  const chosen = event.target.files;

                  if (chosen !== null && chosen.length > 0) {
                    actions.onFilesForFloor?.(row.floorId, [...chosen]);
                  }

                  event.target.value = '';
                }}
                ref={pickerRef}
                tabIndex={-1}
                type="file"
              />
              <Button onClick={() => pickerRef.current?.click()} size="sm" type="button" variant="secondary">
                {LABEL_UPLOAD_FOR_FLOOR}
              </Button>
            </>
          )}
          <CardMenu actions={actions} isOpen={isMenuOpen} row={row} setOpen={setMenuOpen} />
        </div>
      </div>

      {(row.autoMatchHint !== null ||
        (file !== null && file.isCadBranch) ||
        row.reassignOptions.length > 0 ||
        canPickPage) && (
        <div className={clsx('flex flex-col gap-2', isCollapsed ? 'w-full' : 'w-[220px] shrink-0')}>
          {file !== null && file.isCadBranch && <CadPill />}

          {row.autoMatchHint !== null && (
            <p className="text-[12px] text-state-attention-text">{row.autoMatchHint}</p>
          )}

          {file !== null && row.reassignOptions.length > 0 && (
            <Select.Root
              onChange={(next) => actions.onReassign(file.id, next)}
              options={[...row.reassignOptions]}
              value={row.floorId}
            >
              <Select.Label className="sr-only">{LABEL_REASSIGN}</Select.Label>
              <Select.Trigger options={[...row.reassignOptions]} placeholder={LABEL_REASSIGN} />
              <Select.Content>
                {row.reassignOptions.map((option, index) => (
                  <Select.Item index={index} key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          )}

          {canPickPage && file !== null && (
            <Select.Root
              onChange={(next) => actions.onPickPdfPage(file.id, next)}
              options={[...file.pageOptions]}
              {...(file.selectedPage === null ? {} : { value: file.selectedPage })}
            >
              <Select.Label className="sr-only">{LABEL_PAGE_PICKER}</Select.Label>
              <Select.Trigger options={[...file.pageOptions]} placeholder={LABEL_PAGE_PICKER} />
              <Select.Content>
                {file.pageOptions.map((option, index) => (
                  <Select.Item index={index} key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          )}
        </div>
      )}

      {row.error !== null && file !== null && (
        <div className="w-full basis-full">
          <InlineAlert
            action={{
              label: LABEL_DISMISS,
              onClick: () => actions.onDismissError(file.id),
              variant: 'secondary',
            }}
            level="violation"
            message={row.error.sentence}
          />
        </div>
      )}

      {row.status === 'uploading' && <ProgressRail row={row} />}
    </li>
  );
}
