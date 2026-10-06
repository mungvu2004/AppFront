/**
 * Nhật ký response `/api/` thật, chờ một response theo method + đường, và luồng SSE qua CDP.
 *
 * Không chặn, không sửa request nào: chỉ nghe.
 */
import type { Page, Response } from '@playwright/test';

import { API_TIMEOUT_MS } from './env';

export interface ApiEntry {
  readonly method: string;
  /** `pathname`, không kèm query. */
  readonly path: string;
  readonly search: string;
  readonly status: number;
  /** Thân JSON đã đọc lúc response tới; `null` khi rỗng, không phải JSON, hay đã bị xả. */
  json?: unknown;
  code?: string;
  requestId?: string;
}

/** Một response đã chờ, kèm thân JSON đọc NGAY lúc nó tới (không đọc lại sau điều hướng). */
export interface ApiResult {
  readonly response: Response;
  readonly json: unknown;
}

const API_PREFIX = '/api/';

/**
 * Thân đọc ngay trong listener của {@link watchApi}. Chromium xả thân khi trang điều hướng hay
 * tải lại, và `response.json()` gọi muộn khi ấy ném "No resource with given identifier found"
 * (chuỗi thật lượt 8, bước 9). Đọc lúc response tới thì không còn cửa sổ đó.
 */
const bodyByResponse = new WeakMap<Response, Promise<unknown>>();

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => '');

  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

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
    const body = readJson(response).then((json) => {
      entry.json = json;
      if (entry.status >= 400) recordError(json, entry);
      return json;
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
  );
}

/** Như {@link waitForApi} nhưng khớp bằng một vị từ tuỳ ý trên response. */
export async function waitForApiWhere(
  page: Page,
  matches: (response: Response) => boolean,
  timeout: number = API_TIMEOUT_MS,
): Promise<ApiResult> {
  const response = await page.waitForResponse(matches, { timeout });
  const json = await (bodyByResponse.get(response) ?? readJson(response));

  return { response, json };
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

