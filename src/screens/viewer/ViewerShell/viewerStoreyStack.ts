/**
 * Xếp các tầng theo chiều đứng, và kéo chúng rời nhau ra — thanh trượt "Độ
 * tách" của vỏ 3D.
 *
 * File `.ts` THUẦN, không JSX, không React, không `src/api` / `src/store` /
 * `src/lib/http`. Đúng khuôn `thicknessPreviewGeometry.ts` của S-18,
 * `roomLabelCanvasGeometry.ts` của S-17 và `wallLayerHatch.ts` của lớp tường:
 * mục D nói "tính toán không nằm trong màn hình", nên phần tính nằm ở một
 * module anh em trong chính thư mục màn, còn `.tsx` chỉ gọi rồi vẽ.
 *
 * ## Vì sao đây KHÔNG phải hình học nghiệp vụ, và vì sao nó không thuộc `src/domain`
 *
 * Cao độ thật của một tầng là dữ liệu: `Level.elevationMm` của
 * `src/domain/spatial/types`, do bản vẽ quyết định, và file này KHÔNG đổi nó.
 * Độ tách là một hiệu ứng TRÌNH BÀY — người soát kéo bốn tầng rời nhau ra để
 * nhìn thấy tầng bị che, rồi thả về. Không phép đo nào, không diện tích nào,
 * không quy tắc không gian nào của `src/domain` đọc con số này; nó chết ngay
 * khi tắt màn. Đó là lý do nó ở đây chứ không phải một hàm mới trong
 * `src/domain` (R-68 cấm thêm, và R-61 cấm chép công thức nghiệp vụ vào màn —
 * đây không phải công thức nghiệp vụ).
 *
 * ## Quy đổi đơn vị đi qua đúng một cửa
 *
 * Bản vẽ là **milimét**; cảnh ba chiều là **mét** (`build/scene.ts` nói rõ:
 * phép chia cho một nghìn xảy ra đúng một lần, ở `toSceneLength`). File này
 * không tự chia, không tự nhân `1000`, không `toFixed`: nó gọi
 * {@link toSceneLength} cho mọi lần đổi, nên `local/no-raw-number` không có gì
 * để bắt và con số không thể lệch khỏi phần còn lại của cảnh.
 *
 * ## Độ tách là một BỘI SỐ, không phải một khoảng cách
 *
 * Nếu độ tách là "cộng thêm N mét" thì một nhà hai tầng và một nhà mười tầng
 * cần hai con số khác nhau mới trông giống nhau, và người dùng phải học lại
 * thanh trượt cho mỗi dự án. Nên `separation` là hệ số **không thứ nguyên**
 * trong đoạn [0, 1] và khoảng cách được nhân từ chính chiều cao tầng:
 *
 * ```text
 * y = elevation + order × separation × MAX_SPREAD_FACTOR × storeyHeight
 * ```
 *
 * `separation = 0` trả lại đúng cao độ thật — đó là bất biến {@link stackStoreys}
 * hứa và bài kiểm khẳng định. Tầng dưới cùng (`order = 0`) không bao giờ dịch,
 * nên mô hình tách ra bằng cách *mọc lên* chứ không trôi khỏi mặt đất.
 */

import { millimetres, type Millimetres } from '@/domain/units/types';
import { toSceneLength, type SceneLength } from '@/lib/three/build/scene';

/* -------------------------------------------------------------------------- */
/* Hằng số của hiệu ứng.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Độ tách hết cỡ đẩy mỗi tầng lên thêm bao nhiêu lần chiều cao của chính nó.
 *
 * Một lần: ở mức tối đa, khe hở giữa hai tầng đúng bằng một tầng, nên nhìn vào
 * là đọc được ngay "đây là bốn tầng chồng lên nhau" mà mô hình vẫn nằm gọn
 * trong khuôn hình đã khớp. Lớn hơn thì tầng trên cùng trôi ra khỏi khung và
 * người dùng phải thu phóng lại — đúng thứ thanh trượt này sinh ra để khỏi phải
 * làm.
 */
export const MAX_SPREAD_FACTOR = 1;

/** Hai đầu của thanh trượt. Không thứ nguyên. */
export const MIN_SEPARATION = 0;
export const MAX_SEPARATION = 1;

/**
 * Chiều cao dùng thay khi một tầng không khai `heightMm`.
 *
 * Ba mét — chiều cao tầng nhà ở thông dụng. Chỉ chạm tới khi dữ liệu thiếu,
 * và thà tách ra một khoảng hợp lý còn hơn tách ra không (`0` sẽ khiến thanh
 * trượt trông như hỏng).
 */
