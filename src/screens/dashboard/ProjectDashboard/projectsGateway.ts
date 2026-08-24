/**
 * The dashboard's data source.
 *
 * `client.projects.list`/`client.projects.read` (`src/api/client.ts`) call a
 * server this product does not have yet, and the `Project` type they decode
 * to (`src/types/project.ts`) has no floor count, area, pipeline status or
 * wall-review progress — the fields this screen's cards need. So these two
 * functions stand in for a gateway: same async shape a real one would have
 * (`Promise<readonly DashboardProject[]>`, `Promise<DashboardProject |
 * undefined>`), same names `useProjectDashboard` calls by injection, so
 * swapping in the real endpoints later changes this file's inside and nothing
 * that calls it.
 */

export type ProjectPipelineStatus = 'processing' | 'qc' | 'done';

export interface DashboardProjectMember {
  readonly id: string;
  readonly initials: string;
}

export interface DashboardProject {
  readonly id: string;
  readonly name: string;
  readonly floorCount: number;
  readonly areaM2: number;
  readonly status: ProjectPipelineStatus;
  /** How many walls a person has reviewed, out of `wallsTotalCount`. */
  readonly wallsReviewedCount: number;
  readonly wallsTotalCount: number;
  readonly updatedAgoMs: number;
  readonly members: readonly DashboardProjectMember[];
  /** Which of the four procedural plan outlines the preview draws. */
  readonly planVariant: 0 | 1 | 2 | 3;
  /** The floor the "cần QC" route (`/floors/:floorId/layers/walls`) opens. */
  readonly defaultFloorId: string;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const AN = { id: 'm-an', initials: 'PA' };
const BINH = { id: 'm-binh', initials: 'NB' };
const CHI = { id: 'm-chi', initials: 'TC' };

/**
 * Exactly the three sample projects the brief names, one per pipeline status
 * so the three filter buckets (and the review-progress bar's two shapes —
 * still climbing, partway reviewed) all have something to show.
 *
 * `status: 'done'` only ever appears here alongside `wallsReviewedCount ===
 * wallsTotalCount`: `useProjectDashboard` derives the "hoàn thành" badge from
 * that equality rather than trusting this field alone, so a future project
 * cannot ship the "đã duyệt" green before a person actually reviewed every
 * wall (the brief's own constraint).
 */
const SAMPLE_PROJECTS: readonly DashboardProject[] = [
  {
    id: 'p-hq-renovation',
    name: 'Tòa nhà HQ Renovation',
    floorCount: 4,
    areaM2: 1860,
    status: 'qc',
    wallsReviewedCount: 30,
    wallsTotalCount: 48,
    updatedAgoMs: 2 * HOUR_MS,
    members: [AN, BINH],
    planVariant: 0,
    defaultFloorId: 'floor-01',
  },
  {
    id: 'p-sunrise-block-b',
    name: 'Chung cư Sunrise Block B',
    floorCount: 12,
    areaM2: 8420,
    status: 'processing',
    wallsReviewedCount: 0,
    wallsTotalCount: 132,
    updatedAgoMs: 25 * MINUTE_MS,
    members: [AN, BINH, CHI],
    planVariant: 1,
    defaultFloorId: 'floor-01',
  },
  {
    id: 'p-bac-ninh-factory',
    name: 'Nhà máy Bắc Ninh',
    floorCount: 2,
    areaM2: 5200,
    status: 'done',
    wallsReviewedCount: 26,
    wallsTotalCount: 26,
    updatedAgoMs: 26 * HOUR_MS,
    members: [BINH],
    planVariant: 2,
    defaultFloorId: 'floor-01',
  },
];

/** The whole list — `queryKeys.project.list()`'s fetcher. */
export function fetchProjectList(): Promise<readonly DashboardProject[]> {
  return Promise.resolve(SAMPLE_PROJECTS);
}

/** One project — `queryKeys.project.detail(id)`'s fetcher, for the hover prefetch. */
export function fetchProjectDetail(projectId: string): Promise<DashboardProject | undefined> {
  return Promise.resolve(SAMPLE_PROJECTS.find((project) => project.id === projectId));
}

/**
 * Four fixed monochrome outlines (room rectangles + partitions), one per
 * `planVariant`, so a card's preview reads as "this project's plan" rather
 * than a photo or noise — the brief's ban on both. Coordinates sit in a
 * 160×96 box; the view supplies the stroke colour and the white fill.
 */
export const PLAN_OUTLINE_SEGMENTS: readonly (readonly [number, number, number, number])[][] = [
  [
    [12, 10, 148, 10], [148, 10, 148, 86], [148, 86, 12, 86], [12, 86, 12, 10],
    [72, 10, 72, 54], [12, 54, 148, 54], [104, 54, 104, 86],
  ],
  [
    [10, 12, 102, 12], [102, 12, 102, 76], [102, 76, 10, 76], [10, 76, 10, 12],
    [102, 12, 148, 12], [148, 12, 148, 76], [148, 76, 102, 76],
    [10, 44, 102, 44], [46, 12, 46, 44],
  ],
  [
    [14, 14, 146, 14], [146, 14, 146, 82], [146, 82, 14, 82], [14, 82, 14, 14],
    [14, 48, 90, 48], [90, 14, 90, 82], [90, 48, 146, 48], [48, 48, 48, 82],
  ],
  [
    [16, 10, 144, 10], [144, 10, 144, 86], [144, 86, 16, 86], [16, 86, 16, 10],
    [62, 10, 62, 50], [62, 50, 144, 50], [16, 62, 100, 62], [100, 50, 100, 86],
  ],
];
