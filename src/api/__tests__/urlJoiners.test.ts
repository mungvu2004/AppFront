/**
 * Hai hàm ghép đường, một bảng đầu vào, cùng một kết quả.
 *
 * `toApiUrl` (`src/api/endpoints.ts`) và `resolveAuthUrl`
 * (`src/lib/auth/bootstrap.ts`) cố ý là hai bản riêng: `src/lib/auth/**` không
 * được nhập `src/api` (CLAUDE.md mục 0.4), nên tầng phiên phải mang bản của
 * nó. Nhưng "hai bản" chỉ an toàn khi chúng **không lệch nhau** — hai docblock
 * chéo nhau bảo "sửa một bên thì đọc bên kia" sẽ vô dụng nếu không ai đo xem
 * hai bên đang khác gì.
 *
 * Bảng này là chỗ đo ấy. Nó từng bắt ba chỗ lệch thật (review MNT-07):
 *
 * | đầu vào | `toApiUrl` cũ | `resolveAuthUrl` |
 * |---|---|---|
 * | `('http://h/api', '/s/x?since=5')` | `…/s/x%3Fsince=5` | `…/s/x?since=5` |
 * | `('http://h/api', '/s/x#frag')`    | `…/s/x%23frag`    | `…/s/x#frag`    |
 * | `path = 'ws://x/y'`                | `http://h/api/ws://x/y` | `ws://x/y` |
 *
 * Nguồn lệch: `toApiUrl` nhận diện scheme bằng `^https?:` (bỏ sót `ws:`), và
 * gán `base.pathname = …`, mà setter ấy của WHATWG URL mã hoá `?` thành `%3F`
 * và `#` thành `%23`. Đã đưa `toApiUrl` về đúng thuật toán của `resolveAuthUrl`.
 *
 * File test **không** tạo đường nhập giữa hai tầng sản phẩm — ranh giới của
 * mục 0.4 vẫn nguyên.
 */

import { describe, expect, it } from 'vitest';

import { toApiUrl } from '../endpoints';
import { resolveAuthUrl } from '@/lib/auth/bootstrap';

/** `[nhãn, baseUrl, path, kết quả cả hai hàm phải trả về]`. */
const CASES: ReadonlyArray<readonly [string, string, string, string]> = [
  ['base mang /api', 'http://h/api', '/auth/refresh', 'http://h/api/auth/refresh'],
  ['base không có tiền tố', 'http://h', '/auth/refresh', 'http://h/auth/refresh'],
  ['base có dấu / thừa', 'http://h/api/', '/auth/logout', 'http://h/api/auth/logout'],
  ['path đã mang tiền tố', 'http://h/api', '/api/auth/refresh', 'http://h/api/auth/refresh'],
  ['path chính là tiền tố', 'http://h/api', '/api', 'http://h/api'],
  ['path không có dấu / đầu', 'http://h/api', 'auth/refresh', 'http://h/api/auth/refresh'],
  ['tiền tố nhiều tầng', 'http://h/a/b', '/streams/x', 'http://h/a/b/streams/x'],

  /* Ba ca dưới là chính ba chỗ từng lệch. */
  ['giữ query', 'http://h/api', '/streams/x?since=5', 'http://h/api/streams/x?since=5'],
  ['giữ fragment', 'http://h/api', '/streams/x#frag', 'http://h/api/streams/x#frag'],
  ['scheme khác http', 'http://h/api', 'ws://x/y', 'ws://x/y'],

  ['path tuyệt đối http', 'http://h/api', 'https://khac/z', 'https://khac/z'],
];

describe('toApiUrl ↔ resolveAuthUrl', () => {
  it.each(CASES)('%s', (_label, baseUrl, path, expected) => {
    expect(toApiUrl(baseUrl, path)).toBe(expected);
    expect(resolveAuthUrl(baseUrl, path)).toBe(expected);
  });

  it('khớp nhau trên mọi ca của bảng, không chỉ khớp giá trị mong đợi', () => {
    CASES.forEach(([, baseUrl, path]) => {
      expect(toApiUrl(baseUrl, path)).toBe(resolveAuthUrl(baseUrl, path));
    });
  });
});
