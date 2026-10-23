/**
 * The demo estate the landing page builds: a modern Vietnamese villa on a
 * 40 × 34 m plot, three stepped storeys under their own low hip roofs, a koi
 * pond on the garden side. One dataset feeds the 3D model and the 2D drawing.
 *
 * Frame (archviz.md §3.1): plan mm, x east along the street, y into the plot
 * (scene z), street at y = 0. Ground floor T1 at 0, upper T2 at 3375, top T3 at
 * 6750 (floor-to-floor 3375 so the 18 × 187,5 mm stair fails C7 on purpose).
 *
 * Stated vs polygon areas: every room's stated area equals its polygon except
 * the two stair halls U7 / P2 (28 m² stated, 18.6 m² polygon: the well is cut
 * out). T1 rooms sum to 288 m², T2 to 252 m², T3 to 56 m²; the rear veranda TR
 * (96 m²) is outdoor and not part of those sums.
 */

import type { PresentationPlan } from '@/lib/three/present';

import type { ComplianceCheck, LandingHouse, StairSpec } from '../types';

import { LANDING_FURNITURE } from './furniture';
import { OPENINGS, STOREY, WALLS } from './openings';
import { LANDING_ROOFS } from './roofs';
import { ROOM_INFO, ROOMS } from './rooms';
import { LANDING_SITE } from './site';

const PLAN: PresentationPlan = {
  levels: [
    { id: 'T1', elevationMm: 0, heightMm: STOREY },
    { id: 'T2', elevationMm: STOREY, heightMm: STOREY },
    { id: 'T3', elevationMm: 2 * STOREY, heightMm: 3000 },
  ],
  walls: WALLS,
  openings: OPENINGS,
  rooms: ROOMS,
  furniture: LANDING_FURNITURE,
  ceilingLights: {
    heightMm: 3000,
    roomIds: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G9', 'U1', 'U4', 'U5', 'U6', 'U7', 'U8', 'P1', 'P2'],
    positionsMm: [
      [19000, 18000],
      [25500, 18000],
    ],
  },
};

/**
 * U-stair in the foyer (§3.4): flight 1 climbs north at x 14.6–15.8 from y 11,
 * 9 risers, a 1200 landing at y 13.16–14.36, flight 2 returns south at x
 * 13.2–14.4 and lands on y 11. 18 × 187,5 = 3375; 8 treads × 270 per flight.
 */
const STAIR: StairSpec = {
  id: 'STAIR-1',
  levelId: 'T1',
  startMm: [15200, 11000],
  climbs: 'north',
  widthMm: 1200,
  risers: 18,
  riserMm: 187.5,
  treadMm: 270,
  landing: { afterRisers: 9, depthMm: 1200, gapMm: 200, returnsOn: 'west' },
};

const chk = (
  id: string,
  label: string,
  value: string,
  pass: boolean,
  targetId: string,
  suggestion?: string,
): ComplianceCheck => ({ id, label, value, pass, targetId, ...(suggestion === undefined ? {} : { suggestion }) });

const CHECKS: readonly ComplianceCheck[] = [
  chk('C1', 'Cửa đi chính ≥ 0,9 m', '1,4 m', true, 'D1'),
  chk('C2', 'Cửa phòng ngủ ≥ 0,8 m', '0,9 m', true, 'D-G6'),
  chk('C3', 'Cửa phòng ngủ ≥ 0,8 m', '0,9 m', true, 'D-U4'),
  chk('C4', 'Cửa WC ≥ 0,75 m', '0,70 m', false, 'D-G10', 'Mở rộng lên 0,75 m'),
  chk('C5', 'Hành lang ≥ 1,2 m', '3,0 m', true, 'U10'),
  chk('C6', 'Chiều cao tầng ≥ 2,7 m', '3,375 m', true, 'T1'),
  chk('C7', 'Bậc thang ≤ 18 cm', '18,75 cm', false, STAIR.id, 'Thêm 1 bậc (19 bậc × 17,8 cm)'),
  chk('C8', 'Cửa sổ phòng ngủ ≥ 1/8 diện tích sàn', 'đạt', true, 'U1'),
  chk('C9', 'Cửa sổ phòng ngủ ≥ 1/8 diện tích sàn', 'đạt', true, 'U5'),
  chk('C10', 'WC có thông gió', 'đạt', true, 'G10'),
  chk('C11', 'Phòng ngủ ≥ 9 m²', '21–56 m²', true, 'G6'),
  chk('C12', 'Tường ngoài ≥ 200 mm', '220 mm', true, 'W1'),
];

export const LANDING_HOUSE: LandingHouse = {
  plan: PLAN,
  axes: [
    { id: 'A', along: 'x', atMm: 4000 },
    { id: 'B', along: 'x', atMm: 10000 },
    { id: 'C', along: 'x', atMm: 16000 },
    { id: 'D', along: 'x', atMm: 22000 },
    { id: 'E', along: 'x', atMm: 28000 },
    { id: '1', along: 'y', atMm: 9000 },
    { id: '2', along: 'y', atMm: 15000 },
    { id: '3', along: 'y', atMm: 21000 },
  ],
  rooms: ROOM_INFO,
  stair: STAIR,
  topStair: { ...STAIR, id: 'STAIR-2', levelId: 'T2' },
  detections: [
    { furnitureId: 'F-G2-SOFA', label: 'Sofa', confidence: 0.93, labelled: true },
    { furnitureId: 'F-G3-TABLE', label: 'Bàn ăn', confidence: 0.9, labelled: true },
    { furnitureId: 'F-G6-BED', label: 'Giường', confidence: 0.95, labelled: true },
    { furnitureId: 'F-G4-KITCHEN', label: 'Bếp', confidence: 0.87, labelled: false },
    { furnitureId: 'F-G4-FRIDGE', label: 'Tủ lạnh', confidence: 0.84, labelled: false },
    { furnitureId: 'F-G5-SOFA', label: 'Sofa', confidence: 0.88, labelled: false },
    { furnitureId: 'F-G2-PIANO', label: 'Đàn piano', confidence: 0.81, labelled: false },
    { furnitureId: 'F-G7-WC', label: 'Bồn cầu', confidence: 0.92, labelled: false },
    { furnitureId: 'F-G10-WC', label: 'Bồn cầu', confidence: 0.93, labelled: false },
    { furnitureId: 'F-G10-SINK', label: 'Lavabo', confidence: 0.9, labelled: false },
    { furnitureId: 'F-G6-CLOSET', label: 'Tủ quần áo', confidence: 0.86, labelled: false },
  ],
  // The solid foyer / family-room partition (x = 16, y 9–15): the AI misses 1,2 m of it.
  reviewGap: { wallId: 'W10', from: 0.4, to: 0.6 },
  checks: CHECKS,
  exports: [
    { format: 'GLB', label: 'Xem 3D' },
    { format: 'IFC', label: 'BIM' },
    { format: 'PDF', label: 'Bản in' },
    { format: 'JSON', label: 'Dữ liệu' },
    { format: 'PNG', label: 'Chia sẻ' },
  ],
  site: LANDING_SITE,
  roofs: LANDING_ROOFS,
};
