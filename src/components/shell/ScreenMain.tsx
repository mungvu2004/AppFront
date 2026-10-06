import type { ReactNode } from 'react';

/**
 * Landmark `<main>` duy nhất của một màn (WCAG `landmark-one-main`, FIX-381).
 *
 * Bảng route bọc nó quanh nhóm màn không tự dựng `<main>` (`AppShell`, đăng
 * nhập, khung nhìn mô hình, màn di động tự có). `display: contents` để thẻ
 * không thành hộp bố cục — các màn con vẫn `h-full` theo cha cũ của chúng —
 * mà trình đọc màn hình vẫn thấy landmark.
 */
export function ScreenMain({ children }: { children: ReactNode }) {
  return <main className="contents">{children}</main>;
}
