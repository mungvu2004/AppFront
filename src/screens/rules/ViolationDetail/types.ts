/**
 * Từ điển kiểu của tấm trượt chi tiết vi phạm (S-34) — nguồn sự thật cho ba worker.
 *
 * `useViolationDetail.ts` dựng ra {@link ViolationDetailViewProps}; `ViolationDetail.tsx`
 * chỉ nhận đúng bộ đó và không được nhập `@/api`, `@/store`, `@/domain` hay `@/lib/http`
 * (R-60). Mọi câu chữ và mọi con số đã được định dạng sẵn ở hook, đúng A15: view chỉ in ra.
 *
 * ## Vì sao một số năng lực là `false`
 *
 * Bốn lượt khảo sát chỉ-đọc (2026-09-07, HEAD b4a4580) đã đo tầng logic thật. Năng lực
 * nào `false` là vì tầng logic HÔM NAY không có nó, không phải vì chưa nối dây — và phần
 * giao diện của nó **bị gỡ khỏi DOM**, không render nút vô hiệu hoá, không render ô trống,
 * không ghi chú "sắp có". Khuôn này chép từ `../RuleReport/ruleReportGateway.ts`.
 *
 * Bật một chữ `false` thành `true` ở `violationDetailGateway.ts` là toàn bộ việc phải làm
 * ở tầng màn hình khi tầng logic có năng lực đó.
 */

import type { RuleCode, RuleGroup, RuleSeverity } from '@/domain/rules/registry';
import type { LevelId } from '@/domain/spatial/types';

/* -------------------------------------------------------------------------- */
/* Năng lực.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Những gì lượt xem này làm được, đo từ tầng logic chứ không đoán.
 *
 * Nguồn phán quyết cho từng trường nằm ở `violationDetailGateway.ts`, kèm đường dẫn
 * và số dòng của bằng chứng.
 */
export interface ViolationDetailCapabilities {
  /** Quyền sửa của người dùng. Năng lực THẬT duy nhất thay đổi theo người xem (trạng thái 6). */
  readonly canEdit: boolean;
  /** Xoá đối tượng bị phát hiện — `createDeleteFurnitureCommand` có thật. */
  readonly canDeleteObject: boolean;
  /** Đổi tên phòng — `createRenameRoomCommand` có thật. */
  readonly canRenameRoom: boolean;
  /** Bỏ qua vi phạm kèm lý do — KHÔNG có trạng thái lưu, xác nhận kép bằng grep. */
  readonly canDismiss: boolean;
  /** Hai con số đo-được / ngưỡng đặt cạnh nhau — `Violation` không mang số đo được. */
  readonly canCompareMeasure: boolean;
  /** Khối hình 2D (SVG polygon từ `toBuildFloorInput` + `resolveWallShapes`). */
  readonly canPreview2d: boolean;
  /** Khối hình 3D (`mountViewerScene`) — nhập động để không vỡ ngân sách gói. */
  readonly canPreview3d: boolean;
  /** Độ tin cậy nhận diện của đối tượng (`ReviewMetadata.confidence`). */
  readonly canShowConfidence: boolean;
}

/* -------------------------------------------------------------------------- */
/* Nội dung một vi phạm.                                                       */
/* -------------------------------------------------------------------------- */

/** Một đối tượng dính tới vi phạm, hiện thành liên kết chữ đều bấm được. */
export interface ViolationObject {
  /** Mã đối tượng, ví dụ `W-000012ABCD`. Hiện bằng chữ đều. */
  readonly entityId: string;
  /** Nhãn tiếng Việt của loại bộ phận, ví dụ "tường", "phòng". */
  readonly kindLabel: string;
  /**
   * Độ tin cậy nhận diện đã ĐỊNH DẠNG SẴN ở hook (A15: dấu phẩy thập phân),
   * ví dụ "0,62". `null` khi thực thể không mang `ReviewMetadata`.
   */
  readonly confidenceLabel: string | null;
  /** Đối tượng gây lỗi chính, phân biệt với các đối tượng chỉ liên quan. */
  readonly isSubject: boolean;
}

/**
 * Một giả thuyết về nguyên nhân, viết bằng tiếng thường, KHÔNG phán xét.
 *
 * Đây KHÔNG phải "căn cứ luật" (thứ đặc tả cấm tự viết) — căn cứ là lý do một luật tồn
 * tại; giả thuyết là phỏng đoán vì sao lượt chạy này ra kết quả ấy. Mỗi giả thuyết phải
 * bắt rễ vào một tín hiệu THẬT đọc được (độ tin cậy, nhóm luật, loại thực thể); cấm bịa.
 */
export interface ViolationCause {
  readonly id: string;
  /** Câu tiếng Việt thường, đã định dạng số sẵn. */
  readonly text: string;
}

/** Một hàng trong khối "Lựa chọn xử lý". */
export type ViolationActionKind = 'deleteObject' | 'renameRoom' | 'dismiss';

export interface ViolationAction {
  readonly kind: ViolationActionKind;
  /** Nhãn nút, tiếng Việt viết thường kiểu câu (A6). */
  readonly label: string;
  /** Một câu mô tả hậu quả. */
  readonly description: string;
  /** Các mã đối tượng sẽ bị ảnh hưởng — dùng cho xem trước khi trỏ vào hàng. */
  readonly affectedEntityIds: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11 / R-63).                                                */
/* -------------------------------------------------------------------------- */

/**
 * Trạng thái màn, đúng bảy giá trị của `SEVEN_STATES` trong
 * `@/lib/testing/sevenStateScenarios`.
 *
 * `partial` ở màn này có HAI nguồn, và cả hai đều hợp lệ: không có cách sửa tự động nào
 * bật được, HOẶC không dựng được ngữ cảnh hình. Khi đó phần chữ đứng một mình — cấm hiện
 * khung vỡ.
 */
