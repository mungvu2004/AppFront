/**
 * Furniture of the villa: Pascal items (`/pascal/items/<slug>/model.glb`, MIT,
 * vendor/pascal) placed on the plan in mm, north = +y.
 *
 * present places the catalogue `variant` first and swaps the model in, scaled
 * uniformly to fit `sizeMm` (placement.ts#fitToSize). So `sizeMm` is the model's
 * own size times the entry's uniform scale — never a stretched box — and the
 * models are assumed to face +z like glTF (present's front). `facing` turns that
 * front to a compass point; for east/west the plan footprint swaps width/depth.
 * Pieces against a wall stand with their back to it; the tests keep every floor
 * piece inside its room, off the walls, out of door/void swings, off the stair
 * and off each other.
 */

import type { PlanFurniture } from '@/lib/three/present';

/**
 * Native sizes (w × d × h mm, glTF x × z × y) read from each GLB's accessor
 * bounds with node transforms applied, and the present variant standing in.
 */
export const PASCAL: Readonly<Record<string, readonly [variant: string, w: number, d: number, h: number]>> = {
  sofa: ['sofa', 2050, 1009, 731],
  'double-bed': ['bed', 1515, 1994, 701],
  'single-bed': ['bed', 1080, 2134, 593],
  'dining-table': ['table', 2153, 942, 698],
  'dining-chair': ['chair', 464, 494, 864],
  kitchen: ['baseRun', 2378, 833, 1027],
  'kitchen-counter': ['baseRun', 1957, 627, 726],
  fridge: ['fridge', 692, 713, 1918],
  stove: ['baseRun', 919, 750, 847],
  hood: ['hood', 1205, 507, 519],
  toilet: ['wc', 417, 711, 814],
  bathtub: ['cabinet', 2338, 1107, 781],
  'bathroom-sink': ['basin', 1822, 627, 966],
  'shower-square': ['shower', 800, 801, 1800],
  closet: ['wardrobe', 1946, 599, 2257],
  dresser: ['cabinet', 1225, 602, 729],
  'bedside-table': ['nightstand', 444, 455, 480],
  'office-table': ['table', 1502, 610, 750],
  'office-chair': ['chair', 655, 689, 1158],
  bookshelf: ['shelves', 921, 321, 1986],
  'tv-stand': ['cabinet', 1852, 318, 346],
  television: ['tv', 1613, 373, 1070],
  'coffee-table': ['table', 1718, 1034, 295],
  'lounge-chair': ['armchair', 671, 1252, 1028],
  'livingroom-chair': ['armchair', 1098, 1070, 741],
  'rectangular-carpet': ['rug', 2772, 1800, 34],
  'round-carpet': ['rug', 1986, 1986, 40],
  'indoor-plant': ['plant', 685, 822, 1625],
  'small-indoor-plant': ['plant', 391, 379, 669],
  'floor-lamp': ['floorLamp', 700, 680, 1852],
  'ceiling-lamp': ['pendant', 547, 547, 854],
  piano: ['cabinet', 1534, 680, 1433],
  picture: ['artwork', 1469, 56, 817],
  stool: ['stool', 517, 547, 1154],
  'washing-machine': ['cabinet', 599, 529, 857],
};

type F = 'north' | 'east' | 'south' | 'west';
/** [id, slug, x, y, facing, scale = 1, liftMm = 0] */
type Entry = readonly [id: string, slug: string, x: number, y: number, facing: F, scale?: number, lift?: number];

