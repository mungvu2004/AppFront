/**
 * Lượt bóng của three (WebGPU) vẽ mọi group của mesh đa vật liệu bằng MỘT override material dùng chung,
 * và `RenderObjects.get` khoá theo (object, material, renderContext, lightsNode) — không có group.
 * Nên tường (mảng ~11 vật liệu, lẫn đặc/trong suốt, Lambert/Standard) và item đa vật liệu dùng chung
 * một RenderObject cho mọi group; mỗi group chép `transparent`/`side`/colorNode khác nhau lên override
 * → cache key lật giữa khung → `dispose()` huỷ bindingBuffer mà lệnh vẽ group trước còn dùng
 * ("used in submit while destroyed"). Cho mỗi group một passId riêng trong lượt bóng → RenderObject
 * riêng, key ổn định. Không đổi hình ảnh. Vendor gọi qua luật `scripts/realism/r1-backend.mjs`.
 */
interface Scene { overrideMaterial?: { isShadowPassMaterial?: boolean } | null }
type Group = { materialIndex?: number } | null | undefined;

/** passId cho một lần vẽ: lượt bóng + mesh mảng vật liệu → tách theo materialIndex; còn lại giữ nguyên. */
export function shadowGroupPassId(scene: Scene, object: { material?: unknown }, group: Group, passId: string | null | undefined): string | null | undefined {
  if (scene.overrideMaterial?.isShadowPassMaterial !== true || !group || !Array.isArray(object.material)) return passId;
  // ponytail: nhánh 'backSide' (override trong suốt + DoubleSide) của three vẫn dùng chung passId cứng.
  return `${passId ?? ''}|shadow-g${group.materialIndex ?? 0}`;
}

type RenderObjectFn = (object: { material?: unknown }, scene: Scene, camera: unknown, geometry: unknown, material: unknown, group: Group, lightsNode: unknown, clippingContext?: unknown, passId?: string | null) => void;

/** Bọc `renderer.renderObject` (một lần mỗi renderer). */
export function keyShadowGroups(renderer: unknown): void {
  const r = renderer as { renderObject?: RenderObjectFn; __shadowGroups?: true } | null | undefined;
  if (!r || typeof r.renderObject !== 'function' || r.__shadowGroups) return;
  const orig = r.renderObject;
  r.renderObject = function (this: unknown, object, scene, camera, geometry, material, group, lightsNode, clippingContext = null, passId = null) {
    return orig.call(this, object, scene, camera, geometry, material, group, lightsNode, clippingContext, shadowGroupPassId(scene, object, group, passId));
  };
  r.__shadowGroups = true;
}
