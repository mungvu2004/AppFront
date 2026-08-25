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

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { NumericField } from '@/components/ui/NumericField';
import { Table } from '@/components/ui/Table';
import { Toggle } from '@/components/ui/Toggle';

import { PROJECT_LIMITS, type CreateProjectModalViewProps } from './useCreateProjectModal';

export interface StepFloorsProps extends CreateProjectModalViewProps {
  readonly rowRefs: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
}

export function StepFloors(props: StepFloorsProps) {
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
                      min={PROJECT_LIMITS.storeyHeightMinM}
                      max={PROJECT_LIMITS.storeyHeightMaxM}
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              iconBefore={<Plus size={16} aria-hidden="true" />}
              onClick={props.addFloor}
              disabled={isSubmitting || !props.canAddFloor}
            >
              thêm tầng
            </Button>
            <div className="flex items-end gap-2">
              <NumericField
                label="chiều cao áp cho mọi tầng"
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
                onClick={props.applyHeightToAllFloors}
                disabled={isSubmitting || !props.canApplyHeight}
              >
                áp cho mọi tầng
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
