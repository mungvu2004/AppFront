/**
 * W1: lượt vẽ tạo pipeline BẤT ĐỒNG BỘ, để GPU không treo cả trang khi biên dịch shader.
 *
 * three 0.186 vẽ thì tạo pipeline đồng bộ (`device.createRenderPipeline`); trên Windows/D3D12 mỗi vật liệu
 * đồ đạc tốn ~250 ms biên dịch DXC trên luồng chính GPU → căn hộ F1 khựng từng đợt 5–8 s, tổng ~13 s
 * (đo 2026-10-29, `F:/App/qa-results/perf-load-editor3d/NGUYEN-NHAN.md`).
 *
 * three đã có sẵn đường không chặn: `Pipelines.getForRender(ro, promises)` với mảng `promises` gọi
 * `createRenderPipelineAsync` (Dawn biên dịch trên luồng worker), và `Renderer` bỏ qua vẽ vật nào pipeline
 * chưa sẵn (`isReady`). Ở đây cho chính lượt vẽ thật đi đường ấy — khoá pipeline đúng ngữ cảnh thật (đích,
 * MRT, callDepth, số mẫu), phủ cả bóng đổ. Đổi lại: vật hiện dần khi pipeline của nó xong thay vì cả trang
 * đứng. Xong một pipeline → `markDirty` để vòng vẽ theo nhu cầu (R2) vẽ lại.
 *
 * CHỈ trong khung sống (`liveFrame`) và CHỈ vật của cảnh chính: lượt vẽ một lần (thumbnail, snapshot,
 * `__pascalCapture`, PMREM/probe) bỏ vật thì ra ảnh thiếu — và PMREM còn bị cache luôn ở dạng thiếu; quad
 * hậu kỳ (QuadMesh tự là "scene" của nó) bỏ vẽ thì canvas nháy trống. Những lượt đó vẫn đồng bộ như cũ.
 *
 * Gắn từ vendor `post-processing.tsx` (luật `scripts/realism/w1-warm-pipelines.mjs`); `?disable=warm` tắt
 * để bộ đo so trước/sau.
 */
import { markDirty } from './idle';

interface RenderObjectLike {
  scene: unknown;
}

interface PipelinesLike {
  getForRender(renderObject: unknown, promises?: Promise<unknown>[] | null): unknown;
  updateForRender(renderObject: unknown): void;
  __asyncW1?: true;
}

const URL_OFF =
  typeof location !== 'undefined' && (new URLSearchParams(location.search).get('disable') ?? '').split(',').includes('warm');

const stats = { started: 0, done: 0, lastDoneAt: 0 };
/** Cảnh chính đang được vẽ ở khung sống; `null` = ngoài khung sống → tạo pipeline đồng bộ như three gốc. */
let liveScene: unknown = null;

/** Bọc lệnh vẽ khung sống của viewport (vendor `post-processing.tsx`). */
export function liveFrame(scene: unknown, draw: () => void): void {
  liveScene = scene;
  try {
    draw();
  } finally {
    liveScene = null;
  }
}

/** Bọc `updateForRender` của `renderer._pipelines` một lần; gọi mỗi khung cũng rẻ. */
export function installAsyncPipelines(renderer: unknown, off = URL_OFF): void {
  const pipelines = (renderer as { _pipelines?: PipelinesLike })._pipelines;
  if (off || !pipelines || pipelines.__asyncW1) return;
  pipelines.__asyncW1 = true;
  const sink: Promise<unknown>[] = [];
  const onDone = () => {
    stats.done++;
    stats.lastDoneAt = Math.round(performance.now());
    markDirty('pipeline');
  };
  pipelines.updateForRender = (renderObject) => {
    if (liveScene === null || (renderObject as RenderObjectLike).scene !== liveScene) {
      pipelines.getForRender(renderObject);
      return;
    }
    pipelines.getForRender(renderObject, sink);
    if (!sink.length) return;
    stats.started += sink.length;
    // three luôn resolve (kể cả khi lỗi — pipeline hỏng thì vật không vẽ, đã báo lỗi ra console).
    for (const p of sink.splice(0)) p.then(onDone);
  };
}

/** Cho bộ đo (`window.__pascalWarm`). */
export const warmStats = () => ({ ...stats, pending: stats.started - stats.done, off: URL_OFF });

if (typeof window !== 'undefined') (window as unknown as { __pascalWarm?: typeof warmStats }).__pascalWarm = warmStats;
