/**
 * Nguồn dữ liệu của màn "không tìm thấy trang" — đúng một phép đọc.
 *
 * ## Vì sao màn này có cổng riêng thay vì mượn của màn khác
 *
 * `fetchProjectList` có thật, nhưng nó nằm ở
 * `src/screens/dashboard/ProjectDashboard/projectsGateway.ts` — thư mục của MÀN
 * KHÁC. Màn không nhập chéo màn, nên cổng ở đây tự đọc bằng `ApiClient` dùng
 * chung (`client.projects.list()` → `ENDPOINTS.projects.list`), đúng khuôn
 * `notificationCenterGateway.ts`: một hàm `create…Gateway(client?, now?)` trả về
 * object khớp interface của hợp đồng, `client` mặc định `createAppApiClient()`
 * (nó tự chọn client thật hay client giả theo môi trường), `now` mặc định
 * `Date.now` để bài kiểm cắm được đồng hồ giả.
 *
 * ## Khoá RIÊNG, và vì sao lượt trước dùng chung là sai
 *
 * Khoá bộ đệm là {@link NOT_FOUND_RECENT_QUERY_KEY} = `queryKeys.project.recent()`.
 * Trước 02-10-2026 nó là `queryKeys.project.list()` — CÙNG khoá mà
 * `useProjectDashboard` dùng — với lý do "hai màn dùng chung một lượt đọc thay vì
 * mỗi màn nuôi một bản sao". Lý do ấy nghe đúng và nó **đổ**, vì hai cổng ghi hai
 * HÌNH DẠNG khác nhau vào cùng một khoá:
 *
 * - cổng này đọc `client.projects.list()` ⇒ ghi hình dạng `Project` của API;
 * - `projectsGateway.fetchProjectList()` **không gọi API nào**, nó trả
 *   `SAMPLE_PROJECTS` ⇒ hình dạng `DashboardProject`, có thêm `members`.
 *
 * Nên lợi ích đã nêu chỉ có theo chiều bảng-điều-khiển → 404. Chiều ngược thì đổ:
 * vào 404 trước rồi bấm "về danh sách dự án", bảng điều khiển đọc lại bộ đệm của
 * màn này và `ProjectCardTile.tsx:149` ném
 * `Cannot read properties of undefined (reading 'length')` ở `project.members`.
 * Đo được bằng trình duyệt thật, và mở `/` thẳng thì KHÔNG vỡ — chỉ vỡ khi điều
 * hướng trong ứng dụng, nên nó sống được khá lâu.
 *
 * Chính sách bộ đệm là
 * {@link NOT_FOUND_RECENT_CACHE_POLICY}, HỎI `resolveCachePolicy(khoá)` chứ
 * không gõ lại con số nào: miền `project` không có mục trong `TIER_BY_DOMAIN`
 * nên nó nhận bậc `'default'`, và viết `staleTime: 30_000` ở đây sẽ là dựng
 * nguồn sự thật thứ hai cho cùng một quyết định (R-71) — đúng thứ
 * `lib/query/libraryQueries.ts` đã từ chối làm, với lý do ghi ở docblock của nó.
 *
 * Cổng không tự nuôi `isLoading`/`error`: nó ném lỗi, `useQuery` ở
 * `useNotFound.ts` bắt. `hooks/useShareLinks.ts` tự viết hai trường ấy bằng tay
 * là ngoại lệ đi trước, không phải khuôn để chép.
 *
 * ## Nhãn nói "cập nhật", không nói "mở"
 *
 * Khoản 2 của hợp đồng (`notFoundModel.ts`): dữ liệu chỉ có thời điểm CẬP NHẬT
 * (`Project.updatedAt`), không có trường nào ghi lượt mở. Dán nhãn "mở gần nhất"
 * lên dữ liệu cập nhật là nói sai với người dùng, và người dùng không có cách
 * nào biết mình bị nói sai. Nên tiền tố là {@link RECENCY_LABEL_PREFIX}.
 */

import { createAppApiClient } from '@/api/appClient';
import type { ApiClient, ApiResult, Project } from '@/api/client';
import { formatTimestamp } from '@/lib/format/datetime';
import { resolveCachePolicy, type ResolvedCachePolicy } from '@/lib/query/cachePolicy';
import { queryKeys, type QueryKey } from '@/lib/query/queryKeys';
import { ROUTES } from '@/routes/paths';

