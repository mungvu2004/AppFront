import type { SVGProps } from 'react';

/**
 * Dấu hiệu thương hiệu: góc tường và cung mở cửa vẽ như ký hiệu mặt bằng — nét mực, một màu
 * `currentColor`, thay khối hộp `Box` của lucide. Trang trí thuần nên `aria-hidden`; tên app đi
 * kèm bằng chữ ở nơi gọi.
 */
export function BrandMark({ size = 20, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {/* Góc tường: tường trái + đoạn tường trên, chừa lỗ cửa 10 → 20 */}
      <path d="M4 21V4h6M20 4h1" strokeWidth={2.5} strokeLinecap="square" />
      {/* Cánh cửa bản lề ở (20,4) và cung quét của nó */}
      <path d="M20 4v10" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M10 4a10 10 0 0 0 10 10" strokeWidth={1} />
    </svg>
  );
}
