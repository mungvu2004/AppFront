import { useMemo, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronDown, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { useShortcut } from '@/hooks/useShortcut';

import { cn } from '@/lib/utils';
import { SCALE_STATE_VIEWS, type ScaleStateView } from '@/lib/viewmodel/provisionalScale';
import { ROUTES } from '@/routes/paths';

import {
  floorReviewCountsOf,
  floorReviewGateOf,
  SCALE_LOCK_REASON,
  type FloorReviewLayerState,
  type FloorScaleState,
} from './floorReviewGateModel';
import { QC_LAYERS, qcLayerTitle, qcStepOf, type QcLayerKey } from './qcLayers';
import { useFloorReview } from './useFloorReview';

/**
 * Thanh bước của tầng (UX-R1 K25, UX-R2 K04), MỘT hàng 32 px dưới header:
 * "ch-03 ▾ | 1 ● Tỷ lệ cần kiểm · 2 ● Tường 0/30 · 3 ● Cửa và nội thất 0/39 · 4 ● Phòng 0/7".
 * Chấm bước Tỷ lệ theo `SCALE_STATE_VIEWS` (đỏ/vàng/xanh, cùng chữ với cổng và dải); bước khác
 * xanh khi xong. Không còn menu "Nâng cao": đứng ở bước Tỷ lệ thì cạnh thanh bước có link Kích thước
 * và So với bản vẽ (mục con của bước); Độ dày mở từ nút trong bước Tường; Trục mở từ màn Các tầng.
 * Nút đi tiếp của tầng nằm ở khe cổng của header (`FloorReviewGate`), không lặp ở đây.
 * Tầng chưa có tỷ lệ: các bước sau Tỷ lệ (và Độ dày tường) bị khoá, kèm lý do.
 * Phím `]` / `[` sang bước sau / về bước trước của tầng (U19), hiện trong bảng `?`.
 * Gắn: `<QcFloorNav floorId={floorId} layer="rooms" projectId={projectId} />` (cần nằm trong Router).
 */
export interface QcFloorNavFloor {
  readonly id: string;
  readonly label: string;
  /** `false` = tầng chưa có bản vẽ nào: menu đổi tầng ghi rõ (U52). Vắng = chưa biết, không ghi. */
  readonly hasDrawing?: boolean | undefined;
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
  /** Bố cục L23: bước chỉ mang trạng thái (✓ / ổ khoá / chấm), số nằm ở cột việc. */
  readonly minimal?: boolean;
}

const FLOOR_FALLBACK = 'Tầng';
const STEP_BAR_LABEL = 'Các bước duyệt tầng';
const ALL_FLOORS_LABEL = 'Tất cả tầng';
const NO_DRAWING_LABEL = 'chưa có bản vẽ';
const NEXT_STEP_SHORTCUT = 'Sang bước sau của tầng';
const PREVIOUS_STEP_SHORTCUT = 'Về bước trước của tầng';
/** Mục phụ thuộc số đo: khoá khi máy không đo được tỷ lệ. */
const SCALE_LOCKED: ReadonlySet<QcLayerKey> = new Set<QcLayerKey>(['walls', 'objects', 'rooms', 'thickness']);
const DOT_CLASS: Readonly<Record<ScaleStateView['statusCode'] | 'neutral', string>> = {
  violation: 'bg-state-violation',
  attention: 'bg-state-attention',
  verified: 'bg-state-verified',
  neutral: 'bg-border-control',
};
const SCALE_TEXT_CLASS: Readonly<Record<FloorScaleState, string>> = {
  missing: 'text-state-violation-text',
  check: 'text-state-attention-text',
  confirmed: '',
};

function StatusDot({ tone }: { readonly tone: keyof typeof DOT_CLASS }) {
  return <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', DOT_CLASS[tone])} />;
}

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
  readonly children: ReactNode;
}

