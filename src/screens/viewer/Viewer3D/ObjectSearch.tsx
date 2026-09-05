/**
 * Ô TÌM ĐỐI TƯỢNG của màn `Viewer3D` — view thuần (R-60).
 *
 * ## Vì sao nó sống ở đây chứ không ở `src/components`
 *
 * Vỏ chung nhận `onOpenSearch` và docblock của nó nói thẳng "vỏ không tự dựng
 * hộp thoại nào" (`useViewerShell.ts:214`), nên hộp tìm là việc của MÀN NỘI
 * DUNG. Một ô tìm biết "phòng" là gì thì không phải một điều khiển dùng chung.
 *
 * ## Vì sao nó đứng giữa mép trên khung nhìn
 *
 * Bốn góc của khung nhìn đã có chủ và không góc nào nhường được mà không sửa vỏ
 * (`ViewerShell.tsx:160-199`): trái trên là thang cao độ, phải trên là ViewCube
 * cộng bản đồ nhỏ, phải dưới là cụm thu phóng, trái dưới là chú giải. Giữa mép
 * trên là khoảng trống duy nhất còn lại, và đặt ở đó giữ nguyên được bài P2 —
 * "ViewCube bấm được bằng chuột, bản đồ nhỏ không đè lên nó".
 *
 * Lớp bọc ngoài `pointer-events-none` để dải ngang rỗng hai bên panel không
 * nuốt cú kéo xoay camera; chỉ chính panel `pointer-events-auto`.
 *
 * ## Bàn phím là đường đi hạng nhất (A12)
 *
 * Mở bằng chuột (nút "tìm phòng") hoặc bằng phím `/` của vỏ. Trong ô: mũi tên
 * lên xuống đổi dòng đang nhắm, Enter chọn, **Esc đóng** — và Esc được chặn lại
 * ở đây (`stopPropagation`) để nó đóng ĐÚNG lớp trên cùng thay vì rơi xuống sổ
 * phím, nơi `buildDeselectShortcut` của vỏ đang chờ để bỏ chọn.
 *
 * Đóng ô thì tiêu điểm quay về nút mở, không rơi ra `<body>`. Việc ấy phải chờ
 * lần vẽ sau — lúc `onClose()` chạy thì nút mở còn chưa được gắn lại — nên nó
 * nằm trong hiệu ứng chứ không nằm ngay trong hàm đóng.
 *
 * Danh sách đi theo khuôn `aria-activedescendant`: ô chữ giữ tiêu điểm, dòng
 * đang nhắm được trỏ tới bằng `id`. Nên không dòng nào cần `tabindex`, và Tab
 * vẫn đi qua cả nhóm bằng một lần bấm.
 *
 * ## Ctrl+F đứng cạnh `/`, không thay nó
 *
 * `/` do vỏ (`ViewerShell/viewerShellShortcuts.ts`) đăng ký ở phạm vi
 * `canvas`, gọi đúng `onOpen` này. Ctrl+F là lối vào quen thuộc hơn với người
 * dùng trình duyệt, nhưng nó CHỈ có nghĩa khi đang xem mô hình không gian —
 * mọi màn khác trong ứng dụng không có gì để tìm. Đăng ký nó ở phạm vi toàn
 * cục sẽ cướp "tìm trong trang" của trình duyệt ở hai mươi mấy màn còn lại
 * (lỗ hổng #9); đăng ký ngay đây, ở phạm vi `canvas`, thì tổ hợp chỉ sống khi
 * `ObjectSearch` — tức khi màn xem mô hình — đang gắn. `registry` tuỳ chọn là
 * chỗ tiêm cho bài kiểm (cùng khuôn `Viewer3DContainerProps.registry`): không
 * truyền thì dùng `appShortcutRegistry` dùng chung của cả ứng dụng.
 */

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { useShortcut } from '@/hooks/useShortcut';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { cn } from '@/lib/utils';

import { matchRoomOptions, type ViewerRoomOption } from './roomSearch';

/** Nhãn nút mở — bài kiểm và bài e2e tìm ô tìm bằng đúng chữ này. */
export const OPEN_SEARCH_LABEL = 'tìm phòng';

/** Nhãn ô chữ, cũng là câu trình đọc màn hình đọc ra khi tiêu điểm vào. */
export const SEARCH_INPUT_LABEL = 'tìm phòng theo tên hoặc mã';

/** Nhãn của danh sách kết quả. */
export const SEARCH_LIST_LABEL = 'kết quả tìm phòng';

/** Câu khi không phòng nào khớp — không phải một danh sách trắng (A11). */
export const NO_MATCH_MESSAGE = 'không có phòng nào khớp';

