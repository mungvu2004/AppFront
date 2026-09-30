/**
 * Khung React bọc `<Viewer>` của Pascal.
 *
 * Tách khỏi `pascalMount.tsx` vì `react-refresh/only-export-components`: một tệp
 * vừa xuất hàm thường vừa khai component thì fast refresh không chạy được.
 */

import { useCallback, useEffect, useState } from 'react';
import { Viewer } from '@pascal-app/viewer';

import type { PascalScene } from '@/lib/pascal/types';

import { loadSceneIntoPascal, type PascalSceneCensus } from './pascalScene';

export interface PascalFrameProps {
  readonly scene: PascalScene;
  /**
   * **Phải đổi mỗi lần nạp cảnh mới.** Đo được: để nó cố định thì viewer giữ
   * nguyên phán quyết "sẵn sàng" của cảnh trước và không bao giờ nói lại.
   */
  readonly sceneKey: number;
  readonly onReadyChange: ((ready: boolean) => void) | undefined;
  readonly onFatal: ((error: Error) => void) | undefined;
  /**
   * Số đo của lượt nạp, sau khi store đã dọn.
   *
   * Store Pascal **im lặng** bỏ node mồ côi và node không với tới được từ
   * `rootNodeIds`. `loadSceneIntoPascal` trả số đo ấy ra từ đầu, nhưng trước
   * đây không ai nghe — nên một tấm sàn bị dọn đi là một mặt sàn biến mất mà
   * màn hình vẫn nói "xong".
   */
  readonly onSceneLoaded: ((census: PascalSceneCensus) => void) | undefined;
  /**
   * Máy không dựng được WebGPU lẫn WebGL.
   *
   * Không có nó thì `<Viewer>` dựng thẻ dự phòng CỦA RIÊNG NÓ
   * (`viewer/src/components/viewer/unsupported-gpu-fallback.tsx`): chữ tiếng
   * Anh mời người dùng "open the editor", và màu viết cứng
   * `bg-[#fafafa]` · `text-neutral-900` · `bg-white`. Tức một màn hình vi phạm
   * cả A6 lẫn A1, ở đúng cái trạng thái mà không bài kiểm nào của AppFront
   * chạm tới — bài đơn vị giả lập `mount`, còn máy chạy e2e thì có GPU.
   */
  readonly onRendererUnavailable: (() => void) | undefined;
}

export function PascalFrame({
  scene,
  sceneKey,
  onReadyChange,
  onFatal,
  onSceneLoaded,
  onRendererUnavailable,
}: PascalFrameProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadSceneIntoPascal(scene)
      .then((census) => {
        if (cancelled) return;
        onSceneLoaded?.(census);
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (!cancelled) onFatal?.(cause instanceof Error ? cause : new Error(String(cause)));
      });

    return () => {
      cancelled = true;
    };
  }, [scene, onFatal, onSceneLoaded]);

  const handleReady = useCallback(
    (ready: boolean) => {
      onReadyChange?.(ready);
    },
    [onReadyChange],
  );

  if (!loaded) return null;

  return (
    <Viewer
      sceneReadyKey={sceneKey}
      onSceneReadyChange={handleReady}
      {...(onRendererUnavailable === undefined ? {} : { onRendererUnavailable })}
    />
  );
}
