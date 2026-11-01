import { useEffect, useMemo, useRef, useState } from 'react';

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

/**
 * PDF vừa trần thân, có từ `minPages` trang: mặc định 2 (ô chọn trang cần ảnh); 1 khi dự án
 * có từ hai tầng — tờ một trang là trường hợp chính của "một tờ nhiều tầng", cần ảnh để khoanh.
 */
export function wantsPageThumbnails(source: PageThumbnailSource, minPages = 2): boolean {
  return (
    source.branch === 'pdf' && (source.pageCount ?? 0) >= minPages && source.file.size <= PAGE_THUMBNAILS_MAX_BYTES
  );
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
  minPages = 2,
): ReadonlyMap<string, readonly string[]> {
  // Theo đối tượng tệp, không theo mã: các bản gắn của cùng một tờ (mỗi tầng một bản) dùng
  // chung một lượt hỏi máy chủ.
  const [byFile, setByFile] = useState<ReadonlyMap<Blob, readonly string[]>>(() => new Map());
  const requestedRef = useRef(new WeakSet<Blob>());

  useEffect(() => {
    const read = gateway.readPageThumbnails;

    if (read === undefined) {
      return;
    }

    for (const source of sources) {
      if (!wantsPageThumbnails(source, minPages) || requestedRef.current.has(source.file)) {
        continue;
      }

      requestedRef.current.add(source.file);
      void read({ file: source.file, projectId }).then((pages) => {
        if (pages.length > 0) {
          setByFile((previous) => new Map(previous).set(source.file, pages));
        }
      });
    }
  }, [gateway, minPages, projectId, sources]);

  return useMemo(() => {
    const byId = new Map<string, readonly string[]>();

    for (const source of sources) {
      const pages = byFile.get(source.file);
      if (pages !== undefined) byId.set(source.id, pages);
    }

    return byId;
  }, [byFile, sources]);
}
