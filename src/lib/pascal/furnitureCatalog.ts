// Bảng tay chép từ vendor/pascal catalog-items.tsx (không import: file đó mang 333 URL supabase,
// còn toPascal được app chính import). furnitureCatalog.test.ts đối chiếu từng dòng với catalog.
import { SCENE_PALETTE } from './scenePalette';

export interface CatalogModel {
  readonly folder: string;
  /** Mét, [w, h, d]. */
  readonly dimensions: readonly [number, number, number];
  readonly offset: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  /** Scale riêng của catalog (bỏ = [1, 1, 1]): `dimensions` là cỡ SAU scale này, GLB gốc to hơn. */
  readonly scale?: readonly [number, number, number];
  readonly attachTo?: string;
  readonly interactive?: unknown;
}

export const CATALOG_MODELS: Readonly<Record<string, CatalogModel>> = {
  'double-bed': {
    folder: 'double-bed',
    dimensions: [1.52, 0.71, 2],
    offset: [0.0042, 0, -0.0277],
    rotation: [0, 0, 0],
  },
  'single-bed': {
    folder: 'single-bed',
    dimensions: [1.08, 0.6, 2.14],
    offset: [-0.0024, 0, -0.013],
    rotation: [0, 0, 0],
  },
  closet: {
    folder: 'closet',
    dimensions: [1.95, 2.26, 0.6],
    offset: [0, 0, -0.0141],
    rotation: [0, 0, 0],
  },
  'dining-chair': {
    folder: 'dining-chair',
    dimensions: [0.47, 0.87, 0.5],
    offset: [0, 0, 0.0016],
    rotation: [0, 0, 0],
  },
  'office-chair': {
    folder: 'office-chair',
    dimensions: [0.66, 1.16, 0.69],
    offset: [0.0024, 0.0015, 0.0332],
    rotation: [0, 0, 0],
  },
  'dining-table': {
    folder: 'dining-table',
    dimensions: [2.16, 0.7, 0.95],
    offset: [0, 0, -0.0077],
    rotation: [0, 0, 0],
  },
  'bedside-table': {
    folder: 'bedside-table',
    dimensions: [0.45, 0.48, 0.46],
    offset: [0.0005, 0, -0.0062],
    rotation: [0, 0, 0],
  },
  'coffee-table': {
    folder: 'coffee-table',
    dimensions: [1.72, 0.3, 1.04],
    offset: [0, 0, 0.0089],
    rotation: [0, 0, 0],
  },
  'office-table': {
    folder: 'office-table',
    dimensions: [1.51, 0.76, 0.62],
    offset: [-0.0001, 0, -0.0052],
    rotation: [0, 0, 0],
  },
  'kitchen-counter': {
    folder: 'kitchen-counter',
    dimensions: [1.96, 0.73, 0.63],
    offset: [0.0012, 0, -0.0004],
    rotation: [0, 0, 0],
  },
  fridge: {
    folder: 'fridge',
    dimensions: [0.7, 1.92, 0.72],
    offset: [0, 0, -0.0507],
    rotation: [0, 0, 0],
  },
  toilet: {
    folder: 'toilet',
    dimensions: [0.42, 0.82, 0.72],
    offset: [0, 0, -0.2393],
    rotation: [0, 0, 0],
  },
  'shower-square': {
    folder: 'shower-square',
    dimensions: [0.81, 1.8, 0.81],
    offset: [0.4, 0, -0.3995],
    rotation: [0, 0, 0],
  },
  bathtub: {
    folder: 'bathtub',
    dimensions: [2.34, 0.79, 1.11],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  'bathroom-sink': {
    folder: 'bathroom-sink',
    dimensions: [1.83, 0.97, 0.63],
    offset: [0.1037, 0, 0.0221],
    rotation: [0, 0, 0],
  },
  sofa: {
    folder: 'sofa',
    dimensions: [2.06, 0.74, 1.01],
    offset: [-0.0023, 0.009, 0.0459],
    rotation: [0, 0, 0],
  },
  'indoor-plant': {
    folder: 'indoor-plant',
    dimensions: [0.69, 1.63, 0.83],
    offset: [-0.0506, 0, 0.0664],
    rotation: [0, 0, 0],
  },
  'small-indoor-plant': {
    folder: 'small-indoor-plant',
    dimensions: [0.4, 0.67, 0.38],
    offset: [-0.0106, 0, 0.0067],
    rotation: [0, 0, 0],
  },
  'rectangular-carpet': {
    folder: 'rectangular-carpet',
    dimensions: [2.78, 0.04, 1.81],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  'round-carpet': {
    folder: 'round-carpet',
    dimensions: [1.99, 0.05, 1.99],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  'recessed-light': {
    folder: 'recessed-light',
    dimensions: [0.23, 0.06, 0.23],
    offset: [0, 0.0057, 0],
    rotation: [0, 0, 0],
    attachTo: 'ceiling',
    interactive: {
      controls: [
        { kind: 'toggle' },
        {
          kind: 'slider',
          label: 'Intensity',
          min: 0,
          max: 100,
          unit: '%',
          displayMode: 'dial',
          default: 100,
        },
      ],
      effects: [{ kind: 'light', intensityRange: [0, 2], color: SCENE_PALETTE.catalogLight, offset: [0, -0.1, 0] }],
    },
  },
  'ceiling-lamp': {
    folder: 'ceiling-lamp',
    dimensions: [0.55, 0.86, 0.55],
    offset: [0, 0.8545, 0],
    rotation: [0, 0, 0],
    attachTo: 'ceiling',
    interactive: {
      controls: [
        { kind: 'toggle' },
        {
          kind: 'slider',
          label: 'Intensity',
          min: 0,
          max: 100,
          unit: '%',
          displayMode: 'dial',
          default: 100,
        },
      ],
      effects: [{ kind: 'light', intensityRange: [0, 2], color: SCENE_PALETTE.catalogLight, offset: [0, -0.3, 0] }],
    },
  },
  'table-lamp': {
    folder: 'table-lamp',
    dimensions: [0.29, 0.74, 0.67],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  'round-mirror': {
    folder: 'round-mirror',
    dimensions: [0.57, 0.57, 0.05],
    offset: [0, 0.2848, 0],
    rotation: [0, 0, 0],
    attachTo: 'wall-side',
  },
  picture: {
    folder: 'picture',
    dimensions: [1.47, 0.82, 0.06],
    offset: [0, 0.41, 0],
    rotation: [0, 0, 0],
    attachTo: 'wall-side',
  },
  bookshelf: {
    folder: 'bookshelf',
    dimensions: [0.93, 1.99, 0.33],
    offset: [0, 0, 0.0032],
    rotation: [0, 0, 0],
  },
  'kitchen-shelf': {
    folder: 'kitchen-shelf',
    dimensions: [2.21, 0.89, 0.52],
    offset: [-0.0009, 0.4478, 0],
    rotation: [0, 0, 0],
    attachTo: 'wall-side',
  },
  hood: {
    folder: 'hood',
    dimensions: [1.21, 0.52, 0.51],
    offset: [0, 0.2718, 0],
    rotation: [0, 0, 0],
    attachTo: 'wall-side',
  },
  stove: {
    folder: 'stove',
    dimensions: [0.92, 0.85, 0.76],
    offset: [0.0043, 0, -0.0505],
    rotation: [0, 0, 0],
  },
  stool: {
    folder: 'stool',
    dimensions: [0.52, 1.16, 0.55],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  dresser: {
    folder: 'dresser',
    dimensions: [1.23, 0.73, 0.61],
    offset: [0, 0, -0.0066],
    rotation: [0, 0, 0],
  },
  television: {
    folder: 'television',
    dimensions: [1.62, 1.07, 0.38],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  'livingroom-chair': {
    folder: 'livingroom-chair',
    dimensions: [1.1, 0.75, 1.07],
    offset: [0, 0.0001, 0.0053],
    rotation: [0, 0, 0],
  },
  'floor-lamp': {
    folder: 'floor-lamp',
    dimensions: [0.7, 1.86, 0.69],
    offset: [0.0341, 0.0045, 0.0219],
    rotation: [0, 0, 0],
    interactive: {
      controls: [
        { kind: 'toggle' },
        {
          kind: 'slider',
          label: 'Intensity',
          min: 0,
          max: 100,
          unit: '%',
          displayMode: 'dial',
          default: 100,
        },
      ],
      effects: [{ kind: 'light', intensityRange: [0, 2], color: SCENE_PALETTE.catalogLight, offset: [0, 1.4, 0] }],
    },
  },
  sunbed: {
    folder: 'sunbed',
    dimensions: [0.86, 1.13, 1.01],
    offset: [0, 0.0516, 0.0137],
    rotation: [0, 0, 0],
  },
  palm: {
    folder: 'palm',
    dimensions: [0.525, 4.5, 0.496],
    offset: [0, 0.08, 0],
    rotation: [0, 0, 0],
    scale: [0.37, 0.37, 0.37],
  },
  'fir-tree': {
    folder: 'fir-tree',
    dimensions: [0.27, 3, 0.23],
    offset: [0.02, 0.05, -0.06],
    rotation: [0, 0, 0],
  },
  bush: {
    folder: 'bush',
    dimensions: [3, 1.04, 1.01],
    offset: [-0.1463, 0.0094, -0.113],
    rotation: [0, 0, 0],
    scale: [0.96, 0.96, 0.96],
  },
};

/** Variant đăng nhập → model Pascal; null = không có model hợp, dùng fallback. liftMm = độ cao đặt trên sàn. */
export const VARIANT_MODEL: Readonly<
  Record<string, { readonly folder: string; readonly liftMm?: number } | null>
> = {
  bed: { folder: 'double-bed' },
  nightstand: { folder: 'bedside-table' },
  tableLamp: { folder: 'table-lamp', liftMm: 480 },
  wardrobe: { folder: 'closet' },
  rug: { folder: 'rectangular-carpet' },
  plant: { folder: 'indoor-plant' },
  shower: { folder: 'shower-square' },
  wc: { folder: 'toilet' },
  basin: { folder: 'bathroom-sink' },
  mirror: { folder: 'round-mirror', liftMm: 1200 },
  artwork: { folder: 'picture', liftMm: 1400 },
  shelves: { folder: 'bookshelf' },
  table: { folder: 'dining-table' },
  chair: { folder: 'dining-chair' },
  baseRun: { folder: 'kitchen-counter' },
  upperRun: { folder: 'kitchen-shelf', liftMm: 1450 },
  hood: { folder: 'hood', liftMm: 1500 },
  hob: { folder: 'stove' },
  sink: { folder: 'kitchen-counter' },
  fridge: { folder: 'fridge' },
  stool: { folder: 'stool' },
  cabinet: { folder: 'dresser' },
  sofa: { folder: 'sofa' },
  sconce: null,
  tv: { folder: 'television' },
  armchair: { folder: 'livingroom-chair' },
  sideTable: { folder: 'bedside-table' },
  floorLamp: { folder: 'floor-lamp' },
  bench: null,
  pendant: { folder: 'ceiling-lamp', liftMm: 1500 },
  vase: null,
  lounger: { folder: 'sunbed' },
  planter: { folder: 'small-indoor-plant' },
  bamboo: { folder: 'fir-tree' },
  shrub: { folder: 'bush' },
};

export const modelSrcOf = (folder: string): string => `/items/${folder}/model.glb`;
export const thumbnailOf = (folder: string): string => `/items/${folder}/thumbnail.webp`;
