# T1 · format-motion.md — Bản ghi chữ ký định dạng và chuyển động

Tài liệu này ghi đầy đủ chữ ký hàm, đường dẫn:số dòng, ví dụ từ JSDoc, và bằng chứng hành vi từ mã.
Dùng làm cơ sở để T5 (hook) và T6 (view) viết mà không phải đoán.

---

## 1. Định dạng số — `src/lib/format/number.ts`

### Hằng số và loại

**`MISSING_VALUE`** (dòng 33)
- Hằng số em dash: `'—'`
- Hiển thị khi giá trị là `null`, `undefined`, `NaN`, hoặc `Infinity`
- Dùng chung cho tất cả formatter

**`MaybeNumber`** (dòng 55)
```ts
export type MaybeNumber = number | null | undefined;
```
- Loại chấp nhận bất kỳ một trong những cách một số biến mất giữa pipeline và màn hình

**`NumberFormatOptions`** (dòng 57–73)
```ts
export interface NumberFormatOptions {
  readonly fractionDigits?: number;     // Hiển thị chính xác N thập phân (padding với 0)
  readonly maxFractionDigits?: number;  // Hiển thị tối đa N thập phân (bỏ trailing zeros)
  readonly grouping?: boolean;          // Nhóm hàng ngàn với dấu chấm (mặc định: true)
}
```
- **Mặc định `fractionDigits`**: Không cài đặt → dùng `maxFractionDigits`
- **Mặc định `maxFractionDigits`**: `DEFAULT_MAX_FRACTION_DIGITS` (3 ở dòng 39)
- **Mặc định `grouping`**: `true`

**`PercentFormatOptions`** (dòng 78–92)
```ts
export interface PercentFormatOptions {
  readonly fractionDigits?: number;
  readonly maxFractionDigits?: number;
  readonly source?: PercentSource;  // 'ratio' (0.125 → "12,5%") | 'percent' (12.5 → "12,5%")
}
```
- **Mặc định `source`**: `'ratio'`
- **Mặc định `maxFractionDigits`**: `DEFAULT_PERCENT_MAX_FRACTION_DIGITS` (1 ở dòng 42)

### Hàm

**`isFormattable(value: MaybeNumber): value is number`** (dòng 165–167)
```ts
export function isFormattable(value: MaybeNumber): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
```
- Kiểm tra giá trị có thể định dạng được (loại trừ `NaN` và `±Infinity`)
- Dùng để bảo vệ tất cả các lệnh gọi formatter

**`formatNumber(value, options?): string`** (dòng 201–211)
```ts
export function formatNumber(value: MaybeNumber, options: NumberFormatOptions = {}): string
```
- Định dạng số theo ký hiệu Việt: `1234567.891` → `"1.234.567,891"`
- Không bao giờ ném; giá trị không đọc được trả về `MISSING_VALUE`
- **Ví dụ từ JSDoc:**
  ```
  formatNumber(1234567.891)                      // "1.234.567,891"
  formatNumber(3.5, { fractionDigits: 2 })       // "3,50"
  formatNumber(2026, { grouping: false })        // "2026"
  formatNumber(null)                             // "—"
  ```

**`formatPercent(value, options?): string`** (dòng 225–239)
```ts
export function formatPercent(value: MaybeNumber, options: PercentFormatOptions = {}): string
```
- Định dạng tỷ lệ thành phần trăm: `0.125` → `"12,5%"`
- Dấu `%` từ `Intl`, không nối chuỗi tay
- **Ví dụ từ JSDoc:**
  ```
  formatPercent(0.125)                           // "12,5%"
  formatPercent(0.8, { fractionDigits: 0 })      // "80%"
  formatPercent(50, { source: 'percent' })       // "50%"
  formatPercent(undefined)                       // "—"
  ```

**`parseNumber(text: string): number | undefined`** (dòng 255–266)
```ts
export function parseNumber(text: string): number | undefined
```
- Đọc số mà người dùng gõ bằng ký hiệu Việt: `"4.250,50"` → `4250.5`
- Đảo ngược của `formatNumber`
- Leniently: chấp nhận tiền tố số giống `parseFloat`, bỏ qua dấu cách
- Chuỗi rỗng hoặc không đọc được trả về `undefined`, không bao giờ `NaN`

