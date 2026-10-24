/**
 * Chọn mô hình đồ đạc theo phong cách (J7): vai trò suy từ loại + hình hộp bao, ứng viên =
 * danh sách ưu tiên của phong cách ∩ catalog của vai trò mà vừa hộp (fill ≥ 0,6), chọn
 * bằng băm FNV-1a — cùng phòng + cùng vai trò thì cùng mô hình; cây và thảm băm theo món.
 *
 * Hàm thuần của (đồ đạc, phong cách, công năng phòng): không ngẫu nhiên, không phụ thuộc
 * thứ tự mảng. Giữ các cổng của `furnitureModelOf` (toPascal.ts): sofa và bàn trà chỉ ở
 * phòng khách; variant không có mô hình (`VARIANT_MODEL[v] === null`) đi đường hình hộp.
 */

import type { Furniture, RoomUsage } from '@/domain/spatial/types';
import { millimetres, millimetresToMetres } from '@/domain/units/types';

import { CATALOG_MODELS, VARIANT_MODEL } from './furnitureCatalog';
import type { SceneStyle } from './sceneStyles';

export type FurnitureRole =
  | 'doubleBed'
  | 'singleBed'
  | 'closet'
  | 'dresser'
  | 'bookshelf'
  | 'diningChair'
  | 'armchair'
  | 'sofa'
  | 'nightstand'
  | 'coffeeTable'
  | 'desk'
  | 'diningTable'
  | 'fridge'
  | 'counter'
  | 'toilet'
  | 'bathtub'
  | 'shower'
  | 'basin'
  | 'plant'
  | 'smallPlant'
  | 'rug'
  | 'roundRug'
  | 'stair'
  /** Món có `variant` mà mô hình không thuộc vai trò nào (đèn, gương, tranh…). */
  | 'fixed';

/** Catalog của từng vai trò, mô hình mặc định đứng đầu. */
const ROLE_MODELS: Readonly<Record<FurnitureRole, readonly string[]>> = {
  doubleBed: ['double-bed'],
  singleBed: ['single-bed'],
  closet: ['closet'],
  dresser: ['dresser'],
  bookshelf: ['bookshelf'],
  diningChair: ['dining-chair', 'stool', 'office-chair'],
  armchair: ['livingroom-chair'],
  sofa: ['sofa'],
  nightstand: ['bedside-table'],
  coffeeTable: ['coffee-table'],
  desk: ['office-table', 'dining-table'],
  diningTable: ['dining-table'],
  fridge: ['fridge'],
  // Không dùng 'kitchen-counter' (hộp trơn): tủ có tay nắm trước, dãy dài có chậu rửa vừa hơn.
  counter: ['kitchen-cabinet', 'kitchen'],
  toilet: ['toilet'],
  bathtub: ['bathtub'],
  shower: ['shower-square'],
  basin: ['bathroom-sink'],
  plant: ['indoor-plant', 'small-indoor-plant'],
  smallPlant: ['small-indoor-plant', 'indoor-plant'],
  rug: ['rectangular-carpet', 'round-carpet'],
  roundRug: ['round-carpet', 'rectangular-carpet'],
  stair: [],
  fixed: [],
};

/** Vai trò băm theo từng món (mỗi cây/thảm một kiểu), còn lại theo phòng. */
const PER_ITEM_ROLES: ReadonlySet<FurnitureRole> = new Set(['plant', 'smallPlant', 'rug', 'roundRug']);

const metresOf = (valueMm: number): number => millimetresToMetres(millimetres(valueMm));

type Shaped = Pick<Furniture, 'kind' | 'variant' | 'boundingBox' | 'rotationDeg'> & Partial<Pick<Furniture, 'heightMm'>>;

/** Cạnh ngắn/dài của mặt bằng (m) — không phụ thuộc hộp đã xoay 90° hay chưa. */
const footprintOf = (f: Shaped): readonly [number, number] => {
  const w = metresOf(f.boundingBox.max.x - f.boundingBox.min.x);
  const d = metresOf(f.boundingBox.max.y - f.boundingBox.min.y);
  return [Math.min(w, d), Math.max(w, d)];
};

const roleOfFolder = (folder: string): FurnitureRole =>
  (Object.keys(ROLE_MODELS) as FurnitureRole[]).find((role) => ROLE_MODELS[role][0] === folder) ?? 'fixed';

const COFFEE_TABLE_MAX_MM = 500;

/**
 * Mô hình của variant; variant không có mô hình (null) coi như không có variant.
 * Bàn `table` thấp hơn 0,5 m là bàn trà (F-LIVING-COFFEE 900 × 900 × 420), không phải bàn ăn.
 */
const variantModelOf = (f: Shaped) => {
  if (f.variant === undefined) return null;
  if (f.variant === 'table' && f.heightMm !== undefined && f.heightMm < COFFEE_TABLE_MAX_MM) return { folder: 'coffee-table' };
  return VARIANT_MODEL[f.variant] ?? null;
};

