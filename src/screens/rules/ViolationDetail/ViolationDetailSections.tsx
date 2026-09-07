/**
 * Năm khối chữ của tấm trượt chi tiết vi phạm, cộng một bảng màu mức.
 *
 * Chúng ở đây chứ không ở `ViolationDetail.tsx` vì trần R-22 là 400 dòng có nội dung và
 * file chính còn phải giữ vỏ tấm trượt, bảy trạng thái và phần đầu. Mỗi hàm dưới đây là
 * một khối của đặc tả, nhận đúng phần props nó cần và không nhận gì thêm.
 *
 * View thuần y như file chính: không `@/api`, không `@/store`, không `@/domain`, không
 * `@/lib/http`, và mọi con số tới nơi đã là chuỗi (A15).
 *
 * ## Giọng
 *
 * "Không giọng điệu phê phán" là một lệnh cấm tuyệt đối, và nó tốn nhiều công hơn vẻ
 * ngoài. Nó không chỉ có nghĩa là tránh chữ "sai" — nó có nghĩa là không có băng đỏ trên
 * đầu tấm trượt, không có biểu tượng báo động cạnh câu luật, không có màu vi phạm nào
 * ngoài đúng một `Badge` mức ở khối 1 và đúng một đường viền ở khối hình. Người đọc màn
 * này vừa được báo rằng bản vẽ của họ có lỗi; việc của tấm trượt là chỉ chỗ, không phải
 * nhấn mạnh.
 */

import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/Badge';

import type { ViolationDetailViewProps } from './types';

/** Mức nghiêm trọng, đọc ngược từ props — thư mục này không nêu tên `@/domain`. */
type RuleSeverity = NonNullable<ViolationDetailViewProps['severity']>;

/** Các biến thể `Badge` nhận, viết ra để file này không cần nhập giá trị nào. */
type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';

/**
 * Vòng tiêu điểm dùng chung cho mọi thứ bấm được trong tấm trượt.
 *
 * Bàn phím là đường đi hạng nhất (A12), nên mọi liên kết chữ đều và mọi hàng lựa chọn
 * phải nhìn thấy được khi tới bằng Tab, không chỉ khi trỏ chuột vào.
 */
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

/**
 * Chỗ duy nhất màu vi phạm được phép xuất hiện trong phần chữ.
 *
 * `critical` mang chip đỏ, `warning` mang chip hổ phách, `suggestion` mang chip trung
 * tính — một gợi ý không phải một cảnh báo, và cho nó màu cảnh báo là nói quá. Mức thật
 * của nó vẫn đọc được bằng chữ, từ `severityLabel` mà hook đưa xuống.
 * Gương của `SEVERITY_BADGE` ở `../RuleReport/RuleReportLabels.tsx`.
 */
const SEVERITY_BADGE: Readonly<Record<RuleSeverity, BadgeVariant>> = {
  critical: 'violation',
  warning: 'attention',
  suggestion: 'neutral',
};

interface SeverityBadgeProps {
  readonly severity: RuleSeverity | null;
  readonly severityLabel: string;
}

/**
 * Chip mức, hoặc không có chip nào.
 *
 * Bảng {@link SEVERITY_BADGE} ở lại trong file này thay vì đi ra ngoài: một file `.tsx`
 * vừa xuất component vừa xuất hằng số là thứ `react-refresh/only-export-components` bắt,
 * và nhãn cảnh báo cũng là lỗi ở repo này. Nên thứ đi ra ngoài là component, không phải
 * bảng — điều đó cũng đúng hơn về mặt trách nhiệm: chỗ gọi cần một chip, không cần biết
 * ba mức ánh xạ sang biến thể nào.
 */
export function ViolationSeverityBadge({ severity, severityLabel }: SeverityBadgeProps) {
  if (severity === null) {
    return null;
  }

  return <Badge variant={SEVERITY_BADGE[severity]}>{severityLabel}</Badge>;
}

/* -------------------------------------------------------------------------- */
/* Khối 2 — "Luật".                                                            */
/* -------------------------------------------------------------------------- */

interface RuleSentenceProps {
  readonly ruleSentence: string;
  readonly diagram: ReactNode;
}

