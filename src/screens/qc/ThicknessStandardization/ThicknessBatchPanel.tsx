/**
 * Việc chính của màn S-21 (bản Z, demo `Z/S-21`): ba nhóm đổi về chuẩn (ô đồng ý KHÔNG tích
 * sẵn), các đoạn không đổi (mỗi mã là link), và chân panel dính đáy: câu tóm tắt lô + MỘT nút
 * chính. Chưa tích nhóm nào thì nút dẫn tới việc còn thiếu ("Chọn cả 3 nhóm"), không nút chết.
 * View thuần: mọi số và câu đã ghép ở hook / `thicknessBatch.ts`.
 */

import { Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Kbd } from '@/components/ui/Kbd';
import { wallStrokeToken, wallThicknessColorBand } from '@/components/canvas/materialMap';
import { cn } from '@/lib/utils';

import type { ThicknessBatchProps } from './thicknessBatch';
import type { ThicknessGroup } from './thicknessTypes';

const TEXT = {
  groupsTitle: 'Nhóm đổi về chuẩn',
  colMeasured: 'Độ dày đo',
  colTarget: 'Đổi về',
  colCount: 'Số đoạn',
  manualTitle: (count: number) => `Để bạn tự xem ở Duyệt tường (${String(count)} đoạn)`,
  openWall: (code: string) => `Mở đoạn ${code} ở màn duyệt tường`,
  acceptGroup: (range: string, target: string) => `Đồng ý đổi các đoạn ${range} về ${target}`,
  selectAll: (groups: number, walls: number) =>
    groups > 1 ? `Chọn cả ${String(groups)} nhóm để đổi (${String(walls)} đoạn)` : `Chọn ${String(walls)} đoạn để đổi`,
  apply: (walls: number) => `Đổi ${String(walls)} đoạn`,
  undoLead: 'Một lần',
  undoHint: 'trả lại cả lô',
  detail: (count: number) => `Xem bảng từng đoạn (${String(count)})`,
} as const;

/**
 * Mẫu hình độ dày theo ba dải màu `wallThicknessColorBand` của thang sáu bậc (100/150 rỗng,
 * 200/220 đặc, 300/400 viền đôi) — mã hoá bằng hình, không chỉ sắc độ.
 */
function ThicknessSwatch({ group }: { readonly group: ThicknessGroup }) {
  const color = wallStrokeToken(group);
  const band = typeof group === 'number' ? wallThicknessColorBand(group) : null;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-2.5 w-6 shrink-0 rounded-[3px]',
        band === 110 && 'border',
        band === 330 && 'border-[3px] border-double',
      )}
      style={{ borderColor: color, backgroundColor: band === 110 ? 'transparent' : color }}
    />
  );
}

export interface ThicknessBatchPanelProps
  extends Pick<
    ThicknessBatchProps,
    | 'targetGroups'
    | 'manualRows'
    | 'onToggleGroupAccepted'
    | 'onOpenWall'
  > {
  readonly hoveredGroup: ThicknessGroup | null;
  readonly onHoverGroup: (group: ThicknessGroup | null) => void;
  readonly isReadOnly: boolean;
  readonly segmentCount: number;
  readonly onOpenDetail: () => void;
}