/** Bàn cỡ bàn làm việc chỉ là `desk` ở các phòng này (hoặc không rõ phòng); bếp, phòng khách… là bàn ăn. */
const DESK_USAGES: ReadonlySet<RoomUsage | undefined> = new Set([undefined, 'bedroom', 'utility', 'other']);

/**
 * Vai trò của một món: có mô hình variant thì theo mô hình đó, không thì theo hình hộp.
 * Sofa và bàn trà chỉ ở phòng khách (`usage`), như `furnitureModelOf` hôm nay.
 */
export const roleOf = (f: Shaped, usage?: RoomUsage): FurnitureRole => {
  const byVariant = variantModelOf(f);
  if (byVariant) return roleOfFolder(byVariant.folder);
  const living = usage === 'livingRoom';

  const [short, long] = footprintOf(f);
  const h = f.heightMm === undefined ? undefined : metresOf(f.heightMm);

  switch (f.kind) {
    case 'stair':
      return 'stair';
    case 'bed':
      return short < 1.2 ? 'singleBed' : 'doubleBed';
    case 'wardrobe':
      if (short <= 0.4) return 'bookshelf';
      return h !== undefined && h < 1 ? 'dresser' : 'closet';
    case 'chair':
      if (living && long > 1.5) return 'sofa';
      return short >= 0.65 && long <= 1.5 ? 'armchair' : 'diningChair';
    case 'table':
      if (long < 0.6) return 'nightstand';
      if (living && h !== undefined && h < 0.5) return 'coffeeTable';
      return short <= 0.8 && long <= 1.6 && DESK_USAGES.has(usage) ? 'desk' : 'diningTable';
    case 'kitchenCabinet':
      return short >= 0.6 && long <= 0.8 ? 'fridge' : 'counter';
    case 'sanitaryFixture':
      if (short < 0.5 && long < 0.8) return 'toilet';
      if (long > 1.5) return 'bathtub';
      if (short >= 0.75 && long - short < 0.1) return 'shower';
      return 'basin';
    case 'other':
      if (h !== undefined && h < 0.05) return long - short < 0.15 * long ? 'roundRug' : 'rug';
      if (living && long > 1.5) return 'sofa';
      return short * long < 0.25 ? 'smallPlant' : 'plant';
  }
};

/** Độ vừa của mô hình với hộp bao: min(tỉ lệ cạnh)/max(tỉ lệ cạnh), 1 = cùng dáng. */
const fillOf = (f: Shaped, folder: string): number => {
  const model = CATALOG_MODELS[folder];
  if (model === undefined) return 0;
  const [short, long] = footprintOf(f);
  const [mw, , md] = model.dimensions;
  const ratios = [short / Math.min(mw, md), long / Math.max(mw, md)];
  return Math.min(...ratios) / Math.max(...ratios);
};

/** FNV-1a 32 bit. */
const fnv1a = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

const MIN_FILL = 0.6;

/**
 * Thư mục mô hình của một món theo phong cách; `null` = không có mô hình (bên gọi dựng
 * chỗ giữ chỗ). Cùng hợp đồng với `furnitureModelOf` của `toPascal.ts`, chỉ trả thư mục.
 */
export const modelFolderOf = (
  f: Pick<Furniture, 'id' | 'kind' | 'variant' | 'boundingBox' | 'rotationDeg' | 'roomId'> &
    Partial<Pick<Furniture, 'heightMm'>>,
  style: SceneStyle,
  usage?: RoomUsage,
): string | null => {
  const role = roleOf(f, usage);
  const catalogue = ROLE_MODELS[role];
  const preferred = (style.prefer[role] ?? []).filter((folder) => catalogue.includes(folder) && fillOf(f, folder) >= MIN_FILL);
  const key = PER_ITEM_ROLES.has(role) ? f.id : `${f.roomId ?? 'none'}|${role}`;
  const pickHashed = (folders: readonly string[]): string => folders[fnv1a(key) % folders.length] as string;

  const byVariant = variantModelOf(f);
  if (byVariant) {
    return preferred.some((folder) => folder !== byVariant.folder) ? pickHashed(preferred) : byVariant.folder;
  }
  if (catalogue.length === 0) return null;
  if (preferred.length > 0) return pickHashed(preferred);

  // Không ưu tiên nào vừa: mô hình mặc định nếu nó vừa (giữ dáng cảnh hôm nay), không thì
  // mô hình vừa nhất — hoà thì mô hình đứng trước.
  const [fallback] = catalogue as readonly [string, ...string[]];
  if (fillOf(f, fallback) >= MIN_FILL) return fallback;
  return catalogue.reduce((best, folder) => (fillOf(f, folder) > fillOf(f, best) ? folder : best));
};
