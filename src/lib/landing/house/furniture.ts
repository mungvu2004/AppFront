/**
 * Furniture of the demo house (plan mm, origin back-left, y down the sheet).
 *
 * `facing` is where the piece's front points; north is +y. Pieces against a wall
 * sit with their back to it, and nothing stands inside a door's swing square on
 * either side of a door (the tests check both).
 */

import type { PlanFurniture } from '@/lib/three/present';

type Entry = readonly [id: string, variant: string, x: number, y: number, w: number, d: number, h: number, facing: string];

const T2 = 'T2';

/** [id, variant, x, y, width, depth, height, facing] */
const GROUND: readonly Entry[] = [
  // Phòng khách R1: sofa faces the TV on the east wall; the stair runs up the west wall.
  ['F3', 'sofa', 2300, 3800, 2200, 900, 800, 'east'],
  ['X-LIV-TV', 'tv', 4740, 3800, 1100, 400, 1500, 'west'],
  ['X-LIV-COFFEE', 'table', 3500, 3800, 1100, 600, 420, 'east'],
  ['X-LIV-RUG', 'rug', 3300, 3800, 2400, 1700, 10, 'east'],
  ['X-LIV-PLANT', 'plant', 4600, 4650, 450, 450, 1200, 'north'],
  // Bếp + ăn R2.
  ['F5', 'baseRun', 10550, 415, 2600, 600, 900, 'north'],
  ['F6', 'sink', 9800, 415, 800, 450, 20, 'north'],
  ['X-KIT-HOB', 'hob', 11000, 415, 600, 500, 20, 'north'],
  ['X-KIT-FRIDGE', 'fridge', 11535, 1250, 700, 700, 1900, 'west'],
  ['F4', 'table', 7200, 2500, 1600, 900, 750, 'north'],
  ['X-DIN-C1', 'chair', 6800, 1650, 450, 600, 950, 'north'],
  ['X-DIN-C2', 'chair', 7600, 1650, 450, 600, 950, 'north'],
  ['X-DIN-C3', 'chair', 6800, 3350, 450, 600, 950, 'south'],
  ['X-DIN-C4', 'chair', 7600, 3350, 450, 600, 950, 'south'],
  // Phòng ngủ 1 R3: head to the west wall.
  ['F1', 'bed', 1120, 7000, 1600, 2000, 600, 'east'],
  ['X-BR1-NS1', 'nightstand', 320, 5950, 350, 400, 500, 'east'],
  ['X-BR1-NS2', 'nightstand', 320, 8050, 350, 400, 500, 'east'],
  ['X-BR1-WARD', 'wardrobe', 3300, 5360, 1700, 600, 2300, 'north'],
  ['X-BR1-RUG', 'rug', 2900, 7000, 1400, 2000, 10, 'east'],
  // WC R5.
  ['F7', 'wc', 7500, 8530, 400, 650, 800, 'south'],
  ['F8', 'basin', 5260, 8300, 500, 400, 850, 'east'],
  // Phòng ngủ 2 R6: head to the west partition.
  ['F2', 'bed', 9060, 7300, 1400, 2000, 600, 'east'],
  ['X-BR2-NS1', 'nightstand', 8260, 6400, 350, 400, 500, 'east'],
  ['X-BR2-NS2', 'nightstand', 8260, 8200, 350, 400, 500, 'east'],
  ['X-BR2-WARD', 'wardrobe', 10800, 5360, 1700, 600, 2300, 'north'],
  ['X-BR2-RUG', 'rug', 10200, 7300, 1400, 1800, 10, 'east'],
];

const UPPER: readonly Entry[] = [
  // Phòng ngủ 3 R8.
  ['F10', 'bed', 1120, 7000, 1800, 2000, 600, 'east'],
  ['X-BR3-NS1', 'nightstand', 320, 5900, 350, 400, 500, 'east'],
  ['X-BR3-NS2', 'nightstand', 320, 8100, 350, 400, 500, 'east'],
  ['X-BR3-WARD', 'wardrobe', 6500, 8590, 2000, 600, 2300, 'south'],
  ['X-BR3-RUG', 'rug', 2900, 7000, 1600, 2200, 10, 'east'],
  // Phòng làm việc R7: desk in front of the big window.
  ['F11', 'table', 4000, 470, 1600, 700, 750, 'north'],
  ['X-OFF-CHAIR', 'chair', 4000, 1050, 450, 600, 950, 'south'],
  ['X-OFF-SH1', 'shelves', 7710, 2000, 800, 350, 2000, 'west'],
  ['X-OFF-SH2', 'shelves', 7710, 3200, 800, 350, 2000, 'west'],
  ['X-OFF-PLANT', 'plant', 7500, 500, 450, 450, 1200, 'north'],
];

const toPlan = (level: string) => (e: Entry): PlanFurniture => ({
  id: e[0],
  levelId: level,
  variant: e[1],
  centreMm: [e[2], e[3]],
  sizeMm: [e[4], e[5], e[6]],
  facing: e[7],
  ...(e[1] === 'tableLamp' ? { liftMm: 500 } : {}),
});

export const LANDING_FURNITURE: readonly PlanFurniture[] = [
  ...GROUND.map(toPlan('T1')),
  ...UPPER.map(toPlan(T2)),
];
