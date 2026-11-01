/**
 * Hàm thuần của thẻ chủ nhà (`HomeownerCard.tsx`): nguồn node, kiểu cửa đi/cửa sổ theo trường lược đồ
 * Pascal (`core/src/schema/nodes/door.ts`, `window.ts`), "Đổi hướng mở", xoay 90°.
 */
import { appFrontIdOf, bodyOfPascalId } from '@/lib/pascal/ids';
import { GENERATED_DRESS_PREFIX } from '@/lib/pascal/sceneDressing';

type Vec3 = readonly [number, number, number];

/** Phần node Pascal mà thẻ đọc (kiểu lỏng, xem `@pascal-app/core` `DoorNode`/`WindowNode`/`ItemNode`). */
export interface HomeownerNode {
  readonly id: string;
  readonly type: string;
  readonly name?: string;
  readonly parentId?: string | null;
  readonly rotation?: Vec3;
  readonly asset?: { readonly name?: string };
  // cửa đi
  readonly doorType?: string;
  readonly leafCount?: number;
  readonly openingKind?: string;
  readonly swingAngle?: number;
  readonly swingDirection?: 'inward' | 'outward';
  readonly slideDirection?: 'left' | 'right';
  // cửa sổ
  readonly windowType?: string;
  readonly casementStyle?: 'single' | 'french';
  readonly hingesSide?: 'left' | 'right';
  readonly awningDirection?: 'up' | 'down';
}

export type Fields = Readonly<Record<string, unknown>>;

/* -------------------------------------------------------------------------- */
/* Nguồn của node.                                                             */
/* -------------------------------------------------------------------------- */

export type SourceLabel = 'AI thêm' | 'Theo bản vẽ' | 'Bạn thêm';

/** `item_DRESS-…` = đồ AppFront tự bày (`sceneDressing.ts`); id AppFront hợp lệ = từ bản vẽ; còn lại Pascal đẻ. */
export const sourceLabelOf = (node: HomeownerNode): SourceLabel => {
  if (bodyOfPascalId(node.id).startsWith(GENERATED_DRESS_PREFIX)) return 'AI thêm';
  return appFrontIdOf(node.type === 'item' ? 'furniture' : 'opening', node.id) === null ? 'Bạn thêm' : 'Theo bản vẽ';
};

/* -------------------------------------------------------------------------- */
/* Kiểu cửa đi — tập con `DoorType` của Pascal hợp căn hộ (bỏ french/barn/garage). */
/* -------------------------------------------------------------------------- */

/** Góc hé cánh bản lề như `DOOR_SWING_ANGLE` của toPascal (~70°) để cửa đọc ra là cửa. */
const SWING_OPEN = 1.22;

export type DoorKind = 'single' | 'double' | 'sliding' | 'pocket' | 'folding' | 'opening';

/**
 * Kiểu đã lưu qua tải lại được. Rỗng = chưa kiểu nào (H4 đang làm luồng lưu) → thẻ ghi chú "chưa lưu".
 * ponytail: điều phối điền kiểu H4 xác nhận lúc gộp; tập rỗng thì ghi chú hiện với mọi kiểu.
 */
export const SAVED_DOOR_KINDS: ReadonlySet<DoorKind> = new Set<DoorKind>(['single', 'double', 'sliding', 'pocket', 'folding', 'opening']);
/** H4: dây `Opening.swing` chứa fixed/sliding/casement (trái, phải, đôi); hất/chớp chưa có chỗ chứa. */
export const SAVED_WINDOW_KINDS: ReadonlySet<WindowKind> = new Set<WindowKind>(['fixed', 'sliding', 'casement', 'casement2']);

export const doorKindOf = (node: HomeownerNode): DoorKind | undefined => {
  if (node.openingKind === 'opening') return 'opening';
  switch (node.doorType ?? 'hinged') {
    case 'hinged':
      return node.leafCount === 2 ? 'double' : 'single';
    case 'double':
    case 'french':
      return 'double';
    case 'sliding':
      return 'sliding';
    case 'pocket':
      return 'pocket';
    case 'folding':
      return 'folding';
    default:
      return undefined;
  }
};

/**
 * Trường Pascal khi đổi sang kiểu `kind`, theo `getDoorTypeUpdates` của bảng cửa Pascal — trừ kích thước
 * và `segments`: giữ rộng/cao theo bản vẽ (Pascal đặt lại về mặc định của kiểu).
 */
