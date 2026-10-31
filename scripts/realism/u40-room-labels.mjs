/**
 * UX-R4 U40: ten phong khong hien tren mo hinh 3D. Nhan <Html> goc cua Pascal chi gan khi showZones bat,
 * opacity 0, chi sang khi re/chon (zone-system cac goi ep opacity). Them mot nhan thuong truc rieng
 * (khong id `${node.id}-label` nen cac system khong dung toi): ten + dien tich, nen mo, chu nho,
 * pointer-events none. Bat/tat theo co "Ten phong" (roomLabels cua useFloorplanAnnotationVisibility),
 * doc lap voi showZones. Nhan goc (sua ten, ghim) giu nguyen.
 */
const FILE = 'nodes/src/zone/renderer.tsx';

export const RULES = {
  [FILE]: [
    [
      "import { useNodeEvents, useViewer, ZONE_LAYER } from '@pascal-app/viewer'\n",
      "import { useNodeEvents, useViewer, ZONE_LAYER } from '@pascal-app/viewer'\n" +
        "import { useFloorplanAnnotationVisibility } from '@pascal-app/editor'\n",
    ],
    [
      '  const showZones = useViewer((s) => s.showZones)\n',
      '  const showZones = useViewer((s) => s.showZones)\n' +
        '  const showRoomLabelsU40 = useFloorplanAnnotationVisibility((s) => s.visibility.roomLabels)\n',
    ],
    [
      '  // Create materials\n',
      '  const areaU40 = useMemo(() => {\n' +
        '    if (!polygon || polygon.length < 3) return 0\n' +
        '    let s = 0\n' +
        '    for (let i = 0; i < polygon.length; i++) {\n' +
        '      const [x0, z0] = polygon[i]!\n' +
        '      const [x1, z1] = polygon[(i + 1) % polygon.length]!\n' +
        '      s += x0 * z1 - x1 * z0\n' +
        '    }\n' +
        '    return Math.abs(s) / 2\n' +
        '  }, [polygon])\n\n' +
        '  // Create materials\n',
    ],
    [
      '      {showZones && (\n        <>\n          <Html\n            name="label"\n',
      '      {showRoomLabelsU40 && node.name && (\n' +
        '        <Html position={[centroid[0], 0.05, centroid[1]]} style={{ pointerEvents: \'none\' }} zIndexRange={[5, 0]}>\n' +
        '          <div\n' +
        '            data-room-label-u40=""\n' +
        "            style={{ transform: 'translate3d(-50%, -50%, 0)', width: 'max-content', maxWidth: '160px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.78)', color: '#1f2937', fontSize: '11px', lineHeight: '15px', textAlign: 'center', pointerEvents: 'none', userSelect: 'none', opacity: 1 }}\n" +
        '          >\n' +
        "            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</div>\n" +
        "            {areaU40 > 0.05 && <div style={{ fontSize: '10px', opacity: 0.75 }}>{areaU40.toFixed(1).replace('.', ',')} m²</div>}\n" +
        '          </div>\n' +
        '        </Html>\n' +
        '      )}\n' +
        '      {showZones && (\n        <>\n          <Html\n            name="label"\n',
    ],
  ],
};
