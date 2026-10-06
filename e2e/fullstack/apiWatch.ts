/**
 * Nhật ký response `/api/` thật, chờ một response theo method + đường, và luồng SSE qua CDP.
 *
 * Không chặn, không sửa request nào: chỉ nghe.
 */
import type { Page, Response } from '@playwright/test';

import { API_TIMEOUT_MS, BODY_READ_TIMEOUT_MS } from './env';

export interface ApiEntry {
  readonly method: string;
  /** `pathname`, không kèm query. */
  readonly path: string;
  readonly search: string;
  readonly status: number;
  /** Thân JSON đã đọc lúc response tới; `null` khi rỗng hay không phải JSON. */
  json?: unknown;
  /** Vì sao thân không đọc được (bị xả, bị huỷ, quá trần, JSON hỏng). Vắng = đọc được. */
  bodyError?: string;
  code?: string;
  requestId?: string;
}

/** Một response đã chờ, kèm thân JSON đọc NGAY lúc nó tới (không đọc lại sau điều hướng). */
export interface ApiResult {
  readonly response: Response;
  readonly json: unknown;
}

/** Kết quả một lượt đọc thân. `read: false` luôn kèm lý do — không nuốt lỗi thành `null`. */
export type BodyRead = { readonly read: true; readonly json: unknown } | { readonly read: false; readonly reason: string };

const API_PREFIX = '/api/';

/** Chặn một lời hứa bằng trần có tên: quá trần thì trả `fallback`, không treo. */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });

  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

/**
 * Phân loại một thân đã lấy được, phân biệt ba ca: rỗng (204, chunk…) là đọc được với `null`;
 * khai JSON mà rỗng hay JSON hỏng là KHÔNG đọc được (response bị huỷ giữa lúc điều hướng, chuỗi
 * thật lượt 9 bước 9); không khai JSON thì thân không phải JSON là đọc được với `null`.
 */
export function classifyBody(text: string, contentType: string): BodyRead {
  const declaresJson = contentType.includes('json');

  if (text === '') return declaresJson ? { read: false, reason: 'khai JSON nhưng thân rỗng' } : { read: true, json: null };
  try {
    return { read: true, json: JSON.parse(text) as unknown };
  } catch (error) {
    return declaresJson ? { read: false, reason: `JSON hỏng: ${String(error)}` } : { read: true, json: null };
  }
}

/**
 * Thân đọc ngay trong listener của {@link watchApi}. Chromium xả thân khi trang điều hướng hay
 * tải lại, và một lượt đọc muộn khi ấy ném "No resource with given identifier found"
 * (chuỗi thật lượt 8, bước 9). Đọc lúc response tới thì không còn cửa sổ đó.
 */
const bodyByResponse = new WeakMap<Response, Promise<BodyRead>>();

const isEventStream = (response: Response): boolean =>
  (response.headers()['content-type'] ?? '').includes('text/event-stream');

/** Status mà HTTP cấm mang thân (RFC 9110 §6.4.1, §15.3.5, §15.3.6, §15.4.5). */
const BODILESS_STATUSES: readonly number[] = [204, 205, 304];

/**
 * Response không có thân theo HTTP: 1xx, 204, 205, 304, `HEAD`, hoặc `content-length: 0`.
 * Với chúng, `text()` của Chromium ném "No data found for resource" (chuỗi thật lượt 11, #1
 * login 204), nên chúng là "đọc thành công với thân rỗng", không đi vào nhánh bỏ qua.
 */
export function hasNoBody(status: number, method: string, headers: Readonly<Record<string, string>>): boolean {
  return (
    (status >= 100 && status < 200) ||
    BODILESS_STATUSES.includes(status) ||
    method.toUpperCase() === 'HEAD' ||
    headers['content-length']?.trim() === '0'
  );
}

/**
 * Tự kiểm rẻ, không cần BE, cho {@link hasNoBody} và {@link classifyBody}: `globalSetup` gọi nó
 * trước mọi thứ khác, nên cả lượt chạy thiếu biến ([8].3) cũng chạy nó. Vitest không nhặt được
 * `e2e/**` (`vitest.config.ts` loại thư mục ấy), nên bài kiểm nằm ở đây.
 */