/* ponytail: <details> gốc như menu dự án ở AppHeader — không đóng khi bấm ra ngoài; cần thì đổi sang Popover. */
function NavMenu({ label, summary, children }: NavMenuProps) {
  return (
    <details className="relative shrink-0" onKeyDown={closeOnEscape}>
      <summary
        aria-label={label}
        className={cn(TAB_CLASS, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden', IDLE_CLASS)}
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
  /** `page` = màn đang mở; `step` = bước cha của màn phụ đang mở (Kích thước thuộc Tỷ lệ). */
  readonly current?: 'page' | 'step' | undefined;
  readonly locked: boolean;
  readonly to: string;
  readonly className: string;
  readonly children: ReactNode;
}

/** Một bước/mục: link, hoặc chữ khoá kèm lý do khi thiếu tỷ lệ. */
function Step({ current, locked, to, className, children }: StepProps) {
  if (locked) {
    return (
      <span
        aria-current={current}
        aria-disabled="true"
        className={cn(className, 'cursor-not-allowed text-text-muted', current !== undefined && 'bg-bg-sunken')}
        title={SCALE_LOCK_REASON}
      >
        <Lock aria-hidden="true" className="h-3 w-3" />
        {children}
        <span className="sr-only">{`: ${SCALE_LOCK_REASON}`}</span>
      </span>
    );
  }
  return (
    <Link aria-current={current} className={cn(className, current === undefined ? IDLE_CLASS : CURRENT_CLASS)} to={to}>
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
        <span className="flex min-w-0 items-baseline gap-2">
          {floor.label}
          {floor.hasDrawing === false ? ' ' : null}
          {floor.hasDrawing === false ? <span className="text-[12px] text-text-muted">{NO_DRAWING_LABEL}</span> : null}
        </span>
        {isCurrent && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
      </Link>
    </li>
  );
}

export function QcFloorNav({ projectId, floorId, layer, floors = [], progress, titled = false, minimal = false }: QcFloorNavProps) {
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
  const activeStep = qcStepOf(layer);
  /* Mục con của bước đang sáng: Kích thước, So với bản vẽ ở bước Tỷ lệ; màn phụ khác chỉ hiện khi đang đứng ở đó. */
  const subLinks = QC_LAYERS.filter((item) => item.parent !== undefined && item.parent === activeStep && (item.listed === true || item.key === layer));
  const navigate = useNavigate();
  const stepIndex = steps.findIndex((item) => item.key === activeStep);
  /* U19: đổi bước bằng bàn phím; bước khoá (thiếu tỷ lệ) thì đứng yên. */
  const goStep = (delta: number) => {
    const target = steps[stepIndex + delta];
    if (target === undefined || isLocked(target.key)) return;
    void navigate(target.route(projectId, floorId));
  };
  useShortcut({ id: 'qcFloorNav.nextStep', combo: ']', scope: 'global', description: NEXT_STEP_SHORTCUT, onTrigger: () => goStep(1) });
  useShortcut({ id: 'qcFloorNav.previousStep', combo: '[', scope: 'global', description: PREVIOUS_STEP_SHORTCUT, onTrigger: () => goStep(-1) });
  const currentOf = (key: QcLayerKey): StepProps['current'] => {
    if (key === layer) return 'page';
    return key === activeStep ? 'step' : undefined;
  };

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
          const isScale = item.key === 'scale';
          const isDone = isScale ? scale === 'confirmed' : state?.done === true;
          const scaleView = isScale && scale !== null ? SCALE_STATE_VIEWS[scale] : null;
          /* Tỷ lệ chưa xác nhận: bước mang đúng tên trạng thái ("Chưa có tỷ lệ", "Tỷ lệ cần kiểm"). */
          const label = scaleView !== null && scale !== 'confirmed' ? scaleView.name : item.label;
          return (
            <Step
              key={item.key}
              className={TAB_CLASS}
              current={currentOf(item.key)}
              locked={isLocked(item.key)}
              to={item.route(projectId, floorId)}
            >
              <span aria-hidden="true" className="tabular-nums text-text-muted">{index + 1}</span>
              {isLocked(item.key) ? null : <StatusDot tone={scaleView?.statusCode ?? (isDone ? 'verified' : 'neutral')} />}
              <span className={isScale && scale !== null ? SCALE_TEXT_CLASS[scale] : undefined}>{label}</span>
              {isDone && <span className="sr-only">: đã xong</span>}
              {state !== undefined && !isDone && !minimal && (
                <>
                  <span aria-hidden="true" className="tabular-nums text-text-muted">{`${state.reviewed}/${state.total}`}</span>
                  <span className="sr-only">{`: đã duyệt ${state.reviewed} trên ${state.total}`}</span>
                </>
              )}
            </Step>
          );
        })}
        {subLinks.length === 0 ? null : (
          <>
            <span aria-hidden="true" className="mx-2 h-5 w-px shrink-0 bg-border-control" />
            {subLinks.map((item) => (
              <Step key={item.key} className={TAB_CLASS} current={currentOf(item.key)} locked={isLocked(item.key)} to={item.route(projectId, floorId)}>
                {item.label}
              </Step>
            ))}
          </>
        )}
      </nav>
      {/* Tiến độ của lớp (Impeccable A3), cuối cùng hàng 32 px — không thêm hàng (V-16). */}
      {progress == null || minimal ? null : (
        <p className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-text-secondary" data-testid="qc-progress">
          {progress}
        </p>
      )}
    </div>
  );
}
