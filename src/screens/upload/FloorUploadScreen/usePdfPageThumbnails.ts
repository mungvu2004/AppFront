import { useEffect, useRef, useState } from 'react';

import type { UploadBranch } from '@/lib/upload';

import type { FloorUploadGateway } from './floorUploadGateway';

/** Trần thân của N41 (`THUMBNAIL_BODY_LIMIT` ở BE, = trần `/api/` của nginx). */
export const PAGE_THUMBNAILS_MAX_BYTES = 8 * 1024 * 1024;

/** Phần của một tệp đã nhận mà việc đọc ảnh nhỏ cần. */
export interface PageThumbnailSource {
  readonly id: string;
  readonly branch: UploadBranch | null;
  readonly file: Blob;
  readonly pageCount: number | null;
}

/** PDF nhiều trang, vừa trần thân: chỉ những tệp này mới có ô chọn trang cần ảnh. */
export function wantsPageThumbnails(source: PageThumbnailSource): boolean {
  return source.branch === 'pdf' && (source.pageCount ?? 0) > 1 && source.file.size <= PAGE_THUMBNAILS_MAX_BYTES;
}

/**
 * Ảnh nhỏ từng trang cho ô "Chọn trang" (UX41 U05), theo mã tệp.
 *
 * Mỗi tệp hỏi máy chủ đúng một lần; lỗi hay tệp quá trần thì không có mục, ô chọn
 * trang giữ danh sách chữ. ponytail: mục của tệp đã gỡ không bị dọn (vài trăm KB mỗi
 * PDF, sống tới khi rời màn); dọn khi người dùng hay thả hàng chục PDF.
 */
export function usePdfPageThumbnails(
  gateway: FloorUploadGateway,
  projectId: string,
  sources: readonly PageThumbnailSource[],
): ReadonlyMap<string, readonly string[]> {
  const [thumbnails, setThumbnails] = useState<ReadonlyMap<string, readonly string[]>>(() => new Map());
  const requestedRef = useRef(new Set<string>());

  useEffect(() => {
    const read = gateway.readPageThumbnails;

    if (read === undefined) {
      return;
    }

    for (const source of sources) {
      if (!wantsPageThumbnails(source) || requestedRef.current.has(source.id)) {
        continue;
      }

      requestedRef.current.add(source.id);
      void read({ file: source.file, projectId }).then((pages) => {
        if (pages.length > 0) {
          setThumbnails((previous) => new Map(previous).set(source.id, pages));
        }
      });
    }
  }, [gateway, projectId, sources]);

  return thumbnails;
}
