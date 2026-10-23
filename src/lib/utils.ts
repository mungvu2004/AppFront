import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Cỡ chữ đặt tên trong `tailwind.config.ts` (`theme.extend.fontSize`). Không khai thì
// tailwind-merge coi `text-caption` là màu chữ và xoá nó khi gặp `text-text-*`.
export const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'body-sm', 'body', 'title-sm', 'title', 'heading', 'display'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
