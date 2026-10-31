/* eslint-disable react-refresh/only-export-components -- file này xuất hook `useToast`
 * và đối tượng gộp `Toast` bên cạnh `ToastProvider`. Người dùng toast cần cả ba từ một
 * chỗ; tách ra ba file để Fast Refresh giữ được state là đổi API lấy tiện nghi. */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { createUuid } from '../../lib/http/ids';
import { durationMs } from '../../lib/motion';
import { UNDO_WINDOW_MS, holdUndoWindows } from '../../lib/mutations/undoTicket';
import { Button } from '../ui/Button';
import type { UndoableToastState } from '../../hooks/useUndoableToast';
import { useUndoableToast } from '../../hooks/useUndoableToast';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToastMessage {
  /** Optional extra button, e.g. navigating to where a refusal can be fixed (BUG-605). */
  action?: { label: string; onClick: () => void };
  id: string;
  message: string;
  onUndo?: () => void;
  state?: 'verified' | 'attention' | 'violation';
  /** Cửa sổ hoàn tác của toast này (ms); vắng = `UNDO_WINDOW_MS`. Lấy từ `UndoTicket.ttlMs`. */
  windowMs?: number;
}

interface ToastContextValue {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within Toast.Provider');
  return ctx;
}

// ─── Toast.Item ───────────────────────────────────────────────────────────────

export interface ToastItemProps {
  toast: ToastMessage;
  index: number;
  onRemove: (id: string) => void;
  resetKey?: number; // Used to trigger timer reset for grouped toast
  /**
   * `Date.now()` when the change this toast undoes was made. The window runs from
   * there, not from mount: a slot that mounts late (the summary, or a toast coming
   * back out of it) must not offer an undo its ticket has already refused.
   */
  startedAt?: number;
  /**
   * Toast gộp nhiều lượt: bấm "Hoàn tác" chỉ gỡ một lượt khỏi nhóm, nên nó ở lại.
   * Mọi toast khác rời đi ngay sau khi hoàn tác (A8): lời mời đã dùng xong mà còn
   * treo đó là hứa hoàn tác thêm một lần nữa.
   */
  keepAfterUndo?: boolean;
}

