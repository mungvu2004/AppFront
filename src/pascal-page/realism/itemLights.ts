/**
 * Gói 1 (review2): đèn đồ (đèn bàn/cây/trần/tường) đặt sát tường làm cháy trắng mảng tường, và
 * không giới hạn tầm (distance 0) nên sáng xuyên sang phòng bên. Vendor `item-light-system.tsx` +
 * `glb-interactive.tsx` gọi hai hàm dưới (luật scripts/realism/r8-pack1.mjs). Cờ `materials` tắt → y cũ.
 */
import { DAY_THEME_ID } from '../renderLook';
import { useRealism } from './store';

/** Cường độ còn lại so với dữ liệu đồ (0,4 = bớt 60 %; 0,6 vẫn cháy tường ở review2). */
export const ITEM_LIGHT_SCALE = 0.4;
/** Tầm sáng tối đa (m) ~ một phòng; three tắt dần mượt tới đây. */
export const ITEM_LIGHT_DISTANCE = 4;

const on = () => useRealism.getState().flags.materials;

/** Ban ngày: đèn trong nhà tắt (thẻ Ánh sáng hứa vậy; nắng + HDRI lo). Nắng chiều giữ đèn. */
export function itemLightIntensity(value: number, sceneTheme?: string): number {
  if (!on()) return value;
  return sceneTheme === DAY_THEME_ID ? 0 : value * ITEM_LIGHT_SCALE;
}

/** Pool gốc của vendor (`item-light-system.tsx`). */
export const ITEM_LIGHT_POOL = 12;

/**
 * Số PointLight của pool đèn đồ. TSL (three r186) sinh mã cho từng đèn bất kể cường độ, nên 12 đèn
 * cường độ 0 ban ngày vẫn nằm trong mọi shader có ánh sáng. Ban ngày + cờ `materials` (đèn đồ tắt,
 * `itemLightIntensity` = 0) → 0 đèn. Đổi chủ đề là thao tác người dùng: đổi số đèn → dựng lại shader một lần.
 */
export function itemLightPoolSize(sceneTheme: string | undefined, materials = on()): number {
  return materials && sceneTheme === DAY_THEME_ID ? 0 : ITEM_LIGHT_POOL;
}

/** Hook cho vendor: theo dõi cả cờ `materials` để bật/tắt cờ thì pool đúng lại. */
export function useItemLightPoolSize(sceneTheme: string | undefined): number {
  return itemLightPoolSize(sceneTheme, useRealism((s) => s.flags.materials));
}

export function itemLightDistance(distance: number): number {
  return on() && (distance <= 0 || distance > ITEM_LIGHT_DISTANCE) ? ITEM_LIGHT_DISTANCE : distance;
}
