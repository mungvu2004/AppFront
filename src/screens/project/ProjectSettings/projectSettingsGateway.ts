/**
 * Nguồn dữ liệu của màn cài đặt dự án.
 *
 * ## Hai đường ghi, độc lập
 *
 * - **#24/#26** — `name`, `code`, `address` đi qua `client.projects`.
 * - **N5/N6** — sáu trường còn lại (`buildingType`, `notes`, `lengthUnit`,
 *   `snapToleranceMm`, `confidenceThreshold`, `defaultScaleMmPerPx` mà FE gọi là
 *   `scaleMmPerPx`) đi qua `client.projectSettings`, kèm `revision` làm
 *   `baseVersion`. `areaUnit` chỉ có ở FE, luôn `'m2'`.
 *
 * `update` gửi tuần tự, mỗi phần có kết quả riêng: phần hỏng không làm mất phần
 * đã lưu, và nơi gọi nhận `{ snapshot, failures }` để nói rõ "đã lưu thông tin
 * chung, chưa lưu đơn vị đo".
 *
 * ## Vì sao `update` bỏ chuỗi rỗng
 *
 * `address` và `code` khai là `z.string().min(1).optional()`; #26 không nhận
 * rỗng. Xoá trống một ô ở đây nghĩa là "không gửi trường này" — màn chặn trước
 * việc xoá trống một giá trị đã lưu.
 */

import { createAppApiClient } from '@/api/appClient';
import type { ApiClient, ApiError, ApiResult, Project } from '@/api/client';
import type { ProjectSettings, ProjectSettingsBody } from '@/api/schemas/projectSettings';
import { PROJECT_LIMITS } from '@/domain/project/limits';
import { SNAP_THRESHOLDS } from '@/domain/units/snap';
import { createUuid } from '@/lib/http/ids';

/* -------------------------------------------------------------------------- */
/* Kiểu dữ liệu.                                                              */
/* -------------------------------------------------------------------------- */

export type ProjectBuildingType = 'residential' | 'commercial' | 'industrial' | 'mixed' | 'other';

/** Đơn vị chiều dài mà màn hình hiển thị. Cùng tập với `LengthDisplayUnit` của `@/lib/format/measure`. */
export type ProjectLengthUnit = 'mm' | 'm';

/** Diện tích trong sản phẩm này luôn là mét vuông; kiểu một nhánh để chỗ gọi không tự chế đơn vị khác. */
export type ProjectAreaUnit = 'm2';

export type ProjectMemberRole = 'admin' | 'engineer' | 'viewer';

export interface ProjectSettingsMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: ProjectMemberRole;
}

/** Các trường của N5/N6 (cộng `areaUnit` chỉ có ở FE), gom lại một chỗ. */
export interface ProjectUnwiredSettings {
  readonly buildingType: ProjectBuildingType;
  readonly notes: string;
  readonly lengthUnit: ProjectLengthUnit;
  readonly areaUnit: ProjectAreaUnit;
  readonly snapToleranceMm: number;
  readonly confidenceThreshold: number;
  readonly scaleMmPerPx: number;
}

/** Toàn bộ cài đặt của một dự án, đã gộp #24 với N5. */
export interface ProjectSettingsSnapshot extends ProjectUnwiredSettings {
  readonly projectId: string;
  readonly name: string;
  readonly code: string;
  readonly address: string;
  readonly members: readonly ProjectSettingsMember[];
  readonly floorIds: readonly string[];
  readonly floorCount: number;
  /** `revision` của N5/N6 — số làm `baseVersion` cho lượt ghi đơn vị đo kế tiếp. */
  readonly settingsRevision: number;
}

/** Những gì một lượt tự lưu gửi đi: chỉ các trường thật sự đổi. */
export interface ProjectSettingsPatch {
  readonly name?: string;
  readonly code?: string;
  readonly address?: string;
  readonly buildingType?: ProjectBuildingType;
  readonly notes?: string;
  readonly lengthUnit?: ProjectLengthUnit;
  readonly snapToleranceMm?: number;
  readonly confidenceThreshold?: number;
  readonly scaleMmPerPx?: number;
}

/**
 * Kết quả của một lượt xoá mọi tầng.
 *
 * Xoá dở vẫn là `ok: true`: người dùng cần biết chính xác tầng nào còn lại chứ
 * không phải một lời báo hỏng chung chung cho cả lượt.
 */
