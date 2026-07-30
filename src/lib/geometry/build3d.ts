import { Geometry, Level } from '../../types/spatial';

export interface Box3D {
  id: string;
  type: 'wall' | 'door' | 'window';
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotation: number;
}

export function build3DBoxes(geometry: Geometry, level: Level): Box3D[] {
  const boxes: Box3D[] = [];
  const zBase = level.elevation_m * 1000; // in mm
  const levelHeight = level.height_m * 1000;

  for (const wId in geometry.walls) {
    const wall = geometry.walls[wId]!;
    const p1 = geometry.vertices[wall.from]!;
    const p2 = geometry.vertices[wall.to]!;

    if (!p1 || !p2) continue;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const rotation = Math.atan2(dy, dx);
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;
    
    // thickness handling for string type
    const thickness = typeof wall.thickness_mm === 'number' ? wall.thickness_mm : 220; // fallback for column

    boxes.push({
      id: wall.id,
      type: 'wall',
      x: cx,
      y: cy,
      z: zBase + levelHeight / 2,
      width: length,
      height: levelHeight,
      depth: thickness,
      rotation,
    });
  }

  for (const dId in geometry.doors) {
    const door = geometry.doors[dId]!;
    const wall = geometry.walls[door.wall_id];
    if (!wall) continue;
    const p1 = geometry.vertices[wall.from]!;
    const p2 = geometry.vertices[wall.to]!;
    if (!p1 || !p2) continue;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const rotation = Math.atan2(dy, dx);

    const thickness = typeof wall.thickness_mm === 'number' ? wall.thickness_mm : 220;
    
    boxes.push({
      id: door.id,
      type: 'door',
      x: p1.x + dx * door.position_t,
      y: p1.y + dy * door.position_t,
      z: zBase + door.height_mm / 2,
      width: door.width_mm,
      height: door.height_mm,
      depth: thickness + 20, // slightly thicker to poke through
      rotation,
    });
  }

  for (const wId in geometry.windows) {
    const win = geometry.windows[wId]!;
    const wall = geometry.walls[win.wall_id];
    if (!wall) continue;
    const p1 = geometry.vertices[wall.from]!;
    const p2 = geometry.vertices[wall.to]!;
    if (!p1 || !p2) continue;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const rotation = Math.atan2(dy, dx);

    const thickness = typeof wall.thickness_mm === 'number' ? wall.thickness_mm : 220;
    
    boxes.push({
      id: win.id,
      type: 'window',
      x: p1.x + dx * win.position_t,
      y: p1.y + dy * win.position_t,
      z: zBase + 1000 + win.height_mm / 2, // assume 1000mm from floor
      width: win.width_mm,
      height: win.height_mm,
      depth: thickness + 20,
      rotation,
    });
  }

  return boxes;
}
