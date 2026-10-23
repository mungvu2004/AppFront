/**
 * Gói 1 (review2): đèn đồ (đèn bàn/cây/trần/tường) đặt sát tường làm cháy trắng mảng tường, và
 * không giới hạn tầm (distance 0) nên sáng xuyên sang phòng bên. Vendor `item-light-system.tsx` +
 * `glb-interactive.tsx` gọi hai hàm dưới (luật scripts/realism/r8-pack1.mjs). Cờ `materials` tắt → y cũ.
 */
import { useRealism } from './store';

/** Cường độ còn lại so với dữ liệu đồ (0,4 = bớt 60 %; 0,6 vẫn cháy tường ở review2). */
export const ITEM_LIGHT_SCALE = 0.4;
/** Tầm sáng tối đa (m) ~ một phòng; three tắt dần mượt tới đây. */
export const ITEM_LIGHT_DISTANCE = 4;

const on = () => useRealism.getState().flags.materials;

export function itemLightIntensity(value: number): number {
  return on() ? value * ITEM_LIGHT_SCALE : value;
}

export function itemLightDistance(distance: number): number {
  return on() && (distance <= 0 || distance > ITEM_LIGHT_DISTANCE) ? ITEM_LIGHT_DISTANCE : distance;
}
