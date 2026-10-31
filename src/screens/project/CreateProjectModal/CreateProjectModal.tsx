/**
 * The three-step "tạo dự án mới" dialog: thông tin công trình, tầng, xem lại.
 *
 * Invariant D's split: every prop below arrives already computed by
 * {@link useCreateProjectModal} — no store, no network, no `formatNumber` call
 * in this file, which is what `local/no-raw-number` would catch if one crept
 * in. {@link CreateProjectModalView} is the pure half, rendered directly by
 * tests and stories; {@link CreateProjectModal} at the bottom wires the hook.
 *
 * ## The compact width is a known limitation, not an oversight
 *
 * `Modal.Root` only accepts `width={480 | 560 | 720}` and takes no
 * `className`, so a literal full-bleed layout below 1024px is unreachable
 * without editing `src/components/overlay/Modal.tsx` — out of scope here.
 * `width` is pinned at {@link MODAL_WIDTH}; `isCompact` instead drives the
 * one thing it safely can, a single-column reflow of the step 1 field grid,
 * and nothing else. The day `Modal` accepts a width override, `MODAL_WIDTH`
 * becomes the one line that needs to change.
 *
 * ## Esc, twice
 *
 * `Modal.Root` reaches `onClose` two ways — a focus-trap Escape handler and a
 * `scope: 'dialog'` shortcut — and both are wired to `props.requestClose`,
 * never to `onDismiss` directly. A first Esc on a dirty form only shows the
 * `isConfirmingDiscard` prompt ({@link DiscardPrompt}, a row of the
 * footer — never a nested dialog); a second Esc, or that prompt's own button, both
 * call `requestClose`/`confirmDiscard` again and this time it closes. See
 * `useCreateProjectModal.ts`'s doc comment for why an open `Select` dropdown
 * defends itself first.
 *
 * ## Scroll-to-row
 *
 * No shared helper exists for this (only two inline `scrollIntoView` call
 * sites in the whole codebase), so this file keeps its own
 * `Map<string, HTMLTableRowElement>` and, in an effect keyed on
 * `focusFloorId`, scrolls and focuses the row a collision names, then tells
 * the hook it has been seen via `acknowledgeFocus()`. DOM work, not
 * computation — legal in a view (mục D).
 */

import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { motion } from '@/components/motion';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { durationSeconds } from '@/lib/motion';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import { deriveCreateProjectGate, FIELD_IDS } from './createProjectGate';
import { StepFloors } from './StepFloors';
import { StepInfo } from './StepInfo';
import { StepReview } from './StepReview';
import { WizardStatus } from './WizardStatus';
import {
  FLOORS_HINT_ID,
  useCreateProjectModal,
  type CreateProjectModalViewProps,
  type UseCreateProjectModalOptions,
} from './useCreateProjectModal';

/** See the file doc comment: the width `Modal.Root` is pinned at until it takes an override. */
const MODAL_WIDTH = 560;

/**
 * The Vietnamese name announced for each of the seven states, on the sr-only
 * `role="status"` span below.
 *
 * Deliberately its own copy rather than an import of `SEVEN_STATE_LABELS` from
 * `@/lib/testing/sevenStateScenarios`: that module is test infrastructure —
 * excluded from the coverage build and never meant to ship — and this file is
 * product code that a screen reader user actually hears.
 */
const STATE_ANNOUNCEMENT: Readonly<Record<SevenState, string>> = {
  empty: 'rỗng',
  loading: 'đang tải',
  partial: 'một phần',
  error: 'lỗi',
  success: 'thành công',
  forbidden: 'Không có quyền',
  collapsed: 'thu gọn',
};

const TITLE_ID = 'create-project-modal-title';

/** Re-exported so every existing caller of `CreateProjectModal.tsx` keeps its import path. */
export type { CreateProjectModalViewProps } from './useCreateProjectModal';

/* -------------------------------------------------------------------------- */
/* Step 2 — tầng. Split into `StepFloors.tsx` once this file crossed R-22's    */
/* 400-line ceiling (mục D).                                                   */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Step 3 — xem lại. Split into `StepReview.tsx` when this file neared R-22's  */
/* 400-line ceiling again (mục D).                                             */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* The discard prompt.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A full-width first row of `Modal.Footer`, in the flow rather than floating
 * over the body: floating, it covered "Ghi chú" (and "Loại công trình" at
 * 375 px, BUG-204). In the footer the fields still never move down (BUG-123) —
 * the body gives up the height and scrolls, or the centred dialog grows. It
 * offers both answers as its own buttons, and its copy does not depend on
 * where a button wraps to (BUG-123). `text-balance` keeps the title from
 * leaving one word alone on its last line at 375 px (BUG-190).
 */
