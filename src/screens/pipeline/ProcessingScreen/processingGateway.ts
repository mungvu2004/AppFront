/**
 * Cổng dữ liệu của màn Xử lý (`ProcessingScreen`) — nơi mọi lời gọi ra khỏi màn
 * sẽ đi qua, MỘT KHI bốn việc dưới đây có endpoint thật.
 *
 * Cùng khuôn `floorUploadGateway.ts` / `inputQualityGateway.ts`: một `interface`
 * duy nhất cho hình dạng cổng. Nhưng KHÁC hai tiền lệ đó — file này KHÔNG có
 * factory (`createXxxGateway`). R-69 nói thiếu logic phải dùng thì dừng và hỏi;
 * ở đây "logic phải dùng" chính là bốn việc dưới, và cả bốn đều chưa tồn tại
 * trong `src/api` (đã soát `src/api/client.ts` và `src/api/endpoints.ts`,
 * không tìm thấy `pipeline`/`processing`/`queue`/`cancel` nào). Viết một factory
 * bây giờ chỉ có hai lối: gọi một endpoint không có (build vỡ), hoặc bịa dữ
 * liệu trả về — cả hai đều là thứ R-69 cấm ("khong tu che, khong stub tra gia
 * tri bia"). Nên file này dừng đúng ở lớp KIỂU: một `interface` để
 * `useProcessingScreen.ts` khai tham số `gateway?: ProcessingGateway`, và mỗi
 * phương thức ghi rõ NOT FOUND — tên việc còn thiếu — để nhiệm vụ nối dây thật
 * (V7) biết chính xác phải thêm gì vào `src/api` trước khi viết factory.
 *
 * Bốn việc, đúng bốn ví dụ đặc tả nêu — không thêm phương thức nào ngoài danh
 * sách này:
 *
 * 1. **Tiến độ trực tiếp theo từng tầng/bước** — `subscribeProgress`.
 * 2. **Huỷ xử lý** — `requestCancel`.
 * 3. **Chạy nền và thông báo khi xong** — `runInBackground`.
 * 4. **Vị trí trong hàng đợi** — `readQueuePosition`.
 *
 * Hình dạng dữ liệu thô ({@link ProcessingProgressSnapshot} và các kiểu con của
 * nó) là suy luận từ những gì `types.ts` cần để dựng viewmodel — CHƯA phải hợp
 * đồng BE đã chốt. Cố ý để RAW (số chưa định dạng, mốc giờ ISO), vì định dạng
 * (A15) là việc của hook, không phải của cổng.
 */

/* -------------------------------------------------------------------------- */
/* Dữ liệu thô — chưa định dạng, chưa xếp bảy trạng thái.                       */
/* -------------------------------------------------------------------------- */

export type ProcessingRawStageStatus = 'queued' | 'running' | 'done' | 'failed';

export interface ProcessingRawFloorProgress {
  readonly floorId: string;
  readonly floorName: string;
  readonly status: ProcessingRawStageStatus;
  readonly objectCount?: number;
}

export interface ProcessingRawStepProgress {
  readonly stepId: string;
  readonly status: ProcessingRawStageStatus;
  /** 0..100, chưa làm tròn. */
  readonly percent: number;
  readonly remainingSeconds?: number;
  readonly detailLines: readonly string[];
  readonly errorCode?: string;
  readonly children?: readonly ProcessingRawStepProgress[];
}

export interface ProcessingRawLogLine {
  readonly id: string;
  /** Mốc giờ ISO 8601 — hook định dạng bằng `src/lib/format`, không phải cổng. */
  readonly atIso: string;
  readonly text: string;
}

export interface ProcessingProgressSnapshot {
  readonly floors: readonly ProcessingRawFloorProgress[];
  readonly steps: readonly ProcessingRawStepProgress[];
  readonly logLines: readonly ProcessingRawLogLine[];
  /** `null` khi không xếp hàng (đang chạy ngay hoặc đã xong). */
  readonly queuePosition: number | null;
}

/* -------------------------------------------------------------------------- */
/* Tham số vào của bốn phương thức.                                            */
/* -------------------------------------------------------------------------- */

export interface SubscribeProgressInput {
  readonly projectId: string;
}

export interface RequestCancelInput {
  readonly projectId: string;
}

export interface RunInBackgroundInput {
  readonly projectId: string;
}

export interface ReadQueuePositionInput {
  readonly projectId: string;
}

/* -------------------------------------------------------------------------- */
/* Cái seam — chỉ kiểu, không cài đặt.                                         */
/* -------------------------------------------------------------------------- */

export interface ProcessingGateway {
  /**
   * NOT FOUND — chưa có endpoint đẩy tiến độ trực tiếp theo từng tầng/bước.
   * Cần một kênh đẩy thật (WebSocket/SSE) hoặc một điểm polling ở `src/api`
   * trước khi viết được factory cho phương thức này. Trả về hàm huỷ đăng ký,
   * để hook gọi trong dọn dẹp của `useEffect`.
   */
  readonly subscribeProgress: (
    input: SubscribeProgressInput,
    onUpdate: (snapshot: ProcessingProgressSnapshot) => void,
  ) => () => void;

  /** NOT FOUND — chưa có endpoint huỷ xử lý cho `/projects/:id/pipeline`. */
  readonly requestCancel: (input: RequestCancelInput) => Promise<void>;

  /**
   * NOT FOUND — chưa có endpoint/luồng "chạy nền và thông báo": rời màn, xử lý
   * vẫn tiếp tục, và một thông báo báo khi xong. Cần xác định cả cơ chế thông
   * báo (push? poll khi quay lại?) trước khi cài đặt.
   */
  readonly runInBackground: (input: RunInBackgroundInput) => Promise<void>;

  /** NOT FOUND — chưa có endpoint đọc vị trí hiện tại trong hàng đợi xử lý. */
  readonly readQueuePosition: (input: ReadQueuePositionInput) => Promise<number>;
}