---

## 2. Định dạng đo lường — `src/lib/format/measure.ts`

### Hằng số

**Ngưỡng và độ chính xác** (dòng 31–48)
```ts
export const METRE_THRESHOLD_MM = MILLIMETRES_PER_METRE;  // 1000 mm
const MILLIMETRE_FRACTION_DIGITS = 0;
const METRE_FRACTION_DIGITS = 2;
const AREA_FRACTION_DIGITS = 2;        // Khớp với mẫu tiêu chuẩn 248,60 m²
const ANGLE_FRACTION_DIGITS = 1;
```

**Hậu tố**
```ts
const MILLIMETRE_SUFFIX = ' mm';
const METRE_SUFFIX = ' m';
const SQUARE_METRE_SUFFIX = ' m²';
const DEGREE_SUFFIX = '°';
```

### Loại

**`LengthDisplayUnit`** (dòng 22)
```ts
export type LengthDisplayUnit = 'mm' | 'm';
```

**`LengthFormatOptions`** (dòng 50–60)
```ts
export interface LengthFormatOptions {
  readonly unit?: LengthDisplayUnit;        // Bắt buộc đơn vị thay vì chọn từ độ lớn
  readonly fractionDigits?: number;         // Ghi đè 0 (mm) hoặc 2 (m)
}
```

**`MeasureFormatOptions`** (dòng 62–65)
```ts
export interface MeasureFormatOptions {
  readonly fractionDigits?: number;         // Ghi đè 2 (area) hoặc 1 (angle)
}
```

### Hàm

**`formatLength(valueMm: MaybeNumber, options?): string`** (dòng 90–103)
```ts
export function formatLength(valueMm: MaybeNumber, options: LengthFormatOptions = {}): string
```
- Định dạng độ dài từ mm
- Dưới 1000 mm: giữ mm, không thập phân → `"850 mm"`
- Từ 1000 mm: chuyển sang m, 2 thập phân → `"3,45 m"`
- **Ví dụ từ JSDoc:**
  ```
  formatLength(850)                      // "850 mm"
  formatLength(3450)                     // "3,45 m"
  formatLength(12400)                    // "12,40 m"
  formatLength(850, { unit: 'm' })       // "0,85 m"
  formatLength(3450, { unit: 'mm' })     // "3.450 mm"
  formatLength(null)                     // "—"
  ```

**`formatArea(areaM2: MaybeNumber, options?): string`** (dòng 113–119)
```ts
export function formatArea(areaM2: MaybeNumber, options: MeasureFormatOptions = {}): string
```
- Định dạng diện tích từ m², 2 thập phân
- **Bằng chứng từ mã:**
  - `AREA_FRACTION_DIGITS = 2` (dòng 40)
  - `SQUARE_METRE_SUFFIX = ' m²'` (dòng 47)
  - Gọi `formatNumber(areaM2, { fractionDigits: digits })` (dòng 118)
- **Ví dụ từ JSDoc + CONTRACT.md:**
  ```
  formatArea(2480)                       // "2.480,00 m²"
  formatArea(1234.5)                     // "1.234,50 m²"
  formatArea(620, { fractionDigits: 0 }) // "620 m²"
  formatArea(1842, { fractionDigits: 0 }) // "1.842 m²"
  formatArea(undefined)                  // "—"
  ```

**`formatAngle(angleDeg: MaybeNumber, options?): string`** (dòng 133–139)
```ts
export function formatAngle(angleDeg: MaybeNumber, options: MeasureFormatOptions = {}): string
```
- Định dạng góc từ độ, 1 thập phân
- Không gập góc ngoài `[0, 360)` (−90° và 270° có ý nghĩa khác nhau)
- **Ví dụ từ JSDoc:**
  ```
  formatAngle(90)                        // "90,0°"
  formatAngle(-45.25)                    // "-45,3°"
  formatAngle(null)                      // "—"
  ```

---

## 3. Định dạng ngày giờ — `src/lib/format/datetime.ts`

### Hằng số và loại

**`TimeInput`** (dòng 31)
```ts
export type TimeInput = Date | number | null | undefined;
```
- Chấp nhận `Date`, epoch ms, hoặc `null`/`undefined`

