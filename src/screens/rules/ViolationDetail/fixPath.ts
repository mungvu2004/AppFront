import { readKindFromId, type EntityKind } from '@/domain/spatial/ids';
import { FLOOR_LAYERS, type FloorLayerKey } from '@/routes/projectSteps';

/** Lớp 2D nơi sửa được một loại đối tượng (N3-08, G5-32); tên và đường lấy từ `FLOOR_LAYERS` (RV5 #5). */
const LAYER_KEY_BY_KIND: Partial<Record<EntityKind, FloorLayerKey>> = {
  wall: 'walls',
  opening: 'objects',
  furniture: 'objects',
  room: 'rooms',
  dimension: 'dimensions',
  axis: 'grids',
};

/**
 * Tham số chọn sẵn mà màn lớp có đọc: Tường đọc `?wall=` (G4a-16), Cửa và nội thất
 * và Phòng đọc `?select=`. Kích thước và Trục chưa đọc gì (RV5 #6) nên chỉ mở lớp.
 */
const SELECT_PARAM_BY_LAYER: Partial<Record<FloorLayerKey, string>> = {
  walls: 'wall',
  objects: 'select',
  rooms: 'select',
};

/**
 * Luật mà việc cần làm là một thao tác cụ thể ở lớp khác lớp của đối tượng lỗi:
 * phòng thiếu cửa đi thì cửa đi vẽ ở lớp Cửa và nội thất, không phải lớp Phòng (P03).
 */
const FIX_BY_RULE: Readonly<Record<string, { readonly layer: FloorLayerKey; readonly action: string }>> = {
  'ROOM-NO-DOOR': { layer: 'objects', action: 'Thêm cửa đi' },
  'ROOM-HAS-DOOR': { layer: 'objects', action: 'Thêm cửa đi' },
};

/** Chữ trên nút "Sửa" của một luật: nói việc cần làm khi biết, ngược lại "Sửa". */
export function fixActionLabelOf(ruleCode: string): string {
  return FIX_BY_RULE[ruleCode]?.action ?? 'Sửa';
}

export interface FixTarget {
  readonly path: string;
  /** Tên lớp, ví dụ "Phòng" — để nút ghi "Sửa ở lớp Phòng". */
  readonly layerLabel: string;
}

/** Lớp sửa được đối tượng lỗi trên tầng của nó; `null` khi không biết loại hoặc tầng. */
export function fixTargetOf(
  projectId: string,
  floorId: string | null,
  entityId: string,
  ruleCode?: string,
): FixTarget | null {
  const kind = readKindFromId(entityId);
  const override = ruleCode === undefined ? undefined : FIX_BY_RULE[ruleCode];
  const key = override?.layer ?? (kind === null ? undefined : LAYER_KEY_BY_KIND[kind]);
  const layer = FLOOR_LAYERS.find((candidate) => candidate.key === key);
  if (layer === undefined || floorId === null) return null;
  /* Lớp khác lớp của đối tượng: id phòng không chọn được gì ở đó, chỉ mở lớp. */
  const param = override === undefined ? SELECT_PARAM_BY_LAYER[layer.key] : undefined;
  const base = layer.path(projectId, floorId);
  return {
    path: param === undefined ? base : `${base}?${param}=${encodeURIComponent(entityId)}`,
    layerLabel: layer.label,
  };
}
