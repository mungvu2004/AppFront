/**
 * Roofs and the posts under them (owner's reference, ref-vuonhoa): one low hip
 * roof per storey, stepped, 18° with 1.8 m (top: 1.6 m) overhangs and timber
 * soffits, the eave flared only a little at the corners; a glass pergola on slim
 * steel posts over the pond deck; a flat metal carport roof; the gate's own small
 * hip. Each hip's eave sits where the slope, carried out over the overhang from
 * the wall top, ends — so a roof meets the storey above it exactly at that
 * storey's wall line. Stone cladding lists the wall faces that are not render.
 */

import type { Canopy, Cladding, ColumnRow, HipRoof, LandingRoofs, PlanPt, Polygon } from '../types';

import { STOREY } from './openings';

const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

interface HipSpec {
  readonly id: string;
  readonly name: string;
  readonly levelId: string;
  /** Wall footprint the roof covers (x0, y0, x1, y1) and the wall top it bears on. */
  readonly walls: readonly [number, number, number, number];
  readonly wallTopMm: number;
  readonly overhangMm: number;
  readonly pitchDeg: number;
  readonly cornerUpturnMm: number;
}

/** The hip whose slope leaves the wall top at the wall line and runs `overhangMm` past it. */
export function hip(s: HipSpec): HipRoof {
  const [x0, y0, x1, y1] = s.walls;
  const o = s.overhangMm;
  const slope = Math.tan((s.pitchDeg * Math.PI) / 180);
  const w = x1 - x0 + 2 * o;
  const d = y1 - y0 + 2 * o;
  const eaveMm = Math.round(s.wallTopMm - o * slope);
  return {
    id: s.id,
    name: s.name,
    levelId: s.levelId,
    eave: rect(x0 - o, y0 - o, x1 + o, y1 + o),
    eaveMm,
    pitchDeg: s.pitchDeg,
    ridgeAxis: w >= d ? 'x' : 'y',
    ridgeLengthMm: Math.abs(w - d),
    ridgeMm: Math.round(eaveMm + (Math.min(w, d) / 2) * slope),
    overhangMm: o,
    cornerUpturnMm: s.cornerUpturnMm,
    eaveSagMm: Math.round(s.cornerUpturnMm / 5),
    ridgeEndUpturnMm: Math.round(s.cornerUpturnMm / 2),
    thicknessMm: 250,
    tile: 'flat',
    soffit: 'timber',
  };
}

const HIPS: readonly HipRoof[] = [
  hip({ id: 'RF1', name: 'Mái tầng 1', levelId: 'T1', walls: [4000, 9000, 28000, 21000], wallTopMm: STOREY, overhangMm: 1800, pitchDeg: 18, cornerUpturnMm: 300 }),
  hip({ id: 'RF2', name: 'Mái tầng 2', levelId: 'T2', walls: [4000, 9000, 22000, 23000], wallTopMm: 2 * STOREY, overhangMm: 1800, pitchDeg: 18, cornerUpturnMm: 300 }),
  hip({ id: 'RF3', name: 'Mái tầng 3', levelId: 'T3', walls: [12000, 9000, 20000, 16000], wallTopMm: 2 * STOREY + 3000, overhangMm: 1600, pitchDeg: 18, cornerUpturnMm: 250 }),
  // Gate roof over the pedestrian gate in the front wall (centreline y = 600).
  hip({ id: 'RF4', name: 'Mái cổng', levelId: 'site', walls: [12000, 400, 14000, 800], wallTopMm: 2500, overhangMm: 400, pitchDeg: 22, cornerUpturnMm: 150 }),
];

const CANOPIES: readonly Canopy[] = [
  // Past RF1's rear eave (y 22.8) and under its fascia, over the deck and 0.4 m out over the water.
  { id: 'CP1', name: 'Pergola kính', kind: 'glass', outline: rect(22000, 22900, 27800, 25400), topMm: 2500, thicknessMm: 120, beamAxis: 'y', beamSpacingMm: 1200 },
  // Under RF1's east eave (its underside is ~2540 at x 29.8).
  { id: 'CP2', name: 'Mái che xe', kind: 'metal', outline: rect(28000, 9000, 34500, 16000), topMm: 2450, thicknessMm: 200, beamAxis: 'x', beamSpacingMm: 1000 },
];

const row = (
  id: string,
  carries: string,
  material: ColumnRow['material'],
  start: PlanPt,
  end: PlanPt,
  count: number,
  sizeMm: number,
  baseMm: number,
  topMm: number,
): ColumnRow => ({
  id,
  carries,
  material,
  start,
  end,
  count,
  spacingMm: Math.round(Math.hypot(end[0] - start[0], end[1] - start[1]) / Math.max(1, count - 1)),
  sizeMm,
  baseMm,
  topMm,
});

const COLUMNS: readonly ColumnRow[] = [
  // Entry porch on the podium under RF1's front overhang, either side of D1.
  row('COL-PORCH', 'RF1', 'timber', [11000, 7600], [15000, 7600], 2, 250, 0, 2650),
  // Rear veranda TR: the line under the upper floor's 2 m cantilever.
  row('COL-VERANDA', 'T2', 'timber', [4300, 22800], [21700, 22800], 7, 250, 0, 3175),
  row('POST-PERGOLA-S', 'CP1', 'steel', [22200, 24850], [27600, 24850], 3, 100, 0, 2380),
  row('POST-PERGOLA-N', 'CP1', 'steel', [22200, 23050], [27600, 23050], 3, 100, 0, 2380),
  row('POST-CARPORT', 'CP2', 'steel', [34200, 9300], [34200, 15700], 3, 150, -450, 2250),
];

const CLADDING: readonly Cladding[] = [
  // T1 front: the stone panel beside the main door, and the service wing (WC / store).
  { wallId: 'W1', from: (10500 - 4000) / 24000, to: (12000 - 4000) / 24000, finish: 'stone' },
  { wallId: 'W1', from: (22000 - 4000) / 24000, to: 1, finish: 'stone' },
  // T1 west, the guest wing (y 9–15).
  { wallId: 'W4', from: 0.5, to: 1, finish: 'stone' },
  // T2 front: the stair tower piers either side of W-U7.
  { wallId: 'U1', from: (12000 - 4000) / 18000, to: (13000 - 4000) / 18000, finish: 'stone' },
  { wallId: 'U1', from: (15000 - 4000) / 18000, to: (16000 - 4000) / 18000, finish: 'stone' },
  // T2 east: the blind wall the T1 roof climbs against.
  { wallId: 'U2', from: 0, to: 1, finish: 'stone' },
  // T3: stone east face, timber front over the altar room.
  { wallId: 'V2', from: 0, to: 1, finish: 'stone' },
  { wallId: 'V1', from: 0.5, to: 1, finish: 'timber' },
];

export const LANDING_ROOFS: LandingRoofs = { hips: HIPS, canopies: CANOPIES, columns: COLUMNS, cladding: CLADDING };
