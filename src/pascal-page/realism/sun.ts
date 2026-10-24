/**
 * Hướng nắng (thẻ Ánh sáng): xoay đèn chính (đèn hướng số 0 của chủ đề) quanh trục đứng, giữ
 * nguyên độ cao + khoảng cách. Vendor gọi mỗi khung qua `@pascal-realism/sun`
 * (luật `scripts/realism/r9s-sun.mjs`) → đổi thanh trượt không dựng lại vật liệu/bóng.
 * Đèn vẫn cố định theo thế giới; cảnh có atmosphere (giờ trong ngày) giữ hướng của nó.
 */
import { Vector3 } from 'three';

import { useRealism } from './store';

const UP = new Vector3(0, 1, 0);

/** Xoay `v` (tại chỗ) theo `sunAzimuth` của store; 0° = hướng gốc của chủ đề, trả lại `v`. */
export function rotateSun<T extends Vector3>(v: T): T {
  const deg = useRealism.getState().sunAzimuth % 360;
  if (deg !== 0) v.applyAxisAngle(UP, (deg * Math.PI) / 180);
  return v;
}
