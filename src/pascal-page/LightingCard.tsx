/**
 * Thẻ "Ánh sáng" của trang 3D, cạnh "Phong cách": Buổi tối (chủ đề `night` đã chỉnh, đèn trong
 * nhà bật — mặc định), Ban ngày (chủ đề sáng đã chỉnh, nắng qua cửa sổ, đèn tắt) hoặc Nắng chiều
 * (chủ đề `sunset`, mặt trời thấp ~15°, ấm). Độc lập
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

import { QualityCard } from './QualityCard';
import { type GroundMode, useRealism } from './realism/store';
import { DAY_THEME_ID, NIGHT_THEME_ID, SUNSET_THEME_ID } from './renderLook';

export type LightingMode = 'night' | 'day' | 'sunset';

export const LIGHTING_MODES: readonly { id: LightingMode; label: string; theme: string }[] = [
  { id: 'night', label: 'Buổi tối', theme: NIGHT_THEME_ID },
  { id: 'day', label: 'Ban ngày', theme: DAY_THEME_ID },
  { id: 'sunset', label: 'Nắng chiều', theme: SUNSET_THEME_ID },
];

export const lightingKey = (projectId: string): string => `appfront.pascal.lighting.v1:${projectId}`;

/**
 * Mặt đất quanh nhà (chỉ chủ đề sáng): dự án không cho biết chung cư hay nhà mặt đất, nên để người
 * dùng chọn; mặc định nền trơn (căn hộ trên tầng không có bãi cỏ). Nhớ theo dự án như ánh sáng.
 */
export const GROUND_MODES: readonly { id: GroundMode; label: string }[] = [
  { id: 'plain', label: 'Nền trơn' },
  { id: 'gravel', label: 'Sân sỏi' },
  { id: 'grass', label: 'Bãi cỏ' },
];

export const groundKey = (projectId: string): string => `appfront.pascal.ground.v1:${projectId}`;

function readGround(projectId: string): GroundMode {
  try {
    const value = localStorage.getItem(groundKey(projectId));
    return GROUND_MODES.find((m) => m.id === value)?.id ?? 'plain';
  } catch {
    return 'plain';
  }
}

/** Hướng nắng (độ xoay quanh trục đứng, 0 = mặc định của chủ đề). Nhớ theo dự án như mặt đất. */
export const sunKey = (projectId: string): string => `appfront.pascal.sun.v1:${projectId}`;

function readSun(projectId: string): number {
  try {
    const value = Number(localStorage.getItem(sunKey(projectId)) ?? 0);
    return Number.isFinite(value) ? ((Math.round(value) % 360) + 360) % 360 : 0;
  } catch {
    return 0;
  }
}

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
    return LIGHTING_MODES.some((m) => m.id === value) ? (value as LightingMode) : null;
  } catch {
    return null;
  }
}

export function LightingCard({ projectId, useViewer }: LightingCardProps) {
  const sceneTheme = useViewer((state) => state.sceneTheme);
  const current = LIGHTING_MODES.find((m) => m.theme === sceneTheme);
  const ground = useRealism((s) => s.ground);
  const sunAzimuth = useRealism((s) => s.sunAzimuth);

  useEffect(() => {
    useRealism.setState({ ground: readGround(projectId), sunAzimuth: readSun(projectId) });
  }, [projectId]);

  const chooseSun = (deg: number) => {
    useRealism.setState({ sunAzimuth: deg });
    try {
      if (deg === 0) localStorage.removeItem(sunKey(projectId));
      else localStorage.setItem(sunKey(projectId), String(deg));
    } catch {
      // Bộ nhớ bị chặn: đổi trong phiên này.
    }
  };

  const chooseGround = (mode: GroundMode) => {
    useRealism.setState({ ground: mode });
    try {
      localStorage.setItem(groundKey(projectId), mode);
    } catch {
      // Bộ nhớ bị chặn: đổi trong phiên này.
    }
  };

  // Lúc mở: áp lựa chọn của dự án. Chưa chọn thì giữ chủ đề đang có, trừ "Ban ngày" mang sang
  // / "Nắng chiều" từ dự án khác (chủ đề Pascal nhớ chung một khoá) — về mặc định Buổi tối.
  useEffect(() => {
    const viewer = useViewer.getState();
    const stored = readMode(projectId);
    if (stored !== null) viewer.setSceneTheme(themeOf(stored));
    else if (viewer.sceneTheme === DAY_THEME_ID || viewer.sceneTheme === SUNSET_THEME_ID) viewer.setSceneTheme(NIGHT_THEME_ID);
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

  // F3: thẻ "Chất lượng" đặt ngay sau thẻ này (cùng hàng nút).
  return (
    <>
    <details className="relative" data-appfront-menu="">
      <summary
        aria-label={`Ánh sáng: ${current?.label ?? 'tuỳ chỉnh'} — mở danh sách ánh sáng`}
        className="flex h-8 shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] px-2.5 font-medium text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)] transition-colors duration-[120ms] hover:bg-[var(--pa-sunken)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)] [&::-webkit-details-marker]:hidden"
        title="Ánh sáng"
      >
        <Sun aria-hidden="true" className="h-4 w-4 shrink-0 @min-[1300px]/appbar:hidden" />
        <span className="hidden @min-[1300px]/appbar:inline">Ánh sáng</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)] @max-[720px]/appbar:hidden" />
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
        <li aria-hidden="true" className="mx-2 my-1 border-t border-[var(--pa-border)]" />
        <li className="px-2 pt-1 pb-0.5 text-[11px] text-[var(--pa-text-3)]">Mặt đất (Ban ngày, Nắng chiều)</li>
        <li>
          <ul aria-label="Mặt đất">
            {GROUND_MODES.map((mode) => (
              <li key={mode.id}>
                <button
                  aria-pressed={mode.id === ground}
                  className="flex h-8 w-full items-center whitespace-nowrap rounded-lg px-2 text-left text-[var(--pa-text-2)] transition-colors duration-[120ms] hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)] aria-pressed:bg-[var(--pa-selected)] aria-pressed:font-medium aria-pressed:text-[var(--pa-accent)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pa-accent)]"
                  onClick={() => chooseGround(mode.id)}
                  type="button"
                >
                  {mode.label}
                </button>
              </li>
            ))}
          </ul>
        </li>
        <li aria-hidden="true" className="mx-2 my-1 border-t border-[var(--pa-border)]" />
        <li className="px-2 pt-1 pb-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--pa-text-3)]">
            <label htmlFor={`sun-${projectId}`}>Hướng nắng: {sunAzimuth}°</label>
            <button
              className="rounded px-1 text-[var(--pa-text-2)] hover:text-[var(--pa-text)] disabled:opacity-40 outline-none focus-visible:outline-2 focus-visible:outline-[var(--pa-accent)]"
              disabled={sunAzimuth === 0}
              onClick={() => chooseSun(0)}
              type="button"
            >
              Mặc định
            </button>
          </div>
          <input
            className="mt-1 w-full accent-[var(--pa-accent)]"
            id={`sun-${projectId}`}
            max={359}
            min={0}
            onChange={(event) => chooseSun(Number(event.currentTarget.value))}
            step={1}
            type="range"
            value={sunAzimuth}
          />
        </li>
      </ul>
    </details>
    <QualityCard />
    </>
  );
}
