import React, { createContext, Fragment, useContext, useEffect, useId, useRef, forwardRef, useState } from 'react';
import { motion, AnimatePresence } from '../motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '../../lib/utils';
import { Z_INDEX } from '../../lib/zIndex';
import { DURATION, EASE, SPRING } from '../../lib/motion';
import { useShortcut } from '../../hooks/useShortcut';
import { createFocusTrap, getFocusableElements, type FocusTrapHandle } from '../../lib/input/focusTrap';
import { Tooltip } from '../ui/Tooltip';

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

/** What each snap dot does, said on hover/focus (Tooltip) and to screen readers (nợ C ND-C2). */
const SNAP_HINTS: Record<SnapLevel, string> = { 0: 'Thu gọn', 1: 'Nửa màn hình', 2: 'Gần toàn màn hình' };

/**
 * Mỗi mức vẽ thành một vạch cao dần (4/8/12 px), không phải ba chấm bằng nhau: ba chấm đều đọc ra là
 * phân trang của carousel, vạch cao dần đọc ra là "chiều cao tấm" (BUG-125).
 */
const SNAP_BAR_HEIGHT: Record<SnapLevel, string> = { 0: 'h-1', 1: 'h-2', 2: 'h-3' };

function getSnapHeight(level: SnapLevel, windowHeight: number): number {
  if (level === 0) return 88;
  if (level === 1) return Math.round(windowHeight * 0.4);
  return Math.round(windowHeight * 0.9);
}

/**
 * Chỗ nhận focus lúc tấm mở (BUG-205, BUG-125).
 *
 * - Nơi gọi đánh dấu `data-autofocus` trong nội dung → phần tử đó, dù ai mở.
 * - Không ai mở nó (tải thẳng `/thong-bao`: focus đang ở `body`) → chính hộp thoại. Không nút nào tự sáng
 *   vòng focus hay bật tooltip khi người dùng chưa làm gì; Tab đầu tiên vào nút đầu tiên (focusTrap).
 * - Có người mở → nút đầu tiên của NỘI DUNG, không phải chấm snap của tờ dưới 1024 px: một Enter lạc
 *   trên "Mức 1" là tờ sập còn 88 px.
 */
function openingFocusOf(container: HTMLElement): HTMLElement {
  const content = container.querySelector<HTMLElement>('[data-drawer-content]') ?? container;
  const focusable = getFocusableElements(content);
  const marked = focusable.find((element) => element.hasAttribute('data-autofocus'));
  if (marked !== undefined) return marked;

  const active = container.ownerDocument.activeElement;
  if (active === null || active === container.ownerDocument.body) return container;

  return focusable[0] ?? container;
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

/** Desktop panel width when the caller gives no `size`, and the `my-2 mr-2` gap around it. */
export const DRAWER_WIDTH_PX = 400;
export const DRAWER_GAP_PX = 8;

export interface DrawerRootProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Chiều rộng drawer desktop */
  size?: number | undefined;
  /**
   * Tên truy cập của `role="dialog"`. Không có nó, trình đọc màn hình chỉ đọc
   * "hộp thoại" không tên và không ai gọi được nó bằng tên (B-V2-03).
   */
  label?: string | undefined;
}

