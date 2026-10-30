/**
 * Trang xem công khai của một liên kết chia sẻ: `/share/:token`.
 *
 * Không cần phiên: `GET /share/{token}` đi client trần. Máy chủ là nơi duy nhất
 * phán token còn hiệu lực; lạ/hết hạn/thu hồi đều là cùng một 404.
 * Trình xem là mặt bằng 2D chỉ đọc (phòng có tên, tường, cửa; phóng/kéo được) vẽ thẳng từ đồ thị
 * trả về, vì các màn 2D/3D sẵn có đều đọc store của dự án đang mở chứ không nhận đồ thị.
 */
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import type { ApiClient, SharedModel } from '@/api/client';

import { SharedPlan } from './SharedPlan';
import { useSharedModel } from './useSharedModel';

export const SHARE_LINK_GONE_MESSAGE = 'Liên kết không còn hiệu lực';

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

/**
 * U59: 404 của máy chủ có thể kèm `reason: "revoked" | "expired"` (thân lỗi, `raw`). Có thì nói đúng
 * lý do; vắng (token lạ, hoặc máy chủ cũ) thì giữ câu gộp.
 */
export function shareGoneReason(error: unknown): string {
  const raw = typeof error === 'object' && error !== null && 'raw' in error ? error.raw : null;
  const reason = typeof raw === 'object' && raw !== null && 'reason' in raw ? raw.reason : null;
  if (reason === 'revoked') {
    return 'Người chia sẻ đã thu hồi liên kết này. Hãy xin họ một liên kết mới nếu vẫn cần xem.';
  }
  if (reason === 'expired') {
    return 'Liên kết đã hết hạn. Hãy xin người chia sẻ một liên kết mới.';
  }
  return 'Liên kết đã hết hạn, đã bị thu hồi hoặc không đúng. Hãy xin người chia sẻ một liên kết mới.';
}

export function SharedModelView({ model }: { model: SharedModel }) {
  const { graph } = model.graph;
  const levels = [...graph.levels].sort((a, b) => a.order - b.order);
  const [picked, setPicked] = useState<string | null>(null);
  const levelId = picked ?? levels[0]?.id ?? '';
  const onLevel = useMemo(
    () => ({
      walls: graph.walls.filter((wall) => wall.levelId === levelId),
      rooms: graph.rooms.filter((room) => room.levelId === levelId),
    }),
    [graph, levelId],
  );
  const openings = useMemo(() => {
    const wallIds = new Set(onLevel.walls.map((wall) => wall.id));
    return graph.openings.filter((opening) => wallIds.has(opening.wallId));
  }, [graph, onLevel]);

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-title text-text-primary">{model.projectName}</h1>
          <p className="text-sm text-text-secondary">Bản xem chỉ đọc qua liên kết chia sẻ.</p>
        </div>
        {levels.length > 1 ? (
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            Tầng
            <select
              className="h-9 rounded-md border border-border-control bg-bg-surface px-2 text-text-primary"
              value={levelId}
              onChange={(event) => { setPicked(event.target.value); }}
            >
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>
      <SharedPlan key={levelId} walls={onLevel.walls} rooms={onLevel.rooms} openings={openings} />
    </div>
  );
}

export function SharedModelPage({ client }: { client?: Pick<ApiClient, 'share'> }) {
  const { token = '' } = useParams();
  const query = useSharedModel(token, client);

  return (
    <main className="flex h-screen flex-col bg-bg-app p-6">
      {query.isPending ? <p className="text-sm text-text-secondary">Đang mở liên kết…</p> : null}
      {query.isError ? (
        <div role="alert" className="flex flex-col gap-1">
          <h1 className="text-title text-text-primary">{isNotFound(query.error) ? SHARE_LINK_GONE_MESSAGE : 'Không mở được liên kết'}</h1>
          <p className="text-sm text-text-secondary">
            {isNotFound(query.error)
              ? shareGoneReason(query.error)
              : 'Không kết nối được máy chủ. Thử tải lại trang sau ít phút.'}
          </p>
        </div>
      ) : null}
      {query.data === undefined ? null : <SharedModelView model={query.data} />}
    </main>
  );
}
