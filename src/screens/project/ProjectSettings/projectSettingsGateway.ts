/**
 * Nguồn dữ liệu của màn cài đặt dự án.
 *
 * ## Ba trường có dây thật, bảy trường chưa có
 *
 * `ProjectSchema` (`src/api/schemas/index.ts`) chỉ mô tả ba trường mà màn này
 * sửa được rồi gửi lên máy chủ: **`name`, `code`, `address`**. Chúng đi qua
 * `client.projects.update`, được máy chủ ghi nhận, và đọc lại được ở lần tải
 * sau.
 *
 * Bảy trường còn lại — **`buildingType`, `notes`, `lengthUnit`, `areaUnit`,
 * `snapToleranceMm`, `confidenceThreshold`, `scaleMmPerPx`** — chưa có chỗ nào
 * trên dây để đặt. Không bịa thêm khoá gửi kèm: `ProjectSchema` khai `.strict()`
 * nên một khoá lạ làm hỏng bước giải mã của chính lần đọc lại. Vì vậy bảy
 * trường đó được giữ trong bộ nhớ của riêng module này, khoá theo mã dự án, và
 * được trả lại nguyên vẹn trong ảnh chụp cài đặt. Người dùng sửa được và màn
 * hình đọc lại được ngay, nhưng chúng chưa qua mạng nên sẽ trở về mặc định khi
 * tải lại trang.
 *
 * Mở đường dây cho bảy trường đó là một lượt riêng ở tầng dữ liệu, mã đề xuất
 * **T-04**: thêm trường vào `ProjectSchema` cùng `ProjectPayload`, rồi bỏ bộ
 * nhớ trong file này đi. Khi ấy đây là file duy nhất phải sửa — `useProjectSettings`
 * và cả bốn thẻ không đổi một dòng nào.
 *
 * ## Vì sao `update` bỏ chuỗi rỗng
 *
 * `address` và `code` khai là `z.string().min(1).optional()`. Gửi chuỗi rỗng
 * lên thì lần đọc lại giải mã hỏng, và người dùng thấy một màn lỗi cho một ô
 * họ vừa xoá trống. Xoá trống một ô ở đây nghĩa là "không gửi trường này".
 */

import { createAppApiClient } from '@/api/appClient';
import type { ApiClient, ApiResult, Project } from '@/api/client';
import { PROJECT_LIMITS } from '@/domain/project/limits';
import { SNAP_THRESHOLDS } from '@/domain/units/snap';

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

/** Bảy trường chưa có dây, gom lại một chỗ để lượt T-04 xoá đúng một khối. */
export interface ProjectUnwiredSettings {
  readonly buildingType: ProjectBuildingType;
  readonly notes: string;
  readonly lengthUnit: ProjectLengthUnit;
  readonly areaUnit: ProjectAreaUnit;
  readonly snapToleranceMm: number;
  readonly confidenceThreshold: number;
  readonly scaleMmPerPx: number;
}

/** Toàn bộ cài đặt của một dự án, đã gộp ba trường có dây với bảy trường chưa có. */
export interface ProjectSettingsSnapshot extends ProjectUnwiredSettings {
  readonly projectId: string;
  readonly name: string;
  readonly code: string;
  readonly address: string;
  readonly members: readonly ProjectSettingsMember[];
  readonly floorIds: readonly string[];
  readonly floorCount: number;
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
}

export interface DeleteAllFloorsInput {
  readonly projectId: string;
}

export interface DeleteProjectInput {
  readonly projectId: string;
}

export interface ProjectSettingsGateway {
  readonly read: (input: ReadProjectSettingsInput) => Promise<ApiResult<ProjectSettingsSnapshot>>;
  readonly update: (input: UpdateProjectSettingsInput) => Promise<ApiResult<ProjectSettingsSnapshot>>;
  readonly deleteAllFloors: (input: DeleteAllFloorsInput) => Promise<ApiResult<DeleteAllFloorsResult>>;
  readonly deleteProject: (input: DeleteProjectInput) => Promise<ApiResult<void>>;
}

