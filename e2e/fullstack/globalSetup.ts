/**
 * Soát AppBack có mặt trước khi chạy chuỗi: biến môi trường, `GET /api/health`, và CSP của
 * nginx ở `GET /` (Draco cần `'wasm-unsafe-eval'` và `worker-src blob:`). Mỗi lượt hỏi có
 * trần {@link SETUP_REQUEST_TIMEOUT_MS}, không vòng chờ.
 */
import { request } from '@playwright/test';

import { selfCheckBodyRules } from './apiWatch';
import { SETUP_REQUEST_TIMEOUT_MS, readBaseUrl, readFullstackEnv } from './env';

export default async function globalSetup(): Promise<void> {
  selfCheckBodyRules();
  readFullstackEnv();

  const base = readBaseUrl();
  const missing = (why: string): Error =>
    new Error(`chưa có AppBack ở ${base}: xem e2e/fullstack/README.md (${why})`);
  const api = await request.newContext({ baseURL: base, timeout: SETUP_REQUEST_TIMEOUT_MS });

  try {
    const health = await api.get('/api/health').catch((error: unknown) => {
      throw missing(String(error));
    });

    if (health.status() !== 200) throw missing(`GET /api/health trả ${String(health.status())}`);

    const root = await api.get('/').catch((error: unknown) => {
      throw missing(String(error));
    });
    const csp = root.headers()['content-security-policy'] ?? '';
    const workerSrc = csp.split(';').find((directive) => directive.trim().startsWith('worker-src')) ?? '';

    if (!csp.includes("'wasm-unsafe-eval'") || !workerSrc.includes('blob:')) {
      throw missing(`CSP ở GET / thiếu 'wasm-unsafe-eval' hoặc worker-src blob: — nhận "${csp}"`);
    }
  } finally {
    await api.dispose();
  }
}
