import { Point2D, Wall } from '../../types/spatial';

export function getWallLength(wall: Wall, p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getWallMidpoint(p1: Point2D, p2: Point2D): Point2D {
  return {
    id: `mid_${p1.id}_${p2.id}`,
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

export function getWallNormal(p1: Point2D, p2: Point2D): { nx: number; ny: number } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { nx: 0, ny: 0 };
  return { nx: -dy / len, ny: dx / len }; // Left normal
}

export function isExteriorWall(wall: Wall, allRooms: { vertices: string[] }[]): boolean {
  // A wall is exterior if it only belongs to 1 room, or 0 rooms (boundary).
  let sharedCount = 0;
  for (const r of allRooms) {
    const vertices = r.vertices;
    for (let i = 0; i < vertices.length; i++) {
      const curr = vertices[i];
      const next = vertices[(i + 1) % vertices.length];
      if (
        (curr === wall.from && next === wall.to) ||
        (curr === wall.to && next === wall.from)
      ) {
        sharedCount++;
        break; // Count once per room
      }
    }
  }
  return sharedCount <= 1;
}

export function splitWallAt(wall: Wall, t: number, newPointId: string): [Wall, Wall] {
  const w1: Wall = { ...wall, id: `${wall.id}_1`, to: newPointId };
  const w2: Wall = { ...wall, id: `${wall.id}_2`, from: newPointId };
  return [w1, w2];
}

export function mergeCollinearWalls(w1: Wall, w2: Wall, sharedPointId: string): Wall {
  const from = w1.from === sharedPointId ? w1.to : w1.from;
  const to = w2.from === sharedPointId ? w2.to : w2.from;
  return { ...w1, id: `${w1.id}_merged`, from, to };
}

export function snapWallEnd(point: Point2D, target: Point2D, toleranceMm: number): Point2D {
  const dx = target.x - point.x;
  const dy = target.y - point.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= toleranceMm) {
    return { ...point, x: target.x, y: target.y };
  }
  return point;
}
