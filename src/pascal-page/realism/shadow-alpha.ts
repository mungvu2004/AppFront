/**
 * Lượt bóng đổ dùng chung một khoá shader cho mọi vật đục không cắt alpha.
 *
 * three 0.186 (`Renderer._getShadowNodes`): vật liệu có `map` hay `colorNode` thì vật liệu bóng nhận
 * `colorNode = vec4(0, alpha)`, với alpha đọc từ chính texture/nút của vật liệu đó. Khoá shader vì vậy
 * khác nhau ở MỖI vật liệu, nên F1 dựng TSL cho bóng 66–73 lần, trong khi chỉ ra 8 shader khác nhau
 * (đo 2026-10-29, `F:/App/qa-results/perf-load-editor3d/NGUYEN-NHAN.md`).
 *
 * Bản đồ bóng chỉ có độ sâu (không có `shadowMap.transmitted`). Alpha ấy chỉ có tác dụng qua
 * `alphaTest` (three chép từ vật liệu gốc, dùng để bỏ điểm ảnh), hoặc qua nút `castShadowNode`/
 * `maskShadowNode`/`maskNode` bọc trong `colorNode`. Vật không có những thứ đó thì bỏ `colorNode` cũng
 * cho ra đúng bản đồ bóng ấy. Vật trong suốt cũng giữ nguyên cách của three cho chắc.
 * `?disable=shadowalpha` tắt.
 */
interface ShadowNodes {
  colorNode: unknown;
}
interface MaterialLike {
  alphaTest?: number;
  transparent?: boolean;
  castShadowNode?: { isNode?: boolean } | null;
  maskShadowNode?: { isNode?: boolean } | null;
  maskNode?: { isNode?: boolean } | null;
}
interface RendererLike {
  _getShadowNodes?: (material: MaterialLike) => ShadowNodes;
  shadowMap?: { transmitted?: boolean };
  __shadowAlpha?: true;
}

const OFF = typeof location !== 'undefined' && (new URLSearchParams(location.search).get('disable') ?? '').split(',').includes('shadowalpha');

const alphaMatters = (r: RendererLike, m: MaterialLike) =>
  (m.alphaTest ?? 0) > 0 ||
  m.transparent === true ||
  m.castShadowNode?.isNode === true ||
  m.maskShadowNode?.isNode === true ||
  m.maskNode?.isNode === true ||
  r.shadowMap?.transmitted === true;

interface PassMaterial {
  isShadowPassMaterial?: boolean;
  transparent?: boolean | null;
  displacementMap?: unknown;
  displacementScale?: number;
  displacementBias?: number;
}

/**
 * three chép vào vật liệu bóng `transparent = a || b > 0 || (c && …)`, nên giá trị có thể là `true`,
 * `null` hoặc `undefined`. Khoá ghi chuỗi `String(value)`, nên `null` và `undefined` thành hai khoá cho
 * cùng một shader. `displacementScale`/`Bias` cũng chỉ có tác dụng khi có `displacementMap`. Đưa các giá
 * trị này về một dạng thì các vật cùng cấu trúc dùng chung một bản dựng.
 */
export function normalizeShadowPass(m: PassMaterial): void {
  if (m.isShadowPassMaterial !== true) return;
  if (m.transparent !== true) m.transparent = false;
  if (!m.displacementMap) {
    m.displacementScale = 1;
    m.displacementBias = 0;
  }
}

export function installShadowAlphaSkip(renderer: unknown, off = OFF): void {
  const r = renderer as RendererLike & { _renderObjectDirect?: (...args: unknown[]) => void };
  const get = r._getShadowNodes;
  const direct = r._renderObjectDirect;
  if (off || !get || !direct || r.__shadowAlpha) return;
  r.__shadowAlpha = true;
  r._renderObjectDirect = function (this: unknown, ...args: unknown[]) {
    normalizeShadowPass(args[1] as PassMaterial);
    direct.apply(this, args);
  };
  // three giữ một bộ nút cho mỗi version vật liệu → bản đã bỏ màu cũng giữ theo bộ ấy.
  const stripped = new WeakMap<ShadowNodes, ShadowNodes>();
  r._getShadowNodes = function (this: RendererLike, material: MaterialLike) {
    const nodes = get.call(this, material);
    if (nodes.colorNode === null || alphaMatters(r, material)) return nodes;
    let s = stripped.get(nodes);
    if (!s) stripped.set(nodes, (s = { ...nodes, colorNode: null }));
    return s;
  };
}