const ToastItem = forwardRef<HTMLDivElement, ToastItemProps>(
  ({ toast, index, onRemove, resetKey = 0, keepAfterUndo = false, startedAt }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const rafRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number | undefined>(undefined);
    /* U35: vé có cửa sổ riêng (xoá tường 15 s) thì toast ở lại đúng chừng đó. */
    const windowMs = toast.windowMs ?? UNDO_WINDOW_MS;
    const timeLeftRef = useRef(windowMs);

    // Reset timer when resetKey changes (e.g. new item grouped or item popped): what is
    // left of the window of the change it now undoes.
    useEffect(() => {
      const timeLeft = startedAt === undefined ? windowMs : windowMs - (Date.now() - startedAt);
      timeLeftRef.current = timeLeft;
      setProgress(Math.max(0, (timeLeft / windowMs) * 100));
      lastTimeRef.current = undefined;
    }, [resetKey, startedAt, windowMs]);

    // Hover or focus holds the toast — a person is reading it or reaching for "Hoàn tác"
    // (WCAG 2.2.1, BUG-571). An undo toast holds its ticket's clock with it, so the button
    // never offers an undo the ticket would refuse (BUG-524). The bar IS the undo window.
    const isHeld = isHovered || isFocused;
    const hasUndo = toast.onUndo !== undefined;

    useEffect(() => {
      if (!isHeld || !hasUndo || isExiting) {
        return undefined;
      }

      return holdUndoWindows();
    }, [isHeld, hasUndo, isExiting]);

    useEffect(() => {
      if (isHeld || isExiting) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        lastTimeRef.current = undefined;
        return;
      }

      const animate = (time: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = time;
        const delta = time - lastTimeRef.current;
        lastTimeRef.current = time;
        timeLeftRef.current -= delta;

        if (timeLeftRef.current <= 0) {
          setProgress(0);
          setIsExiting(true);
          setTimeout(() => onRemove(toast.id), durationMs('fast'));
        } else {
          setProgress((timeLeftRef.current / windowMs) * 100);
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
      return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
    }, [isHeld, isExiting, onRemove, toast.id, resetKey, windowMs]);

    // Hoàn tác xong thì toast đã hết việc: rời đi ngay. Không thế thì nó treo tới
    // hết cửa sổ, che nút bên dưới, với một nút "Hoàn tác" không còn gì để làm (B-V4-11).
    const onUndoClick = () => {
      // Bấm đúp: nút còn trong DOM tới khi toast gỡ xong, lần bấm thứ hai không được hoàn tác lại.
      if (isExiting && !keepAfterUndo) return;
      if (toast.onUndo) {
        toast.onUndo();
      }
      if (!keepAfterUndo) {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), durationMs('fast'));
      }
    };

    // Toast xếp sau chỉ lộ một vạch 4 px; chuột vào vạch hoặc tiêu điểm tới nút thì nó mở ra để bấm "Hoàn tác".
    const isPeek = index > 0 && !isHeld;
    // No state = a plain notice, a neutral dot. A5 keeps the green for what a reviewer verified, so it is
    // never the fallback: every toast without a state, errors included, used to wear it (BUG-207).
    const dotColor =
      toast.state === 'verified' ? 'bg-state-verified'
      : toast.state === 'attention' ? 'bg-state-attention'
      : toast.state === 'violation' ? 'bg-state-violation'
      : 'bg-text-muted';

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'relative w-80 bg-bg-surface shadow-float rounded-xl overflow-hidden pointer-events-auto transition-opacity duration-340 animate-toast-enter',
          isExiting && 'opacity-0 h-0! my-0! py-0!'
        )}
        style={{
          height: isPeek ? '4px' : 'auto',
          opacity: isExiting ? 0 : isPeek ? 0.6 : 1,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
        }}
      >
        <div className={cn('p-4 flex items-center gap-3 transition-opacity duration-340', isPeek ? 'opacity-0' : 'opacity-100')}>
          {/* BUG-131: min-w-0 lets the span shrink, wrap-break-word wraps a name with no space — "Hoàn tác" stays in.
              BUG-229: an 80-char name ran to 5 lines and the dot sat in the middle of the block. Three lines at most,
              then "…" (the full text stays in the DOM for screen readers), and the dot hangs beside the first line. */}
          <span className="relative line-clamp-3 min-w-0 flex-1 wrap-break-word pl-[18px] text-[15px] font-medium leading-[22px] text-text-primary">
            <span className={cn('absolute left-0 top-2 h-1.5 w-1.5 rounded-full', dotColor)} aria-hidden="true" />
            {toast.message}
          </span>
          {toast.action && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toast.action.onClick}
              className="text-accent hover:text-accent-hover shrink-0"
            >
              {toast.action.label}
            </Button>
          )}
          {toast.onUndo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onUndoClick}
              className="text-accent hover:text-accent-hover shrink-0"
            >
              Hoàn tác
            </Button>
          )}
        </div>

        {/* 2px countdown bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-bg-sunken w-full" aria-hidden="true">
          <div className="h-full bg-accent transition-none" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }
);
ToastItem.displayName = 'Toast.Item';

// ─── Toast.Provider ───────────────────────────────────────────────────────────

// ─── Toast.Viewport ───────────────────────────────────────────────────────────

/**
 * Vùng neo toast, dùng chung cho `Toast.Provider` và `NotificationHost`. Ngăn đang mở
 * (`Drawer` đặt `data-drawer` lên <html>) chiếm góc dưới-phải, nơi có nút chân của nó:
 * ngăn bên → toast lùi sang trái ngăn; tờ dưới 1024 px → toast lên mép trên (BUG-227).
 * Dưới 640 px toast cũng lên mép trên: ở dưới nó che ô đang gõ, như "Ghi chú" (BUG-512).
 */
function ToastViewport({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-label="Thông báo"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col-reverse items-end gap-2',
        // Màn có chân dính đáy khung nhìn (`data-sticky-footer`, cao tới ~85 px): toast đứng trên nó
        // (29-F-010). Không áp khi tờ dưới đang mở hay dưới 640 px — hai chỗ đó toast đã lên mép trên.
        'sm:[html:has([data-sticky-footer]):not([data-drawer=sheet])_&]:bottom-24',
        // U22: màn duyệt tầng có thanh trạng thái 36 px ở đáy ("A duyệt · J kế tiếp · Đã lưu lúc…"): toast đứng trên nó.
        "sm:[html:has([aria-label='Thanh_trạng_thái']):not(:has([data-sticky-footer])):not([data-drawer=sheet])_&]:bottom-14",
        '[html[data-drawer=side]_&]:right-[calc(1rem+var(--drawer-inset))]',
        '[html[data-drawer=sheet]_&]:bottom-auto [html[data-drawer=sheet]_&]:top-4',
        'max-sm:bottom-auto max-sm:top-4',
      )}
      role="region"
    >
      {children}
    </div>
  );
}

