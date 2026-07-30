import { Geometry, Point2D } from '../../types/spatial';
import { isExteriorWall } from '../geometry/wall';

export type RuleSeverity = 'error' | 'warning';

export interface Violation {
  rule_id: string;
  severity: RuleSeverity;
  entity_id: string;
  level_id: string;
  message: string;
  suggested_fix?: string;
}

function pointInPolygon(point: { x: number; y: number }, vs: { x: number; y: number }[]) {
  const x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i]!.x, yi = vs[i]!.y;
    const xj = vs[j]!.x, yj = vs[j]!.y;
    const intersect = ((yi > y) != (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function runSpatialRules(geometry: Geometry, level_id: string): Violation[] {
  const violations: Violation[] = [];
  
  // Rule a: Room-label
  // phòng GARA có BED/SOFA thì đổi thành CAR, phòng WC có BED/SOFA thì xoá
  const allRooms = Object.values(geometry.rooms).map(r => ({
    ...r,
    polygon: r.vertices.map(vId => geometry.vertices[vId]!).filter(Boolean) as Point2D[]
  }));

  for (const room of allRooms) {
    const poly = room.polygon;

    const bedsAndSofas = Object.values(geometry.furniture).filter(
      f => (f.type === 'bed' || f.type === 'sofa') && pointInPolygon({ x: f.x, y: f.y }, poly)
    );

    if (bedsAndSofas.length > 0) {
      if (room.label === 'GARA') {
        violations.push({
          rule_id: 'room-label',
          severity: 'error',
          entity_id: room.id,
          level_id,
          message: 'Phòng GARA chứa giường/sofa',
          suggested_fix: 'Đổi nhãn phòng thành CAR',
        });
      } else if (room.label === 'WC') {
        violations.push({
          rule_id: 'room-label',
          severity: 'error',
          entity_id: room.id,
          level_id,
          message: 'Phòng WC chứa giường/sofa',
          suggested_fix: 'Xoá phòng này',
        });
      }
    }
  }

  // Rule b: Adjacency
  // toilet và kitchen_sink phải cách tường ≤ 50 mm
  for (const f of Object.values(geometry.furniture)) {
    if (f.type === 'toilet' || f.type === 'kitchen_sink') {
      let minDistance = Infinity;
      for (const w of Object.values(geometry.walls)) {
        const p1 = geometry.vertices[w.from];
        const p2 = geometry.vertices[w.to];
        if (!p1 || !p2) continue;

        // point to line distance
        const A = f.x - p1.x;
        const B = f.y - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq != 0) param = dot / len_sq;

        let xx, yy;
        if (param < 0) {
          xx = p1.x; yy = p1.y;
        } else if (param > 1) {
          xx = p2.x; yy = p2.y;
        } else {
          xx = p1.x + param * C;
          yy = p1.y + param * D;
        }

        const dx = f.x - xx;
        const dy = f.y - yy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) {
          minDistance = dist;
        }
      }

      if (minDistance > 50) {
        violations.push({
          rule_id: 'adjacency',
          severity: 'error',
          entity_id: f.id,
          level_id,
          message: `Khoảng cách đến tường là ${Math.round(minDistance)}mm (> 50mm)`,
          suggested_fix: 'Di chuyển thiết bị áp sát tường',
        });
      }
    }
  }

  // Rule c: Window chỉ được nằm trên tường bao ngoài
  const cachedRoomList = allRooms.map(r => ({ vertices: r.vertices }));
  for (const win of Object.values(geometry.windows)) {
    const wall = geometry.walls[win.wall_id];
    if (wall) {
      if (!isExteriorWall(wall, cachedRoomList)) {
        violations.push({
          rule_id: 'exterior-window',
          severity: 'error',
          entity_id: win.id,
          level_id,
          message: 'Cửa sổ nằm trên tường trong',
          suggested_fix: 'Xoá cửa sổ hoặc đổi thành cửa đi',
        });
      }
    }
  }

  return violations;
}