function DiscardPrompt(props: CreateProjectModalViewProps & { readonly cancelRef: React.RefObject<HTMLButtonElement | null> }) {
  // Where the focus was when the prompt appeared: the field being edited, or "Huỷ". "Tiếp tục sửa"
  // goes away with the prompt, so it hands the focus back there instead of to nowhere (BUG-219).
  const [returnFocus] = useState(() => document.activeElement);
  const keepEditing = (): void => {
    const target =
      returnFocus instanceof HTMLElement && returnFocus.isConnected && returnFocus.matches('input, textarea, button')
        ? returnFocus
        : props.cancelRef.current;
    target?.focus();
    props.keepEditing();
  };

  return (
    <div
      role="alert"
      className="flex basis-full flex-col gap-3 rounded-lg border border-state-attention bg-state-attention-tint p-3"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-state-attention" size={18} strokeWidth={2} aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1">
          <h4 className="text-balance text-[14px] font-semibold leading-tight text-state-attention-text">
            Đóng và bỏ các thay đổi chưa lưu?
          </h4>
          <p className="text-pretty text-[14px] leading-relaxed text-state-attention-text">
            Bấm "Đóng, bỏ thay đổi" để đóng, hoặc "Tiếp tục sửa" để quay lại.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={keepEditing}>
          Tiếp tục sửa
        </Button>
        <Button type="button" size="sm" variant="danger" onClick={props.confirmDiscard}>
          Đóng, bỏ thay đổi
        </Button>
      </div>
    </div>
  );
}

/**
 * The body's bottom 24 px, kept in view: over content still below the fold it
 * fades that content out, a sign there is more to scroll to — the overlay
 * scrollbars stay hidden until a scroll, and at 1024×768 "Thêm tầng" sat cut
 * under the footer with no hint (BUG-201). Scrolled to the end, or with
 * nothing to scroll, it lies over the empty space it takes the place of the
 * body's old `pb-6` with, and shows nothing.
 */
function ScrollFade() {
  return (
    <div
      aria-hidden="true"
      data-scroll-fade=""
      className="pointer-events-none sticky bottom-0 h-6"
      style={{ background: 'linear-gradient(to top, var(--bg-surface), transparent)' }}
    />
  );
}

