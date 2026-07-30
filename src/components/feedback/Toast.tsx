/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

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
}

const ToastItem = forwardRef<HTMLDivElement, ToastItemProps>(
  ({ toast, index, onRemove }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const rafRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number | undefined>(undefined);
    const timeLeftRef = useRef(8000);

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
          setTimeout(() => onRemove(toast.id), 180);
        } else {
          setProgress((timeLeftRef.current / 8000) * 100);
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
      return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
    // onRemove is a stable useCallback from ToastProvider — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHovered, isExiting]);

    const handleUndo = () => {
      toast.onUndo?.();
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 180);
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
              onClick={handleUndo}
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

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    setToasts((prev) => {
      const newToast = { ...toast, id: Math.random().toString(36).substring(2, 9) };
      const next = [newToast, ...prev];
      return next.length > 3 ? next.slice(0, 3) : next;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col-reverse items-end gap-2 pointer-events-none"
        role="region"
        aria-label="Thông báo"
        aria-live="polite"
      >
        {toasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            index={index}
            onRemove={removeToast}
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

// ─── Legacy named exports (backward compat) ───────────────────────────────────

export { ToastProvider };
