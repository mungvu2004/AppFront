import React, { createContext, useContext, useEffect, useRef, forwardRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Z_INDEX } from '../../lib/zIndex';
import { DURATION, EASE, SPRING } from '../../lib/motion';
import { useShortcut } from '../../hooks/useShortcut';
import { createFocusTrap } from '../../lib/input/focusTrap';

// ─── Media Query (private) ───────────────────────────────────────────────────

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
}

// ─── Bottom-sheet snap points (mobile) ───────────────────────────────────────

type SnapLevel = 0 | 1 | 2; // 0=peek(88px), 1=half(40%), 2=full(90vh)

function getSnapHeight(level: SnapLevel, windowHeight: number): number {
  if (level === 0) return 88;
  if (level === 1) return Math.round(windowHeight * 0.4);
  return Math.round(windowHeight * 0.9);
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface DrawerContextValue {
  onClose: () => void;
  isMobile: boolean;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

function useDrawerContext(name: string) {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error(`<${name}> phải dùng bên trong <Drawer.Root>`);
  return ctx;
}

// ─── Drawer.Root ─────────────────────────────────────────────────────────────

export interface DrawerRootProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Chiều rộng drawer desktop */
  size?: number | undefined;
}

function DrawerRoot({ isOpen, onClose, children, size }: DrawerRootProps) {
  const drawerWidth = size ?? 400;

  const prefersReducedMotion = useReducedMotion();
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const containerRef = useRef<HTMLDivElement>(null);
  const [snapLevel, setSnapLevel] = useState<SnapLevel>(2); // mở full mặc định

  // Bẫy tiêu điểm dùng chung (src/lib/input/focusTrap): Tab vòng trong
  // drawer, Esc gọi onClose rồi dừng lan, đóng thì trả tiêu điểm về nơi mở.
  // isMobile nằm trong deps vì container đổi giữa drawer desktop và
  // bottom-sheet khi viewport vượt breakpoint.
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const trap = createFocusTrap(container, { onEscape: onClose });
    const raf = requestAnimationFrame(() => trap.activate());

    return () => {
      cancelAnimationFrame(raf);
      trap.release();
    };
  }, [isOpen, onClose, isMobile]);

  // Esc khi focus nằm ngoài drawer — qua trọng tài phím tắt. Binding scope
  // 'dialog' cũng làm tầng dialog thành modal chừng nào drawer còn mở.
  useShortcut(
    { id: 'drawer.close', combo: 'Escape', scope: 'dialog', preventDefault: false, onTrigger: onClose },
    { enabled: isOpen },
  );

  // Reset snap level khi đóng — điều chỉnh NGAY TRONG lúc render, không qua
  // effect. Effect đồng bộ state sang state luôn tốn thêm một lượt render với
  // dữ liệu cũ trên màn hình: drawer đã đóng nhưng snapLevel vẫn là mức cũ cho
  // tới lượt sau (R-27). Khuôn "so với giá trị trước" dưới đây là cách React
  // khuyến nghị cho đúng tình huống này; React bỏ luôn kết quả render dở và
  // chạy lại trước khi vẽ, nên không có khung hình nào lệch.
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);

    if (!isOpen) {
      setSnapLevel(2);
    }
  }

  const overlayVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };

  // Desktop: trượt từ phải
  const drawerVariants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : { hidden: { x: '100%' }, visible: { x: 0 }, exit: { x: '100%' } };

  return (
    <DrawerContext.Provider value={{ onClose, isMobile }}>
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 pointer-events-none flex justify-end"
            style={{ zIndex: Z_INDEX.drawer }}
          >
            {/* Overlay */}
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={overlayVariants}
              transition={{ duration: DURATION.default, ease: EASE.out }}
              className="absolute inset-0 bg-bg-overlay pointer-events-auto"
              onClick={onClose}
              aria-hidden="true"
            />

            {!isMobile ? (
              /* Desktop — trượt từ phải */
              <motion.div
                ref={containerRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={drawerVariants}
                transition={{
                  duration: prefersReducedMotion ? DURATION.fast : DURATION.slow,
                  ease: EASE.default,
                }}
                className="relative my-2 mr-2 bg-bg-surface rounded-[16px] shadow-modal pointer-events-auto flex flex-col outline-none overflow-hidden"
                style={{ width: `${drawerWidth}px` }}
              >
                {children}
              </motion.div>
            ) : (
              /* Mobile — bottom-sheet 3 mức snap */
              <BottomSheet
                ref={containerRef}
                snapLevel={snapLevel}
                onSnapChange={setSnapLevel}
                onClose={onClose}
                prefersReducedMotion={!!prefersReducedMotion}
              >
                {children}
              </BottomSheet>
            )}
          </div>
        )}
      </AnimatePresence>
    </DrawerContext.Provider>
  );
}
DrawerRoot.displayName = 'Drawer.Root';

