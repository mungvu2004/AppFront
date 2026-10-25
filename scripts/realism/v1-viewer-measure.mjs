/**
 * V1 (viewer-measure): người xem (readOnly) đo được, không dựng được.
 * - core: chặn readOnly của tạo/sửa/xoá node cho qua khi MỌI node trong lệnh là vạch đo
 *   (`src/pascal-page/realism/readOnlyMeasure.ts`). Loại khác vẫn bị chặn; bridge không lưu khi readOnly.
 * - editor: thanh hành động (Chọn / Đo / xem / camera) hiện cả khi readOnly; Vùng + Xoá ẩn.
 */
export const RULES = {
  'core/src/store/actions/node-actions.ts': [
    [
      "type NodeCreateOp = { node: AnyNode; parentId?: AnyNodeId }\n",
      "type NodeCreateOp = { node: AnyNode; parentId?: AnyNodeId }\n" +
        "import { readOnlyAllowsCreate as readOnlyAllowsCreateV1, readOnlyAllowsIds as readOnlyAllowsIdsV1 } from '@pascal-realism/readOnlyMeasure'\n",
      1,
    ],
    [
      "  ops: NodeCreateOp[],\n) => {\n  if (get().readOnly) return\n",
      "  ops: NodeCreateOp[],\n) => {\n  if (get().readOnly && !readOnlyAllowsCreateV1(ops)) return\n",
      1,
    ],
    [
      "  updates: { id: AnyNodeId; data: Partial<AnyNode> }[],\n) => {\n  if (get().readOnly) return\n",
      "  updates: { id: AnyNodeId; data: Partial<AnyNode> }[],\n) => {\n" +
        "  if (get().readOnly && !readOnlyAllowsIdsV1(updates.map((u) => u.id), get().nodes)) return\n",
      1,
    ],
    [
      "  ids: AnyNodeId[],\n) => {\n  if (get().readOnly) return\n",
      "  ids: AnyNodeId[],\n) => {\n  if (get().readOnly && !readOnlyAllowsIdsV1(ids, get().nodes)) return\n",
      1,
    ],
  ],
  'editor/src/components/ui/action-menu/index.tsx': [
    ['    !shouldShowEditingControls(readOnly) ||\n', '    (void shouldShowEditingControls(readOnly), false) ||\n', 1],
  ],
  'editor/src/components/ui/action-menu/control-modes.tsx': [
    [
      "import useEditor from './../../../store/use-editor'\n",
      "import useEditor from './../../../store/use-editor'\nimport { useScene as useSceneV1 } from '@pascal-app/core'\n",
      1,
    ],
    [
      '  return (\n    <div className="flex items-center gap-1">\n      {controls.map((c) => {\n',
      '  const readOnlyV1 = useSceneV1((s) => s.readOnly)\n' +
        '  return (\n    <div className="flex items-center gap-1">\n      {controls.map((c) => {\n',
      1,
    ],
    [
      "                'group text-muted-foreground',\n",
      "                'group text-muted-foreground',\n                readOnlyV1 && c.id !== 'select' && 'hidden',\n",
      1,
    ],
  ],
};