export const FALLBACK_STOREY_HEIGHT_MM: Millimetres = millimetres(3_000);

/* -------------------------------------------------------------------------- */
/* Đầu vào và đầu ra.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Cái ít nhất một tầng cần có để xếp được.
 *
 * Cố ý KHÔNG phải `Level` của `src/domain`: xếp chồng chỉ cần thứ tự, cao độ và
 * chiều cao. Nhận ít hơn nghĩa là bài kiểm viết được bằng ba số thay vì bằng cả
 * một đồ thị không gian, và bộ mẫu của story cắm vào được mà không phải dựng
 * `ReviewMetadata`.
 */
export interface StackableStorey {
  readonly id: string;
  /** Thứ tự từ dưới lên; tầng trệt là 0. Cùng nghĩa `Level.order`. */
  readonly order: number;
  /** Cao độ thật của sàn tầng, milimét. Cùng nghĩa `Level.elevationMm`. */
  readonly elevationMm: number;
  /** Chiều cao tầng, milimét. Thiếu thì dùng {@link FALLBACK_STOREY_HEIGHT_MM}. */
  readonly heightMm?: number;
}

/** Một tầng đã có chỗ đứng trong cảnh. */
export interface StackedStorey {
  readonly id: string;
  readonly order: number;
  /** Độ cao trong cảnh, MÉT — đặt thẳng vào `group.position.y`. */
  readonly offsetM: SceneLength;
  /** Phần dịch thêm do độ tách, MÉT. `0` khi `separation` bằng 0. */
  readonly spreadM: SceneLength;
}

/* -------------------------------------------------------------------------- */
/* Phép tính.                                                                  */
/* -------------------------------------------------------------------------- */

/** Ép về đoạn [{@link MIN_SEPARATION}, {@link MAX_SEPARATION}]; số hỏng thành 0. */
export function clampSeparation(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_SEPARATION;
  }

  return Math.min(MAX_SEPARATION, Math.max(MIN_SEPARATION, value));
}

/** Chiều cao dùng để tính khe hở của một tầng, có dự phòng khi dữ liệu thiếu. */
export function spreadHeightMm(storey: StackableStorey): number {
  const declared = storey.heightMm;

  if (typeof declared !== 'number' || !Number.isFinite(declared) || declared <= 0) {
    return FALLBACK_STOREY_HEIGHT_MM;
  }

  return declared;
}

/**
 * Khe hở thêm vào cho một tầng, milimét.
 *
 * Tầng dưới cùng luôn ra 0 — xem ghi chú đầu file: mô hình mọc lên chứ không
 * trôi khỏi mặt đất.
 */
export function storeySpreadMm(storey: StackableStorey, separation: number): number {
  const factor = clampSeparation(separation);

  if (factor === MIN_SEPARATION || storey.order <= 0) {
    return 0;
  }

  return storey.order * factor * MAX_SPREAD_FACTOR * spreadHeightMm(storey);
}

/**
 * Chỗ đứng của từng tầng, theo mét.
 *
 * Bất biến: `separation === 0` trả về ĐÚNG cao độ thật của mọi tầng, không
 * xê dịch một milimét nào. Bài kiểm khẳng định điều này chứ không tin lời hứa.
 */
export function stackStoreys(
  storeys: readonly StackableStorey[],
  separation: number,
): readonly StackedStorey[] {
  return storeys.map((storey) => {
    const spreadMm = storeySpreadMm(storey, separation);

    return {
      id: storey.id,
      order: storey.order,
      offsetM: toSceneLength(millimetres(storey.elevationMm + spreadMm)),
      spreadM: toSceneLength(millimetres(spreadMm)),
    };
  });
}

/**
 * Tổng chiều cao của chồng tầng sau khi tách, milimét — để khớp lại khuôn hình.
 *
 * Đỉnh của tầng cao nhất: cao độ đã tách cộng chiều cao của chính nó. Rỗng thì
 * bằng 0, vì không có gì để khuôn.
 */
export function stackedHeightMm(
  storeys: readonly StackableStorey[],
  separation: number,
): number {
  let highest = 0;

  for (const storey of storeys) {
    const top = storey.elevationMm + storeySpreadMm(storey, separation) + spreadHeightMm(storey);
    highest = Math.max(highest, top);
  }

  return highest;
}
