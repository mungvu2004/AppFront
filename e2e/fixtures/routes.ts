/**
 * Dựng URL cho bài e2e — từ `ROUTES`/`ROUTE_PATTERNS`, không chuỗi tay.
 *
 * Một đường dẫn viết tay trong bài là một chuỗi không ai kiểm; đổi tên route thì
 * bài chỉ hỏng lúc chạy. Nhập từ `src/routes/paths` (tệp không nhập gì, chạy được
 * trong Node — xem docblock của nó), rồi chỉ thêm đúng hai thứ nó không có.
 */
import { ROUTES, ROUTE_PATTERNS } from '../../src/routes/paths';

export { ROUTES, ROUTE_PATTERNS };

/**
 * Đường không tồn tại trong `ROUTES` — ngoại lệ hợp lệ của "không chuỗi tay",
 * vì thứ cần thử chính là đường không có route.
 */
export const UNKNOWN_PATH = '/duong-khong-ton-tai-xyz';

/** `/login?next=<đích>` — đích được mã hoá, nên `//x` hay `a?b#c` đi nguyên vẹn. */
export function loginUrl(next?: string): string {
  return next === undefined ? ROUTES.login : `${ROUTES.login}?next=${encodeURIComponent(next)}`;
}

/** Phần `pathname + search + hash` của một URL đầy đủ — thứ bài khẳng định. */
export function pathOf(url: string): string {
  const { pathname, search, hash } = new URL(url);
  return `${pathname}${search}${hash}`;
}
