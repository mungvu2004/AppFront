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
import { useEffect, useRef, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { NumericField } from '@/components/ui/NumericField';
import { Table } from '@/components/ui/Table';
import { Toggle } from '@/components/ui/Toggle';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

import {
  FLOOR_CAP_NOTE_ID,
  PROJECT_LIMITS,
  type CreateProjectModalViewProps,
} from './useCreateProjectModal';

/** Cell padding: tighter below `sm`, where the dialog is the viewport minus its gutter. */
const CELL_PAD = 'px-1.5 sm:px-3';
/** Chiều cao sàn–sàn thường gặp ở chung cư, chỉ để gợi ý — không điền sẵn. */
export const HEIGHT_PLACEHOLDER = 'VD: 3,3';

/**
 * Lines the controls of a row up on the top of their fields, not on the middle of a row
 * a field's error made taller (BUG-230): body cells align top, and what is not a field
 * sits in a box as tall as one (`Input`: 46 px below `sm`, 38 px from it), centred.
 */
const ROW_CELL = cn(CELL_PAD, 'align-top');
const FIELD_HIGH = 'flex h-[46px] sm:h-[38px] items-center';

export interface StepFloorsProps extends CreateProjectModalViewProps {
  readonly rowRefs: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
}

export function StepFloors(props: StepFloorsProps) {
  const { floorRows, isSubmitting, rowRefs } = props;
  const collisionRowId = props.collisionRowId;
  // Bumped by every "Áp cho mọi tầng": the row fields drop a refused text even when the applied height equals
  // the one a row already held (no value change for the field to see). `resetKey`, not `key`: no remount.
  const [applyCount, setApplyCount] = useState(0);
  // The click that adds the 50th floor locks "Thêm tầng" under the focus, which would fall to <body>:
  // hand it to the name of the floor just added (the last row) instead.
  const focusAddedName = useRef(false);
  useEffect(() => {
    if (!focusAddedName.current) return;
    focusAddedName.current = false;
    const added = floorRows.at(-1);
    if (added) rowRefs.current.get(added.id)?.querySelector('input')?.focus();
  }, [floorRows, rowRefs]);
  const addFloor = (): void => {
    focusAddedName.current = floorRows.length + 1 >= PROJECT_LIMITS.floorCountMax;
    props.addFloor();
  };

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

      {/* Câu "vì sao Tiếp tục khoá" nằm ở chân hộp thoại, ngay cạnh nút (G3-03). */}

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
                <Table.Head className={cn(CELL_PAD, 'w-1/3 whitespace-normal')}>Chiều cao tầng (sàn–sàn)</Table.Head>
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
                  <Table.Cell className={ROW_CELL}>
                    <Input
                      className="w-full"
                      value={row.name}
                      onChange={(event) => props.setFloorName(row.id, event.target.value)}
                      error={row.nameProblem}
                      disabled={isSubmitting}
                      aria-label={`Tên tầng ${row.name}`}
                    />
                  </Table.Cell>
                  <Table.Cell className={ROW_CELL}>
                    <NumericField
                      resetKey={applyCount}
                      className="w-full"
                      value={row.clearHeightM ?? undefined}
                      onChange={(value) => props.setFloorHeight(row.id, value)}
                      unit="m"
                      // U26: ô trống thì gợi ý số thường gặp ở chung cư.
                      placeholder={HEIGHT_PLACEHOLDER}
                      disabled={isSubmitting}
                      aria-label={`Chiều cao tầng (sàn–sàn) ${row.name}`}
                      {...(row.problem !== null ? { error: row.problem } : {})}
                    />
                  </Table.Cell>
                  <Table.Cell className={cn(ROW_CELL, 'text-text-secondary')}>
                    <span className={FIELD_HIGH}>{row.elevationLabel ?? '—'}</span>
                  </Table.Cell>
                  <Table.Cell className={ROW_CELL}>
                    <span className={FIELD_HIGH}>
                      {/* Its tooltip to the left: on top, the first row's covered the "Cao độ" column header (BUG-232). */}
                      <Tooltip label={floorRows.length <= 1 ? 'Cần ít nhất một tầng' : `Xoá ${row.name}`} side="left" disabled={isSubmitting}>
                        <IconButton
                          icon={<Trash2 size={16} aria-hidden="true" />}
                          aria-label={`Xoá ${row.name}`}
                          onClick={() => props.removeFloor(row.id)}
                          disabled={isSubmitting || floorRows.length <= 1}
                          tooltip={false}
                        />
                      </Tooltip>
                    </span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {/* Above the locked "Thêm tầng", not under it: wherever that button is in view, so is the
              reason, never cut by the footer or faded under the body's bottom edge (BUG-231). */}
          {props.floorCapNote !== null && (
            <p id={FLOOR_CAP_NOTE_ID} className="text-[13px] leading-[18px] text-text-secondary">
              {props.floorCapNote}
            </p>
          )}
          {/* Both buttons line up with the apply field's box, not with its error line (BUG-230):
              stacked below `sm`, side by side from it, each pushed down past the field's label. */}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
            {/* `mt-7`: the apply field's label above its box (`Input`: 20 px line + 8 px gap). */}
            <span className={cn(FIELD_HIGH, 'sm:mt-7')}>
              <Button
                variant="secondary"
                size="sm"
                iconBefore={<Plus size={16} aria-hidden="true" />}
                onClick={addFloor}
                disabled={isSubmitting || !props.canAddFloor}
                aria-describedby={props.floorCapNote !== null ? FLOOR_CAP_NOTE_ID : undefined}
              >
                Thêm tầng
              </Button>
            </span>
            <div className="flex items-start gap-2">
              <NumericField
                label={<span className="whitespace-nowrap">Chiều cao áp cho mọi tầng</span>}
                className="w-full"
                value={props.applyHeightM ?? undefined}
                onChange={props.setApplyHeightM}
                min={PROJECT_LIMITS.storeyHeightMinM}
                max={PROJECT_LIMITS.storeyHeightMaxM}
                placeholder={HEIGHT_PLACEHOLDER}
                unit="m"
                disabled={isSubmitting}
              />
              <span className={cn(FIELD_HIGH, 'mt-7')}>
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
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