/* -------------------------------------------------------------------------- */
/* Hằng số.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mặc định của bảy trường chưa có dây.
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
/* Bộ nhớ trong cho bảy trường chưa có dây — xem đầu file, mã T-04.            */
/* -------------------------------------------------------------------------- */

const unwiredByProject = new Map<string, ProjectUnwiredSettings>();

function readUnwired(projectId: string): ProjectUnwiredSettings {
  return unwiredByProject.get(projectId) ?? DEFAULT_UNWIRED_SETTINGS;
}

function writeUnwired(projectId: string, patch: ProjectSettingsPatch): ProjectUnwiredSettings {
  const current = readUnwired(projectId);
  const next: ProjectUnwiredSettings = {
    buildingType: patch.buildingType ?? current.buildingType,
    notes: patch.notes ?? current.notes,
    lengthUnit: patch.lengthUnit ?? current.lengthUnit,
    areaUnit: current.areaUnit,
    snapToleranceMm: patch.snapToleranceMm ?? current.snapToleranceMm,
    confidenceThreshold: patch.confidenceThreshold ?? current.confidenceThreshold,
    scaleMmPerPx: patch.scaleMmPerPx ?? current.scaleMmPerPx,
  };

  unwiredByProject.set(projectId, next);

  return next;
}

/* -------------------------------------------------------------------------- */
/* Chuyển đổi.                                                                 */
/* -------------------------------------------------------------------------- */

function toSnapshot(project: Project, unwired: ProjectUnwiredSettings): ProjectSettingsSnapshot {
  const floorIds = project.floors.map((floor) => floor.id);

  return {
    ...unwired,
    projectId: project.id,
    name: project.name,
    code: project.code ?? '',
    address: project.address ?? '',
    members: project.members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
    })),
    floorIds,
    floorCount: floorIds.length,
  };
}

/**
 * Ba trường có dây, đã bỏ chuỗi rỗng — xem đầu file.
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

/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cổng cài đặt dựng trên một `ApiClient` cho sẵn.
 *
 * Nhận client qua tham số để test cắm `createMockApiClient()` vào đúng phép ánh
 * xạ mà bản sản phẩm dùng, thay vì dựng một ý niệm thứ hai về hình dạng câu trả
 * lời (R-70).
 */
export function createProjectSettingsGateway(client: ApiClient): ProjectSettingsGateway {
  return {
    read: async ({ projectId }) => {
      const result = await client.projects.read({ projectId });

      if (!result.ok) {
        return result;
      }

      return { ok: true, data: toSnapshot(result.data, readUnwired(projectId)) };
    },

    update: async ({ patch, projectId }) => {
      const result = await client.projects.update({ projectId, body: toWireBody(patch) });

      if (!result.ok) {
        return result;
      }

      return { ok: true, data: toSnapshot(result.data, writeUnwired(projectId, patch)) };
    },

    deleteAllFloors: async ({ projectId }) => {
      // Bước đọc quyết định tập tầng hợp lệ. `floors.list()` không nhận mã dự
      // án, nên tự nó trả về mọi tầng máy chủ đang giữ; lọc theo `project.floors`
      // là thứ giữ cho lượt xoá không chạm tầng của dự án khác.
      const projectResult = await client.projects.read({ projectId });

      if (!projectResult.ok) {
        return projectResult;
      }

      const allowedIds = new Set(projectResult.data.floors.map((floor) => floor.id));
      const listResult = await client.floors.list();

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

      unwiredByProject.delete(projectId);

      return { ok: true, data: undefined };
    },
  };
}

/** Cổng cài đặt dựng trên client thật của ứng dụng. */
export function createAppProjectSettingsGateway(): ProjectSettingsGateway {
  return createProjectSettingsGateway(createAppApiClient());
}
