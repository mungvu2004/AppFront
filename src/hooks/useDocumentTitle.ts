import { useEffect } from 'react';

const APP_NAME = 'AppFront';

/** Đặt tiêu đề tab `"<title> · AppFront"`; `null` (chưa biết tên màn) thì chỉ còn `"AppFront"`. */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    document.title = title === null || title === '' ? APP_NAME : `${title} · ${APP_NAME}`;
  }, [title]);
}
