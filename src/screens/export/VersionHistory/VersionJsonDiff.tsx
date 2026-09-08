/**
 * Tab "JSON" — diff theo dòng của bản ghi thô.
 *
 * Tab này đứng SAU tab "Thay đổi" và không bao giờ được đổi chỗ: đặc tả cấm tuyệt đối việc
 * cho người đọc thấy JSON thô trước khi thấy một câu tiếng thường mô tả đúng thay đổi ấy.
 * JSON ở đây là bằng chứng để tra lại, không phải cách kể chuyện.
 *
 * Dòng ngữ cảnh (`line.tone === null`) KHÔNG tô nền — chỉ ba loại thay đổi mới có nền, và
 * nền đi qua đúng {@link DiffTint} mà tab "Thay đổi" dùng, ở đúng 8%.
 *
 * Khối mã dài cuộn ngang TRONG vùng của chính nó (`overflow-x-auto` + `min-w-max`): trang
 * không bao giờ được cuộn ngang theo một dòng JSON.
 */

import { FileJson } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';

import { DiffTint } from './VersionDiffGroups';
import type { JsonDiffLineModel } from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt tĩnh — khớp `compare.vi.json.fragment`.                     */
/* -------------------------------------------------------------------------- */

const NO_JSON_TITLE = 'Không có dòng nào khác nhau';
const NO_JSON_BODY = 'Bản ghi của hai phiên bản đang chọn trùng nhau từng dòng.';
const JSON_LABEL = 'So sánh bản ghi JSON theo từng dòng';

interface JsonLineProps {
  readonly line: JsonDiffLineModel;
}

function JsonLine({ line }: JsonLineProps) {
  return (
    <li className="relative px-3 py-[1px]">
      {line.tone === null ? null : <DiffTint tone={line.tone} />}
      <code className="relative block whitespace-pre text-[13px] leading-5 text-text-primary">
        {line.text}
      </code>
    </li>
  );
}

export interface VersionJsonDiffProps {
  readonly lines: readonly JsonDiffLineModel[];
}

export function VersionJsonDiff({ lines }: VersionJsonDiffProps) {
  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<FileJson className="text-text-tertiary" />}
        title={NO_JSON_TITLE}
        description={NO_JSON_BODY}
      />
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-md border border-border-default bg-bg-sunken py-2 font-mono"
      aria-label={JSON_LABEL}
      role="group"
    >
      <ol className="min-w-max">
        {lines.map((line) => (
          <JsonLine key={line.id} line={line} />
        ))}
      </ol>
    </div>
  );
}
