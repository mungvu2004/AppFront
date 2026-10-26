/**
 * Thẻ "Chất lượng" của trang 3D, cạnh "Ánh sáng": Tự động / Thấp / Vừa / Cao → `setTierMode`
 * (`./realism/tiers`, nhớ theo máy trong localStorage). Tự động thì nhãn kèm mức đang dùng
 * ("Tự động · Thấp"). Cùng kiểu thẻ với `LightingCard`.
 *
 * Dùng `aria-current` (không `aria-pressed`) để không lẫn với nút đang chọn của thẻ Ánh sáng.
 */
/* eslint-disable react-refresh/only-export-components -- bảng nhãn đi kèm thẻ để test dùng. */
import { ChevronDown, Gauge } from 'lucide-react';
import type { MouseEvent } from 'react';

import { useRealism, type RealismTier } from './realism/store';
import { setTierMode } from './realism/tiers';

type TierMode = 'auto' | RealismTier;

export const QUALITY_MODES: readonly { id: TierMode; label: string }[] = [
  { id: 'auto', label: 'Tự động' },
  { id: 'low', label: 'Thấp' },
  { id: 'medium', label: 'Vừa' },
  { id: 'high', label: 'Cao' },
];

const labelOf = (id: TierMode) => QUALITY_MODES.find((m) => m.id === id)?.label ?? id;

export function qualityLabel(mode: TierMode, tier: RealismTier): string {
  return mode === 'auto' ? `${labelOf('auto')} · ${labelOf(tier)}` : labelOf(mode);
}

export function QualityCard() {
  const mode = useRealism((s) => s.tierMode);
  const tier = useRealism((s) => s.tier);
  const label = qualityLabel(mode, tier);

  const choose = (id: TierMode, event: MouseEvent<HTMLButtonElement>) => {
    setTierMode(id);
    event.currentTarget.closest('details')?.removeAttribute('open');
  };

  return (
    <details className="relative" data-appfront-menu="">
      <summary
        aria-label={`Chất lượng: ${label} — mở danh sách mức chất lượng`}
        className="flex h-8 shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] px-2.5 font-medium text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)] transition-colors duration-120 hover:bg-[var(--pa-sunken)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)] [&::-webkit-details-marker]:hidden"
        title={`Chất lượng: ${label}`}
      >
        <Gauge aria-hidden="true" className="h-4 w-4 shrink-0 @min-[1300px]/appbar:hidden" />
        <span className="hidden @min-[1300px]/appbar:inline">Chất lượng</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)] @max-[720px]/appbar:hidden" />
      </summary>
      <ul
        aria-label="Danh sách mức chất lượng"
        className="absolute top-full left-0 z-50 mt-1 min-w-36 rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] p-1 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-overlay)]"
      >
        {QUALITY_MODES.map((m) => (
          <li key={m.id}>
            <button
              aria-current={m.id === mode ? 'true' : undefined}
              className="flex h-8 w-full items-center whitespace-nowrap rounded-lg px-2 text-left text-[var(--pa-text-2)] transition-colors duration-120 hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)] aria-[current=true]:bg-[var(--pa-selected)] aria-[current=true]:font-medium aria-[current=true]:text-[var(--pa-accent)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pa-accent)]"
              onClick={(event) => choose(m.id, event)}
              type="button"
            >
              {m.id === 'auto' && mode === 'auto' ? label : m.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
