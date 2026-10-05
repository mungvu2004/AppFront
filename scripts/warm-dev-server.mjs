/*
 * Làm ấm máy chủ dev TRƯỚC khi giao cho Playwright.
 *
 * Máy chủ Vite "sẵn sàng" (trả `/`) chưa có nghĩa là trang mở được trong 30 s.
 * Trên một bản checkout lạnh (chưa có `node_modules/.vite`), lượt `page.goto`
 * đầu tiên kéo theo cả lượt tối ưu phụ thuộc lẫn lượt biên dịch cả cây module —
 * và `fullyParallel` bắn sáu trang cùng lúc vào đúng lúc ấy. Đo 2026-10-05,
 * `viewer3d.spec` lạnh: đúng sáu bài khởi đầu đỏ (`page.goto` hết 30 s, hoặc mô
 * hình chưa dựng sau 20 s), mọi bài sau xanh.
 *
 * Cách làm: đi theo đồ thị module như trình duyệt sẽ đi — từ `/src/main.tsx`,
 * theo mọi `import`/`from`/`import()` có đường dẫn tuyệt đối trong mã Vite trả
 * về, KỂ CẢ `import()` lười của từng route — để Vite dịch và tối ưu phụ thuộc
 * xong trước bài đầu tiên. Khi lượt tối ưu đổi mã băm `?v=`, URL cũ trả 504
 * ("Outdated Optimize Dep"); nên đi lại cả đồ thị cho tới khi MỘT lượt đi trọn
 * mà không gặp 5xx nào và tập URL trùng với lượt trước. Có trần thời gian: quá
 * trần thì ném lỗi, không chạy bài nào trên một máy chủ chưa ấm.
 */

import http from 'node:http';

const IMPORT_PATTERN = /(?:\bfrom|\bimport)\s*\(?\s*["'](\/(?!\/)[^"'\s]+)["']/g;

/** Mọi đường dẫn tuyệt đối mà một module đã dịch nhập tới (tĩnh và `import()`). */
export const extractImports = (code) => {
  const found = new Set();
  for (const match of code.matchAll(IMPORT_PATTERN)) {
    found.add(match[1]);
  }

  return [...found];
};

const CONCURRENCY = 8;

/**
 * GET một URL, trả mã và thân. `node:http` như `run-playwright.mjs` — không `fetch` (luật `no-fetch-outside-http`).
 * Mỗi request có hạn riêng: một máy chủ treo không được kéo lượt làm ấm quá trần chung.
 */
const get = (url, timeoutMs) =>
  new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => resolve({ body, status: response.statusCode ?? 0 }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('request quá hạn')));
    request.on('error', reject);
  });

/** Một lượt đi trọn đồ thị. Trả tập URL đã thấy và số phản hồi 5xx. */
const crawlOnce = async (baseUrl, entries, deadline) => {
  const seen = new Set(entries);
  const queue = [...entries];
  let serverErrors = 0;

  const worker = async () => {
    while (queue.length > 0) {
      if (Date.now() > deadline) {
        return;
      }

      const url = queue.shift();
      const target = new URL(url, baseUrl);
      // Chỉ đi trong máy chủ dev — một đường dẫn `//host/x` không được ra mạng ngoài.
      if (target.origin !== new URL(baseUrl).origin) {
        continue;
      }

      let response;
      try {
        response = await get(target, Math.max(1, deadline - Date.now()));
      } catch {
        serverErrors += 1;
        continue;
      }

      if (response.status >= 500) {
        serverErrors += 1;
        continue;
      }

      if (response.status !== 200) {
        continue;
      }

      for (const next of extractImports(response.body)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return { seen, serverErrors };
};

export const warmDevServer = async (
  baseUrl,
  { entries = ['/@vite/client', '/src/main.tsx'], timeoutMs, log = console.log },
) => {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let previous = null;

  for (let pass = 1; ; pass += 1) {
    const { seen, serverErrors } = await crawlOnce(baseUrl, entries, deadline);

    if (Date.now() > deadline) {
      throw new Error(
        `Làm ấm máy chủ dev quá trần ${timeoutMs} ms (lượt ${pass}, ${seen.size} module).`,
      );
    }

    const stable =
      serverErrors === 0 &&
      previous !== null &&
      previous.size === seen.size &&
      [...seen].every((url) => previous.has(url));

    if (stable) {
      log(`Máy chủ dev đã ấm: ${seen.size} module, ${pass} lượt, ${Date.now() - startedAt} ms.`);
      return { modules: seen.size, ms: Date.now() - startedAt, passes: pass };
    }

    previous = seen;
  }
};
