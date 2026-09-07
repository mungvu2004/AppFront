import type { MeasurePoint, MeasurementNoteId } from '@/domain/measure/measure';
import type { Millimetres } from '@/domain/units/types';

/**
 * Bốn chế độ đo của màn `MeasurementTool`, khai LẠI ở đây thay vì nhập từ
 * `src/screens/viewer/MeasurementTool/measurementToolTypes.ts::MeasureMode`.
 *
 * `src/lib` và `src/types` không được import từ `src/screens` (ranh giới
 * tầng, CLAUDE.md mục 0.4), nên hai union này phải khớp nhau bằng tay. Bốn
 * giá trị và thứ tự trùng khớp có chủ ý với bản gốc.
 */
export type MeasurementRecordMode = 'pointToPoint' | 'perpendicular' | 'height' | 'floorArea';

/**
 * Hình dạng một phép đo khi đi trên dây, giữa `src/lib/mutations/measurement.ts`
 * và máy chủ — LG-3 ("lưu số đo kèm dự án làm hồ sơ").
 *
 * Không phải `PinnedMeasurement` của màn đo: trường đó còn có `valueLabel`
 * (chuỗi đã định dạng — A15 cấm lưu chuỗi hiển thị, chỉ lưu số thô) và
 * `visible`/`stale`/`staleReason` (trạng thái hiển thị của MÀN, tính lại mỗi
 * lần tải chứ không phải một phần của hồ sơ). Bản ghi này chỉ giữ đúng những
 * gì cần lưu: id do client tự sinh (tiền tố `MS-`, dùng lại
 * `MeasurementNoteId` domain đã có thay vì đặt tên mới), tên, chế độ, các
 * điểm đã chấm và giá trị thô — đủ để tầng hiển thị định dạng lại khi tải về.
 */
export interface MeasurementRecord {
  readonly id: MeasurementNoteId;
  readonly name: string;
  readonly mode: MeasurementRecordMode;
  readonly points: readonly MeasurePoint[];
  readonly rawValueMm: Millimetres;
}
