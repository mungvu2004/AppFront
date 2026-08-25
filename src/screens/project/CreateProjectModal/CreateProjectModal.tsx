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
 * `isConfirmingDiscard` alert below, as the *first child* of `Modal.Body`
 * (never a nested dialog); a second Esc, or that alert's own button, both
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

import { useEffect, useRef } from 'react';
import { Building2, Plus, Trash2 } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { motion } from '@/components/motion';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { FieldRow } from '@/components/ui/FieldRow';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { NumericField } from '@/components/ui/NumericField';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';
import { Toggle } from '@/components/ui/Toggle';
import { durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import {
  CREATE_PROJECT_LIMITS,
  useCreateProjectModal,
  type CreateProjectActions,
  type CreateProjectModel,
  type UseCreateProjectModalOptions,
} from './useCreateProjectModal';

/** See the file doc comment: the width `Modal.Root` is pinned at until it takes an override. */
const MODAL_WIDTH = 560;

const TITLE_ID = 'create-project-modal-title';

export interface CreateProjectModalViewProps extends CreateProjectModel, CreateProjectActions {
  readonly isOpen: boolean;
}

/* -------------------------------------------------------------------------- */
/* Step 1 — thông tin công trình.                                             */
/* -------------------------------------------------------------------------- */

function StepInfo(props: CreateProjectModalViewProps) {
  const gridClassName = cn('grid gap-4', props.isCompact ? 'grid-cols-1' : 'grid-cols-2');

  return (
    <div className="flex flex-col gap-4">
      <div className={gridClassName}>
        <Input
          label="tên dự án"
          value={props.name}
          onChange={(event) => props.setName(event.target.value)}
          maxLength={CREATE_PROJECT_LIMITS.nameMaxLength}
          error={props.problems.name}
          disabled={props.isSubmitting}
          placeholder="ví dụ: Chung cư Sunrise Block B"
        />
        <Input
          label="mã dự án"
          value={props.code}
          onChange={(event) => props.setCode(event.target.value)}
          disabled={props.isSubmitting}
          hint="tự tạo từ tên, sửa được"
        />
      </div>
      <div className={gridClassName}>
        <Input
          label="địa chỉ"
          value={props.address}
          onChange={(event) => props.setAddress(event.target.value)}
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
          <Select.Label>loại công trình</Select.Label>
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
        label="ghi chú"
        value={props.notes}
        onChange={(event) => props.setNotes(event.target.value)}
        disabled={props.isSubmitting}
        placeholder="không bắt buộc"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 — tầng.                                                              */
/* -------------------------------------------------------------------------- */

interface StepFloorsProps extends CreateProjectModalViewProps {
  readonly rowRefs: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
}

function StepFloors(props: StepFloorsProps) {
  const { floorRows, isSubmitting, rowRefs } = props;
  const collisionRowId = props.collisionRowId;

  return (
    <div className="flex flex-col gap-4">
      <Toggle
        checked={props.hasBasement}
        onChange={props.setHasBasement}
        disabled={isSubmitting}
        label="có tầng hầm"
        description="Tầng hầm luôn nằm dưới tầng trệt; cao độ của nó là số âm."
      />

      {props.collision !== null && (
        <InlineAlert
          level="violation"
          message={props.collision}
          {...(collisionRowId !== null
            ? {
                action: {
                  label: 'xem tầng',
                  onClick: () => props.focusFloor(collisionRowId),
                  variant: 'secondary' as const,
                },
              }
            : {})}
        />
      )}

      {floorRows.length === 0 ? (
        <EmptyState
          icon={<Building2 aria-hidden="true" />}
          title="chưa có tầng nào"
          description="Thêm ít nhất một tầng để sang bước xem lại."
          action={{ label: 'thêm tầng', onClick: props.addFloor }}
        />
      ) : (
        <>
          <Table.Root>
            <Table.Header>
              <tr>
                <Table.Head>tầng</Table.Head>
                <Table.Head>chiều cao thông thuỷ</Table.Head>
                <Table.Head>cao độ</Table.Head>
                <Table.Head aria-label="xoá tầng" />
              </tr>
            </Table.Header>
            <Table.Body>
              {floorRows.map((row) => (
                <Table.Row
                  key={row.id}
                  ref={(node) => {
                    if (node) rowRefs.current.set(row.id, node);
                    else rowRefs.current.delete(row.id);
                  }}
                  isAttention={row.problem !== null}
                >
                  <Table.Cell>
                    <Input
                      value={row.name}
                      onChange={(event) => props.setFloorName(row.id, event.target.value)}
                      disabled={isSubmitting}
                      aria-label={`tên tầng ${row.name}`}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <NumericField
                      value={row.clearHeightM ?? undefined}
                      onChange={(value) => props.setFloorHeight(row.id, value)}
                      min={CREATE_PROJECT_LIMITS.storeyHeightMinM}
                      max={CREATE_PROJECT_LIMITS.storeyHeightMaxM}
                      unit="m"
                      disabled={isSubmitting}
                      aria-label={`chiều cao thông thuỷ tầng ${row.name}`}
                      {...(row.problem !== null ? { error: row.problem } : {})}
                    />
                  </Table.Cell>
                  <Table.Cell className="text-text-secondary">{row.elevationLabel ?? '—'}</Table.Cell>
                  <Table.Cell>
                    <IconButton
                      icon={<Trash2 size={16} aria-hidden="true" />}
                      aria-label={`xoá ${row.name}`}
                      onClick={() => props.removeFloor(row.id)}
                      disabled={isSubmitting}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          <div>
            <Button
              variant="secondary"
              size="sm"
              iconBefore={<Plus size={16} aria-hidden="true" />}
              onClick={props.addFloor}
              disabled={isSubmitting || !props.canAddFloor}
            >
              thêm tầng
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 3 — xem lại.                                                           */
/* -------------------------------------------------------------------------- */

function StepReview(props: CreateProjectModalViewProps) {
  const buildingTypeLabel =
    props.buildingTypeOptions.find((option) => option.value === props.buildingType)?.label ?? props.buildingType;

  return (
    <div className="flex flex-col">
      {props.notice !== null && (
        <div className="mb-4">
          <InlineAlert level={props.notice.level} message={props.notice.message} />
        </div>
      )}
      <FieldRow label="tên dự án">{props.name}</FieldRow>
      <FieldRow label="mã dự án">{props.code === '' ? '—' : props.code}</FieldRow>
      <FieldRow label="địa chỉ">{props.address === '' ? '—' : props.address}</FieldRow>
      <FieldRow label="loại công trình">{buildingTypeLabel}</FieldRow>
      <FieldRow label="ghi chú">{props.notes === '' ? '—' : props.notes}</FieldRow>
      <FieldRow label="số tầng" isLast>
        {props.floorRows.length}
      </FieldRow>

      <div className="mt-4 flex flex-col gap-1 rounded-lg border border-border-default p-3">
        {props.floorRows.map((row) => (
          <div key={row.id} className="flex items-center justify-between text-[13px]">
            <span className="text-text-primary">{row.name}</span>
            <span className="font-mono text-text-secondary">{row.elevationLabel ?? '—'}</span>
          </div>
        ))}
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
          <span id={TITLE_ID}>tạo dự án mới</span>
        </Modal.Header>
        <Modal.Body className="px-6 py-6 min-h-[320px]">
          <InlineAlert
            level="attention"
            title="không có quyền tạo dự án"
            message="Vai trò hiện tại chỉ được xem, không thể tạo dự án mới. Liên hệ quản trị dự án nếu cần."
          />
        </Modal.Body>
        <Modal.Footer className="justify-between">
          <div />
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={props.requestClose}>
              đóng
            </Button>
          </div>
        </Modal.Footer>
        <span className="sr-only" role="status">
          {state}
        </span>
      </Modal.Root>
    );
  }

  return (
    <Modal.Root isOpen={isOpen} onClose={props.requestClose} width={MODAL_WIDTH} titleId={TITLE_ID}>
      <Modal.Header>
        <span id={TITLE_ID}>tạo dự án mới</span>
      </Modal.Header>
      <Modal.Body className="px-6 py-6 min-h-[320px]">
        {props.isConfirmingDiscard && (
          <div className="mb-4">
            <InlineAlert
              level="attention"
              title="đóng và bỏ các thay đổi chưa lưu?"
              message="Nhấn Esc lần nữa, hoặc bấm nút bên cạnh, để xác nhận đóng."
              action={{ label: 'đóng, bỏ thay đổi', onClick: props.confirmDiscard, variant: 'danger' }}
            />
          </div>
        )}

        <p className="mb-4 text-[13px] text-text-secondary">{props.stepLabel}</p>
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
      <Modal.Footer className="justify-between">
        <div>
          {step > 1 && (
            <Button variant="ghost" onClick={props.goBack} disabled={isSubmitting}>
              quay lại
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={props.requestClose} disabled={isSubmitting}>
            huỷ
          </Button>
          {step < 3 ? (
            <Button variant="primary" onClick={props.goNext} disabled={!props.canGoNext || isSubmitting}>
              tiếp tục
            </Button>
          ) : (
            <Button variant="primary" loading={isSubmitting} disabled={!props.canSubmit} onClick={props.submit}>
              tạo dự án
            </Button>
          )}
        </div>
      </Modal.Footer>
      <span className="sr-only" role="status">
        {state}
      </span>
    </Modal.Root>
  );
}

export interface CreateProjectModalProps extends UseCreateProjectModalOptions {
  readonly isOpen: boolean;
}

/** The dialog, wired to its hook. */
export function CreateProjectModal({ isOpen, ...options }: CreateProjectModalProps) {
  const { model, actions } = useCreateProjectModal(options);

  return <CreateProjectModalView isOpen={isOpen} {...model} {...actions} />;
}
