/**
 * `S-25` — panel chi tiết một model của thư viện. Cột phải rộng 400.
 *
 * ## Ranh giới 3D: file này không biết `three` tồn tại
 *
 * Giao diện duy nhất với WebGL là đúng một dòng — `<canvas ref={actions.attachPreviewCanvas} />`.
 * Vòng đời nạp / đo / dọn nằm trọn ở `useModelLibrary` + `modelLibraryGateway`, đúng như
 * `ModelLibraryActions.attachPreviewCanvas` trong `types.ts` đã ghi. Hai lý do đều cứng,
 * không phải sở thích:
 *
 * - `local/no-data-layer-in-view` chặn tầng dữ liệu trong `<Name>.tsx` (R-60).
 * - Ngân sách `routeChunk` là 280 KiB (`scripts/check-bundle-size.mjs`). Nhập tĩnh `three` +
 *   `GLTFLoader` + Draco từ view là kéo cả cụm ấy vào chunk của route và nổ cổng kích thước.
 *
 * ## Tấm canvas sống suốt đời panel; trạng thái đổi lớp PHỦ lên nó
 *
 * `preview.state` đi `loading → ready | failed`, nhưng thẻ `<canvas>` được dựng ở cả ba: hook
 * cần một tấm canvas thật để nạp vào *trong lúc* `loading`, nên tháo nó ra theo trạng thái là
 * gọi `attachPreviewCanvas(null)` đúng lúc hook cần đích đến. Skeleton và khối lỗi vì thế là
 * lớp phủ tuyệt đối bên trên, không phải nhánh thay thế cho canvas. Nút thử lại cũng dựa vào
 * điều này: sau khi hỏng, tấm canvas vẫn còn đó để nạp lại.
 *
 * `idle` không có nhánh nào ở đây — nó nghĩa là panel đóng, lúc ấy `ModelLibraryModel.detail`
 * là `null` và vỏ màn không dựng component này ngay từ đầu.
 *
 * ## Ba mục đặc tả vắng mặt, và không để lại dấu vết trong DOM
 *
 * Danh sách bí danh · danh sách dự án đang tham chiếu · nút "tối ưu lưới". Cả ba đều `false`
 * ở `ModelLibraryCapabilities` (`canListAliases`, `canCountUsage`, `canOptimizeMesh`) vì tầng
 * logic không có nguồn — số đo và lý do nằm trong docblock `types.ts`. Theo R-69 chúng RỜI
 * KHỎI DOM: không nút xám, không tiêu đề rỗng, không tooltip "sắp có". Vậy nên panel này
 * không đọc `capabilities`: ba affordance ấy không tồn tại trong mã, chứ không phải bị ẩn.
 *
 * Cùng lẽ ấy, khung xem trước **không tự quay** (`canAutoSpin === false`): "khoảng 4 giây" của
 * đặc tả không nằm trong thang chuyển động năm giá trị của repo, và R-68 cấm màn này thêm
 * token vào `src/lib`. Người dùng vẫn quay tay được — đó là vế đặc tả nói rõ. Câu giải thích,
 * nếu có, đến từ `preview.autoSpinNote`; view không tự chế lời.
 *
 * ## Vị trí là việc của vỏ màn
 *
 * Panel là một cột `w-[400px] max-w-full` và không tự định vị. Dưới 1024 nó thành lớp phủ —
 * `ModelLibraryDetailModel` cố ý không mang `isNarrow`, vì chỗ đặt thuộc về vỏ màn.
 */

import { Box, X } from 'lucide-react';

import { Skeleton } from '@/components/feedback/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldRow } from '@/components/ui/FieldRow';
import { IconButton } from '@/components/ui/IconButton';
import { useShortcut } from '@/hooks/useShortcut';
import { cn } from '@/lib/utils';

import type {
  ModelLibraryActions,
  ModelLibraryDetailModel,
  ModelLibraryFieldModel,
  ModelLibraryRowModel,
  ModelPreviewModel,
} from './types';

export interface ModelLibraryDetailProps {
  readonly model: ModelLibraryDetailModel;
  readonly actions: ModelLibraryActions;
}

/** Rộng 400 theo đặc tả; `max-w-full` để lớp phủ dưới 1024 không tràn khỏi màn hẹp. */
const PANEL_WIDTH = 'w-[400px] max-w-full';

/**
 * Khung xem trước cao 240 — cùng con số và cùng khuôn với `RuleReport.tsx:330`.
 * `relative` là chỗ neo của hai lớp phủ trạng thái bên trong.
 */
const PREVIEW_FRAME =
  'relative h-[240px] w-full overflow-hidden rounded-[8px] border border-border-default bg-canvas-3d';