/** A queued toast remembers when its change was made: its undo window runs from there. */
type QueuedToast = ToastMessage & { createdAt: number };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedToast[]>([]);
  const [summaryResetKey, setSummaryResetKey] = useState(0);

  // Hàm cập nhật state phải THUẦN: `src/main.tsx` bật StrictMode, nên React gọi
  // nó hai lần lúc phát triển. Trước đây id sinh bằng số ngẫu nhiên NGAY TRONG
  // hàm cập nhật, và `setSummaryResetKey` cũng gọi từ trong đó — hai lượt gọi cho
  // hai id khác nhau và tăng resetKey hai lần, nên toast thỉnh thoảng nhân đôi
  // hoặc mất. Sinh id trước, rồi để hàm cập nhật chỉ còn việc ghép mảng.
  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const newToast = { ...toast, createdAt: Date.now(), id: createUuid() };

    setQueue((prev) => [newToast, ...prev]);
    setSummaryResetKey((k) => k + 1);
  }, []);

  const removeToast = useCallback((id: string) => {
    setQueue((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Strict dedupe mechanism listening to useUndoableToast
  const undoableToast = useUndoableToast();
  const prevToastRef = useRef<UndoableToastState | null>(null);

  useEffect(() => {
    if (undoableToast && undoableToast.isVisible && undoableToast !== prevToastRef.current) {
      prevToastRef.current = undoableToast;
      // No state: an undoable change is a plain notice. A5 keeps the green for what a reviewer verified.
      addToast({
        message: undoableToast.label,
        onUndo: undoableToast.onUndo,
      });
    }
  }, [undoableToast, addToast]);

  // Compute UI slots based on locked logic
  let displaySlots: (QueuedToast & { resetKey?: number })[] = [];

  if (queue.length <= 3) {
    displaySlots = queue;
  } else if (queue.length > 0) {
    // 4 or more toasts
    const slot1 = queue[0] as QueuedToast;
    const slot2 = queue[1] as QueuedToast;
    const groupedItems = queue.slice(2);
    
    // Safe Domain Extraction Fallback
    const isAllTuong = groupedItems.every(t => t.message.toLowerCase().endsWith('tường'));
    const isAllCua = groupedItems.every(t => t.message.toLowerCase().endsWith('cửa'));
    
    let summaryMessage = `Đã thực hiện ${groupedItems.length} thay đổi`;
    if (isAllTuong) summaryMessage = `Đã sửa ${groupedItems.length} tường`;
    else if (isAllCua) summaryMessage = `Đã sửa ${groupedItems.length} cửa`;

    const handleSummaryUndo = () => {
      const target = groupedItems[0];
      if (target && target.onUndo) target.onUndo();
      setQueue(prev => target ? prev.filter(t => t.id !== target.id) : prev);
      setSummaryResetKey(k => k + 1);
    };

    // Its window is its target's — the change "Hoàn tác" takes back — not a fresh 8 s per
    // new toast: a fresh one outlived that change's ticket and pressed it for nothing.
    const summaryToast: QueuedToast & { resetKey: number } = {
      createdAt: groupedItems[0]?.createdAt ?? Date.now(),
      id: 'summary-toast-group',
      message: summaryMessage,
      onUndo: handleSummaryUndo,
      resetKey: summaryResetKey,
    };

    displaySlots = [slot1, slot2, summaryToast];
  }

  const handleRemoveSlot = (id: string) => {
    if (id === 'summary-toast-group') {
      setQueue(prev => prev.length <= 3 ? prev : [prev[0] as QueuedToast, prev[1] as QueuedToast]);
    } else {
      removeToast(id);
    }
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastViewport>
        {displaySlots.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            index={index}
            onRemove={handleRemoveSlot}
            resetKey={toast.resetKey ?? 0}
            startedAt={toast.createdAt}
            keepAfterUndo={toast.id === 'summary-toast-group'}
          />
        ))}
      </ToastViewport>
    </ToastContext.Provider>
  );
}
ToastProvider.displayName = 'Toast.Provider';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Toast = {
  Provider: ToastProvider,
  Item: ToastItem,
  Viewport: ToastViewport,
};
