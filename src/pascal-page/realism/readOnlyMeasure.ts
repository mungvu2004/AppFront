/**
 * V1 (viewer-measure): người xem (readOnly) vẫn đo được. Vạch đo (`measurement`) là node cục bộ:
 * bridge không ghi nó lên máy chủ và không lưu khi readOnly. Luật `scripts/realism/v1-viewer-measure.mjs`
 * cho các lệnh tạo/sửa/xoá đi qua chặn readOnly của core CHỈ khi mọi node trong lệnh là vạch đo.
 */
export const READ_ONLY_NODE_TYPES: ReadonlySet<string> = new Set(['measurement']);

type Typed = { readonly type?: string } | undefined;

/** Mọi node đều là vạch đo (danh sách rỗng = không cho, giữ nguyên hành vi chặn). */
export function onlyLocalAnnotations(nodes: readonly Typed[]): boolean {
  return nodes.length > 0 && nodes.every((n) => n?.type !== undefined && READ_ONLY_NODE_TYPES.has(n.type));
}

/** Lệnh tạo: `[{ node }]`. */
export function readOnlyAllowsCreate(ops: readonly { node: Typed }[]): boolean {
  return onlyLocalAnnotations(ops.map((op) => op.node));
}

/** Lệnh sửa/xoá theo id: tra loại node trong cảnh hiện tại. */
export function readOnlyAllowsIds(ids: readonly string[], nodes: Readonly<Record<string, Typed>>): boolean {
  return onlyLocalAnnotations(ids.map((id) => nodes[id]));
}
