/**
 * Bảy kịch bản của màn "Chuẩn hoá độ dày tường", dựng sẵn để story (T8) và bài
 * kiểm dùng chung. Theo đúng khuôn `roomLabelReviewScenarios.ts` /
 * `wallLayerReviewScenarios.ts` của hai màn QC anh em: đúng bảy kịch bản, tên
 * nhánh lấy nguyên từ `SEVEN_STATES`, nhãn tiếng Việt lấy nguyên từ
 * `SEVEN_STATE_LABELS` chứ không tự đặt một bản dịch thứ hai có thể trôi khỏi
 * bản gốc.
 *
 * Mỗi kịch bản mang RAW DATA đúng hình dạng `ThicknessFixtureWall` — KHÔNG
 * phải `ThicknessSegmentRow`/`ApplyPreview` đã tính sẵn. Lý do giống hệt hai
 * màn anh em: viewmodel là kết quả của `useThicknessStandardization` (T5), và
 * dựng sẵn nó ở đây nghĩa là chép lại logic của hook vào một chỗ thứ hai để
 * hai bên trôi khỏi nhau (R-61/R-70).
 */

import type { WallId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import type { WallKind } from '@/domain/walls/types';
import { SEVEN_STATE_LABELS, type SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  THICKNESS_FIXTURE_EMPTY,
  THICKNESS_FIXTURE_WALLS,
  type ThicknessFixtureWall,
} from './thicknessFixture';
import { DEFAULT_TOLERANCE_MM, THICKNESS_GROUPS_MM, type ThicknessGroup, type ThicknessScreenState } from './thicknessTypes';

/* -------------------------------------------------------------------------- */
/* Bộ tường nhỏ "đã chuẩn hết" — dùng cho `empty` và (sau khi áp) `success`.   */
/* -------------------------------------------------------------------------- */

/** Dựng một đoạn tường đã ĐÚNG một trong ba nhóm chuẩn — không cần chuẩn hoá gì thêm. */
function standardWall(
  code: string,
  xStartMm: number,
  xEndMm: number,
  thicknessMm: number,
  kind: WallKind,
  floorName: string,
  baseElevationMm: number,
  confidence: number,
  reviewed: boolean,
): ThicknessFixtureWall {
  return {
    wall: {
      id: `W-${code}` as WallId,
      kind,
      centreline: { start: { x: millimetres(xStartMm), y: millimetres(0) }, end: { x: millimetres(xEndMm), y: millimetres(0) } },
      thicknessMm: millimetres(thicknessMm),
      baseElevationMm: millimetres(baseElevationMm),
      topElevationMm: millimetres(baseElevationMm + 3000),
    },
    confidence,
    reviewed,
    floorName,
  };
}

/**
 * 6 đoạn, đúng khớp {@link THICKNESS_GROUPS_MM} (2 mỗi nhóm), trải cả ba tầng —
 * "độ dày đã chuẩn hết, không cần làm gì" của kịch bản `empty`.
 */
const THICKNESS_SCENARIO_ALREADY_STANDARD_WALLS: readonly ThicknessFixtureWall[] = [
  standardWall('101', 0, 800, 110, 'railing', 'Tầng 1', 0, 0.95, true),
  standardWall('102', 1000, 1800, 110, 'railing', 'Tầng 2', 3000, 0.9, false),
  standardWall('103', 2000, 2800, 220, 'partition', 'Tầng 1', 0, 0.93, true),
  standardWall('104', 3000, 3800, 220, 'partition', 'Tầng 3', 6000, 0.88, false),
  standardWall('105', 4000, 4800, 330, 'loadBearing', 'Tầng 2', 3000, 0.97, true),
  standardWall('106', 5000, 5800, 330, 'loadBearing', 'Tầng 3', 6000, 0.91, false),
];

/* -------------------------------------------------------------------------- */
/* Bản đã áp của 48 đoạn — dùng cho kịch bản `success` ("vừa áp xong").        */
/* -------------------------------------------------------------------------- */

/** Nhóm chuẩn gần nhất trong {@link THICKNESS_GROUPS_MM}, cùng công thức với `thicknessFixture.ts`. */
function nearestGroupMm(thicknessMm: number): number {
  return THICKNESS_GROUPS_MM.reduce((nearest, group) =>
    Math.abs(thicknessMm - group) < Math.abs(thicknessMm - nearest) ? group : nearest,
  );
}

/** Cột bê tông cốt thép: vượt xa 330 mm — cùng biên với `PLAUSIBLE_WALL_MAX_MM` của `thicknessFixture.ts`. */
const PLAUSIBLE_WALL_MAX_MM = 400;

/**
 * Độ dày SAU khi áp — theo đúng quyết định X4 (`thicknessTypes.ts`): cụm đo
 * (≥2 đoạn cùng giá trị) luôn đổi về nhóm gần nhất; đo lẻ lệch quá
 * {@link DEFAULT_TOLERANCE_MM} thì giữ nguyên ("sẽ không đổi"); cột bê tông
 * cốt thép không có lệnh áp nên luôn giữ nguyên (X2).
 */
function appliedThicknessMm(thicknessMm: number, allThicknesses: readonly number[]): number {
  if (thicknessMm > PLAUSIBLE_WALL_MAX_MM) {
    return thicknessMm;
  }
  const occurrences = allThicknesses.filter((value) => value === thicknessMm).length;
  const nearest = nearestGroupMm(thicknessMm);
  if (occurrences === 1 && Math.abs(thicknessMm - nearest) > DEFAULT_TOLERANCE_MM) {
    return thicknessMm;
  }
  return nearest;
}

const ALL_FIXTURE_THICKNESSES = THICKNESS_FIXTURE_WALLS.map((entry) => entry.wall.thicknessMm);

/**
 * 48 đoạn của bộ mẫu chính, SAU khi áp chuẩn hoá — mọi đoạn đổi được đã đổi,
 * sáu đoạn lệch quá dung sai và ba đoạn cột bê tông cốt thép giữ nguyên. Dùng
 * cho kịch bản `success`, đúng khuôn `allNamedAndReviewed` của
 * `roomLabelReviewScenarios.ts` (biến đổi bộ mẫu chính thay vì dựng một bộ
 * riêng, để câu kết quả khớp đúng những con số đã kiểm ở `thicknessFixture.ts`).
 */
function appliedFixtureWalls(): readonly ThicknessFixtureWall[] {
  return THICKNESS_FIXTURE_WALLS.map((entry) => ({
    ...entry,
    wall: { ...entry.wall, thicknessMm: millimetres(appliedThicknessMm(entry.wall.thicknessMm, ALL_FIXTURE_THICKNESSES)) },
  }));
}

/* -------------------------------------------------------------------------- */
/* Một kịch bản.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Nguyên liệu cho một trong bảy trạng thái, cộng vài cờ ngoài dữ liệu tường
 * (vai trò, thu gọn, lỗi, nhóm tích sẵn) mà bản thân `Wall[]` không mang.
 *
 * Mọi trường có mặt ở MỌI kịch bản (đúng tinh thần `SevenStateScenario`): một
 * nơi gọi đọc `scenario.error` không phải đoán xem trường đó có tồn tại không.
 */
export interface ThicknessStandardizationScenario {
  readonly state: ThicknessScreenState;
  /** Nhãn tiếng Việt của trạng thái, nguyên từ `SEVEN_STATE_LABELS`. */
  readonly label: string;
  readonly walls: readonly ThicknessFixtureWall[];
  /**
   * Nhóm chuẩn đã được tích sẵn khi mở kịch bản này — mô phỏng người dùng đã
   * chọn trước lúc chụp ảnh màn hình/chạy bài kiểm. KHÔNG phải mặc định của
   * màn: `ThicknessGroupRow.accepted` vẫn `false` cho MỌI hàng lúc màn mới
   * tải (CẤM TUYỆT ĐỐI "không tích sẵn", `thicknessTypes.ts`) — trường này chỉ
   * có ý nghĩa với kịch bản `partial` (mô phỏng bước giữa chừng của người
   * dùng), rỗng ở mọi kịch bản khác.
   */
  readonly acceptedGroups: readonly ThicknessGroup[];
  /** Câu kết quả sau khi đã áp. Non-null CHỈ ở kịch bản `success`. */
  readonly resultSentence: string | null;
  /** `true` ở kịch bản `forbidden` — vai Người xem. */
  readonly isViewerRole: boolean;
  /** `true` ở kịch bản `collapsed`. */
  readonly isCollapsed: boolean;
  /** Non-null CHỈ ở kịch bản `error`, cùng quy ước với `SevenStateScenario.error`. */
  readonly error: unknown;
}

const labelOf = (state: SevenState): string => SEVEN_STATE_LABELS[state];

const NO_ACCEPTED_GROUPS: readonly ThicknessGroup[] = [];

/**
 * 1. Rỗng — độ dày đã chuẩn hết, không cần làm gì (`emptyNotice` của
 * {@link ThicknessSummaryProps} sẽ nói ra điều đó). Biến thể "chưa có số đo"
 * (đặc tả mục 2.3.1) nằm ở {@link THICKNESS_SCENARIO_EMPTY_UNMEASURED} bên
 * dưới — hai kịch bản `empty` khác nhau về LÝ DO rỗng, nên tách hai hằng thay
 * vì ép chung một mảng `walls` phải nói được cả hai chuyện cùng lúc.
 */
export const THICKNESS_SCENARIO_EMPTY: ThicknessStandardizationScenario = {
  state: 'empty',
  label: labelOf('empty'),
  walls: THICKNESS_SCENARIO_ALREADY_STANDARD_WALLS,
  acceptedGroups: NO_ACCEPTED_GROUPS,
  resultSentence: null,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/**
 * 1b. Biến thể của `empty` — CHƯA có số đo nào (AI chưa dò xong), khác lý do
 * rỗng với {@link THICKNESS_SCENARIO_EMPTY} (đã đo xong và đều chuẩn). KHÔNG
 * nằm trong {@link THICKNESS_STANDARDIZATION_SCENARIOS} — bảy kịch bản đó chỉ
 * cần đúng một đại diện cho mỗi trạng thái; đây là hằng phụ cho story/test
 * muốn phân biệt hai lý do rỗng.
 */
export const THICKNESS_SCENARIO_EMPTY_UNMEASURED: ThicknessStandardizationScenario = {
  state: 'empty',
  label: labelOf('empty'),
  walls: THICKNESS_FIXTURE_EMPTY,
  acceptedGroups: NO_ACCEPTED_GROUPS,
  resultSentence: null,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 2. Đang tải — chưa có đoạn tường nào tới, khung xương biểu đồ đúng `HISTOGRAM_HEIGHT_PX`. */
export const THICKNESS_SCENARIO_LOADING: ThicknessStandardizationScenario = {
  state: 'loading',
  label: labelOf('loading'),
  walls: THICKNESS_FIXTURE_EMPTY,
  acceptedGroups: NO_ACCEPTED_GROUPS,
  resultSentence: null,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/**
 * 3. Một phần — TRẠNG THÁI CHÍNH của màn. Hai điều kiện của đặc tả cùng đúng ở
 * đây: `walls` chỉ còn Tầng 1 và Tầng 2 (Tầng 3 CHƯA có số đo, "mới có số đo
 * của một số tầng"), và {@link ThicknessStandardizationScenario.acceptedGroups}
 * chỉ có hai trong bốn nhóm ("chỉ chọn hai nhóm").
 */
export const THICKNESS_SCENARIO_PARTIAL: ThicknessStandardizationScenario = {
  state: 'partial',
  label: labelOf('partial'),
  walls: THICKNESS_FIXTURE_WALLS.filter((entry) => entry.floorName !== 'Tầng 3'),
  acceptedGroups: [220, 110],
  resultSentence: null,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 4. Lỗi — lớp dữ liệu độ dày hỏng. */
export const THICKNESS_SCENARIO_ERROR: ThicknessStandardizationScenario = {
  state: 'error',
  label: labelOf('error'),
  walls: THICKNESS_FIXTURE_EMPTY,
  acceptedGroups: NO_ACCEPTED_GROUPS,
  resultSentence: null,
  isViewerRole: false,
  isCollapsed: false,
  error: new Error('Không tải được lớp độ dày tường của tầng.'),
};

/**
 * 5. Xong — vừa áp xong, kèm dòng kết quả và nút hoàn tác.
 *
 * `walls` là bản ĐÃ ÁP của bộ mẫu 48 đoạn ({@link appliedFixtureWalls}): 39
 * đoạn (30 đoạn 195 mm + 5 đoạn quanh 110 + 4 đoạn quanh 330) đã về đúng một
 * trong ba nhóm chuẩn; 6 đoạn lệch quá dung sai và 3 đoạn cột bê tông cốt thép
 * giữ nguyên (X2, X4). Vì không đoạn nào còn `exceedsTolerance` NGOÀI sáu đoạn
 * cột/lệch quá dung sai (chúng không đổi trạng thái đó khi áp), tóm tắt của
 * đặc tả "nếu mọi đoạn đều trong dung sai thì tóm tắt chuyển sang mức đã
 * duyệt" áp dụng cho 39 đoạn đã chuẩn — hook (T5) tính `status: 'verified'`
 * cho chúng khi đồng thời `reviewed === true`.
 */
export const THICKNESS_SCENARIO_SUCCESS: ThicknessStandardizationScenario = {
  state: 'success',
  label: labelOf('success'),
  walls: appliedFixtureWalls(),
  acceptedGroups: [...THICKNESS_GROUPS_MM],
  resultSentence: 'Đã chuẩn hoá 48 tường về 3 nhóm chuẩn; 6 tường lệch quá 20 mm không đổi.',
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 6. Không có quyền — vai Người xem, chỉ xem; dữ liệu như `partial` (đủ ba tầng). */
export const THICKNESS_SCENARIO_FORBIDDEN: ThicknessStandardizationScenario = {
  state: 'forbidden',
  label: labelOf('forbidden'),
  walls: THICKNESS_FIXTURE_WALLS,
  acceptedGroups: NO_ACCEPTED_GROUPS,
  resultSentence: null,
  isViewerRole: true,
  isCollapsed: false,
  error: null,
};

/** 7. Thu gọn — ẩn canvas xem trước; dữ liệu như `partial` (đủ ba tầng). */
export const THICKNESS_SCENARIO_COLLAPSED: ThicknessStandardizationScenario = {
  state: 'collapsed',
  label: labelOf('collapsed'),
  walls: THICKNESS_FIXTURE_WALLS,
  acceptedGroups: NO_ACCEPTED_GROUPS,
  resultSentence: null,
  isViewerRole: false,
  isCollapsed: true,
  error: null,
};

/** Bảy kịch bản, đúng thứ tự `SEVEN_STATES` — cho `expectSevenStates` và cho story. */
export const THICKNESS_STANDARDIZATION_SCENARIOS: readonly ThicknessStandardizationScenario[] = [
  THICKNESS_SCENARIO_EMPTY,
  THICKNESS_SCENARIO_LOADING,
  THICKNESS_SCENARIO_PARTIAL,
  THICKNESS_SCENARIO_ERROR,
  THICKNESS_SCENARIO_SUCCESS,
  THICKNESS_SCENARIO_FORBIDDEN,
  THICKNESS_SCENARIO_COLLAPSED,
];