export type ViolationDetailState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/** Khối hình đang hiện ở chế độ nào. */
export type ViolationFigureMode = '2d' | '3d';

/* -------------------------------------------------------------------------- */
/* Props của view.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Tất cả những gì `ViolationDetail.tsx` được biết.
 *
 * View thuần: test được chỉ từ props, không chạm store, không chạm mạng (mục D).
 */
export interface ViolationDetailViewProps {
  readonly state: ViolationDetailState;
  readonly capabilities: ViolationDetailCapabilities;

  /* -- Đầu (khối 1) -- */
  /** Nhãn mục của nhóm luật, ví dụ "hình học". */
  readonly groupLabel: string;
  readonly group: RuleGroup | null;
  /** Tiêu đề vi phạm, dựng thành h2. Nguyên văn từ `violation.message`. */
  readonly title: string;
  readonly severity: RuleSeverity | null;
  /** Nhãn mức tiếng Việt cho Badge, từ `RULE_SEVERITY_LABELS`. */
  readonly severityLabel: string;
  /** Mã đối tượng gây lỗi, chữ đều. */
  readonly subjectEntityId: string;

  /* -- Khối 2 "Luật" -- */
  /** Luật viết thành MỘT CÂU THƯỜNG. Lấy từ `Rule.name`; cấm tự soạn căn cứ. */
  readonly ruleSentence: string;

  /* -- Khối 3 "Số đo so với ngưỡng" — chỉ khi `canCompareMeasure` -- */
  readonly measureLabel: string | null;
  readonly thresholdLabel: string | null;

  /* -- Khối 4 "Phát hiện" -- */
  readonly objects: readonly ViolationObject[];
  /** Gọi khi bấm vào một mã đối tượng: khuôn camera R-07 + tô sáng R-09. */
  readonly onSelectObject: (entityId: string) => void;

  /* -- Khối 5 "Hình" — chỉ khi `canPreview2d` hoặc `canPreview3d` -- */
  readonly figureMode: ViolationFigureMode;
  readonly onFigureModeChange: (mode: ViolationFigureMode) => void;
  /** Mã đối tượng đang được xem trước hậu quả (trỏ vào một hàng lựa chọn); `null` khi không. */
  readonly previewEntityIds: readonly string[] | null;
  /**
   * Hình 2D đã tính sẵn ở hook. `null` khi không dựng được ngữ cảnh 2D.
   *
   * `points` là chuỗi thuộc tính `points` của `<polygon>`, đã tính xong ở hook bằng
   * `toBuildFloorInput` + `resolveWallShapes` — view chỉ đổ vào thuộc tính, đúng A15 và
   * đúng R-60 (view không được nhập `@/domain`). `isSubject` mang viền `--state-violation`
   * (phán quyết G4); `isDimmed` là đường nối của xem trước hậu quả: trỏ vào một hàng lựa
   * chọn thì hook bật cờ này cho các mã trong `affectedEntityIds`.
   */
  readonly figure2d: {
    readonly viewBox: string;
    readonly shapes: readonly {
      readonly id: string;
      readonly points: string;
      readonly isSubject: boolean;
      readonly isDimmed: boolean;
    }[];
  } | null;
  /**
   * Chỗ gắn canvas 3D. Hook sở hữu `import()` động tới `mountViewerScene`.
   *
   * Nhập động là bắt buộc, không phải tuỳ chọn: ngân sách `routeChunk` là 280 KiB và
   * `screens/viewer/Viewer3D` một mình đã chiếm 264,8 KiB. Khuôn: `RuleReport/types.ts:155`
   * `previewRef`.
   */
  readonly figureRef: (canvas: HTMLCanvasElement | null) => void;
  /**
   * Không dựng được ngữ cảnh hình ⇒ phần chữ đứng một mình, **cấm** hiện khung vỡ.
   *
   * Đây là nguồn thứ hai của trạng thái 3 (`partial`) — xem {@link ViolationDetailState}.
   */
  readonly figureUnavailable: boolean;

  /* -- Khối 6 "Nguyên nhân có thể" — LUÔN ≥ 2 -- */
  readonly causes: readonly ViolationCause[];

  /* -- Khối 7 "Lựa chọn xử lý" -- */
  readonly actions: readonly ViolationAction[];
  readonly onAction: (kind: ViolationActionKind) => void;
  /** Trỏ vào / rời khỏi một hàng: bật / tắt xem trước hậu quả. */
  readonly onActionHover: (kind: ViolationActionKind | null) => void;
  /** Lý do bỏ qua đang gõ. Chỉ dùng khi `canDismiss`. */
  readonly dismissReason: string;
  readonly onDismissReasonChange: (value: string) => void;
  /** Câu báo lý do chưa đủ, kiểm NGAY KHI GÕ; `null` khi hợp lệ. */
  readonly dismissReasonError: string | null;

  /* -- Chân (khối 8) -- */
  readonly ruleCode: RuleCode | null;
  readonly levelId: LevelId | null;

  /* -- Điều hướng, không đóng tấm trượt -- */
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  /** Đang đếm ngược để tự sang vi phạm kế tiếp; người dùng huỷ được. */
  readonly isAdvancing: boolean;
  readonly onCancelAdvance: () => void;

  /* -- Trạng thái 4 (lỗi) và 5 (xong) -- */
  /** Câu giải thích khi sửa thất bại, nguyên văn từ `result.error.reasons`. */
  readonly errorMessage: string | null;
  /** Một dòng xác nhận điềm đạm sau khi luật chạy lại và đã đạt. */
  readonly resolvedMessage: string | null;

  readonly onClose: () => void;
}
