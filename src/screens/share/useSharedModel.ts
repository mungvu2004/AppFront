/** Tải mô hình của một liên kết chia sẻ (`GET /share/{token}`, client trần, không cần phiên). */
import { useQuery } from '@tanstack/react-query';

import { createAppApiClient } from '@/api/appClient';
import type { ApiClient } from '@/api/client';

export function useSharedModel(token: string, client?: Pick<ApiClient, 'share'>) {
  return useQuery({
    queryKey: ['share', token],
    retry: false,
    queryFn: async () => {
      const result = await (client ?? createAppApiClient()).share.open({ token });

      if (!result.ok) {
        throw result.error;
      }

      return result.data;
    },
  });
}
