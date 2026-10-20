/**
 * Bộ đề F0–F5 cho trang Pascal 3D (I7): mỗi hàm trả thân GET
 * `/api/projects/:id/spatial` (N15, JSON trên dây) cùng số đếm mong đợi.
 *
 * Chỉ dùng trong test/e2e (Node) — `houseModelSpatial.ts` cần `node:crypto`.
 */

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';

import { allKindsGrid } from './allKindsGrid';
import f3 from './f3-scale-unresolved.json';
import f4 from './f4-ai-messy.json';
import { houseModelSpatial, META, stableId } from './houseModelSpatial';

export type WireEntity = Readonly<Record<string, unknown>>;

/** Thân N15 trên dây, trước khi qua `SpatialGraphDocumentSchema`. */
export interface WireDocument {
  readonly floorRevisions: readonly { readonly floorId: string; readonly revision: number }[];
  readonly graph: {
    readonly building: WireEntity;
    readonly levels: readonly WireEntity[];
    readonly walls: readonly WireEntity[];
    readonly openings: readonly WireEntity[];
    readonly rooms: readonly WireEntity[];
    readonly furniture: readonly WireEntity[];
    readonly axes: readonly WireEntity[];
    readonly dimensions: readonly WireEntity[];
    readonly notes: readonly WireEntity[];
  };
}

export interface FixtureCounts {
  readonly levels: number;
  readonly walls: number;
  readonly openings: number;
  readonly rooms: number;
  readonly furniture: number;
}

export interface Fixture {
  readonly doc: WireDocument;
  readonly expected: FixtureCounts;
}

/** F0 — một tầng, không gì khác: trang phải hiện trạng thái rỗng (BRIDGE_EMPTY_ERROR). */
export function fixtureF0(): Fixture {
  const level = stableId('L', 'F0:level');
  return {
    doc: {
      floorRevisions: [{ floorId: level, revision: 1 }],
      graph: {
        axes: [],
        building: { ...META, datumElevationMm: 0, name: 'F0 - rong' },
        dimensions: [],
        furniture: [],
        levels: [{ ...META, elevationMm: 0, heightMm: 3000, id: level, name: 'Tầng 1', order: 0 }],
        notes: [],
        openings: [],
        rooms: [],
        walls: [],
      },
    },
    expected: { furniture: 0, levels: 1, openings: 0, rooms: 0, walls: 0 },
  };
}

/** F1 — căn hộ màn đăng nhập; `ext` thêm các trường I1 (finish/variant/heightMm/liftMm). */
export function fixtureF1({ ext }: { readonly ext: boolean }): Fixture {
  return {
    doc: houseModelSpatial({ ext }),
    expected: { furniture: 86, levels: 1, openings: 15, rooms: 9, walls: 17 },
  };
}

/** F2 — lưới phủ mọi nhánh ánh xạ. */
export function fixtureF2(): Fixture {
  return { doc: allKindsGrid(), expected: { furniture: 32, levels: 1, openings: 10, rooms: 8, walls: 22 } };
}

/** F3 — bản AI tỉ lệ chưa giải (1 mm/px, nhà 2 × 1,4 m), chép nguyên A3/D2-spatial.json. */
export function fixtureF3(): Fixture {
  return {
    doc: structuredClone(f3) as WireDocument,
    expected: { furniture: 24, levels: 1, openings: 30, rooms: 8, walls: 71 },
  };
}

/** F4 — bản AI tự suy tỉ lệ, lộn xộn, chép nguyên A3/D2-autoscale-spatial.json. */
export function fixtureF4(): Fixture {
  return {
    doc: structuredClone(f4) as WireDocument,
    expected: { furniture: 24, levels: 1, openings: 30, rooms: 8, walls: 71 },
  };
}

/** F5 — toà mẫu 4 tầng `createSampleBuilding()` ở dạng dây. */
export function fixtureF5(): Fixture {
  const graph = JSON.parse(JSON.stringify(createSampleBuilding())) as WireDocument['graph'];
  // Dây chỉ nhận mốc UTC `…Z` (isoInstantSchema); mẫu miền ghi `+07:00`.
  const notes = graph.notes.map((n) => ({ ...n, createdAt: new Date(String(n['createdAt'])).toISOString() }));
  return {
    doc: { floorRevisions: graph.levels.map((l) => ({ floorId: String(l['id']), revision: 1 })), graph: { ...graph, notes } },
    expected: { furniture: 21, levels: 4, openings: 16, rooms: 14, walls: 48 },
  };
}