export interface DeleteAllFloorsResult {
  readonly requestedCount: number;
  readonly deletedCount: number;
  readonly failedFloorIds: readonly string[];
}

export interface ReadProjectSettingsInput {
  readonly projectId: string;
}

export interface UpdateProjectSettingsInput {
  readonly projectId: string;
  readonly patch: ProjectSettingsPatch;
  /** Ảnh chụp đã lưu mới nhất (từ N5 hoặc lượt lưu trước). */
  readonly base: ProjectSettingsSnapshot;
}

export type ProjectSettingsPart = 'general' | 'units';

export interface ProjectSettingsUpdateFailure {
  readonly part: ProjectSettingsPart;
  readonly error: ApiError;
}

/** `snapshot` đã gộp phần thành công; `failures` rỗng nghĩa là cả hai phần xong. */
export interface ProjectSettingsUpdateResult {
  readonly snapshot: ProjectSettingsSnapshot;
  readonly failures: readonly ProjectSettingsUpdateFailure[];
}

export interface AddProjectMemberInput {
  readonly projectId: string;
  readonly email: string;
}

export interface AddProjectMemberOutcome {
  readonly alreadyMember: boolean;
  readonly member: ProjectSettingsMember;
}

export interface RemoveProjectMemberInput {
  readonly projectId: string;
  readonly userId: string;
}

export interface DeleteAllFloorsInput {
  readonly projectId: string;
}

export interface DeleteProjectInput {
  readonly projectId: string;
}

export interface ProjectSettingsGateway {
  readonly read: (input: ReadProjectSettingsInput) => Promise<ApiResult<ProjectSettingsSnapshot>>;
  readonly update: (input: UpdateProjectSettingsInput) => Promise<ProjectSettingsUpdateResult>;
  readonly addMember: (input: AddProjectMemberInput) => Promise<ApiResult<AddProjectMemberOutcome>>;
  readonly removeMember: (input: RemoveProjectMemberInput) => Promise<ApiResult<ProjectSettingsMember>>;
  readonly deleteAllFloors: (input: DeleteAllFloorsInput) => Promise<ApiResult<DeleteAllFloorsResult>>;
  readonly deleteProject: (input: DeleteProjectInput) => Promise<ApiResult<void>>;
}

/* -------------------------------------------------------------------------- */
/* Hằng số.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mặc định của các trường N5/N6, dùng cho bản nháp rỗng lúc đang tải.
 *
 * `snapToleranceMm` lấy thẳng bước lưới của `SNAP_THRESHOLDS` thay vì chép lại
 * con số: bắt điểm mặc định đúng bằng một ô lưới là quy tắc của `src/domain`,
 * không phải lựa chọn của màn hình. `confidenceThreshold` là dữ liệu của lượt
 * này — ngưỡng để một kết quả AI được coi là đủ chắc mà không cần người xem lại.
 */
export const DEFAULT_UNWIRED_SETTINGS: ProjectUnwiredSettings = {
  buildingType: 'residential',
  notes: '',
  lengthUnit: 'mm',
  areaUnit: 'm2',
  snapToleranceMm: SNAP_THRESHOLDS.gridStepMm,
  confidenceThreshold: 0.75,
  scaleMmPerPx: 1,
};

/**
 * Biên mà biểu mẫu của màn này kiểm.
 *
 * Độ dài tên lấy từ `PROJECT_LIMITS` của `src/domain` chứ không khai lại: hai
 * màn cùng sửa một cái tên phải từ chối cùng một thứ (R-61). Biên bắt điểm neo
 * vào `SNAP_THRESHOLDS.captureRadiusMm` vì dung sai lớn hơn tầm với của con trỏ
 * thì không còn nghĩa gì.
 */
export const PROJECT_SETTINGS_LIMITS = Object.freeze({
  nameMinLength: PROJECT_LIMITS.nameMinLength,
  nameMaxLength: PROJECT_LIMITS.nameMaxLength,
  codeMaxLength: 32,
  addressMaxLength: 200,
  notesMaxLength: 500,
  snapToleranceMinMm: 1,
  snapToleranceMaxMm: SNAP_THRESHOLDS.captureRadiusMm,
  confidenceMin: 0,
  confidenceMax: 1,
  scaleMinMmPerPx: 0.01,
  scaleMaxMmPerPx: 1000,
  /** Quãng mẫu dùng để nói tỉ lệ bằng lời: bấy nhiêu điểm ảnh ứng với bao nhiêu milimét. */
  scalePreviewPx: 100,
  /** Diện tích mẫu chuẩn của bất biến A14, dùng làm ví dụ cho đơn vị diện tích. */
  areaExampleM2: 248.6,
});

