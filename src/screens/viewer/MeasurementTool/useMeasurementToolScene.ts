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

import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { levelsOf } from './measurementToolLevels';
import type { MeasurementSceneHandle, MountMeasurementScene } from './measurementToolScene';
import type { MeasurementScene } from './measurementToolViewModel';

/** Không tầng nào dựng được — một tham chiếu, để lượt lắp không chạy lại vô cớ. */

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
  const injectedMount = options.mountScene;

  const [scene, setScene] = useState<MeasurementScene | null>(null);
  const handleRef = useRef<MeasurementSceneHandle | null>(null);

  /**
   * Đồ thị thành đầu vào dựng hình, tính ngay chứ không đợi chuyến nạp động.
   *
   * Phép này rẻ và đồng bộ, và giữ nó ở đây có một lý do cụ thể: khi bài kiểm
   * tiêm `mountScene`, cảnh phải lắp NGAY trong lượt render ấy. Đẩy nó sang
   * nhánh động thì mọi lượt lắp đều phải chờ một microtask, kể cả lượt không
   * cần nạp gì — và bài kiểm đo "đã lắp chưa" sẽ đo trượt.
   */
  const levels = useMemo((): readonly BuildFloorInput[] => levelsOf(spatial), [spatial]);

  const latestFrame = useRef(frame);
  useEffect(() => {
    latestFrame.current = frame;
  });

  /*
   * Module cảnh nạp ĐỘNG, và đó là một quyết định về ngân sách gói chứ không
   * phải một sự cầu kỳ.
   *
   * `measurementToolScene` kéo theo `three` và `src/lib/three/build`. Nhập tĩnh
   * thì cả khối ấy nằm trong chunk mà người dùng tải NGAY khi bước vào màn, và
   * cổng `routeChunk` đo đúng con số đó — đo thật thì nó thành 292,1/280 KiB,
   * vượt 12,1 KiB. Nạp động đẩy khối ấy sang một chunk riêng, tải song song với
   * lượt dựng đầu; màn vẫn hiện đủ danh sách, đơn vị và bảy trạng thái trong lúc
   * chờ, và chỉ việc chấm điểm là phải đợi cảnh.
   *
   * `cancelled` là vì `await` mở một khoảng giữa lúc effect chạy và lúc cảnh về:
   * người dùng có thể đã rời màn trong khoảng ấy, và một cảnh lắp lên canvas đã
   * gỡ là một `WebGLRenderer` không ai dọn.
   */
  useEffect(() => {
    if (canvas === null || levels.length === 0) {
      return undefined;
    }

    let cancelled = false;
    let mounted: MeasurementSceneHandle | null = null;

    const attach = (mountScene: MountMeasurementScene): void => {
      if (cancelled) {
        return;
      }

      const mount = mountScene(canvas, { levels, frame: latestFrame.current });

      if (!mount.ok || cancelled) {
        return;
      }

      mounted = mount.handle;
      handleRef.current = mount.handle;
      // Ba trường này là đúng ba thứ `ScenePickOptions` đòi, cùng tên và cùng
      // hình dạng — nên không có lớp bọc nào ở giữa chúng và `createScenePick`.
      setScene({
        camera: mount.handle.camera,
        root: mount.handle.root,
        viewport: mount.handle.viewport,
      });
    };

    if (injectedMount !== undefined) {
      attach(injectedMount);
    } else {
      void import('./measurementToolScene').then(
        (module) => {
          attach(module.mountMeasurementScene);
        },
        () => {
          // Không nạp được module cảnh cũng chỉ là "không chấm được điểm", đúng
          // như không có WebGL. Màn không trắng, không mã lỗi (A11).
        },
      );
    }

    return (): void => {
      cancelled = true;
      mounted?.dispose();
      handleRef.current = null;
      setScene(null);
    };
  }, [canvas, levels, injectedMount]);

  useEffect(() => {
    handleRef.current?.update(frame);
  }, [frame]);

  return scene;
}
