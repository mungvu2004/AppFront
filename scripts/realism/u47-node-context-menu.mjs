/**
 * Menu chuột phải (04/11): bấm phải không kéo mở menu thao tác của vật dưới con trỏ, kéo vẫn xoay.
 * Logic và test: `src/pascal-page/upstream/lib/node-context-menu.ts`; menu gắn ở `src/pascal-page/main.tsx`.
 * Hai chỗ vá vendor:
 *  - `NodeActionMenu` công bố các nút đang có (menu không tự chế thao tác).
 *  - `onContextMenu` của vật không bị `cameraDragging` chặn: nhả tay khi camera còn trôi (lệch 1-3 px) vẫn phải mở
 *    menu. Việc phân biệt bấm/kéo do `isPlainClick` lo.
 */
export const RULES = {
  'editor/src/components/editor/node-action-menu.tsx': [
    [
      "import { RegistryActionContributions } from './registry-action-contributions'\n",
      "import { RegistryActionContributions } from './registry-action-contributions'\n" +
        "import { usePublishNodeActions } from '@/pascal-page/upstream/lib/node-context-menu'\n",
    ],
    [
      '}: NodeActionMenuProps) {\n  return (\n',
      '}: NodeActionMenuProps) {\n' +
        '  usePublishNodeActions({ onFind, onMove, onEditMesh, onGroup, onUngroup, onCurve, onDuplicate, onAddHole, onDelete })\n' +
        '  return (\n',
    ],
  ],
  'viewer/src/hooks/use-node-events.ts': [
    [
      '    onContextMenu: (e: ThreeEvent<PointerEvent>) => {\n      if (selectionSuppressed()) return\n',
      '    onContextMenu: (e: ThreeEvent<PointerEvent>) => {\n      if (useViewer.getState().inputDragging) return\n',
    ],
  ],
};