const T1: readonly Entry[] = [
  // G1 Sảnh: console + picture on the x = 10 wall, a plant by the door.
  ['F-G1-CONSOLE', 'dresser', 10370, 13000, 'east'],
  ['F-G1-ART', 'picture', 10090, 13000, 'east', 1, 1300],
  ['F-G1-PLANT', 'indoor-plant', 10500, 9600, 'south'],
  // G2 Phòng khách: sofa faces the TV wall (x = 28), the garden glass behind.
  ['F-G2-SOFA', 'sofa', 23000, 18000, 'east'],
  ['F-G2-TVSTAND', 'tv-stand', 27720, 18000, 'west'],
  ['F-G2-TV', 'television', 27700, 18000, 'west', 1, 346],
  ['F-G2-COFFEE', 'coffee-table', 24800, 18000, 'east'],
  ['F-G2-RUG', 'rectangular-carpet', 24800, 18000, 'east'],
  ['F-G2-CHAIR1', 'livingroom-chair', 25600, 16200, 'north'],
  ['F-G2-CHAIR2', 'livingroom-chair', 25600, 19800, 'south'],
  ['F-G2-LAMP', 'floor-lamp', 22900, 20300, 'east'],
  ['F-G2-PLANT', 'indoor-plant', 27400, 15600, 'west'],
  ['F-G2-PIANO', 'piano', 20800, 15405, 'north'],
  // G3 Phòng ăn: a table for six under two pendants, a sideboard on the x = 9 stub.
  ['F-G3-TABLE', 'dining-table', 12600, 18000, 'north'],
  ['F-G3-C1', 'dining-chair', 11900, 17230, 'north'],
  ['F-G3-C2', 'dining-chair', 12600, 17230, 'north'],
  ['F-G3-C3', 'dining-chair', 13300, 17230, 'north'],
  ['F-G3-C4', 'dining-chair', 11900, 18770, 'south'],
  ['F-G3-C5', 'dining-chair', 12600, 18770, 'south'],
  ['F-G3-C6', 'dining-chair', 13300, 18770, 'south'],
  ['F-G3-PEND1', 'ceiling-lamp', 12100, 18000, 'north', 1, 2250],
  ['F-G3-PEND2', 'ceiling-lamp', 13100, 18000, 'north', 1, 2250],
  ['F-G3-SIDE', 'dresser', 9360, 19600, 'east'],
  // G4 Bếp: run under the rear window, hob + hood beside it, island with stools.
  ['F-G4-KITCHEN', 'kitchen', 6500, 20464, 'south'],
  ['F-G4-STOVE', 'stove', 8200, 20505, 'south'],
  ['F-G4-HOOD', 'hood', 8200, 20630, 'south', 1, 1600],
  ['F-G4-FRIDGE', 'fridge', 4477, 15500, 'east'],
  ['F-G4-ISLAND', 'kitchen-counter', 6500, 18000, 'north'],
  ['F-G4-STOOL1', 'stool', 6000, 17370, 'north'],
  ['F-G4-STOOL2', 'stool', 7000, 17370, 'north'],
  // G5 Phòng sinh hoạt gia đình.
  ['F-G5-SOFA', 'sofa', 16570, 12000, 'east'],
  ['F-G5-TVSTAND', 'tv-stand', 21776, 12000, 'west'],
  ['F-G5-TV', 'television', 21760, 12000, 'west', 1, 346],
  ['F-G5-COFFEE', 'coffee-table', 18800, 12000, 'east'],
  ['F-G5-RUG', 'round-carpet', 18900, 12000, 'east'],
  ['F-G5-SHELF1', 'bookshelf', 17000, 14774, 'south'],
  ['F-G5-SHELF2', 'bookshelf', 21000, 14774, 'south'],
  ['F-G5-PLANT', 'small-indoor-plant', 21500, 9500, 'south'],
  // G6 Phòng ngủ 4 (khách).
  ['F-G6-BED', 'double-bed', 5117, 10800, 'east'],
  ['F-G6-NS1', 'bedside-table', 4348, 9550, 'east'],
  ['F-G6-NS2', 'bedside-table', 4348, 12050, 'east'],
  ['F-G6-CLOSET', 'closet', 9665, 10000, 'west', 0.9],
  // G7 WC khách.
  ['F-G7-WC', 'toilet', 4476, 14300, 'east'],
  ['F-G7-SHOWER', 'shower-square', 6500, 14500, 'north'],
  ['F-G7-SINK', 'bathroom-sink', 6715, 13300, 'west', 0.7],
  // G8 Kho thực phẩm.
  ['F-G8-SHELF1', 'bookshelf', 7226, 13200, 'east'],
  ['F-G8-SHELF2', 'bookshelf', 7226, 14200, 'east'],
  // G9 Sảnh phụ.
  ['F-G9-SHOES', 'dresser', 22366, 13200, 'east'],
  ['F-G9-PLANT', 'small-indoor-plant', 27500, 14500, 'west'],
  // G10 WC chung.
  ['F-G10-WC', 'toilet', 22421, 9800, 'east'],
  ['F-G10-SINK', 'bathroom-sink', 24715, 10000, 'west', 0.7],
  // G11 Kho + kỹ thuật.
  ['F-G11-WASH', 'washing-machine', 25600, 9385, 'north'],
  ['F-G11-SHELF', 'bookshelf', 27719, 10000, 'west'],
  // TR Hiên sau: loungers on the deck at the koi pond's edge.
  ['F-TR-LOUNGE1', 'lounge-chair', 18000, 23300, 'north'],
  ['F-TR-LOUNGE2', 'lounge-chair', 19200, 23300, 'north'],
  ['F-TR-COFFEE', 'coffee-table', 21300, 23300, 'north', 0.6],
  ['F-TR-PLANT', 'indoor-plant', 4600, 24300, 'north'],
];