/**
 * Luật, một câu thường, trong khối `--bg-sunken` bo 12.
 *
 * Câu này tới nguyên văn từ `Rule.name` của tầng luật. Đặc tả cấm tự viết căn cứ luật,
 * nên file này không được phép diễn đạt lại nó, rút gọn nó, hay thêm vào nó một mệnh đề
 * giải thích. Nó in ra đúng chuỗi đã nhận.
 *
 * Khối 3 của đặc tả — "số đo so với ngưỡng" — KHÔNG có ở đây và không có ở đâu trong
 * thư mục này. `canCompareMeasure` là `false` vì `Violation` của tầng luật không mang số
 * đo được; hai con số vốn đã nằm trong câu vi phạm ở khối 1 dưới dạng chữ. Phán quyết
 * G1: khối ấy biến khỏi DOM, không để lại ô trống và không để lại ghi chú "sắp có".
 */
export function ViolationRuleSection({ diagram, ruleSentence }: RuleSentenceProps) {
  return (
    <section aria-labelledby="violation-rule-heading" className="flex flex-col gap-2">
      <h3 className="text-[13px] text-text-muted" id="violation-rule-heading">
        Luật
      </h3>

      <div className="flex items-start gap-3 rounded-[12px] bg-bg-sunken p-3">
        {diagram}
        <p className="text-sm text-text-primary">{ruleSentence}</p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Khối 4 — "Phát hiện".                                                       */
/* -------------------------------------------------------------------------- */

interface FindingsProps {
  readonly objects: ViolationDetailViewProps['objects'];
  readonly canShowConfidence: boolean;
  readonly onSelectObject: (entityId: string) => void;
}

/**
 * Các đối tượng dính tới vi phạm, mỗi cái là một liên kết chữ đều bấm được.
 *
 * Bấm vào một mã là khuôn camera tới nó và tô sáng nó — việc đó do `onSelectObject` làm,
 * ở hook. Mã đối tượng là mã, nên nó viết chữ đều và giữ nguyên chữ hoa: A6 dành ngoại
 * lệ chữ hoa cho đúng loại chuỗi này.
 *
 * Độ tin cậy chỉ hiện khi `canShowConfidence` bật VÀ thực thể mang nó. Một thực thể
 * không qua bước nhận diện tự động thì không có độ tin cậy nào để nói, và in "—" vào đó
 * là dựng một ô trống mà bảng năng lực vốn để chặn.
 */
export function ViolationFindingsSection({
  canShowConfidence,
  objects,
  onSelectObject,
}: FindingsProps) {
  if (objects.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="violation-findings-heading" className="flex flex-col gap-2">
      <h3 className="text-[13px] text-text-muted" id="violation-findings-heading">
        Phát hiện
      </h3>

      <ul className="flex flex-col gap-1">
        {objects.map((object) => (
          <li key={object.entityId}>
            <button
              className={`flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-bg-sunken ${FOCUS_RING}`}
              onClick={() => {
                onSelectObject(object.entityId);
              }}
              type="button"
            >
              <span className="font-mono text-[13px] text-accent underline">{object.entityId}</span>
              <span className="text-[13px] text-text-secondary">{object.kindLabel}</span>

              {canShowConfidence && object.confidenceLabel !== null ? (
                <span className="ml-auto text-[13px] text-text-muted">
                  độ tin cậy {object.confidenceLabel}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Khối 6 — "Nguyên nhân có thể".                                              */
/* -------------------------------------------------------------------------- */

interface CausesProps {
  readonly causes: ViolationDetailViewProps['causes'];
}

/**
 * Các giả thuyết về nguyên nhân, xếp theo khả năng, luôn từ hai trở lên.
 *
 * "Luôn ≥ 2" là ràng buộc của tầng logic, không phải của view: hook suy giả thuyết từ
 * tín hiệu thật (độ tin cậy, nhóm luật, loại thực thể) và đảm bảo số lượng. View in ra
 * những gì nhận được theo đúng thứ tự nhận được — chèn thêm một giả thuyết ở đây để cho
 * đủ hai là bịa, và bịa là đúng thứ phán quyết G2 cấm.
 */
export function ViolationCausesSection({ causes }: CausesProps) {
  if (causes.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="violation-causes-heading" className="flex flex-col gap-2">
      <h3 className="text-[13px] text-text-muted" id="violation-causes-heading">
        Nguyên nhân có thể
      </h3>

      <ol className="flex list-inside list-decimal flex-col gap-1">
        {causes.map((cause) => (
          <li className="text-sm text-text-secondary" key={cause.id}>
            {cause.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Khối 7 — "Lựa chọn xử lý".                                                  */
/* -------------------------------------------------------------------------- */

interface ActionsProps {
  readonly actions: ViolationDetailViewProps['actions'];
  readonly onAction: ViolationDetailViewProps['onAction'];
  readonly onActionHover: ViolationDetailViewProps['onActionHover'];
}

/**
 * Các cách xử lý, mỗi cách một hàng tràn chiều rộng kèm một câu hậu quả.
 *
 * Trỏ vào một hàng — hoặc tới nó bằng Tab, thứ phải tương đương — bật xem trước hậu quả
 * trên khối hình: `onActionHover(kind)` báo cho hook biết hàng nào đang được cân nhắc,
 * hook bật `isDimmed` cho các đối tượng sẽ mất. Rời khỏi hàng thì tắt. Đây là lý do
 * `onMouseLeave` và `onBlur` đều gọi `onActionHover(null)`: bỏ một trong hai là để lại
 * một hình xem trước dính lại sau khi người dùng đã đi chỗ khác.
 *
 * Hàng "bỏ qua kèm lý do" sẽ không bao giờ tới đây. `canDismiss` là `false` — không một
 * slice nào của store có trạng thái bỏ qua, xác nhận bằng grep hai lượt — nên gateway
 * không phát ra hàng ấy và view không dựng ô ghi lý do. Phán quyết G3. `dismissReason`,
 * `onDismissReasonChange` và `dismissReasonError` vẫn nằm trong `types.ts` để khi tầng
 * logic có trạng thái ấy thì việc phải làm ở đây là bật một chữ `false` ở gateway.
 */
export function ViolationActionsSection({ actions, onAction, onActionHover }: ActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="violation-actions-heading" className="flex flex-col gap-2">
      <h3 className="text-[13px] text-text-muted" id="violation-actions-heading">
        Lựa chọn xử lý
      </h3>

      <ul className="flex flex-col gap-2">
        {actions.map((action) => (
          <li key={action.kind}>
            <button
              className={`flex w-full flex-col items-start gap-0.5 rounded-[8px] border border-border-default bg-bg-surface p-3 text-left transition-colors duration-120 hover:border-accent ${FOCUS_RING}`}
              onBlur={() => {
                onActionHover(null);
              }}
              onClick={() => {
                onAction(action.kind);
              }}
              onFocus={() => {
                onActionHover(action.kind);
              }}
              onMouseEnter={() => {
                onActionHover(action.kind);
              }}
              onMouseLeave={() => {
                onActionHover(null);
              }}
              type="button"
            >
              <span className="text-sm font-medium text-text-primary">{action.label}</span>
              <span className="text-[13px] text-text-secondary">{action.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Khối 8 — chân.                                                              */
/* -------------------------------------------------------------------------- */

interface FooterProps {
  readonly ruleCode: ViolationDetailViewProps['ruleCode'];
  readonly levelId: ViolationDetailViewProps['levelId'];
}

/**
 * Mã luật và mã tầng, chữ đều, cỡ nhỏ, để tra cứu.
 *
 * Đây là dòng người dùng chép vào một email khi hỏi lại người ra luật, nên nó phải chọn
 * được bằng chuột và phải giữ nguyên chữ hoa của mã. Không mã nào thì không có chân —
 * một dòng chân rỗng là một dòng chân sai.
 */
export function ViolationFooterSection({ levelId, ruleCode }: FooterProps) {
  if (ruleCode === null && levelId === null) {
    return null;
  }

  return (
    <footer className="border-t border-border-default pt-3">
      <p className="font-mono text-[12px] text-text-muted">
        {ruleCode === null ? null : <span>{ruleCode}</span>}
        {ruleCode !== null && levelId !== null ? <span> · </span> : null}
        {levelId === null ? null : <span>{levelId}</span>}
      </p>
    </footer>
  );
}
