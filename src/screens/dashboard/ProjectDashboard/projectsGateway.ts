/**
 * The dashboard's data source: N1 (`GET /api/project-summaries`) read to the
 * last cursor, plus #26 (rename) and #27 (delete).
 *
 * The gateway takes the `ApiClient` (`src/api/client.ts`) so a test hands it a
 * hand-built client and the container hands it the real one. Failures are
 * thrown as the original `HttpError` (or `AppError`) — the hook reads them by
 * `code` with `readWireError`; this file never turns one into a sentence.
 *
 * A row the server sent that does not decode is dropped by the client and
 * counted in `droppedCount` (A11: one bad row never locks every project); this
 * file adds those counts across pages.
 */

import type { ApiClient } from '@/api/client';
import type { ProjectSummary } from '@/api/schemas/projectSummaries';
import { readWireError } from '@/lib/errors/wireError';
import { initialsOf } from '@/lib/format/initials';

/** Chữ viết tắt đã chuyển xuống `@/lib/format/initials` để màn khác dùng chung (QA-01 nợ #8). */
export { initialsOf };

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
  /** Epoch milliseconds of the last change. */
  readonly updatedAtMs: number;
  readonly members: readonly DashboardProjectMember[];
  /** Which of the four procedural plan outlines the preview draws. */
  readonly planVariant: 0 | 1 | 2 | 3;
  /** The floor the "cần QC" route opens; absent for a project with no floor yet. */
  readonly defaultFloorId?: string;
}

/** What the dashboard's query holds: every readable project, and how many rows were unreadable. */
export interface DashboardProjectList {
  readonly projects: readonly DashboardProject[];
  readonly droppedCount: number;
}

export interface DashboardProjectsGateway {
  listSummaries(signal?: AbortSignal): Promise<DashboardProjectList>;
  rename(projectId: string, name: string): Promise<void>;
  remove(projectId: string): Promise<void>;
}

/** R4: duplicating has no backend contract, so the menu entry is not drawn. */
export const DASHBOARD_CAPABILITIES = { supportsDuplicate: false } as const;

const PAGE_LIMIT = 500;
const PLAN_VARIANT_COUNT = 4;

/** Deterministic: the same id always draws the same outline. */
export function planVariantOf(id: string): 0 | 1 | 2 | 3 {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const variant = hash % PLAN_VARIANT_COUNT;
  return variant === 0 ? 0 : variant === 1 ? 1 : variant === 2 ? 2 : 3;
}

function toDashboardProject(summary: ProjectSummary): DashboardProject {
  return {
    id: summary.id,
    name: summary.name,
    floorCount: summary.floorCount,
    areaM2: summary.areaM2,
    status: summary.status,
    wallsReviewedCount: summary.wallsReviewedCount,
    wallsTotalCount: summary.wallsTotalCount,
    updatedAtMs: Date.parse(summary.updatedAt),
    members: summary.members.map((member) => ({ id: member.id, initials: initialsOf(member.name) })),
    planVariant: planVariantOf(summary.id),
    ...(summary.defaultFloorId !== undefined ? { defaultFloorId: summary.defaultFloorId } : {}),
  };
}

export function createProjectsGateway(client: Pick<ApiClient, 'projects' | 'projectSummaries'>): DashboardProjectsGateway {
  const readAllPages = async (signal: AbortSignal | undefined): Promise<DashboardProjectList> => {
    const summaries: ProjectSummary[] = [];
    let droppedCount = 0;
    let cursor: string | undefined;
    do {
      const result = await client.projectSummaries.list({
        limit: PAGE_LIMIT,
        ...(cursor !== undefined ? { cursor } : {}),
        ...(signal !== undefined ? { signal } : {}),
      });
      if (!result.ok) throw result.error;
      summaries.push(...result.data.items);
      droppedCount += result.data.droppedCount;
      cursor = result.data.nextCursor;
    } while (cursor !== undefined);

    const projects = summaries
      .map(toDashboardProject)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs || a.id.localeCompare(b.id));
    return { projects, droppedCount };
  };

  return {
    listSummaries: async (signal) => {
      try {
        return await readAllPages(signal);
      } catch (error) {
        // The list moved under us mid-read: start over from page one, once.
        if (readWireError(error)?.code !== 'CURSOR_INVALID') throw error;
        return readAllPages(signal);
      }
    },
    rename: async (projectId, name) => {
      const result = await client.projects.update({ projectId, body: { name } });
      if (!result.ok) throw result.error;
    },
    remove: async (projectId) => {
      const result = await client.projects.delete({ projectId });
      if (!result.ok) throw result.error;
    },
  };
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
