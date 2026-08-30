/**
 * Màn "Phát hiện tệp CAD" (`CadBranchConfirm`) — vỏ của route
 * `ROUTE_PATTERNS.projectCadConfirm`.
 *
 * View THUẦN (mục D, R-60): chỉ nhận {@link CadBranchConfirmProps} và vẽ. Không
 * `@/api`, không `@/store`, không `@/domain`, không `@/lib/http`. Mọi câu tiếng
 * Việt động và mọi con số đã định dạng xong ở `useCadBranchConfirm` (A15) — file
 * này không gọi `toFixed`, không `toLocaleString`, không một phép chia nào.
 *
 * ## Hai giai đoạn NỐI TIẾP trong CÙNG MỘT ROUTE
 *
 * Giai đoạn 1 là hộp thoại 560 chốt nhánh. Chọn **CAD** thì hộp thoại ĐÓNG
 * (`model.dialog.isOpen === false`) rồi panel ánh xạ mới mở ra bên dưới
 * (`model.stage === 'layerMapping'`) — không lúc nào có hộp thoại lồng trong hộp
 * thoại. Chọn **AI** thì hộp thoại đóng và khối bàn giao nhánh AI hoà tan vào
 * chỗ đó trong 340 ms (`animate-panel-rise`, tức nấc `slow` của thang chuyển
 * động — R-71, không con số nào viết tay ở đây).
 *
 * Khối bàn giao ấy cũng là câu trả lời của màn cho nút "Huỷ": hộp thoại đóng mà
 * chưa chốt nhánh nào thì màn KHÔNG được trắng (A11), nên chỗ đó vẫn còn đủ hai
 * lựa chọn để người dùng chốt lại. Đúng **hai** lựa chọn, không có lựa chọn thứ
 * ba — và nhánh AI không bao giờ bị khoá, kể cả ở trạng thái lỗi.
 *
 * ## Dòng tóm tắt chân màn, và con số chạy
 *
 * Câu tóm tắt là hai chuỗi ĐÃ GHÉP XONG của hook
 * ({@link CadMappingSummary.mappedCountLabel} và `objectCountLabel`) — view chỉ
 * đặt chúng cạnh nhau, không tự đếm và không tự ghép số. Con số lớn bên cạnh là
 * phần CHUYỂN ĐỘNG: nó chạy tới giá trị mới mỗi lần người dùng đổi vai trò một
 * lớp, và nó là `aria-hidden` nên trình đọc màn hình chỉ nghe đúng câu của hook
 * một lần. Nó chạy bằng `@/hooks/useCountUp` — lớp bọc React của engine thuần
 * `@/lib/motion/useCountUp`; hai file trùng tên nhưng không trùng việc, và view
 * là tầng React nên nó dùng lớp bọc.
 *
 * ## Bảy trạng thái (A11)
 *
 * | `state`     | khối trạng thái riêng                                          |
 * |-------------|----------------------------------------------------------------|
 * | `empty`     | `emptyNotice` — tệp không có lớp đặt tên                        |
 * | `loading`   | khung chờ, không dải cảnh báo                                   |
 * | `partial`   | `partialNotice` + danh sách thực thể không dựng lại được         |
 * | `error`     | `errorMessage` + `errorCode` + lối sang nhánh AI + nút đọc lại   |
 * | `success`   | `successNotice`                                                 |
 * | `forbidden` | `forbiddenNotice`                                               |
 * | `collapsed` | panel ánh xạ thu lại, canvas rộng ra                            |
 *
 * Không nhánh nào trả `null`: phần đầu màn luôn được vẽ, nên màn trắng — thất
 * bại duy nhất A11 tồn tại để chặn — không có chỗ xảy ra.
 */

import { Skeleton } from '@/components/feedback/Skeleton';
import { InlineAlert, type InlineAlertLevel } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { useCountUp } from '@/hooks/useCountUp';
import type { NumberFormatOptions } from '@/lib/format/number';

