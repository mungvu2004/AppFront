/**
 * Hợp đồng của màn cài đặt bộ luật.
 *
 * File này do điều phối viên chốt **trước** khi ba worker viết song song, và là
 * lý do họ viết được song song: view, hook và test đều chỉ cần *hình dạng* này,
 * không cần bản hiện thực của nhau.
 *
 * ## Ba quyết định đã chốt, worker không được đổi
 *
 * **"Bỏ qua" không phải mức thứ tư.** Đặc tả đòi Select ba mức
 * "Vi phạm · Cảnh báo · Bỏ qua", nhưng sổ đăng ký có đúng ba severity
 * (`critical`/`warning`/`suggestion`) và A4 nói màu thứ tư là thứ nó tồn tại để
 * chặn. Nên Select đổi *mức* trong ba severity có sẵn, còn "bỏ qua" là Toggle
 * của luật đó tắt. Một luật tắt vẫn nằm nguyên trong danh sách ở độ mờ thấp.
 *
 * **Cấu hình là dữ liệu, không phải lệnh gọi `registry.setEnabled`.** Hàm đó
 * sửa một singleton toàn tiến trình: không hoàn tác được, không tự lưu được, và
 * hai màn nhìn vào sẽ thấy hai kết quả khác nhau. Cấu hình ở đây là một object
 * bất biến trong store, ghi bằng `commit(patch, label)` — nhờ vậy A8 (hoàn tác)
 * và A7 (tự lưu) áp dụng được mà màn không phải tự dựng lấy.
 *
 * **Số luật là 25, không phải 14.** Sổ đăng ký giữ 25 luật, 23 bật; hai luật
 * `ROOM-HAS-DOOR` và `ROOM-MIN-AREA` bị nhóm function thay thế nên mặc định
 * tắt. Chúng vẫn hiện, vì "luật đã tắt vẫn phải nhìn thấy được" và vì người
 * dùng cần biết *vì sao* nó tắt — đó là việc của `supersededBy`.
 */

import type { RuleCode, RuleGroup, RuleSeverity } from '@/domain/rules/registry';
import type { SaveIndicatorState } from '@/lib/autosave/toSaveIndicatorState';

/**
 * Loại công trình một bộ luật sẵn nhắm tới.
 *
 * Ba giá trị này là tập con của `ProjectBuildingType` mà màn cài đặt dự án đã
 * dùng, và cố ý viết trùng chữ: khi nào bộ luật sẵn được nối vào loại công
 * trình của dự án thì hai bên khớp nhau sẵn, không phải bắc cầu chuyển đổi.
 */
export type BuildingKind = 'residential' | 'commercial' | 'industrial';

/** Một ô ngưỡng trên màn, đã giải xong giá trị và lỗi. */
export interface RuleSettingsThreshold {
  readonly key: string;
  /** Nhãn tiếng Việt, viết thường, kiểu câu (A6). */
  readonly label: string;
  /** Hậu tố đơn vị hiện ngay trong ô: `mm`, `m²`, `°`, `%`. */
  readonly unit: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /**
   * Câu báo lỗi, hoặc `null` khi hợp lệ.
   *
   * Khi có, câu này **phải nêu đúng khoảng hợp lệ** — "chặn ngay tại ô" mà
   * không nói khoảng nào mới đúng thì người dùng chỉ biết mình sai, không biết
   * sửa thành gì.
   */
  readonly error: string | null;
}

/** Một dòng luật. Cao 56 khi từ 1024 trở lên. */
export interface RuleSettingsRow {
  readonly code: RuleCode;
  /** Luật viết thành **một câu**, lấy từ `Rule.name` của sổ đăng ký. */
  readonly sentence: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly severity: RuleSeverity;
  readonly thresholds: readonly RuleSettingsThreshold[];
  /**
   * `Đang ảnh hưởng 7 đối tượng`, hoặc `Chưa có dữ liệu để đánh giá` khi chưa
   * có mô hình. Câu này do hook dựng sẵn: định dạng số xảy ra ở viewmodel chứ
   * không ở view (A15).
   */
  readonly impactCaption: string;
  /** Số thật để chạy số; `null` khi chưa có mô hình. */
  readonly impactCount: number | null;
  /** Mã luật đã thay thế luật này, hoặc `null`. Chỉ hai luật có giá trị này. */
  readonly supersededBy: RuleCode | null;
}

