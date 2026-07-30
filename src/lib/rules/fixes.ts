import { GeometryPatch } from '../geometry/edit3d';
import { Violation } from './engine';
import { Geometry } from '../../types/spatial';

export function applyFix(geometry: Geometry, violation: Violation): GeometryPatch | { delete_entities: string[] } | null {
  if (violation.rule_id === 'room-label') {
    if (violation.suggested_fix?.includes('CAR')) {
      return {
        rooms: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [violation.entity_id]: { label: 'CAR' } as any
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any; // Using any for room patch
    } else if (violation.suggested_fix?.includes('Xoá')) {
      return { delete_entities: [violation.entity_id] };
    }
  }

  if (violation.rule_id === 'exterior-window') {
    return { delete_entities: [violation.entity_id] };
  }

  // adjacency rule usually requires user interaction to drag it to the exact wall.
  // automated fix is complex to determine the exact point, returning null for automated fix.
  
  return null;
}
