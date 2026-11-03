/**
 * Phần chạy của cắt thấp (`cut.ts`), gọi mỗi khung từ hệ tường vendor (luật `r10-cut.mjs`).
 * - Cắt: nhóm tầng (registry `level`) LUÔN là `ClippingGroup` bật của three 0.186 (WebGPURenderer chỉ cắt
 *   qua nhóm, cả nhánh WebGPU lẫn WebGL2) với một mặt phẳng. Đổi chế độ chỉ dời mặt phẳng: Cắt → sàn + 1,0 m
 *   (tường, vách, cửa, cửa sổ, đồ cao, trần bị cắt; đổ bóng cắt theo), chế độ khác → 1e6 m (không cắt gì).
 *   Không bao giờ lật `enabled`/số mặt phẳng/`clipIntersection`/`clipShadows`: các trường đó nằm trong khoá
 *   bộ nhớ đệm của ClippingContext → lật là mọi lưới của mọi tầng (cả lượt bóng) dựng lại (~20 s).
 * - Mặt cắt: vật liệu tường (lẻ + lưới gộp dùng chung mảng vật liệu) được vá MỘT LẦN lúc tạo
 *   (`capCutMaterial`, luật `r9y-cut-cap.mjs` trên `wall-materials.ts`): hai mặt cố định, mặt sau + mặt hướng
 *   lên (lòng tường lộ qua mặt cắt) tô PHẲNG màu nắp sáng khi uniform `cutOn` = 1. Đổi chế độ chỉ đổi
 *   `cutOn.value`, không `needsUpdate`.
 */
import { BackSide, DoubleSide, FrontSide, type Material, type Object3D, Plane, Vector3 } from 'three';
import { color, frontFacing, materialColor, materialEmissive, normalWorld, select, uniform, vec3 } from 'three/tsl';
import type { Node, NodeMaterial } from 'three/webgpu';

import { CUT_CAP_COLOR, cutPlaneY, lowCutActive } from './cut';

/** Hằng mặt phẳng khi không cắt: cao hơn mọi công trình → giữ hết. */
export const NO_CUT_CONSTANT = 1e6;

interface ClipGroupFields {
  isClippingGroup?: boolean;
  clippingPlanes?: Plane[];
  enabled?: boolean;
  clipIntersection?: boolean;
  clipShadows?: boolean;
}

export interface CutRegistry {
  nodes: { get(id: string): Object3D | undefined };
  byType: Readonly<Record<string, Set<string>>>;
}

// Kiểu three khai colorNode/emissiveNode hẹp hơn Node chung mà TSL trả về.
type ColorMaterial = Omit<NodeMaterial, 'colorNode' | 'emissiveNode'> & { colorNode: Node | null; emissiveNode: Node | null };

/** 1 khi đang cắt thấp: bật tô nắp trên mọi vật liệu tường đã vá. Dùng chung → đổi giá trị không dựng lại. */
export const cutOn = uniform(0);

const capped = new WeakSet<Material>();
const worldPos = new Vector3();
const NO_IDS: ReadonlySet<string> = new Set();
let lowCut = false;

/**
 * Cắt thấp đang bật (khung gần nhất). Trần + đồ treo trần của tầng bị cắt theo nhóm tầng, nhưng phần
 * vẽ thêm nằm ngoài nhóm tầng (quầng đèn âm trần `halo.ts`) phải tự tắt theo, không thì thành đĩa
 * lơ lửng ở cao độ trần trên tường cắt 1 m (bench-3d P6, ảnh ngang mắt).
 */
export function lowCutOn(): boolean {
  return lowCut;
}

/**
 * Vá vật liệu tường một lần, lúc tạo: hai mặt cố định; khi `cutOn` = 1, lòng tường lộ qua mặt cắt (mặt sau,
 * đỉnh móng hướng lên) nằm trong bóng của chính khối tường → tắt khuếch tán và phát sáng phẳng màu nắp.
 * Đổ bóng giữ phía như trước khi vá (PCF: lật phía) để bóng ở chế độ thường không đổi.
 * Vá tại chỗ (vật liệu dùng chung giữ danh tính cho lưới gộp và các vá khác như normal thạch cao).
 */
export function capCutMaterial<T extends Material>(material: T): T {
  const nodeMaterial = material as unknown as ColorMaterial;
  if (capped.has(material) || !nodeMaterial.isNodeMaterial || material.transparent) return material;
  capped.add(material);
  const cap = cutOn.greaterThan(0.5).and(frontFacing.not().or(normalWorld.y.greaterThan(0.5)));
  nodeMaterial.colorNode = select(cap, vec3(0, 0, 0), vec3((nodeMaterial.colorNode ?? materialColor) as Node<'vec3'>));
  nodeMaterial.emissiveNode = select(
    cap,
    vec3(color(CUT_CAP_COLOR) as unknown as Node<'vec3'>),
    vec3((nodeMaterial.emissiveNode ?? materialEmissive) as Node<'vec3'>),
  );
  material.shadowSide ??= material.side === FrontSide ? BackSide : material.side === BackSide ? FrontSide : DoubleSide;
  material.side = DoubleSide;
  material.needsUpdate = true;
  return material;
}

function clipLevel(level: Object3D & ClipGroupFields): void {
  let plane = level.clippingPlanes?.[0];
  if (!plane) {
    // Mặt phẳng hướng xuống: giữ phần dưới mặt cắt (khoảng cách ≥ 0). Bật một lần, không tắt nữa.
    plane = new Plane(new Vector3(0, -1, 0), NO_CUT_CONSTANT);
    level.clippingPlanes = [plane];
    level.clipIntersection = false;
    level.isClippingGroup = true;
    level.enabled = true;
    level.clipShadows = true;
  }
  if (lowCut) {
    level.getWorldPosition(worldPos);
    plane.constant = cutPlaneY(worldPos.y);
  } else {
    plane.constant = NO_CUT_CONSTANT;
  }
}

export function syncLowCut(registry: CutRegistry, wallMode: string): void {
  lowCut = lowCutActive(wallMode);
  cutOn.value = lowCut ? 1 : 0;
  for (const id of registry.byType['level'] ?? NO_IDS) {
    const level = registry.nodes.get(id);
    if (level) clipLevel(level as Object3D & ClipGroupFields);
  }
}