/** Một thẻ nhóm luật. */
export interface RuleSettingsGroup {
  readonly group: RuleGroup;
  readonly label: string;
  readonly description: string;
  /** Toggle tổng: bật khi còn ít nhất một luật con bật. */
  readonly enabled: boolean;
  readonly rows: readonly RuleSettingsRow[];
}

/** Một nút bộ luật sẵn, kèm hậu quả đo trước. */
export interface RuleSettingsPresetOption {
  readonly kind: BuildingKind;
  readonly label: string;
  /** Một câu nói rõ nó đổi những gì. */
  readonly caption: string;
  /** Bao nhiêu luật sẽ đổi nếu áp — hiện hậu quả **trước** khi cam kết. */
  readonly changedRuleCount: number;
}

/**
 * Màn này được phép làm gì.
 *
 * Chép khuôn cổng năng lực của `RuleReport`: thứ không có logic thì báo `false`
 * và phần giao diện tương ứng rời khỏi DOM, chứ không hiện ra rồi không chạy.
 */
export interface RuleSettingsCapabilities {
  readonly canEditRules: boolean;
  readonly canApplyPreset: boolean;
  /** Khi chỉ đọc: một câu nói rõ **ai** được đổi. `null` khi sửa được. */
  readonly readOnlyReason: string | null;
}

/** Bảy trạng thái của A11. */
export type RuleSettingsStatus =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'ready'
  | 'forbidden'
  | 'collapsed';

/** Tất cả những gì view cần để vẽ. View không tính thêm gì từ đây. */
export interface RuleSettingsViewModel {
  readonly status: RuleSettingsStatus;
  readonly groups: readonly RuleSettingsGroup[];
  /** Thẻ "Ngưỡng chung" — dung sai hình học dùng chung cho nhiều luật. */
  readonly generalThresholds: readonly RuleSettingsThreshold[];
  readonly presets: readonly RuleSettingsPresetOption[];
  /** Cấu hình còn y mặc định không. Chân dính chỉ hiện khi `false`. */
  readonly isDefault: boolean;
  readonly saveState: SaveIndicatorState;
  /** Câu trạng thái lưu, ví dụ `Đã lưu lúc 14:32`. */
  readonly saveCaption: string;
  /** Tổng số luật trong sổ đăng ký: 25. */
  readonly totalRuleCount: number;
  /** Số luật đang bật. */
  readonly enabledRuleCount: number;
  /**
   * Câu cảnh báo hậu quả khi mọi luật đều tắt, `null` khi còn luật bật.
   * Không được tắt sạch mà không nói trước điều gì sẽ xảy ra.
   */
  readonly disableAllWarning: string | null;
  readonly errorMessage: string | null;
}

/** Mọi hành động view có thể phát ra. */
export interface RuleSettingsActions {
  readonly onToggleRule: (code: RuleCode, enabled: boolean) => void;
  readonly onToggleGroup: (group: RuleGroup, enabled: boolean) => void;
  readonly onChangeSeverity: (code: RuleCode, severity: RuleSeverity) => void;
  readonly onChangeThreshold: (code: RuleCode, key: string, value: number) => void;
  readonly onChangeGeneralThreshold: (key: string, value: number) => void;
  readonly onApplyPreset: (kind: BuildingKind) => void;
  readonly onRestoreDefaults: () => void;
}

/** Props của view thuần. Test dựng được chỉ từ đây, không cần store hay mạng. */
export interface RuleSettingsProps extends RuleSettingsActions {
  readonly model: RuleSettingsViewModel;
  readonly capabilities: RuleSettingsCapabilities;
}