import { RECENT_PROJECT_LIMIT, type NotFoundGateway, type RecentProjectVm } from './notFoundModel';

/* -------------------------------------------------------------------------- */
/* 1 — Chỗ cắm vào tầng dữ liệu dùng chung                                     */
/* -------------------------------------------------------------------------- */

/**
 * Khoá bộ đệm của lượt đọc gợi ý — lấy từ `queryKeys`, không gõ tay.
 *
 * **Một khoá một hình dạng.** Đây là khoá riêng của màn này, không phải
 * `project.list` của bảng điều khiển — xem mục "Khoá RIÊNG" ở đầu tệp để biết
 * việc dùng chung đã đổ ra sao. Cái giá phải trả là màn này không còn đọc nóng từ
 * bộ đệm của bảng điều khiển; đổi lại bảng điều khiển không còn đọc được một hình
 * dạng nó không hiểu.
 */
export const NOT_FOUND_RECENT_QUERY_KEY: QueryKey = queryKeys.project.recent();

/**
 * Chính sách bộ đệm của khoá trên — HỎI, không khai lại.
 *
 * `createQueryClient` đã đăng ký mặc định cho các miền có mục trong
 * `TIER_BY_DOMAIN`; miền `project` không có mục nên nó rơi về mặc định của
 * client. Truyền thẳng kết quả `resolveCachePolicy` vào `useQuery` làm quyết
 * định ấy hiện ra trong mã thay vì nằm ẩn, mà vẫn không sinh ra con số thứ hai.
 */
export const NOT_FOUND_RECENT_CACHE_POLICY: ResolvedCachePolicy = resolveCachePolicy(
  NOT_FOUND_RECENT_QUERY_KEY,
);

/** Tiền tố của `recencyLabel`. Xem khoản 2 của hợp đồng. */
export const RECENCY_LABEL_PREFIX = 'Cập nhật ';

/* -------------------------------------------------------------------------- */
/* 2 — Ánh xạ                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mở gói một `ApiResult`, ném lỗi khi hỏng.
 *
 * Hợp đồng nói "ném lỗi khi hỏng; tầng trên bắt và vẽ `error`", còn tầng API
 * trả `Result`. Đây là đúng một chỗ hai quy ước ấy gặp nhau. Lỗi ném ra NGUYÊN
 * VẸN, không bọc lại thành `new Error(...)`: `toAppError` nhận ra một
 * `HttpError` nguyên bản và giữ được `kind`, và chính `kind === 'network'` là
 * bằng chứng duy nhất cho phép hook nói "mất mạng" thay vì "trang đã bị xoá".
 */
function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw result.error;
  }

  return result.data;
}

/**
 * Một dự án của máy chủ thành một hàng đã dựng xong mọi chữ (A15).
 *
 * `updatedAt` đi trên dây là chuỗi ISO, còn `formatTimestamp` nhận
 * `Date | number` và HAI mốc tuyệt đối — nên `Date.parse` trước, đúng cách
 * `collaborationGateway.ts:282` đã làm. Không có hàm nào trong repo nhận thẳng
 * số mili-giây đã trôi.
 */
export function toRecentProjectVm(project: Project, nowMs: number): RecentProjectVm {
  const updatedAt = Date.parse(project.updatedAt);

  return {
    id: project.id,
    name: project.name,
    to: ROUTES.project.floors(project.id),
    recencyLabel: `${RECENCY_LABEL_PREFIX}${formatTimestamp(updatedAt, nowMs)}`,
  };
}

/* -------------------------------------------------------------------------- */
/* 3 — Cổng                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cổng thật của màn.
 *
 * Máy chủ không hứa thứ tự nào cho `projects.list`, nên độ mới được sắp ở đây
 * rồi mới cắt còn {@link RECENT_PROJECT_LIMIT} — cắt trước khi sắp sẽ giữ lại
 * ba dự án đầu danh sách chứ không phải ba dự án mới nhất, và sai đó không hiện
 * ra ở bất kỳ kiểu nào.
 */
export function createNotFoundGateway(
  client: ApiClient = createAppApiClient(),
  now: () => number = Date.now,
): NotFoundGateway {
  return {
    listRecentProjects: async () => {
      const nowMs = now();
      const projects = unwrap(await client.projects.list());

      return [...projects]
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, RECENT_PROJECT_LIMIT)
        .map((project) => toRecentProjectVm(project, nowMs));
    },
  };
}
