/**
 * The plot around the villa (40 × 34 m), after the owner's reference: a wide
 * lawn wrapping the house, a stone path with lights from a roofed gate to the
 * main door, a koi pond (~14 × 7 m) with a planted island and stepping slabs at
 * the edge of the rear deck, specimen and bonsai trees, palms along the west
 * wall, hedges in the beds, boulders and a round stone table, a driveway into
 * the carport, low white boundary walls. No pool: the pond carries the garden.
 *
 * Natural ground is 450 below the FFL. Lawns are split into simple pieces that
 * meet edge to edge rather than one polygon with touching holes, so every
 * outline is a plain closed polygon the drawing and the stage can fill.
 */

import type { LandingSite, PlanPt, Polygon, SiteItem, SitePlant, SiteSurface } from '../types';

const G = -450;

const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

const surface = (id: string, kind: SiteSurface['kind'], outline: Polygon, extra: Partial<SiteSurface> = {}): SiteSurface => ({
  id,
  kind,
  outline,
  elevationMm: G,
  ...extra,
});

/** Front wall centreline y = 600 (the gate roof overhangs both sides inside the plot); others 100 in. */
const FRONT_Y = 600;
const FRONT_LEN = 39800;

const STEPPING = [25800, 26600, 27400, 28200, 29000, 29800, 30600, 31400].map((y) => rect(16400, y - 250, 17600, y + 250));
const PATH_SLABS = Array.from({ length: 9 }, (_, i) => 875 + i * 700).map((y) => rect(12250, y, 13750, y + 550));

const SURFACES: readonly SiteSurface[] = [
  // Front lawn either side of the stone path and the entry podium.
  surface('S-LAWN-FW', 'lawn', [[1400, 700], [12250, 700], [12250, 7200], [10500, 7200], [10500, 8200], [1400, 8200]]),
  surface('S-LAWN-FE', 'lawn', [[13750, 700], [29500, 700], [29500, 8200], [15500, 8200], [15500, 7200], [13750, 7200]]),
  surface('S-LAWN-W', 'lawn', rect(1400, 8200, 4000, 32600)),
  surface('S-LAWN-E', 'lawn', rect(28000, 16000, 34500, 25000)),
  // Rear lawn, notched round the pond's coping.
  surface('S-LAWN-R', 'lawn', [[4000, 25000], [12700, 25000], [12700, 32300], [27300, 32300], [27300, 25000], [34500, 25000], [34500, 32600], [4000, 32600]]),
  surface('S-LAWN-G', 'lawn', rect(34500, 700, 38600, 32600), { name: 'Vườn cây ăn trái' }),
  // Beds: hedges along the side and rear walls, low planting along the house front.
  surface('S-BED-W', 'bed', rect(200, 700, 1400, 33800)),
  surface('S-BED-E', 'bed', rect(38600, 700, 39800, 33800)),
  surface('S-BED-R', 'bed', rect(1400, 32600, 38600, 33800)),
  surface('S-BED-HW', 'bed', rect(4000, 8200, 10500, 9000)),
  surface('S-BED-HE', 'bed', rect(15500, 8200, 28000, 9000)),
  // Gate → main door: nine limestone slabs 1,5 × 0,55 in the grass.
  surface('S-PATH', 'path', rect(12250, 875, 13750, 7025), {
    name: 'Lối đi đá',
    slabs: PATH_SLABS,
    module: { lengthMm: 1500, widthMm: 550, jointMm: 150 },
  }),
  surface('S-PODIUM', 'podium', rect(10500, 7200, 15500, 9000), { elevationMm: 0, module: { lengthMm: 600, widthMm: 600, jointMm: 5 } }),
  surface('S-DRIVE', 'driveway', rect(29500, 700, 34500, 9000), { module: { lengthMm: 500, widthMm: 500, jointMm: 80 } }),
  surface('S-CARPORT', 'paving', rect(28110, 9000, 34500, 16000), { module: { lengthMm: 600, widthMm: 600, jointMm: 5 } }),
  // The planted island in the koi pond (raised planter, top 250 above the water).
  surface('S-ISLAND', 'island', rect(19000, 28000, 21500, 30000), { elevationMm: -150, name: 'Đảo cây' }),
  surface('S-STEPPING', 'path', rect(16400, 25550, 17600, 31650), { elevationMm: -350, name: 'Bước đá', slabs: STEPPING }),
];

