/**
 * Hình minh hoạ trang trí của `AccessDenied`: mặt bằng nằm sau một cánh cửa đóng.
 * V-14: vẽ bằng họ nét mực chung `InkPlan` (cùng 404 / trạng thái rỗng / landing),
 * thay bản cũ phóng viewBox 24 lên 120px thành cửa nét dày ~6px.
 * Không ổ khoá, không màu trạng thái (A1). `aria-hidden` — `h2` đã nói hết nghĩa.
 */

import { InkPlan } from '@/components/feedback/InkPlan';

import { ILLUSTRATION_SIZE_PX } from './accessDeniedModel';

export function AccessDeniedPlan() {
  return <InkPlan variant="closed-door" size={ILLUSTRATION_SIZE_PX} />;
}
