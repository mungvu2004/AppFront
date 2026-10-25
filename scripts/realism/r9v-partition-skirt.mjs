/**
 * Durable skirt (vach moi): tuong ve moi nhan `realismWallDefaults()` = len trong nha + phao ngoai
 * (`skirting.exterior`, luat r9u). Luc ve, `resolveWallSurfaceSides` giu 'unknown' khi CA HAI mat
 * deu trong phong (vach giua hai phong), nen vach nay co phao ngoai o mat sau toi khi tai lai.
 * Luat nay chen vao space detection (chay sau moi lan tuong/phong doi, ca duong full + indexed):
 * lay mau hai mat nhu `resolveWallSurfaceSides`; tuong co `skirting.exterior` ma hai mat deu trong
 * da giac phong -> bo `exterior`, `sides: 'interior'` (`partitionSkirtingData`), dung nhu
 * `exteriorSkirtingOf` (toPascal.ts) dung luc nap. Cap nhat nay GOP vao chinh lo cap nhat mat tuong
 * Pascal gui (mot updateNodes). Ca hai duong chay trong `pauseSceneHistory` (subscriber cua
 * initSpaceDetectionSync) nen khong ghi buoc hoan tac nao. toSpatial khong doc `skirting` ->
 * round-trip 0 lenh; tuong nap tu backend khong co `exterior` o vach trong -> khong dung toi.
 */

/** Thuan: du lieu sua skirting cho tuong co mat truoc/sau trong phong, hoac null. */
export function partitionSkirtingData(skirting, frontInside, backInside) {
  if (!skirting || !skirting.exterior || !(frontInside && backInside)) return null
  const { exterior: _exterior, ...interior } = skirting
  return { skirting: { ...interior, sides: 'interior' } }
}

const HELPER = [
  '// AppFront r9v: vach giua hai phong khong co phao ngoai (khop exteriorSkirtingOf luc nap).',
  `const partitionSkirtingData = (${partitionSkirtingData.toString()}) as (skirting: any, frontInside: boolean, backInside: boolean) => any`,
  'function withPartitionSkirting(batch: { id: any; data: any }[], walls: WallNode[], roomPolygons: Point2D[][]) {',
  '  if (roomPolygons.length === 0) return batch',
  '  const merged = new Map(batch.map((update) => [update.id, update]))',
  '  for (const wall of walls) {',
  '    const frame = getWallDirection(wall)',
  '    const length = Math.hypot(frame.normal.x, frame.normal.y)',
  '    if (length < 1e-9) continue',
  '    const reach = Math.max((wall.thickness ?? 0.2) / 2 + 0.08, 0.16) / length',
  '    const dx = frame.normal.x * reach',
  '    const dy = frame.normal.y * reach',
  '    const fix = partitionSkirtingData(',
  '      (wall as any).skirting,',
  '      pointInAnyPolygon({ x: frame.point.x + dx, y: frame.point.y + dy }, roomPolygons),',
  '      pointInAnyPolygon({ x: frame.point.x - dx, y: frame.point.y - dy }, roomPolygons),',
  '    )',
  '    if (!fix) continue',
  '    const prior = merged.get(wall.id)',
  '    merged.set(wall.id, { id: wall.id, data: { ...(prior?.data ?? {}), ...fix } })',
  '  }',
  '  return [...merged.values()]',
  '}',
  '',
  '',
].join('\n');

const FULL_FROM = `    if (changedWallUpdates.length > 0) {
      updateNodes(
        changedWallUpdates.map((update) => ({
          id: update.wallId,
          data: {
            frontSide: update.frontSide,
            backSide: update.backSide,
          },
        })),
      )
    }`;
const FULL_TO = `    const wallBatch = withPartitionSkirting(
      changedWallUpdates.map((update) => ({
        id: update.wallId,
        data: { frontSide: update.frontSide, backSide: update.backSide },
      })),
      walls,
      roomPolygons,
    )
    if (wallBatch.length > 0) updateNodes(wallBatch)`;
const INDEXED_FROM = `  if (changedWallUpdates.length > 0) {
    updateNodes(
      changedWallUpdates.map((update) => ({
        id: update.wallId,
        data: { frontSide: update.frontSide, backSide: update.backSide },
      })),
    )
  }`;
const INDEXED_TO = `  const wallBatch = withPartitionSkirting(
    changedWallUpdates.map((update) => ({
      id: update.wallId,
      data: { frontSide: update.frontSide, backSide: update.backSide },
    })),
    topologyDelta.currentWalls,
    allRoomPolygons,
  )
  if (wallBatch.length > 0) updateNodes(wallBatch)`;

export const RULES = {
  'core/src/lib/space-detection.ts': [
    ['function detectSpacesFromWalls(levelId: string, walls: WallNode[]) {', `${HELPER}function detectSpacesFromWalls(levelId: string, walls: WallNode[]) {`, 1],
    [
      '    const { wallUpdates, spaces, rooms } = detectSpacesFromWalls(levelId, walls)\n',
      '    const { wallUpdates, spaces, rooms, roomPolygons } = detectSpacesFromWalls(levelId, walls)\n',
      1,
    ],
    [FULL_FROM, FULL_TO, 1],
    [INDEXED_FROM, INDEXED_TO, 1],
  ],
};
