/**
 * Ảnh nhỏ chỉ hiện vùng đã khoanh của tờ (một tờ nhiều tầng): không canvas, chỉ CSS.
 *
 * Hộp trong mang đúng tỉ lệ của vùng (tỉ lệ ảnh gốc × tỉ lệ khung) và vừa trong hộp ngoài như
 * `object-contain`; ảnh đặt tuyệt đối, phóng `1/widthRatio` rồi dời để góc vùng khớp góc hộp.
 */

import { useState } from 'react';

import type { FloorUploadSheetRect } from './types';

const pct = (value: number): string => `${String(value * 100)}%`;

export function FloorUploadCropThumb({
  src,
  crop,
  boxAspect,
}: {
  readonly src: string;
  readonly crop: FloorUploadSheetRect;
  /** Rộng ÷ cao của hộp ngoài. */
  readonly boxAspect: number;
}) {
  // Tỉ lệ ảnh gốc chỉ biết khi ảnh tải xong; trước đó coi như trang vuông.
  const [imageAspect, setImageAspect] = useState(1);
  const aspect = (imageAspect * crop.widthRatio) / crop.heightRatio;

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-bg-surface"
      data-testid="floor-upload-crop-thumb"
      style={{ aspectRatio: String(aspect), ...(aspect >= boxAspect ? { width: '100%' } : { height: '100%' }) }}
    >
      <img
        alt=""
        className="absolute max-w-none"
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth > 0 && naturalHeight > 0) setImageAspect(naturalWidth / naturalHeight);
        }}
        src={src}
        style={{
          width: pct(1 / crop.widthRatio),
          height: pct(1 / crop.heightRatio),
          left: pct(-crop.xRatio / crop.widthRatio),
          top: pct(-crop.yRatio / crop.heightRatio),
        }}
      />
    </div>
  );
}
