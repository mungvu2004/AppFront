/**
 * The project-wide sample building.
 *
 * Every team downstream reads its sample figures from here, so the numbers
 * stay the standard set: 4 levels, 48 walls, 21 furniture items, 14 rooms,
 * 34 dimensions and 248,60 m² of floor area. Openings and axes round the
 * model out at 9 doors, 7 windows and 4 axes.
 *
 * The graph is built to pass `checkIntegrity` with zero issues — no dangling
 * reference, no zero-length wall, no unclosed room, elevations strictly
 * increasing — so any issue a test sees comes from what that test broke.
 */

import type {
  Axis,
  AxisId,
  Dimension,
  DimensionId,
  Furniture,
  FurnitureId,
  Level,
  LevelId,
  Note,
  Opening,
  OpeningId,
  Room,
  RoomId,
  SpatialGraph,
  Wall,
  WallId,
} from '../types';

/** Standard sample counts. Do not diverge from these in other fixtures. */
export const SAMPLE_LEVEL_COUNT = 4;
export const SAMPLE_WALL_COUNT = 48;
export const SAMPLE_FURNITURE_COUNT = 21;
export const SAMPLE_ROOM_COUNT = 14;
export const SAMPLE_DIMENSION_COUNT = 34;
export const SAMPLE_DOOR_COUNT = 9;
export const SAMPLE_WINDOW_COUNT = 7;
export const SAMPLE_AXIS_COUNT = 4;

/** Total floor area of the sample building, in square metres. */
export const SAMPLE_TOTAL_AREA_M2 = 248.6;

const LARGE_ROOM_AREA_M2 = 27.6;
const SMALL_ROOM_AREA_M2 = 17;

const LEVEL_HEIGHT_MM = 3600;
const WALL_LENGTH_MM = 1000;
const WALL_THICKNESS_MM = 220;
const DOOR_WIDTH_MM = 900;
const DOOR_HEIGHT_MM = 2200;
const WINDOW_WIDTH_MM = 1200;
const WINDOW_HEIGHT_MM = 1400;
const WINDOW_SILL_MM = 900;
const ROOM_WIDTH_MM = 4000;
const ROOM_DEPTH_MM = 4250;
const FURNITURE_SIZE_MM = 800;

const pad = (value: number): string => String(value).padStart(6, '0');

/** Stable ids, so tests can address a specific entity without searching. */
export const sampleLevelId = (index: number): LevelId => `L-LEVEL${pad(index)}`;
export const sampleWallId = (index: number): WallId => `W-WALL${pad(index)}0`;
export const sampleDoorId = (index: number): OpeningId => `D-DOOR${pad(index)}0`;
export const sampleWindowId = (index: number): OpeningId => `D-WNDW${pad(index)}0`;
export const sampleFurnitureId = (index: number): FurnitureId => `F-FURN${pad(index)}0`;
export const sampleRoomId = (index: number): RoomId => `R-ROOM${pad(index)}0`;
export const sampleAxisId = (index: number): AxisId => `A-AXIS${pad(index)}0`;
export const sampleDimensionId = (index: number): DimensionId => `M-DIMN${pad(index)}0`;

/** The level an entity at `index` belongs to, spreading entities evenly. */
export const sampleLevelOf = (index: number): LevelId => sampleLevelId(index % SAMPLE_LEVEL_COUNT);

const APPROVED = { confidence: 1, reviewed: true, source: 'human' } as const;
const DETECTED = { confidence: 0.82, reviewed: false, source: 'ai' } as const;

const createLevels = (): Level[] =>
  Array.from({ length: SAMPLE_LEVEL_COUNT }, (_unused, index) => ({
    ...APPROVED,
    elevationMm: index * LEVEL_HEIGHT_MM,
    heightMm: LEVEL_HEIGHT_MM,
    id: sampleLevelId(index),
    name: `Level ${index}`,
    order: index,
  }));

const createWalls = (): Wall[] =>
  Array.from({ length: SAMPLE_WALL_COUNT }, (_unused, index) => ({
    ...DETECTED,
    centreline: {
      end: { x: (index + 1) * WALL_LENGTH_MM, y: 0 },
      start: { x: index * WALL_LENGTH_MM, y: 0 },
    },
    heightMm: LEVEL_HEIGHT_MM,
    id: sampleWallId(index),
    kind: 'partition' as const,
    levelId: sampleLevelOf(index),
    openingIds: [] as OpeningId[],
    thicknessMm: WALL_THICKNESS_MM,
  }));

/** Doors take walls 0..8, windows take walls 9..15. */
const createOpenings = (): Opening[] => {
  const doors = Array.from({ length: SAMPLE_DOOR_COUNT }, (_unused, index) => ({
    ...DETECTED,
    heightMm: DOOR_HEIGHT_MM,
    id: sampleDoorId(index),
    kind: 'door' as const,
    offsetMm: 300,
    sillHeightMm: 0,
    swing: 'left' as const,
    wallId: sampleWallId(index),
    widthMm: DOOR_WIDTH_MM,
  }));

  const windows = Array.from({ length: SAMPLE_WINDOW_COUNT }, (_unused, index) => ({
    ...DETECTED,
    heightMm: WINDOW_HEIGHT_MM,
    id: sampleWindowId(index),
    kind: 'window' as const,
    offsetMm: 500,
    sillHeightMm: WINDOW_SILL_MM,
    swing: 'sliding' as const,
    wallId: sampleWallId(SAMPLE_DOOR_COUNT + index),
    widthMm: WINDOW_WIDTH_MM,
  }));

  return [...doors, ...windows];
};

