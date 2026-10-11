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
 * `isConfirmingDiscard` prompt ({@link DiscardPrompt}, floating above the
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

import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { motion } from '@/components/motion';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { durationSeconds } from '@/lib/motion';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { cn } from '@/lib/utils';

import { StepFloors } from './StepFloors';
import { StepReview } from './StepReview';
import {
  FLOORS_HINT_ID,
  PROJECT_LIMITS,
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

/** What each step is about, beside "Bước n / 3" — the indicator is more than a grey number (BUG-122). */
const STEP_TITLES = ['Thông tin công trình', 'Tầng', 'Xem lại'] as const;

/** Re-exported so every existing caller of `CreateProjectModal.tsx` keeps its import path. */
export type { CreateProjectModalViewProps } from './useCreateProjectModal';

/* -------------------------------------------------------------------------- */
/* Step 1 — thông tin công trình.                                             */
/* -------------------------------------------------------------------------- */

function StepInfo(props: CreateProjectModalViewProps) {
  const gridClassName = cn('grid gap-4', props.isCompact ? 'grid-cols-1' : 'grid-cols-2');

  return (
    <div className="flex flex-col gap-4">
      <div className={gridClassName}>
        <Input
          label="Tên dự án"
          value={props.name}
          onChange={(event) => props.setName(event.target.value)}
          maxLength={PROJECT_LIMITS.nameMaxLength}
          error={props.problems.name}
          hint={props.nameHint}
          disabled={props.isSubmitting}
          placeholder="Ví dụ: Chung cư Bình Minh"
          data-autofocus
        />
        <Input
          label="Mã dự án"
          value={props.code}
          onChange={(event) => props.setCode(event.target.value)}
          error={props.problems.code}
          disabled={props.isSubmitting}
          hint="Tự tạo từ tên, sửa được"
        />
      </div>
      <div className={gridClassName}>
        <Input
          label="Địa chỉ"
          value={props.address}
          onChange={(event) => props.setAddress(event.target.value)}
          error={props.problems.address}
          disabled={props.isSubmitting}
        />
        <Select.Root
          value={props.buildingType}
          onChange={props.setBuildingType}
          options={props.buildingTypeOptions}
          isOpen={props.isSelectOpen}
          onOpenChange={props.setSelectOpen}
          disabled={props.isSubmitting}
        >
          <Select.Label>Loại công trình</Select.Label>
          <Select.Trigger options={props.buildingTypeOptions} />
          <Select.Content>
            {props.buildingTypeOptions.map((option, index) => (
              <Select.Item key={option.value} value={option.value} index={index}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>
      <Textarea
        label="Ghi chú"
        value={props.notes}
        onChange={(event) => props.setNotes(event.target.value)}
        disabled={props.isSubmitting}
        placeholder="Không bắt buộc"
      />
    </div>
  );
}

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
 * Floats just above the footer (`bottom-full` of `Modal.Footer`) rather than
 * being inserted into the body, so the fields never jump when it appears; it
 * offers both answers as its own buttons, and its copy does not depend on
 * where a button wraps to (BUG-123). `text-balance` keeps the title from
 * leaving one word alone on its last line at 375 px (BUG-190).
 */
function DiscardPrompt(props: CreateProjectModalViewProps) {
  return (
    <div
      role="alert"
      className="absolute inset-x-4 sm:inset-x-6 bottom-full mb-3 flex flex-col gap-3 rounded-[8px] border border-state-attention bg-state-attention-tint p-3 shadow-modal"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-state-attention" size={18} strokeWidth={2} aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1">
          <h4 className="text-balance text-[14px] font-semibold leading-tight text-state-attention-text">
            Đóng và bỏ các thay đổi chưa lưu?
          </h4>
          <p className="text-pretty text-[14px] leading-relaxed text-state-attention-text">
            Nhấn Esc lần nữa hoặc bấm "Đóng, bỏ thay đổi" để đóng.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={props.keepEditing}>
          Tiếp tục sửa
        </Button>
        <Button type="button" size="sm" variant="danger" onClick={props.confirmDiscard}>
          Đóng, bỏ thay đổi
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The dialog itself.                                                          */
/* -------------------------------------------------------------------------- */

/** The dialog as a function of its props — rendered directly by tests and stories. */
export function CreateProjectModalView(props: CreateProjectModalViewProps) {
  const { isOpen, state, step, isSubmitting, focusFloorId, acknowledgeFocus } = props;
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

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
          <span id={TITLE_ID}>Tạo dự án mới</span>
        </Modal.Header>
        <Modal.Body className="px-6 py-6 min-h-[320px]">
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
      {/* `pb-3` + a body with no top padding: the step indicator sits one 24 px grid step under the title, and `px-6` lines the title up with the fields (BUG-122). */}
      <Modal.Header className="px-4 sm:px-6 pb-3">
        <span id={TITLE_ID}>Tạo dự án mới</span>
      </Modal.Header>
      <Modal.Body className="px-4 sm:px-6 pt-0 pb-6 min-h-[320px]">
        <div className="mb-5 flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <p className="text-[13px] font-semibold leading-[18px] text-text-primary">{props.stepLabel}</p>
            <span className="text-[13px] leading-[18px] text-text-secondary">{STEP_TITLES[step - 1]}</span>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {STEP_TITLES.map((title, index) => (
              <span
                key={title}
                className={cn('h-1 flex-1 rounded-full', index < step ? 'bg-text-primary' : 'bg-border-default')}
              />
            ))}
          </div>
        </div>
        <span className="sr-only" role="status">
          {props.stepLabel}
        </span>

        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: durationSeconds('fast') }}
        >
          {step === 1 && <StepInfo {...props} />}
          {step === 2 && <StepFloors {...props} rowRefs={rowRefs} />}
          {step === 3 && <StepReview {...props} />}
        </motion.div>
      </Modal.Body>
      <Modal.Footer className="relative justify-between px-4 sm:px-6">
        {props.isConfirmingDiscard && <DiscardPrompt {...props} />}
        <div>
          {step > 1 && (
            <Button variant="ghost" onClick={props.goBack} disabled={isSubmitting}>
              Quay lại
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={props.requestClose} disabled={isSubmitting}>
            Huỷ
          </Button>
          {step < 3 ? (
            <Button
              variant="primary"
              onClick={props.goNext}
              disabled={!props.canGoNext || isSubmitting}
              aria-describedby={step === 2 && props.floorsHint !== null ? FLOORS_HINT_ID : undefined}
            >
              Tiếp tục
            </Button>
          ) : (
            <Button variant="primary" loading={isSubmitting} disabled={!props.canSubmit} onClick={props.submit}>
              Tạo dự án
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
