/**
 * `WallGeometryEditor` — tấm phủ sửa hình học tường trên khung nhìn Viewer3D.
 *
 * View thuần (R-60): nhận đúng `WallGeometryEditorProps` (`state` +
 * `overlayRef`), không chạm `@/api`, `@/store`, `@/domain`, `@/lib/http`. Bảy
 * nhánh của `state.kind` là bảy interface rời (`wallGeometryEditorTypes.ts`
 * mục 6.1) — nhánh nào không mang `handles`/`toolbar`/`vertexTable` thì đọc
 * chúng là LỖI BIÊN DỊCH, không phải một mảng rỗng phải đoán.
 *
 * ## `overlayRef` và phiên kéo
 *
 * Lớp giữa (dưới dải, trên thanh công cụ) là phần tử DOM container nhận
 * `overlayRef` — hook cần hình chữ nhật của nó để đổi toạ độ con trỏ sang
 * pixel khung nhìn (mục 2 của hợp đồng). `onPointerMove`/`onPointerUp` gắn
 * NGAY TẠI ĐÂY chứ không tại tay nắm: điều cấm tuyệt đối "một phiên kéo chỉ
 * sinh MỘT bước hoàn tác" cần con trỏ vẫn được theo dõi sau khi nó rời khỏi
 * tay nắm lúc bắt đầu kéo (`WallGeometryDragSession`, mục 3.8). View chỉ đổi
 * toạ độ con trỏ sang pixel tương đối của chính lớp phủ — không quy đổi đơn
 * vị, không tính giao điểm.
 */
import { MousePointerClick } from 'lucide-react';
import type { PointerEvent, ReactNode } from 'react';
import { useRef } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Badge } from '@/components/ui/Badge';

import { WallGeometryEditorBand } from './WallGeometryEditorBand';
import { WallGeometryEditorOverlay } from './WallGeometryEditorOverlay';
import { WallGeometryEditorToolbar } from './WallGeometryEditorToolbar';
import { WallGeometryVertexTable } from './WallGeometryVertexTable';
import {
  WALL_GEOMETRY_EDITOR_TEXT,
  type WallGeometryEditorContent,
  type WallGeometryEditorProps,
  type WallGeometryGap,
  type WallGeometryPointPx,
} from './wallGeometryEditorTypes';

const TEXT = WALL_GEOMETRY_EDITOR_TEXT;

const BUTTON_FOCUS_CLASS =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

/** Toạ độ con trỏ, đổi sang pixel TƯƠNG ĐỐI của chính lớp phủ. Không quy đổi đơn vị. */
function toOverlayPoint(event: PointerEvent<HTMLDivElement>): WallGeometryPointPx {
  const rect = event.currentTarget.getBoundingClientRect();

  return { xPx: event.clientX - rect.left, yPx: event.clientY - rect.top };
}

function NoticeBanner({ children }: { children: ReactNode }): ReactNode {
  return (
    <p className="pointer-events-auto shrink-0 bg-bg-surface px-4 py-2 text-[13px] text-text-secondary">
      {children}
    </p>
  );
}

function GapBanner({ gap }: { gap: WallGeometryGap }): ReactNode {
  return (
    <div className="pointer-events-auto flex shrink-0 items-center justify-between gap-3 bg-state-attention-tint px-4 py-2 text-[13px] text-state-attention-text">
      <span className="font-mono">{TEXT.states.partial.gapSize(gap.sizeLabel)}</span>
      <button className={BUTTON_FOCUS_CLASS} onClick={gap.onCloseGap} type="button">
        {gap.closeLabel}
      </button>
    </div>
  );
}

function ErrorBanner({ content }: { content: Extract<WallGeometryEditorProps['state'], { kind: 'error' }> }): ReactNode {
  return (
    <div className="pointer-events-auto flex shrink-0 items-center justify-between gap-3 bg-state-violation-tint px-4 py-2 text-[13px] text-state-violation-text">
      <span>{content.explanation}</span>
      <button className={BUTTON_FOCUS_CLASS} onClick={content.onDismissError} type="button">
        {TEXT.states.error.dismiss}
      </button>
    </div>
  );
}