**`JUST_NOW_LABEL`** (dòng 34)
```ts
export const JUST_NOW_LABEL = 'vừa xong';
```

**`SUB_SECOND_LABEL`** (dòng 37)
```ts
export const SUB_SECOND_LABEL = 'dưới 1 giây';
```

**`TimestampFormatOptions`** (dòng 50–59)
```ts
export interface TimestampFormatOptions {
  readonly timeZone?: string;  // IANA zone như 'Asia/Ho_Chi_Minh'
}
```

### Hàm

**`isSameCalendarDay(left, right, timeZone?): boolean`** (dòng 129–137)
```ts
export function isSameCalendarDay(
  left: TimeInput,
  right: TimeInput,
  timeZone?: string
): boolean
```
- Kiểm tra hai thời điểm có cùng ngày lịch không
- Dùng formatter (không window 24h) để đồng bộ với display

**`formatClockTime(value, options?): string`** (dòng 144–150)
```ts
export function formatClockTime(value: TimeInput, options: TimestampFormatOptions = {}): string
```
- Định dạng `14:32` — giờ 24, không có ngày
- Dùng cho "Đã lưu lúc 14:32"

**`formatCalendarDate(value, options?): string`** (dòng 153–159)
```ts
export function formatCalendarDate(value: TimeInput, options: TimestampFormatOptions = {}): string
```
- Định dạng `03/08/2026` — ngày đầu, không có giờ
- Dùng cho "Gia hạn ngày ..."

**`formatTimestamp(value, now, options?): string`** (dòng 184–212)
```ts
export function formatTimestamp(
  value: TimeInput,
  now: TimeInput,
  options: TimestampFormatOptions = {}
): string
```
- Định dạng tương đối, dựa trên khoảng cách từ `now`
- **Quy tắc độ chính xác** (dòng 164–178):
  - Dưới 1 phút: `vừa xong`
  - Dưới 1 giờ: `12 phút trước`
  - Cùng ngày: `14:32`
  - Ngày khác: `03/08/2026 14:32`

**`formatDuration(durationMs: number | null | undefined): string`** (dòng 240–272)
```ts
export function formatDuration(durationMs: number | null | undefined): string
```
- Định dạng thời gian trôi qua: `"2 phút 15 giây"`
- Chỉ hai đơn vị lớn nhất được viết
- Đơn vị không < 1 bị bỏ
- Dưới 1 giây: `"dưới 1 giây"`
- **Ví dụ từ JSDoc:**
  ```
  formatDuration(135_000)                // "2 phút 15 giây"
  formatDuration(120_000)                // "2 phút"
  formatDuration(45_000)                 // "45 giây"
  formatDuration(400)                    // "dưới 1 giây"
  formatDuration(null)                   // "—"
  ```

---

## 4. Tiền tệ (TIỀN TỆ) — Kết quả tìm kiếm

**Lệnh tìm kiếm:**
```bash
rg -n "₫|VND|VNĐ|currency|Intl.NumberFormat" src/lib src/domain
```

**Kết quả:**
```
src/lib\format\number.ts:10: *   never assembled by hand. `Intl.NumberFormat('vi-VN')` places them, and a
src/lib\format\number.ts:44:/** The range `Intl.NumberFormat` accepts for fraction digits in every runtime. */
src/lib\format\number.ts:101: * Building an `Intl.NumberFormat` costs far more than using one, and a plan
src/lib\format\number.ts:105:const formatterCache = new Map<string, Intl.NumberFormat>();
src/lib\format\number.ts:107:function cachedFormatter(key: string, build: () => Intl.NumberFormat): Intl.NumberFormat {
src/lib\format\number.ts:169:function decimalFormatter(digits: ResolvedFractionDigits, grouping: boolean): Intl.NumberFormat {
src/lib\format\number.ts:171:    new Intl.NumberFormat(LOCALE, {
src/lib\format\number.ts:179:function percentFormatter(digits: ResolvedFractionDigits): Intl.NumberFormat {
src/lib\format\number.ts:181:    new Intl.NumberFormat(LOCALE, {
src/lib\three\camera\viewpointCodec.ts:17: * A {@link SharedViewpoint} is the camera's own handover currency — the point
src/lib\three\camera\modes.ts:23: * ## The viewpoint is the currency
src/lib\three\camera\modes.ts:97: * The handover currency. `target` is the point on the model being looked at, and
```

