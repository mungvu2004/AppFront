/**
 * Dáng render ấm cho trang 3D: đè chủ đề `night` của Pascal tại chỗ (Pascal không cho thêm
 * chủ đề mới — `SCENE_THEME_BY_ID` riêng tư, id lạ rơi về `studio`) và chỉnh SSGI. `main.tsx`
 * gọi một lần trước khi vẽ, truyền đúng hai đối tượng thật của Pascal; tệp này không nhập
 * `@pascal-app/*` để vitest chạy được. Giữ `appearance: 'dark'` (đèn trong nhà chỉ bật ở chủ
 * đề tối). Màu ở `RENDER_LOOK_PALETTE`, số ở đây.
 *
 * Hai bậc chất lượng (FE3D-FIX-004 thẻ R): có WebGPU thì Pascal dựng chuỗi hậu kỳ (SSGI có
 * GI dội + AO, bloom, vignette — `scripts/pascal-render.mjs`), nên ánh sáng nền hạ thấp cho góc
 * tối và vũng đèn ấm, phần dội để GI lo. Không có WebGPU (WebGL2) thì không có hậu kỳ: không
 * GI/AO bù, nên giữ ánh sáng nền cao hơn để nhà không tối om.
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
  giIntensity: number;
}

// Đèn chính cao, chếch như nắng chiều (đổ bóng); đèn phụ ấm, yếu, phía đối diện.
const KEY_POSITION: [number, number, number] = [12, 30, 16];
const FILL_POSITION: [number, number, number] = [-12, 12, -10];

/** Số của từng bậc; `high` = có WebGPU (hậu kỳ chạy), `low` = WebGL2 (không hậu kỳ). */
export const RENDER_LOOK_TIERS = {
  high: { ambient: 0.12, hemi: 0.15, key: 1.7, fill: 0.2, exposure: 0.8 },
  low: { ambient: 0.3, hemi: 0.3, key: 1.8, fill: 0.25, exposure: 0.85 },
} as const;

// SSGI: 2 lát × 8 bước, bán kính 2 m; GI 0.6 cho ánh dội từ sàn gỗ. GI của Pascal không qua
// khử nhiễu (chỉ AO qua), nên giữ GI vừa phải thay vì tăng lát. Chỉ chạy khi có WebGPU.
export const RENDER_LOOK_SSGI = { sliceCount: 2, stepCount: 8, radius: 2, giIntensity: 0.6 } as const;

/** Trình duyệt có WebGPU không (cùng phép thử Pascal dùng để bật hậu kỳ). */
export const hasWebGpu = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator;

/** Đè tại chỗ; gọi lại nhiều lần cũng ra cùng giá trị. */
export function applyRenderLook(theme: RenderLookTheme, ssgi: RenderLookSsgi, webgpu = hasWebGpu()): void {
  const t = RENDER_LOOK_TIERS[webgpu ? 'high' : 'low'];
  Object.assign(theme, {
    background: C.background,
    backgroundSky: C.sky,
    ground: C.ground,
    ambient: { color: C.ambient, intensity: t.ambient },
    hemi: { sky: C.hemiSky, ground: C.hemiGround, intensity: t.hemi },
    lights: [
      { position: [...KEY_POSITION], color: C.key, intensity: t.key, castShadow: true },
      { position: [...FILL_POSITION], color: C.fill, intensity: t.fill },
    ],
    toneMappingExposure: t.exposure,
    clayTints: {
      wall: C.clayWall,
      floor: C.clayFloor,
      ceiling: C.clayCeiling,
      roof: C.clayRoof,
      glazing: C.clayGlazing,
    },
  } satisfies RenderLookTheme);
  Object.assign(ssgi, RENDER_LOOK_SSGI);
}
