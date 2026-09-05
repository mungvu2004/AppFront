/**
 * The panel's head: object kind, mono object code, status badge, template
 * and close actions — plus the thumbnail strip immediately below it.
 */
import { Copy, X } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';

import {
  PROPERTY_INSPECTOR_LAYOUT,
  type PropertyInspectorHeader as PropertyInspectorHeaderData,
  type PropertyThumbnail,
} from './propertyInspectorTypes';

const COPY_AS_TEMPLATE_LABEL = 'Lưu làm khuôn mẫu';
const CLOSE_LABEL = 'Đóng';

export interface PropertyInspectorHeaderProps {
  readonly header: PropertyInspectorHeaderData;
  readonly thumbnails: readonly PropertyThumbnail[];
}

export function PropertyInspectorHeader({ header, thumbnails }: PropertyInspectorHeaderProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-[16px] font-semibold leading-[22px] text-text-primary">
            {header.objectKindLabel}
          </h3>
          <span className="truncate font-mono text-[15px] leading-[20px] text-text-secondary">
            {header.objectCode}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={header.statusBadge.tone}>{header.statusBadge.label}</Badge>
          <IconButton
            icon={<Copy size={18} />}
            aria-label={COPY_AS_TEMPLATE_LABEL}
            size="sm"
            onClick={header.onCopyAsTemplate}
          />
          <IconButton icon={<X size={18} />} aria-label={CLOSE_LABEL} size="sm" onClick={header.onClose} />
        </div>
      </div>

      {thumbnails.length > 0 && (
        <div
          className="mx-5 mb-3 flex items-center gap-2 overflow-x-auto rounded-lg bg-bg-sunken px-2"
          style={{ height: PROPERTY_INSPECTOR_LAYOUT.thumbnailStripHeightPx }}
        >
          {thumbnails.map((thumbnail) => (
            <img
              key={thumbnail.id}
              src={thumbnail.imageUrl}
              alt={thumbnail.altText}
              className="h-12 w-12 shrink-0 rounded-md object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}