// ─── BottomSheet (internal, mobile only) ─────────────────────────────────────

interface BottomSheetProps {
  children: React.ReactNode;
  snapLevel: SnapLevel;
  onSnapChange: (level: SnapLevel) => void;
  onClose: () => void;
  prefersReducedMotion: boolean;
}

const BottomSheet = forwardRef<HTMLDivElement, BottomSheetProps>(
  ({ children, snapLevel, onSnapChange, onClose, prefersReducedMotion }, ref) => {
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const height = getSnapHeight(snapLevel, windowHeight);

    const sheetVariants = prefersReducedMotion
      ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
      : { hidden: { y: '100%' }, visible: { y: 0 }, exit: { y: '100%' } };

    return (
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={sheetVariants}
        transition={prefersReducedMotion ? { duration: DURATION.fast } : SPRING.sheet}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.15}
        onDragEnd={(_e, { offset, velocity }) => {
          const dy = offset.y;
          const vy = velocity.y;
          if (dy > 100 || vy > 600) {
            // Vuốt xuống → giảm mức hoặc đóng
            if (snapLevel === 0) onClose();
            else onSnapChange((snapLevel - 1) as SnapLevel);
          } else if (dy < -60 || vy < -600) {
            // Vuốt lên → tăng mức
            if (snapLevel < 2) onSnapChange((snapLevel + 1) as SnapLevel);
          }
        }}
        className="absolute bottom-0 left-0 right-0 bg-bg-surface rounded-t-[20px] shadow-modal pointer-events-auto flex flex-col outline-none overflow-hidden"
        style={{ height: `${height}px` }}
      >
        {/* Handle kéo */}
        <div
          className="shrink-0 flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
          aria-hidden="true"
        >
          <div className="w-10 h-1 rounded-full bg-border-default" />
        </div>

        {/* Nút snap nhanh */}
        <div className="flex justify-center gap-2 pb-2" aria-hidden="true">
          {([0, 1, 2] as SnapLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onSnapChange(level)}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors duration-120',
                snapLevel === level ? 'bg-accent' : 'bg-border-default',
              )}
              aria-label={`Mức ${level + 1}`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </motion.div>
    );
  },
);
BottomSheet.displayName = 'BottomSheet';

// ─── Drawer.Handle ────────────────────────────────────────────────────────────

const DrawerHandle = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { isMobile } = useDrawerContext('Drawer.Handle');
    if (!isMobile) return null;
    return (
      <div
        ref={ref}
        className={cn(
          'w-full flex justify-center py-3 shrink-0 cursor-grab active:cursor-grabbing',
          className,
        )}
        aria-hidden="true"
        {...props}
      >
        <div className="w-10 h-1 rounded-full bg-border-default" />
      </div>
    );
  },
);
DrawerHandle.displayName = 'Drawer.Handle';

// ─── Drawer.Header ────────────────────────────────────────────────────────────

const DrawerHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div ref={ref} className={cn('px-8 pt-6 pb-4 shrink-0', className)} {...props}>
      {children}
    </div>
  ),
);
DrawerHeader.displayName = 'Drawer.Header';

// ─── Drawer.Body ──────────────────────────────────────────────────────────────

const DrawerBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div ref={ref} className={cn('flex-1 overflow-y-auto px-8 pb-8', className)} {...props}>
      {children}
    </div>
  ),
);
DrawerBody.displayName = 'Drawer.Body';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Drawer = Object.assign(
  function DrawerLegacy({ isOpen, onClose, children, size }: LegacyDrawerProps) {
    return (
      <DrawerRoot isOpen={isOpen} onClose={onClose} size={size}>
        <DrawerHandle />
        <DrawerBody>{children}</DrawerBody>
      </DrawerRoot>
    );
  },
  {
    Root: DrawerRoot,
    Handle: DrawerHandle,
    Header: DrawerHeader,
    Body: DrawerBody,
  },
);

// ─── Legacy Types ─────────────────────────────────────────────────────────────

export interface LegacyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: number | undefined;
}


export type { LegacyDrawerProps as DrawerProps };