const POND: Polygon = [
  [13000, 25300],
  [27000, 25300],
  [27000, 30000],
  [25500, 32000],
  [16000, 32000],
  [13000, 30500],
];

const plant = (id: string, species: string, slug: string, at: PlanPt, scale: number, extra: Partial<SitePlant> = {}): SitePlant => {
  // Native Pascal sizes w × d × h (mm), see furniture.ts#PASCAL for how they were read.
  const native: Readonly<Record<string, readonly [number, number, number]>> = {
    tree: [5740, 6142, 7486],
    palm: [7859, 7621, 11930],
    bush: [3115, 1043, 1078],
  };
  const [w, d, h] = native[slug] ?? [1000, 1000, 1000];
  return {
    id,
    species,
    slug,
    modelUrl: `/pascal/items/${slug}/model.glb`,
    variant: slug === 'bush' ? 'shrub' : 'plant',
    at,
    baseMm: G,
    scale,
    rotationDeg: 0,
    canopyMm: Math.round((Math.max(w, d) * scale) / 2),
    heightMm: Math.round(h * scale),
    ...extra,
  };
};

const hedge = (prefix: string, points: readonly PlanPt[], rotationDeg: number, scale = 1): SitePlant[] =>
  points.map((at, i) => plant(`${prefix}-${String(i + 1)}`, 'Bụi cây', 'bush', at, scale, { rotationDeg }));

const PLANTS: readonly SitePlant[] = [
  plant('P-BONSAI', 'Cây bonsai', 'tree', [20250, 29000], 0.4, { baseMm: -150 }),
  plant('P-BONSAI-2', 'Cây bonsai', 'tree', [9500, 7600], 0.3),
  plant('P-FRANG-1', 'Hoa sứ', 'tree', [6000, 4000], 0.5),
  plant('P-FRANG-2', 'Hoa sứ', 'tree', [24000, 4000], 0.5),
  plant('P-SHADE-1', 'Cây bóng mát', 'tree', [32500, 28500], 1.1),
  plant('P-SHADE-2', 'Cây bóng mát', 'tree', [5500, 31000], 0.9),
  ...[6000, 12000, 18000, 24000, 30000].map((y, i) => plant(`P-PALM-W${String(i + 1)}`, 'Cau vua', 'palm', [2700, y], 0.7)),
  ...[4000, 9000, 14000].map((y, i) => plant(`P-PALM-E${String(i + 1)}`, 'Cau vua', 'palm', [36500, y], 0.7)),
  ...[20000, 25000, 30000].map((y, i) => plant(`P-FRUIT-${String(i + 1)}`, 'Cây ăn trái', 'tree', [36500, y], 0.65)),
  ...hedge('P-HEDGE-W', Array.from({ length: 10 }, (_, k): PlanPt => [800, 2500 + 3300 * k]), 90),
  ...hedge('P-HEDGE-E', Array.from({ length: 10 }, (_, k): PlanPt => [39200, 2500 + 3300 * k]), 90),
  ...hedge('P-HEDGE-R', Array.from({ length: 11 }, (_, k): PlanPt => [3000 + 3400 * k, 33200]), 0),
  ...hedge('P-HEDGE-H', [5500, 7500, 9500, 17000, 19000, 21000, 23000, 25000, 27000].map((x): PlanPt => [x, 8600]), 0, 0.6),
];

const stone = (id: string, kind: SiteItem['kind'], at: PlanPt, sizeMm: readonly [number, number, number]): SiteItem => ({
  id,
  kind,
  at,
  facing: 'north',
  sizeMm,
  baseMm: G,
});