function ContentBody({
  content,
  onPointerMove,
  onPointerUp,
  overlayRef,
}: {
  content: WallGeometryEditorContent;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  overlayRef: (element: HTMLDivElement | null) => void;
}): ReactNode {
  return (
    <div className="relative flex min-h-0 flex-1">
      <div
        aria-label={TEXT.dimensionChain.regionLabel}
        className="relative min-h-0 flex-1"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={overlayRef}
      >
        <WallGeometryEditorOverlay
          dimensionChain={content.dimensionChain}
          edgeHighlights={content.edgeHighlights}
          handles={content.handles}
          returningHandleId={content.returningHandleId}
          snap={content.snap}
        />

        {content.comparisonChip !== null && (
          <div className="pointer-events-none absolute right-3 top-3">
            <Badge variant={content.comparisonChip.tone}>{content.comparisonChip.label}</Badge>
          </div>
        )}

        {content.dimensionChain.totalLabel !== null && (
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-[4px] bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-secondary shadow-panel">
            {TEXT.dimensionChain.total(content.dimensionChain.totalLabel)}
          </span>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <WallGeometryEditorToolbar toolbar={content.toolbar} />
        </div>
      </div>

      <div className="pointer-events-auto shrink-0 p-3">
        <WallGeometryVertexTable table={content.vertexTable} />
      </div>
    </div>
  );
}

export function WallGeometryEditor({ state, overlayRef }: WallGeometryEditorProps): ReactNode {
  const overlayNodeRef = useRef<HTMLDivElement | null>(null);

  const setOverlayNode = (element: HTMLDivElement | null): void => {
    overlayNodeRef.current = element;
    overlayRef?.(element);
  };

  if (state.kind === 'empty') {
    return (
      <section
        aria-label={TEXT.regionLabel}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        role="region"
      >
        <EmptyState
          className="pointer-events-auto"
          description={state.hint}
          icon={<MousePointerClick size={32} />}
          title={state.message}
        />
      </section>
    );
  }

  if (state.kind === 'loading') {
    return (
      <section
        aria-label={TEXT.regionLabel}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        role="region"
      >
        <span
          aria-live="polite"
          className="rounded-full bg-bg-surface px-4 py-2 text-[13px] text-text-secondary shadow-float"
          role="status"
        >
          {state.message}
        </span>
      </section>
    );
  }

  if (state.kind === 'collapsed') {
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 rounded-t-xl bg-bg-surface p-3 shadow-overlay">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-medium text-text-primary">{state.summaryLabel}</span>
          <span className="text-[13px] text-text-secondary">{state.notice}</span>
        </div>
        <button className={`shrink-0 rounded-[6px] px-2 py-1 text-[13px] font-medium text-accent hover:bg-bg-hover ${BUTTON_FOCUS_CLASS}`} onClick={state.onExit} type="button">
          {TEXT.states.collapsed.exit}
        </button>
      </div>
    );
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    state.drag?.onPointerMove(toOverlayPoint(event));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    state.drag?.onPointerUp(toOverlayPoint(event));
  };

  return (
    <div aria-label={TEXT.regionLabel} className="pointer-events-none absolute inset-0 flex flex-col" role="region">
      <div className="pointer-events-auto shrink-0">
        <WallGeometryEditorBand band={state.band} />
      </div>

      {state.kind === 'partial' && <NoticeBanner>{state.notice}</NoticeBanner>}
      {state.kind === 'partial' && state.gap !== null && <GapBanner gap={state.gap} />}
      {state.kind === 'forbidden' && <NoticeBanner>{state.notice}</NoticeBanner>}
      {state.kind === 'error' && <ErrorBanner content={state} />}

      <ContentBody
        content={state}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        overlayRef={setOverlayNode}
      />
    </div>
  );
}
