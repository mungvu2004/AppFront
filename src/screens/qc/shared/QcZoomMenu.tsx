import { Check, ChevronDown, Columns2 } from 'lucide-react';
import { useState, type FocusEvent, type KeyboardEvent, type SyntheticEvent } from 'react';

import { cn } from '@/lib/utils';

import { useQcCanvasCover } from './qcCanvasCover';
import { setQcCompare, useQcCompare } from './qcCompare';
import { setQcViewMode, useQcViewMode, type QcViewMode } from './qcViewMode';

/**
 * Cụm phóng của bản vẽ duyệt tầng, gọn như ô "100% ▾" của Figma: MỘT nút trên bản vẽ, menu mở lên trên
 * gồm Phóng to · Thu nhỏ · Về 100% · Vừa khung, và (màn có chế độ nhìn) "Từng việc | Tổng thể" — chế độ
 * nhìn là cách bản vẽ phóng (tới mục / cả tầng), nên đứng cùng chỗ với phóng. Phím F vẫn đổi chế độ
 * (`QcViewLayer`); lăn chuột vẫn phóng.
 *
 * Menu đóng bằng Esc, khi tiêu điểm rời cụm, hoặc sau Về 100% / Vừa khung / chọn chế độ; Phóng to / Thu nhỏ giữ menu để bấm lặp.
 * ponytail: không đóng khi bấm vào bản vẽ mà tiêu điểm không đổi; cần thì đổi sang Popover.
 */
export interface QcZoomMenuProps {
  readonly zoomLevel?: number | undefined;
  readonly onZoomIn?: (() => void) | undefined;
  readonly onZoomOut?: (() => void) | undefined;
  readonly onResetZoom?: (() => void) | undefined;
  readonly onFitToScreen?: (() => void) | undefined;
  /** Phím "Vừa khung" của màn (màn Tỷ lệ: F), ghi cạnh mục. */
  readonly fitShortcut?: string | undefined;
  /** Màn có hai chế độ nhìn L23 (Tường, Cửa và nội thất, Phòng). */
  readonly viewMode?: boolean | undefined;
  /** Màn có "So sánh hai bên" (Tường, Cửa và nội thất): nút bật/tắt ngay cạnh nút phóng. */
  readonly compare?: boolean | undefined;
  /** Đè lên các khoá cũ của `ZoomCluster` khi màn trải nguyên props của nó. */
  readonly isVisible?: boolean | undefined;
}

const MODES: readonly { readonly key: QcViewMode; readonly label: string }[] = [
  { key: 'task', label: 'Từng việc' },
  { key: 'overview', label: 'Tổng thể' },
];
const COMPARE_LABEL = 'So sánh hai bên';
const COMPARE_SHORT = 'So sánh';
const COMPARE_HINT = 'So sánh hai bên. Trái: bản vẽ gốc · Phải: đã nhận diện. Esc để thoát';
const ITEM_CLASS =
  'flex h-8 w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-body-sm text-text-primary hover:bg-bg-hover focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent';
const KEY_CLASS = 'ml-auto pl-4 text-caption text-text-muted';
/** `bottom-4 right-4`. */
const MENU_EDGE_PX = 16;

/** Khung bản vẽ không nhận cú bấm/kéo bắt đầu trên menu này (kéo nền, bỏ chọn). */
const stop = (event: SyntheticEvent) => event.stopPropagation();

export function QcZoomMenu({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  fitShortcut,
  viewMode = false,
  compare = false,
  isVisible = true,
}: QcZoomMenuProps) {
  const [open, setOpen] = useState(false);
  const mode = useQcViewMode();
  const isComparing = useQcCompare();
  const cover = useQcCanvasCover();
  if (!isVisible) return null;
  const close = () => setOpen(false);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return;
    event.stopPropagation();
    close();
    event.currentTarget.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus();
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
  };
  const then = (action: (() => void) | undefined, keepOpen: boolean) =>
    action === undefined
      ? undefined
      : () => {
          action();
          if (!keepOpen) close();
        };
  const label = zoomLevel === undefined ? '100%' : `${zoomLevel}%`;
  const items: readonly {
    readonly text: string;
    readonly keyHint?: string | undefined;
    readonly onClick: (() => void) | undefined;
  }[] = [
    { text: 'Phóng to', onClick: then(onZoomIn, true) },
    { text: 'Thu nhỏ', onClick: then(onZoomOut, true) },
    { text: 'Về 100%', onClick: then(onResetZoom, false) },
    { text: 'Vừa khung nhìn', keyHint: fitShortcut, onClick: then(onFitToScreen, false) },
  ];

  return (
    <div
      className="absolute bottom-4 right-4 z-20 flex items-center gap-2"
      /* Panel nổi đè mép phải/đáy bản vẽ: cụm này đứng ngay cạnh panel, không nằm dưới nó. */
      style={cover.right > 0 || cover.bottom > 0 ? { bottom: cover.bottom + MENU_EDGE_PX, right: cover.right + MENU_EDGE_PX } : undefined}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={stop}
      onPointerUp={stop}
    >
      {compare ? (
        <button
          aria-label={COMPARE_LABEL}
          aria-pressed={isComparing}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-xl border px-3 text-body-sm font-medium shadow-float focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent',
            isComparing ? 'border-accent bg-accent-wash text-accent' : 'border-border-default bg-bg-surface text-text-primary hover:bg-bg-hover',
          )}
          onClick={() => setQcCompare(!isComparing)}
          title={COMPARE_HINT}
          type="button"
        >
          <Columns2 aria-hidden="true" className="h-4 w-4" />
          <span className="max-lg:sr-only">{COMPARE_SHORT}</span>
        </button>
      ) : null}
      <button
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Mức thu phóng ${label}: mở danh sách phóng${viewMode ? ` và chế độ nhìn (đang ${MODES.find((item) => item.key === mode)?.label ?? ''})` : ''}`}
        className="flex h-9 items-center gap-1 rounded-xl border border-border-default bg-bg-surface px-3 font-mono text-sm text-text-primary shadow-float hover:bg-bg-hover focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent"
        onClick={() => setOpen(!open)}
        type="button"
      >
        {label}
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-text-muted" />
      </button>
      {!open ? null : (
        <div className="absolute bottom-full right-0 mb-1 min-w-[200px] rounded-md border border-border-default bg-bg-surface p-1 shadow-float">
          {items.map((item) => (
            <button
              className={ITEM_CLASS}
              disabled={item.onClick === undefined}
              key={item.text}
              onClick={item.onClick}
              type="button"
            >
              {item.text}
              {item.keyHint === undefined ? null : (
                <span aria-hidden="true" className={KEY_CLASS}>{item.keyHint}</span>
              )}
            </button>
          ))}
          {viewMode ? (
            <div
              aria-label="Chế độ nhìn"
              className="mt-1 border-t border-border-default pt-1"
              role="group"
            >
              {MODES.map((item) => (
                <button
                  aria-pressed={mode === item.key}
                  className={ITEM_CLASS}
                  key={item.key}
                  onClick={() => {
                    setQcViewMode(item.key);
                    close();
                  }}
                  title={`${item.label} (F)`}
                  type="button"
                >
                  <Check
                    aria-hidden="true"
                    className={cn('h-3.5 w-3.5', mode === item.key ? 'text-accent' : 'invisible')}
                  />
                  {item.label}
                  <span aria-hidden="true" className={KEY_CLASS}>F</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