**Kết luận (Phán quyết Q2):**
- **Không có hàm tiền tệ nào trong `src/lib` hoặc `src/domain`**
- Không tìm thấy ký hiệu `₫`, `VND`, `VNĐ`
- `Intl.NumberFormat` được dùng cho định dạng số chung (dòng số lẻ), không phải tiền tệ cụ thể
- "currency" chỉ xuất hiện trong bình luận không liên quan ("handover currency" = đơn vị trao đổi camera)
- **Nợ P-01b**: `formatMoney` sẽ được viết trong `useBillingScreen.ts` (T5)

---

## 5. Hook chạy số — `src/hooks/useCountUp.ts`

### Loại

**`UseCountUpOptions`** (dòng 15–36)
```ts
export interface UseCountUpOptions {
  readonly from?: number;
  readonly format?: NumberFormatOptions;
  readonly reducedMotion?: boolean;
  readonly lowPerformance?: boolean;
  readonly scheduler?: FrameScheduler;
}
```
- **`from`** (dòng 18): Điểm bắt đầu chạy (mặc định: `0`). Retarget bắt đầu từ giá trị hiển thị
- **`format`** (dòng 22–23): Tuỳ chọn định dạng, giống `formatNumber`
- **`reducedMotion`** (dòng 28): Ghi đè tuỳ chọn hệ điều hành
- **`lowPerformance`** (dòng 30): Rút ngắn chạy xuống slot `instant`
- **`scheduler`** (dòng 35): Test seam cho đồng hồ và queue khung

### Hook chính

**`useCountUp(to: number, options?): CountUpSample`** (dòng 88–175)
```ts
export function useCountUp(to: number, options: UseCountUpOptions = {}): CountUpSample
```

**Trả về `CountUpSample`** (định nghĩa trong `src/lib/motion/useCountUp.ts`):
```ts
export interface CountUpSample {
  readonly value: number;        // Giá trị thô (dùng cho tính toán tiếp theo)
  readonly text: string;         // Chuỗi định dạng (dùng để render)
  readonly done: boolean;        // Chạy đã hoàn tất?
}
```

**Hành vi chính** (từ JSDoc dòng 38–58):
- Render `text`, không bao giờ `value`
- **Retarget**: Khi `to` thay đổi, chạy từ giá trị hiển thị hiện tại, không quay lại 0
- **Reduced motion**: Cắt ngang, không chạy
- Máy yếu (R-04): Rút ngắn chạy xuống `instant`

**Ví dụ sử dụng:**
```ts
const { text } = useCountUp(area, { format: { fractionDigits: 2 } });
```

---

## 6. Engine chạy số (thô) — `src/lib/motion/useCountUp.ts`

### Hằng số

**`COUNT_UP_DURATION`** (dòng 42)
```ts
export const COUNT_UP_DURATION: MotionDurationName = 'standard';
```
- Một slot duy nhất: `standard` (260 ms)
- Prompt yêu cầu 240 ms, nhưng quy tắc B chỉ cho phép 5 thời lượng và 240 không trong đó
- `standard` là slot gần nhất

**`COUNT_UP_EASING`** (dòng 45)
```ts
export const COUNT_UP_EASING: MotionEasingName = 'enter';
```
- Decelerating: chữ số chạy nhanh lúc sai, lắng xuống khi đúng

### Loại

**`CountUpSpec extends MotionConditions`** (dòng 48–59)
```ts
export interface CountUpSpec extends MotionConditions {
  readonly to: number;
  readonly from?: number;
  readonly format?: NumberFormatOptions;
}
```
- Extends `MotionConditions` (bao gồm `reducedMotion`, `lowPerformance`)

**`CountUpSample`** (dòng 62–67)
```ts
export interface CountUpSample {
  readonly value: number;
  readonly text: string;         // Luôn định dạng đúng — render cái này
  readonly done: boolean;
}
```

**`CountUp`** (dòng 109–122) — trạng thái chạy
```ts
export interface CountUp {
  readonly durationMs: number;
  readonly value: number;
  readonly text: string;
  readonly done: boolean;
  advance(deltaMs: number): CountUpSample;
  sample(): CountUpSample;
  finish(): CountUpSample;
}
```