export function selfCheckBodyRules(): void {
  const none: Record<string, string> = {};
  const cases: readonly (readonly [string, boolean])[] = [
    ['POST 204 login không thân', hasNoBody(204, 'POST', none)],
    ['205 không thân', hasNoBody(205, 'GET', none)],
    ['304 không thân', hasNoBody(304, 'GET', none)],
    ['HEAD không thân', hasNoBody(200, 'HEAD', none)],
    ['content-length 0 không thân', hasNoBody(200, 'POST', { 'content-length': '0' })],
    ['200 JSON có thân', !hasNoBody(200, 'GET', { 'content-type': 'application/json' })],
    ['201 có thân', !hasNoBody(201, 'POST', { 'content-length': '42' })],
    ['JSON đọc được', stableRead(classifyBody('{"a":1}', 'application/json'))],
    ['khai JSON mà rỗng là không đọc được', !classifyBody('', 'application/json').read],
    ['không khai JSON mà rỗng là đọc được', classifyBody('', 'text/plain').read],
  ];
  const failed = cases.filter(([, ok]) => !ok).map(([name]) => name);

  if (failed.length > 0) throw new Error(`tự kiểm luật thân response hỏng: ${failed.join(', ')}`);
}

const stableRead = (body: BodyRead): boolean => body.read && JSON.stringify(body.json) === '{"a":1}';

const readBody = (response: Response): Promise<BodyRead> => {
  if (hasNoBody(response.status(), response.request().method(), response.headers())) {
    return Promise.resolve({ read: true, json: null });
  }
  // Luồng SSE không bao giờ kết thúc trước khi trang đóng: `text()` trên nó chờ mãi.
  if (isEventStream(response)) return Promise.resolve({ read: false, reason: 'luồng SSE, không đọc thân' });
  const contentType = response.headers()['content-type'] ?? '';
  const read = response
    .text()
    .then((text) => classifyBody(text, contentType))
    .catch((error: unknown): BodyRead => ({ read: false, reason: `text() hỏng: ${String(error)}` }));

  return withTimeout(read, BODY_READ_TIMEOUT_MS, {
    read: false,
    reason: `quá ${String(BODY_READ_TIMEOUT_MS)} ms chưa đọc được thân`,
  });
};

const bodyOf = (response: Response): Promise<BodyRead> => bodyByResponse.get(response) ?? readBody(response);

const recordError = (body: unknown, entry: ApiEntry): void => {
  if (typeof body !== 'object' || body === null) return;
  const record = body as Record<string, unknown>;
  const nested =
    typeof record.error === 'object' && record.error !== null ? (record.error as Record<string, unknown>) : record;

  if (typeof nested.code === 'string') entry.code = nested.code;
  if (typeof nested.requestId === 'string') entry.requestId = nested.requestId;
};

/**
 * Ghi mọi response `/api/` của `page` theo thứ tự tới, đọc thân ngay; thân lỗi JSON thêm `code`,
 * `requestId`. Gọi TRƯỚC mọi {@link waitForApi} để thân có sẵn khi lượt chờ trả về.
 */
export function watchApi(page: Page): ApiEntry[] {
  const log: ApiEntry[] = [];

  page.on('response', (response) => {
    const url = new URL(response.url());

    if (!url.pathname.startsWith(API_PREFIX)) return;
    const entry: ApiEntry = {
      method: response.request().method(),
      path: url.pathname,
      search: url.search,
      status: response.status(),
    };

    log.push(entry);
    const body = readBody(response).then((result) => {
      if (result.read) {
        entry.json = result.json;
        if (entry.status >= 400) recordError(result.json, entry);
      } else {
        entry.bodyError = result.reason;
      }
      return result;
    });

    bodyByResponse.set(response, body);
  });

  return log;
}

/**
 * Chờ response kế tiếp khớp `method` + `pathPattern` (trên `pathname`) và một trong `statuses`.
 * `method` là `null` thì nhận mọi method. Luôn có trần {@link API_TIMEOUT_MS} hay `timeout`.
 */
export function waitForApi(
  page: Page,
  method: string | null,
  pathPattern: RegExp,
  statuses: readonly number[],
  timeout: number = API_TIMEOUT_MS,
): Promise<ApiResult> {
  return waitForApiWhere(
    page,
    (response) =>
      (method === null || response.request().method() === method) &&
      pathPattern.test(new URL(response.url()).pathname) &&
      statuses.includes(response.status()),
    timeout,
    `${method ?? '*'} ${pathPattern.source}`,
  );
}

