/**
 * Vi phạm CSP từ trình duyệt thật, và một lượt nạp bộ giải Draco qua đúng các chỉ thị
 * `worker-src blob:`, `script-src 'self'`, `connect-src 'self'`, `'wasm-unsafe-eval'`.
 *
 * Mã worker là CHUỖI: `local/no-fetch-outside-http` áp cả `e2e/`, và một hàm viết trong
 * TS rồi chuyển thành chuỗi vẫn bị luật ấy đọc. Worker chỉ dùng `importScripts`.
 */
import type { BrowserContext, Page } from '@playwright/test';

import { DRACO_TIMEOUT_MS } from './env';

export interface CspViolation {
  readonly violatedDirective: string;
  readonly blockedURI: string;
}

const CSP_BINDING = '__fullstackCspViolation';

/** Ghi mọi vi phạm CSP của mọi trang trong `context`, sống qua mọi lượt điều hướng. */
export async function watchCsp(context: BrowserContext): Promise<CspViolation[]> {
  const violations: CspViolation[] = [];

  await context.exposeBinding(CSP_BINDING, (_source, violation: CspViolation) => {
    violations.push(violation);
  });
  await context.addInitScript((binding: string) => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as Record<string, ((violation: CspViolation) => unknown) | undefined>)[
        binding
      ];

      void report?.({ violatedDirective: event.violatedDirective, blockedURI: event.blockedURI });
    });
  }, CSP_BINDING);

  return violations;
}

/**
 * Như worker của `DRACOLoader` trong `three`: nạp wrapper rồi khởi động module wasm.
 *
 * Wrapper xin `draco_decoder_gltf.wasm`, nhưng bản dựng chỉ chép `draco_decoder.wasm`
 * (`scripts/copy-draco.mjs`; `DRACOLoader` tự nạp wasm và tự đặt tên). Không trỏ lại thì nginx
 * trả `index.html` và wasm hỏng ở "expected magic word … found 3c 68 74 6d" (chuỗi thật M4).
 */
const DRACO_WORKER_SOURCE = [
  "self.addEventListener('securitypolicyviolation', function (event) {",
  "  postMessage('vi phạm CSP: ' + event.violatedDirective + ' ' + event.blockedURI);",
  '});',
  'self.onmessage = function (message) {',
  '  var origin = message.data;',
  '  try {',
  "    importScripts(origin + '/draco/draco_wasm_wrapper.js');",
  '    var started = DracoDecoderModule({',
  "      locateFile: function (file) { return origin + '/draco/' + (/\\.wasm$/.test(file) ? 'draco_decoder.wasm' : file); },",
  "      onModuleLoaded: function () { postMessage('ok'); }",
  '    });',
  "    if (started && typeof started.then === 'function') {",
  "      started.then(null, function (error) { postMessage('lỗi nạp Draco: ' + String(error)); });",
  '    }',
  '  } catch (error) {',
  "    postMessage('lỗi nạp Draco: ' + String(error));",
  '  }',
  '};',
].join('\n');

/** Trả `'ok'` khi bộ giải khởi động xong; mọi đường hỏng trả chuỗi mô tả, không treo. */
export async function loadDracoDecoder(page: Page): Promise<string> {
  return page.evaluate(
    ({ source, timeoutMs }) =>
      new Promise<string>((resolve) => {
        const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        let worker: Worker;

        try {
          worker = new Worker(url);
        } catch (error) {
          resolve(`không tạo được worker: ${String(error)}`);
          return;
        }

        const finish = (result: string): void => {
          window.clearTimeout(timer);
          worker.terminate();
          URL.revokeObjectURL(url);
          resolve(result);
        };
        const timer = window.setTimeout(() => finish(`quá ${String(timeoutMs)} ms chưa nạp xong Draco`), timeoutMs);

        worker.onmessage = (message: MessageEvent<unknown>) => finish(String(message.data));
        worker.onerror = (event: ErrorEvent) => finish(`worker lỗi: ${event.message}`);
        worker.postMessage(window.location.origin);
      }),
    { source: DRACO_WORKER_SOURCE, timeoutMs: DRACO_TIMEOUT_MS },
  );
}
