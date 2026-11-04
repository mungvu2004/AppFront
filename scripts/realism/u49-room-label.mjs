/**
 * Nhãn phòng trên mặt bằng 2D dễ đọc (04/11). Trước: chữ màu vùng (xanh) viền trắng, cỡ tính bằng mét nên dòng phụ
 * 0,11 m chỉ còn ~6 px, và các dòng cách nhau theo trục Y của bản vẽ: mặt bằng xoay thì dòng phụ dính sát chân dòng tên,
 * trông như gạch chân.
 * Sau (chỉ trên màn hình; bản in dùng profile `document`, giữ nguyên): chữ đậm trung tính `roomLabelInk`, tên ≥ 13 px,
 * dòng phụ ≥ 11 px, các dòng xếp theo chiều dọc MÀN HÌNH (dịch sau khi xoay).
 * Thêm (04/11, chỉ màn hình): lượt phủ vẽ vùng sau cùng để tên phòng nằm trên tường và đồ (tường, đồ cũng có phần ở lượt
 * phủ, vẽ sau vùng nên che chữ). Nhãn rộng hơn phòng thì tràn sang nhãn phòng bên: `roomLabelFit` bỏ dòng phụ trước, rồi
 * bỏ cả nhãn.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INK = /roomLabelInk: '(#[0-9a-f]{6})'/.exec(readFileSync(path.join(ROOT, 'src/lib/pascal/scenePalette.ts'), 'utf8'))?.[1];
if (!INK) throw new Error('u49: thiếu roomLabelInk trong scenePalette.ts');

export const RULES = {
  'nodes/src/zone/floorplan.ts': [
    [
      "    fill: color,\n    stroke: '#ffffff',\n    strokeWidth: line.fontSize * 0.18,\n",
      `    fill: profile === 'editor' ? '${INK}' : color,\n    stroke: '#ffffff',\n    strokeWidth: line.fontSize * 0.18,\n`,
    ],
    [
      "    metadata: floorplanGeometryMetadata({ annotationRole: 'room-label' }),\n",
      "    ...(profile === 'editor'\n" +
        "      ? { screenPx: index === 0 && name ? 13 : 11, screenLine: index - (lines.length - 1) / 2, screenLineMetres: ROOM_LABEL_LINE_SPACING, screenRoom: { polygon: node.polygon, nameChars: name.length, detailChars: Math.max(0, ...lines.slice(name ? 1 : 0).map((l) => l.text.length)), lines: lines.length } }\n" +
        '      : {}),\n' +
        "    metadata: floorplanGeometryMetadata({ annotationRole: 'room-label' }),\n",
    ],
  ],
  'editor/src/components/editor-2d/renderers/floorplan-registry-layer.tsx': [
    [
      "'use client'\n\nimport {\n  type AnyNode,\n",
      "'use client'\n\nimport { roomLabelFit, type RoomLabelInput } from '@/pascal-page/upstream/lib/room-label-fit'\nimport {\n  type AnyNode,\n",
    ],
    [
      '<g className="floorplan-registry-overlay">\n        {entries.map((entry) => (\n',
      '<g className="floorplan-registry-overlay">\n' +
        "        {[...entries].sort((a, b) => Number(a.node.type === 'zone') - Number(b.node.type === 'zone')).map((entry) => (\n",
    ],
    [
      '        const beforeRotation = `translate(${g.x} ${g.y})`\n' +
        '        const transform = `${beforeRotation} rotate(${-sceneRotationDeg})`\n',
      '        const screenLabel = (g as { screenPx?: number }).screenPx\n' +
        '        const rawLabelLine = (g as { screenLine?: number }).screenLine ?? 0\n' +
        '        const labelUpp = Math.max(unitsPerPixel, 1e-6)\n' +
        '        const labelFontSize = screenLabel ? Math.max(g.fontSize, screenLabel * labelUpp) : g.fontSize\n' +
        '        const labelLineY = screenLabel\n' +
        '          ? g.y - rawLabelLine * ((g as { screenLineMetres?: number }).screenLineMetres ?? 0)\n' +
        '          : g.y\n' +
        "        const screenRoom = (g as { screenRoom?: Pick<RoomLabelInput, 'polygon' | 'nameChars' | 'detailChars' | 'lines'> }).screenRoom\n" +
        "        const labelFit = screenRoom ? roomLabelFit({ ...screenRoom, at: [g.x, labelLineY], rotationDeg: sceneRotationDeg, unitsPerPixel: labelUpp }) : 'full'\n" +
        "        if (labelFit === 'none' || (labelFit === 'name' && screenLabel !== 13)) return <></>\n" +
        "        const labelLine = labelFit === 'name' ? 0 : rawLabelLine\n" +
        '        const beforeRotation = `translate(${g.x} ${labelLineY})`\n' +
        '        const afterRotation = screenLabel\n' +
        '          ? `translate(0 ${labelLine * Math.max(0.18, 16 * labelUpp)})`\n' +
        "          : ''\n" +
        '        const transform = `${beforeRotation} rotate(${-sceneRotationDeg}) ${afterRotation}`\n',
    ],
    [
      "            data-floorplan-annotation-transform-before-rotation={beforeRotation}\n            key={keyHint}\n            transform={transform}\n          >\n            <text\n              dominantBaseline={g.dominantBaseline ?? 'middle'}\n",
      "            data-floorplan-annotation-transform-after-rotation={afterRotation || undefined}\n            data-floorplan-annotation-transform-before-rotation={beforeRotation}\n            key={keyHint}\n            transform={transform}\n          >\n            <text\n              dominantBaseline={g.dominantBaseline ?? 'middle'}\n",
    ],
    [
      "              fontFamily={g.fontFamily}\n              fontSize={g.fontSize}\n              fontWeight={g.fontWeight}\n              opacity={g.opacity}\n              paintOrder={g.paintOrder}\n              stroke={g.stroke}\n              strokeLinecap={g.stroke ? 'round' : undefined}\n              strokeLinejoin={g.stroke ? 'round' : undefined}\n              strokeWidth={g.strokeWidth}\n              textAnchor={g.textAnchor ?? 'start'}\n",
      "              fontFamily={screenLabel ? \"'Be Vietnam Pro', system-ui, sans-serif\" : g.fontFamily}\n              fontSize={labelFontSize}\n              fontWeight={g.fontWeight}\n              opacity={g.opacity}\n              paintOrder={g.paintOrder}\n              stroke={g.stroke}\n              strokeLinecap={g.stroke ? 'round' : undefined}\n              strokeLinejoin={g.stroke ? 'round' : undefined}\n              strokeWidth={screenLabel ? labelFontSize * 0.3 : g.strokeWidth}\n              textAnchor={g.textAnchor ?? 'start'}\n",
    ],
  ],
};
