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
 * Thứ tự dựng: vật lớn trên màn hình trước (`build-order.ts`, `?disable=buildorder` tắt).
 */
import { coversScreen, screenSize } from './build-order';
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
const LAZY_DISPOSE_OFF = DISABLED.includes('lazydispose');
const ORDER_OFF = DISABLED.includes('buildorder');

/** Ngân sách mỗi khung cho đoạn dựng đồng bộ đầu của các bản dựng mới (ms). */
export const BUILD_BUDGET_MS = 8;

const stats = { started: 0, done: 0, lastDoneAt: 0, builds: 0, buildsDone: 0, skipped: 0, lastBuildAt: 0, lastActivityAt: -Infinity, lazyDisposed: 0 };

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
    rankFrame();
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
        const m = (material ?? {}) as { isShadowPassMaterial?: boolean; transparent?: boolean };
        // Thứ tự (`build-order.ts`): vật đục lượt chính lớn trên màn hình trước; bóng đổ và vật trong suốt
        // chờ tới khi hàng ấy hết; vật phủ màn hình (nền) dựng ngay. Mọi bản dựng vẫn khởi động ngay tại
        // chỗ vẽ của vật — three gán tạm thuộc tính vật liệu theo từng lượt (bóng, mặt sau/trước của vật
        // trong suốt, ngữ cảnh pass), dựng lúc khác là sai shader (đã thử: F1 ra nền đen, tối cả cảnh).
        const cover = coversScreen(object);
        const opaqueMain = !ORDER_OFF && !cover && m.isShadowPassMaterial !== true && m.transparent !== true;
        if (opaqueMain && (key !== chosen || frameSpent >= BUILD_BUDGET_MS)) {
          // Xếp hạng ở khung này, khởi động ở khung sau ngay tại chỗ vẽ (trạng thái renderer đúng lượt).
          const size = screenSize(object, camera);
          if ((ranked.get(key) ?? -1) < size) ranked.set(key, size);
          return;
        }
        if (!opaqueMain && !ORDER_OFF && !cover && mainBacklog > 0) return void markDirty('node-build');
        // Hết ngân sách khung này: khung sau khởi động tiếp (vòng vẽ theo nhu cầu phải còn chạy).
        if (frameSpent >= BUILD_BUDGET_MS) return void markDirty('node-build');
        startBuild(nodes, ro, key, snapshotRenderer(r));
        return;
      }
    }
    direct.apply(this, args);
  };
}

/** Cỡ trên màn hình của vật đục lượt chính chưa có shader gặp trong khung này, theo khoá. */
const ranked = new Map<string, number>();
/** Khoá lớn nhất của khung trước — khung này khởi động nó ngay tại chỗ vẽ. Một khoá mỗi khung: đoạn dựng
 * đồng bộ đầu của một vật đục đã hết `BUILD_BUDGET_MS`. */
let chosen: string | null = null;
/** Số vật đục lượt chính còn chờ ở khung trước — bóng đổ và vật trong suốt chưa dựng khi còn số này. */
let mainBacklog = 0;

function rankFrame(): void {
  mainBacklog = ranked.size;
  chosen = null;
  let best = -1;
  for (const [key, size] of ranked) if (size > best) [chosen, best] = [key, size];
  ranked.clear();
  if (mainBacklog > 0) markDirty('node-build');
}

function startBuild(nodes: NodesLike, ro: unknown, key: string, snap: unknown): void {
  pendingKeys.add(key);
  stats.builds++;
  touch();
  const t0 = performance.now();
  buildRenderer = snap;
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

interface BindingsLike {
  deleteForRender(renderObject: { _bindings: unknown }): void;
  delete(renderObject: unknown): void;
  __lazyDispose?: true;
}

/**
 * Huỷ render object chưa từng tạo bindings thì bỏ bước tạo. three (`Bindings.deleteForRender`) gọi
 * `getBindings()` để xoá, mà lời gọi ấy dựng ĐỒNG BỘ cả shader TSL nếu chưa có — R3F gỡ vật liệu/hình
 * khi đồ đạc nạp lại, W2 lại để nhiều vật chưa dựng, nên F1 mất ~1,3–1,7 s luồng chính chỉ để dựng rồi
 * vứt. Bindings chỉ sinh qua `getBindings()` (gán `_bindings`), nên `_bindings === null` là không có gì
 * để xoá. `?disable=lazydispose` tắt.
 */
export function installLazyDispose(renderer: unknown, off = LAZY_DISPOSE_OFF): void {
  const b = (renderer as { _bindings?: BindingsLike })._bindings;
  if (off || !b || b.__lazyDispose) return;
  b.__lazyDispose = true;
  const del = b.deleteForRender.bind(b);
  b.deleteForRender = (ro) => {
    if (ro._bindings === null) {
      stats.lazyDisposed++;
      b.delete(ro);
    } else del(ro);
  };
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
