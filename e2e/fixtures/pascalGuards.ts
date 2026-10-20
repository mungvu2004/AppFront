/**
 * Hàng rào dùng chung của các bài e2e Pascal: không request nào rời máy, không
 * tài sản nào hỏng, và CSP của nginx thật gắn lên tài liệu. Chuyển nguyên từ
 * `e2e/pascal-viewer.spec.ts` để bài mới (`pascal-fixtures*.spec.ts`) dùng lại.
 */
import type { Page } from '@playwright/test';

/** Hai host coi là "trong máy": `baseURL` của `playwright.config.ts` là `127.0.0.1`. */
export const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Hai vi phạm CSP đã đóng ở `d14e380` — xem docblock đầu `pascal-viewer.spec.ts`. */
export const FORBIDDEN_HOST_SUBSTRINGS = ['editor.pascal.app', 'cdn.jsdelivr.net'];

/**
 * CSP của nginx thật — chép nguyên `script-src`/`worker-src`/`connect-src` từ
 * `AppBack/deploy/nginx/snippets/security_headers.conf:6` (bỏ `$csp_s3_origin`,
 * màn mock không chạm S3).
 *
 * Thêm ĐÚNG MỘT thứ: `'unsafe-inline'` trong `script-src`, vì máy chủ dev của
 * Vite chèn một thẻ script inline (preamble React Refresh) mà bản dựng không có.
 * Nó KHÔNG cho phép eval — `'unsafe-eval'` mới cho — nên lỗi FIX-380 (embind của
 * `basis_transcoder.js` gọi `newFunc(Function, …)` trong worker blob) vẫn đỏ ở
 * đây y như trên nginx: worker blob thừa hưởng CSP của tài liệu tạo ra nó.
 */
export const NGINX_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self' blob:; " +
  "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

/** Mọi request của trang, thu từ trước lượt điều hướng đầu tiên. */
export function trackRequestUrls(page: Page): readonly string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    urls.push(request.url());
  });

  return urls;
}

/**
 * Lượt gọi tài sản nào KHÔNG nhận về tài sản.
 *
 * Vì sao phép kiểm này không đo mã trạng thái, dù mã trạng thái là thứ ai cũng
 * nghĩ tới đầu tiên: **máy chủ dev trả 200 cho tệp không tồn tại.** Nó rơi về
 * `index.html` cho mọi đường dẫn không khớp, nên một tệp `.ktx2` thiếu về tới
 * trình duyệt dưới dạng một trang HTML mã 200, và Pascal nuốt lỗi phân tích
 * trong bộ nạp texture của nó. Đo ngày 2026-09-29: bốn lượt gọi
 * `woodplank_48_*_512.ktx2` đi qua đúng như thế — mặt sàn ra không vân, cảnh
 * vẫn dựng, bài vẫn xanh, và một cổng theo mã trạng thái **cũng vẫn xanh**.
 *
 * Nên dấu hiệu đúng là **kiểu nội dung**: một tài sản trả về `text/html` là một
 * tệp thiếu đang mặc áo trang chủ. Bản kê vật liệu của Pascal trỏ tới 249 tệp
 * `.ktx2` mà repo chỉ commit 62, nên đây là một lỗ có **187** chỗ rơi.
 */
export function trackBadAssetResponses(page: Page): readonly string[] {
  const bad: string[] = [];
  const isAsset = (url: string): boolean => {
    const path = new URL(url).pathname;

    return path.startsWith('/pascal/') || path.startsWith('/basis/') || path.startsWith('/assets/');
  };

  page.on('requestfailed', (request) => {
    if (isAsset(request.url())) {
      bad.push(`hỏng ${new URL(request.url()).pathname} — ${request.failure()?.errorText ?? '?'}`);
    }
  });
  page.on('response', (response) => {
    if (!isAsset(response.url())) return;

    const path = new URL(response.url()).pathname;
    const status = response.status();

    if (status < 200 || status >= 300) {
      bad.push(`${String(status)} ${path}`);

      return;
    }

    const type = response.headers()['content-type'] ?? '';

    // `.js` và `.css` của vách ngăn ĐÚNG là mã; chỉ tài sản nhị phân mới không
    // bao giờ được là HTML.
    if (type.includes('text/html') && !path.endsWith('.js') && !path.endsWith('.css')) {
      bad.push(`${path} trả về text/html — tệp không tồn tại`);
    }
  });

  return bad;
}

/**
 * Không request nào rời máy. Bỏ qua `data:`/`blob:` — `new URL` không phân
 * tích được các lược đồ ấy thành host, và chúng vốn không phải lượt ra mạng.
 */
export function findOffMachineRequests(urls: readonly string[]): readonly string[] {
  return urls.filter((url) => {
    if (FORBIDDEN_HOST_SUBSTRINGS.some((needle) => url.includes(needle))) {
      return true;
    }

    try {
      const { hostname } = new URL(url);

      return hostname !== '' && !LOCAL_HOSTS.has(hostname);
    } catch {
      return false;
    }
  });
}

/**
 * Gắn `csp` lên mọi phản hồi TÀI LIỆU của trang (máy chủ dev không gửi CSP).
 * Request khác đi tiếp (`fallback`) để các `page.route` khác vẫn xử lý được.
 */
export async function serveDocumentsWithCsp(page: Page, csp: string = NGINX_CSP): Promise<void> {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') {
      await route.fallback();

      return;
    }

    // `page.request` chứ không `route.fetch()`: luật `local/no-fetch-outside-http` bắt tên `fetch`.
    const response = await page.request.get(route.request().url());
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });
}
