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
  code?: string;
  requestId?: string;
}

const API_PREFIX = '/api/';

const readErrorBody = async (response: Response, entry: ApiEntry): Promise<void> => {
  const body: unknown = await response.json().catch(() => null);

  if (typeof body !== 'object' || body === null) return;
  const record = body as Record<string, unknown>;
  const nested =
    typeof record.error === 'object' && record.error !== null ? (record.error as Record<string, unknown>) : record;

  if (typeof nested.code === 'string') entry.code = nested.code;
  if (typeof nested.requestId === 'string') entry.requestId = nested.requestId;
};

/** Ghi mọi response `/api/` của `page` theo thứ tự tới; thân lỗi JSON thêm `code`, `requestId`. */
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
    if (entry.status >= 400) void readErrorBody(response, entry);
  });

  return log;
}

/** Chờ response kế tiếp khớp `method` + `pathPattern` (trên `pathname`) và một trong `statuses`. */
export function waitForApi(
  page: Page,
  method: string,
  pathPattern: RegExp,
  statuses: readonly number[],
  timeout: number = API_TIMEOUT_MS,
): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      pathPattern.test(new URL(response.url()).pathname) &&
      statuses.includes(response.status()),
    { timeout },
  );
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

