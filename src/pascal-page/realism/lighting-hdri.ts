/**
 * R4: nạp HDRI sau khi cảnh đã lên, đặt làm `scene.environment` cho chủ đề sáng. Vendor
 * `scene-environment.tsx` gọi qua `@pascal-realism/lighting-hdri` (vá `scripts/realism/r4-lighting.mjs`).
 * Lỗi / quá 10 s / không WebGPU / cờ tắt → giữ nguyên môi trường cũ.
 */
import { EquirectangularReflectionMapping, FloatType, type Scene, type Texture } from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

import { HDRI_SCALE, HDRI_TIMEOUT_MS, HDRI_VARIANT, type HdriVariant, hdriAutoScale, hdriUrlFor, mixGradient, shouldLoadHdri } from './lighting';
import { setHdriSky } from './reflect';
import { useRealism } from './store';

/** Trả hàm dọn (gỡ HDRI, trả môi trường cũ). `themeId` chọn HDRI (Ban ngày khác Nắng chiều, gói 2B). */
export function installHdri(scene: Scene, appearance: string, themeId = ''): () => void {
  const { backend, flags } = useRealism.getState();
  // `?hdri=pure|gradient|off` để chấm mù hai biến thể (không có = HDRI_VARIANT).
  const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('hdri');
  if (asked === 'off' || !shouldLoadHdri({ backend, flag: flags.hdri, appearance })) return () => {};
  const variant: HdriVariant = asked === 'pure' || asked === 'gradient' ? asked : HDRI_VARIANT;
  let done = false;
  let hdr: Texture | null = null;
  let previous: Scene['environment'] = null;
  const timer = setTimeout(() => {
    if (!hdr) done = true;
  }, HDRI_TIMEOUT_MS);
  // "Sau khi cảnh sẵn sàng": đợi trình duyệt rảnh (vật liệu/mô hình đã đòi xong) rồi mới tải.
  const idle = (cb: () => void) =>
    typeof requestIdleCallback === 'function' ? requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 1000);
  idle(() => {
    if (done) return;
    new HDRLoader().setDataType(FloatType).load(
      hdriUrlFor(themeId),
      (texture) => {
        if (done) return texture.dispose();
        clearTimeout(timer);
        const { data, width, height } = texture.image as { data: Float32Array; width: number; height: number };
        mixGradient(data, width, height, variant === 'gradient' ? undefined : 0, hdriAutoScale(data, width, height) * HDRI_SCALE);
        texture.mapping = EquirectangularReflectionMapping;
        texture.needsUpdate = true;
        hdr = texture;
        previous = scene.environment;
        scene.environment = texture;
        // Phông trời qua kính + ảnh chụp phản chiếu dùng cùng HDRI.
        setHdriSky(texture);
      },
      undefined,
      (error) => console.warn('[pascal-realism] HDRI không tải được, giữ môi trường cũ', error),
    );
  });
  return () => {
    done = true;
    clearTimeout(timer);
    if (hdr && scene.environment === hdr) scene.environment = previous;
    if (hdr) setHdriSky(null);
    hdr?.dispose();
  };
}
