/**
 * Ảnh vật liệu thư viện: nạp sẵn lúc mở cảnh + đợi nạp xong mà không thăm dò.
 *
 * Vendor `viewer/src/lib/materials.ts` (queueTextureAssignment) đếm số ảnh đang nạp nguội ở
 * `material.userData.texPending`, gán mọi map một lượt khi đếm về 0 rồi phát sự kiện
 * `texturesready` trên vật liệu. three r186 lấy việc khe có ảnh hay không làm khoá node → gán
 * từng map một là dựng lại pipeline mỗi lần; nạp sẵn để lần tạo vật liệu trúng cache đồng bộ.
 */
import type { EventDispatcher, Material } from 'three';

type ReadyTarget = EventDispatcher<{ texturesready: object }>;

/** Thời gian chờ tối đa (bằng mức thử lại cũ 40 × 250 ms): bản clone lạ mang đếm cũ không bao giờ nhận sự kiện. */
const READY_TIMEOUT_MS = 10_000;

/** Vật liệu còn ảnh đang nạp (khe ảnh còn trống) — warm-up nên bỏ qua, khoá node sẽ đổi. */
export function hasPendingTextures(material: Material | null | undefined): boolean {
  return ((material?.userData.texPending as number | undefined) ?? 0) > 0;
}

/** Xong khi vật liệu hết ảnh đang nạp; vật liệu không chờ gì → xong ngay. */
export function whenTexturesReady(material: Material): Promise<void> {
  if (!hasPendingTextures(material)) return Promise.resolve();
  return new Promise((resolve) => {
    const target = material as unknown as ReadyTarget;
    const done = () => {
      clearTimeout(timer);
      target.removeEventListener('texturesready', done);
      resolve();
    };
    const timer = setTimeout(done, READY_TIMEOUT_MS);
    target.addEventListener('texturesready', done);
  });
}

/** Mọi chuỗi `library:<id>` trong JSON cảnh (vật liệu node, nodeSlots của món, …). */
export function libraryRefsIn(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (value.startsWith('library:')) out.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) libraryRefsIn(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) libraryRefsIn(v, out);
  }
  return out;
}

/**
 * Tạo sẵn vật liệu cho mọi ref thư viện trong cảnh (vendor cache theo preset → cảnh dùng lại
 * đúng vật liệu này) để ảnh bắt đầu nạp ngay; xong khi mọi ảnh đã gán. `create` = vendor
 * `createMaterialFromPresetRef` (truyền vào để file này không kéo cả viewer). ktx2 tự đợi
 * `whenKtx2Ready` trong vendor; ref chưa đăng ký (mtl_* tải sau) → null, bỏ qua.
 */
export function preloadSceneTextures(
  scene: unknown,
  create: (ref: string) => Material | null,
  extraRefs: Iterable<string> = [],
): Promise<void> {
  const refs = libraryRefsIn(scene);
  for (const ref of extraRefs) refs.add(ref);
  const waits: Promise<void>[] = [];
  for (const ref of refs) {
    const material = create(ref);
    if (material) waits.push(whenTexturesReady(material));
  }
  return Promise.all(waits).then(() => undefined);
}
