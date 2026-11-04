/**
 * Kiểm cuối 04/11: món có mẫu không có material `slot_*` (42/138 GLB, gồm mọi `-sf`) chỉ hiện dấu cấm khi Sơn,
 * còn sơn từ tấm viền gợi ý thì lưu `slots.a` mà mẫu thật không có chỗ nhận.
 *  - Mẫu không có khe nào: mọi mesh mang khe `a` (OUTLINE_PAINT_SLOT, "cả món một màu"), nên có xem trước, có lưu, có hiện.
 *    Chưa sơn thì `slots.a` rỗng và mesh giữ vật liệu gốc. Đèn trần tự sinh giữ dấu cấm: màu của nó không lưu được.
 *  - Mẫu có khe: khe không có màu riêng lấy `slots.a`, vì `itemSlotsOf` chỉ trải `a` lên các khe nó biết.
 */
const FILE = 'nodes/src/item/renderer.tsx';

export const RULES = {
  [FILE]: [
    [
      'const captureItemMeshMaterials = (mesh: Mesh): CapturedItemMaterialData => {',
      'const hasAuthoredSlot = (root: Object3D): boolean => {\n' +
        '  let found = false\n' +
        '  root.traverse((child) => {\n' +
        '    const mesh = child as Mesh\n' +
        '    if (!mesh.isMesh) return\n' +
        '    const captured = (mesh.userData as ItemMeshUserData).pascalItemMaterialCapture\n' +
        '    const materials = captured?.captured ? captured.authoredMaterials : mesh.material\n' +
        '    found ||= (Array.isArray(materials) ? materials : [materials]).some((material) => isSlotMaterialName(material.name))\n' +
        '  })\n' +
        '  return found\n' +
        '}\n\n' +
        'const captureItemMeshMaterials = (mesh: Mesh, wholeSlot: string | null): CapturedItemMaterialData => {',
    ],
    ['const slotIds = authoredMaterials.map(getAuthoredSlotId)', 'const slotIds = authoredMaterials.map((material) => getAuthoredSlotId(material) ?? wholeSlot)'],
    ['const slotId = getAuthoredSlotId(mesh.material)', 'const slotId = getAuthoredSlotId(mesh.material) ?? wholeSlot'],
    [
      'const meshEntries: { mesh: Mesh; captured: CapturedItemMaterialData }[] = []',
      "const meshEntries: { mesh: Mesh; captured: CapturedItemMaterialData }[] = []\n    const wholeSlot = node.id.startsWith('item_LIGHT-') || hasAuthoredSlot(root) ? null : 'a'",
    ],
    ['const captured = captureItemMeshMaterials(mesh)', 'const captured = captureItemMeshMaterials(mesh, wholeSlot)'],
    ['resolveMaterialRef(nodeSlots?.[slotId], sceneMaterials, shading)', 'resolveMaterialRef(nodeSlots?.[slotId] ?? nodeSlots?.a, sceneMaterials, shading)'],
    ['(opts.nodeSlots?.[slotId] ?? curatedRef)', '(opts.nodeSlots?.[slotId] ?? opts.nodeSlots?.a ?? curatedRef)'],
  ],
};
