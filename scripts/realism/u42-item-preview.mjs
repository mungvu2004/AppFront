/**
 * UX-R4 U42: khi GLB noi that dang tai, Pascal ve khoi trang cao bang that, soc chay (opacityNode theo
 * thoi gian) va depthTest = false nen nhin xuyen tuong. Doi thanh khoi thap trung tinh dat tren san:
 * cao min(h, 0.3 m), mo nhe, co depthTest (bi tuong che nhu vat that), khong soc.
 * PreviewModel con dung khi asset hong (getUnavailableItemAsset) nen giu mot dau hieu, khong an han.
 */
const FILE = 'nodes/src/item/renderer.tsx';

export const RULES = {
  [FILE]: [
    [
      "  const material = createDefaultMaterial('#cccccc', 1, shading) as MutableMaterial\n" +
        '  material.depthTest = false\n' +
        '  material.opacityNode = previewOpacity\n',
      "  const material = createDefaultMaterial('#d6d3cd', 1, shading) as MutableMaterial\n" +
        '  material.depthWrite = false\n' +
        '  material.opacity = 0.35\n',
    ],
    [
      '    <mesh material={getPreviewMaterial(shading)} position-y={h / 2}>\n' +
        '      <boxGeometry args={[w, h, d]} />\n',
      '    <mesh material={getPreviewMaterial(shading)} position-y={Math.min(h, 0.3) / 2}>\n' +
        '      <boxGeometry args={[w, Math.min(h, 0.3), d]} />\n',
    ],
  ],
};
