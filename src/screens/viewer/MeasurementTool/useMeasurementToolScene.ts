/**
 * Vòng đời cảnh 3D của màn đo: một canvas, một lượt lắp, một lượt trả.
 *
 * Tách khỏi `useMeasurementTool.ts` vì R-22 và chỉ vì R-22 — hook màn đã ôm bắn
 * tia, phím tắt, truy vấn và bảy trạng thái, và một vòng đời `WebGLRenderer`
 * không chen vừa vào đó nữa. Đường nhập của người gọi vẫn là hook màn: file này
 * không có người dùng nào khác.
 *
 * ## Vì sao hook tự lắp cảnh, thay vì đòi một cảnh đã lắp
 *
 * `mountMeasurementScene(canvas, options)` cần đúng hai thứ: `levels` —
 * `BuildFloorInput` của từng tầng, dựng từ đồ thị qua `toBuildFloorInput` — và
 * `frame`, điểm nhìn hiện tại của vỏ. Cả hai đều là thứ **hook** có: đồ thị tới
 * từ kho hoặc từ tuỳ chọn, còn `frame` là thứ `useViewerShell` trả về. Bắt
 * container tự lắp là bắt nó dựng lại cả hai, tức dựng lại nửa cái hook màn.
 *
 * Đây đúng khuôn `useExplodedView.ts` đang chạy: tuỳ chọn `mountScene` cho phép
 * bài kiểm tiêm một module cảnh giả, và mặc định là bản thật.
 *
 * ## Không có WebGL là một NHÁNH, không phải một sự cố
 *
 * `mountMeasurementScene` trả `{ ok: false }` khi máy không cấp được context —
 * nó không ném. Hook này đọc nhánh ấy rồi trả `null`, và `null` là đúng thứ màn
 * đã biết cách sống cùng từ trước: không chấm được điểm, `screenPoints` là
 * `null`, còn danh sách, đổi đơn vị, ẩn hiện, xoá và hoàn tác vẫn chạy đủ.
 * Không màn trắng, không mã lỗi (A11).
 *
 * ## `frame` đi qua ref, không qua danh sách phụ thuộc
 *
 * Điểm nhìn đổi mỗi khung hình trong lúc camera còn bay. Đưa nó vào danh sách
 * phụ thuộc của lượt lắp sẽ tháo và dựng lại cả cảnh mỗi khung hình ấy; nên lượt
 * lắp đọc `frame` mới nhất qua ref, và mọi lượt đổi về sau đi qua
 * `handle.update(frame)` — đúng một đường, cùng đường `useExplodedView` đi.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { storeysOf } from '@/screens/viewer/ViewerShell';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import {
  mountMeasurementScene,
  type MeasurementSceneHandle,
  type MountMeasurementScene,
} from './measurementToolScene';
import type { MeasurementScene } from './measurementToolViewModel';

/** Không tầng nào dựng được — một tham chiếu, để lượt lắp không chạy lại vô cớ. */
const NO_LEVELS: readonly BuildFloorInput[] = Object.freeze([]);

export interface UseMeasurementToolSceneOptions {
  /** Canvas của khe cắm cảnh; `null` cho tới lượt vẽ đầu tiên gắn nó vào cây. */
  readonly canvas: HTMLCanvasElement | null;
  /** Đồ thị đã chuẩn hoá. `null` là "chưa có mô hình", không phải một lỗi. */
  readonly spatial: NormalizedSpatial | null;
  /** Điểm nhìn hiện tại của vỏ. */
  readonly frame: ViewerSceneFrame;
  /** Thay module cảnh, cho bài kiểm không cần WebGL. */
  readonly mountScene?: MountMeasurementScene;
}

/**
 * Cảnh đã lắp, hoặc `null` khi chưa lắp được.
 *
 * `null` gồm cả bốn ca, và màn đối xử với chúng như nhau: chưa có canvas, chưa
 * có tầng nào dựng được, đồ thị hỏng, hoặc máy không có WebGL.
 *
 * @param options Canvas, đồ thị, điểm nhìn, và chỗ tiêm module cảnh.
 * @returns Ba trường `createScenePick` đòi, hoặc `null`.
 */
export function useMeasurementToolScene(
  options: UseMeasurementToolSceneOptions,
): MeasurementScene | null {
  const { canvas, spatial, frame } = options;
  const mountScene = options.mountScene ?? mountMeasurementScene;

  const [scene, setScene] = useState<MeasurementScene | null>(null);
  const handleRef = useRef<MeasurementSceneHandle | null>(null);

  /**
   * Đồ thị thành đầu vào của R-01, một `BuildFloorInput` cho mỗi tầng.
   *
   * `toBuildFloorInput` ném khi đồ thị hỏng chỉ mục hoặc mang số đo không hữu
   * hạn. Đó là một mô hình không dựng được, không phải một sự cố kỹ thuật để
   * hiện mã lỗi: nó thành "không có cảnh", tức đúng nhánh đã có sẵn ở trên.
   */
  const levels = useMemo((): readonly BuildFloorInput[] => {
    if (spatial === null) {
      return NO_LEVELS;
    }

    try {
      const built: BuildFloorInput[] = [];

      for (const storey of storeysOf(spatial)) {
        const input = toBuildFloorInput(spatial, storey.id);

        if (input !== null) {
          built.push(input);
        }
      }

      return built;
    } catch {
      return NO_LEVELS;
    }
  }, [spatial]);

  const latestFrame = useRef(frame);
  useEffect(() => {
    latestFrame.current = frame;
  });

  useEffect(() => {
    if (canvas === null || levels.length === 0) {
      return undefined;
    }

    const mount = mountScene(canvas, { levels, frame: latestFrame.current });

    if (!mount.ok) {
      return undefined;
    }

    const { handle } = mount;

    handleRef.current = handle;
    // Ba trường này là đúng ba thứ `ScenePickOptions` đòi, cùng tên và cùng hình
    // dạng — nên không có lớp bọc nào ở giữa chúng và `createScenePick`.
    setScene({ camera: handle.camera, root: handle.root, viewport: handle.viewport });

    return (): void => {
      handle.dispose();
      handleRef.current = null;
      setScene(null);
    };
  }, [canvas, levels, mountScene]);

  useEffect(() => {
    handleRef.current?.update(frame);
  }, [frame]);

  return scene;
}
