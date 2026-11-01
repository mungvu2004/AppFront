/**
 * Thẻ "Nướng ánh sáng" của trang 3D, trong cụm "Cảnh" cạnh "Ánh sáng". Chỉ hiện cho người sửa được
 * lớp (`main.tsx` ẩn khi `readOnly`, tức `!can('edit', 'layer')`). Logic ở `./useLightingBake`.
 */
import { ChevronDown } from 'lucide-react';

import type { LightingBake } from '@/api/schemas/lightingBake';

import { bakeStatusLabel, isBakeActive, useLightingBake } from './useLightingBake';

const BUTTON =
  'flex h-9 w-full items-center rounded-lg px-2 text-left text-[var(--pa-text-2)] transition-colors duration-120 hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)] disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pa-accent)]';

export interface BakeLightingViewProps {
  readonly bake: LightingBake | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly previewing: boolean;
  readonly onStart: () => void;
  readonly onView: () => void;
  readonly onHide: () => void;
}

/** View thuần: test được chỉ từ props. */
export function BakeLightingView({ bake, busy, error, previewing, onStart, onView, onHide }: BakeLightingViewProps) {
  const status = error ?? bakeStatusLabel(bake) ?? 'Chưa nướng lần nào';
  return (
    <details className="relative" data-appfront-menu="">
      <summary
        aria-label="Nướng ánh sáng — mở bảng nướng"
        className="flex h-8 shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] px-2.5 font-medium text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)] transition-colors duration-120 hover:bg-[var(--pa-sunken)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)] [&::-webkit-details-marker]:hidden"
      >
        Nướng ánh sáng
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)]" />
      </summary>
      <div className="absolute top-full left-0 z-50 mt-1 w-60 rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] p-1 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-overlay)]">
        <p aria-live="polite" className="px-2 py-1.5 text-[var(--pa-text-3)]" role="status">
          {status}
        </p>
        <button className={BUTTON} disabled={busy || isBakeActive(bake)} onClick={onStart} type="button">
          {bake === null ? 'Nướng ánh sáng' : 'Nướng lại'}
        </button>
        {bake?.status === 'done' ? (
          <button className={BUTTON} disabled={busy} onClick={previewing ? onHide : onView} type="button">
            {previewing ? 'Tắt ánh sáng nướng' : 'Xem ánh sáng nướng'}
          </button>
        ) : null}
      </div>
    </details>
  );
}

export interface BakeLightingCardProps {
  readonly projectId: string;
  readonly exportGlb: () => Promise<Blob | null>;
}

export function BakeLightingCard({ projectId, exportGlb }: BakeLightingCardProps) {
  const state = useLightingBake(projectId, exportGlb);
  return (
    <BakeLightingView
      bake={state.bake}
      busy={state.busy}
      error={state.error}
      onHide={state.hide}
      onStart={state.start}
      onView={state.view}
      previewing={state.previewing}
    />
  );
}
