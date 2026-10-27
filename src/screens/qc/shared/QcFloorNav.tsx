import { useMemo, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronDown, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/paths';

import {
  floorReviewCountsOf,
  floorReviewGateOf,
  SCALE_LOCK_REASON,
  type FloorReviewLayerState,
  type FloorScaleState,
} from './floorReviewGateModel';
import { QC_LAYERS, qcLayerTitle, type QcLayerKey } from './qcLayers';
import { useFloorReview } from './useFloorReview';

/**
 * Thanh bước của tầng (UX-R1 K25), MỘT hàng 32 px dưới header:
 * "ch-03 ▾ | 0 Tỷ lệ · 1 Tường 0/30 · 2 Cửa và nội thất 0/39 · 3 Phòng 0/7 | Nâng cao ▾".
 * Nút đi tiếp của tầng nằm ở khe cổng của header (`FloorReviewGate`), không lặp ở đây.
 * Tầng máy không đo được tỷ lệ: các bước sau Tỷ lệ (và Độ dày tường) bị khoá, kèm lý do.
 * Gắn: `<QcFloorNav floorId={floorId} layer="rooms" projectId={projectId} />` (cần nằm trong Router).
 */
export interface QcFloorNavFloor {
  readonly id: string;
  readonly label: string;
}

export interface QcFloorNavProps {
  readonly projectId: string;
  readonly floorId: string;
  readonly layer: QcLayerKey;
  readonly floors?: readonly QcFloorNavFloor[] | undefined;
  /** Không còn vẽ (header đã có tên dự án); giữ để nơi gọi cũ không vỡ kiểu. */
  readonly projectName?: string | undefined;
  /** Dòng tiến độ cạnh tiêu đề, đã định dạng ("12/40 đã duyệt"). Vắng thì ẩn gọn. */
  readonly progress?: string | null | undefined;
  /** Màn đã có H1 thấy được (QcPanelHead): bỏ H1 ẩn ở đây để trang chỉ có một H1. */
  readonly titled?: boolean;
}

const FLOOR_FALLBACK = 'Tầng';
const STEP_BAR_LABEL = 'Các bước duyệt tầng';
const ADVANCED_LABEL = 'Nâng cao';
const ALL_FLOORS_LABEL = 'Tất cả tầng';
/** Mục phụ thuộc số đo: khoá khi máy không đo được tỷ lệ. */
const SCALE_LOCKED: ReadonlySet<QcLayerKey> = new Set<QcLayerKey>(['walls', 'objects', 'rooms', 'thickness']);
const SCALE_BADGE: Readonly<Record<Exclude<FloorScaleState, 'confirmed'>, { readonly text: string; readonly className: string }>> = {
  check: { text: 'cần kiểm', className: 'text-state-attention-text' },
  missing: { text: 'chưa có', className: 'text-state-violation-text' },
};

const TAB_CLASS = cn(
  'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[13px] transition-colors duration-120',
  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);
const CURRENT_CLASS = 'bg-accent-wash font-medium text-accent';
const IDLE_CLASS = 'text-text-secondary hover:bg-bg-hover hover:text-text-primary';
const MENU_ITEM_CLASS = 'flex w-full items-center gap-1 rounded-md px-3 py-1.5 text-left';

/** A12: Esc đóng menu đang mở và trả tiêu điểm về nút mở. */
function closeOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
  if (event.key !== 'Escape' || !event.currentTarget.open) return;
  event.currentTarget.open = false;
  event.currentTarget.querySelector('summary')?.focus();
}

interface NavMenuProps {
  readonly label: string;
  readonly summary: ReactNode;
  readonly active?: boolean;
  readonly children: ReactNode;
}

