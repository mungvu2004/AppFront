/**
 * Cửa đi / cửa sổ vẽ chỉ-đọc trên một canvas KHÁC bước Đối tượng (bước Tường): đồ thị → ký hiệu
 * pixel bản vẽ. Cùng nguồn hình học với `objectPlacementsOf` của bước Đối tượng — tâm là
 * `placeOnWall` của M-08, hướng `wallBearing`, phía mở `swingDirectionOf` + "Đổi hướng mở",
 * hình `buildObjectSymbol` — nhưng không kéo cả cổng/hook của bước Đối tượng vào gói của màn.
 */

import { placeOnWall } from '@/domain/openings/attach';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level, OpeningKind, Wall } from '@/domain/spatial/types';
import type { Scale } from '@/domain/units/scale';
import { millimetres } from '@/domain/units/types';
import { wallBearing } from '@/domain/walls/edit';
import { entitiesOfKind, relativePositionOf, toSolidWall } from '@/lib/commands/business/shared';
import { swingDirectionOf } from '@/lib/pascal/swingDirection';

import { buildObjectSymbol, type ObjectSymbol } from '../ObjectLayerReview/objectLayerSymbols';

/** Một ký hiệu cửa, toạ độ cục bộ (`symbol`) + phép đặt chỗ SVG (`transform`) bằng pixel bản vẽ. */
export interface OpeningSymbolPx {
  readonly id: string;
  readonly kind: OpeningKind;
  readonly transform: string;
  readonly symbol: ObjectSymbol;
}

const NO_OPENING_SYMBOLS: readonly OpeningSymbolPx[] = [];

/** Ký hiệu của mọi lỗ mở nằm trên `walls` (tường đang vẽ của tầng). */
export function openingSymbolsOf(
  graph: NormalizedSpatial | null,
  walls: readonly Wall[],
  level: Level | null,
  scale: Scale,
): readonly OpeningSymbolPx[] {
  if (graph === null || level === null || walls.length === 0) {
    return NO_OPENING_SYMBOLS;
  }

  const wallById = new Map(walls.map((wall) => [wall.id, wall] as const));
  const rooms = entitiesOfKind(graph, 'room').filter((room) => room.levelId === level.id);
  const symbols: OpeningSymbolPx[] = [];

  for (const opening of entitiesOfKind(graph, 'opening')) {
    const wall = wallById.get(opening.wallId);

    if (wall === undefined) {
      continue;
    }

    const solid = toSolidWall(wall, level);
    const centre = placeOnWall(solid, relativePositionOf(opening, solid));
    const x = scale.millimetresToPixels(millimetres(centre.x));
    const y = scale.millimetresToPixels(millimetres(centre.y));
    /* Cùng luật `inwardSwingIdsOf`: cung cửa 2D mở cùng phía cảnh 3D. */
    const inward =
      opening.kind === 'door' &&
      (swingDirectionOf(opening, wall, rooms) === 'inward') !== (opening.reversed === true);

    symbols.push({
      id: opening.id,
      kind: opening.kind,
      transform: `translate(${x} ${y}) rotate(${wallBearing(solid)})${inward ? ' scale(1 -1)' : ''}`,
      symbol: buildObjectSymbol({
        subtype: opening.kind === 'window' ? 'window' : opening.swing === 'double' ? 'doubleDoor' : 'singleDoor',
        swing: opening.swing,
        width: scale.millimetresToPixels(millimetres(opening.widthMm)),
        depth: scale.millimetresToPixels(millimetres(wall.thicknessMm)),
      }),
    });
  }

  return symbols;
}