import { CadBranchConfirmDialog } from './CadBranchConfirmDialog';
import {
  AI_BRANCH_NOTICE,
  CAD_BRANCH_CONFIRM_TEXT,
  IMPORT_BUTTON_LABEL,
} from './cadBranchConfirmText';
import { CadImportOptions } from './CadImportOptions';
import { CadLayerMappingPanel } from './CadLayerMappingPanel';
import { CadLayerPreviewCanvas } from './CadLayerPreviewCanvas';
import type {
  CadBranchConfirmActions,
  CadBranchConfirmProps,
  CadBranchConfirmState,
  CadBranchConfirmViewModel,
  CadMappingSummary,
} from './types';

const PHASE_1_TEXT = CAD_BRANCH_CONFIRM_TEXT.phase1;

/* -------------------------------------------------------------------------- */
/* Chuỗi riêng của vỏ màn — khoá đối chiếu ở `cadBranchConfirm.screen`.         */
/* -------------------------------------------------------------------------- */

const SCREEN_ARIA_LABEL = 'Màn phát hiện tệp CAD';
const NOTICE_REGION_ARIA_LABEL = 'Trạng thái của màn phát hiện tệp CAD';
const STAGE_TWO_ARIA_LABEL = 'Ánh xạ lớp và xem trước hình học';
const SUMMARY_ARIA_LABEL = 'Tóm tắt số lớp đã ánh xạ';
const LOADING_ARIA_LABEL = 'Đang đọc tệp CAD';

const EMPTY_TITLE = 'Tệp CAD không có lớp được đặt tên';
const PARTIAL_TITLE = 'Một phần dữ liệu sẽ không được nhập';
const ERROR_TITLE = 'Không thể đọc tệp CAD';
const SUCCESS_TITLE = 'Đã nhập xong hình học';
const FORBIDDEN_TITLE = 'Không có quyền xử lý CAD';

const AI_HANDOFF_TITLE = 'Chuyển sang nhánh nhận dạng ảnh';
const UNSUPPORTED_ENTITIES_TITLE = 'Thực thể không dựng lại được';
const RETRY_LABEL = 'Đọc lại tệp';
const COLLAPSE_PANEL_LABEL = 'Thu gọn bảng lớp';
const EXPAND_PANEL_LABEL = 'Mở bảng lớp';

/**
 * Mã máy đọc không bao giờ đứng một mình (A6).
 *
 * Nó đi SAU câu tiếng Việt nói rõ hậu quả, trong cùng một khối cảnh báo — cùng
 * khuôn `ScaleCalibration.tsx` và `ProcessingScreen.tsx`.
 */
const ERROR_CODE_PREFIX = 'Mã lỗi: ';

/** Dấu ngăn hai vế của dòng tóm tắt, cùng dấu bảng lớp dùng cho dòng gợi ý. */
const SUMMARY_SEPARATOR = ' · ';

/** Dấu ngăn giữa tên loại thực thể và số lượng của nó. */
const ENTITY_KIND_SEPARATOR = ' · ';

/**
 * Số đối tượng là số đếm: không phần thập phân nào có nghĩa ở đây.
 *
 * Hằng nằm ngoài thân hàm để tham chiếu của nó đứng yên giữa hai lượt render —
 * `useCountUp` đọc từng trường của nó, nhưng một đối tượng dựng lại mỗi lần
 * render vẫn là thứ không cần thiết.
 */
const COUNT_FORMAT: NumberFormatOptions = { fractionDigits: 0 };

/** Mức màu của khối trạng thái. Đúng ba màu của A4, không có màu thứ tư. */
const NOTICE_LEVELS: Readonly<Record<CadBranchConfirmState, InlineAlertLevel | null>> = {
  empty: 'attention',
  loading: null,
  partial: 'attention',
  error: 'violation',
  success: 'verified',
  forbidden: 'attention',
  collapsed: null,
};

const NOTICE_TITLES: Readonly<Record<CadBranchConfirmState, string>> = {
  empty: EMPTY_TITLE,
  loading: '',
  partial: PARTIAL_TITLE,
  error: ERROR_TITLE,
  success: SUCCESS_TITLE,
  forbidden: FORBIDDEN_TITLE,
  collapsed: '',
};

