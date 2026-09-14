/**
 * Floating panel anchored to a trigger element — the tenth CL-08 component,
 * and the only one of the ten with a caller already waiting:
 * `CommentThread.tsx` hand-rolled its own "bóng 320" specifically because
 * this file did not exist yet.
 *
 * Unlike `Modal.Root` (covers the whole screen) and `Drawer.Root` (docks to
 * an edge), this floats next to a point. It reuses `createFocusTrap` exactly
 * as they do — Tab cycles inside, Escape closes, focus returns to the
 * opener on release — but it deliberately does **not** also claim the
 * `dialog` shortcut scope the way `Modal.tsx`/`Drawer.tsx` do as a redundant
 * fallback. That scope is modal: while it is active every key the dialog
 * floor does not bind is swallowed, which is correct for a full-screen
 * overlay but would silently disable canvas tools (`W`, …) and global
 * shortcuts (Ctrl+Z, …) anywhere in the app for as long as one small
 * popover happens to be open — exactly the property `CommentThread`'s own
 * ad hoc popover was written to avoid by using the `canvas` scope instead of
 * `dialog`. The focus trap's own container-level listener already answers
 * Escape and stops the event there before it ever reaches the shortcut
 * registry, so no scope claim is needed for A12 to hold.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { motion, AnimatePresence } from '../motion';
import { createFocusTrap } from '../../lib/input/focusTrap';
import { durationSeconds, MOTION_EASINGS } from '../../lib/motion';
import { Z_INDEX } from '../../lib/zIndex';
import { cn } from '../../lib/utils';

type VerticalSide = 'top' | 'bottom';
type HorizontalSide = 'left' | 'right';

interface PopoverBaseProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** The trigger element the panel anchors to, and returns focus to on close. */
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
  /** Panel width in px; default 320. Height is measured, never declared. */
  readonly width?: number;
  readonly className?: string;
}

/** `role="dialog"` needs a name — one of the two, never neither (R-53). */
export type PopoverProps = PopoverBaseProps &
  (
    | { readonly 'aria-label': string; readonly 'aria-labelledby'?: undefined }
    | { readonly 'aria-labelledby': string; readonly 'aria-label'?: undefined }
  );

const DEFAULT_WIDTH_PX = 320;
const ANCHOR_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 8;

interface Placement {
  readonly top: number;
  readonly left: number;
}

/** Flips above/below and left/right only when the preferred side has no room. */
function computePlacement(anchor: DOMRect, width: number, height: number): Placement {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const spaceBelow = viewportHeight - anchor.bottom;
  const spaceAbove = anchor.top;
  const fitsBelow = spaceBelow >= height + ANCHOR_GAP_PX + VIEWPORT_MARGIN_PX;
  const vertical: VerticalSide = fitsBelow || spaceBelow >= spaceAbove ? 'bottom' : 'top';
  const top = vertical === 'bottom' ? anchor.bottom + ANCHOR_GAP_PX : anchor.top - ANCHOR_GAP_PX - height;

  const fitsLeftAligned = anchor.left + width <= viewportWidth - VIEWPORT_MARGIN_PX;
  const horizontal: HorizontalSide = fitsLeftAligned ? 'left' : 'right';
  const rawLeft = horizontal === 'left' ? anchor.left : anchor.right - width;
  const maxLeft = Math.max(viewportWidth - width - VIEWPORT_MARGIN_PX, VIEWPORT_MARGIN_PX);
  const left = Math.min(Math.max(rawLeft, VIEWPORT_MARGIN_PX), maxLeft);

  return { top, left };
}

/* A popover is "something small appearing where you are looking" — the
   `fast` (180ms) slot `src/lib/motion/tokens.ts` names for exactly that. */
const ENTER_TRANSITION = { duration: durationSeconds('fast'), ease: MOTION_EASINGS.enter.points } as const;
const EXIT_TRANSITION = { duration: durationSeconds('fast'), ease: MOTION_EASINGS.exit.points } as const;

export function Popover({
  isOpen,
  onClose,
  anchorRef,
  children,
  width = DEFAULT_WIDTH_PX,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const recomputePlacement = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;

    if (anchor === null || panel === null) {
      return;
    }

    setPlacement(computePlacement(anchor.getBoundingClientRect(), width, panel.getBoundingClientRect().height));
  }, [anchorRef, width]);

  // Measure-then-place: on open the panel first renders hidden (but still
  // laid out, via `visibility: hidden` rather than `display: none`) so its
  // real height under real content can be read before anything is painted
  // where a person can see it. `useLayoutEffect` re-renders with the
  // computed position before the browser paints, so there is no flash.
  useLayoutEffect(() => {
    if (isOpen) {
      recomputePlacement();
    } else {
      setPlacement(null);
    }
  }, [isOpen, recomputePlacement]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    // Capture phase: 'scroll' does not bubble, so this is the one way a
    // window-level listener sees scrolling inside a nested container too.
    window.addEventListener('resize', recomputePlacement);
    window.addEventListener('scroll', recomputePlacement, true);

    return () => {
      window.removeEventListener('resize', recomputePlacement);
      window.removeEventListener('scroll', recomputePlacement, true);
    };
  }, [isOpen, recomputePlacement]);

  // Same trap `Modal.Root`/`Drawer.Root` use — see the file docblock for why
  // this component, unlike them, claims no shortcut-registry scope.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const container = panelRef.current;

    if (container === null) {
      return undefined;
    }

    const trap = createFocusTrap(container, { onEscape: () => onCloseRef.current() });
    const raf = requestAnimationFrame(() => trap.activate());

    return () => {
      cancelAnimationFrame(raf);
      trap.release();
    };
  }, [isOpen]);

  // Bấm ra ngoài thì đóng — bấm lại chính phần tử kích hoạt thì để nơi gọi
  // (thường là một `onClick` bật/tắt) tự quyết, không đóng hộ ở đây.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      const panel = panelRef.current;
      const anchor = anchorRef.current;

      if (panel?.contains(target) === true || anchor?.contains(target) === true) {
        return;
      }

      onCloseRef.current();
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, anchorRef]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          tabIndex={-1}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0, transition: ENTER_TRANSITION }}
          exit={{ opacity: 0, transition: EXIT_TRANSITION }}
          className={cn(
            'flex flex-col gap-3 rounded-[12px] bg-bg-surface p-3 shadow-float outline-none',
            className,
          )}
          style={
            placement === null
              ? { position: 'fixed', top: 0, left: 0, width, visibility: 'hidden', pointerEvents: 'none' }
              : { position: 'fixed', top: placement.top, left: placement.left, width, zIndex: Z_INDEX.dropdown }
          }
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
