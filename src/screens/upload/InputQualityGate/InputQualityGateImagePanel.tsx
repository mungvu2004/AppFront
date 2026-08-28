/**
 * Cột trái của Cổng chất lượng đầu vào — vẽ ảnh, đường nghiêng, các vùng và
 * thanh so sánh trước/sau.
 *
 * Khung tối thiểu do người viết `InputQualityGate.tsx` dựng. Toàn bộ nội dung
 * (vẽ vùng, đường nghiêng, kéo góc, thanh trượt so sánh) do lớp Layer 2 phụ
 * trách panel ảnh thay thế.
 */

import type { InputQualityImagePanelProps } from './types';

export function InputQualityGateImagePanel({ image }: InputQualityImagePanelProps) {
  return (
    <section aria-label="Ảnh bản vẽ" className="flex h-full flex-col gap-3">
      <img alt={image.altText} className="w-full rounded-[8px]" src={image.src} />
    </section>
  );
}