/* -------------------------------------------------------------------------- */
/* Chuyển đổi.                                                                 */
/* -------------------------------------------------------------------------- */

function toMember(member: Project['members'][number]): ProjectSettingsMember {
  return { id: member.id, name: member.name, email: member.email, role: member.role };
}

function toSnapshot(project: Project, settings: ProjectSettings): ProjectSettingsSnapshot {
  const floorIds = project.floors.map((floor) => floor.id);

  return {
    buildingType: settings.buildingType,
    notes: settings.notes ?? '',
    lengthUnit: settings.lengthUnit,
    areaUnit: DEFAULT_UNWIRED_SETTINGS.areaUnit,
    snapToleranceMm: settings.snapToleranceMm,
    confidenceThreshold: settings.confidenceThreshold,
    scaleMmPerPx: settings.defaultScaleMmPerPx,
    settingsRevision: settings.revision,
    projectId: project.id,
    name: project.name,
    code: project.code ?? '',
    address: project.address ?? '',
    members: project.members.map(toMember),
    floorIds,
    floorCount: floorIds.length,
  };
}

function withProject(snapshot: ProjectSettingsSnapshot, project: Project): ProjectSettingsSnapshot {
  const floorIds = project.floors.map((floor) => floor.id);

  return {
    ...snapshot,
    name: project.name,
    code: project.code ?? '',
    address: project.address ?? '',
    members: project.members.map(toMember),
    floorIds,
    floorCount: floorIds.length,
  };
}

function withSettings(snapshot: ProjectSettingsSnapshot, settings: ProjectSettings): ProjectSettingsSnapshot {
  return {
    ...snapshot,
    buildingType: settings.buildingType,
    notes: settings.notes ?? '',
    lengthUnit: settings.lengthUnit,
    snapToleranceMm: settings.snapToleranceMm,
    confidenceThreshold: settings.confidenceThreshold,
    scaleMmPerPx: settings.defaultScaleMmPerPx,
    settingsRevision: settings.revision,
  };
}

/**
 * Ba trường của #26, đã bỏ chuỗi rỗng — xem đầu file.
 *
 * Một trường vắng mặt trong bản vá thì cũng vắng mặt trong thân yêu cầu, nên
 * lượt lưu chỉ chạm đúng những gì người dùng vừa sửa.
 */
function toWireBody(patch: ProjectSettingsPatch): {
  name?: string;
  code?: string;
  address?: string;
} {
  return {
    ...(patch.name !== undefined && patch.name !== '' ? { name: patch.name } : {}),
    ...(patch.code !== undefined && patch.code !== '' ? { code: patch.code } : {}),
    ...(patch.address !== undefined && patch.address !== '' ? { address: patch.address } : {}),
  };
}

/** Thân trọn của N6: ảnh chụp đã lưu cộng bản vá; không `areaUnit`, `notes` rỗng thì vắng. */
function toUnitsBody(base: ProjectSettingsSnapshot, patch: ProjectSettingsPatch): ProjectSettingsBody {
  const notes = patch.notes ?? base.notes;

  return {
    buildingType: patch.buildingType ?? base.buildingType,
    confidenceThreshold: patch.confidenceThreshold ?? base.confidenceThreshold,
    defaultScaleMmPerPx: patch.scaleMmPerPx ?? base.scaleMmPerPx,
    lengthUnit: patch.lengthUnit ?? base.lengthUnit,
    ...(notes !== '' ? { notes } : {}),
    snapToleranceMm: patch.snapToleranceMm ?? base.snapToleranceMm,
  };
}

const UNITS_PATCH_KEYS = [
  'buildingType',
  'notes',
  'lengthUnit',
  'snapToleranceMm',
  'confidenceThreshold',
  'scaleMmPerPx',
] as const;

function hasUnitsChange(patch: ProjectSettingsPatch): boolean {
  return UNITS_PATCH_KEYS.some((key) => patch[key] !== undefined);
}

