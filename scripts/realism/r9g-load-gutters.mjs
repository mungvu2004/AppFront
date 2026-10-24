/**
 * Durable gutter: Pascal chỉ sinh máng/ống xả mặc định (`metadata.autoGutter` của mặt mái) khi
 * mặt mái được TẠO hoặc SỬA (`updateNodes` có `metadata`/hình học → refreshDefaultGuttersForRoof).
 * `setScene` thì không, nên mái nạp từ backend (chỉ roof + roof-segment, roof-contract.md) thiếu
 * máng tới khi người dùng đụng vào. Luật này, ngay sau `setScene` và trước khi xoá lịch sử, gửi lại
 * đúng `metadata` hiện có cho mặt mái bật autoGutter mà chưa có máng con → Pascal tự sinh máng +
 * ống xả theo đường của nó (khớp theo cạnh nên lần sửa sau không nhân đôi), rồi trả mặt mái về
 * nguyên dạng đã nạp (updateNodes parse zod thêm mặc định), chỉ giữ `children` mới → toSpatial
 * đọc ngược vẫn 0 lệnh. Không thêm hoàn tác. Máng không lưu: toSpatial chỉ đọc con roof-segment.
 * ponytail: cảnh readOnly bỏ qua (updateNodes no-op); cần thì sinh máng trong toPascal.
 */
const BLOCK = [
  '',
  '  const loadedNodes = useScene.getState().nodes as Record<string, any>',
  '  const gutterlessSegments = Object.values(loadedNodes).filter(',
  '    (node) =>',
  "      node?.type === 'roof-segment' &&",
  '      node.metadata?.autoGutter === true &&',
  "      !(node.children ?? []).some((childId: string) => loadedNodes[childId]?.type === 'gutter'),",
  '  )',
  '  if (gutterlessSegments.length > 0) {',
  '    useScene',
  '      .getState()',
  '      .updateNodes(gutterlessSegments.map((node) => ({ id: node.id, data: { metadata: node.metadata } })))',
  '    const refreshedNodes = { ...(useScene.getState().nodes as Record<string, any>) }',
  '    for (const node of gutterlessSegments) {',
  '      refreshedNodes[node.id] = { ...node, children: refreshedNodes[node.id]?.children ?? node.children }',
  '    }',
  '    useScene.setState({ nodes: refreshedNodes as any })',
  '  }',
  '',
].join('\n');

export const RULES = {
  'editor/src/lib/scene.ts': [['\n  // The loaded scene is the undo floor.', `${BLOCK}\n  // The loaded scene is the undo floor.`, 1]],
};