/* ponytail: <details> gốc như menu dự án ở AppHeader — không đóng khi bấm ra ngoài; cần thì đổi sang Popover. */
function NavMenu({ label, summary, active = false, children }: NavMenuProps) {
  return (
    <details className="relative shrink-0" onKeyDown={closeOnEscape}>
      <summary
        aria-label={label}
        className={cn(TAB_CLASS, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden', active ? CURRENT_CLASS : IDLE_CLASS)}
      >
        {summary}
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-text-muted" />
      </summary>
      <ul className="absolute left-0 top-full z-30 mt-1 min-w-[200px] rounded-md border border-border-default bg-bg-surface p-1 text-[13px] shadow-float">
        {children}
      </ul>
    </details>
  );
}

interface StepProps {
  readonly isCurrent: boolean;
  readonly locked: boolean;
  readonly to: string;
  readonly className: string;
  readonly children: ReactNode;
}

/** Một bước/mục: link, hoặc chữ khoá kèm lý do khi thiếu tỷ lệ. */
function Step({ isCurrent, locked, to, className, children }: StepProps) {
  if (locked) {
    return (
      <span
        aria-current={isCurrent ? 'page' : undefined}
        aria-disabled="true"
        className={cn(className, 'cursor-not-allowed text-text-muted', isCurrent && 'bg-bg-sunken')}
        title={SCALE_LOCK_REASON}
      >
        <Lock aria-hidden="true" className="h-3 w-3" />
        {children}
        <span className="sr-only">{`: ${SCALE_LOCK_REASON}`}</span>
      </span>
    );
  }
  return (
    <Link aria-current={isCurrent ? 'page' : undefined} className={cn(className, isCurrent ? CURRENT_CLASS : IDLE_CLASS)} to={to}>
      {children}
    </Link>
  );
}

interface FloorMenuItemProps {
  readonly projectId: string;
  readonly floor: QcFloorNavFloor;
  readonly layer: QcLayerKey;
  readonly isCurrent: boolean;
}

/** Một tầng trong menu đổi tầng: tầng thiếu tỷ lệ mà bước đang mở bị khoá thì sang bước Tỷ lệ của nó. */
function FloorMenuItem({ projectId, floor, layer, isCurrent }: FloorMenuItemProps) {
  const { scale } = useFloorReview(projectId, floor.id);
  const target = scale === 'missing' && SCALE_LOCKED.has(layer) ? 'scale' : layer;
  const route = (QC_LAYERS.find((item) => item.key === target) ?? QC_LAYERS[0]!).route;
  return (
    <li>
      <Link
        aria-current={isCurrent ? 'page' : undefined}
        className={cn(MENU_ITEM_CLASS, 'justify-between', isCurrent ? 'text-accent' : 'text-text-primary hover:bg-bg-hover')}
        to={route(projectId, floor.id)}
      >
        {floor.label}
        {isCurrent && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
      </Link>
    </li>
  );
}

export function QcFloorNav({ projectId, floorId, layer, floors = [], progress, titled = false }: QcFloorNavProps) {
  const current = QC_LAYERS.find((item) => item.key === layer) ?? QC_LAYERS[0]!;
  const floorLabel = floors.find((floor) => floor.id === floorId)?.label ?? FLOOR_FALLBACK;
  const screenTitle = qcLayerTitle(layer);
  const { graph, scale } = useFloorReview(projectId, floorId);
  /* Tiến độ từng lớp bắt buộc; chưa đọc được tầng thì chỉ đánh số. */
  const layerStates = useMemo(
    () =>
      new Map<QcLayerKey, FloorReviewLayerState>(
        graph === null ? [] : floorReviewGateOf(floorReviewCountsOf(graph, floorId)).layers.map((item) => [item.key, item]),
      ),
    [floorId, graph],
  );
  const isLocked = (key: QcLayerKey) => scale === 'missing' && SCALE_LOCKED.has(key);
  const steps = QC_LAYERS.filter((item) => item.group === 'step');
  const advanced = QC_LAYERS.filter((item) => item.group === 'advanced');
  const currentAdvanced = current.group === 'advanced' ? current : null;

  return (
    <div className="flex h-8 shrink-0 items-center gap-3 px-4">
      {titled ? null : <h1 className="sr-only">{`${screenTitle} · ${floorLabel}`}</h1>}
      {/* key: đổi tầng/màn thì menu đóng lại. */}
      <NavMenu
        key={`floor:${floorId}:${layer}`}
        label={`Đổi tầng: đang ở ${floorLabel}`}
        summary={<span className="font-medium text-text-primary">{floorLabel}</span>}
      >
        {floors.map((floor) => (
          <FloorMenuItem key={floor.id} floor={floor} isCurrent={floor.id === floorId} layer={current.key} projectId={projectId} />
        ))}
        <li className={cn(floors.length > 0 && 'mt-1 border-t border-border-default pt-1')}>
          <Link className={cn(MENU_ITEM_CLASS, IDLE_CLASS)} to={ROUTES.project.floors(projectId)}>
            {ALL_FLOORS_LABEL}
          </Link>
        </li>
      </NavMenu>
      <nav aria-label={STEP_BAR_LABEL} className="flex min-w-0 flex-1 items-center gap-1 border-l border-border-default pl-3">
        {steps.map((item, index) => {
          const state = layerStates.get(item.key);
          const isDone = item.key === 'scale' ? scale === 'confirmed' : state?.done === true;
          const badge = item.key === 'scale' && scale !== null && scale !== 'confirmed' ? SCALE_BADGE[scale] : null;
          return (
            <Step
              key={item.key}
              className={TAB_CLASS}
              isCurrent={item.key === layer}
              locked={isLocked(item.key)}
              to={item.route(projectId, floorId)}
            >
              <span aria-hidden="true" className="tabular-nums text-text-muted">{index}</span>
              {item.label}
              {isDone && (
                <>
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-state-verified-text" />
                  <span className="sr-only">: đã xong</span>
                </>
              )}
              {badge !== null && <span className={cn('text-[12px]', badge.className)}>{badge.text}</span>}
              {state !== undefined && !isDone && (
                <>
                  <span aria-hidden="true" className="tabular-nums text-text-muted">{`${state.reviewed}/${state.total}`}</span>
                  <span className="sr-only">{`: đã duyệt ${state.reviewed} trên ${state.total}`}</span>
                </>
              )}
            </Step>
          );
        })}
        <span aria-hidden="true" className="mx-2 h-5 w-px shrink-0 bg-border-control" />
        <NavMenu
          key={`advanced:${floorId}:${layer}`}
          active={currentAdvanced !== null}
          label={currentAdvanced === null ? ADVANCED_LABEL : `${ADVANCED_LABEL}: đang ở ${currentAdvanced.label}`}
          summary={currentAdvanced === null ? ADVANCED_LABEL : `${ADVANCED_LABEL}: ${currentAdvanced.label}`}
        >
          {advanced.map((item) => (
            <li key={item.key}>
              <Step className={MENU_ITEM_CLASS} isCurrent={item.key === layer} locked={isLocked(item.key)} to={item.route(projectId, floorId)}>
                {item.label}
              </Step>
            </li>
          ))}
        </NavMenu>
      </nav>
      {/* Tiến độ của lớp (Impeccable A3), cuối cùng hàng 32 px — không thêm hàng (V-16). */}
      {progress == null ? null : (
        <p className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-text-secondary" data-testid="qc-progress">
          {progress}
        </p>
      )}
    </div>
  );
}