/** Bảng ba nhóm + danh sách đoạn không đổi (phần cuộn của panel trái). */
export function ThicknessBatchPanel(props: ThicknessBatchPanelProps) {
  const { targetGroups, manualRows, hoveredGroup, onHoverGroup, onToggleGroupAccepted, onOpenWall, isReadOnly } = props;

  return (
    <div className="flex flex-col gap-4">
      {targetGroups.length === 0 ? null : (
        <section aria-label={TEXT.groupsTitle} className="flex flex-col gap-2">
          <h2 className="text-body font-medium text-text-primary">{TEXT.groupsTitle}</h2>
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-caption text-text-secondary">
                <th className="py-1.5 pl-8 font-medium">{TEXT.colMeasured}</th>
                <th className="py-1.5 font-medium">{TEXT.colTarget}</th>
                <th className="py-1.5 pr-2 text-right font-medium">{TEXT.colCount}</th>
              </tr>
            </thead>
            <tbody>
              {targetGroups.map((row) => (
                <tr
                  key={String(row.group)}
                  className={cn('h-9 border-b border-border-default', hoveredGroup === row.group && 'bg-accent-wash')}
                  data-testid={`thickness-group-${String(row.group)}`}
                  onMouseEnter={() => onHoverGroup(row.group)}
                  onMouseLeave={() => onHoverGroup(null)}
                >
                  <td className="py-1">
                    <div className="flex items-center gap-2">
                      {isReadOnly ? (
                        <span className="w-6" />
                      ) : (
                        <Checkbox
                          aria-label={TEXT.acceptGroup(row.rangeLabel, row.targetLabel)}
                          checked={row.accepted}
                          onChange={(checked) => onToggleGroupAccepted(row.group, checked)}
                          size="sm"
                        />
                      )}
                      <span className="tabular-nums text-text-primary">{row.rangeLabel}</span>
                    </div>
                  </td>
                  <td className="py-1">
                    <span className="flex items-center gap-2 tabular-nums text-text-primary">
                      <ThicknessSwatch group={row.group} />
                      {row.targetLabel}
                    </span>
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums text-text-primary">{row.wallCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {manualRows.length === 0 ? null : (
        <section aria-label={TEXT.manualTitle(manualRows.length)} className="flex flex-col gap-1">
          <h2 className="text-body-sm text-text-secondary">{TEXT.manualTitle(manualRows.length)}</h2>
          <ul className="flex flex-col">
            {manualRows.map((row) => (
              <li
                key={row.wallId}
                className="grid grid-cols-[72px_1fr_auto] items-center gap-3 border-b border-border-default py-2 text-body-sm"
              >
                <span className="tabular-nums text-text-primary">{row.measuredLabel}</span>
                <span className="text-text-secondary">{row.reasonLabel}</span>
                <button
                  aria-label={TEXT.openWall(row.code)}
                  className="rounded-md px-1 font-mono text-accent underline-offset-2 hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent"
                  onClick={() => onOpenWall(row.wallId)}
                  type="button"
                >
                  {row.code}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {props.segmentCount === 0 ? null : (
        <button
          className="self-start rounded-md px-1 py-1 text-body-sm text-accent hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent"
          onClick={props.onOpenDetail}
          type="button"
        >
          {TEXT.detail(props.segmentCount)}
        </button>
      )}
    </div>
  );
}

export interface ThicknessBatchFooterProps
  extends Pick<ThicknessBatchProps, 'batchCount' | 'candidateCount' | 'batchSentence' | 'onAcceptAllGroups' | 'onApplyBatch'> {
  readonly groupCount: number;
  readonly isReadOnly: boolean;
}

/** Chân panel dính đáy: câu tóm tắt lô + MỘT nút chính. */
export function ThicknessBatchFooter(props: ThicknessBatchFooterProps) {
  const { batchCount, candidateCount, batchSentence, groupCount, isReadOnly } = props;
  const hasWork = !isReadOnly && candidateCount > 0;

  return (
    <div className="shrink-0 border-t border-border-default bg-bg-surface px-4 py-3" data-sticky-footer>
      <p aria-live="polite" className="text-body-sm text-text-secondary">
        {batchSentence}
      </p>
      {hasWork ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          {batchCount > 0 ? (
            <span className="mr-auto flex items-center gap-1.5 text-caption text-text-secondary">
              <Undo2 aria-hidden="true" size={14} />
              <span>{TEXT.undoLead}</span>
              <Kbd>Ctrl+Z</Kbd>
              <span>{TEXT.undoHint}</span>
            </span>
          ) : null}
          {batchCount > 0 ? (
            <Button onClick={props.onApplyBatch} shortcut="Enter" variant="primary">
              {TEXT.apply(batchCount)}
            </Button>
          ) : (
            <Button onClick={props.onAcceptAllGroups} variant="primary">
              {TEXT.selectAll(groupCount, candidateCount)}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
