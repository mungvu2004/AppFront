# S-16 / T4 — Bản thiết kế màn `FloorManager` và hợp đồng kiểu

> **Trạng thái:** ĐÓNG BĂNG kể từ lúc T5/T6/T7 bắt đầu.
> Thấy thiếu một trường, sai một kiểu, cần thêm một prop → `orca orchestration ask`
> hỏi điều phối viên. **Không tự thêm, không tự sửa**, kể cả người viết file này.
>
> Đây là thứ DUY NHẤT giữ hai nửa của T5 (hook) và T6 (view) khớp nhau — hai worker đó
> chạy song song và không nói chuyện với nhau.

**Thư mục màn:** `src/screens/qc/FloorManager/`
(khu vực `qc`, đúng câu "cùng khu vực `qc`" của đặc tả T4; khuôn chép từ
`src/screens/qc/AxisGridManager/`, màn vừa qua toàn bộ cổng kiểm.)

---

## Mục lục

- [A. Đọc khuôn `AxisGridManager` — vai của từng file](#a-đọc-khuôn-axisgridmanager--vai-của-từng-file)
- [B. HỢP ĐỒNG KIỂU — `floorManagerTypes.ts`](#b-hợp-đồng-kiểu--floormanagertypests)
- [C. Bảy trạng thái (A11 / R-63)](#c-bảy-trạng-thái-a11--r-63)
- [D. Bộ dữ liệu mẫu](#d-bộ-dữ-liệu-mẫu--floormanagerfixturets)
- [E. Bố cục — số đo cụ thể](#e-bố-cục--số-đo-cụ-thể)
- [F. Ranh giới công việc T5 / T6 / T7](#f-ranh-giới-công-việc-t5--t6--t7)
- [G. Khoá i18n đề xuất](#g-khoá-i18n-đề-xuất-r-67)
- [H. Ký hiệu domain: đã xác minh · NOT FOUND · cần tra](#h-ký-hiệu-domain-đã-xác-minh--not-found--cần-tra)

---

## A. Đọc khuôn `AxisGridManager` — vai của từng file

Đã đọc **hết 17 file** (6.300 dòng). Vai của từng file, và điều T5/T6/T7 phải chép:

| File | Dòng | Vai | Điều phải chép sang `FloorManager` |
|---|---:|---|---|
| `axisGridTypes.ts` | 378 | **Nền móng.** Chỉ khai KIỂU và HẰNG. Không `react`, không `@/store`, không `@/api`, không `@/lib/http`. Nhập duy nhất: `type { Millimetres, Pixels } from '@/domain/units/types'` | `floorManagerTypes.ts` giữ đúng kỷ luật này. Đầu file ghi bảng bảy trạng thái + danh sách bất biến ràng buộc `state` với dữ liệu |
| `useAxisGridManager.ts` | 1.220 | Nửa "suy nghĩ". `useQuery` cho trạng thái máy chủ (R-64), `useState` **chỉ** cho trạng thái riêng của giao diện. Trả về `UseAxisGridManagerResult extends AxisGridManagerProps` | `useFloorManager.ts` trả `UseFloorManagerResult extends FloorManagerViewProps` |
| `axisGridManagerGateway.ts` | 1.296 | **Cổng.** Một danh sách khả năng (`AXIS_GRID_CAPABILITIES`), một bản kê nợ (`AXIS_GRID_MISSING_CAPABILITIES` + `AXIS_GRID_MISSING_ENDPOINTS`), một `interface` cổng, một factory thật, một factory giả cho test/story (R-73). Khả năng chưa có trả nhánh `{ supported: false, capability, missing }` **có kiểu** | `floorManagerGateway.ts` chép nguyên khuôn năm phần đó. Xem [mục H](#h-ký-hiệu-domain-đã-xác-minh--not-found--cần-tra) cho danh sách khả năng |
| `AxisGridManager.tsx` | 262 | **View thuần** (R-60). Không `@/api`, `@/store`, `@/domain`, `@/lib/http`. Không định dạng một con số nào | `FloorManager.tsx` |
| `AxisGridManager.container.tsx` | 247 | Hook + view, bọc `ScreenErrorBoundary` của `@/components/feedback` (**không** bản ở `src/lib/screen-state`), `key={projectId}:{floorId}`, phần dự phòng dựng bằng `EmptyState` từ `report.description`. Xuất thêm `<Name>Route` — vỏ route, **thứ duy nhất** biết tới `react-router-dom` | Chép nguyên: `key`, `ScreenCrashFallback`, `AXIS_GRID_MANAGER_SCREEN_ID` → `FLOOR_MANAGER_SCREEN_ID` |
| `index.ts` | 98 | Đường nhập ổn định. Xuất **năm nhóm**: container · `*Route` (cho `router.tsx` lazy-import) · view thuần · hook · cổng+mẫu+kịch bản. **KHÔNG** tái xuất phần con của view. Hợp đồng KIỂU thì có đi ra | `index.ts` của `FloorManager` xuất `FloorManagerRoute` để `router.tsx` viết `lazy(() => import('../screens/qc/FloorManager').then(m => ({ default: m.FloorManagerRoute })))` |
| `AxisGridManager.stories.tsx` | 113 | Bảy story dựng **view thuần** từ bảy view-model có sẵn. `meta.excludeStories` liệt kê mọi export không phải story | Bắt buộc `excludeStories` — xem [bẫy](#bẫy-đã-biết--phải-tránh) |
| `AxisGridManager.test.tsx` | 286 | `expectSevenStates` + `expectAccessible` + `expectVietnamese`, cộng các phép đo nghiệm thu chỉ màn đã ráp trả lời được | T7 |
| `useAxisGridManager.test.ts` | 608 | Lái hook bằng `renderHook` + cổng giả, không cần DOM | T5 |
| `axisGridFixture.ts` | 377 | Dữ liệu mẫu **tất định**. Không gọi `Math.*`, không số ngẫu nhiên | T6 |
| `axisGridManagerScenarios.ts` | 474 | Bảy `AxisGridViewModel` dựng sẵn, story và test dùng **chung một bộ** (R-70) | **Xem ghi chú "không có file scenarios" ở [mục F](#f-ranh-giới-công-việc-t5--t6--t7)** |
| `AxisGridCanvas.tsx` · `AxisGridLeftPanel.tsx` · `AxisGridOriginPanel.tsx` · `AxisGridFloorAlignList.tsx` · `AxisGridGhostFloor.tsx` · `AxisGridOriginMarker.tsx` | 264 · 220 · 100 · 147 · 117 · 93 | **File anh em** — phần con của view, tách ra vì view vượt trần 400 dòng. Props dùng `Pick<AxisGridManagerProps, …>` thay vì khai lại chữ ký handler | `FloorTable.tsx` và `FloorSectionCut.tsx` dùng đúng kỹ thuật `Pick<>` |

### R-59: đúng sáu tên, cộng file anh em có điều kiện

R-59 đòi **đúng sáu tên**:
`index.ts` · `FloorManager.tsx` · `useFloorManager.ts` · `FloorManager.container.tsx` ·
`FloorManager.stories.tsx` · `FloorManager.test.tsx`.

`AxisGridManager` có 17 file, và đó là điều **mục D** (CLAUDE.md) cho phép: *"khi view vượt
trần 400 dòng của R-22 thì phần con tách ra file anh em, và `index.ts` giữ nguyên đường
nhập"*. Tiền lệ ghi trong chính `index.ts` của nó: `WallLayerReview/` 20 file,
`ObjectLayerReview/` 14 file, `PipelineFailure/` 16 file.

**Ranh giới cho `FloorManager` — ĐÚNG 12 file, không file thứ 13:**

```
src/screens/qc/FloorManager/
├── index.ts                     T7   (1 trong 6 tên R-59)
├── FloorManager.tsx             T6   (2)  — view thuần, vỏ hai cột
├── useFloorManager.ts           T5   (3)
├── FloorManager.container.tsx   T7   (4)
├── FloorManager.stories.tsx     T6   (5)
├── FloorManager.test.tsx        T7   (6)
├── floorManagerTypes.ts         T5   anh em — hợp đồng kiểu (file này chép vào)
├── floorManagerGateway.ts       T5   anh em — cổng + bản kê nợ khả năng
├── useFloorManager.test.ts      T5   anh em — bài kiểm hook
├── FloorTable.tsx               T6   anh em — bảng 10 cột
├── FloorSectionCut.tsx          T6   anh em — lát cắt + thang cao độ
└── floorManagerFixture.ts       T6   anh em — dữ liệu mẫu VÀ bảy kịch bản
```

Trần dòng: **nhắc 250, hỏng 400** (`pnpm length`, đếm dòng CÓ NỘI DUNG). `FloorManager.tsx`
vượt 400 là lý do hợp lệ DUY NHẤT để tách thêm — và lúc đó vẫn phải hỏi trước, vì file thứ 13
làm lệch bảng phân việc ở mục F.

### Bẫy đã biết — phải tránh

1. **`meta.excludeStories`.** Một export không phải story trong `*.stories.tsx` làm **trắng
   toàn bộ file** (`export const X = 12` → `TypeError: Cannot create property 'parameters' on
   number`). `pnpm test`/`lint`/`typecheck` đều XANH với lỗi này; chỉ vỡ khi mở Storybook.
   `scenarioArgsFor` và `SEVEN_STORY_STATES` PHẢI có tên trong `excludeStories`.
2. **`Table.Row` phá `expectAccessible`.** Mỗi `<tr>` render qua `Table.Row` bị báo
   *"tắt viền tiêu điểm mặc định mà không thay bằng cái khác"* — một lỗi MỖI DÒNG. Với bảng 4
   dòng là 4 lỗi, R-72 đỏ. **Cách đi:** render `<tr>` trần, giữ
   `Table.Root`/`Header`/`Body`/`Head`/`Cell`. Chỉ dòng chọn-được mới cần `Table.Row` — và dòng
   của màn này CÓ chọn được, nên **T6 phải hỏi điều phối viên trước khi dùng `Table.Row`**;
   phương án mặc định là `<tr>` trần mang `onClick` + `aria-selected` + viền
   `focus-visible:` tự đặt.
3. **`Table.Root` đã tự dựng `<table>` bên trong một `div` cuộn.** Lồng thêm `<table>` là vỡ
   bố cục. `Table.Cell` mặc định `h-10 whitespace-nowrap` — ô chứa cả câu cần
   `className="h-auto whitespace-normal py-2 align-top"`.
4. **`Slider` và `Textarea` chỉ-đọc phá `expectAccessible`** (viền tiêu điểm vẽ từ state React,
   không phải `focus-visible:`). Màn này **không dùng `Slider`** — ô chiều cao/cao độ dùng
   `NumericField`.
5. **`ConfidenceMeter` KHÔNG dùng cho cột "Tiến độ QC".** Nó là thước tin cậy của AI (và tự gọi
   `toFixed` bên trong). Tiến độ QC là việc NGƯỜI DUYỆT làm — hai thứ khác nhau, trộn vào là
   đúng chỗ A5 tồn tại để chặn.

---

## B. HỢP ĐỒNG KIỂU — `floorManagerTypes.ts`

**T5 chép nguyên văn khối dưới đây vào `src/screens/qc/FloorManager/floorManagerTypes.ts`.**
TypeScript chạy được, không giả mã.

### Hai luật bắt buộc của hợp đồng

1. **Mọi con số người dùng ĐỌC là chuỗi đã định dạng sẵn** (A15). Tên trường kết thúc bằng
   `Text`. View **không** gọi `toFixed`, `toLocaleString`, không nhân chia đơn vị —
   `local/no-raw-number` chặn ở tầng ESLint, và **sổ nợ miễn trừ ở `project.js:158-174` chỉ
   được ngắn đi**, không thêm dòng.
2. **Mọi con số dùng để TÍNH/VẼ giữ nguyên kiểu số**, và đơn vị ghi trong TÊN hoặc JSDoc:
   `elevationMm`, `heightMm`, `bandHeightRatio`, `qcProgressRatio`, `offsetRatio`.
   Không trường nào tên tiếng Việt (mục B / E.11).

```ts
/**
 * Hợp đồng kiểu view-model của màn S-16 "Quản lý tầng" (`FloorManager`).
 *
 * NỀN MÓNG: chỉ khai KIỂU và HẰNG. Không import React, không `@/store`,
 * không `@/api`, không `@/lib/http` — cùng kỷ luật `axisGridTypes.ts`.
 *
 * ## Bảy trạng thái (A11 / R-63)
 *
 * Tên lấy NGUYÊN VĂN từ `SEVEN_STATES` của
 * `src/lib/testing/sevenStateScenarios.ts` — không bịa nhánh thứ tám tên
 * `'ready'` hay `'done'`.
 *
 * ## A15 — số đọc là chuỗi, số vẽ là số
 *
 * Mọi trường kết thúc bằng `Text` là chuỗi ĐÃ ĐỊNH DẠNG ở hook; view chỉ đặt
 * nó vào thẻ. Mọi trường kết thúc bằng `Mm`/`Ratio` là số thô, CHỈ để so sánh,
 * sắp xếp và vẽ — view không được đọc ngược một chuỗi `*Text` ra số, cũng
 * không được định dạng một số `*Mm` thành chuỗi.
 */

import type { Millimetres, SquareMetres } from '@/domain/units/types';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái màn.                                                         */
/* -------------------------------------------------------------------------- */

export type FloorManagerScreenState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Ba ô sửa được của một dòng.                                                 */
/* -------------------------------------------------------------------------- */

/** Ba ô người dùng gõ được trong một dòng bảng. */
export type FloorEditableField = 'name' | 'elevation' | 'height';

/**
 * Giá trị ĐANG GÕ của ba ô sửa được — bộ đệm văn bản, không phải số.
 *
 * Đây là lý do ba trường này KHÔNG phạm A15: chúng là `value` của một
 * `<input>` do người dùng gõ, không phải một con số do màn hiển thị. Lúc ô
 * không được sửa, hook đặt chúng bằng phần SỐ của chuỗi đã định dạng (không
 * kèm hậu tố " m"), để lần gõ đầu tiên không phải xoá đơn vị.
 *
 * Ô rời tiêu điểm hoặc Enter → `onFloorFieldCommit`; Esc → `onFloorFieldCancel`
 * (A12: Esc đóng lớp trên cùng, ở đây là lượt sửa đang mở).
 */
export interface FloorRowDraft {
  readonly name: string;
  readonly elevation: string;
  readonly height: string;
}

/* -------------------------------------------------------------------------- */
/* Một dòng bảng.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Một tầng, ở dạng một dòng bảng.
 *
 * Mười cột của bảng đọc thẳng từ đây; không ô nào tính thêm gì.
 */
export interface FloorRowVm {
  readonly id: string;
  /** Tên tầng người dùng đặt, ví dụ `"Tầng trệt"`. Không phải mã. */
  readonly name: string;

  /** Ví dụ `"-3,0 m"`. `formatLength(elevationMm, { unit: 'm', fractionDigits: 1 })`. */
  readonly elevationText: string;
  /** Số thô: để so trùng cao độ, để sắp thứ tự, để đặt dải lát cắt. Không vẽ ra chữ. */
  readonly elevationMm: Millimetres;

  /** Ví dụ `"3,9 m"`. Cùng công thức định dạng với `elevationText`. */
  readonly heightText: string;
  /** Số thô: mẫu số của `SectionBandVm.bandHeightRatio` và của tổng chiều cao. */
  readonly heightMm: Millimetres;

  /** Ví dụ `"2 bản vẽ"`, hoặc `"chưa có bản vẽ"` khi `drawingCount === 0`. */
  readonly drawingCountText: string;
  /** Số thô, để test đếm và để `hasDrawing` không phải đọc ngược chuỗi. */
  readonly drawingCount: number;
  /** `drawingCount > 0`. Sai ⟺ {@link FloorRowVm.needsDrawing} đúng. */
  readonly hasDrawing: boolean;

  /** Ví dụ `"72"`. `"—"` (`MISSING_VALUE`) khi tầng chưa có bản vẽ nên chưa đếm được. */
  readonly wallCountText: string;
  /** Ví dụ `"34"`. Cùng quy ước `"—"` với {@link FloorRowVm.wallCountText}. */
  readonly roomCountText: string;

  /** Ví dụ `"248,60 m²"`, hoặc `"—"` khi `areaM2 === null`. `formatArea`. */
  readonly areaText: string;
  /** Số thô, để chân bảng cộng tổng. `null` khi tầng chưa có bản vẽ. */
  readonly areaM2: SquareMetres | null;

  /** Ví dụ `"45%"`. `formatPercent(qcProgressRatio, { fractionDigits: 0 })`. */
  readonly qcProgressText: string;
  /**
   * 0..1. CHỈ để vẽ bề rộng thanh tiến độ và để chọn variant của `Badge`
   * (`1` → `'verified'`; đây là việc của NGƯỜI DUYỆT nên A5 cho phép xanh
   * đã-xác-minh ở đúng chỗ này, và chỉ ở đây).
   */
  readonly qcProgressRatio: number;

  readonly isSelected: boolean;
  /** Chuột/bàn phím đang trỏ vào dòng này — dải lát cắt tương ứng sáng lên. */
  readonly isHovered: boolean;
  /** `true` ⟺ `hasDrawing === false`. Chấm cần chú ý + liên kết "tải lên" trong dòng. */
  readonly needsDrawing: boolean;
  /** Tầng bị ẩn khỏi mô hình 3D. Dòng mờ đi; tầng vẫn còn trong bảng và trong lát cắt. */
  readonly isHiddenIn3d: boolean;

  /** Giá trị đang gõ của ba ô sửa được. Luôn có mặt, kể cả khi không ai đang sửa. */
  readonly draft: FloorRowDraft;
  /** Ô đang được sửa của dòng này, `null` khi dòng đang nghỉ. */
  readonly editingField: FloorEditableField | null;
}

/* -------------------------------------------------------------------------- */
/* Lát cắt bên trái — một dải cho một tầng.                                    */
/* -------------------------------------------------------------------------- */

/**
 * Một dải của lát cắt.
 *
 * CẤM TUYỆT ĐỐI: *"Chiều cao dải PHẢI tỷ lệ với chiều cao thật — lát cắt là bản
 * xem trước hậu quả, không phải trang trí."* {@link SectionBandVm.bandHeightRatio}
 * là chỗ luật đó sống.
 */
export interface SectionBandVm {
  readonly levelId: string;
  /** Ví dụ `"Tầng trệt · 3,9 m"` — đã ghép sẵn ở hook, view không nối chuỗi số. */
  readonly label: string;
  /**
   * Phần chiều cao của dải này trên TỔNG chiều cao ngăn xếp — **một phân số
   * không đơn vị trong khoảng 0..1**, KHÔNG phải phần trăm và KHÔNG phải px.
   *
   * HOOK tính: `heightMm / totalStackHeightMm`. VIEW chỉ vẽ, và vẽ bằng
   * `style={{ flexGrow: band.bandHeightRatio }}` trên một cột flex có
   * `flex-basis: 0` — không nhân 100, không nhân px, không một phép tính nào
   * trong view (A15, `local/no-raw-number`).
   *
   * Tổng `bandHeightRatio` của mọi dải bằng 1 khi ngăn xếp không hở và không
   * chồng. Với bộ mẫu ở mục D, tổng đúng bằng 1.
   */
  readonly bandHeightRatio: number;
  readonly isSelected: boolean;
  /** Người dùng đang trỏ vào dòng bảng tương ứng, hoặc trỏ thẳng vào dải này. */
  readonly isHovered: boolean;
  /** Dải của tầng bị ẩn khỏi 3D — vẽ viền đứt thay vì nền đặc. */
  readonly isHiddenIn3d: boolean;
  /** Tầng chưa có bản vẽ — dải tô `state-attention-tint`, vẫn đúng tỷ lệ. */
  readonly needsDrawing: boolean;
}

/* -------------------------------------------------------------------------- */
/* Thang cao độ chạy dọc bên trái lát cắt.                                     */
/* -------------------------------------------------------------------------- */

/** Một vạch của thang cao độ. */
export interface ElevationTickVm {
  readonly id: string;
  /** Ví dụ `"7,5 m"`. Đã định dạng ở hook. */
  readonly labelText: string;
  /**
   * Vị trí vạch tính từ ĐÁY thang lên — phân số không đơn vị 0..1.
   *
   * HOOK tính: `(elevationMm - bottomMm) / totalStackHeightMm`. Trường này chỉ
   * để so sánh và để bài kiểm khẳng định; VIEW đặt vạch bằng
   * {@link ElevationTickVm.offsetCssPercent}, không nhân 100 lấy một lần nữa.
   */
  readonly offsetRatio: number;
  /**
   * Đúng `offsetRatio` ở dạng CHUỖI CSS đã sẵn sàng cắm vào `style`, ví dụ
   * `"73.4042553191%"`. Dấu thập phân của CSS là dấu CHẤM — đây là chuỗi máy
   * đọc, không phải số người đọc, nên A15 (dấu phẩy) không áp vào nó.
   *
   * Tồn tại vì `offsetRatio` không cắm thẳng vào `insetBlockEnd` được (khác
   * `flexGrow`, vốn nhận số trần), và vì phép nhân 100 phải xảy ra ở viewmodel
   * chứ không ở view (A15).
   */
  readonly offsetCssPercent: string;
}

/* -------------------------------------------------------------------------- */
/* Chân bảng — TÍNH RA từ dữ liệu, không in cứng.                              */
/* -------------------------------------------------------------------------- */

/**
 * Chân bảng tổng.
 *
 * **Mọi trường ở đây TÍNH RA từ `rows`, không một con số nào viết cứng.** Đặc
 * tả gốc ghi chân bảng "14,7 m" — con số đó SAI (xem mục D của bản thiết kế);
 * với bộ mẫu chuẩn giá trị đúng là `"14,1 m"`, và nó phải là kết quả của phép
 * cộng chứ không phải một hằng chuỗi.
 */
export interface FloorTableFooterVm {
  /** Ví dụ `"4 tầng"`. */
  readonly floorCountText: string;
  /** Đỉnh tầng trên cùng trừ đáy tầng dưới cùng. Ví dụ `"14,1 m"`. */
  readonly totalHeightText: string;
  /** Tổng diện tích các tầng có số liệu. Ví dụ `"745,80 m²"`. */
  readonly totalAreaText: string;
  /** Ví dụ `"202"`, hoặc `"—"` khi chưa tầng nào đếm được. */
  readonly totalWallCountText: string;
  /** Ví dụ `"102"`, cùng quy ước `"—"`. */
  readonly totalRoomCountText: string;
}

/* -------------------------------------------------------------------------- */
/* Câu chặn trùng cao độ (CẤM TUYỆT ĐỐI).                                      */
/* -------------------------------------------------------------------------- */

/**
 * Đủ dữ liệu để nêu ĐÍCH DANH hai tầng đụng nhau về cao độ.
 *
 * CẤM TUYỆT ĐỐI: *"Không cho trùng cao độ; chặn bằng câu nói rõ hai tầng nào."*
 * Câu chữ KHÔNG soạn ở màn: nó lấy nguyên văn từ `validateChangeLevelElevation`
 * (`src/lib/commands/business/roomFloorCommands.ts:559`), hàm đã trả sẵn những
 * câu tiếng Việt gọi tên cả hai tầng. Kiểu này giữ hai cái tên ở dạng có cấu
 * trúc để `aria-live` đọc lại và để bài kiểm khẳng định mà không phải bóc chuỗi.
 */
export interface DuplicateElevationViolation {
  readonly firstFloorName: string;
  readonly secondFloorName: string;
  /** Cao độ đang đụng nhau, đã định dạng. Ví dụ `"3,9 m"`. */
  readonly elevationText: string;
}

/* -------------------------------------------------------------------------- */
/* Props của view thuần `<FloorManager />`.                                    */
/* -------------------------------------------------------------------------- */

/**
 * TOÀN BỘ những gì view thuần `<FloorManager />` nhận.
 *
 * View KHÔNG gọi store (A10) và KHÔNG dựng một hàm xử lý nào bên trong (R-73):
 * mọi thay đổi đi ra qua một trong các `on...` dưới đây.
 *
 * ## Bất biến ràng buộc `state` với dữ liệu
 *
 * 1. `state === 'empty'`   ⟺ `rows` rỗng ⟺ `emptyNotice !== null`.
 * 2. `state === 'loading'` ⟺ `rows` rỗng, `emptyNotice`/`errorMessage`/
 *    `forbiddenNotice` đều `null` — đây là cách `loading` tách khỏi `empty` dù
 *    cả hai đều không có dòng nào.
 * 3. `state === 'partial'` ⟺ có ít nhất một dòng `needsDrawing === true`.
 * 4. `state === 'error'`   ⟺ `errorMessage !== null`.
 * 5. `state === 'success'` ⟺ `rows` không rỗng và MỌI dòng có
 *    `needsDrawing === false`.
 * 6. `state === 'forbidden'` ⟺ `canEdit === false` ⟺ `forbiddenNotice !== null`.
 * 7. `state === 'collapsed'` ⟺ `isCollapsed === true`.
 *
 * Thứ tự che nhau (hàm suy trạng thái của hook đi đúng thứ tự này):
 * `forbidden` → `collapsed` → `error` → `loading` → `empty` → `partial` →
 * `success`.
 */
export interface FloorManagerViewProps {
  readonly state: FloorManagerScreenState;

  /* -- Dữ liệu ------------------------------------------------------------- */

  /** Các tầng, **từ dưới lên** — cùng thứ tự `ReorderLevelsInput.levelIds`. */
  readonly rows: readonly FloorRowVm[];
  /** Dải lát cắt, cùng thứ tự và cùng số phần tử với {@link FloorManagerViewProps.rows}. */
  readonly bands: readonly SectionBandVm[];
  /** Vạch thang cao độ, từ đáy lên. */
  readonly elevationTicks: readonly ElevationTickVm[];
  /** Tổng chiều cao ngăn xếp, đã định dạng. Ví dụ `"14,1 m"`. */
  readonly totalHeightText: string;
  readonly footer: FloorTableFooterVm;

  /* -- Cờ trạng thái màn ---------------------------------------------------- */

  /**
   * `false` ở vai Người xem. Sai thì view ẩn **MỌI** hành động sửa: tay nắm
   * kéo, ba ô gõ, nút thêm/nhân bản/xoá/ẩn-3D, công tắc tự động tính cao độ,
   * liên kết "tải lên". CẤM TUYỆT ĐỐI không có hộp thoại, nên đây chỉ ẩn nút —
   * không dựng nút rồi vô hiệu hoá (A2: màu nhấn chỉ dành cho thứ bấm được).
   */
  readonly canEdit: boolean;
  /** Cột lát cắt thu gọn; bảng chiếm cả khung, còn nút bung lại. */
  readonly isCollapsed: boolean;
  /** Dưới 1.024px: lát cắt xuống DƯỚI bảng. Lớp trên đo bề rộng và truyền vào. */
  readonly isCompact: boolean;
  /** Công tắc "Tự động tính cao độ". Bật thì ô cao độ chỉ đọc và xếp lại tầng sẽ dồn cao độ. */
  readonly isAutoElevation: boolean;

  /* -- Câu nói ra ----------------------------------------------------------- */

  /** Câu của trạng thái Rỗng. `null` ở mọi trạng thái khác. */
  readonly emptyNotice: string | null;
  /** Câu của trạng thái Lỗi. `null` ở mọi trạng thái khác. */
  readonly errorMessage: string | null;
  /** Câu của vai Người xem. `null` ở mọi trạng thái khác. */
  readonly forbiddenNotice: string | null;
  /**
   * Câu chặn trùng cao độ của lượt sửa gần nhất, `null` khi lượt vừa rồi hợp lệ.
   *
   * Đi ra bằng trường RIÊNG, không nhét vào `errorMessage`: nhét vào đó sẽ lật
   * màn sang trạng thái `error` theo bất biến 4 ở trên, tức nói dối. View vẽ nó
   * thành `InlineAlert level="violation"` có `role="status"` ngay trên bảng.
   */
  readonly duplicateElevationMessage: string | null;
  /**
   * Cùng nội dung ở dạng có cấu trúc, cho `aria-live` và cho bài kiểm.
   * `null` cùng lúc với {@link FloorManagerViewProps.duplicateElevationMessage}.
   */
  readonly duplicateElevationViolation: DuplicateElevationViolation | null;

  /* -- Chọn và trỏ ---------------------------------------------------------- */

  readonly onSelectFloor: (floorId: string | null) => void;
  readonly onHoverFloor: (floorId: string | null) => void;

  /* -- Sửa ba ô ------------------------------------------------------------- */

  /** Người dùng vừa gõ; `draftValue` là NGUYÊN VĂN nội dung ô lúc này. */
  readonly onFloorFieldChange: (
    floorId: string,
    field: FloorEditableField,
    draftValue: string,
  ) => void;
  /** Rời tiêu điểm hoặc Enter — hook đọc số, soát trùng cao độ, rồi mới sinh lệnh. */
  readonly onFloorFieldCommit: (floorId: string, field: FloorEditableField) => void;
  /** Esc — bỏ giá trị đang gõ, trả ô về giá trị cũ (A12). */
  readonly onFloorFieldCancel: (floorId: string, field: FloorEditableField) => void;

  /* -- Kéo đổi thứ tự -------------------------------------------------------- */

  /**
   * Thứ tự MỚI của toàn bộ tầng, **từ dưới lên**.
   *
   * Truyền cả danh sách chứ không truyền `(floorId, toIndex)`: đây đúng hình
   * dạng `ReorderLevelsInput.levelIds`
   * (`src/lib/commands/business/roomFloorCommands.ts:649`), nên hook không phải
   * dựng lại danh sách và không có chỗ cho hai bên hiểu lệch chỉ số.
   *
   * Bàn phím là đường hạng nhất (A12): dòng đang chọn + `Alt+↑`/`Alt+↓` gọi
   * đúng hàm này với danh sách đã hoán vị.
   */
  readonly onReorderFloors: (floorIdsBottomUp: readonly string[]) => void;

  /* -- Thêm, nhân bản, ẩn, xoá ----------------------------------------------- */

  readonly onAddFloor: () => void;
  /**
   * Nhân bản một tầng.
   *
   * `copyFurniture` là cờ của hộp chọn "sao chép nội thất" đứng cạnh mục nhân
   * bản. Đây KHÔNG phải hộp thoại xác nhận (CẤM TUYỆT ĐỐI cấm hộp thoại cho
   * xoá; nhân bản cũng đi thẳng) — nó là một lựa chọn của chính hành động, và
   * A8 phủ nó bằng toast hoàn tác như mọi thay đổi khác.
   */
  readonly onDuplicateFloor: (
    floorId: string,
    options: { readonly copyFurniture: boolean },
  ) => void;
  /** Bật/tắt ẩn tầng khỏi mô hình 3D. Không rời màn, không hộp thoại. */
  readonly onToggleHiddenIn3d: (floorId: string) => void;
  /**
   * Xoá tầng. **KHÔNG hộp thoại** (CẤM TUYỆT ĐỐI) — xoá ngay, kèm toast hoàn
   * tác (A8). A9 không mâu thuẫn: A9 chỉ đòi hộp thoại cho việc A8 KHÔNG hoàn
   * tác được, và việc này hoàn tác được.
   */
  readonly onRemoveFloor: (floorId: string) => void;

  /* -- Công tắc và lối đi phụ ------------------------------------------------ */

  readonly onToggleAutoElevation: () => void;
  /** Liên kết "tải lên" trong dòng chưa có bản vẽ (trạng thái Một phần). */
  readonly onUploadDrawing: (floorId: string) => void;
  readonly onToggleCollapsed: () => void;
  readonly onRetry: () => void;
  readonly onUndo: () => void;
}

/* -------------------------------------------------------------------------- */
/* Hook trả về gì.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ view nhận, cộng những gì CONTAINER cần.
 *
 * Trải đúng {@link FloorManagerViewProps}, nên container viết
 * `<FloorManager {...result} />` — không một prop nào phải nối tay.
 */
export interface UseFloorManagerResult extends FloorManagerViewProps {
  /** Ngăn xếp hoàn tác của chính màn — bài nghiệm thu đếm bước trên nó. */
  readonly historyStepCount: () => number;
  readonly canUndo: boolean;
  /**
   * Khả năng cổng không làm được, ở dạng câu đã sẵn sàng đọc cho người dùng.
   *
   * Rỗng khi cổng làm được hết. KHÔNG bịa endpoint để lấp: xem bản kê nợ ở
   * `floorManagerGateway.ts` và mục H của bản thiết kế.
   */
  readonly unsupportedNotices: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* KHOÁ SAU KHI XONG                                                           */
/* -------------------------------------------------------------------------- */

/*
 * File này ĐÓNG BĂNG. T5/T6/T7 thấy thiếu một trường, sai một kiểu, hay cần
 * thêm một prop thì `orca orchestration ask` hỏi điều phối viên trước — không
 * tự thêm, không tự sửa, kể cả người đã viết file này.
 */
```

### Ghi chú cho T6 (view) về ba trường "số"

| Trường | View làm gì với nó | View KHÔNG được làm gì |
|---|---|---|
| `bandHeightRatio` | `style={{ flexGrow: band.bandHeightRatio }}` trên dải; container là cột flex, dải có `flex-basis: 0` | nhân 100, cộng `'%'`, đổi ra px |
| `offsetCssPercent` | `style={{ insetBlockEnd: tick.offsetCssPercent }}` | tự ghép chuỗi từ `offsetRatio` |
| `qcProgressRatio` | `style={{ scale: `${row.qcProgressRatio} 1` }}` trên lớp phủ đặt `origin-left`, hoặc `style={{ flexGrow: row.qcProgressRatio }}` cho lớp phủ nằm trong hộp flex mà thanh nền là `position: relative` phía sau | `${ratio * 100}%`, và **`1 - ratio`** — phép trừ cũng là phép tính trong view |

> Cả hai cách trên đều chỉ cắm một số trần vào `style`, không phép tính nào. Nếu T6 thấy vẫn
> không dựng được thanh tiến độ đúng ý: **hỏi trước** (`orca orchestration ask`) để thêm
> `qcRemainderRatio` vào hợp đồng. **Không** tự tính `1 - ratio` trong view.

---

## C. Bảy trạng thái (A11 / R-63)

Tên trạng thái lấy nguyên văn từ `SEVEN_STATES`
(`src/lib/testing/sevenStateScenarios.ts:26-34`); nhãn tiếng Việt lấy từ
`SEVEN_STATE_LABELS` cùng file. `expectSevenStates` là bộ khẳng định T7 chạy.

| # | `state` | Bảng bên phải dựng bằng gì | **Lát cắt bên trái hiện gì** |
|---|---|---|---|
| 1 | `empty` | `EmptyState` thay chỗ cả bảng. `title` = `"chưa có tầng nào"`, `description` = `"thêm tầng đầu tiên, hoặc nhập số tầng từ màn hình tạo dự án."`, `action` = `{ label: 'Thêm tầng', onClick: onAddFloor }` | Khung lát cắt VẪN vẽ: một đường nền đáy + thang cao độ chỉ có vạch `"0,0 m"`. **Không** trả `null` — màn trắng là thất bại duy nhất A11 tồn tại để chặn |
| 2 | `loading` | `Table.Root` + `Table.Header` thật (10 cột đứng nguyên), thân là **4 hàng `<tr>` trần** mỗi ô một `Skeleton`. Chân bảng cũng là `Skeleton` | **Một `Skeleton` duy nhất** lấp kín khung lát cắt. Không vẽ 4 dải giả: chiều cao chưa biết thì một dải có tỷ lệ bịa ra là nói dối đúng thứ CẤM TUYỆT ĐỐI về tỷ lệ cấm |
| 3 | `partial` | Bảng đầy đủ. Dòng có `needsDrawing` mang: `Badge variant="attention"` (có chấm) trong ô **Bản vẽ** với chữ `"chưa có bản vẽ"`, **và ngay trong ô đó** một nút chữ `"tải lên"` gọi `onUploadDrawing(row.id)`. Ba ô Tường/Phòng/Diện tích của dòng đó hiện `"—"` | Dải của tầng đó tô `state-attention-tint` + viền `state-attention`, **vẫn đúng `bandHeightRatio` thật** — chiều cao tầng đã biết dù bản vẽ chưa có. Ba dải kia bình thường |
| 4 | `error` | `InlineAlert level="violation"` mang `errorMessage`, `action = { label: 'Thử lại', onClick: onRetry }`, thay chỗ thân bảng. Đầu bảng và chân bảng ẩn | Khung lát cắt VẪN vẽ (như trạng thái 1): thang cao độ còn đó, không dải nào. Không màn trắng |
| 5 | `success` | Bảng đầy đủ, chân bảng đầy đủ. Dòng có `qcProgressRatio === 1` mang `Badge variant="verified"` ở cột Tiến độ QC — **đây là việc của người duyệt nên A5 cho phép**; không nhánh nào khác của màn được dùng xanh đã-xác-minh | Bốn dải đủ, tổng `bandHeightRatio` = 1, dải đang chọn có vạch chọn 2px |
| 6 | `forbidden` | Bảng **chỉ đọc**: bỏ cột tay nắm kéo và cột hành động; ba ô sửa được thành chữ thường (`<span>`, không `<input>`); không nút thêm/nhân bản/xoá/ẩn-3D; không công tắc tự động tính cao độ; không liên kết "tải lên". `InlineAlert level="attention"` mang `forbiddenNotice` đặt trên bảng | Lát cắt vẽ **đầy đủ và đúng tỷ lệ** — xem là quyền của vai Người xem; chỉ mất viền chọn và nút, không mất nội dung |
| 7 | `collapsed` | Bảng chiếm cả bề ngang khung (không còn cột 360 bên trái). Một nút chữ `"hiện lát cắt"` ở góc trên phải gọi `onToggleCollapsed` | **Ẩn hoàn toàn.** Đây là trạng thái duy nhất lát cắt biến mất, và nút bung lại luôn có mặt |

**Câu cuối cùng của trạng thái Rỗng** (đã chỉnh về chữ thường kiểu câu theo A6 — đặc tả gốc
đã đúng dạng, không phải sửa chữ nào):

> chưa có tầng nào. thêm tầng đầu tiên, hoặc nhập số tầng từ màn hình tạo dự án.

Chia vào `EmptyState` như sau, và **không đổi một chữ**:

- `title`: `chưa có tầng nào`
- `description`: `thêm tầng đầu tiên, hoặc nhập số tầng từ màn hình tạo dự án.`

`EmptyState` dựng `title` và `description` thành hai thẻ; đọc liền lại đúng nguyên câu. Nhãn nút
`"Thêm tầng"` là ngoại lệ hoa đầu câu của **nhãn nút**, cùng khuôn `"Thử lại"` và
`"Căn chỉnh tự động"` mà `AxisGridManager` đã dùng và đã qua `expectVietnamese`.

---

## D. Bộ dữ liệu mẫu — `floorManagerFixture.ts`

**Bốn tầng.** Ghi ở milimét (đơn vị mô hình) VÀ ở mét (thứ người dùng đọc).
Chuỗi ở cột "đọc ra" đã **kiểm chứng bằng `Intl.NumberFormat('vi-VN')`**, đúng cái
`formatNumber` dùng (`src/lib/format/number.ts:36`).

| # | `id` | `name` | `elevationMm` | `elevationText` | `heightMm` | `heightText` | `bandHeightRatio` |
|---|---|---|---:|---|---:|---|---:|
| 1 | `floor-basement` | Tầng hầm | `-3000` | `-3,0 m` | `3000` | `3,0 m` | `3000 / 14100` |
| 2 | `floor-ground` | Tầng trệt | `0` | `0,0 m` | `3900` | `3,9 m` | `3900 / 14100` |
| 3 | `floor-2` | Tầng 2 | `3900` | `3,9 m` | `3600` | `3,6 m` | `3600 / 14100` |
| 4 | `floor-roof` | Tầng mái | `7500` | `7,5 m` | `3600` | `3,6 m` | `3600 / 14100` |

Định dạng cao độ và chiều cao: `formatLength(valueMm, { unit: 'm', fractionDigits: 1 })`.
`formatNumber` gọi `withoutNegativeZero`, nên cao độ `0` ra `"0,0 m"` chứ không `"-0,0 m"`.
Dấu trừ do `Intl` sinh — **T5/T6 không gõ tay ký tự trừ nào**.

### Ba khoảng tầng — kiểm chứng lại từ dữ liệu

| Từ → đến | Phép tính | Kết quả |
|---|---|---|
| Tầng hầm → Tầng trệt | `0 − (−3000)` | `3000 mm` = **3,0 m** ✓ |
| Tầng trệt → Tầng 2 | `3900 − 0` | `3900 mm` = **3,9 m** ✓ |
| Tầng 2 → Tầng mái | `7500 − 3900` | `3600 mm` = **3,6 m** ✓ |

Ba khoảng khớp đúng ba chiều cao 3,0 / 3,9 / 3,6 m → **ngăn xếp không hở, không chồng**, và
`validateChangeLevelElevation` không có gì để phàn nàn ở trạng thái nghỉ.

### Tổng chiều cao — 14,1 m, và vì sao "14,7 m" của đặc tả là SAI

```
đỉnh cao nhất  = elevationMm(mái) + heightMm(mái) = 7500 + 3600 = 11100 mm
đáy thấp nhất  = elevationMm(hầm)                  =              -3000 mm
tổng chiều cao = 11100 - (-3000)                   =              14100 mm  → "14,1 m"
```

Kiểm chéo bằng phép cộng chiều cao: `3000 + 3900 + 3600 + 3600 = 14100 mm`. Hai đường ra cùng
một số, vì ngăn xếp không hở.

> **Đặc tả gốc ghi chân bảng "14,7 m". Con số đó SAI.**
> Chân bảng phải **TÍNH RA** từ `rows`, không in cứng — `FloorTableFooterVm.totalHeightText`
> tồn tại đúng cho việc đó. Bài kiểm của T5 phải khẳng định `"14,1 m"`, và khẳng định nó bằng
> cách cộng từ fixture chứ không bằng một chuỗi viết tay.

Vì `3000 + 3900 + 3600 + 3600 = 14100`, tổng bốn `bandHeightRatio` đúng bằng **1** — lát cắt
lấp kín khung, không dư một khe nào.

### Bản vẽ, tường, phòng, diện tích, tiến độ QC

Diện tích của bộ mẫu chuẩn repo là **248,60 m²** (A14: *34 phòng và sảnh 248,60 m²*, xem
`src/lib/coloring/__tests__/coloring.test.ts:31`). Ba tầng có bản vẽ dùng đúng bộ đó; **tầng mái
chưa có bản vẽ** và là chỗ trạng thái Một phần sống.

| # | `drawingCount` | `drawingCountText` | `wallCountText` | `roomCountText` | `areaM2` | `areaText` | `qcProgressRatio` | `qcProgressText` |
|---|---:|---|---|---|---:|---|---:|---|
| 1 Tầng hầm | `2` | `2 bản vẽ` | `58` | `34` | `248.6` | `248,60 m²` | `1` | `100%` |
| 2 Tầng trệt | `2` | `2 bản vẽ` | `72` | `34` | `248.6` | `248,60 m²` | `1` | `100%` |
| 3 Tầng 2 | `1` | `1 bản vẽ` | `72` | `34` | `248.6` | `248,60 m²` | `0.45` | `45%` |
| 4 Tầng mái | `0` | `chưa có bản vẽ` | `—` | `—` | `null` | `—` | `0` | `0%` |

`"—"` là `MISSING_VALUE` của `src/lib/format/number.ts:33`, **không phải chuỗi rỗng**.
`qcProgressText` = `formatPercent(ratio, { fractionDigits: 0 })` — đã kiểm: `1 → "100%"`,
`0.45 → "45%"`, `0 → "0%"`.

> **Số tường 58 / 72 / 72 và số phòng 34 là DỮ LIỆU MẪU, không phải số tính ra.** Chúng viết
> thẳng ở đây một lần để T5 và T6 không mỗi người bịa một bảng khác nhau (R-70). CẤM TUYỆT ĐỐI
> *"không tự đếm đối tượng"* nhắm vào MÀN THẬT: ở đó bốn con số này đọc từ cổng, không do màn
> đếm. Số phòng lấy đúng 34 của A14.

### Chân bảng của bộ mẫu

| Trường | Phép tính | Giá trị |
|---|---|---|
| `floorCountText` | `rows.length` | `4 tầng` |
| `totalHeightText` | `11100 - (-3000)` | `14,1 m` |
| `totalAreaText` | `248,6 × 3` (tầng mái không có số liệu) | `745,80 m²` |
| `totalWallCountText` | `58 + 72 + 72` | `202` |
| `totalRoomCountText` | `34 × 3` | `102` |

Đã kiểm bằng `Intl`: `745.8 → "745,80"`, nên `"745,80 m²"`.

### Thang cao độ của bộ mẫu

Năm vạch: một cho mỗi cao độ tầng, cộng vạch đỉnh.

| `labelText` | `elevationMm` | `offsetRatio` = `(mm + 3000) / 14100` |
|---|---:|---|
| `-3,0 m` | `-3000` | `0` |
| `0,0 m` | `0` | `3000/14100` |
| `3,9 m` | `3900` | `6900/14100` |
| `7,5 m` | `7500` | `10500/14100` |
| `11,1 m` | `11100` | `1` |

### Bảy kịch bản dẫn xuất từ bộ mẫu này

| Trạng thái | Dẫn xuất thế nào |
|---|---|
| `empty` | `rows: []`, `bands: []`, `emptyNotice` = câu ở mục C |
| `loading` | `rows: []`, ba câu `null` |
| `partial` | **bộ mẫu nguyên vẹn** — tầng mái đã sẵn `needsDrawing` |
| `error` | `rows: []`, `errorMessage` từ `describeError` (`@/lib/errors`), không gõ câu mới |
| `success` | bộ mẫu, nhưng tầng mái có `drawingCount: 1`, `areaM2: 248.6`, `qcProgressRatio: 1` → không dòng nào `needsDrawing` |
| `forbidden` | bộ mẫu, `canEdit: false`, `forbiddenNotice` khác `null` |
| `collapsed` | bộ mẫu, `isCollapsed: true` |

---

## E. Bố cục — số đo cụ thể

Ghi thành số để T6 khỏi đoán. Mọi con số dưới đây là **số đo bố cục trong `className`**, không
phải hằng logic — `local/no-raw-number` không chạm tới chúng.

```
┌─ khung màn ────────────────────────────────────────────────────────────────┐
│  đệm 32px mọi phía, nội dung tối đa 1120px, căn giữa                        │
│                                                                            │
│  ┌── cột trái 360px ────────┐  ┌── cột phải, phần còn lại ───────────────┐  │
│  │  FloorSectionCut         │  │  FloorTable                             │  │
│  │  ├ thang cao độ (dọc)    │  │  ├ hàng tiêu đề                         │  │
│  │  └ 4 dải, flex-col,      │  │  ├ N × dòng cao 40px                    │  │
│  │    flex-basis:0,         │  │  ├ đường chèn khi kéo: 2px              │  │
│  │    flexGrow = ratio      │  │  └ chân bảng tổng                       │  │
│  │  vạch chọn: 2px          │  │  vạch chọn bên trái dòng: 2px           │  │
│  └──────────────────────────┘  └─────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

| Số đo | Giá trị | Ghi chú |
|---|---|---|
| Bề rộng nội dung tối đa | `1120px` | `max-w-[1120px] mx-auto` |
| Đệm khung | `32px` | `p-8` |
| Cột trái (lát cắt) | `360px` | `w-[360px] shrink-0` |
| Cột phải (bảng) | phần còn lại | `flex-1 min-w-0` |
| Chiều cao một dòng bảng | `40px` | `h-10` — đúng mặc định `Table.Cell` |
| Đường chèn lúc kéo | `2px` | `h-0.5 bg-accent` |
| Vạch dòng/dải đang chọn | `2px` | `border-l-2 border-accent` |
| Khoảng cách hai cột | `24px` | `gap-6` |
| **Ngưỡng thu hẹp** | `1024px` | Dưới mốc này `isCompact === true`: hai cột xếp dọc và **lát cắt xuống DƯỚI bảng** — dùng `order` chứ không đảo thứ tự trong DOM, để luồng đọc của trình đọc màn hình vẫn là bảng trước |

Ngưỡng `1024px` trùng mốc `ScaleCalibrationPanelProps.isCompact` và `AxisGridViewModel.isCompact`
mà `AxisGridManager` đã dùng — **màn không tự đo bề rộng**; `isCompact` vào từ props.

### Thứ tự 10 cột của bảng — đúng đặc tả, không đổi

| # | Cột | Nội dung | Ở vai Người xem |
|---|---|---|---|
| 1 | *(tay nắm kéo)* | `IconButton` tay nắm, `aria-label` "Đổi thứ tự tầng {{name}}" | **ẩn cột** |
| 2 | Tên tầng | `<input>` ⇄ `row.draft.name` | chữ thường (`<span>{row.name}</span>`) |
| 3 | Cao độ (m) | `NumericField` ⇄ `row.draft.elevation`; chỉ đọc khi `isAutoElevation` | chữ: `row.elevationText` |
| 4 | Chiều cao (m) | `NumericField` ⇄ `row.draft.height` | chữ: `row.heightText` |
| 5 | Bản vẽ | `row.drawingCountText`; nếu `needsDrawing`: `Badge variant="attention"` + nút chữ "tải lên" | chỉ chữ, không nút |
| 6 | Tường | `row.wallCountText` | như cũ |
| 7 | Phòng | `row.roomCountText` | như cũ |
| 8 | Diện tích | `row.areaText` | như cũ |
| 9 | Tiến độ QC | thanh + `row.qcProgressText`; `ratio === 1` → `Badge variant="verified"` | như cũ |
| 10 | *(hành động)* | nhân bản (kèm hộp chọn "sao chép nội thất") · ẩn khỏi 3D · xoá | **ẩn cột** |

Ô cột 3 và 4 dùng `NumericField`, **không dùng `Slider`** (xem bẫy 4 ở mục A).

### Chuyển động

Thang chuyển động có **đúng năm giá trị**: `120 / 180 / 260 / 340 / 700 ms`, nguồn duy nhất là
`MOTION_DURATIONS_MS` (`src/lib/motion/tokens.ts:62` — `instant 120 · fast 180 · standard 260 ·
slow 340`). Gọi qua `durationSeconds(name)` / `cssDurationMs(name)`, **không gõ số**.

> **Đặc tả ghi "240ms" — SAI, và điều phối viên đã chốt: dùng `260ms` (`'standard'`).**
> 240 không thuộc thang; `local/no-raw-duration` chặn nó ở tầng ESLint. Đây là cùng quyết định
> đã áp cho `AxisGridGhostFloor.tsx` ở S-15.

| Chuyển động | Slot | ms |
|---|---|---|
| Dải lát cắt đổi tỷ lệ khi sửa chiều cao | `standard` | 260 |
| Dòng bảng đổi nền lúc chọn/trỏ | `instant` | 120 |
| Đường chèn hiện/ẩn lúc kéo | `fast` | 180 |
| Dòng mới trượt vào sau khi thêm/nhân bản | `slow` | 340 |

`framer-motion` chỉ nhập từ `@/components/motion` (R-39, `local/no-framer-outside-motion`).

---

## F. Ranh giới công việc T5 / T6 / T7

| Worker | File sở hữu | Được sửa file người khác? |
|---|---|---|
| **T5** (hook) | `floorManagerTypes.ts` · `floorManagerGateway.ts` · `useFloorManager.ts` · `useFloorManager.test.ts` | **Không.** |
| **T6** (view) | `FloorManager.tsx` · `FloorSectionCut.tsx` · `FloorTable.tsx` · `FloorManager.stories.tsx` · `floorManagerFixture.ts` | **Không.** |
| **T7** (ráp) | `index.ts` · `FloorManager.container.tsx` · `FloorManager.test.tsx` · `src/routes/paths.ts` · `src/routes/router.tsx` · `src/i18n/vi.json` | **Không.** |

**T6 nhập kiểu từ `floorManagerTypes.ts` của T5** — file đó là hợp đồng, và nội dung nó chép
nguyên từ [mục B](#b-hợp-đồng-kiểu--floormanagertypests) của bản thiết kế này, nên T6 viết view
được ngay cả khi T5 chưa đẩy file lên: hình dạng đã cố định ở đây.

### KHÔNG có `floorManagerScenarios.ts`

Bảng phân việc trên chỉ có **12 file** và không cấp một file `*Scenarios.ts` nào. Bảy kịch bản
vì vậy sống **trong `floorManagerFixture.ts`** (T6), xuất ra `floorManagerScenarioFor(state)` và
`FLOOR_MANAGER_SCENARIOS`. Story và bài kiểm dùng **cùng một bộ đó** (R-70) — không ai dựng bảng
dữ liệu thứ hai. Ai thấy cần tách file thứ 13: `orca orchestration ask`.

### Thứ tự phụ thuộc

```
T4 (file này)  →  T5 chép hợp đồng vào floorManagerTypes.ts
                   ↘
                    T6 nhập kiểu, viết view + fixture + story   (song song với T5)
                   ↗
T5 + T6 xong  →  T7 ráp: index.ts, container, route, i18n, bài kiểm màn
```

### Khoá i18n — ai cần thì ghi ra file mảnh

`src/i18n/vi.json` là **của T7**. T5/T6 cần thêm khoá thì ghi vào
`notes/floor-manager/i18n.fragment.json`, T7 trộn vào khối `floorManager`.
(Nhắc: `vi.json` **không phải bảng dịch lúc chạy** — chuỗi viết thẳng tiếng Việt trong mã; file
đó là **từ điển để kiểm tra**, dùng bởi `lib/testing/expectVietnamese.ts:25-31`.)

### Route (T7)

`src/routes/paths.ts` **chưa có** khoá nào cho danh sách tầng của một dự án —
`ROUTE_PATTERNS.floors` hiện là `'/floors'` và đang trỏ `<RouteCanvas />` (chỗ giữ chỗ).
Đề nghị T7 thêm, theo đúng khuôn các khoá `project*` đã có:

```ts
projectFloors: `${PROJECTS_ROOT}/:id/floors`,
// và trong ROUTES.project:
floors: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/floors`,
```

rồi đăng ký trong `router.tsx`:

```tsx
const RouteFloorManager = lazy(() =>
  import('../screens/qc/FloorManager').then((m) => ({ default: m.FloorManagerRoute })),
);
// …
{ path: ROUTE_PATTERNS.projectFloors, element: suspended(<RouteFloorManager />) },
```

Màn nhập `@/routes/paths`, **không** nhập `@/routes` — `router.tsx` lazy-import mọi màn, và một
màn nhập ngược `@/routes` khép một vòng làm `pnpm cycles` đỏ.

---

## G. Khoá i18n đề xuất (R-67)

Khối `floorManager` thêm vào `src/i18n/vi.json` (T7 trộn). Chữ **thường, kiểu câu** (A6); ngoại
lệ hoa đầu chữ là **nhãn nút**, **tiêu đề cột** và **tên riêng của tầng**, đúng khuôn khối
`axisGridManager` đã có trong file (`"Thêm trục"`, `"Căn chỉnh tự động"`, `"Trục ngang"`).

```json
{
  "floorManager": {
    "screen": {
      "breadcrumb": "Dự án > Quản lý tầng",
      "title": "quản lý tầng",
      "description": "Xem cao độ, chiều cao và tiến độ của từng tầng, rồi sắp xếp lại ngăn xếp nếu cần."
    },
    "table": {
      "caption": "Danh sách tầng của dự án",
      "columnDragHandle": "Đổi thứ tự",
      "columnName": "Tên tầng",
      "columnElevation": "Cao độ (m)",
      "columnHeight": "Chiều cao (m)",
      "columnDrawings": "Bản vẽ",
      "columnWalls": "Tường",
      "columnRooms": "Phòng",
      "columnArea": "Diện tích",
      "columnQcProgress": "Tiến độ QC",
      "columnActions": "Hành động",
      "rowAriaLabel": "{{floorName}}, cao độ {{elevation}}, cao {{height}}, {{qcProgress}} đã kiểm",
      "dragHandleAriaLabel": "Đổi thứ tự tầng {{floorName}}",
      "moveUp": "Đưa tầng {{floorName}} lên trên",
      "moveDown": "Đưa tầng {{floorName}} xuống dưới"
    },
    "drawings": {
      "count": "{{count}} bản vẽ",
      "missing": "chưa có bản vẽ",
      "uploadLink": "tải lên"
    },
    "footer": {
      "floorCount": "{{count}} tầng",
      "totalHeightLabel": "tổng chiều cao",
      "totalAreaLabel": "tổng diện tích",
      "totalWallsLabel": "tổng số tường",
      "totalRoomsLabel": "tổng số phòng"
    },
    "sectionCut": {
      "title": "Lát cắt",
      "ariaLabel": "Lát cắt các tầng theo đúng tỷ lệ chiều cao",
      "elevationScaleLabel": "Thang cao độ",
      "bandAriaLabel": "{{floorName}}, cao {{height}}",
      "collapse": "thu gọn lát cắt",
      "expand": "hiện lát cắt"
    },
    "actions": {
      "addFloor": "Thêm tầng",
      "duplicateFloor": "Nhân bản tầng {{floorName}}",
      "duplicateCopyFurniture": "sao chép nội thất sang tầng mới",
      "hideIn3d": "Ẩn tầng {{floorName}} khỏi mô hình 3D",
      "showIn3d": "Hiện tầng {{floorName}} trong mô hình 3D",
      "removeFloor": "Xoá tầng {{floorName}}",
      "autoElevation": "Tự động tính cao độ",
      "autoElevationDescription": "Cao độ từng tầng được dồn lại từ mốc chuẩn mỗi khi ngăn xếp đổi thứ tự."
    },
    "constraint": {
      "duplicateElevation": "không đặt được: tầng {{firstFloor}} và tầng {{secondFloor}} sẽ cùng ở cao độ {{elevation}}."
    },
    "states": {
      "emptyTitle": "chưa có tầng nào",
      "emptyDescription": "thêm tầng đầu tiên, hoặc nhập số tầng từ màn hình tạo dự án.",
      "errorTitle": "không đọc được danh sách tầng",
      "forbiddenTitle": "không có quyền sửa tầng",
      "forbiddenDescription": "vai của bạn chỉ xem được ngăn xếp tầng; mọi thao tác sửa đã được ẩn."
    },
    "undo": {
      "floorRemoved": "Đã xoá tầng {{floorName}}",
      "floorDuplicated": "Đã nhân bản tầng {{floorName}}",
      "floorsReordered": "Đã đổi thứ tự tầng"
    }
  }
}
```

> `constraint.duplicateElevation` là **phương án dự phòng**. Đường chính là lấy nguyên văn câu
> mà `validateChangeLevelElevation` trả về — hàm đó đã soạn sẵn câu tiếng Việt gọi tên cả hai
> tầng và nêu cả hai cao độ (xem [mục H](#h-ký-hiệu-domain-đã-xác-minh--not-found--cần-tra)).
> Khoá trên chỉ dùng khi domain không trả câu nào cho trường hợp cụ thể; T5 quyết định sau khi
> đọc `notes/floor-manager/domain.md`.

---

## H. Ký hiệu domain: đã xác minh · NOT FOUND · cần tra

Tôi **không có** ghi chú của T1/T2/T3 (chạy song song). Bảng dưới là kết quả grep của chính
lượt này — đã xác minh tận file và số dòng. Chỗ nào chưa chắc thì ghi
`<<lấy từ notes/floor-manager/domain.md>>` kèm ký hiệu cần tra.

**Hợp đồng kiểu ở mục B đứng vững mà không cần biết một tên hàm domain nào** — nó chỉ nói về
hình dạng view-model. Bảng này là để T5 nối dây, không phải để T6 chờ.

### Đã xác minh — CÓ THẬT (17 ký hiệu/nhóm)

| Ký hiệu | Ở đâu | Dùng cho |
|---|---|---|
| `Level { id, name, order, elevationMm, heightMm, areaM2? }` | `src/domain/spatial/types.ts:104-117` | Nguồn của `FloorRowVm` |
| `createChangeLevelElevationCommand` · `ChangeLevelElevationInput { levelId, elevationMm }` | `src/lib/commands/business/roomFloorCommands.ts:613, 553` | `onFloorFieldCommit(id, 'elevation')` |
| `validateChangeLevelElevation` | `roomFloorCommands.ts:559` | **Câu chặn trùng cao độ**, đã gọi tên CẢ HAI tầng: `Tầng "{tên dưới}" ở {cao độ} cao {chiều cao} nên đỉnh của nó ở {đỉnh}; cao độ mới {mới} nằm thấp hơn.` |
| `createReorderLevelsCommand` · `ReorderLevelsInput { levelIds }` | `roomFloorCommands.ts:751, 649` | `onReorderFloors`. Hàm `restack` bên trong **dồn lại cao độ từ mốc chuẩn** — đây chính là "Tự động tính cao độ" |
| `ROOM_FLOOR_COMMAND_TYPES.changeLevelElevation` = `'level.changeElevation'`, `.reorderLevels` = `'level.reorder'` | `roomFloorCommands.ts:67-74` | `Command.type` |
| `ENDPOINTS.floors.{ create, delete(floorId), list, reorder }` | `src/api/endpoints.ts:42-47` | Đọc / thêm / xoá / xếp lại tầng |
| `PatchSpatialFloorInput.body: Partial<FloorWriteBody>` mang `name/order/elevationMm/heightMm/areaM2/drawings` | `src/api/client.ts:87-92, 144-148` | Sửa tên, cao độ, chiều cao |
| `queryKeys.floor.list(projectId)` · `queryKeys.floor.detail(floorId)` | `src/lib/query/queryKeys.ts:70-72` | Khoá `useQuery` (R-64) |
| `applyInvalidation(queryClient, 'editFloor', { projectId, floorId })` | `src/lib/query/invalidation.ts:27, 51` | Dọn cache sau mỗi lượt ghi — **không gọi `invalidateQueries` trần** |
| `formatLength` · `formatArea` | `src/lib/format/measure.ts:108, 131` | `elevationText`, `heightText`, `areaText` |
| `formatNumber` · `formatPercent` · `MISSING_VALUE` (`'—'`) | `src/lib/format/number.ts:201, 225, 33` | Đếm, phần trăm, ô trống |
| `MOTION_DURATIONS_MS` · `durationSeconds` · `cssDurationMs` | `src/lib/motion/tokens.ts:62, 103, 107` | Mọi thời lượng |
| `SEVEN_STATES` · `SEVEN_STATE_LABELS` · `SevenState` | `src/lib/testing/sevenStateScenarios.ts:26-48` | Bảy trạng thái |
| `createUndoTicket` · `UNDO_WINDOW_MS` | `src/lib/mutations/undoTicket.ts` | Toast hoàn tác (A8) |
| `appNotificationBus` · `NotificationBus` | `src/hooks/useNotifications.ts` · `src/lib/mutations/notificationBus.ts` | Toast — **không** bọc `Toast.Provider` quanh màn (sẽ sinh toast thứ hai chạy trên ngăn xếp zundo) |
| `can` (quyền) · `ProjectRole = 'admin' \| 'engineer' \| 'viewer'` | `src/lib/auth/permissions.ts` · `src/types/project.ts:1` | `canEdit` |
| `ScreenErrorBoundary` · `ScreenErrorFallback` · `EmptyState` · `InlineAlert` · `Skeleton` · `Badge` · `Table` · `NumericField` · `Toggle` · `IconButton` | `src/components/**` | Vỏ và điều khiển |

### NOT FOUND — cổng phải khai nợ, KHÔNG bịa endpoint (3 khoản)

| Khả năng | Đã tìm gì | Kết quả |
|---|---|---|
| `duplicateFloor` | `grep -rn "duplicateLevel\|level\.duplicate\|addLevel\|createAddLevel"` trên `src/` | **0 kết quả** (chỉ trúng `lod.addLevel` của three.js). Không lệnh, không endpoint. `ENDPOINTS.floors.create` tạo tầng RỖNG, không sao chép nội dung, và không có tham số "sao chép nội thất" |
| `hideFloorFrom3d` | `grep -rn "isHidden\|hiddenLevel\|visibleLevels\|hideFrom"` trên `src/domain src/store src/lib` | **0 kết quả có nghĩa.** `Level` không có trường hiện/ẩn, `SpatialPatch` không phủ nó, `FloorWriteBody` không mang nó. Cờ này **chỉ sống trong phiên**, mất sau một lần tải lại trang |
| `renameFloor` / `changeFloorHeight` như một **LỆNH** | `grep -rn "renameLevel\|level\.rename\|changeLevelHeight\|level\.changeHeight"` | **0 kết quả.** Chỉ có `level.changeElevation` và `level.reorder`. Đổi tên và đổi chiều cao đi qua `PatchSpatialFloorInput` (có endpoint) chứ không qua tầng lệnh — **nên chúng KHÔNG tự hoàn tác được bằng `invertCommand`**; T5 phải dựng vé hoàn tác riêng, hoặc khai nợ |

Cổng khai đúng khuôn `axisGridManagerGateway.ts`:

```ts
export const FLOOR_MANAGER_CAPABILITIES = [
  'readFloorList',
  'createFloor',
  'deleteFloor',
  'reorderFloors',
  'patchFloor',
  'duplicateFloor',
  'hideFloorFrom3d',
  'readFloorQcProgress',
] as const;

/** Việc trong danh sách trên mà bản cài đặt THẬT chưa làm được. Chỉ được ngắn đi. */
export const FLOOR_MANAGER_MISSING_CAPABILITIES = [
  'duplicateFloor',
  'hideFloorFrom3d',
] as const;
```

`readFloorQcProgress` để trong danh sách nhưng **chưa xếp vào nợ** — xem mục kế.

### Cần tra — `<<lấy từ notes/floor-manager/domain.md>>` (5 khoản)

| Cần ký hiệu nào | Vì sao chưa chắc |
|---|---|
| `<<lấy từ notes/floor-manager/domain.md>>` — **hàm/khoá đọc TIẾN ĐỘ QC của một tầng** | `queryKeys.progress.byFloor(floorId)` có thật (`queryKeys.ts:82`), nhưng `ProgressWireInput` (`src/api/contracts.ts:117-125`) mang `status/step/progressPercent` — đó là tiến độ **đường ống xử lý**, không phải tiến độ **người duyệt**. Nếu domain không có tiến độ QC riêng thì `readFloorQcProgress` phải vào bản kê nợ, và cột 9 hiện `"—"` ở màn thật |
| `<<lấy từ notes/floor-manager/domain.md>>` — **cách đếm số tường và số phòng của một tầng** | CẤM TUYỆT ĐỐI *"không tự đếm đối tượng"*. `queryKeys.space.byFloor` và `queryKeys.room.byFloor` có thật, nhưng T5 phải lấy con số từ **hàm đếm của tầng dữ liệu**, không viết `walls.filter(...).length` trong hook. Cần tên hàm/selector chính thức |
| `<<lấy từ notes/floor-manager/domain.md>>` — **cách đọc số bản vẽ của một tầng** | `FloorPayload.drawings?: Drawing[]` có thật (`src/api/contracts.ts:89`); cần biết selector/normalizer chính thức thay vì đọc mảng thô |
| `<<lấy từ notes/floor-manager/domain.md>>` — **`CommandContext` và `dispatch` dựng ở đâu cho màn tầng** | `AxisGridManager` dựng `createAxisGridDispatchDeps` trong cổng của chính nó. Cần biết S-16 có cổng dùng chung không, hay `floorManagerGateway.ts` dựng lại |
| `<<lấy từ notes/floor-manager/domain.md>>` — **`Building.datumElevationMm`, ai đặt** | `restack` của `createReorderLevelsCommand` dồn cao độ **bắt đầu từ `context.graph.building.datumElevationMm`**. Với bộ mẫu ở mục D (tầng thấp nhất ở `-3000`), mốc chuẩn phải là `-3000` thì bật "Tự động tính cao độ" mới không dịch cả toà nhà lên. T5 phải xác nhận trước khi nối công tắc đó |

**Không ai được bịa một endpoint, một hằng số, hay một công thức để lấp bất kỳ ô nào ở trên**
(R-69: thiếu logic thì DỪNG và hỏi bằng `orca orchestration ask`; CẤM stub, CẤM TODO).

---

## Kiểm lại trước khi mở PR

- `pnpm verify` — bảy bước tuần tự, dừng ở bước hỏng đầu tiên.
- Lưu ý đã ghi nhận: **cổng kích thước gói (bước 6) đã ĐỎ sẵn trên cây đã commit.** Đo lại,
  đừng trích số cũ; muốn quy trách nhiệm cho phần mình thì gỡ route ra rồi đo lại.
- E.10 / R-58: **bước chưa chạy thì ghi "chưa chạy"**, không ghi "đạt".
