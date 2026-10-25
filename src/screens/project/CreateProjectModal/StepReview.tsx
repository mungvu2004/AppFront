/**
 * Step 3 of the "tạo dự án mới" wizard — xem lại.
 *
 * Two groups, each with its mark read from the gate (one source of state) and
 * a "Sửa ở bước n" link. Floors list top-down (Tầng 3 → Tầng trệt), like a
 * section. A pure view: every value arrives already computed on
 * {@link CreateProjectModalViewProps}.
 */

import { Check, CircleAlert, Pencil } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';

import type { CreateProjectGate } from './createProjectGate';
import type { CreateProjectModalViewProps } from './useCreateProjectModal';

export interface StepReviewProps extends CreateProjectModalViewProps {
  readonly gate: CreateProjectGate;
}

function GroupHead(props: { readonly ok: boolean; readonly title: string; readonly step: 1 | 2; readonly onEdit: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {props.ok ? (
        <Check size={16} className="shrink-0 text-state-verified" aria-label="Đã đủ" />
      ) : (
        <CircleAlert size={16} className="shrink-0 text-state-violation" aria-label="Cần sửa" />
      )}
      <h3 className="flex-1 text-[14px] font-medium text-text-primary">{props.title}</h3>
      <Button
        variant="ghost"
        size="sm"
        iconBefore={<Pencil size={14} aria-hidden="true" />}
        onClick={props.onEdit}
        aria-label={`Sửa ở bước ${String(props.step)}: ${props.title}`}
      >
        Sửa ở bước {props.step}
      </Button>
    </div>
  );
}

function Pair({ term, children }: { readonly term: string; readonly children: React.ReactNode }) {
  return (
    <>
      <dt className="text-text-secondary">{term}</dt>
      <dd className="text-text-primary wrap-anywhere">{children}</dd>
    </>
  );
}

export function StepReview(props: StepReviewProps) {
  const buildingTypeLabel =
    props.buildingTypeOptions.find((option) => option.value === props.buildingType)?.label ?? props.buildingType;
  const hasExtra = props.address !== '' || props.notes !== '';
  // "Sửa ở bước 1" from step 3: two steps back, each a plain goBack.
  const editInfo = (): void => {
    props.goBack();
    props.goBack();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* The server's answer; its fix is the footer's one button (gate.fix = 'notice'). */}
      {props.notice !== null && <InlineAlert level={props.notice.level} message={props.notice.message} />}

      <section className="flex flex-col gap-2">
        <GroupHead ok={props.gate.groupOk.info} title="Thông tin công trình" step={1} onEdit={editInfo} />
        <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-1 pl-6 text-[14px] leading-6">
          <Pair term="Tên dự án">{props.name}</Pair>
          <Pair term="Mã dự án">{props.code === '' ? '—' : <span className="font-mono text-[13px]">{props.code}</span>}</Pair>
          <Pair term="Loại công trình">{buildingTypeLabel}</Pair>
          {hasExtra ? (
            <>
              <Pair term="Địa chỉ">{props.address === '' ? '—' : props.address}</Pair>
              <Pair term="Ghi chú">{props.notes === '' ? '—' : props.notes}</Pair>
            </>
          ) : (
            <Pair term="Địa chỉ, ghi chú">
              <span className="text-text-secondary">Chưa nhập, bổ sung sau ở Cài đặt dự án</span>
            </Pair>
          )}
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <GroupHead
          ok={props.gate.groupOk.floors}
          title={`${String(props.floorRows.length)} tầng, cao độ không trùng`}
          step={2}
          onEdit={props.goBack}
        />
        <table className="ml-6 text-[14px]">
          <thead>
            <tr className="border-b border-border-default text-[13px] text-text-secondary">
              <th scope="col" className="py-1 text-left font-normal">Tầng</th>
              <th scope="col" className="py-1 text-right font-normal">Cao độ sàn</th>
              <th scope="col" className="py-1 text-right font-normal">Chiều cao tầng (sàn–sàn)</th>
            </tr>
          </thead>
          <tbody>
            {[...props.floorRows].reverse().map((row) => (
              <tr key={row.id} className="border-b border-border-default last:border-b-0">
                <td className="py-1 text-text-primary">{row.name}</td>
                <td className="py-1 text-right tabular-nums text-text-primary">{row.elevationLabel ?? '—'}</td>
                <td className="py-1 text-right tabular-nums text-text-primary">{row.clearHeightLabel ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
