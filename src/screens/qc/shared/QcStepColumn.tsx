import { Check, Lock } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { CommandPalette } from '@/components/overlay/CommandPalette';
import type { CommandItem } from '@/hooks/useCommandPalette';
import { useScreenCommands } from '@/hooks/useScreenCommands';

import { cn } from '@/lib/utils';
import { SCALE_STATE_VIEWS } from '@/lib/viewmodel/provisionalScale';

import {
  floorReviewCountsOf,
  floorReviewGateOf,
  SCALE_LOCK_REASON,
  type FloorReviewLayerState,
  type FloorScaleState,
  type RequiredLayerKey,
} from './floorReviewGateModel';
import { QC_COMMAND_GROUP } from './qcLayout';
import { QC_LAYERS } from './qcLayers';
import { useFloorReview } from './useFloorReview';

/**
 * Cột việc 360 px của bố cục L23 (đợt 1, `qcLayout.ts`): một khối trắng từ trên xuống
 *   1. đầu cột: "Bước n · Tên" + câu việc (H1) + câu phụ;
 *   2. cây 4 bước: bước đang làm mở rộng (thân = hàng đợi của màn, truyền qua `children`),
 *      bước khác thu một dòng kèm tóm tắt ("Cửa và nội thất · 11 cần xem");
 *   3. cổng ở đáy cột (`gate`), thay cho nút ở header.
 * Số "còn N" của bước đang làm do màn truyền (`activeSummary`) để chỉ có một nguồn số trên màn.
 */
export type QcStepKey = 'scale' | RequiredLayerKey;

export interface QcStepColumnProps {
  readonly projectId: string;
  readonly floorId: string;
  readonly activeStep: QcStepKey;
  /** Câu việc của bước, là H1 của màn ("Duyệt từng đoạn tường. Đúng thì giữ, nét thừa thì xoá."). */
  readonly task: string;
  readonly hint?: string | undefined;
  /** Tóm tắt ở dòng bước đang làm; vắng thì dùng cùng số của cây ("7 cần xem", "30 đoạn · đã duyệt"). */
  readonly activeSummary?: ReactNode;
  /** Thân bước đang làm: bộ lọc + hàng đợi của màn. */
  readonly children: ReactNode;
  /** Cổng ở đáy cột (nút đi tiếp của tầng). */
  readonly gate?: ReactNode;
}

const STEP_KEYS: readonly QcStepKey[] = ['scale', 'walls', 'objects', 'rooms'];
const UNIT: Readonly<Record<RequiredLayerKey, string>> = { walls: 'đoạn', objects: 'mục', rooms: 'phòng' };
const STEPS_LABEL = 'Việc của từng bước';
const SCALE_WAIT = 'chờ tỷ lệ';
/** Bảng lệnh của khung L23 chỉ mang lệnh màn đăng ký (`useScreenCommands`), không mang lệnh mẫu của `CommandPalette`. */
const NO_SHARED_COMMANDS: CommandItem[] = [];

const stepTitle = (key: QcStepKey): string => QC_LAYERS.find((item) => item.key === key)?.label ?? key;
const stepRoute = (key: QcStepKey) => (QC_LAYERS.find((item) => item.key === key) ?? QC_LAYERS[0]!).route;

/** Tóm tắt một dòng của bước đang thu gọn. */
function summaryOf(key: QcStepKey, scale: FloorScaleState | null, layer: FloorReviewLayerState | undefined): string {
  if (key === 'scale') return scale === null ? '' : SCALE_STATE_VIEWS[scale].name;
  if (layer === undefined) return '';
  if (layer.done) return `${layer.total} ${UNIT[layer.key]} · đã duyệt`;
  return `${layer.total - layer.reviewed} cần xem`;
}