/** Lượt trước có thể đã vào mà ta không biết: gửi lại đúng thân cũ là cách duy nhất biết. */
function isLostInTransit(error: ApiError): boolean {
  return error.kind === 'network' || error.kind === 'timeout';
}

/** 5xx, mạng, timeout: giữ khoá idempotency để gửi lại cùng một thân. */
function keepsIdempotencyKey(error: ApiError): boolean {
  return isLostInTransit(error) || ('status' in error && error.status !== undefined && error.status >= 500);
}

interface HeldUnitsWrite {
  readonly baseVersion: number;
  readonly body: ProjectSettingsBody;
}

interface PendingMemberKey {
  readonly projectId: string;
  readonly email: string;
  readonly key: string;
}

type UnitsWriteOutcome =
  | { readonly ok: true; readonly settings: ProjectSettings }
  | { readonly ok: false; readonly error: ApiError };

/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cổng cài đặt dựng trên một `ApiClient` cho sẵn.
 *
 * Nhận client qua tham số để test cắm `createMockApiClient()` vào đúng phép ánh
 * xạ mà bản sản phẩm dùng, thay vì dựng một ý niệm thứ hai về hình dạng câu trả
 * lời (R-70).
 *
 * Ba thứ nhớ theo từng dự án sống trong closure này, tức theo lượt gắn màn:
 * `revision` lớn nhất đã nhận, thân N6 bị mất giữa đường, và khoá idempotency
 * của lượt thêm thành viên. Đổi người dùng (R13) thì cả closure bị bỏ theo.
 */
