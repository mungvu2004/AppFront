/**
 * AppFront (04/11): how much of a room label fits inside its room on the 2D plan, at the current zoom. A label wider
 * than its room spills onto the next room's label ("phòng ngủ phò…"); `scripts/realism/u49-room-label.mjs` calls this.
 * The measure is the room's own width and height through the label, in screen directions, so a rotated plan still works.
 */
export type RoomLabelFit = 'full' | 'name' | 'none';

export interface RoomLabelInput {
  polygon: readonly (readonly [number, number])[];
  at: readonly [number, number];
  /** Scene rotation of the plan: the label is drawn at `rotate(-rotationDeg)` so it reads upright. */
  rotationDeg: number;
  unitsPerPixel: number;
  nameChars: number;
  /** Longest secondary line (0 = no secondary line). */
  detailChars: number;
  lines: number;
}

/** Average glyph widths of Be Vietnam Pro: bold 13 px name, medium 11 px detail. Slightly wide on purpose. */
const NAME_CHAR_PX = 7.6;
const DETAIL_CHAR_PX = 6.2;
const LINE_PX = 16;

/** Room length through `at` along `dir`, centred on `at` (twice the shorter reach), since the label is centred too. */
function centredSpan(polygon: RoomLabelInput['polygon'], at: RoomLabelInput['at'], dir: readonly [number, number]): number {
  let forward = Infinity;
  let backward = Infinity;
  polygon.forEach(([ax, ay], i) => {
    const [bx, by] = polygon[(i + 1) % polygon.length]!;
    const ex = bx - ax;
    const ey = by - ay;
    const cross = dir[0] * ey - dir[1] * ex;
    if (Math.abs(cross) < 1e-9) return;
    const t = ((ax - at[0]) * ey - (ay - at[1]) * ex) / cross;
    const s = ((ax - at[0]) * dir[1] - (ay - at[1]) * dir[0]) / cross;
    if (s < 0 || s > 1) return;
    if (t >= 0) forward = Math.min(forward, t);
    else backward = Math.min(backward, -t);
  });
  return 2 * Math.min(forward, backward);
}

export function roomLabelFit({ polygon, at, rotationDeg, unitsPerPixel, nameChars, detailChars, lines }: RoomLabelInput): RoomLabelFit {
  if (polygon.length < 3 || unitsPerPixel <= 0) return 'full';
  const rad = (rotationDeg * Math.PI) / 180;
  const width = centredSpan(polygon, at, [Math.cos(rad), -Math.sin(rad)]) / unitsPerPixel;
  const height = centredSpan(polygon, at, [Math.sin(rad), Math.cos(rad)]) / unitsPerPixel;
  const nameWidth = nameChars * NAME_CHAR_PX;
  if (width < nameWidth || height < LINE_PX) return 'none';
  if (width < detailChars * DETAIL_CHAR_PX || height < lines * LINE_PX) return 'name';
  return 'full';
}
