/**
 * Shared registry constants (P7, P8). Re-exported by P7.ts / P8.ts so specs keep their imports.
 *
 * Exports:
 *   type FamilyId = 'wallSegmentation' | 'openingAndFurnitureDetection' | 'dimensionReading'
 *   FAMILY_LABEL: Readonly<Record<FamilyId, string>>   radio labels (useModelRegistry.ts:71-75)
 * Kept per pack (different signature): guardWrites (P3: page; P7: page, method, path), selectFamily, FAMILY_ORDER.
 */
export type FamilyId = 'wallSegmentation' | 'openingAndFurnitureDetection' | 'dimensionReading';
export const FAMILY_LABEL: Readonly<Record<FamilyId, string>> = {
  wallSegmentation: 'Tách lớp tường',
  openingAndFurnitureDetection: 'Nhận diện cửa và đồ đạc',
  dimensionReading: 'Đọc kích thước',
};