/**
 * Như {@link waitForApi} nhưng khớp bằng một vị từ tuỳ ý. Chỉ nhận response khớp **mà thân đã
 * đọc được**; thân không đọc được thì bỏ qua và chờ response khớp kế tiếp, trong CÙNG trần.
 * Hết trần thì ném câu nêu `what` và lý do của từng response đã bỏ qua.
 */
export function waitForApiWhere(
  page: Page,
  matches: (response: Response) => boolean,
  timeout: number = API_TIMEOUT_MS,
  what = 'response /api/',
): Promise<ApiResult> {
  return new Promise<ApiResult>((resolve, reject) => {
    let settled = false;
    const skipped: string[] = [];
    const finish = (settle: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      page.off('response', onResponse);
      settle();
    };
    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            `quá ${String(timeout)} ms chưa có ${what} mà đọc được thân` +
              (skipped.length > 0 ? `; đã bỏ qua: ${skipped.join(' | ')}` : ''),
          ),
        ),
      );
    }, timeout);
    const onResponse = (response: Response): void => {
      if (settled || !matches(response)) return;
      void bodyOf(response).then((body) => {
        if (body.read) {
          finish(() => resolve({ response, json: body.json }));
        } else {
          const { pathname } = new URL(response.url());

          skipped.push(`${response.request().method()} ${pathname} ${String(response.status())}: ${body.reason}`);
        }
      });
    };

    page.on('response', onResponse);
  });
}

/**
 * Điều hướng tới khi tài liệu mới **commit** rồi mới đăng ký chờ: response của trang cũ (bị huỷ
 * giữa lúc điều hướng) không bao giờ khớp. Mã của trang mới chưa chạy lúc commit, nên request
 * của nó không thể tới trước lượt đăng ký.
 */
export async function navigateThenWaitForApi(
  page: Page,
  navigate: () => Promise<unknown>,
  method: string,
  pathPattern: RegExp,
  statuses: readonly number[],
): Promise<ApiResult> {
  await navigate();
  return waitForApi(page, method, pathPattern, statuses);
}

export const describeEntry = (entry: ApiEntry): string =>
  `${entry.method} ${entry.path}${entry.search} → ${String(entry.status)}` +
  (entry.code === undefined ? '' : ` code=${entry.code}`) +
  (entry.requestId === undefined ? '' : ` requestId=${entry.requestId}`);

/** Mọi response ≥ 400 là hỏng trừ những dòng `allowed` nhận; in ĐỦ danh sách rồi mới ném. */
export function expectNoApiErrors(
  log: readonly ApiEntry[],
  allowed: (entry: ApiEntry, index: number) => boolean,
): void {
  const failures = log.filter((entry, index) => entry.status >= 400 && !allowed(entry, index));

  if (failures.length === 0) return;
  const lines = failures.map(describeEntry);

  for (const line of lines) console.error(`[fullstack] API lỗi: ${line}`);
  throw new Error(`${String(failures.length)} response /api/ lỗi:\n${lines.join('\n')}`);
}

export interface SseMessage {
  readonly url: string;
  readonly data: string;
}

export interface SseWatch {
  /** URL mọi request trình duyệt gửi đi (CDP), để biết luồng S1 có được mở không. */
  readonly requestUrls: string[];
  readonly messages: SseMessage[];
}

/** Gom `Network.eventSourceMessageReceived` kèm URL của request. Mở CDP hỏng thì ném. */
export async function watchSse(page: Page): Promise<SseWatch> {
  const session = await page.context().newCDPSession(page);
  const urlByRequestId = new Map<string, string>();
  const requestUrls: string[] = [];
  const messages: SseMessage[] = [];

  session.on('Network.requestWillBeSent', (event) => {
    urlByRequestId.set(event.requestId, event.request.url);
    requestUrls.push(event.request.url);
  });
  session.on('Network.eventSourceMessageReceived', (event) => {
    messages.push({ url: urlByRequestId.get(event.requestId) ?? '', data: event.data });
  });
  await session.send('Network.enable');

  return { requestUrls, messages };
}