const ITEMS: readonly SiteItem[] = [
  { id: 'I-CAR', kind: 'model', slug: 'tesla', modelUrl: '/pascal/items/tesla/model.glb', at: [31200, 12500], facing: 'north', sizeMm: [1980, 4750, 1620], baseMm: G },
  { id: 'I-BAY', kind: 'model', slug: 'parking-spot', modelUrl: '/pascal/items/parking-spot/model.glb', at: [31200, 12500], facing: 'east', sizeMm: [5663, 2646, 118], baseMm: G },
  stone('I-TABLE', 'stone-table', [8000, 28500], [900, 900, 750]),
  ...([[8000, 27500], [9000, 28500], [8000, 29500], [7000, 28500]] as const).map((at, i) => stone(`I-STOOL-${String(i + 1)}`, 'stone-stool', at, [420, 420, 450])),
  ...([[12000, 27000], [28000, 27500], [10500, 31500], [30500, 26500], [3000, 4000], [26500, 6500]] as const).map((at, i) =>
    stone(`I-BOULDER-${String(i + 1)}`, 'boulder', at, [900 + 150 * i, 700 + 100 * i, 600]),
  ),
  ...([2000, 4000, 6000] as const).flatMap((y) => [
    stone(`I-LIGHT-W${String(y)}`, 'path-light', [11900, y], [120, 120, 450]),
    stone(`I-LIGHT-E${String(y)}`, 'path-light', [14100, y], [120, 120, 450]),
  ]),
];

export const LANDING_SITE: LandingSite = {
  plot: rect(0, 0, 40000, 34000),
  groundMm: G,
  walls: [
    { id: 'BW1', kind: 'boundary', start: [100, FRONT_Y], end: [39900, FRONT_Y], thicknessMm: 200, baseMm: G, heightMm: 1200, finish: 'render', plinthMm: 300 },
    { id: 'BW2', kind: 'boundary', start: [39900, FRONT_Y], end: [39900, 33900], thicknessMm: 200, baseMm: G, heightMm: 1600, finish: 'render' },
    { id: 'BW3', kind: 'boundary', start: [39900, 33900], end: [100, 33900], thicknessMm: 200, baseMm: G, heightMm: 1600, finish: 'render' },
    { id: 'BW4', kind: 'boundary', start: [100, 33900], end: [100, FRONT_Y], thicknessMm: 200, baseMm: G, heightMm: 1600, finish: 'render' },
  ],
  gates: [
    { id: 'GATE-CAR', wallId: 'BW1', kind: 'vehicle', operation: 'sliding', relativePosition: (32000 - 100) / FRONT_LEN, widthMm: 5000, heightMm: 1200, piers: [] },
    {
      id: 'GATE-MAIN',
      wallId: 'BW1',
      kind: 'pedestrian',
      operation: 'swing',
      relativePosition: (13000 - 100) / FRONT_LEN,
      widthMm: 1500,
      heightMm: 2000,
      piers: [
        { at: [12000, FRONT_Y], sizeMm: 500, heightMm: 2950 },
        { at: [14000, FRONT_Y], sizeMm: 500, heightMm: 2950 },
      ],
      roofId: 'RF4',
    },
  ],
  surfaces: SURFACES,
  steps: [
    { id: 'ST-PODIUM', outline: rect(11750, 7200, 14250, 8250), climbs: 'north', risers: 3, riserMm: 150, treadMm: 350, baseMm: G },
    { id: 'ST-CAR', outline: rect(28110, 12400, 29160, 13600), climbs: 'west', risers: 3, riserMm: 150, treadMm: 350, baseMm: G },
    { id: 'ST-REAR', outline: rect(5000, 25000, 12000, 26050), climbs: 'south', risers: 3, riserMm: 150, treadMm: 350, baseMm: G },
  ],
  water: [
    {
      id: 'POND',
      kind: 'pond',
      name: 'Hồ cá koi',
      outline: POND,
      copingMm: 300,
      copingTopMm: -300,
      waterLevelMm: -400,
      depthMm: 900,
      finish: 'stone',
      lotus: [
        { at: [14500, 27000], radiusMm: 350 },
        { at: [15200, 29500], radiusMm: 300 },
        { at: [23500, 27000], radiusMm: 400 },
        { at: [25000, 29500], radiusMm: 300 },
      ],
    },
  ],
  plants: PLANTS,
  items: ITEMS,
};
