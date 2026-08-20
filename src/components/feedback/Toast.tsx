/* eslint-disable react-refresh/only-export-components -- file này xuất hook `useToast`
 * và đối tượng gộp `Toast` bên cạnh `ToastProvider`. Người dùng toast cần cả ba từ một
 * chỗ; tách ra ba file để Fast Refresh giữ được state là đổi API lấy tiện nghi. */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { createUuid } from '../../lib/http/ids';
import { durationMs } from '../../lib/motion';
import { UNDO_WINDOW_MS } from '../../lib/mutations/undoTicket';
import { Button } from '../ui/Button';
import { useUndoableToast, UndoableToastState } from '../../hooks/useUndoableToast';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToastMessage {
  id: string;
  message: string;
  onUndo?: () => void;
  state?: 'verified' | 'attention' | 'violation';
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
}

const ToastItem = forwardRef<HTMLDivElement, ToastItemProps>(
  ({ toast, index, onRemove, resetKey = 0 }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const rafRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number | undefined>(undefined);
    const timeLeftRef = useRef(UNDO_WINDOW_MS);

    // Reset timer when resetKey changes (e.g. new item grouped or item popped)
    useEffect(() => {
      timeLeftRef.current = UNDO_WINDOW_MS;
      setProgress(100);
      lastTimeRef.current = undefined;
    }, [resetKey]);

    useEffect(() => {
      if (isHovered || isExiting) {
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
          setProgress((timeLeftRef.current / UNDO_WINDOW_MS) * 100);
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
      return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
    }, [isHovered, isExiting, onRemove, toast.id, resetKey]);

    const onUndoClick = () => {
      if (toast.onUndo) {
        toast.onUndo();
      }
    };

    const isPeek = index > 0;
    const dotColor =
      toast.state === 'attention' ? 'bg-state-attention'
      : toast.state === 'violation' ? 'bg-state-violation'
      : 'bg-state-verified';

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'relative w-[320px] bg-bg-surface shadow-float rounded-xl overflow-hidden pointer-events-auto transition-all duration-340 animate-toast-enter',
          isExiting && 'opacity-0 !h-0 !my-0 !py-0'
        )}
        style={{
          height: isPeek ? '4px' : 'auto',
          opacity: isExiting ? 0 : isPeek ? 0.6 : 1,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={cn('p-4 flex items-center gap-3 transition-opacity duration-340', isPeek ? 'opacity-0' : 'opacity-100')}>
          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} aria-hidden="true" />
          <span className="text-[15px] text-text-primary font-medium flex-1">
            {toast.message}
          </span>
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
        <div className="absolute bottom-0 left-0 h-[2px] bg-bg-sunken w-full" aria-hidden="true">
          <div className="h-full bg-accent transition-none" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }
);
ToastItem.displayName = 'Toast.Item';

// ─── Toast.Provider ───────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastMessage[]>([]);
  const [summaryResetKey, setSummaryResetKey] = useState(0);

  // Hàm cập nhật state phải THUẦN: `src/main.tsx` bật StrictMode, nên React gọi
  // nó hai lần lúc phát triển. Trước đây id sinh bằng số ngẫu nhiên NGAY TRONG
  // hàm cập nhật, và `setSummaryResetKey` cũng gọi từ trong đó — hai lượt gọi cho
  // hai id khác nhau và tăng resetKey hai lần, nên toast thỉnh thoảng nhân đôi
  // hoặc mất. Sinh id trước, rồi để hàm cập nhật chỉ còn việc ghép mảng.
  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const newToast = { ...toast, id: createUuid() };

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
      addToast({
        message: undoableToast.label,
        state: 'verified',
        onUndo: undoableToast.onUndo,
      });
    }
  }, [undoableToast, addToast]);

  // Compute UI slots based on locked logic
  let displaySlots: (ToastMessage & { resetKey?: number })[] = [];

  if (queue.length <= 3) {
    displaySlots = queue;
  } else if (queue.length > 0) {
    // 4 or more toasts
    const slot1 = queue[0] as ToastMessage;
    const slot2 = queue[1] as ToastMessage;
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
      setQueue(prev => target ? (prev.filter(t => t.id !== target.id) as ToastMessage[]) : prev);
      setSummaryResetKey(k => k + 1);
    };

    const summaryToast: ToastMessage & { resetKey: number } = {
      id: 'summary-toast-group',
      message: summaryMessage,
      state: 'verified',
      onUndo: handleSummaryUndo,
      resetKey: summaryResetKey,
    };

    displaySlots = [slot1, slot2, summaryToast];
  }

  const handleRemoveSlot = (id: string) => {
    if (id === 'summary-toast-group') {
      setQueue(prev => prev.length <= 3 ? prev : [prev[0] as ToastMessage, prev[1] as ToastMessage]);
    } else {
      removeToast(id);
    }
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col-reverse items-end gap-2 pointer-events-none"
        role="region"
        aria-label="Thông báo"
        aria-live="polite"
      >
        {displaySlots.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            index={index}
            onRemove={handleRemoveSlot}
            resetKey={toast.resetKey ?? 0}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
ToastProvider.displayName = 'Toast.Provider';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Toast = {
  Provider: ToastProvider,
  Item: ToastItem,
};
