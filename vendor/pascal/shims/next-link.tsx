/** Thay `next/link` bằng thẻ `<a>`. Xem chú thích ở `next-image.tsx`. */
import type { AnchorHTMLAttributes } from 'react';

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string | { pathname?: string };
  prefetch?: boolean;
};

export default function Link({ href, prefetch: _prefetch, ...rest }: LinkProps) {
  return <a href={typeof href === 'string' ? href : (href.pathname ?? '#')} {...rest} />;
}