function StepIcon({ done, locked, active }: { readonly done: boolean; readonly locked: boolean; readonly active: boolean }) {
  if (locked) return <Lock aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted" />;
  if (done) {
    return (
      <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-state-verified text-white">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-full border-[1.5px]', active ? 'border-accent' : 'border-border-control')}
    >
      {active ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
    </span>
  );
}

/** Tóm tắt của bước đang làm: chip vàng khi còn việc, xanh khi xong. */
function ActiveChip({ done, text }: { readonly done: boolean; readonly text: string }) {
  if (text === '') return null;
  return (
    <span
      className={cn(
        'shrink-0 rounded-md px-2 py-0.5 text-body-sm font-medium tabular-nums',
        done ? 'bg-state-verified-tint text-state-verified-text' : 'bg-state-attention-tint text-state-attention-text',
      )}
    >
      {text}
    </span>
  );
}

export function QcStepColumn({ projectId, floorId, activeStep, task, hint, activeSummary, children, gate }: QcStepColumnProps) {
  const { graph, scale } = useFloorReview(projectId, floorId);
  const layers = useMemo(
    () => new Map(graph === null ? [] : floorReviewGateOf(floorReviewCountsOf(graph, floorId)).layers.map((item) => [item.key, item])),
    [floorId, graph],
  );
  const index = STEP_KEYS.indexOf(activeStep);
  const navigate = useNavigate();
  const commands = useMemo<CommandItem[]>(
    () =>
      STEP_KEYS.filter((key) => key !== activeStep && (key === 'scale' || scale !== 'missing')).map((key) => ({
        id: `qc-step-${key}`,
        group: QC_COMMAND_GROUP,
        label: `Đi tới bước ${stepTitle(key)}`,
        keywords: ['bước', 'duyệt tầng'],
        onSelect: () => navigate(stepRoute(key)(projectId, floorId)),
      })),
    [activeStep, floorId, navigate, projectId, scale],
  );
  useScreenCommands(commands);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel">
      <header className="shrink-0 border-b border-border-default px-5 pb-4 pt-4">
        <p className="text-caption font-medium uppercase tracking-[0.06em] text-text-muted">{`Bước ${index + 1} · ${stepTitle(activeStep)}`}</p>
        <h1 className="mt-1 text-[18px] font-medium leading-snug text-text-primary [text-wrap:balance]">{task}</h1>
        {hint === undefined ? null : <p className="mt-1.5 text-body-sm text-text-secondary [text-wrap:pretty]">{hint}</p>}
      </header>
      <nav aria-label={STEPS_LABEL} className="flex min-h-0 flex-1 flex-col">
        {STEP_KEYS.map((key) => {
          const isActive = key === activeStep;
          const locked = key !== 'scale' && scale === 'missing';
          const layer = key === 'scale' ? undefined : layers.get(key);
          const done = key === 'scale' ? scale === 'confirmed' : layer?.done === true;
          const summary = locked ? SCALE_WAIT : summaryOf(key, scale, layer);
          const row = (
            <>
              <StepIcon active={isActive} done={done && !isActive} locked={locked} />
              <span className={cn('min-w-0 flex-1 truncate', isActive ? 'text-[15px] font-medium text-text-primary' : 'text-text-primary')}>
                {stepTitle(key)}
              </span>
              {isActive ? (activeSummary ?? <ActiveChip done={done} text={summary} />) : <span className="shrink-0 text-body-sm tabular-nums text-text-secondary">{summary}</span>}
            </>
          );
          const rowClass = cn('flex shrink-0 items-center gap-3 px-5 text-body-sm', isActive ? 'min-h-12 bg-bg-sunken' : 'min-h-10 border-b border-border-default');
          if (isActive) {
            return (
              <section key={key} aria-current="step" aria-label={stepTitle(key)} className="flex min-h-0 flex-1 flex-col border-b border-border-default">
                <div className={rowClass}>{row}</div>
                <div className="flex min-h-0 flex-1 flex-col">{children}</div>
              </section>
            );
          }
          if (locked) {
            return (
              <span key={key} aria-disabled="true" className={cn(rowClass, 'cursor-not-allowed text-text-muted')} title={SCALE_LOCK_REASON}>
                {row}
                <span className="sr-only">{`: ${SCALE_LOCK_REASON}`}</span>
              </span>
            );
          }
          return (
            <Link key={key} className={cn(rowClass, 'hover:bg-bg-hover focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent')} to={stepRoute(key)(projectId, floorId)}>
              {row}
            </Link>
          );
        })}
      </nav>
      <CommandPalette commands={NO_SHARED_COMMANDS} />
      {gate == null ? null : <footer className="shrink-0 border-t border-border-default px-5 py-3 [&_a]:w-full [&_a]:justify-between [&_button]:w-full [&_button]:justify-between">{gate}</footer>}
    </div>
  );
}