function DrawerRoot({ isOpen, onClose, children, size, label }: DrawerRootProps) {
  const drawerWidth = size ?? DRAWER_WIDTH_PX;

  const prefersReducedMotion = useReducedMotion();
  const isMobile = useMediaQuery('(width < 1024px)');
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

    let trap: FocusTrapHandle | undefined;
    const raf = requestAnimationFrame(() => {
      trap = createFocusTrap(container, { onEscape: onClose, initialFocus: openingFocusOf(container) });
      trap.activate();
    });

    return () => {
      cancelAnimationFrame(raf);
      trap?.release();
    };
  }, [isOpen, onClose, isMobile]);

  // Ngăn/tờ là modal: trang nền không cuộn, và không còn thanh cuộn của nó đứng cạnh ngăn hay đè lên tờ
  // (BUG-235). Trả lại giá trị cũ, không xoá, để một lớp modal khác đang khoá vẫn giữ khoá của nó.
  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [isOpen]);

  // Toast toàn ứng dụng (`NotificationHost`) neo góc dưới-phải — đúng chỗ chân ngăn bên ("Xem tất cả") và chân
  // tờ dưới 1024 px. Toast vẽ trên ngăn nên che nút ấy suốt 8 giây; ngăn nói ra nó đang chiếm phía nào để toast
  // đứng cạnh, không đè lên nút của chính nó (BUG-227).
  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    root.dataset.drawer = isMobile ? 'sheet' : 'side';
    root.style.setProperty('--drawer-inset', `${String(drawerWidth + DRAWER_GAP_PX)}px`);
    return () => {
      delete root.dataset.drawer;
      root.style.removeProperty('--drawer-inset');
    };
  }, [isOpen, isMobile, drawerWidth]);

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
                aria-label={label}
                tabIndex={-1}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={drawerVariants}
                transition={{
                  duration: prefersReducedMotion ? DURATION.fast : DURATION.slow,
                  ease: EASE.default,
                }}
                className="relative my-2 mr-2 bg-bg-surface rounded-2xl shadow-modal pointer-events-auto flex flex-col outline-none overflow-hidden"
                style={{ width: `${drawerWidth}px` }}
              >
                {children}
              </motion.div>
            ) : (
              /* Mobile — bottom-sheet 3 mức snap */
              <BottomSheet
                ref={containerRef}
                label={label}
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
  label: string | undefined;
  snapLevel: SnapLevel;
  onSnapChange: (level: SnapLevel) => void;
  onClose: () => void;
  prefersReducedMotion: boolean;
}

const BottomSheet = forwardRef<HTMLDivElement, BottomSheetProps>(
  ({ children, label, snapLevel, onSnapChange, onClose, prefersReducedMotion }, ref) => {
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const height = getSnapHeight(snapLevel, windowHeight);
    const hintId = useId();

    const sheetVariants = prefersReducedMotion
      ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
      : { hidden: { y: '100%' }, visible: { y: 0 }, exit: { y: '100%' } };

    return (
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
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

        {/* Nút snap nhanh — đường bàn phím DUY NHẤT để đổi mức (A12), nên không
            aria-hidden và không tabIndex=-1 (B-V1-46). Vùng bấm 24 px, vạch 6 px
            rộng vẽ bên trong. Mỗi chấm nói việc của nó: tooltip khi trỏ/focus, mô tả cho
            trình đọc màn hình — tên vẫn là "Mức N" (nợ C ND-C2). */}
        <div className="flex justify-center gap-1 pb-1" role="group" aria-label="Chiều cao tấm trượt">
          {/* The hint sits beside its dot, not inside: inside, the dot read as a TEXT button held to 44 px below 640 px
              rather than the 24 px icon-only target it is (BUG-236). */}
          {([0, 1, 2] as SnapLevel[]).map((level) => (
            <Fragment key={level}>
              <Tooltip label={SNAP_HINTS[level]}>
                <button
                  type="button"
                  onClick={() => onSnapChange(level)}
                  className="flex h-6 w-6 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`Mức ${level + 1}`}
                  aria-describedby={`${hintId}-${String(level)}`}
                  aria-pressed={snapLevel === level}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'w-1.5 rounded-full transition-colors duration-120',
                      SNAP_BAR_HEIGHT[level],
                      snapLevel === level ? 'bg-accent' : 'bg-border-default',
                    )}
                  />
                </button>
              </Tooltip>
              <span id={`${hintId}-${String(level)}`} className="sr-only">
                {SNAP_HINTS[level]}
              </span>
            </Fragment>
          ))}
        </div>

        <div data-drawer-content className="flex-1 overflow-y-auto">
          {children}
        </div>
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
