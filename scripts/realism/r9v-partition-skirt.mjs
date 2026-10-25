/**
 * Durable skirt (vach moi): tuong ve moi nhan `realismWallDefaults()` = len trong nha + phao ngoai
 * (`skirting.exterior`, luat r9u). Luc ve, `resolveWallSurfaceSides` giu 'unknown' khi CA HAI mat
 * deu trong phong (vach giua hai phong), nen vach nay co phao ngoai o mat sau toi khi tai lai.
 * Luat nay chen vao space detection (chay sau moi lan tuong/phong doi, ca hai duong full + indexed),
 * dung cung phep lay mau cua `resolveWallSurfaceSides`: tuong co `skirting.exterior` ma hai mat deu
 * trong da giac phong -> bo `exterior`, `sides: 'interior'`, dung nhu `exteriorSkirtingOf`
 * (toPascal.ts) dung luc nap (vach trong chi giu len cua phong cach). toSpatial khong doc `skirting`
 * nen round-trip van 0 lenh; tuong nap tu backend khong co `exterior` o vach trong -> khong dung toi.
 * ponytail: la mot updateNodes rieng canh lan cap nhat mat cua Pascal (cung luot space detection);
 * neu thanh buoc hoan tac rieng thi gop vao `changedWallUpdates`.
 */
const HELPER = [
  '// AppFront r9v: vach giua hai phong khong co phao ngoai (khop exteriorSkirtingOf luc nap).',
  'function applyPartitionSkirting(updateNodes: (updates: any[]) => void, walls: WallNode[], roomPolygons: Point2D[][]) {',
  '  if (roomPolygons.length === 0) return',
  '  const updates: { id: WallNode[\'id\']; data: any }[] = []',
  '  for (const wall of walls) {',
  '    const skirting = (wall as any).skirting',
  '    if (!skirting?.exterior) continue',
  '    const frame = getWallDirection(wall)',
  '    const length = Math.hypot(frame.normal.x, frame.normal.y)',
  '    if (length < 1e-9) continue',
  '    const reach = Math.max((wall.thickness ?? 0.2) / 2 + 0.08, 0.16) / length',
  '    const dx = frame.normal.x * reach',
  '    const dy = frame.normal.y * reach',
  '    const front = pointInAnyPolygon({ x: frame.point.x + dx, y: frame.point.y + dy }, roomPolygons)',
  '    const back = pointInAnyPolygon({ x: frame.point.x - dx, y: frame.point.y - dy }, roomPolygons)',
  '    if (!(front && back)) continue',
  '    const { exterior: _exterior, ...interior } = skirting',
  "    updates.push({ id: wall.id, data: { skirting: { ...interior, sides: 'interior' } } })",
  '  }',
  '  if (updates.length > 0) updateNodes(updates)',
  '}',
  '',
  '',
].join('\n');

export const RULES = {
  'core/src/lib/space-detection.ts': [
    ['function detectSpacesFromWalls(levelId: string, walls: WallNode[]) {', `${HELPER}function detectSpacesFromWalls(levelId: string, walls: WallNode[]) {`, 1],
    [
      '    const { wallUpdates, spaces, rooms } = detectSpacesFromWalls(levelId, walls)\n',
      '    const { wallUpdates, spaces, rooms, roomPolygons } = detectSpacesFromWalls(levelId, walls)\n    applyPartitionSkirting(updateNodes, walls, roomPolygons)\n',
      1,
    ],
    ['\n  const scopedRooms = [', '\n  applyPartitionSkirting(updateNodes, topologyDelta.currentWalls, allRoomPolygons)\n\n  const scopedRooms = [', 1],
  ],
};
