import { Geometry, WallThickness } from '../../types/spatial';

export type Patch<T> = Partial<T>;

export interface GeometryPatch {
  vertices?: Record<string, Patch<Geometry['vertices'][string]>>;
  walls?: Record<string, Patch<Geometry['walls'][string]>>;
}

/**
 * Generates a patch to move a vertex.
 */
export function dragVertex(vertexId: string, newX: number, newY: number): GeometryPatch {
  return {
    vertices: {
      [vertexId]: { x: newX, y: newY },
    },
  };
}

/**
 * Generates a patch to move a wall. Translates both from and to vertices.
 */
export function dragWall(
  geometry: Geometry,
  wallId: string,
  dx: number,
  dy: number
): GeometryPatch {
  const wall = geometry.walls[wallId];
  if (!wall) return {};

  const vFrom = geometry.vertices[wall.from];
  const vTo = geometry.vertices[wall.to];
  
  if (!vFrom || !vTo) return {};

  return {
    vertices: {
      [wall.from]: { x: vFrom.x + dx, y: vFrom.y + dy },
      [wall.to]: { x: vTo.x + dx, y: vTo.y + dy },
    },
  };
}

/**
 * Generates a patch to change a wall's thickness.
 */
export function changeWallThickness(wallId: string, thickness: WallThickness): GeometryPatch {
  return {
    walls: {
      [wallId]: { thickness_mm: thickness },
    },
  };
}
