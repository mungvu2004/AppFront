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
}

export function PascalFrame({
  scene,
  sceneKey,
  onReadyChange,
  onFatal,
  onSceneLoaded,
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

  return <Viewer sceneReadyKey={sceneKey} onSceneReadyChange={handleReady} />;
}
