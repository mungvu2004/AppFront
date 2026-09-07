/**
 * Tấm trượt chi tiết một vi phạm (S-34) — vì sao một luật kêu, và làm gì với nó.
 *
 * Nửa hiển thị của mục D. Mọi giá trị dưới đây tới trong {@link ViolationDetailViewProps}:
 * file này không chạy luật nào, không đếm gì, không định dạng số nào và không biết một
 * đường dẫn nào. `useViolationDetail` làm hết, và đó là lý do `local/no-data-layer-in-view`
 * không có gì để bắt và lý do cả bảy trạng thái dựng được từ một object literal.
 *
 * ## Đây là một tấm trượt, KHÔNG phải một hộp thoại
 *
 * Ràng buộc mạnh nhất của màn này không nằm trong props, nó nằm trong lệnh cấm: tấm
 * trượt **không bao giờ được che khuất mô hình**. Người dùng đọc chi tiết vi phạm để
 * nhìn vào bản vẽ, nên bất cứ thứ gì làm bản vẽ khó nhìn hơn đều làm hỏng chính việc đó.
 * Ba hệ quả, và cả ba đều là chuyện KHÔNG có gì trong file này:
 *
 * - **không lớp phủ.** Không một phần tử nào ở đây trải `inset-0`. Phần bên trái tấm
 *   trượt là mô hình, không bị một lớp mờ nào phủ lên.
 * - **không `aria-modal`, không `role="dialog"`.** Vỏ là một `<aside>` có nhãn. Trình đọc
 *   màn hình vẫn đọc được mọi thứ phía sau, đúng như mắt vẫn nhìn được.
 * - **không bẫy tiêu điểm.** Tab đi hết tấm trượt rồi đi tiếp ra phần còn lại của ứng
 *   dụng. Không có gì giữ tiêu điểm lại, vì không có gì ở đây là modal.
 *
 * `Drawer.Root` dùng chung làm cả ba thứ ngược lại — lớp phủ `absolute inset-0
 * bg-bg-overlay`, `role="dialog"` + `aria-modal="true"` viết cứng, và `createFocusTrap`
 * trong `useEffect` — và `DrawerRootProps` chỉ có bốn trường `isOpen/onClose/children/size`,
 * không trường nào tắt được thứ nào trong ba. Nên vỏ được dựng ở đây, trong thư mục màn.
 * Đó không phải "tạo component mới" theo nghĩa bị cấm: cấm là thêm vào `src/components/**`,
 * và repo đã có tiền lệ với Combobox và Breadcrumb.
 *
 * Điều DUY NHẤT của một hộp thoại được giữ lại là **Esc đóng lớp trên cùng** (A12), và
 * nó đi qua `shortcutRegistry` ở phạm vi `sidePanel` chứ không qua một
 * `addEventListener` tự gắn — `sidePanel` đứng trên `canvas` và dưới `dialog` trong thứ
 * tự phân giải, đúng chỗ một tấm trượt sống cạnh mô hình chứ không đè lên nó.
 *
 * ## Hai chỗ đặc tả và mã lệch nhau, và vì sao
 *
 * **Thời lượng.** Đặc tả nói 240 ms. Thang chuyển động của repo có đúng năm giá trị —
 * 120 / 180 / 260 / 340 / 700 — và 240 không nằm trong đó; R-71 cấm viết một con số
 * ngoài thang. Ô đúng nghĩa cho "một tấm có diện tích riêng trượt vào" là `standard`,
 * 260 ms, và mã lấy nó từ `MOTION_DURATIONS_MS` qua `durationSeconds('standard')`.
 *
 * **"Mô hình mờ nhẹ khi tấm trượt mở".** Không làm. Cách duy nhất để tấm trượt làm mờ
 * mô hình là đặt một lớp phủ lên mô hình, và lớp phủ là đúng thứ lệnh cấm tuyệt đối
 * loại bỏ; props cũng không có đường nào để nhờ màn cha tự hạ độ sáng. Giữa một câu của
 * đặc tả và một lệnh cấm tuyệt đối của cùng đặc tả, lệnh cấm thắng. Tấm trượt trượt vào,
 * mô hình đứng yên và sáng nguyên.
 *
 * ## Bảy trạng thái (A11 / R-63)
 *
 * `empty` · `loading` · `partial` · `error` · `success` · `forbidden` · `collapsed`, đọc
 * thẳng từ `props.state`. Hai cái đáng nói:
 *
 * - **`forbidden` giấu nút sửa, KHÔNG giấu căn cứ.** Người không có quyền sửa vẫn phải
 *   đọc được luật nào kêu, ở đâu, vì sao. Cái mất đi là khối 7, và nó mất theo cách các
 *   năng lực `false` mất: khỏi DOM, không phải nút xám.
 * - **`collapsed` là tấm trượt từ dưới lên và không có khối hình.** Ở chiều cao ấy một
 *   khung 240 chiếm gần hết phần đọc được, nên nó nhường chỗ cho chữ.
 */