export function createProjectSettingsGateway(client: ApiClient): ProjectSettingsGateway {
  const latestRevision: Record<string, number | undefined> = {};
  const heldUnitsWrites: Record<string, HeldUnitsWrite | undefined> = {};
  let pendingMemberKey: PendingMemberKey | null = null;

  const noteRevision = (projectId: string, revision: number): void => {
    latestRevision[projectId] = Math.max(latestRevision[projectId] ?? 0, revision);
  };

  /**
   * Một lượt N6. Có thân giữ lại từ lượt mất mạng thì gửi nó trước, đúng
   * `baseVersion` cũ (máy chủ trả lại 200 nếu nó đã vào), rồi mới gửi thân mới
   * với `revision` vừa nhận. Trùng thân thì một lượt.
   */
  const writeUnits = async (
    projectId: string,
    base: ProjectSettingsSnapshot,
    patch: ProjectSettingsPatch,
  ): Promise<UnitsWriteOutcome> => {
    const body = toUnitsBody(base, patch);
    let baseVersion = Math.max(base.settingsRevision, latestRevision[projectId] ?? 0);
    const held = heldUnitsWrites[projectId];

    if (held !== undefined) {
      const replay = await client.projectSettings.replace({
        projectId,
        baseVersion: held.baseVersion,
        body: held.body,
      });

      if (!replay.ok) {
        if (!isLostInTransit(replay.error)) {
          heldUnitsWrites[projectId] = undefined;
        }

        return { ok: false, error: replay.error };
      }

      heldUnitsWrites[projectId] = undefined;
      noteRevision(projectId, replay.data.revision);

      if (JSON.stringify(held.body) === JSON.stringify(body)) {
        return { ok: true, settings: replay.data };
      }

      baseVersion = Math.max(baseVersion, replay.data.revision);
    }

    const result = await client.projectSettings.replace({ projectId, baseVersion, body });

    if (!result.ok) {
      if (isLostInTransit(result.error)) {
        heldUnitsWrites[projectId] = { baseVersion, body };
      }

      return { ok: false, error: result.error };
    }

    noteRevision(projectId, result.data.revision);

    return { ok: true, settings: result.data };
  };

  return {
    read: async ({ projectId }) => {
      const [projectResult, settingsResult] = await Promise.all([
        client.projects.read({ projectId }),
        client.projectSettings.read({ projectId }),
      ]);

      if (!projectResult.ok) {
        return projectResult;
      }

      if (!settingsResult.ok) {
        return settingsResult;
      }

      // Không `noteRevision` ở đây: revision N5 đọc lại không kèm nháp mới, nên nâng
      // `baseVersion` bằng nó sẽ ghi đè im lặng thay đổi của người khác.
      return { ok: true, data: toSnapshot(projectResult.data, settingsResult.data) };
    },

    update: async ({ patch, projectId, base }) => {
      let snapshot = base;
      const failures: ProjectSettingsUpdateFailure[] = [];
      const generalBody = toWireBody(patch);

      if (Object.keys(generalBody).length > 0) {
        const result = await client.projects.update({ projectId, body: generalBody });

        if (result.ok) {
          snapshot = withProject(snapshot, result.data);
        } else {
          failures.push({ part: 'general', error: result.error });
        }
      }

      if (hasUnitsChange(patch)) {
        const outcome = await writeUnits(projectId, base, patch);

        if (outcome.ok) {
          snapshot = withSettings(snapshot, outcome.settings);
        } else {
          failures.push({ part: 'units', error: outcome.error });
        }
      }

      return { snapshot, failures };
    },

    addMember: async ({ projectId, email }) => {
      const normalized = email.trim().toLowerCase();
      const current = await client.projects.read({ projectId });

      if (!current.ok) {
        return current;
      }

      const existing = current.data.members.find((member) => member.email.toLowerCase() === normalized);

      if (existing !== undefined) {
        return { ok: true, data: { alreadyMember: true, member: toMember(existing) } };
      }

      // R3: một khoá cho một thân. Chỉ giữ khi gửi lại đúng email này, cùng dự án,
      // sau một lỗi mà lượt trước có thể đã vào; mọi trường hợp khác sinh khoá mới.
      const reusable =
        pendingMemberKey !== null &&
        pendingMemberKey.projectId === projectId &&
        pendingMemberKey.email === normalized;
      const key = reusable && pendingMemberKey !== null ? pendingMemberKey.key : createUuid();

      pendingMemberKey = { projectId, email: normalized, key };

      const result = await client.members.add({ projectId, email: normalized, idempotencyKey: key });

      if (!result.ok) {
        if (!keepsIdempotencyKey(result.error)) {
          pendingMemberKey = null;
        }

        return result;
      }

      pendingMemberKey = null;

      // N3 trả 200 khi đã là thành viên mà kết quả transport không mang `status`.
      const alreadyMember = current.data.members.some((member) => member.id === result.data.id);

      return { ok: true, data: { alreadyMember, member: toMember(result.data) } };
    },

    removeMember: async ({ projectId, userId }) => {
      const result = await client.members.remove({ projectId, userId });

      if (!result.ok) {
        return result;
      }

      return { ok: true, data: toMember(result.data) };
    },

    deleteAllFloors: async ({ projectId }) => {
      // Bước đọc quyết định tập tầng hợp lệ. `floors.list({ projectId })` đã
      // nhận mã dự án; lọc thêm theo `project.floors` vẫn giữ cho lượt xoá không
      // chạm tầng ngoài dự án này.
      const projectResult = await client.projects.read({ projectId });

      if (!projectResult.ok) {
        return projectResult;
      }

      const allowedIds = new Set(projectResult.data.floors.map((floor) => floor.id));
      const listResult = await client.floors.list({ projectId });

      if (!listResult.ok) {
        return listResult;
      }

      const targets = listResult.data.filter((floor) => allowedIds.has(floor.id));
      const failedFloorIds: string[] = [];
      let deletedCount = 0;

      // Tuần tự, không song song: xoá dở thì người dùng cần biết đã xoá tới đâu,
      // và một lượt song song không nói được tầng nào còn lại.
      for (const floor of targets) {
        const deleteResult = await client.floors.delete({ floorId: floor.id });

        if (deleteResult.ok) {
          deletedCount += 1;
        } else {
          failedFloorIds.push(floor.id);
        }
      }

      return {
        ok: true,
        data: { requestedCount: targets.length, deletedCount, failedFloorIds },
      };
    },

    deleteProject: async ({ projectId }) => {
      const result = await client.projects.delete({ projectId });

      // `projects.delete` trả về `Project` vừa xoá; nơi gọi chỉ cần biết nó xong.
      if (!result.ok) {
        return result;
      }

      return { ok: true, data: undefined };
    },
  };
}

/** Cổng cài đặt dựng trên client thật của ứng dụng. */
export function createAppProjectSettingsGateway(): ProjectSettingsGateway {
  return createProjectSettingsGateway(createAppApiClient());
}