### Hàm

**`sampleCountUp(spec: CountUpSpec, elapsedMs: number): CountUpSample`** (dòng 81–106)
```ts
export function sampleCountUp(spec: CountUpSpec, elapsedMs: number): CountUpSample
```
- Pure, không trạng thái
- Lấy vị trí chạy sau `elapsedMs`
- Luôn trả về `text` định dạng đúng

**`createCountUp(spec: CountUpSpec): CountUp`** (dòng 125–158)
```ts
export function createCountUp(spec: CountUpSpec): CountUp
```
- Tạo một chạy có trạng thái ở điểm bắt đầu
- Ghi nhớ vị trí, cho phép tính thời gian tích lũy
- **Các phương thức:**
  - `advance(deltaMs)`: Di chuyển thời gian và trả về frame mới
  - `sample()`: Đọc frame hiện tại không di chuyển thời gian
  - `finish()`: Nhảy đến giá trị cuối

---

## 7. Token chuyển động — `src/lib/motion/tokens.ts`

### Thang thời lượng (4 slot)

**`MotionDurationName`** (dòng 59)
```ts
export type MotionDurationName = 'instant' | 'fast' | 'standard' | 'slow';
```

**`MOTION_DURATIONS_MS`** (dòng 62–67)
```ts
export const MOTION_DURATIONS_MS: Readonly<Record<MotionDurationName, number>> = Object.freeze({
  instant: 120,
  fast: 180,
  standard: 260,
  slow: 340,
});
```

| Slot | ms | Gì chuyển động |
|---|---|---|
| `instant` | 120 | Trạng thái con trỏ đã ở: hover, focus ring, press |
| `fast` | 180 | Cái gì nhỏ xuất hiện: dropdown, tooltip |
| `standard` | 260 | Mặc định. Panel, toast, bất kỳ cái gì có không gian riêng |
| `slow` | 340 | Cái gì thay đổi màn hình: view change, camera move |

### Thang lặp (không chuyển tiếp)

**`AMBIENT_LOOP_MS`** (dòng 87)
```ts
export const AMBIENT_LOOP_MS = 700;
```

**Bằng chứng từ JSDoc** (dòng 76–86) — **Phán quyết Q5**:
> "700 ms paces the things that repeat rather than transition — the skeleton
> sweep, the progress sheen. Nothing travels from one state to another at it,
> which is why it is kept out of {@link MotionDurationName}: offering it as a
> fifth slot would invite someone to open a panel over three quarters of a
> second."

### Hàm thời lượng

**`durationMs(name: MotionDurationName, options?): number`** (dòng 102–104)
```ts
export function durationMs(name: MotionDurationName, options: ReducedMotionOption = {}): number
```
- Trả về ms cho một slot
- Trả về `0` nếu `reducedMotion` là true (ngưng hẳn, không "rất nhanh")
- Zero được coi là "đã xong" trước khi bắt đầu, cắt đi animation

**`cssDurationMs(name: MotionDurationName, options?): string`** (dòng 107–109)
```ts
export function cssDurationMs(name: MotionDurationName, options: ReducedMotionOption = {}): string
```
- Cùng giá trị nhưng CSS time: `"260ms"`

**`durationSeconds(name: MotionDurationName, options?): number`** (dòng 121–126)
```ts
export function durationSeconds(name: MotionDurationName, options: ReducedMotionOption = {}): number
```
- Chuyển đổi sang giây (cho `framer-motion` nếu cần)
- `standard` → `0.26` giây

### Thang cong (3 loại)

**`MotionEasingName`** (dòng 133)
```ts
export type MotionEasingName = 'enter' | 'exit' | 'inOut';
```

**`MOTION_EASINGS`** (dòng 232–236)
```ts
export const MOTION_EASINGS: Readonly<Record<MotionEasingName, MotionEasing>> = Object.freeze({
  enter: defineEasing('enter', [0, 0, 0.2, 1]),    // Decelerating
  exit: defineEasing('exit', [0.4, 0, 1, 1]),      // Accelerating
  inOut: defineEasing('inOut', [0.4, 0, 0.6, 1]),  // Symmetric
});
```

