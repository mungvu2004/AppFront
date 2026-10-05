/**
 * Đọc mã dùng một lần ở `#token=…` của đường dẫn trong thư (HOP-DONG-MOI §3), rồi
 * xoá nó khỏi thanh địa chỉ.
 *
 * Mã nằm ở phần sau dấu `#` vì phần đó không bao giờ gửi lên máy chủ và không vào
 * `Referer`. Đổi lại màn phải tự dọn: để nó lại thì nó vào lịch sử, vào ô sao chép
 * đường dẫn và vào ảnh chụp màn hình. Vì thế hàm này xoá fragment **ngay trong
 * lượt gọi**, trước mọi `await` — và không bao giờ ghi mã ra log, store,
 * `sessionStorage` hay URL.
 *
 * ## Vì sao còn một bộ nhớ
 *
 * `src/main.tsx` bật StrictMode, nên hàm khởi tạo của `useState` chạy HAI lần. Lượt
 * đầu đọc và xoá fragment; lượt hai thấy URL đã sạch. Bộ nhớ theo mục lịch sử
 * (`history.state.key` của React Router, vắng thì `pathname`) cho lượt hai trả lại
 * đúng mã đó. Có `#token=` mới thì luôn đọc mới và ghi đè bộ nhớ: bộ nhớ chỉ dùng khi
 * URL không còn hash. Bộ nhớ ở biến module (sống đến khi tải lại trang), không ở
 * nơi nào bền hơn.
 */

interface FragmentTarget {
  readonly history: Pick<History, 'state' | 'replaceState'>;
  readonly location: Pick<Location, 'hash' | 'pathname' | 'search'>;
}

const remembered = new Map<string, string>();

const keyOf = (target: FragmentTarget): string => {
  const state: unknown = target.history.state;
  const key =
    typeof state === 'object' && state !== null ? (state as { readonly key?: unknown }).key : undefined;

  return typeof key === 'string' && key !== '' ? key : target.location.pathname;
};

/** Gọi trong hàm khởi tạo `useState`, không trong `useEffect`. */
export function consumeFragmentToken(target: FragmentTarget = window): string | null {
  const { history, location } = target;
  const key = keyOf(target);

  if (location.hash.length > 1) {
    const token = new URLSearchParams(location.hash.slice(1)).get('token');

    // Giữ `history.state`: React Router đọc `key` và `idx` ở đó.
    history.replaceState(history.state, '', location.pathname + location.search);

    if (token !== null && token !== '') {
      remembered.set(key, token);

      return token;
    }
  }

  return remembered.get(key) ?? null;
}

/** Chỉ cho bài kiểm: biến module sống qua các bài trong cùng một tệp. */
export function __resetFragmentTokenForTests(): void {
  remembered.clear();
}
