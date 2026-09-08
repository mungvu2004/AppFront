import type { QueryFunction } from '@tanstack/react-query';

import type { AdminUserList, ApiResult, UserActivity, UserMembership, UsersApi } from '@/api/client';

import { queryKeys, type QueryKeyOf } from './queryKeys';

/**
 * Ba lượt đọc của phần quản trị người dùng, gói lại thành thứ react-query nhận
 * trực tiếp — T-04/T-05, D-01/D-03.
 *
 * ## Vì sao file này tồn tại
 *
 * `queryKeys.user.list` và `./cachePolicy.ts` (`TIER_BY_DOMAIN.user = 'static'`)
 * đã nằm trong repo từ trước mà KHÔNG AI tiêu thụ — một nửa đường dẫn dữ liệu:
 * có khoá, có chính sách, không có hàm nào đi lấy dữ liệu. File này là nửa còn
 * lại, dựng theo đúng khuôn `./libraryQueries.ts` đã đặt cho cùng tình huống ấy.
 * Nó KHÔNG khai lại khoá nào và KHÔNG đặt `staleTime` nào.
 *
 * ## Không có `staleTime` ở đây, và đó là chủ ý
 *
 * `createQueryClient` (`./queryClient.ts`) đã gọi `setQueryDefaults(['user'], …)`
 * cho mọi khoá bắt đầu bằng `'user'` — 5 phút, bậc `'static'`, vì bảng người
 * dùng đổi theo tuần chứ không theo phút. Viết lại con số ấy ở đây là dựng nguồn
 * sự thật thứ hai cho cùng một quyết định, đúng thứ `CACHE_POLICY` được đặt ra
 * để chặn (R-71). Muốn biết một khoá đang nhận chính sách nào thì hỏi
 * `resolveCachePolicy(queryKey)`, không đọc file này.
 *
 * ## Cổng lỗi: `ApiResult` vào, ngoại lệ ra
 *
 * `ApiClient` trả `Result` chứ không ném; react-query thì ngược lại. {@link unwrap}
 * ném NGUYÊN `result.error` — không bọc lại — vì `queryClient` đưa mọi lỗi qua
 * `normalizeQueryError` → `toAppError`, và `toAppError` nhận ra một `HttpError`
 * nguyên bản. Bọc nó vào một `Error` mới thì `kind`/`requestId`/`retryable` biến
 * mất, và luật thử lại `shouldRetry` — vốn đọc đúng `retryable` — sẽ thử lại một
 * lỗi 403 "không có quyền" mà lẽ ra phải dừng ngay. Với màn này đó là ca có thật
 * chứ không giả định: một phiên vai `viewer` gọi `users.list` bị từ chối, và
 * trạng thái "không có quyền" của A11 dựng trên đúng lỗi ấy.
 *
 * ## Cổng vào là một cổng hẹp
 *
 * Mọi hàm ở đây nhận `Pick<UsersApi, …>` chứ không cả `ApiClient`, cùng khuôn
 * với `libraryListQueryOptions`: test dựng đúng một hàm giả thay vì cả mười nhóm
 * của client, và `src/lib` không giữ tham chiếu tới thứ nó không gọi.
 *
 * ## Ba lượt đọc, không phải một
 *
 * Danh sách tải một lượt cho cả bảng; hai lượt còn lại khoá theo `userId` và chỉ
 * chạy khi có người được chọn. Gộp cả ba vào một lượt đọc "người dùng kèm mọi
 * thứ" thì mở màn phải chờ nhật ký hoạt động của một người chưa ai bấm vào.
 */

/** Ném lỗi ra để react-query nhìn thấy thất bại; xem docblock đầu file. */
async function unwrap<T>(result: Promise<ApiResult<T>>): Promise<T> {
  const settled = await result;

  if (!settled.ok) {
    throw settled.error;
  }

  return settled.data;
}

export type UsersListQueryKey = QueryKeyOf<typeof queryKeys.user.list>;
export type UserMembershipsQueryKey = QueryKeyOf<typeof queryKeys.user.memberships>;
export type UserActivityQueryKey = QueryKeyOf<typeof queryKeys.user.activity>;

/** Hình dạng tối thiểu `useQuery` / `prefetchQuery` cần: một khoá và một hàm lấy. */
export interface UsersQueryOptions<TData, TKey extends readonly unknown[]> {
  queryFn: QueryFunction<TData, TKey>;
  queryKey: TKey;
}

/**
 * Cả bảng người dùng, một lượt.
 *
 * Không nhận tham số lọc nào — màn tải một lần rồi lọc theo vai, theo trạng thái
 * và theo ô tìm tại chỗ; xem `UsersApi` (`src/api/client.ts`) cho lý do đầy đủ.
 * Trả về `AdminUserList` nguyên vẹn chứ không chỉ `users`: `total` là thứ màn cần
 * để nói "đang hiện 20 trên 137", và bóc nó ra ở đây thì màn phải đi hỏi lần nữa.
 *
 * `signal` của react-query đi thẳng xuống `ApiClient`, nên rời màn giữa chừng là
 * huỷ được lượt gọi thay vì để nó chạy hết rồi vứt kết quả.
 */
export function usersListQueryOptions(
  usersApi: Pick<UsersApi, 'list'>,
): UsersQueryOptions<AdminUserList, UsersListQueryKey> {
  return {
    queryFn: ({ signal }) => unwrap(usersApi.list({ signal })),
    queryKey: queryKeys.user.list(),
  };
}

/**
 * Những dự án một người tham gia, kèm vai TRONG từng dự án.
 *
 * Khoá theo `userId`, nên chọn người khác là một lượt đọc khác và bảng cũ vẫn
 * nằm trong cache — quay lại người vừa xem thì hiện ngay, không chờ mạng.
 */
export function userMembershipsQueryOptions(
  usersApi: Pick<UsersApi, 'memberships'>,
  userId: string,
): UsersQueryOptions<UserMembership[], UserMembershipsQueryKey> {
  return {
    queryFn: ({ signal }) => unwrap(usersApi.memberships({ signal, userId })),
    queryKey: queryKeys.user.memberships(userId),
  };
}

/**
 * Nhật ký hoạt động gần đây của một người.
 *
 * Tách khỏi {@link userMembershipsQueryOptions} dù cả hai cùng nhận `userId`:
 * hai panel hiện ở hai chỗ khác nhau và một trong hai có thể lỗi mà panel kia
 * vẫn đúng — đó chính là trạng thái `'partial'` của A11. Gộp làm một lượt đọc
 * thì một bên hỏng kéo cả hai bên về trạng thái lỗi.
 */
export function userActivityQueryOptions(
  usersApi: Pick<UsersApi, 'activity'>,
  userId: string,
): UsersQueryOptions<UserActivity[], UserActivityQueryKey> {
  return {
    queryFn: ({ signal }) => unwrap(usersApi.activity({ signal, userId })),
    queryKey: queryKeys.user.activity(userId),
  };
}
