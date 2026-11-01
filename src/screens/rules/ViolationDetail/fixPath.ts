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

/** Công cụ vẽ mà lớp đích bật sẵn khi mở từ nút "Sửa" (`?tool=`). */
export type FixTool = 'door' | 'window' | 'wall';

/** Tham số URL lớp đích đọc để chỉ đúng lỗi: mã luật, đối tượng lỗi, công cụ bật sẵn. */
export const FIX_QUERY = { rule: 'rule', issue: 'issue', tool: 'tool' } as const;

interface RuleFix {
  readonly layer?: FloorLayerKey;
  readonly action: string;
  readonly tool?: FixTool;
}

/**
 * Luật mà việc cần làm là một thao tác cụ thể, có khi ở lớp khác lớp của đối tượng
 * lỗi: phòng thiếu cửa thì cửa vẽ ở lớp Cửa và nội thất, phòng hở thì tường bù vẽ
 * ở lớp Tường — không phải lớp Phòng (P03).
 */
const FIX_BY_RULE: Readonly<Record<string, RuleFix>> = {
  'ROOM-NO-DOOR': { layer: 'objects', action: 'Thêm cửa đi', tool: 'door' },
  'ROOM-HAS-DOOR': { layer: 'objects', action: 'Thêm cửa đi', tool: 'door' },
  'ROOM-NO-WINDOW': { layer: 'objects', action: 'Thêm cửa sổ', tool: 'window' },
  'ROOM-NOT-CLOSED': { layer: 'walls', action: 'Vẽ tường bù', tool: 'wall' },
  'WALL-DANGLING-END': { action: 'Nối đầu tường' },
  'WALL-LENGTH': { action: 'Sửa chiều dài' },
};

/** Chữ trên nút "Sửa" của một luật: nói việc cần làm khi biết, ngược lại "Sửa". */
export function fixActionLabelOf(ruleCode: string): string {
  return FIX_BY_RULE[ruleCode]?.action ?? 'Sửa';
}

/** Lớp sửa được lỗi này: lớp của việc cần làm, không thì lớp của đối tượng lỗi. */
export function fixLayerOf(entityId: string, ruleCode?: string): FloorLayerKey | null {
  const kind = readKindFromId(entityId);
  const fix = ruleCode === undefined ? undefined : FIX_BY_RULE[ruleCode];

  return fix?.layer ?? (kind === null ? undefined : LAYER_KEY_BY_KIND[kind]) ?? null;
}

/** Công cụ lớp đích bật sẵn cho luật này; `null` khi chỉ cần chọn đối tượng. */
export function fixToolOf(ruleCode: string): FixTool | null {
  return FIX_BY_RULE[ruleCode]?.tool ?? null;
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
  const key = fixLayerOf(entityId, ruleCode);
  const layer = FLOOR_LAYERS.find((candidate) => candidate.key === key);
  if (layer === undefined || floorId === null) return null;
  const kind = readKindFromId(entityId);
  /* Lớp khác lớp của đối tượng: id phòng không chọn được gì ở đó, chỉ mở lớp. */
  const ownLayer = kind !== null && LAYER_KEY_BY_KIND[kind] === layer.key;
  const select = ownLayer ? SELECT_PARAM_BY_LAYER[layer.key] : undefined;
  const params = new URLSearchParams();
  if (select !== undefined) params.set(select, entityId);
  if (ruleCode !== undefined) {
    params.set(FIX_QUERY.rule, ruleCode);
    params.set(FIX_QUERY.issue, entityId);
    const tool = fixToolOf(ruleCode);
    if (tool !== null) params.set(FIX_QUERY.tool, tool);
  }
  const query = params.toString();
  const base = layer.path(projectId, floorId);
  return { path: query === '' ? base : `${base}?${query}`, layerLabel: layer.label };
}
