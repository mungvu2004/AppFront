/**
 * Nửa còn thiếu của tầng truy vấn cho MỘT dự án.
 *
 * ## Vì sao file này tồn tại, và vì sao nó KHÔNG phải một tầng query thứ hai
 *
 * Khảo sát `data-mobile-contract.md` mục (a) đã đọc hết `src/lib/query/` — đúng
 * bảy file — và chốt: **không có `projectQueries.ts`**. Khoá thì CÓ
 * (`queryKeys.project.detail(projectId)`), đường API thì CÓ
 * (`ENDPOINTS.projects.read` qua `ApiClient.projects.read`), nhưng chưa ai viết
 * hàm nối hai thứ ấy lại. Đó đúng là cảnh mà chính docblock của
 * `libraryQueries.ts` mô tả cho miền `library` TRƯỚC khi file đó ra đời.
 *
 * `src/lib/**` là thư mục CẤM SỬA trong lượt này, nên nửa còn thiếu được viết
 * ngay trong thư mục màn — cùng lối đi mà `MeasurementTool` đã dùng khi nó tự
 * `useMutation(saveMeasurement(...))` thay vì thêm file vào `src/lib/mutations`.
 * Cái được dựng lại ở đây là MỘT phép nối; khoá, bậc cache, hình dạng lỗi và
 * `QueryClient` đều vẫn là của `src/lib/query`. Không có nguồn sự thật thứ hai.
 *
 * ## Ba nguyên tắc chép nguyên từ `libraryQueries.ts:82-89`
 *
 * 1. Nhận `Pick<ProjectsApi, 'read'>` chứ không cả `ApiClient` — cổng hẹp, và
 *    một bài kiểm dựng đúng một hàm giả thay vì cả một client.
 * 2. `unwrap` NÉM NGUYÊN `result.error`, không bọc lại bằng `new Error(...)`:
 *    `createQueryClient` đã có `normalizeQueryError → toAppError` nhận ra đúng
 *    hình dạng ấy, và bọc lại là làm hỏng phép nhận dạng đó.
 * 3. KHÔNG đặt `staleTime` ở đây. Bậc cache đặt một lần tại `createQueryClient`
 *    qua `listCachePolicyDefaults()`; miền `project` không có mục riêng trong
 *    `TIER_BY_DOMAIN` nên rơi về bậc `default` MỘT CÁCH CHỦ Ý — 30 giây stale,
 *    10 phút gc, đúng nhịp một màn mở lên ở công trường rồi tắt đi.
 */

import type { ApiResult, ProjectsApi } from '@/api/client';
import type { Project } from '@/api/contracts';
import { queryKeys } from '@/lib/query/queryKeys';

/** Khoá của một dự án theo id — `['project', 'detail', projectId]`, đã đông lạnh. */
export type ProjectDetailQueryKey = ReturnType<typeof queryKeys.project.detail>;

/** Đúng hai trường `useQuery` cần; mọi trường khác là mặc định của client. */
export interface ProjectDetailQueryOptions {
  readonly queryFn: (context: { readonly signal: AbortSignal }) => Promise<Project>;
  readonly queryKey: ProjectDetailQueryKey;
}

/**
 * `ApiResult` → dữ liệu, hoặc ném nguyên lỗi cho react-query bắt.
 *
 * Bản sao thứ ba của cùng bốn dòng đã có ở `libraryQueries.ts:52-60` và
 * `usersQueries.ts:53-61`. Hai bản kia giống hệt nhau và cố ý không được gom
 * lại; gom nó nghĩa là thêm một file vào `src/lib/query`, thứ lượt này không
 * được chạm.
 */
async function unwrap<T>(result: Promise<ApiResult<T>>): Promise<T> {
  const settled = await result;

  if (!settled.ok) {
    throw settled.error;
  }

  return settled.data;
}

/**
 * Một dự án, đọc qua khoá của `src/lib/query`.
 *
 * @param projectsApi Cổng hẹp — chỉ `read`.
 * @param projectId Mã dự án trên đường dẫn `/m/du-an/:projectId`.
 * @returns Tuỳ chọn đưa thẳng vào `useQuery`.
 *
 * @example
 * const projectQuery = useQuery(projectDetailQueryOptions(apiClient.projects, projectId));
 */
export function projectDetailQueryOptions(
  projectsApi: Pick<ProjectsApi, 'read'>,
  projectId: string,
): ProjectDetailQueryOptions {
  return {
    queryFn: ({ signal }) => unwrap(projectsApi.read({ projectId, signal })),
    queryKey: queryKeys.project.detail(projectId),
  };
}
