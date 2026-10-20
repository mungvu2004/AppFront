/**
 * Cờ "đã xem" theo tài khoản: `preferences.seen` của N11/N12 (FE3D-FIX-003 W4c).
 *
 * Màn chào và lớp dạy việc giữ `localStorage` làm bộ đệm nhanh (đọc đồng bộ lúc dựng);
 * máy chủ là bản thật, nên đổi trình duyệt vẫn không hiện lại. Hỏng mạng thì im lặng:
 * cờ hiện lại lần sau là phiền, không hỏng.
 *
 * Nạp LƯỜI client (cùng lý do `accountSettingsGateway.ts`): chỉ `import type` ở đầu file.
 */

import type { UserPreferences } from '@/api/schemas/me';

type Seen = NonNullable<UserPreferences['seen']>;

/** Trần `seen.tours` của BE. */
const TOURS_MAX = 64;

let cache: { readonly userId: string; readonly seen: Promise<Seen> } | null = null;

async function client() {
  return (await import('@/api/appClient')).createAppApiClient();
}

/** `preferences.seen` của người này; một lượt N11 cho mỗi người (giữ trong module). Hỏng → `{}`. */
export function readServerSeen(userId: string): Promise<Seen> {
  if (cache?.userId !== userId) {
    const seen = client()
      .then((api) => api.me.readProfile())
      .then((result) => {
        if (!result.ok) throw result.error;
        return result.data.preferences?.seen ?? {};
      })
      .catch((): Seen => {
        cache = null; // lần sau đọc lại
        return {};
      });

    cache = { userId, seen };
  }

  return cache.seen;
}

/**
 * Ghi cờ lên máy chủ: `welcome: true`, hoặc thêm `tour` vào `seen.tours` (BE thay cả danh
 * sách nên phải đọc trước). Đã có thì không gọi mạng. Không ném.
 */
export async function markServerSeen(userId: string, change: { readonly welcome?: true; readonly tour?: string }): Promise<void> {
  try {
    const current = await readServerSeen(userId);
    const tours = current.tours ?? [];
    const addTour = change.tour !== undefined && !tours.includes(change.tour);
    const seen = {
      ...(change.welcome === true && current.welcome !== true ? { welcome: true } : {}),
      // ponytail: đọc-rồi-ghi không khoá; hai thẻ cùng ghi tour khác nhau có thể mất một (hiện lại một lần).
      ...(addTour ? { tours: [...tours, change.tour as string].slice(-TOURS_MAX) } : {}),
    };

    if (Object.keys(seen).length === 0) return;

    cache = { userId, seen: Promise.resolve({ ...current, ...seen }) };

    const result = await (await client()).me.updateProfile({ body: { preferences: { seen } } });

    if (!result.ok) cache = null;
  } catch {
    cache = null;
  }
}

/** Đưa bộ nhớ module về rỗng. Dành cho test. */
export function resetServerSeenCache(): void {
  cache = null;
}
