import { readKindFromId, type EntityKind } from '@/domain/spatial/ids';
import { ROUTES } from '@/routes/paths';

/** Lớp 2D nơi sửa được một loại đối tượng (N3-08, G5-32). */
const LAYER_BY_KIND: Partial<
  Record<EntityKind, { label: string; path: (p: string, f: string) => string }>
> = {
  wall: { label: 'Tường', path: ROUTES.project.walls },
  opening: { label: 'Cửa và nội thất', path: ROUTES.project.objects },
  furniture: { label: 'Cửa và nội thất', path: ROUTES.project.objects },
  room: { label: 'Phòng', path: ROUTES.project.rooms },
  dimension: { label: 'Kích thước', path: ROUTES.project.dimensions },
  axis: { label: 'Lưới trục', path: ROUTES.project.grids },
};

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
): FixTarget | null {
  const kind = readKindFromId(entityId);
  const layer = kind === null ? undefined : LAYER_BY_KIND[kind];
  if (layer === undefined || floorId === null) return null;
  // Màn Tường đọc `?wall=` (G4a-16); các lớp khác đọc `?select=` (việc của gói lớp đó).
  const param = kind === 'wall' ? 'wall' : 'select';
  return {
    path: `${layer.path(projectId, floorId)}?${param}=${encodeURIComponent(entityId)}`,
    layerLabel: layer.label,
  };
}
