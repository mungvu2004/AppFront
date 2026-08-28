/**
 * STUB — cây bước xử lý của màn Xử lý. Nhiệm vụ V5 thay ruột file này; chữ ký
 * giữ nguyên từ `ProcessingStepListProps` (`types.ts`).
 *
 * Bước con (`step.children`) vẽ đệ quy một cấp, thụt vào dưới bước cha — đúng
 * hình dạng đặc tả mô tả ("ba hàng con thụt vào dưới hàng cha"). Chưa vẽ vạch
 * quét thật ở đây (`isScanning`) — khung chỉ giữ chỗ, không glow không gradient
 * (mục [CẤM TUYỆT ĐỐI]) là quyết định của V5, không phải của khung này.
 */

import type { ProcessingStepListProps, ProcessingStepViewModel } from './types';

function StepRow({ step }: { readonly step: ProcessingStepViewModel }) {
  return (
    <li>
      <div>
        <button aria-expanded={step.isDetailOpen} onClick={step.onToggleDetail} type="button">
          {step.name}
        </button>
        <span> — {step.status}</span>
        {step.remainingLabel !== undefined ? <span> · {step.remainingLabel}</span> : null}
      </div>
      {step.isDetailOpen ? (
        <ul>
          {step.detailLabels.map((label, index) => (
            <li key={`${step.id}-detail-${String(index)}`}>{label}</li>
          ))}
        </ul>
      ) : null}
      {step.errorMessage !== undefined ? <p>{step.errorMessage}</p> : null}
      {step.children !== undefined && step.children.length > 0 ? (
        <ul>
          {step.children.map((child) => (
            <StepRow key={child.id} step={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ProcessingStepList({ steps }: ProcessingStepListProps) {
  return (
    <ol aria-label="Các bước xử lý">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </ol>
  );
}