/**
 * Câu của trạng thái đang mở.
 *
 * Sáu trường câu chữ trên mô hình loại trừ nhau theo bất biến của `types.ts` —
 * đúng một trong số chúng khác `null` tại một thời điểm — nên chỗ này chỉ CHỌN,
 * không ghép và không dựng câu mới.
 */
function messageFor(model: CadBranchConfirmViewModel): string | null {
  switch (model.state) {
    case 'empty':
      return model.emptyNotice;
    case 'partial':
      return model.partialNotice;
    case 'error':
      return model.errorMessage;
    case 'success':
      return model.successNotice;
    case 'forbidden':
      return model.forbiddenNotice;
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Dòng tóm tắt chân màn.                                                       */
/* -------------------------------------------------------------------------- */

interface CadMappingSummaryBarProps {
  readonly summary: CadMappingSummary;
  readonly canImportGeometry: boolean;
  readonly isImporting: boolean;
  readonly prefersReducedMotion: boolean;
  readonly onImportGeometry: () => void;
}

/**
 * Chân màn: con số chạy, câu tóm tắt của hook, nút "Nhập hình học".
 *
 * Tách thành hàm riêng vì `useCountUp` là một hook — nó không được gọi trong một
 * nhánh điều kiện, mà dòng tóm tắt chỉ tồn tại ở giai đoạn 2
 * (`model.summary === null` ở giai đoạn 1).
 */
function CadMappingSummaryBar({
  canImportGeometry,
  isImporting,
  onImportGeometry,
  prefersReducedMotion,
  summary,
}: CadMappingSummaryBarProps) {
  const runningObjectCount = useCountUp(summary.objectCount, {
    format: COUNT_FORMAT,
    reducedMotion: prefersReducedMotion,
  });

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-default px-4 py-3">
      <div className="flex min-w-0 items-baseline gap-3">
        <span
          aria-hidden="true"
          className="font-mono text-[20px] leading-none tabular-nums text-text-primary"
        >
          {runningObjectCount.text}
        </span>
        <p aria-label={SUMMARY_ARIA_LABEL} className="text-[13px] text-text-secondary" role="status">
          {summary.mappedCountLabel}
          {SUMMARY_SEPARATOR}
          {summary.objectCountLabel}
        </p>
      </div>

      <Button
        disabled={!canImportGeometry}
        loading={isImporting}
        onClick={onImportGeometry}
        variant="primary"
      >
        {IMPORT_BUTTON_LABEL}
      </Button>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* Khối bàn giao nhánh AI — hoà tan 340 ms.                                     */
/* -------------------------------------------------------------------------- */

interface CadBranchHandoffProps {
  readonly isCadChoiceDisabled: boolean;
  readonly onChooseBranch: CadBranchConfirmActions['onChooseBranch'];
}

/**
 * Chỗ hộp thoại vừa đóng.
 *
 * Caption mức "cần chú ý" nói trước điều nhánh AI đòi: sẽ phải hiệu chỉnh tỷ lệ.
 * Hai nút là đúng hai lựa chọn chính của đặc tả; nút AI KHÔNG bao giờ bị khoá.
 */
function CadBranchHandoff({ isCadChoiceDisabled, onChooseBranch }: CadBranchHandoffProps) {
  return (
    <section className="animate-panel-rise px-4 pb-2 motion-reduce:animate-none">
      <InlineAlert level="attention" message={AI_BRANCH_NOTICE} title={AI_HANDOFF_TITLE} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={isCadChoiceDisabled}
          onClick={() => onChooseBranch('cad')}
          size="sm"
          variant="secondary"
        >
          {PHASE_1_TEXT.buttons.primary}
        </Button>
        <Button onClick={() => onChooseBranch('ai')} size="sm" variant="ghost">
          {PHASE_1_TEXT.buttons.secondary}
        </Button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Vỏ màn.                                                                      */
/* -------------------------------------------------------------------------- */

export function CadBranchConfirm({ actions, model }: CadBranchConfirmProps) {
  const noticeMessage = messageFor(model);
  const noticeLevel = NOTICE_LEVELS[model.state];
  const isError = model.state === 'error';
  const isStageTwoOpen = model.stage === 'layerMapping';
  const isHandoffOpen = !isStageTwoOpen && !model.dialog.isOpen;

  return (
    <div
      aria-label={SCREEN_ARIA_LABEL}
      className="flex h-full min-h-0 w-full flex-col bg-bg-app"
      role="region"
    >
      <header className="flex flex-col gap-1 px-4 pb-3 pt-4">
        <h1 className="text-[17px] font-semibold text-text-primary">
          {PHASE_1_TEXT.dialogStates.normal.title}
        </h1>
        <p className="text-[13px] text-text-secondary">
          {PHASE_1_TEXT.dialogStates.normal.description}
        </p>
      </header>

      {noticeLevel !== null && noticeMessage !== null && (
        <section aria-label={NOTICE_REGION_ARIA_LABEL} className="flex flex-col gap-2 px-4 pb-3">
          <InlineAlert
            level={noticeLevel}
            message={
              isError && model.errorCode !== null
                ? `${noticeMessage} ${ERROR_CODE_PREFIX}${model.errorCode}`
                : noticeMessage
            }
            title={NOTICE_TITLES[model.state]}
          />

          {isError && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => actions.onChooseBranch('ai')} size="sm" variant="secondary">
                {PHASE_1_TEXT.buttons.secondary}
              </Button>
              <Button onClick={actions.onRetry} size="sm" variant="ghost">
                {RETRY_LABEL}
              </Button>
            </div>
          )}
        </section>
      )}

      {model.unsupportedEntityKinds.length > 0 && (
        <section className="px-4 pb-3">
          <h2 className="mb-1 text-[13px] font-medium text-text-secondary">
            {UNSUPPORTED_ENTITIES_TITLE}
          </h2>
          <ul className="flex flex-col gap-1">
            {model.unsupportedEntityKinds.map((entity) => (
              <li className="font-mono text-[12px] tabular-nums text-text-muted" key={entity.id}>
                {entity.kind}
                {ENTITY_KIND_SEPARATOR}
                {entity.count}
              </li>
            ))}
          </ul>
        </section>
      )}

      {model.state === 'loading' && (
        <div aria-label={LOADING_ARIA_LABEL} className="px-4 pb-3" role="status">
          <Skeleton className="h-40 w-full" preset="canvas" />
        </div>
      )}

      {isHandoffOpen && (
        <CadBranchHandoff
          isCadChoiceDisabled={model.dialog.isCadChoiceDisabled}
          onChooseBranch={actions.onChooseBranch}
        />
      )}

      {isStageTwoOpen && model.preview !== null && (
        <section
          aria-label={STAGE_TWO_ARIA_LABEL}
          className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4"
        >
          <div className="flex items-center justify-end">
            <Button onClick={actions.onToggleMappingPanelCollapsed} size="sm" variant="ghost">
              {model.isMappingPanelCollapsed ? EXPAND_PANEL_LABEL : COLLAPSE_PANEL_LABEL}
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
            {!model.isMappingPanelCollapsed && model.mapping !== null && (
              <div className="flex flex-col gap-3">
                <CadLayerMappingPanel actions={actions} model={model.mapping} />
                {model.importOptions !== null && (
                  <CadImportOptions actions={actions} model={model.importOptions} />
                )}
              </div>
            )}

            <CadLayerPreviewCanvas actions={actions} model={model.preview} />
          </div>
        </section>
      )}

      {isStageTwoOpen && model.summary !== null && model.state !== 'forbidden' && (
        <CadMappingSummaryBar
          canImportGeometry={model.canImportGeometry}
          isImporting={model.isImporting}
          onImportGeometry={actions.onImportGeometry}
          prefersReducedMotion={model.prefersReducedMotion}
          summary={model.summary}
        />
      )}

      <CadBranchConfirmDialog actions={actions} model={model.dialog} />
    </div>
  );
}
