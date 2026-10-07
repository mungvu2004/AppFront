/**
 * Biến môi trường và các trần thời gian của chuỗi FE + BE (F-14).
 *
 * `readBaseUrl()` không ném: `playwright.fullstack.config.ts` gọi nó ngay lúc nạp, và
 * `--list` phải chạy được khi chưa đặt biến nào. `readFullstackEnv()` chỉ được gọi ở
 * `globalSetup` và trong thân test, không ở cấp module.
 */
import { existsSync } from 'node:fs';

export const DEFAULT_BASE_URL = 'http://localhost:8080';

/** Trần cả chuỗi: pipeline 300 s cộng mười bước còn lại. */
export const CHAIN_TIMEOUT_MS = 900_000;
/** `expect.timeout` của config: mặc định 5 s quá mỏng cho màn chờ BE thật. */
export const EXPECT_TIMEOUT_MS = 15_000;
export const PIPELINE_TIMEOUT_MS = 300_000;
export const AUTOSAVE_TIMEOUT_MS = 15_000;
/** `use.actionTimeout` / `use.navigationTimeout`: mặc định của Playwright là 0 (chỉ trần test chặn). */
export const ACTION_TIMEOUT_MS = 30_000;
export const NAVIGATION_TIMEOUT_MS = 30_000;
/** Trần chờ một response `/api/` thường (không phải pipeline, không phải tự lưu). */
export const API_TIMEOUT_MS = 30_000;
/** Cùng số với `PASCAL_RENDER_TIMEOUT_MS` của `e2e/pascal-viewer.spec.ts`. */
export const PASCAL_RENDER_TIMEOUT_MS = 60_000;
/** Trần một lượt đọc thân response `/api/` (thân bị kẹt thì coi như không đọc được). */
export const BODY_READ_TIMEOUT_MS = 10_000;
/** Trần lưu trace khi hỏng: `tracing.stop` có thể treo khi trang đang dở điều hướng. */
export const TRACE_SAVE_TIMEOUT_MS = 30_000;
/** Trần nạp bộ giải Draco trong worker. */
export const DRACO_TIMEOUT_MS = 30_000;
/** Trần mỗi lượt hỏi của `globalSetup`. */
export const SETUP_REQUEST_TIMEOUT_MS = 5_000;

export interface FullstackEnv {
  readonly baseUrl: string;
  readonly adminEmail: string;
  readonly adminPassword: string;
  readonly drawingPng: string;
}

const nonEmpty = (name: string): string | undefined => {
  const value = process.env[name];

  return value === undefined || value.trim() === '' ? undefined : value;
};

export function readBaseUrl(): string {
  return nonEmpty('E2E_FULLSTACK_BASE_URL') ?? DEFAULT_BASE_URL;
}

/** Thiếu biến nào thì ném MỘT lỗi liệt kê hết; không bao giờ in giá trị mật khẩu. */
export function readFullstackEnv(): FullstackEnv {
  const adminEmail = nonEmpty('E2E_ADMIN_EMAIL');
  const adminPassword = nonEmpty('E2E_ADMIN_PASSWORD');
  const drawingPng = nonEmpty('E2E_DRAWING_PNG');
  const problems: string[] = [];

  if (adminEmail === undefined) problems.push('E2E_ADMIN_EMAIL');
  if (adminPassword === undefined) problems.push('E2E_ADMIN_PASSWORD');
  if (drawingPng === undefined) {
    problems.push('E2E_DRAWING_PNG');
  } else if (!drawingPng.toLowerCase().endsWith('.png') || !existsSync(drawingPng)) {
    problems.push(`E2E_DRAWING_PNG (không phải tệp .png có thật: ${drawingPng})`);
  }

  if (adminEmail === undefined || adminPassword === undefined || drawingPng === undefined || problems.length > 0) {
    throw new Error(
      `Thiếu biến môi trường cho pnpm e2e:fullstack: ${problems.join(', ')} — xem e2e/fullstack/README.md`,
    );
  }

  return { baseUrl: readBaseUrl(), adminEmail, adminPassword, drawingPng };
}
