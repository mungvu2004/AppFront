/**
 * Thẻ "Chất lượng" của trang 3D, cạnh "Ánh sáng": Tự động / Thấp / Vừa / Cao → `setTierMode`
 * (`./realism/tiers`, nhớ theo máy trong localStorage). Tự động thì nhãn kèm mức đang dùng
 * ("Tự động · Thấp"). Cùng kiểu thẻ với `LightingCard`.
 *
 * Dùng `aria-current` (không `aria-pressed`) để không lẫn với nút đang chọn của thẻ Ánh sáng.
 *
 * Lỗi đặt đồ (C7) đã tách ra chip riêng `./PlacementIssuesChip`.
 */
/* eslint-disable react-refresh/only-export-components -- bảng nhãn đi kèm thẻ để test dùng. */
import { ChevronDown, Gauge } from 'lucide-react';
import type { MouseEvent } from 'react';

import { MENU_SUMMARY_CLASS, menuPanelClass, SECTION_TITLE_CLASS, useMenuGroup } from './menuGroup';
import { useRealism, type RealismTier } from './realism/store';
import { setTierMode } from './realism/tiers';

type TierMode = 'auto' | RealismTier;

/** `hint`: tên đọc được của nút (L2/L1-13: trình đọc màn hình chỉ nghe "Thấp", "Cao" mà không biết là gì). */
export const QUALITY_MODES: readonly { id: TierMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Tự động', hint: 'Chất lượng hình tự chọn theo máy' },
  { id: 'low', label: 'Thấp', hint: 'Chất lượng hình thấp, chạy mượt trên máy yếu' },
  { id: 'medium', label: 'Vừa', hint: 'Chất lượng hình vừa' },
  { id: 'high', label: 'Cao', hint: 'Chất lượng hình cao, đẹp hơn nhưng nặng máy' },
];

const labelOf = (id: TierMode) => QUALITY_MODES.find((m) => m.id === id)?.label ?? id;

export function qualityLabel(mode: TierMode, tier: RealismTier): string {
  return mode === 'auto' ? `${labelOf('auto')} · ${labelOf(tier)}` : labelOf(mode);
}

/** `section`: mục trong menu "Xem" (`./ViewMenu`) thay vì menu riêng. */
export function QualityCard({ section = false }: { readonly section?: boolean } = {}) {
  useMenuGroup();
  const mode = useRealism((s) => s.tierMode);
  const tier = useRealism((s) => s.tier);
  const label = qualityLabel(mode, tier);

  const choose = (id: TierMode, event: MouseEvent<HTMLButtonElement>) => {
    setTierMode(id);
    event.currentTarget.closest('details')?.removeAttribute('open');
  };

  const list = (
      <ul
        aria-label="Danh sách mức chất lượng"
        className={menuPanelClass(section)}
      >
        {QUALITY_MODES.map((m) => (
          <li key={m.id}>
            <button
              aria-current={m.id === mode ? 'true' : undefined}
              aria-label={m.id === 'auto' && mode === 'auto' ? `${m.hint} (đang dùng: ${labelOf(tier)})` : m.hint}
              className="flex h-8 w-full items-center whitespace-nowrap rounded-lg px-2 text-left text-[var(--pa-text-2)] transition-colors duration-120 hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)] aria-[current=true]:bg-[var(--pa-selected)] aria-[current=true]:font-medium aria-[current=true]:text-[var(--pa-accent)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pa-accent)]"
              onClick={(event) => choose(m.id, event)}
              title={m.hint}
              type="button"
            >
              {m.id === 'auto' && mode === 'auto' ? label : m.label}
            </button>
          </li>
        ))}
        <li className="px-2 pt-0.5 pb-1.5 text-[12px] text-[var(--pa-text-3)]">Chỉ lưu trên máy này</li>
      </ul>
  );
  if (section) {
    return (
      <section aria-label="Chất lượng hình">
        <h3 className={SECTION_TITLE_CLASS}>Chất lượng hình</h3>
        {list}
      </section>
    );
  }
  return (
    <details className="relative" data-appfront-menu="">
      <summary
        aria-label={`Chất lượng: ${label} — mở danh sách mức chất lượng`}
        className={MENU_SUMMARY_CLASS}
        title={`Chất lượng: ${label}`}
      >
        <Gauge aria-hidden="true" className="h-4 w-4 shrink-0 @min-[1600px]/appbar:hidden" />
        <span className="hidden @min-[1600px]/appbar:inline">Chất lượng</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)] @max-[1200px]/appbar:hidden" />
      </summary>
      {list}
    </details>
  );
}