export interface ObjectSearchProps {
  /** Mọi phòng của mô hình đang xem; rỗng thì ô tìm không được vẽ. */
  readonly rooms: readonly ViewerRoomOption[];
  readonly isOpen: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  /** Chọn một phòng: đi qua S-10/S-11 rồi khuôn camera vào nó (R-07). */
  readonly onSelectRoom: (roomId: string) => void;
  /** Phòng đang được chọn trong kho, để dòng tương ứng nói ra điều đó. */
  readonly selectedRoomId: string | null;
  /** Đăng ký thay cho `appShortcutRegistry` dùng chung — chỗ tiêm cho bài kiểm. */
  readonly registry?: ShortcutRegistry;
}

/** Viền tiêu điểm 2px kèm offset 2px — cùng khuôn ViewCube của vỏ (A12). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

/** Kẹp một chỉ số vào khoảng của danh sách, cuộn vòng ở hai đầu. */
function wrapIndex(index: number, count: number): number {
  if (count === 0) {
    return 0;
  }

  return ((index % count) + count) % count;
}

export function ObjectSearch({
  rooms,
  isOpen,
  onOpen,
  onClose,
  onSelectRoom,
  selectedRoomId,
  registry,
}: ObjectSearchProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(isOpen);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useShortcut(
    {
      id: 'viewer.search.openCtrlF',
      combo: 'Ctrl+F',
      scope: 'canvas',
      description: 'mở ô tìm đối tượng',
      onTrigger: onOpen,
    },
    registry !== undefined ? { registry } : {},
  );

  const { options, hasMore } = matchRoomOptions(rooms, query);
  const activeOption = options[wrapIndex(activeIndex, options.length)];

  useEffect(() => {
    if (isOpen) {
      /* Mở ra là gõ được ngay — mở bằng phím `/` mà vẫn phải với chuột đi bấm
         vào ô chữ là đúng thứ A12 gọi là phương án dự phòng. */
      inputRef.current?.focus();
    } else if (wasOpenRef.current) {
      triggerRef.current?.focus();
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const choose = useCallback(
    (roomId: string): void => {
      onSelectRoom(roomId);
      onClose();
    },
    [onSelectRoom, onClose],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) =>
          wrapIndex(current + (event.key === 'ArrowDown' ? 1 : -1), options.length),
        );
        return;
      }

      if (event.key === 'Enter' && activeOption !== undefined) {
        event.preventDefault();
        choose(activeOption.id);
      }
    },
    [onClose, choose, activeOption, options.length],
  );

  if (rooms.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
      <div className="pointer-events-auto w-[320px] max-w-full">
        {!isOpen && (
          <button
            className={cn(
              'mx-auto flex items-center rounded-[8px] px-3 py-1.5',
              'border border-border-default bg-bg-surface shadow-float',
              'text-[13px] leading-none text-text-primary',
              'transition-colors duration-120 hover:bg-bg-hover',
              FOCUS_RING,
            )}
            onClick={onOpen}
            ref={triggerRef}
            type="button"
          >
            {OPEN_SEARCH_LABEL}
          </button>
        )}

        {isOpen && (
          <div
            className={cn(
              'flex flex-col gap-1 rounded-[10px] p-2',
              'border border-border-default bg-bg-surface shadow-float',
            )}
          >
            <input
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded="true"
              aria-label={SEARCH_INPUT_LABEL}
              className={cn(
                'w-full rounded-[6px] px-2 py-1.5',
                'border border-border-default bg-bg-sunken',
                'text-[13px] leading-none text-text-primary placeholder:text-text-secondary',
                FOCUS_RING,
              )}
              onChange={(event): void => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="tên hoặc mã phòng"
              ref={inputRef}
              role="combobox"
              type="text"
              value={query}
              {...(activeOption === undefined
                ? {}
                : { 'aria-activedescendant': `${listId}-${activeOption.id}` })}
            />

            <ul aria-label={SEARCH_LIST_LABEL} className="flex flex-col" id={listId} role="listbox">
              {options.map((room) => (
                <li
                  aria-selected={room.id === selectedRoomId}
                  className={cn(
                    'flex cursor-pointer items-baseline justify-between gap-3 rounded-[6px] px-2 py-1.5',
                    'text-[13px] leading-none transition-colors duration-120',
                    room.id === activeOption?.id
                      ? 'bg-accent-wash text-text-primary'
                      : 'text-text-primary hover:bg-bg-hover',
                  )}
                  id={`${listId}-${room.id}`}
                  key={room.id}
                  onClick={(): void => {
                    choose(room.id);
                  }}
                  onMouseEnter={(): void => {
                    setActiveIndex(options.indexOf(room));
                  }}
                  role="option"
                >
                  <span className="truncate">{room.name}</span>
                  <span className="shrink-0 text-[11px] text-text-secondary">
                    {room.id} · {room.storeyName} · {room.areaLabel}
                  </span>
                </li>
              ))}
            </ul>

            {options.length === 0 && (
              <p className="px-2 py-1.5 text-[13px] leading-none text-text-secondary">
                {NO_MATCH_MESSAGE}
              </p>
            )}

            {hasMore && (
              <p className="px-2 py-1 text-[11px] leading-none text-text-secondary">
                còn phòng nữa — gõ thêm để thu hẹp
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
