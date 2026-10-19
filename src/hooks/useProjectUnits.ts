/**
 * Đơn vị hiển thị của dự án (N4-07), cho các màn QC truyền vào `formatLength`.
 *
 * Đọc đúng mục bộ đệm mà màn Cài đặt dự án ghi (`projectSettingsQueryKey` trong
 * `screens/project/ProjectSettings/useProjectSettings.ts`). Khoá được dựng lại ở
 * đây vì `src/hooks` không được nhập `src/screens` (mục 0.4) — hai nơi phải giữ
 * giống nhau; test bên cạnh khẳng định điều đó.
 *
 * Hai nguồn, ưu tiên theo thứ tự:
 * 1. Ảnh chụp của màn Cài đặt dưới khoá chung (chỉ đăng ký, `enabled: false`) —
 *    mới nhất sau khi người dùng vừa đổi đơn vị ở Cài đặt.
 * 2. Tự tải `client.projectSettings.read` dưới khoá CON `[..., 'settings', 'units']`
 *    — cho người chưa mở Cài đặt lần nào. Không dùng chung khoá cha vì màn Cài
 *    đặt cất ở đó cả ảnh chụp gộp (tên, thành viên…); ghi dạng khác vào sẽ làm
 *    hỏng màn ấy. Khoá con vẫn bị vô hiệu hoá theo tiền tố khi Cài đặt
 *    `invalidateQueries` khoá cha.
 * Chưa có gì (đang tải, lỗi) → mm.
 */

import { useQuery } from '@tanstack/react-query';

import type { ApiClient } from '@/api/client';
import type { LengthDisplayUnit } from '@/lib/format/measure';
import { queryKeys } from '@/lib/query/queryKeys';

export type ProjectLengthUnit = Extract<LengthDisplayUnit, 'mm' | 'm'>;

export interface ProjectUnits {
  /** Đơn vị chiều dài người dùng chọn ở Cài đặt › Đơn vị đo. Mặc định `'mm'`. */
  readonly lengthUnit: ProjectLengthUnit;
}

export const DEFAULT_PROJECT_UNITS: ProjectUnits = { lengthUnit: 'mm' };

/** Phải trùng `projectSettingsQueryKey` của màn Cài đặt dự án. */
export const projectUnitsQueryKey = (projectId: string) =>
  [...queryKeys.project.detail(projectId), 'settings'] as const;

interface CachedSettings {
  readonly lengthUnit?: unknown;
}

function toUnits(data: CachedSettings | undefined): ProjectUnits {
  const unit = data?.lengthUnit;
  return unit === 'm' || unit === 'mm' ? { lengthUnit: unit } : DEFAULT_PROJECT_UNITS;
}

export type ProjectUnitsApi = Pick<ApiClient, 'projectSettings'>;

// Nạp lười như `useProjectSpatial`: nhập tĩnh `appClient` làm nặng gói của màn.
const loadClient = async (api: ProjectUnitsApi | undefined): Promise<ProjectUnitsApi> =>
  api ?? (await import('@/api/appClient')).createAppApiClient();

/**
 * @param api Client cho bài kiểm; vắng thì là client của ứng dụng.
 */
export function useProjectUnits(projectId: string | undefined, api?: ProjectUnitsApi): ProjectUnits {
  const key = projectUnitsQueryKey(projectId ?? '');
  const { data: settingsSnapshot } = useQuery<CachedSettings>({ queryKey: key, enabled: false });
  const { data: fetched } = useQuery<CachedSettings>({
    queryKey: [...key, 'units'],
    enabled: Boolean(projectId) && settingsSnapshot === undefined,
    queryFn: async () => {
      const result = await (await loadClient(api)).projectSettings.read({ projectId: projectId ?? '' });
      if (!result.ok) throw new Error('project settings unavailable');
      return result.data;
    },
  });
  return projectId ? toUnits(settingsSnapshot ?? fetched) : DEFAULT_PROJECT_UNITS;
}