/** Where the dialog was opened from, above the title. Hidden from the dialog's name, which stays "Tạo dự án mới". */
function Eyebrow() {
  return (
    <span aria-hidden="true" className="mb-1 block text-[12px] font-medium uppercase leading-4 tracking-wide text-text-secondary">
      Dự án của tôi
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* The dialog itself.                                                          */
/* -------------------------------------------------------------------------- */

/** The dialog as a function of its props — rendered directly by tests and stories. */
export function CreateProjectModalView(props: CreateProjectModalViewProps) {
  const { isOpen, state, step, isSubmitting, focusFloorId, acknowledgeFocus } = props;
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isMoreOpen, setMoreOpen] = useState(false);
  const gate = deriveCreateProjectGate(props);
  // U26: Enter ở bước Tầng chốt số trong ô rồi mới biết đã đủ chưa — đếm lần bấm, xét cổng ở lượt vẽ sau.
  const [floorsEnterCount, setFloorsEnterCount] = useState(0);
  useEffect(() => {
    if (floorsEnterCount > 0 && step === 2 && gate.ready) props.goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ theo lần bấm Enter: sửa số sau đó không tự sang bước.
  }, [floorsEnterCount]);

  /** The not-ready button: focus the field or row that is missing, or open the step that holds it. */
  const leadToFix = (): void => {
    const focusField = (id: string): void => document.getElementById(id)?.focus();
    switch (gate.fix) {
      case 'name':
        props.touchName();
        focusField(FIELD_IDS.name);
        break;
      case 'code':
        focusField(FIELD_IDS.code);
        break;
      case 'address':
        flushSync(() => setMoreOpen(true));
        focusField(FIELD_IDS.address);
        break;
      case 'floors': {
        const first = props.floorRows.find((row) => row.clearHeightM === null || row.problem !== null || row.nameProblem !== null);
        props.focusFloor(props.collisionRowId ?? first?.id ?? '');
        break;
      }
      case 'addFloor':
        props.addFloor();
        break;
      case 'notice':
        props.goToFixStep();
        break;
      default:
        props.goBack();
    }
  };

  useEffect(() => {
    if (focusFloorId === null) {
      return;
    }
    const row = rowRefs.current.get(focusFloorId);
    row?.scrollIntoView({ block: 'nearest' });
    row?.focus();
    acknowledgeFocus();
  }, [focusFloorId, acknowledgeFocus]);

  if (state === 'forbidden') {
    return (
      <Modal.Root isOpen={isOpen} onClose={props.requestClose} width={MODAL_WIDTH} titleId={TITLE_ID}>
        <Modal.Header>
          <Eyebrow />
          <span id={TITLE_ID}>Tạo dự án mới</span>
        </Modal.Header>
        <Modal.Body className="px-6 py-6 min-h-80">
          <InlineAlert
            level="attention"
            title="Không có quyền tạo dự án"
            message="Vai trò hiện tại chỉ được xem, không thể tạo dự án mới. Liên hệ quản trị dự án nếu cần."
          />
        </Modal.Body>
        <Modal.Footer className="justify-between">
          <div />
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={props.requestClose}>
              Đóng
            </Button>
          </div>
        </Modal.Footer>
        <span className="sr-only" role="status">
          {STATE_ANNOUNCEMENT[state]}
        </span>
      </Modal.Root>
    );
  }

  return (
    <Modal.Root isOpen={isOpen} onClose={props.requestClose} width={MODAL_WIDTH} titleId={TITLE_ID}>
      {/* X is locked with the footer while "Tạo dự án" runs: requestClose ignores it then (BUG-184, BUG-218). */}
      <Modal.Header className="px-4 sm:px-6 pb-3" closeDisabled={isSubmitting}>
        <Eyebrow />
        <span id={TITLE_ID}>Tạo dự án mới</span>
      </Modal.Header>
      {/* scroll-pt-10: the floor table's sticky 40 px header covered the field Shift+Tab or a 422 scrolled to
          (WCAG 2.4.11); scroll-pb-6 keeps it off the bottom fade too. */}
      <Modal.Body className="px-4 sm:px-6 pt-0 min-h-80 scroll-pt-10 scroll-pb-6">
        <WizardStatus gate={gate} step={step} />
        <span className="sr-only" role="status">
          {props.stepLabel}
        </span>

        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: durationSeconds('fast') }}
          // Enter trong ô nhập một dòng ở bước 1 và 2 thì đi tiếp, như bấm nút chân hộp.
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return;
            if (step === 1 && gate.ready) {
              event.preventDefault();
              props.goNext();
            } else if (step === 2 && event.target.type !== 'checkbox' && event.target.type !== 'radio') {
              event.preventDefault();
              setFloorsEnterCount((count) => count + 1);
            }
          }}
        >
          {step === 1 && <StepInfo {...props} isMoreOpen={isMoreOpen} toggleMore={() => setMoreOpen((open) => !open)} />}
          {step === 2 && <StepFloors {...props} rowRefs={rowRefs} />}
          {step === 3 && <StepReview {...props} gate={gate} />}
        </motion.div>
        <ScrollFade />
      </Modal.Body>
      <Modal.Footer className="justify-between px-4 sm:px-6">
        {props.isConfirmingDiscard && <DiscardPrompt {...props} cancelRef={cancelRef} />}
        <div>
          {step > 1 && (
            <Button variant="ghost" onClick={props.goBack} disabled={isSubmitting}>
              Quay lại
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button ref={cancelRef} variant="ghost" onClick={props.requestClose} disabled={isSubmitting}>
            Huỷ
          </Button>
          {/* One button: the next step when ready, else the first missing task, which it leads to (no dead "Tiếp tục"). */}
          {gate.ready ? (
            <Button
              variant="primary"
              loading={step === 3 && isSubmitting}
              disabled={isSubmitting}
              onClick={step === 3 ? props.submit : props.goNext}
              iconAfter={step < 3 ? <ArrowRight size={16} aria-hidden="true" /> : undefined}
            >
              {gate.buttonLabel}
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={leadToFix}
              disabled={isSubmitting}
              aria-describedby={step === 2 && props.floorsHint !== null ? FLOORS_HINT_ID : undefined}
            >
              {gate.buttonLabel}
            </Button>
          )}
        </div>
      </Modal.Footer>
      <span className="sr-only" role="status">
        {STATE_ANNOUNCEMENT[state]}
      </span>
    </Modal.Root>
  );
}

export interface CreateProjectModalProps extends UseCreateProjectModalOptions {
  readonly isOpen: boolean;
}

/**
 * The dialog, wired to its hook — and a fresh form on every opening.
 *
 * Both callers keep this mounted and only flip `isOpen`, so the hook's state
 * outlived each close: reopening after "tạo dự án" landed on step 3 with the
 * project just made (one click from a duplicate), and "đóng, bỏ thay đổi"
 * discarded nothing (B-V3-02). A new `key` per opening resets every field in
 * one place; the close itself keeps the old key, so its exit animation plays.
 */
export function CreateProjectModal({ isOpen, ...options }: CreateProjectModalProps) {
  const [openingCount, setOpeningCount] = useState(0);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setOpeningCount((count) => count + 1);
  }

  return <WiredCreateProjectModal key={openingCount} isOpen={isOpen} {...options} />;
}

function WiredCreateProjectModal({ isOpen, ...options }: CreateProjectModalProps) {
  const { model, actions } = useCreateProjectModal(options);

  return <CreateProjectModalView isOpen={isOpen} {...model} {...actions} />;
}
