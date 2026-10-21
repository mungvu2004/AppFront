/**
 * Thẻ "Ánh sáng" của trang 3D, cạnh "Phong cách": Buổi tối (chủ đề `night` đã chỉnh, đèn trong
 * nhà bật — mặc định) hoặc Ban ngày (chủ đề sáng đã chỉnh, nắng qua cửa sổ, đèn tắt). Độc lập
 * với sáng/tối của áo trang (`./chromeTheme`). Số đèn ở `./renderLook`.
 *
 * Đổi = `viewer.setSceneTheme` (tức thì, không nạp lại). Nhớ THEO DỰ ÁN trên máy này
 * (`localStorage`, không gửi lên máy chủ), như khoá xem thử của "Phong cách".
 *
 * Không nhập `@pascal-app/*` (vitest không nạp được gói chưa dựng): `main.tsx` truyền `useViewer`.
 */
/* eslint-disable react-refresh/only-export-components -- hằng/khoá đi kèm thẻ để test dùng. */
import { ChevronDown, Sun } from 'lucide-react';
import { type MouseEvent, useEffect } from 'react';

import { DAY_THEME_ID, NIGHT_THEME_ID } from './renderLook';

export type LightingMode = 'night' | 'day';

export const LIGHTING_MODES: readonly { id: LightingMode; label: string; theme: string }[] = [
  { id: 'night', label: 'Buổi tối', theme: NIGHT_THEME_ID },
  { id: 'day', label: 'Ban ngày', theme: DAY_THEME_ID },
];

export const lightingKey = (projectId: string): string => `appfront.pascal.lighting.v1:${projectId}`;

interface LightingViewer {
  sceneTheme: string;
  setSceneTheme: (id: string) => void;
}

export interface LightingCardProps {
  readonly projectId: string;
  readonly useViewer: {
    <T>(selector: (state: LightingViewer) => T): T;
    getState(): LightingViewer;
  };
}

const themeOf = (mode: LightingMode) => LIGHTING_MODES.find((m) => m.id === mode)?.theme ?? NIGHT_THEME_ID;

function readMode(projectId: string): LightingMode | null {
  try {
    const value = localStorage.getItem(lightingKey(projectId));
    return value === 'night' || value === 'day' ? value : null;
  } catch {
    return null;
  }
}

export function LightingCard({ projectId, useViewer }: LightingCardProps) {
  const sceneTheme = useViewer((state) => state.sceneTheme);
  const current = LIGHTING_MODES.find((m) => m.theme === sceneTheme);

  // Lúc mở: áp lựa chọn của dự án. Chưa chọn thì giữ chủ đề đang có, trừ "Ban ngày" mang sang
  // từ dự án khác (chủ đề Pascal nhớ chung một khoá) — về mặc định Buổi tối.
  useEffect(() => {
    const viewer = useViewer.getState();
    const stored = readMode(projectId);
    if (stored !== null) viewer.setSceneTheme(themeOf(stored));
    else if (viewer.sceneTheme === DAY_THEME_ID) viewer.setSceneTheme(NIGHT_THEME_ID);
  }, [projectId, useViewer]);

  const choose = (mode: LightingMode, event: MouseEvent<HTMLButtonElement>) => {
    useViewer.getState().setSceneTheme(themeOf(mode));
    try {
      localStorage.setItem(lightingKey(projectId), mode);
    } catch {
      // Bộ nhớ bị chặn: đổi trong phiên này, lần sau về mặc định.
    }
    event.currentTarget.closest('details')?.removeAttribute('open');
  };

  return (
    <details className="relative" data-appfront-menu="">
      <summary
        aria-label={`Ánh sáng: ${current?.label ?? 'tuỳ chỉnh'} — mở danh sách ánh sáng`}
        className="flex h-8 shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] px-2.5 font-medium text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)] transition-colors duration-[120ms] hover:bg-[var(--pa-sunken)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)] [&::-webkit-details-marker]:hidden"
        title="Ánh sáng"
      >
        <Sun aria-hidden="true" className="h-4 w-4 shrink-0 @min-[1300px]/appbar:hidden" />
        <span className="hidden @min-[1300px]/appbar:inline">Ánh sáng</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)]" />
      </summary>
      <ul
        aria-label="Danh sách ánh sáng"
        className="absolute top-full left-0 z-50 mt-1 min-w-36 rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] p-1 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-overlay)]"
      >
        {LIGHTING_MODES.map((mode) => (
          <li key={mode.id}>
            <button
              aria-pressed={mode === current}
              className="flex h-8 w-full items-center whitespace-nowrap rounded-lg px-2 text-left text-[var(--pa-text-2)] transition-colors duration-[120ms] hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)] aria-pressed:bg-[var(--pa-selected)] aria-pressed:font-medium aria-pressed:text-[var(--pa-accent)] disabled:opacity-50 motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pa-accent)]"
              onClick={(event) => choose(mode.id, event)}
              type="button"
            >
              {mode.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
