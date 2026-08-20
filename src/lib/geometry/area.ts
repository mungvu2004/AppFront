import type { Point2D } from '../../types/spatial';

/**
 * Calculates the area of a polygon using the shoelace formula.
 * The vertices should be in order (either clockwise or counter-clockwise).
 * Returns the area in the same units squared (e.g. if coords are mm, returns mm²).
 */
export function calculatePolygonArea(vertices: Point2D[]): number {
  if (vertices.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i]!.x * vertices[j]!.y;
    area -= vertices[j]!.x * vertices[i]!.y;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Given a list of room areas in m², calculates the total area of a level.
 */
export function calculateLevelArea(roomAreasM2: number[]): number {
  return roomAreasM2.reduce((sum, area) => sum + area, 0);
}

/**
 * Formats an area in m² using Vietnamese locale (comma for decimal).
 */
export function formatAreaM2(areaM2: number): string {
  // Use Intl.NumberFormat for Vietnamese locale
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(areaM2) + ' m²';
}