export const doorKindUpdate = (node: HomeownerNode, kind: DoorKind): Fields => {
  const swingAngle = node.swingAngle !== undefined && node.swingAngle > 0 ? node.swingAngle : SWING_OPEN;
  const slideDirection = node.slideDirection ?? 'left';
  const door = { openingKind: 'door', doorCategory: 'interior' } as const;
  switch (kind) {
    case 'single':
      return { ...door, doorType: 'hinged', leafCount: 1, swingAngle, operationState: 0, trackStyle: 'none', threshold: true };
    case 'double':
      return { ...door, doorType: 'double', leafCount: 2, swingAngle, operationState: 0, trackStyle: 'none', threshold: true, handleSide: 'right' };
    case 'sliding':
      return { ...door, doorType: 'sliding', leafCount: 2, swingAngle: 0, operationState: 0.5, trackStyle: 'visible', threshold: false, slideDirection };
    case 'pocket':
      return { ...door, doorType: 'pocket', leafCount: 1, swingAngle: 0, operationState: 0.5, trackStyle: 'pocket', threshold: false, slideDirection };
    case 'folding':
      return { ...door, doorType: 'folding', leafCount: 4, swingAngle: 0, operationState: 0.65, trackStyle: 'visible', threshold: false };
    case 'opening':
      return { openingKind: 'opening', swingAngle: 0, operationState: 0 };
  }
};

/** "Đổi hướng mở": cánh bản lề mở vào ↔ ra (`swingDirection`), cửa lùa sang trái ↔ phải (`slideDirection`). */
export const doorFlipUpdate = (node: HomeownerNode): Fields | undefined => {
  const kind = doorKindOf(node);
  if (kind === 'single' || kind === 'double') return { swingDirection: node.swingDirection === 'outward' ? 'inward' : 'outward' };
  if (kind === 'sliding' || kind === 'pocket') return { slideDirection: node.slideDirection === 'right' ? 'left' : 'right' };
  return undefined;
};

/* -------------------------------------------------------------------------- */
/* Kiểu cửa sổ — tập con `WindowType` của Pascal hợp căn hộ (bỏ hung/bay/bow).  */
/* -------------------------------------------------------------------------- */

export type WindowKind = 'fixed' | 'sliding' | 'casement' | 'casement2' | 'awning' | 'louvered';

export const windowKindOf = (node: HomeownerNode): WindowKind | undefined => {
  switch (node.windowType ?? 'fixed') {
    case 'fixed':
      return 'fixed';
    case 'sliding':
      return 'sliding';
    case 'casement':
      return node.casementStyle === 'french' ? 'casement2' : 'casement';
    case 'awning':
    case 'hopper':
      return 'awning';
    case 'louvered':
      return 'louvered';
    default:
      return undefined;
  }
};

/** Như nút "Window Type" của bảng cửa sổ Pascal: kiểu không có dáng (lùa) thì về chữ nhật. */
export const windowKindUpdate = (node: HomeownerNode, kind: WindowKind): Fields => {
  const win = { openingKind: 'window' } as const;
  switch (kind) {
    case 'fixed':
      return { ...win, windowType: 'fixed' };
    case 'sliding':
      return { ...win, windowType: 'sliding', openingShape: 'rectangle' };
    case 'casement':
      return { ...win, windowType: 'casement', casementStyle: 'single' };
    case 'casement2':
      return { ...win, windowType: 'casement', casementStyle: 'french' };
    case 'awning':
      return { ...win, windowType: 'awning', awningDirection: node.awningDirection ?? 'up' };
    case 'louvered':
      return { ...win, windowType: 'louvered' };
  }
};

/** "Đổi hướng mở": cánh quay đổi bên bản lề, cánh hất đổi lên ↔ xuống. */
export const windowFlipUpdate = (node: HomeownerNode): Fields | undefined => {
  const kind = windowKindOf(node);
  if (kind === 'casement') return { hingesSide: node.hingesSide === 'right' ? 'left' : 'right' };
  if (kind === 'awning') return { windowType: 'awning', awningDirection: node.awningDirection === 'down' ? 'up' : 'down' };
  return undefined;
};

/** Xoay 90° quanh trục đứng, như phím R của Pascal (cộng dồn, không chuẩn hoá). */
export const quarterTurn = (rotation: Vec3 | undefined): Vec3 => {
  const [x, y, z] = rotation ?? [0, 0, 0];
  return [x, y + Math.PI / 2, z];
};
