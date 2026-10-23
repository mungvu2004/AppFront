/**
 * Rooms of the villa (archviz.md §3.3), their finishes and stated areas.
 *
 * Every room is a rectangle on the structural grid except the two stair halls,
 * U7 and P2, which are notched to leave the stairwell (x 13.2–16, y 11–14.36)
 * open: their polygons are 9.4 m² smaller than the stated 28 m². The rear
 * veranda TR is an outdoor deck on T1 and is not counted in the 288 m² floor.
 */

import type { PlanRoom } from '@/lib/three/present';

import type { RoomInfo } from '../types';

const rect = (x0: number, y0: number, x1: number, y1: number): number[][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** A stair hall x 12–16, y 9–16 with the well cut out of its east side. */
const stairHall = (): number[][] => [
  [12000, 9000],
  [16000, 9000],
  [16000, 11000],
  [13200, 11000],
  [13200, 14360],
  [16000, 14360],
  [16000, 16000],
  [12000, 16000],
];

type Row = readonly [id: string, level: string, finish: string, outline: number[][], name: string, m2: number];

const ROWS: readonly Row[] = [
  // Ground floor T1 (288 m²).
  ['G1', 'T1', 'tile', rect(10000, 9000, 16000, 15000), 'Sảnh + cầu thang', 36],
  ['G2', 'T1', 'wood', rect(16000, 15000, 28000, 21000), 'Phòng khách', 72],
  ['G3', 'T1', 'wood', rect(9000, 15000, 16000, 21000), 'Phòng ăn', 42],
  ['G4', 'T1', 'tile', rect(4000, 15000, 9000, 21000), 'Bếp', 30],
  ['G5', 'T1', 'wood', rect(16000, 9000, 22000, 15000), 'Phòng sinh hoạt gia đình', 36],
  ['G6', 'T1', 'wood', rect(4000, 9000, 10000, 12500), 'Phòng ngủ 4 (khách)', 21],
  ['G7', 'T1', 'mosaic', rect(4000, 12500, 7000, 15000), 'WC khách', 7.5],
  ['G8', 'T1', 'tile', rect(7000, 12500, 10000, 15000), 'Kho thực phẩm', 7.5],
  ['G9', 'T1', 'tile', rect(22000, 11500, 28000, 15000), 'Sảnh phụ', 21],
  ['G10', 'T1', 'mosaic', rect(22000, 9000, 25000, 11500), 'WC chung', 7.5],
  ['G11', 'T1', 'tile', rect(25000, 9000, 28000, 11500), 'Kho + kỹ thuật', 7.5],
  ['TR', 'T1', 'decking', rect(4000, 21000, 28000, 25000), 'Hiên sau', 96],
  // Upper floor T2 (252 m²).
  ['U1', 'T2', 'wood', rect(4000, 16000, 12000, 23000), 'Phòng ngủ master', 56],
  ['U2', 'T2', 'wood', rect(8000, 12000, 12000, 16000), 'Phòng thay đồ', 16],
  ['U3', 'T2', 'mosaic', rect(4000, 12000, 8000, 16000), 'WC master', 16],
  ['U4', 'T2', 'wood', rect(12000, 16000, 17000, 23000), 'Phòng ngủ 2', 35],
  ['U5', 'T2', 'wood', rect(17000, 16000, 22000, 23000), 'Phòng ngủ 3', 35],
  ['U6', 'T2', 'wood', rect(4000, 9000, 12000, 12000), 'Thư phòng', 24],
  ['U7', 'T2', 'wood', stairHall(), 'Sảnh tầng 2', 28],
  ['U8', 'T2', 'wood', rect(16000, 9000, 22000, 12500), 'Phòng sinh hoạt tầng 2', 21],
  ['U9', 'T2', 'mosaic', rect(19000, 12500, 22000, 16000), 'WC 2', 10.5],
  ['U10', 'T2', 'wood', rect(16000, 12500, 19000, 16000), 'Hành lang', 10.5],
  // Top floor T3 (56 m²).
  ['P1', 'T3', 'wood', rect(16000, 9000, 20000, 16000), 'Phòng thờ', 28],
  ['P2', 'T3', 'wood', stairHall(), 'Sảnh tầng 3', 28],
];

export const ROOMS: readonly PlanRoom[] = ROWS.map(([id, levelId, finish, outline]) => ({ id, levelId, finish, outline }));

export const ROOM_INFO: readonly RoomInfo[] = ROWS.map(([roomId, , , , name, statedAreaM2]) => ({ roomId, name, statedAreaM2 }));
