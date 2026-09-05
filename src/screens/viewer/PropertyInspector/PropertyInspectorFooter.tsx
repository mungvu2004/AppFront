/**
 * The panel's foot: "Duyệt" (primary) and "Bỏ qua" (ghost), plus who last
 * edited and when. No save button — A7's autosave already committed
 * whatever is on screen; these two decide what happens to the QC status.
 */
import { Button } from '@/components/ui/Button';

import type { PropertyInspectorFooter as PropertyInspectorFooterData } from './propertyInspectorTypes';

const APPROVE_LABEL = 'Duyệt';
const SKIP_LABEL = 'Bỏ qua';

export interface PropertyInspectorFooterProps {
  readonly footer: PropertyInspectorFooterData;
}

export function PropertyInspectorFooter({ footer }: PropertyInspectorFooterProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-border-default p-5 pt-3">
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={footer.onApprove}>
          {APPROVE_LABEL}
        </Button>
        <Button variant="ghost" onClick={footer.onSkip}>
          {SKIP_LABEL}
        </Button>
      </div>
      <p className="text-[12px] leading-[16px] text-text-muted">{footer.lastEditedCaption}</p>
    </div>
  );
}
