/**
 * Phần chạy của cắt thấp (`cut.ts`), gọi mỗi khung từ hệ tường vendor (luật `r10-cut.mjs`).
 * - Cắt: nhóm tầng (registry `level`) được đánh dấu như `ClippingGroup` của three 0.186 (WebGPURenderer
 *   chỉ cắt qua nhóm, cả nhánh WebGPU lẫn WebGL2) với một mặt phẳng ở sàn + 1,0 m → tường, vách, cửa,
 *   cửa sổ, đồ cao, trần của tầng đều bị cắt. Đổ bóng cũng cắt theo, để phòng không bị tường vô hình che nắng.
 * - Mặt cắt: vật liệu tường (lẻ + lưới gộp) bật hai mặt, mặt sau tô phẳng gần đen; trả lại khi rời chế độ.
 */
import { DoubleSide, type Material, type Mesh, type Object3D, Plane, type Side, Vector3 } from 'three';
import { color, frontFacing, materialColor, select, vec3 } from 'three/tsl';
import type { Node, NodeMaterial } from 'three/webgpu';

import { CUT_FACE_COLOR, cutPlaneY, isCutFaceMesh, lowCutActive } from './cut';

/** Quét vật liệu tường mỗi N khung (mặt phẳng cắt vẫn cập nhật mỗi khung). */
const MATERIAL_SCAN_EVERY_FRAMES = 15;

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

// Kiểu three khai colorNode hẹp hơn Node chung mà TSL trả về.
type ColorMaterial = Omit<NodeMaterial, 'colorNode'> & { colorNode: Node | null };

const patched = new Map<Material, { side: Side; colorNode: Node | null }>();
const clipped = new Set<Object3D & ClipGroupFields>();
const worldPos = new Vector3();
const NO_IDS: ReadonlySet<string> = new Set();
let frame = 0;

function patchMaterial(material: Material): void {
  const nodeMaterial = material as unknown as ColorMaterial;
  if (patched.has(material) || !nodeMaterial.isNodeMaterial || material.transparent) return;
  patched.set(material, { side: material.side, colorNode: nodeMaterial.colorNode });
  nodeMaterial.colorNode = select(frontFacing, vec3((nodeMaterial.colorNode ?? materialColor) as Node<'vec3'>), color(CUT_FACE_COLOR));
  material.side = DoubleSide;
  material.needsUpdate = true;
}

function patchMesh(object: Object3D | undefined): void {
  const mesh = object as Mesh | undefined;
  if (!mesh?.isMesh) return;
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) patchMaterial(material);
}

function restore(): void {
  for (const group of clipped) group.enabled = false;
  clipped.clear();
  for (const [material, original] of patched) {
    (material as unknown as ColorMaterial).colorNode = original.colorNode;
    material.side = original.side;
    material.needsUpdate = true;
  }
  patched.clear();
}

function clipLevel(level: Object3D & ClipGroupFields): void {
  let plane = level.clippingPlanes?.[0];
  if (!plane) {
    // Mặt phẳng hướng xuống: giữ phần dưới mặt cắt (khoảng cách ≥ 0).
    plane = new Plane(new Vector3(0, -1, 0), 0);
    level.clippingPlanes = [plane];
    level.clipIntersection = false;
  }
  level.isClippingGroup = true;
  level.enabled = true;
  level.clipShadows = true;
  level.getWorldPosition(worldPos);
  plane.constant = cutPlaneY(worldPos.y);
  clipped.add(level);
}

export function syncLowCut(registry: CutRegistry, wallMode: string): void {
  if (!lowCutActive(wallMode)) {
    if (clipped.size > 0 || patched.size > 0) restore();
    return;
  }
  const wallIds = registry.byType['wall'] ?? NO_IDS;
  const levels: Object3D[] = [];
  for (const id of registry.byType['level'] ?? NO_IDS) {
    const level = registry.nodes.get(id);
    if (!level) continue;
    clipLevel(level as Object3D & ClipGroupFields);
    levels.push(level);
  }
  if (frame++ % MATERIAL_SCAN_EVERY_FRAMES !== 0) return;
  // ponytail: quét cả cây tầng để tìm lưới gộp tường; đổi sang chỉ số lưới gộp nếu tốn khung.
  for (const id of wallIds) patchMesh(registry.nodes.get(id));
  for (const level of levels) {
    level.traverse((child) => {
      if (isCutFaceMesh(undefined, child.name, wallIds)) patchMesh(child);
    });
  }
}
