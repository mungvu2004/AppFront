/**
 * Khung React bọc `<Viewer>` của Pascal.
 *
 * Tách khỏi `pascalMount.tsx` vì `react-refresh/only-export-components`: một tệp
 * vừa xuất hàm thường vừa khai component thì fast refresh không chạy được.
 */

import { useCallback, useEffect, useState } from 'react';
import { Viewer } from '@pascal-app/viewer';

import type { PascalScene } from '@/lib/pascal/types';

import { loadSceneIntoPascal } from './pascalScene';

export interface PascalFrameProps {
  readonly scene: PascalScene;
  /**
   * **Phải đổi mỗi lần nạp cảnh mới.** Đo được: để nó cố định thì viewer giữ
   * nguyên phán quyết "sẵn sàng" của cảnh trước và không bao giờ nói lại.
   */
  readonly sceneKey: number;
  readonly onReadyChange: ((ready: boolean) => void) | undefined;
  readonly onFatal: ((error: Error) => void) | undefined;
}

export function PascalFrame({ scene, sceneKey, onReadyChange, onFatal }: PascalFrameProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadSceneIntoPascal(scene)
      .then(() => {
        if (!cancelled) setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (!cancelled) onFatal?.(cause instanceof Error ? cause : new Error(String(cause)));
      });

    return () => {
      cancelled = true;
    };
  }, [scene, onFatal]);

  const handleReady = useCallback(
    (ready: boolean) => {
      onReadyChange?.(ready);
    },
    [onReadyChange],
  );

  if (!loaded) return null;

  return <Viewer sceneReadyKey={sceneKey} onSceneReadyChange={handleReady} />;
}