/** Chữ đều cho mọi con số người đọc nhìn thấy — số tam giác, dung lượng, kích thước bao. */
const NUMERIC_TEXT = 'font-mono tabular-nums';

/* -------------------------------------------------------------------------- */
/* Phần 1 — khung xem trước 3D.                                                */
/* -------------------------------------------------------------------------- */

interface PreviewProps {
  readonly modelId: string;
  readonly preview: ModelPreviewModel;
  readonly actions: ModelLibraryActions;
}

/**
 * Tấm canvas cộng hai lớp phủ trạng thái.
 *
 * Canvas mang `aria-hidden` — nó là hình ảnh không có nội dung đọc được, và cái mang tên cho
 * trình đọc màn hình là `<section>` bọc ngoài. Khuôn này lấy từ `Viewer3D.tsx:214` và
 * `ExplodedView.tsx:84`, nơi cùng một tấm canvas do hook sở hữu.
 *
 * Lớp phủ `failed` cố tình dùng biểu tượng và chữ TRUNG TÍNH, không phải màu vi phạm: một
 * model không nạp được là một khung trống, không phải một lỗi dữ liệu của người dùng.
 */
function ModelPreviewFrame({ actions, modelId, preview }: PreviewProps) {
  return (
    <section aria-label="xem trước mô hình" className="flex flex-col gap-2">
      <div className={PREVIEW_FRAME}>
        <canvas
          aria-hidden="true"
          className={cn(
            'block h-full w-full',
            preview.state === 'ready' ? 'opacity-100' : 'opacity-0',
          )}
          ref={actions.attachPreviewCanvas}
        />

        {preview.state === 'loading' ? (
          <Skeleton className="absolute inset-0 min-h-0" preset="canvas" />
        ) : null}

        {preview.state === 'failed' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-sunken p-4 text-center">
            <Box aria-hidden="true" className="text-text-muted" size={32} strokeWidth={1.5} />

            {preview.errorMessage !== null ? (
              <p className="text-[13px] text-text-secondary">{preview.errorMessage}</p>
            ) : null}

            {/*
              Hợp đồng đông cứng không có hành động "nạp lại khung 3D" riêng, và
              `retryPreviewImage` thuộc về ảnh 32px của hàng chứ không phải tấm canvas này.
              Điều phối viên đã chốt: mở lại chính model đang mở là đường thử lại — kèm ràng
              buộc `openDetail` phải nạp lại KỂ CẢ khi id không đổi, việc của lớp gộp.
            */}
            <Button
              onClick={() => {
                actions.openDetail(modelId);
              }}
              size="sm"
              variant="secondary"
            >
              Thử lại
            </Button>
          </div>
        ) : null}
      </div>

      {preview.autoSpinNote !== null ? (
        <p className="text-[12px] text-text-muted">{preview.autoSpinNote}</p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Phần 2 — hai con số tam giác, đứng cạnh nhau.                               */
/* -------------------------------------------------------------------------- */

interface TriangleCountsProps {
  readonly declaredLabel: string;
  readonly measuredLabel: string | null;
}

/**
 * Số máy chủ khai và số đo lại từ hình học thật, cạnh nhau.
 *
 * Hai số lệch nhau là thông tin thật đáng hiện, không phải lỗi — nên câu chú thích nói đúng
 * điều đó thay vì giấu một trong hai đi. Số đo lại chỉ có sau khi model nạp xong, nên khi nó
 * còn `null` thì ô ấy vắng mặt hẳn: một ô có tiêu đề mà rỗng là đúng thứ R-69 cấm.
 *
 * Cả hai nhãn đều đã là chuỗi định dạng sẵn từ viewmodel (A15) — view không `toFixed`, không
 * `toLocaleString`, không quy đổi đơn vị.
 */
function TriangleCounts({ declaredLabel, measuredLabel }: TriangleCountsProps) {
  return (
    <section aria-label="số tam giác" className="flex flex-col gap-2">
      <dl className="flex items-start gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-[12px] text-text-muted">Máy chủ khai</dt>
          <dd className={cn('text-[14px] text-text-primary', NUMERIC_TEXT)}>{declaredLabel}</dd>
        </div>

        {measuredLabel !== null ? (
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-[12px] text-text-muted">Đo lại từ tệp</dt>
            <dd className={cn('text-[14px] text-text-primary', NUMERIC_TEXT)}>{measuredLabel}</dd>
          </div>
        ) : null}
      </dl>

      {measuredLabel !== null ? (
        <p className="text-[12px] text-text-muted">
          Hai số lệch nhau là chuyện thường: số đo lại đọc thẳng từ hình học trong tệp.
        </p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Phần 3 — siêu dữ liệu.                                                      */
/* -------------------------------------------------------------------------- */

interface FieldsProps {
  readonly fields: readonly ModelLibraryFieldModel[];
}

/**
 * Kích thước bao, số tam giác, dung lượng, nhóm — mỗi thứ một `FieldRow`.
 *
 * Ô giá trị là chữ thuần, không phải `Input`: panel này không sửa được gì (`canChangeGroup`
 * và `canDeprecate` đều `false`), nên bẫy a11y đã đo của `FieldRow` — nhãn của nó chỉ là một
 * `<span>` thị giác, không `htmlFor`, nên control con phải tự mang tên — không chạm tới đây.
 * Đặt một `Input` chỉ-đọc vào chỗ này sẽ dựng lại đúng bẫy ấy mà chẳng thêm được gì.
 */
function ModelFields({ fields }: FieldsProps) {
  return (
    <section aria-label="siêu dữ liệu model" className="flex flex-col">
      {fields.map((field, index) => (
        <FieldRow isLast={index === fields.length - 1} key={field.label} label={field.label}>
          <span
            className={cn(
              'flex min-h-[36px] items-center text-[14px] text-text-primary',
              field.isNumeric && NUMERIC_TEXT,
            )}
          >
            {field.value}
          </span>
        </FieldRow>
      ))}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Phần 4 — model nặng: cảnh báo, không chặn.                                  */
/* -------------------------------------------------------------------------- */

interface HeavyProps {
  readonly item: ModelLibraryRowModel;
}

/**
 * Badge "Nặng" cộng câu khuyến nghị.
 *
 * Đúng MỘT mức, không phải hai: `SCENE_BUDGET.maxTriangles` là trần duy nhất trong repo và
 * không có `maxTrianglesPerModel` nào để dựng ngưỡng mềm — bịa một tỉ lệ là đúng thứ R-71
 * cấm. Câu khuyến nghị đến nguyên văn từ `BudgetWarning.message` qua `item.heavyAdvice`; view
 * không tự viết câu có số trong đó.
 *
 * Khối này cảnh báo chứ không chặn: nó không tắt nút nào, không phủ lên khung xem trước.
 */
function HeavyNotice({ item }: HeavyProps) {
  if (!item.isHeavy) {
    return null;
  }

  return (
    <section
      aria-label="cảnh báo model nặng"
      className="flex flex-col items-start gap-2 rounded-[8px] bg-bg-sunken p-3"
    >
      <Badge variant="attention">Nặng</Badge>

      {item.heavyAdvice !== null ? (
        <p className="text-[13px] text-text-secondary">{item.heavyAdvice}</p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Vỏ panel.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Panel chi tiết, như một hàm của props — test được chỉ từ props, không chạm store, không
 * chạm mạng (mục D, R-60).
 */
export function ModelLibraryDetail({ actions, model }: ModelLibraryDetailProps) {
  // A12. Phạm vi `sidePanel`, không phải `dialog`: `dialog` là tầng nuốt mọi phím nó không
  // nhận, mà panel này sống CẠNH bảng — gõ tìm kiếm và sắp xếp phải chạy tiếp trong lúc nó
  // mở. Đăng ký qua `shortcutRegistry` (R-54), không `addEventListener('keydown')`; và đăng
  // ký ở view chứ không ở hook, để `Escape` không bị nhận hai lần trên cùng một tổ hợp —
  // cùng lý do đã ghi tại `ViolationDetail.tsx:294-299`.
  useShortcut({
    combo: 'Escape',
    description: 'đóng panel chi tiết model',
    id: 'sidePanel.modelLibraryDetail.close',
    onTrigger: actions.closeDetail,
    scope: 'sidePanel',
  });

  return (
    <aside
      aria-label="chi tiết model"
      className={cn(
        'flex h-full flex-col gap-4 overflow-y-auto border-l border-border-default bg-bg-surface p-4',
        PANEL_WIDTH,
      )}
    >
      <header className="flex items-start gap-2">
        {/* `h2` vì panel là một vùng trong trang đã có `h1`; thứ bậc đọc không nhảy cấp. */}
        <h2 className="min-w-0 flex-1 break-words text-base font-semibold text-text-primary">
          {model.item.name}
        </h2>

        <IconButton
          aria-label="đóng panel chi tiết model"
          icon={<X aria-hidden="true" />}
          onClick={actions.closeDetail}
          size="sm"
        />
      </header>

      <ModelPreviewFrame actions={actions} modelId={model.item.id} preview={model.preview} />

      <TriangleCounts
        declaredLabel={model.item.triangleCountLabel}
        measuredLabel={model.preview.measuredTriangleCountLabel}
      />

      <ModelFields fields={model.fields} />

      <HeavyNotice item={model.item} />
    </aside>
  );
}
