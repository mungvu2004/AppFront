/**
 * `window.__pascalMount` do gói Pascal (`components/pascal/pascalMount.tsx`) gắn. Khai ở đây, ngoài
 * `src/components/pascal`, vì thư mục ấy kiểm kiểu bằng `tsconfig.pascal.json` (kéo mã Pascal gốc),
 * còn màn hình AppFront đọc biến này dưới `tsconfig.json`.
 */
import type { PascalMountHandle, PascalMountOptions } from '@/components/pascal/pascalMountTypes';

declare global {
  interface Window {
    __pascalMount?: { readonly mount: (element: HTMLElement, options: PascalMountOptions) => PascalMountHandle };
  }
}

export {};