| Cong | Tính chất | Dùng cho |
|---|---|---|
| `enter` | Decelerating, nhanh rồi lắng | Phần tử đến |
| `exit` | Accelerating, chậm rồi nhanh | Phần tử đi (lật `enter` ngược lại) |
| `inOut` | Symmetric, easing both ends | Di chuyển (play in reverse = look same way) |

**Bằng chứng** (dòng 24–40):
- Chỉ gentle — không overshoot, không bounce, không spring
- Cubic Bézier, điểm kiểm soát trong hình vuông đơn vị
- Không thể vượt ngoài 0..1 hoặc quay lại chính nó

**`easingOf(name: MotionEasingName): MotionEasing`** (dòng 246–248)
```ts
export function easingOf(name: MotionEasingName): MotionEasing
```
- Lấy cong theo tên

**`MotionEasing`** (dòng 139–146)
```ts
export interface MotionEasing {
  readonly name: MotionEasingName;
  readonly points: CubicBezierPoints;
  readonly css: string;                    // e.g. "cubic-bezier(0, 0, 0.2, 1)"
  readonly at: (progress: number) => number;  // Sample: progress 0..1 → eased 0..1
}
```

---

## 8. Test — Đồng hồ giả `src/lib/testing/fakeClock.ts`

### Hằng số

**`FAKE_CLOCK_START`** (dòng 34)
```ts
export const FAKE_CLOCK_START = new Date('2026-08-17T14:32:00+07:00');
```
- Điểm bắt đầu chung cho tất cả test: 14:32 +07
- Dùng "Đã lưu lúc 14:32" của sản phẩm
- Hai file test định dạng cùng tức thì sẽ in chuỗi giống nhau

### Loại

**`FakeClock`** (dòng 43–59)
```ts
export interface FakeClock {
  readonly now: () => Date;
  readonly epochMs: () => number;
  readonly advance: (durationMs: number) => Promise<void>;
  readonly runAllTimers: () => Promise<void>;
  readonly flushMicrotasks: (turns?: number) => Promise<void>;
  readonly restore: () => void;
}
```

**Lời hứa của FakeClock** (dòng 12–28):
1. **Advancing chờ kết quả của nó** (dòng 14–17): `advance` là async; callback giải quyết promise trước khi `advance` trả lại
2. **Có thể thoát microtask queue mà không di chuyển thời gian** (dòng 19–20): `flushMicrotasks` không kích hoạt timer ngoài ý muốn
3. **Tức thì bắt đầu cố định và chung** (dòng 22–25): `FAKE_CLOCK_START` để test khác nhau giống nhau

### Hàm

**`installFakeClock(options?): FakeClock`** (dòng 82–103)
```ts
export function installFakeClock(options: FakeClockOptions = {}): FakeClock
```
- Chiếm quyền kiểm soát timer và trả về đồng hồ để điều khiển
- Dùng `vi.useFakeTimers()` từ Vitest
- **Lưu ý**: Gọi `clock.restore()` trong `afterEach`
- **Ví dụ từ JSDoc** (dòng 69–80):
  ```ts
  let clock: FakeClock;
  beforeEach(() => { clock = installFakeClock(); });
  afterEach(() => { clock.restore(); });

  it('saves after 800ms of silence', async () => {
    autosave.notifyChange();
    await clock.advance(799);
    expect(save).not.toHaveBeenCalled();
    await clock.advance(1);
    expect(save).toHaveBeenCalledTimes(1);
  });
  ```

**`withFakeClock(body, options?): Promise<T>`** (dòng 116–127)
```ts
export async function withFakeClock<T>(
  body: (clock: FakeClock) => T | Promise<T>,
  options: FakeClockOptions = {}
): Promise<T>
```
- Chạy body dùng đồng hồ giả, khôi phục timer thực sau (ngay cả khi ném lỗi)
- Tương tự `finally` cho timer giả

**Cách chứng minh số chạy chứ không nhảy:**
- Dùng `clock.advance(ms)` async để di chuyển thời gian từng bước nhỏ
- `advance` được gọi mỗi khi kiểm tra để khiến timer xử lý callback
- Kỳ vọng được gọi ở điểm chính xác khi đủ thời gian (ví dụ: sau 800ms chính xác, không 799ms)
- So sánh giá trị trước/sau `advance` để xác minh chuyển động xảy ra từng khung
- Vitest fake timers bảo đảm không có thực tế `setTimeout` chạy, nên timing lặp lại chính xác

