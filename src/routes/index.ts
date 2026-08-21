/**
 * Điều hướng của ứng dụng, gom về một đường nhập.
 *
 * Thư mục này có hai nửa vì chúng **không được** ở chung một file:
 *
 * - `paths.ts` là bảng chuỗi. Nó không import gì cả, nên bất kỳ ai cũng nhập được
 *   nó mà không kéo theo thứ gì.
 * - `router.tsx` là router thật. Nó lazy-import mọi màn.
 *
 * Gộp hai nửa lại thì màn hình nhập hằng đường dẫn sẽ khép thành vòng import
 * (`router` → màn → `router`), và `pnpm cycles` chặn — đã thử, ra ba điểm vòng.
 * Vì vậy **màn hình nhập `@/routes/paths`**, còn `@/routes` là chỗ cho phần vỏ
 * ứng dụng lấy `router`.
 *
 * Cùng khuôn mục D của CLAUDE.md: một khái niệm là một thư mục, `index.ts` giữ
 * nguyên đường nhập để nơi gọi không phải sửa theo.
 */

export { ROUTES, ROUTE_PATTERNS } from './paths';
export { router } from './router';
