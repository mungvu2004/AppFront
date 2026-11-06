/**
 * Đổi loại một ô mở trên trang 3D: cửa đi ↔ cửa sổ (AI nhận nhầm cửa chính thành cửa sổ…).
 *
 * Pascal tách hẳn `door` và `window` thành hai loại node, nên đổi loại = thay node. Node mới giữ
 * thân id AppFront (`door_D-x` → `window_D-x`): lượt về `toSpatial` thấy đúng ô mở cũ, chỉ đổi
 * `kind`/cao/bệ — không thành một lần xoá + một lần tạo. Tâm dọc tường, rộng, mặt tường giữ nguyên;
 * cao và bệ lấy cỡ thường của căn hộ (cửa 2100 bệ 0, cửa sổ 1400 bệ 900). Người dùng chọn thì nguồn
 * là `human` (A5).
 */
import type { Opening, OpeningId, WallId } from '@/domain/spatial/types';
import { metresToMillimetres, metres, millimetres } from '@/domain/units/types';

import { bodyOfPascalId } from './ids';
import { openingNodeOf } from './toPascal';
import type { PascalDoorNode, PascalWindowNode } from './types';

export type SwitchableKind = 'door' | 'window';
export type PascalOpeningNode = PascalDoorNode | PascalWindowNode;

const SIZE: Record<SwitchableKind, { readonly heightMm: number; readonly sillMm: number }> = {
  door: { heightMm: 2100, sillMm: 0 },
  window: { heightMm: 1400, sillMm: 900 },
};

const mm = (valueM: number): number => Math.round(metresToMillimetres(metres(valueM)));

export const isOpeningNode = (node: { readonly type?: string } | undefined): node is PascalOpeningNode =>
  node?.type === 'door' || node?.type === 'window';

/** Node thay thế khi đổi `node` sang `kind` (cùng loại thì trả lại chính nó). */
export const switchOpeningKind = (node: PascalOpeningNode, kind: SwitchableKind): PascalOpeningNode => {
  if (node.type === kind) return node;
  const widthMm = mm(node.width);
  const { heightMm, sillMm } = SIZE[kind];
  const opening: Opening = {
    id: bodyOfPascalId(node.id) as OpeningId,
    wallId: node.wallId as unknown as WallId,
    kind,
    offsetMm: millimetres(0), // vị trí dọc tường lấy thẳng từ node cũ bên dưới
    widthMm: millimetres(widthMm),
    heightMm: millimetres(heightMm),
    sillHeightMm: millimetres(sillMm),
    swing: kind === 'door' ? 'left' : 'sliding',
    confidence: 1,
    source: 'human',
    reviewed: node.metadata?.appfront?.reviewed === true,
  };
  const next = openingNodeOf(opening, node.wallId);
  // `side` (mặt tường) không có trong kiểu AppFront nhưng Pascal đọc — mang sang nguyên.
  const side = (node as { readonly side?: unknown }).side;
  return {
    ...next,
    parentId: node.parentId,
    position: [node.position[0], next.position[1], node.position[2]],
    rotation: node.rotation,
    ...(side === undefined ? {} : { side }),
  } as PascalOpeningNode;
};
