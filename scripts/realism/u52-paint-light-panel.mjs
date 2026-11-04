/**
 * Kiểm cuối 04/11, ba chỗ vá vendor:
 *  - Sơn: tường ẩn và phần trên mặt cắt ("Tường: Cắt" chỉ cắt lúc vẽ, tia vẫn trúng cả tường cao) không chặn tia.
 *    Trả `null` nên không `stopPropagation`: R3F giao tiếp cho vật phía sau, cả xem trước lẫn lúc bấm.
 *    Chế độ Chọn đã lo ở `select-priority-install.ts`. Đồ đạc vẫn nhận tia (đồ cao bị cắt vẫn sơn được).
 *  - Đèn trần tự sinh không có nút Di chuyển (dời đã bỏ; đường khác bị `usePascalEdits` chặn kèm câu báo).
 *  - Bảng Sơn ở khung thấp: lưới vật liệu giữ cỡ tối thiểu, cả bảng cuộn thay vì hàng lọc tràn lên chân bảng.
 */
export const RULES = {
  'editor/src/components/editor/selection-manager.tsx': [
    [
      "const wallPaintWorldPoint = new Vector3()\n",
      "const wallPaintWorldPoint = new Vector3()\n\n" +
        'const paintRayPassesThrough = (event: NodeEvent): boolean => {\n' +
        "  if (event.node.type === 'item') return false\n" +
        "  if (event.node.type === 'wall' && sceneRegistry.nodes.get(event.node.id)?.userData?.wallHidden === true) return true\n" +
        '  const hit = event.nativeEvent as unknown as { object?: Object3D; point?: Vector3 }\n' +
        '  return hit.object !== undefined && clippedAway(hit.object, hit.point)\n' +
        '}\n',
    ],
    [
      '    const resolvePaintInteraction = (event: NodeEvent): PaintInteraction | null => {\n',
      '    const resolvePaintInteraction = (event: NodeEvent): PaintInteraction | null => {\n' +
        '      if (paintRayPassesThrough(event)) return null\n',
    ],
    [
      "import { emitDeleteSFX, sfxEmitter } from",
      "import { clippedAway } from '@pascal-realism/cut'\nimport { emitDeleteSFX, sfxEmitter } from",
    ],
  ],
  'editor/src/components/editor/floating-action-menu.tsx': [
    [
      'node && isRegistryMovable(node.type) && !registryMoveDisabled(node)\n',
      "node && isRegistryMovable(node.type) && !registryMoveDisabled(node) && !node.id.startsWith('item_LIGHT-')\n",
    ],
  ],
  'editor/src/components/ui/controls/material-paint-panel.tsx': [
    ['<div className="flex h-full min-h-0 w-full flex-col">', '<div className="flex h-full min-h-0 w-full flex-col overflow-y-auto">'],
    ['<div className="min-h-0 flex-1" data-guide-target="paint-material">', '<div className="min-h-0 flex-1 overflow-hidden" style={{ minHeight: 280 }} data-guide-target="paint-material">'],
  ],
};