---

## Định dạng thử nghiệm — Năm chuỗi bắt buộc từ CONTRACT.md

| Gọi | Kỳ vọng | Đường dẫn |
|---|---|---|
| `formatArea(2480)` | `"2.480,00 m²"` | `src/lib/format/measure.ts:113–119` |
| `formatMoney(1240000)` | `"1.240.000 ₫"` | Nợ P-01b; viết trong `useBillingScreen.ts` (T5) |
| `formatArea(620, { fractionDigits: 0 })` | `"620 m²"` | `src/lib/format/measure.ts:113–119` |
| `formatArea(1842, { fractionDigits: 0 })` | `"1.842 m²"` | `src/lib/format/measure.ts:113–119` |
| `formatMoney(200000)` | `"200.000 ₫"` | Nợ P-01b; viết trong `useBillingScreen.ts` (T5) |

---

## NOT FOUND — Mục từ CONTRACT.md không tồn tại trong mã

1. **Hàm tiền tệ** — Không có `formatMoney`, `formatCurrency`, hoặc `MoneyFormat` trong `src/lib` hoặc `src/domain`
   - Hệ quả: Nợ P-01b khai trong `useBillingScreen.ts` (T5)
   - Kiểm tra: `rg -n "₫|VND|VNĐ|currency|Intl.NumberFormat" src/lib src/domain` → không tìm thấy `₫`, `VND`, `VNĐ`

2. **Querykey `billing`** — Không có khai báo `queryKeys.billing` trong `src/lib/query`
   - Hệ quả: Nợ T-09 (gateway)
   - Được tạo bởi T4 trong `billingGateway.ts`

3. **Kiểu domain cho hoá đơn** — Không có `BillingInvoice`, `BillingQuota`, `BillingSnapshot` trong `src/domain`
   - Hệ quả: Nợ T-04 (gateway)
   - Được định nghĩa trong `billingGateway.ts`

4. **Token màu `--accent-border`** — Không có trong `COLOR_TOKEN_NAMES` hoặc `globals.css`
   - Hệ quả: Phán quyết Q3 — dùng `--accent` 1px thay thế
   - Kiểm tra: `rg "accent-border" src/`

5. **240ms chuyển động** — Không trong `MOTION_DURATIONS_MS`
   - Hệ quả: Phán quyết Q4 — dùng `standard` (260ms)
   - Kiểm tra: `MOTION_DURATIONS_MS` chỉ có `instant:120, fast:180, standard:260, slow:340`

---

## Tóm tắt — Công cụ có sẵn để T5 và T6 dùng

| Việc | Hàm | Mặc định | Ghi chú |
|---|---|---|---|
| Định dạng số | `formatNumber(n, {fractionDigits?, maxFractionDigits?, grouping?})` | max 3 phân; group true | A15: dấu phẩy làm thập phân |
| Định dạng % | `formatPercent(n, {fractionDigits?, source?})` | max 1 phân; ratio | source: 'ratio' (0..1) hoặc 'percent' (0..100) |
| Định dạng diện tích | `formatArea(m2, {fractionDigits?})` | 2 phân | "248,60 m²" |
| Định dạng ngày | `formatCalendarDate(t, {timeZone?})` | | "03/08/2026" |
| Định dạng giờ | `formatClockTime(t, {timeZone?})` | | "14:32" |
| Giá trị sót | `MISSING_VALUE` | `'—'` | `isFormattable(v)` để bảo vệ |
| Chạy số | `useCountUp(to, {from?, format?, reducedMotion?, lowPerformance?})` | from:0, 260ms standard | render `text`, không `value` |
| Thời lượng | `durationMs('instant' | 'fast' | 'standard' | 'slow')` | | 120 / 180 / 260 / 340 ms |
| Cong | `easingOf('enter' | 'exit' | 'inOut')` | | cubic-bezier trong unit square |
| Test timed | `withFakeClock(async (clock) => {...})` | start 14:32 +07 | `clock.advance(ms)` async, `flushMicrotasks()` |

