/**
 * Hàng dựng hình của cảnh đo: từ `BuildFloorInput` tới một `Group` có mesh.
 *
 * Tách khỏi `measurementToolScene.ts` vì R-22, và đường cắt chọn ở chỗ nó rẻ
 * nhất: file này không biết gì về renderer, camera, ánh sáng hay vòng vẽ, và
 * `measurementToolScene.ts` không phải biết gì về `BuildQueue`. Nó gọi
 * {@link SceneBuildOptions.onLevelReady} với một nhóm đã đủ mesh, còn tô màu,
 * đo hộp bao và bắn lại một khung hình là việc của bên kia.
 *
 * **Không một `BufferGeometry` nào sinh ra ở đây.** Mesh đến từ worker của R-03
 * qua `BuildQueue` → `toMesh`, và đó là điều làm nên hai tính chất mà công cụ đo
 * sống nhờ: hình học mang thuộc tính `normal` (`toGeometry`,
 * `build/buildQueue.ts:176-188`), và mỗi mesh mang `userData` do `tagPart` gắn
 * (`buildQueue.ts:200-214`) — đúng ba trường `readPartData` đọc.
 */

import { Group } from 'three';

import {
  BuildQueue,
  planFullBuild,
  toMesh,
  type BuildWorkerLike,
} from '@/lib/three/build/buildQueue';
import type { BuildFloorInput } from '@/lib/three/build/floor';

import type { MeasurementSceneStatus } from './measurementToolSceneTypes';

/** Mọi thứ hàng dựng cần. */
export interface SceneBuildOptions {
  /** Một `BuildFloorInput` cho mỗi tầng. */
  readonly levels: readonly BuildFloorInput[];
  /** Thay worker thật của R-03; `BuildQueue` nhận thẳng cái này. */
  readonly createWorker?: (() => BuildWorkerLike) | undefined;
  /**
   * Một tầng đã dựng xong mọi job của nó.
   *
   * Nhóm CHƯA được gắn vào cây nào và chưa có vật liệu nào — người nhận quyết
   * cả hai. Một tầng mà mọi job đều hỏng vẫn về đây, với một nhóm rỗng.
   */
  readonly onLevelReady: (levelId: string, group: Group) => void;
  /** Tiến độ vừa đổi. Gọi sau mỗi job, và một lượt ngay khi hàng mở. */
  readonly onStatusChange: (status: MeasurementSceneStatus) => void;
}

/** Tay cầm của một lượt dựng. */
export interface SceneBuild {
  /** Tiến độ ngay lúc này. */
  readonly status: () => MeasurementSceneStatus;
  /** Đóng hàng. Job chưa chạy bị huỷ, và không callback nào nổ thêm. */
  readonly dispose: () => void;
}

/**
 * Mở hàng dựng và bắt đầu đẩy job.
 *
 * @param options Tầng cần dựng, chỗ nhận tầng xong, và chỗ nhận tiến độ.
 */
export function startSceneBuild(options: SceneBuildOptions): SceneBuild {
  const queue = new BuildQueue(
    options.createWorker !== undefined ? { createWorker: options.createWorker } : {},
  );

  const levelGroups = new Map<string, Group>();
  const remainingByLevel = new Map<string, number>();
  const readyLevelIds: string[] = [];

  let settledCount = 0;
  let failedCount = 0;
  let totalCount = 0;
  let disposed = false;

  const phaseOf = (): MeasurementSceneStatus['phase'] => {
    if (totalCount === 0) {
      return 'idle';
    }
    if (settledCount < totalCount) {
      return 'building';
    }
    return failedCount > 0 && readyLevelIds.length === 0 ? 'failed' : 'ready';
  };

  const status = (): MeasurementSceneStatus => ({
    phase: phaseOf(),
    settledCount,
    totalCount,
    failedCount,
    readyLevelIds: [...readyLevelIds],
  });

  const finishLevel = (levelId: string): void => {
    const group = levelGroups.get(levelId);

    if (group === undefined || disposed) {
      return;
    }

    readyLevelIds.push(levelId);
    options.onLevelReady(levelId, group);
  };

  for (const model of options.levels) {
    const jobs = planFullBuild(model);
    const levelId = model.level.id;

    if (jobs.length === 0) {
      continue;
    }

    levelGroups.set(levelId, new Group());
    remainingByLevel.set(levelId, jobs.length);

    for (const job of jobs) {
      totalCount += 1;

      // Từng job một, không `enqueueAll`: đó là cách DUY NHẤT có phần trăm thật.
      void queue.enqueue(job).then((outcome) => {
        settledCount += 1;

        if (outcome.status === 'done') {
          const group = levelGroups.get(levelId);

          for (const part of outcome.parts) {
            group?.add(toMesh(part));
          }
        } else if (outcome.status === 'failed') {
          failedCount += 1;
        }

        const remaining = (remainingByLevel.get(levelId) ?? 0) - 1;
        remainingByLevel.set(levelId, remaining);

        if (remaining === 0 && outcome.status !== 'cancelled') {
          finishLevel(levelId);
        }

        options.onStatusChange(status());
      });
    }
  }

  options.onStatusChange(status());

  return {
    status,

    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;

      queue.dispose();
      levelGroups.clear();
      remainingByLevel.clear();
    },
  };
}
