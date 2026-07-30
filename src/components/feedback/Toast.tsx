/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

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

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    setToasts((prev) => {
      const newToast = { ...toast, id: Math.random().toString(36).substring(2, 9) };
      const next = [newToast, ...prev];
      if (next.length > 3) {
        return next.slice(0, 3);
      }
      return next;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse items-end gap-2 pointer-events-none">
        {toasts.map((toast, index) => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            index={index} 
            onRemove={() => removeToast(toast.id)} 
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, index, onRemove }: { toast: ToastMessage; index: number; onRemove: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const rafRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const timeLeftRef = useRef(8000); // 8 seconds countdown

  useEffect(() => {
    if (isHovered || isExiting) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = undefined;
      return;
    }

    const animate = (time: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
      }
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;
      
      timeLeftRef.current -= deltaTime;
      
      if (timeLeftRef.current <= 0) {
        setProgress(0);
        setIsExiting(true);
        setTimeout(() => onRemove(), 180); // exit animation duration
      } else {
        setProgress((timeLeftRef.current / 8000) * 100);
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isHovered, isExiting, onRemove]);

  const handleUndo = () => {
    if (toast.onUndo) {
      toast.onUndo();
    }
    setIsExiting(true);
    setTimeout(() => onRemove(), 180);
  };

  const isPeek = index > 0;
  
  // State colors
  const dotColor = toast.state === 'attention' ? 'bg-state-attention' 
                 : toast.state === 'violation' ? 'bg-state-violation' 
                 : 'bg-state-verified';

  return (
    <div
      className={`relative w-[320px] bg-bg-surface shadow-float rounded-xl overflow-hidden pointer-events-auto transition-all duration-340 animate-toast-enter ${
        isExiting ? 'opacity-0 !h-0 !my-0 !py-0' : ''
      }`}
      style={{
        height: isPeek ? '4px' : 'auto',
        opacity: isExiting ? 0 : isPeek ? 0.6 : 1,
        marginBottom: isExiting ? '0' : '0',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`p-4 flex items-center gap-3 ${isPeek ? 'opacity-0' : 'opacity-100'} transition-opacity duration-340`}>
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
        <span className="text-[15px] text-text-primary font-medium flex-1">
          {toast.message}
        </span>
        {toast.onUndo && (
          <button 
            onClick={handleUndo}
            className="text-accent hover:text-accent-hover font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded"
          >
            Hoàn tác
          </button>
        )}
      </div>
      
      {/* 2px countdown bar */}
      <div className="absolute bottom-0 left-0 h-[2px] bg-bg-sunken w-full">
        <div 
          className="h-full bg-accent"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
