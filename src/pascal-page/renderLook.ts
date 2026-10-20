/**
 * Dáng render ấm cho trang 3D: đè chủ đề `night` của Pascal tại chỗ (Pascal không cho thêm
 * chủ đề mới — `SCENE_THEME_BY_ID` riêng tư, id lạ rơi về `studio`) và chỉnh SSGI. `main.tsx`
 * gọi một lần trước khi vẽ, truyền đúng hai đối tượng thật của Pascal; tệp này không nhập
 * `@pascal-app/*` để vitest chạy được. Giữ `appearance: 'dark'` (đèn trong nhà chỉ bật ở chủ
 * đề tối). Màu ở `RENDER_LOOK_PALETTE`, số ở đây.
 */
import { RENDER_LOOK_PALETTE as C } from '@/lib/pascal/scenePalette';

/** Phần của `SceneTheme` (viewer/src/lib/scene-themes.ts) mà dáng này đè. */
export interface RenderLookTheme {
  background: string;
  backgroundSky?: string;
  ground: string;
  ambient: { color: string; intensity: number };
  hemi?: { sky: string; ground: string; intensity: number };
  lights: Array<{ position: [number, number, number]; color: string; intensity: number; castShadow?: boolean }>;
  toneMappingExposure: number;
  clayTints?: Partial<Record<'wall' | 'floor' | 'ceiling' | 'roof' | 'glazing', string>>;
}

/** Phần của `SSGI_PARAMS` (viewer post-processing.tsx) mà dáng này đè. */
export interface RenderLookSsgi {
  sliceCount: number;
  stepCount: number;
  radius: number;
}

// Đèn chính cao, chếch như nắng chiều (đổ bóng); đèn phụ ấm, yếu, phía đối diện.
const KEY_POSITION: [number, number, number] = [12, 30, 16];
const FILL_POSITION: [number, number, number] = [-12, 12, -10];
// SSGI: 2 lát × 6 bước, bán kính 2 m — AO rõ hơn ở góc tường, tốn thêm ≈ 2–3 ms (Q2).
const SSGI = { sliceCount: 2, stepCount: 6, radius: 2 } as const;

/** Đè tại chỗ; gọi lại nhiều lần cũng ra cùng giá trị. */
export function applyRenderLook(theme: RenderLookTheme, ssgi: RenderLookSsgi): void {
  Object.assign(theme, {
    background: C.background,
    backgroundSky: C.sky,
    ground: C.ground,
    ambient: { color: C.ambient, intensity: 0.5 },
    hemi: { sky: C.hemiSky, ground: C.hemiGround, intensity: 0.45 },
    lights: [
      { position: [...KEY_POSITION], color: C.key, intensity: 1.6, castShadow: true },
      { position: [...FILL_POSITION], color: C.fill, intensity: 0.3 },
    ],
    toneMappingExposure: 0.86,
    clayTints: {
      wall: C.clayWall,
      floor: C.clayFloor,
      ceiling: C.clayCeiling,
      roof: C.clayRoof,
      glazing: C.clayGlazing,
    },
  } satisfies RenderLookTheme);
  Object.assign(ssgi, SSGI);
}
