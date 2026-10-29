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
 *
 * W2 (`installAsyncNodeBuilds`): phần JS dựng shader TSL (`NodeBuilder.build`, ~4,5 s trên luồng chính
 * trang khi nạp F1) cũng bỏ khỏi khung sống. Vật của cảnh chính chưa có shader thì khung này bỏ qua nó và
 * khởi động `getForRenderAsync` (three nhả luồng sau mỗi stage) — tối đa `BUILD_BUDGET_MS` mỗi khung cho
 * đoạn đồng bộ đầu (`prebuild` + `setup` fragment), còn lại để khung sau. Bản dựng đọc trạng thái renderer
 * (đích, MRT, `_currentRenderContext`, `contextNode`) rải sau các `await`, lúc khung đã xong → mỗi bản dựng
 * nhận một renderer "proxy" chụp đúng trạng thái của khung sống lúc khởi động. `?disable=nodebuild` tắt riêng.
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

const DISABLED = typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('disable') ?? '').split(',') : [];
const URL_OFF = DISABLED.includes('warm');
const NODE_BUILD_OFF = DISABLED.includes('nodebuild');

/** Ngân sách mỗi khung cho đoạn dựng đồng bộ đầu của các bản dựng mới (ms). */
export const BUILD_BUDGET_MS = 8;

const stats = { started: 0, done: 0, lastDoneAt: 0, builds: 0, buildsDone: 0, skipped: 0, lastBuildAt: 0, lastActivityAt: -Infinity };

/** Mốc biên dịch gần nhất (pipeline/dựng shader bắt đầu, xong, hay còn chờ) — `tiers.ts` không tính giây ấy là chậm. */
export function compileActiveSince(nowMs = performance.now()): number {
  return stats.started > stats.done || stats.builds > stats.buildsDone ? nowMs : stats.lastActivityAt;
}
const touch = () => {
  stats.lastActivityAt = performance.now();
};
/** Thời gian dựng node đã tiêu trong khung sống hiện tại. */
let frameSpent = 0;
/** Renderer proxy cho bản dựng đang khởi động (đọc trong `_createNodeBuilder`); ngoài lúc ấy là `null`. */
let buildRenderer: unknown = null;
/** Khoá shader đang dựng: nhiều render object (pass cảnh, bóng, lớp) cùng khoá chỉ dựng một lần, xong thì lấy từ cache. */
const pendingKeys = new Set<string>();
/** Cảnh chính đang được vẽ ở khung sống; `null` = ngoài khung sống → tạo pipeline đồng bộ như three gốc. */
let liveScene: unknown = null;

/** Bọc lệnh vẽ khung sống của viewport (vendor `post-processing.tsx`). */
export function liveFrame(scene: unknown, draw: () => void): void {
  liveScene = scene;
  frameSpent = 0;
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
    touch();
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
    touch();
    // three luôn resolve (kể cả khi lỗi — pipeline hỏng thì vật không vẽ, đã báo lỗi ra console).
    for (const p of sink.splice(0)) p.then(onDone);
  };
}

interface NodeData {
  nodeBuilderState?: unknown;
}
interface NodesLike {
  get(renderObject: unknown): NodeData;
  nodeBuilderCache: Map<string, unknown>;
  getForRenderCacheKey(renderObject: unknown): string;
  getForRenderAsync(renderObject: unknown): Promise<unknown>;
  _createNodeBuilder(renderObject: unknown, material: unknown): { renderer: unknown };
}
interface RendererLike {
  _nodes?: NodesLike;
  _objects?: { get(...args: unknown[]): unknown };
  _renderObjectDirect: (...args: unknown[]) => void;
  _currentRenderContext: unknown;
  contextNode: unknown;
  getRenderTarget(): unknown;
  getMRT(): unknown;
  __asyncW2?: true;
}

/** Renderer giả mang trạng thái của khung sống lúc này; mọi thứ khác đọc xuyên qua renderer thật. */
function snapshotRenderer(r: RendererLike): unknown {
  const target = r.getRenderTarget();
  const mrt = r.getMRT();
  return Object.assign(Object.create(r) as object, {
    getRenderTarget: () => target,
    getMRT: () => mrt,
    _currentRenderContext: r._currentRenderContext,
    contextNode: r.contextNode,
  });
}

/** Bọc `_renderObjectDirect` + `_nodes._createNodeBuilder` một lần (W2). */
export function installAsyncNodeBuilds(renderer: unknown, off = URL_OFF || NODE_BUILD_OFF): void {
  const r = renderer as RendererLike;
  const nodes = r._nodes;
  const objects = r._objects;
  if (off || !nodes || !objects || r.__asyncW2) return;
  r.__asyncW2 = true;
  const create = nodes._createNodeBuilder.bind(nodes);
  nodes._createNodeBuilder = (renderObject, material) => {
    const builder = create(renderObject, material);
    if (buildRenderer !== null) builder.renderer = buildRenderer;
    return builder;
  };
  const direct = r._renderObjectDirect;
  r._renderObjectDirect = function (this: RendererLike, ...args: unknown[]) {
    const [object, material, scene, camera, lightsNode, , clippingContext, passId] = args;
    if (liveScene !== null && scene === liveScene) {
      const ro = objects.get(object, material, scene, camera, lightsNode, r._currentRenderContext, clippingContext, passId);
      const key = nodes.getForRenderCacheKey(ro);
      if (nodes.get(ro).nodeBuilderState === undefined && !nodes.nodeBuilderCache.has(key)) {
        stats.skipped++;
        if (pendingKeys.has(key)) return;
        // Hết ngân sách khung này: khung sau khởi động tiếp (vòng vẽ theo nhu cầu phải còn chạy).
        if (frameSpent >= BUILD_BUDGET_MS) return void markDirty('node-build');
        startBuild(r, nodes, ro, key);
        return;
      }
    }
    direct.apply(this, args);
  };
}

function startBuild(r: RendererLike, nodes: NodesLike, ro: unknown, key: string): void {
  pendingKeys.add(key);
  stats.builds++;
  touch();
  const t0 = performance.now();
  buildRenderer = snapshotRenderer(r);
  let job: Promise<unknown>;
  try {
    // Thân async chạy đồng bộ tới `await` đầu: `_createNodeBuilder` thấy `buildRenderer` ngay trong lời gọi này.
    job = nodes.getForRenderAsync(ro);
  } finally {
    buildRenderer = null;
    frameSpent += performance.now() - t0;
  }
  const done = () => {
    pendingKeys.delete(key);
    stats.buildsDone++;
    stats.lastBuildAt = Math.round(performance.now());
    touch();
    markDirty('node-build');
  };
  job.then(done, done);
}

/** Cho bộ đo (`window.__pascalWarm`). */
export const warmStats = () => ({
  ...stats,
  pending: stats.started - stats.done,
  buildsPending: stats.builds - stats.buildsDone,
  off: URL_OFF,
  nodeBuildOff: NODE_BUILD_OFF,
});

if (typeof window !== 'undefined') (window as unknown as { __pascalWarm?: typeof warmStats }).__pascalWarm = warmStats;
