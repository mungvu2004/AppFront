/**
 * Cột phải của Cổng chất lượng đầu vào — chỉ số đo, dự báo, danh sách phát
 * hiện và danh sách tầng.
 *
 * Khung tối thiểu do người viết `InputQualityGate.tsx` dựng. Toàn bộ nội dung
 * (thẻ chỉ số, danh sách phát hiện có hành động sửa nhanh, hàng tầng) do lớp
 * Layer 2 phụ trách panel báo cáo thay thế.
 */

import type { InputQualityReportPanelProps } from './types';

export function InputQualityGateReportPanel({ forecast, metrics }: InputQualityReportPanelProps) {
  return (
    <section aria-label="Báo cáo chất lượng" className="flex h-full flex-col gap-3">
      <p className="text-[13px] text-text-secondary">{forecast.text}</p>
      <ul className="flex flex-col gap-2">
        {metrics.map((metric) => (
          <li key={metric.id}>{metric.label}</li>
        ))}
      </ul>
    </section>
  );
}