import { ChevronLeft, ChevronRight, FileSearch, X } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { motion } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useShortcut } from '@/hooks/useShortcut';
import { durationSeconds, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { ViolationFigure, ViolationRuleDiagram } from './ViolationDetailFigure';
import {
  ViolationActionsSection,
  ViolationCausesSection,
  ViolationFindingsSection,
  ViolationFooterSection,
  ViolationRuleSection,
  ViolationSeverityBadge,
} from './ViolationDetailSections';
import type { ViolationDetailViewProps } from './types';

/** Rộng 420 theo đặc tả. Phần còn lại của màn hình là mô hình, và nó ở đó cả lúc này. */
const PANEL_SIDE = 'right-0 top-0 h-full w-[420px] border-l';

/** Trạng thái 7: cùng tấm trượt ấy, đến từ cạnh dưới, cao vừa đủ để đọc. */
const PANEL_BOTTOM = 'bottom-0 left-0 right-0 max-h-[70%] w-full border-t';

const PANEL_BASE =
  'absolute z-10 flex flex-col overflow-y-auto border-border-default bg-bg-surface shadow-overlay';

/* -------------------------------------------------------------------------- */
/* Khối 1 — đầu.                                                               */
/* -------------------------------------------------------------------------- */

interface HeadProps {
  readonly props: ViolationDetailViewProps;
}

/**
 * Nhóm luật, tiêu đề, mức, mã đối tượng — cộng ba nút điều hướng.
 *
 * Tiêu đề là `h2` vì tấm trượt là một vùng trong một trang đã có `h1`; các khối bên dưới
 * dùng `h3`, nên thứ bậc đọc được liền mạch từ trên xuống mà không nhảy cấp.
 *
 * `Badge` mức là chỗ DUY NHẤT màu vi phạm xuất hiện trong phần chữ của tấm trượt. Chỗ
 * thứ hai là viền đối tượng gây lỗi trên khối hình 2D. Không có chỗ thứ ba.
 */
function ViolationDetailHead({ props }: HeadProps) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[12px] text-text-muted">{props.groupLabel}</p>

          <h2 className="text-base font-semibold text-text-primary">{props.title}</h2>

          <div className="flex flex-wrap items-center gap-2">
            <ViolationSeverityBadge
              severity={props.severity}
              severityLabel={props.severityLabel}
            />
            <span className="font-mono text-[13px] text-text-secondary">
              {props.subjectEntityId}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            aria-label="vi phạm trước"
            disabled={!props.hasPrevious}
            icon={<ChevronLeft aria-hidden="true" />}
            onClick={props.onPrevious}
            size="sm"
          />
          <IconButton
            aria-label="vi phạm kế tiếp"
            disabled={!props.hasNext}
            icon={<ChevronRight aria-hidden="true" />}
            onClick={props.onNext}
            size="sm"
          />
          <IconButton
            aria-label="đóng tấm trượt chi tiết vi phạm"
            icon={<X aria-hidden="true" />}
            onClick={props.onClose}
            size="sm"
          />
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Ba dòng trạng thái đi kèm nội dung.                                         */
/* -------------------------------------------------------------------------- */

interface NoticesProps {
  readonly props: ViolationDetailViewProps;
  readonly hasActions: boolean;
}

/**
 * Những gì trạng thái 3, 4, 5 thêm vào phần thân, không thay phần thân.
 *
 * Cả ba đều là **thêm một dòng**, không phải đổi màn: một lượt sửa hỏng, một lượt sửa
 * xong, hay một vi phạm không có cách sửa tự động nào đều không làm căn cứ luật biến mất,
 * nên căn cứ ở nguyên đó và dòng mới đứng cạnh nó.
 *
 * Dòng "đã xử lý" cố tình KHÔNG mang màu xanh xác minh: A5 dành màu ấy cho dấu của người
 * duyệt, và một lượt chạy lại của máy không bao giờ được đeo nó.
 */
function ViolationDetailNotices({ hasActions, props }: NoticesProps) {
  return (
    <>
      {props.state === 'error' && props.errorMessage !== null ? (
        <InlineAlert level="violation" message={props.errorMessage} />
      ) : null}

      {props.state === 'success' && props.resolvedMessage !== null ? (
        <p className="rounded-[8px] bg-bg-sunken p-3 text-sm text-text-secondary">
          {props.resolvedMessage}
        </p>
      ) : null}

      {props.state === 'partial' && !hasActions ? (
        <p className="text-sm text-text-secondary">
          Chưa có cách sửa tự động nào cho vi phạm này. Phần căn cứ ở trên đủ để sửa tay trên
          bản vẽ.
        </p>
      ) : null}

      {props.isAdvancing ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[8px] bg-bg-sunken p-3">
          <p className="text-[13px] text-text-secondary">Sắp chuyển sang vi phạm kế tiếp.</p>
          <Button onClick={props.onCancelAdvance} size="sm" variant="secondary">
            Giữ lại màn này
          </Button>
        </div>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Thân.                                                                       */
/* -------------------------------------------------------------------------- */

interface BodyProps {
  readonly props: ViolationDetailViewProps;
}

/**
 * Khối 2 tới khối 8, theo đúng thứ tự đặc tả, trừ những khối không tồn tại.
 *
 * Khối 3 ("số đo so với ngưỡng") không có ở đây: `canCompareMeasure` là `false` và phán
 * quyết G1 gỡ nó khỏi DOM. Khối 5 tự biến mất khi không dựng được ngữ cảnh, và ở trạng
 * thái thu gọn thì nó không được dựng ngay từ đầu. Khối 7 vắng mặt khi người xem không
 * có quyền sửa.
 */
function ViolationDetailBody({ props }: BodyProps) {
  const isCollapsed = props.state === 'collapsed';
  const canAct = props.capabilities.canEdit && props.state !== 'forbidden';

  return (
    <div className="flex flex-col gap-5">
      <ViolationRuleSection
        diagram={<ViolationRuleDiagram group={props.group} />}
        ruleSentence={props.ruleSentence}
      />

      <ViolationFindingsSection
        canShowConfidence={props.capabilities.canShowConfidence}
        objects={props.objects}
        onSelectObject={props.onSelectObject}
      />

      {isCollapsed ? null : (
        <ViolationFigure
          capabilities={props.capabilities}
          figure2d={props.figure2d}
          figureMode={props.figureMode}
          figureRef={props.figureRef}
          figureUnavailable={props.figureUnavailable}
          onFigureModeChange={props.onFigureModeChange}
        />
      )}

      <ViolationCausesSection causes={props.causes} />

      {canAct ? (
        <ViolationActionsSection
          actions={props.actions}
          onAction={props.onAction}
          onActionHover={props.onActionHover}
        />
      ) : null}

      <ViolationDetailNotices hasActions={canAct && props.actions.length > 0} props={props} />

      <ViolationFooterSection levelId={props.levelId} ruleCode={props.ruleCode} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Vỏ.                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Tấm trượt, như một hàm của props.
 *
 * Test và story dựng thẳng component này, một lần cho mỗi trạng thái — đó là thứ làm
 * A11 kiểm được mà không cần store và không cần mạng.
 */
export function ViolationDetail(props: ViolationDetailViewProps) {
  const isCollapsed = props.state === 'collapsed';

  // A12. Phạm vi `sidePanel`, không phải `dialog`: `dialog` là tầng nuốt mọi phím nó
  // không nhận, và một tấm trượt sống CẠNH mô hình thì không được phép làm thế — `W`
  // vẫn phải đổi công cụ trên canvas trong lúc tấm trượt mở.
  useShortcut({
    combo: 'Escape',
    description: 'đóng tấm trượt chi tiết vi phạm',
    id: 'sidePanel.violationDetail.close',
    onTrigger: props.onClose,
    scope: 'sidePanel',
  });

  return (
    <motion.aside
      animate={{ opacity: 1, x: 0, y: 0 }}
      aria-label="chi tiết vi phạm"
      className={cn(PANEL_BASE, isCollapsed ? PANEL_BOTTOM : PANEL_SIDE)}
      initial={isCollapsed ? { opacity: 0, y: '100%' } : { opacity: 0, x: '100%' }}
      transition={{ duration: durationSeconds('standard'), ease: EASE.default }}
    >
      <div className="flex flex-col gap-5 p-4">
        {props.state === 'empty' ? (
          <EmptyState
            description="Chọn một vi phạm trong báo cáo kiểm tra luật để xem luật nào kêu, ở bộ phận nào, và những cách xử lý có sẵn."
            icon={<FileSearch aria-hidden="true" />}
            title="Chưa chọn vi phạm nào"
          />
        ) : props.state === 'loading' ? (
          <Skeleton preset="property-panel" />
        ) : (
          <>
            <ViolationDetailHead props={props} />
            <ViolationDetailBody props={props} />
          </>
        )}
      </div>
    </motion.aside>
  );
}
