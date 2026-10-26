/**
 * Trang xem công khai của một liên kết chia sẻ: `/share/:token`.
 *
 * Không cần phiên: `GET /share/{token}` đi client trần. Máy chủ là nơi duy nhất
 * phán token còn hiệu lực; lạ/hết hạn/thu hồi đều là cùng một 404.
 * Trình xem là mặt bằng 2D chỉ đọc (tường theo tầng) vẽ thẳng từ đồ thị trả về,
 * vì các màn 2D/3D sẵn có đều đọc store của dự án đang mở chứ không nhận đồ thị.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';

import type { ApiClient, SharedModel } from '@/api/client';

import { useSharedModel } from './useSharedModel';

export const SHARE_LINK_GONE_MESSAGE = 'Liên kết không còn hiệu lực';

const PAD_MM = 500;

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

function WallPlan({ model, levelId }: { model: SharedModel; levelId: string }) {
  const walls = model.graph.graph.walls.filter((wall) => wall.levelId === levelId);
  const xs = walls.flatMap((wall) => [wall.centreline.start.x, wall.centreline.end.x]);
  const ys = walls.flatMap((wall) => [wall.centreline.start.y, wall.centreline.end.y]);

  if (walls.length === 0) {
    return <p>Tầng này chưa có tường nào.</p>;
  }

  const minX = Math.min(...xs) - PAD_MM;
  const minY = Math.min(...ys) - PAD_MM;
  const width = Math.max(...xs) - minX + PAD_MM;
  const height = Math.max(...ys) - minY + PAD_MM;

  return (
    <svg
      role="img"
      aria-label="Mặt bằng chỉ đọc"
      viewBox={`${String(minX)} ${String(minY)} ${String(width)} ${String(height)}`}
      style={{ width: '100%', maxHeight: '70vh' }}
    >
      {walls.map((wall) => (
        <line
          key={wall.id}
          x1={wall.centreline.start.x}
          y1={wall.centreline.start.y}
          x2={wall.centreline.end.x}
          y2={wall.centreline.end.y}
          stroke="currentColor"
          strokeWidth={wall.thicknessMm}
          strokeLinecap="square"
        />
      ))}
    </svg>
  );
}

export function SharedModelView({ model }: { model: SharedModel }) {
  const levels = [...model.graph.graph.levels].sort((a, b) => a.order - b.order);
  const [picked, setPicked] = useState<string | null>(null);
  const levelId = picked ?? levels[0]?.id ?? '';

  return (
    <>
      <h1>{model.projectName}</h1>
      <p>Bản xem chỉ đọc qua liên kết chia sẻ.</p>
      {levels.length > 1 ? (
        <label>
          Tầng{' '}
          <select value={levelId} onChange={(event) => { setPicked(event.target.value); }}>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <WallPlan model={model} levelId={levelId} />
    </>
  );
}

export function SharedModelPage({ client }: { client?: Pick<ApiClient, 'share'> }) {
  const { token = '' } = useParams();
  const query = useSharedModel(token, client);

  return (
    <main style={{ padding: 24 }}>
      {query.isPending ? <p>Đang mở liên kết…</p> : null}
      {query.isError ? (
        <div role="alert">
          <h1>{isNotFound(query.error) ? SHARE_LINK_GONE_MESSAGE : 'Không mở được liên kết'}</h1>
          <p>
            {isNotFound(query.error)
              ? 'Liên kết đã hết hạn, đã bị thu hồi hoặc không đúng. Hãy xin người chia sẻ một liên kết mới.'
              : 'Không kết nối được máy chủ. Thử tải lại trang sau ít phút.'}
          </p>
        </div>
      ) : null}
      {query.data === undefined ? null : <SharedModelView model={query.data} />}
    </main>
  );
}
