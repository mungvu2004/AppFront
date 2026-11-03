/**
 * R4: HDRI cho chủ đề sáng. Vendor `scene-environment.tsx` gọi qua `@pascal-realism/lighting-hdri`
 * (vá `scripts/realism/r4-lighting.mjs`). Lỗi / quá 10 s / không WebGPU / cờ tắt → giữ nguyên môi trường cũ.
 *
 * Tốc độ mở trang: đổi `scene.environment` sau lượt vẽ đầu làm three tạo nút môi trường MỚI (id mới) →
 * khoá cache của mọi RenderObject có ánh sáng đổi → dựng lại + biên dịch lại pipeline (25–40/75 lượt).
 * Nên cài MỘT `PMREMNode` làm `scene.environmentNode` ngay lúc cài (giữ trời gradient), HDRI về thì chỉ
 * đổi `envNode.value` — PMREM tính lại, không vật liệu nào dựng lại. Byte HDRI tải từ lúc mở trang
 * (`prefetchHdri` trong `main.tsx`), không còn đợi trình duyệt rảnh.
 */
import { EquirectangularReflectionMapping, FileLoader, FloatType, type Scene, type Texture } from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { pmremTexture } from 'three/tsl';

import { HDRI_SCALE, HDRI_TIMEOUT_MS, HDRI_VARIANT, type HdriVariant, hdriAutoScale, hdriUrlFor, mixGradient, shouldLoadHdri } from './lighting';
import { makeSkyTexture, setHdriSky } from './reflect';
import { useRealism } from './store';

/** `?hdri=pure|gradient|off` để chấm mù hai biến thể (không có = HDRI_VARIANT). */
const askedHdri = () => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('hdri'));

const buffers = new Map<string, Promise<ArrayBuffer>>();

/** Byte thô của HDRI theo chủ đề, tải một lần (đổi chủ đề qua lại không tải lại). Lỗi → lần sau thử lại. */
function hdriBytes(themeId: string): Promise<ArrayBuffer> {
  const url = hdriUrlFor(themeId);
  let pending = buffers.get(url);
  if (!pending) {
    pending = new FileLoader().setResponseType('arraybuffer').loadAsync(url) as Promise<ArrayBuffer>;
    pending.catch(() => buffers.delete(url));
    buffers.set(url, pending);
  }
  return pending;
}

/**
 * Gọi lúc mở trang: tải trước HDRI nếu chủ đề hiện tại sẽ dùng. Backend thật chưa biết (renderer chưa
 * init) → coi `navigator.gpu` là WebGPU; đoán sai chỉ tốn một lượt tải ~1 MB.
 */
export function prefetchHdri(themeId: string, appearance: string): void {
  const gpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const flag = useRealism.getState().flags.hdri;
  if (askedHdri() === 'off' || !shouldLoadHdri({ backend: gpu ? 'webgpu' : 'webgl', flag, appearance })) return;
  hdriBytes(themeId).catch(() => {});
}

/** Trả hàm dọn (gỡ HDRI, trả môi trường cũ). `themeId` chọn HDRI (Ban ngày khác Nắng chiều, gói 2B). */
export function installHdri(scene: Scene, appearance: string, themeId = ''): () => void {
  const { backend, flags } = useRealism.getState();
  const asked = askedHdri();
  if (asked === 'off' || !shouldLoadHdri({ backend, flag: flags.hdri, appearance })) return () => {};
  const variant: HdriVariant = asked === 'pure' || asked === 'gradient' ? asked : HDRI_VARIANT;
  let done = false;
  let hdr: Texture | null = null;
  let sky: Texture | null = null;
  const previousNode = scene.environmentNode;
  // Nút môi trường cố định từ lượt vẽ đầu: bọc trời gradient vendor đang đặt ở `scene.environment`.
  let envNode = scene.environment ? pmremTexture(scene.environment) : null;
  if (envNode) scene.environmentNode = envNode;
  const timer = setTimeout(() => {
    if (!hdr) done = true;
  }, HDRI_TIMEOUT_MS);
  const warn = (error: unknown) => console.warn('[pascal-realism] HDRI không tải được, giữ môi trường cũ', error);
  hdriBytes(themeId).then((buffer) => {
    if (done) return;
    // Blob URL giữ nguyên cách HDRLoader dựng texture (lọc, lật, không mipmap).
    const url = URL.createObjectURL(new Blob([buffer]));
    new HDRLoader().setDataType(FloatType).load(
      url,
      (texture) => {
        URL.revokeObjectURL(url);
        if (done) return texture.dispose();
        clearTimeout(timer);
        const { data, width, height } = texture.image as { data: Float32Array; width: number; height: number };
        const scale = hdriAutoScale(data, width, height) * HDRI_SCALE;
        // Phông trời qua kính dùng bản thuần (chép trước khi pha gradient).
        sky = makeSkyTexture(data.slice(), width, height, scale);
        mixGradient(data, width, height, variant === 'gradient' ? undefined : 0, scale);
        texture.mapping = EquirectangularReflectionMapping;
        texture.needsUpdate = true;
        hdr = texture;
        // Cùng nút → khoá cache vật liệu không đổi; không có trời cũ thì đặt nút lần đầu (như trước).
        if (envNode) envNode.value = texture;
        else scene.environmentNode = envNode = pmremTexture(texture);
        setHdriSky(sky);
      },
      undefined,
      (error) => {
        URL.revokeObjectURL(url);
        warn(error);
      },
    );
  }, warn);
  return () => {
    done = true;
    clearTimeout(timer);
    if (envNode && scene.environmentNode === envNode) scene.environmentNode = previousNode;
    envNode?.dispose();
    if (sky) setHdriSky(null);
    hdr?.dispose();
    sky?.dispose();
  };
}
