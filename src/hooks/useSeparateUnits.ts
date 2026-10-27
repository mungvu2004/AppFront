/**
 * K34 — thiết lập dự án "Các tầng là các căn hộ riêng" (`separateUnits` của N5/N6).
 *
 * Bật thì các tầng không chồng lên nhau: màn Các tầng bỏ lát cắt và cao độ, màn Trục bỏ phần căn
 * giữa các tầng, 3D không dựng tháp. Mọi màn đọc cùng khoá này; lượt ghi làm mới cả nhánh
 * `[...project.detail, 'settings']` để màn Cài đặt dự án cũng thấy số mới.
 *
 * Ghi = đọc N5 mới nhất rồi PUT đủ thân kèm `separateUnits` (N6 thay cả thân, có `baseVersion`).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ProjectSettingsBody } from '@/api/schemas/projectSettings';
import { queryKeys } from '@/lib/query/queryKeys';

import {
  loadSeparateUnitsClient,
  separateUnitsQueryKey,
  useSeparateUnitsFlag,
  type SeparateUnitsApi,
} from './useSeparateUnitsFlag';

export { separateUnitsQueryKey, type SeparateUnitsApi } from './useSeparateUnitsFlag';

export const SEPARATE_UNITS_SAVE_ERROR = 'Chưa lưu được thiết lập căn hộ riêng. Thử lại sau.';

export interface SeparateUnitsState {
  /** `false` khi đang tải, đọc hỏng hoặc dự án chưa lưu lần nào. */
  readonly separateUnits: boolean;
  readonly isSaving: boolean;
  readonly saveError: string | null;
  readonly setSeparateUnits: (next: boolean) => void;
}

export function useSeparateUnits(projectId: string, api?: SeparateUnitsApi): SeparateUnitsState {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      const client = await loadSeparateUnitsClient(api);
      const current = await client.projectSettings.read({ projectId });
      if (!current.ok) throw new Error('project settings unavailable');
      const { revision, ...settings } = current.data;
      const body: ProjectSettingsBody = { ...settings, separateUnits: next };
      const saved = await client.projectSettings.replace({ projectId, baseVersion: revision, body });
      if (!saved.ok) throw new Error('project settings not saved');
      return saved.data.separateUnits === true;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(separateUnitsQueryKey(projectId), saved);
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.project.detail(projectId), 'settings'] });
    },
  });
  const separateUnits = useSeparateUnitsFlag(projectId, api, mutation.isPending ? mutation.variables === true : undefined);

  return {
    separateUnits,
    isSaving: mutation.isPending,
    saveError: mutation.isError ? SEPARATE_UNITS_SAVE_ERROR : null,
    setSeparateUnits: (next) => mutation.mutate(next),
  };
}