const T2: readonly Entry[] = [
  // U1 Phòng ngủ master: king bed (Pascal double × 1.2) facing the garden glass.
  ['F-U1-BED', 'double-bed', 7000, 17261, 'north', 1.2],
  ['F-U1-NS1', 'bedside-table', 5820, 16293, 'north'],
  ['F-U1-NS2', 'bedside-table', 8180, 16293, 'north'],
  ['F-U1-RUG', 'rectangular-carpet', 7000, 18500, 'north'],
  ['F-U1-CHAIR', 'livingroom-chair', 10800, 21600, 'south'],
  ['F-U1-DRESSER', 'dresser', 11634, 19000, 'west'],
  ['F-U1-LAMP', 'floor-lamp', 4500, 22400, 'east'],
  // U2 Phòng thay đồ.
  ['F-U2-CLOSET1', 'closet', 9000, 12365, 'north', 0.95],
  ['F-U2-CLOSET2', 'closet', 10950, 12365, 'north', 0.95],
  // U3 WC master.
  ['F-U3-TUB', 'bathtub', 5500, 12480, 'north', 0.75],
  ['F-U3-SHOWER', 'shower-square', 7400, 15400, 'north'],
  ['F-U3-WC', 'toilet', 4476, 15300, 'east'],
  ['F-U3-SINK', 'bathroom-sink', 5950, 15621, 'south'],
  // U4 Phòng ngủ 2.
  ['F-U4-BED', 'double-bed', 15938, 19500, 'west'],
  ['F-U4-NS1', 'bedside-table', 16707, 18470, 'west'],
  ['F-U4-NS2', 'bedside-table', 16707, 20530, 'west'],
  ['F-U4-CLOSET', 'closet', 12365, 18000, 'east'],
  ['F-U4-DESK', 'office-table', 12370, 21500, 'east'],
  ['F-U4-CHAIR', 'office-chair', 13100, 21500, 'west'],
  // U5 Phòng ngủ 3.
  ['F-U5-BED', 'double-bed', 20883, 19500, 'west'],
  ['F-U5-NS1', 'bedside-table', 21652, 18470, 'west'],
  ['F-U5-NS2', 'bedside-table', 21652, 20530, 'west'],
  ['F-U5-CLOSET', 'closet', 17365, 18200, 'east'],
  ['F-U5-CHAIR', 'livingroom-chair', 18000, 21800, 'south'],
  // U6 Thư phòng: desk under the front window, shelves on the back wall.
  ['F-U6-DESK', 'office-table', 8000, 9425, 'north'],
  ['F-U6-CHAIR', 'office-chair', 8000, 10150, 'south'],
  ['F-U6-SHELF1', 'bookshelf', 5000, 11774, 'south'],
  ['F-U6-SHELF2', 'bookshelf', 5950, 11774, 'south'],
  ['F-U6-SHELF3', 'bookshelf', 6900, 11774, 'south'],
  ['F-U6-READ', 'lounge-chair', 4746, 10400, 'east'],
  ['F-U6-LAMP', 'floor-lamp', 4500, 11250, 'east'],
  // U7 Sảnh tầng 2.
  ['F-U7-PLANT', 'indoor-plant', 12500, 13500, 'east'],
  ['F-U7-ART', 'picture', 12090, 12700, 'east', 1, 1300],
  // U8 Phòng sinh hoạt tầng 2.
  ['F-U8-SOFA', 'sofa', 20200, 11930, 'south'],
  ['F-U8-COFFEE', 'coffee-table', 20200, 10600, 'south'],
  // U9 WC 2.
  ['F-U9-WC', 'toilet', 21524, 15300, 'west'],
  ['F-U9-SHOWER', 'shower-square', 21480, 13000, 'north'],
  ['F-U9-SINK', 'bathroom-sink', 20000, 15684, 'south', 0.8],
  // U10 Hành lang.
  ['F-U10-PLANT', 'small-indoor-plant', 16400, 15600, 'east'],
];

const T3: readonly Entry[] = [
  // P1 Phòng thờ: the altar cabinet on the east wall, an ancestor picture above it.
  ['F-P1-ALTAR', 'dresser', 19459, 12500, 'west', 1.4],
  ['F-P1-ART', 'picture', 19870, 12500, 'west', 0.8, 1500],
  ['F-P1-PLANT1', 'small-indoor-plant', 19600, 10200, 'west'],
  ['F-P1-PLANT2', 'small-indoor-plant', 19600, 14800, 'west'],
  ['F-P1-RUG', 'rectangular-carpet', 17800, 12500, 'west', 0.8],
  // P2 Sảnh tầng 3.
  ['F-P2-PLANT', 'indoor-plant', 12650, 13500, 'east'],
];

const toPlan =
  (levelId: string) =>
  ([id, slug, x, y, facing, scale = 1, lift = 0]: Entry): PlanFurniture => {
    const native = PASCAL[slug];
    if (native === undefined) {
      throw new RangeError(`no Pascal size for ${slug}`);
    }
    const [variant, w, d, h] = native;
    return {
      id,
      levelId,
      variant,
      centreMm: [x, y],
      sizeMm: [Math.round(w * scale), Math.round(d * scale), Math.round(h * scale)],
      facing,
      ...(lift === 0 ? {} : { liftMm: lift }),
      modelUrl: `/pascal/items/${slug}/model.glb`,
    };
  };

export const LANDING_FURNITURE: readonly PlanFurniture[] = [
  ...T1.map(toPlan('T1')),
  ...T2.map(toPlan('T2')),
  ...T3.map(toPlan('T3')),
];
