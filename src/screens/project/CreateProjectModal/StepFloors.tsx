/**
 * Step 2 of the "tạo dự án mới" wizard — tầng.
 *
 * Split out of `CreateProjectModal.tsx` once that file crossed R-22's 400-line
 * ceiling (mục D); `index.ts` keeps every caller's import path unchanged.
 * Still a pure view: every value below arrives already computed on
 * {@link CreateProjectModalViewProps}, nothing here calls `formatNumber` or a
 * domain conversion itself (invariant A15).
 */

import { Building2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { NumericField } from '@/components/ui/NumericField';
import { Table } from '@/components/ui/Table';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/lib/utils';

import {
  FLOOR_CAP_NOTE_ID,
  FLOORS_HINT_ID,
  PROJECT_LIMITS,
  type CreateProjectModalViewProps,
} from './useCreateProjectModal';

/** Cell padding: tighter below `sm`, where the dialog is the viewport minus its gutter. */
const CELL_PAD = 'px-1.5 sm:px-3';

export interface StepFloorsProps extends CreateProjectModalViewProps {
  readonly rowRefs: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
}

export function StepFloors(props: StepFloorsProps) {
  const { floorRows, isSubmitting, rowRefs } = props;
  const collisionRowId = props.collisionRowId;
  // Bumped by every "Áp cho mọi tầng": the row fields drop a refused text even when the applied height equals
  // the one a row already held (no value change for the field to see). `resetKey`, not `key`: no remount.
  const [applyCount, setApplyCount] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <Toggle
        checked={props.hasBasement}
        onChange={props.setHasBasement}
        disabled={isSubmitting || !props.canToggleBasement}
        aria-describedby={!props.canToggleBasement && props.floorCapNote !== null ? FLOOR_CAP_NOTE_ID : undefined}
        label="Có tầng hầm"
        description="Tầng hầm luôn nằm dưới tầng trệt; cao độ của nó là số âm."
      />

      {props.floorsHint !== null && (
        <p id={FLOORS_HINT_ID} className="text-[13px] leading-[18px] text-text-secondary">
          {props.floorsHint}
        </p>
      )}

      {props.collision !== null && (
        <InlineAlert
          level="violation"
          message={props.collision}
          {...(collisionRowId !== null
            ? {
                action: {
                  label: 'Xem tầng',
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
          title="Chưa có tầng nào"
          description="Thêm ít nhất một tầng để sang bước xem lại."
          action={{ label: 'Thêm tầng', onClick: props.addFloor }}
        />
      ) : (
        <>
          {/* Fits the dialog at every width, 375 px included (BUG-110): the two fields
              take `w-full` so they shrink with their column instead of forcing the
              table wider than the dialog, the long header may wrap, and cells pad
              tighter below `sm`. Not a scroll box of its own (`overflow-visible`): the dialog
              body scrolls, so the sticky column headers stay on top of a long list (BUG-202). */}
          <Table.Root className="h-auto overflow-visible">
            <Table.Header>
              <tr>
                <Table.Head className={CELL_PAD}>Tầng</Table.Head>
                <Table.Head className={cn(CELL_PAD, 'w-1/3 whitespace-normal')}>Chiều cao thông thuỷ</Table.Head>
                <Table.Head className={CELL_PAD}>Cao độ</Table.Head>
                <Table.Head className={CELL_PAD} aria-label="Xoá tầng" />
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
                  isAttention={row.problem !== null || row.nameProblem !== null}
                >
                  <Table.Cell className={CELL_PAD}>
                    <Input
                      className="w-full"
                      value={row.name}
                      onChange={(event) => props.setFloorName(row.id, event.target.value)}
                      error={row.nameProblem}
                      disabled={isSubmitting}
                      aria-label={`Tên tầng ${row.name}`}
                    />
                  </Table.Cell>
                  <Table.Cell className={CELL_PAD}>
                    <NumericField
                      resetKey={applyCount}
                      className="w-full"
                      value={row.clearHeightM ?? undefined}
                      onChange={(value) => props.setFloorHeight(row.id, value)}
                      min={PROJECT_LIMITS.storeyHeightMinM}
                      max={PROJECT_LIMITS.storeyHeightMaxM}
                      unit="m"
                      disabled={isSubmitting}
                      aria-label={`Chiều cao thông thuỷ tầng ${row.name}`}
                      {...(row.problem !== null ? { error: row.problem } : {})}
                    />
                  </Table.Cell>
                  <Table.Cell className={cn(CELL_PAD, 'text-text-secondary')}>{row.elevationLabel ?? '—'}</Table.Cell>
                  <Table.Cell className={CELL_PAD}>
                    <IconButton
                      icon={<Trash2 size={16} aria-hidden="true" />}
                      aria-label={`Xoá ${row.name}`}
                      onClick={() => props.removeFloor(row.id)}
                      disabled={isSubmitting}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Button
                variant="secondary"
                size="sm"
                iconBefore={<Plus size={16} aria-hidden="true" />}
                onClick={props.addFloor}
                disabled={isSubmitting || !props.canAddFloor}
                aria-describedby={props.floorCapNote !== null ? FLOOR_CAP_NOTE_ID : undefined}
              >
                Thêm tầng
              </Button>
              {props.floorCapNote !== null && (
                <p id={FLOOR_CAP_NOTE_ID} className="text-[13px] leading-[18px] text-text-secondary">
                  {props.floorCapNote}
                </p>
              )}
            </div>
            <div className="flex items-end gap-2">
              <NumericField
                label="Chiều cao áp cho mọi tầng"
                className="w-full"
                value={props.applyHeightM ?? undefined}
                onChange={props.setApplyHeightM}
                min={PROJECT_LIMITS.storeyHeightMinM}
                max={PROJECT_LIMITS.storeyHeightMaxM}
                unit="m"
                disabled={isSubmitting}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  props.applyHeightToAllFloors();
                  setApplyCount((count) => count + 1);
                }}
                disabled={isSubmitting || !props.canApplyHeight}
              >
                Áp cho mọi tầng
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
