/**
 * Thay `next/image` bằng một thẻ `<img>` thường.
 *
 * `vendor/pascal/packages/editor` được viết cho Next.js: 26 tệp nhập
 * `next/image`, 1 tệp nhập `next/link`. AppFront chạy Vite, không chạy Next,
 * nên hai đường nhập ấy phải được thay. Đã đếm bề mặt Next.js của gói: **đóng
 * lại ở đúng hai module này** — không `next/router`, `next/head` hay
 * `next/navigation`. Xem `vendor/pascal/NGUON.md`.
 *
 * Việc của tệp này chỉ là nuốt các prop riêng của Next (`priority`, `fill`,
 * `quality`, `unoptimized`, `placeholder`, `blurDataURL`, `loader`) để chúng
 * không rơi xuống DOM và sinh cảnh báo React về thuộc tính lạ.
 */
import type { ImgHTMLAttributes } from 'react';

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'placeholder'> & {
  src: string | { src: string };
  priority?: boolean;
  fill?: boolean;
  quality?: number;
  unoptimized?: boolean;
  placeholder?: string;
  blurDataURL?: string;
  loader?: unknown;
};

export default function Image({
  src,
  priority: _priority,
  fill: _fill,
  quality: _quality,
  unoptimized: _unoptimized,
  placeholder: _placeholder,
  blurDataURL: _blurDataURL,
  loader: _loader,
  ...rest
}: ImageProps) {
  return <img src={typeof src === 'string' ? src : src.src} {...rest} />;
}
