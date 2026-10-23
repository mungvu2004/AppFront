/**
 * Hình minh hoạ trang trí của `NotFound`: mảnh mặt bằng thiếu bức tường phải.
 * V-14: vẽ bằng họ nét mực chung `InkPlan` (cùng 403 / trạng thái rỗng / landing),
 * thay bản cũ vẽ trên viewBox 24 phóng 120px thành nét dày ~7px như ảnh hỏng.
 * `aria-hidden` — tiêu đề `h2` của `NotFound` đã nói hết nghĩa.
 */

import type { ReactElement } from 'react';

import { InkPlan } from '@/components/feedback/InkPlan';

import { ILLUSTRATION_SIZE_PX } from './notFoundModel';

export interface PlanFragmentProps {
  /** Giữ chữ ký cũ; `InkPlan` đọc `prefers-reduced-motion` bằng CSS. */
  readonly prefersReducedMotion: boolean;
}

export const PlanFragment: (props: PlanFragmentProps) => ReactElement = () => (
  <InkPlan variant="missing-wall" size={ILLUSTRATION_SIZE_PX} />
);