const createFurniture = (): Furniture[] =>
  Array.from({ length: SAMPLE_FURNITURE_COUNT }, (_unused, index) => ({
    ...DETECTED,
    boundingBox: {
      max: { x: index * WALL_LENGTH_MM + FURNITURE_SIZE_MM, y: FURNITURE_SIZE_MM },
      min: { x: index * WALL_LENGTH_MM, y: 0 },
    },
    centre: { x: index * WALL_LENGTH_MM + FURNITURE_SIZE_MM / 2, y: FURNITURE_SIZE_MM / 2 },
    id: sampleFurnitureId(index),
    kind: 'table' as const,
    levelId: sampleLevelOf(index),
    // Room `index % SAMPLE_LEVEL_COUNT` sits on the same level as this item.
    roomId: sampleRoomId(index % SAMPLE_LEVEL_COUNT),
    rotationDeg: 0,
  }));

/** Thirteen rooms of 17,00 m² plus one of 27,60 m² make 248,60 m². */
const createRooms = (): Room[] =>
  Array.from({ length: SAMPLE_ROOM_COUNT }, (_unused, index) => ({
    ...APPROVED,
    areaM2: index === SAMPLE_ROOM_COUNT - 1 ? LARGE_ROOM_AREA_M2 : SMALL_ROOM_AREA_M2,
    id: sampleRoomId(index),
    levelId: sampleLevelOf(index),
    name: `Room ${index}`,
    outline: [
      { x: index * ROOM_WIDTH_MM, y: 0 },
      { x: (index + 1) * ROOM_WIDTH_MM, y: 0 },
      { x: (index + 1) * ROOM_WIDTH_MM, y: ROOM_DEPTH_MM },
      { x: index * ROOM_WIDTH_MM, y: ROOM_DEPTH_MM },
    ],
    usage: 'bedroom' as const,
    wallIds: [sampleWallId(index)],
  }));

const createAxes = (): Axis[] =>
  Array.from({ length: SAMPLE_AXIS_COUNT }, (_unused, index) => ({
    ...APPROVED,
    direction: 'horizontal' as const,
    id: sampleAxisId(index),
    label: String.fromCharCode(65 + index),
    levelId: sampleLevelOf(index),
    line: {
      end: { x: SAMPLE_WALL_COUNT * WALL_LENGTH_MM, y: index * 3000 },
      start: { x: 0, y: index * 3000 },
    },
  }));

const createDimensions = (): Dimension[] =>
  Array.from({ length: SAMPLE_DIMENSION_COUNT }, (_unused, index) => ({
    ...DETECTED,
    id: sampleDimensionId(index),
    kind: 'linear' as const,
    levelId: sampleLevelOf(index),
    line: {
      end: { x: (index + 1) * WALL_LENGTH_MM, y: -500 },
      start: { x: index * WALL_LENGTH_MM, y: -500 },
    },
    // Wall `index` shares this dimension's level, so the reference stays valid.
    referenceIds: [sampleWallId(index)],
    valueMm: WALL_LENGTH_MM,
  }));

const createNotes = (): Note[] => [
  {
    ...APPROVED,
    authorId: 'U-1',
    body: 'Đã đối chiếu với bản vẽ khảo sát.',
    createdAt: '2026-08-13T09:00:00+07:00',
    entityId: sampleWallId(0),
    id: 'note-1',
  },
];

/** Builds a fresh, mutable copy of the sample building. */
export const createSampleBuilding = (): SpatialGraph => {
  const walls = createWalls();
  const openings = createOpenings();
  const wallsById = new Map(walls.map((wall) => [wall.id, wall]));

  for (const opening of openings) {
    const wall = wallsById.get(opening.wallId);

    if (wall === undefined) {
      throw new Error(`sampleBuilding: opening ${opening.id} has no host wall`);
    }

    wall.openingIds = [...wall.openingIds, opening.id];
  }

  return {
    axes: createAxes(),
    building: {
      ...APPROVED,
      address: '12 Nguyễn Huệ, Quận 1',
      datumElevationMm: 0,
      grossFloorAreaM2: SAMPLE_TOTAL_AREA_M2,
      name: 'Chung cư Hoàng Anh',
    },
    dimensions: createDimensions(),
    furniture: createFurniture(),
    levels: createLevels(),
    notes: createNotes(),
    openings,
    rooms: createRooms(),
    walls,
  };
};

const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze(Reflect.get(value, key));
  }

  return Object.freeze(value);
};

/**
 * The shared, frozen instance.
 *
 * Read from this when a test only looks at the data; call
 * `createSampleBuilding()` when it needs to break something.
 */
export const SAMPLE_BUILDING: SpatialGraph = deepFreeze(createSampleBuilding());
