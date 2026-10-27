/**
 * K34 — đọc cờ "Các tầng là các căn hộ riêng" (`separateUnits` của N5), không kèm phần ghi.
 * Màn chỉ cần đọc (Quy chuẩn, Tỷ lệ) dùng hook này để gói của màn không kéo theo `useMutation`;
 * màn có công tắc dùng `useSeparateUnits`.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { ApiClient } from '@/api/client';
import { queryKeys } from '@/lib/query/queryKeys';
import { useStore } from '@/store';

export type SeparateUnitsApi = Pick<ApiClient, 'projectSettings'>;

export const separateUnitsQueryKey = (projectId: string) =>
  [...queryKeys.project.detail(projectId), 'settings', 'separateUnits'] as const;

// Nạp lười như `useProjectUnits`: nhập tĩnh `appClient` làm nặng gói của màn.
export const loadSeparateUnitsClient = async (api: SeparateUnitsApi | undefined): Promise<SeparateUnitsApi> =>
  api ?? (await import('@/api/appClient')).createAppApiClient();

/** `false` khi đang tải, đọc hỏng hoặc dự án chưa lưu lần nào. */
export function useSeparateUnitsFlag(projectId: string, api?: SeparateUnitsApi, override?: boolean): boolean {
  const { data } = useQuery({
    queryKey: separateUnitsQueryKey(projectId),
    enabled: projectId !== '',
    queryFn: async () => {
      const result = await (await loadSeparateUnitsClient(api)).projectSettings.read({ projectId });
      if (!result.ok) throw new Error('project settings unavailable');
      return result.data.separateUnits === true;
    },
  });
  const separateUnits = override ?? data ?? false;

  // Bộ luật đọc cờ từ kho (selectors.ts): đẩy vào để mọi màn cùng bỏ luật liên tầng, không chỉ Quy chuẩn.
  useEffect(() => {
    useStore.getState().setRuleSeparateUnits(separateUnits);
  }, [separateUnits]);

  return separateUnits;
}
