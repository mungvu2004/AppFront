import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FloorUploadGateway } from './floorUploadGateway';
import {
  PAGE_THUMBNAILS_MAX_BYTES,
  usePdfPageThumbnails,
  wantsPageThumbnails,
  type PageThumbnailSource,
} from './usePdfPageThumbnails';

const PNG = 'data:image/png;base64,AAAA';

const pdf = (id: string, pageCount: number | null, size = 10): PageThumbnailSource => ({
  branch: 'pdf',
  file: new Blob([new Uint8Array(size)], { type: 'application/pdf' }),
  id,
  pageCount,
});

afterEach(cleanup);

describe('wantsPageThumbnails', () => {
  it('chỉ nhận PDF nhiều trang vừa trần thân', () => {
    expect(wantsPageThumbnails(pdf('a', 2))).toBe(true);
    expect(wantsPageThumbnails(pdf('a', 1))).toBe(false);
    expect(wantsPageThumbnails(pdf('a', null))).toBe(false);
    expect(wantsPageThumbnails({ ...pdf('a', 3), branch: 'raster' })).toBe(false);
    expect(wantsPageThumbnails(pdf('a', 3, PAGE_THUMBNAILS_MAX_BYTES + 1))).toBe(false);
  });
});

describe('usePdfPageThumbnails', () => {
  it('hỏi máy chủ một lần cho mỗi PDF nhiều trang và giữ ảnh theo mã tệp', async () => {
    const readPageThumbnails = vi.fn(async () => [PNG, PNG]);
    const gateway = { readPageThumbnails } as unknown as FloorUploadGateway;
    const sources = [pdf('two', 2), pdf('one', 1)];
    const { result, rerender } = renderHook(({ list }) => usePdfPageThumbnails(gateway, 'prj', list), {
      initialProps: { list: sources },
    });

    await waitFor(() => expect(result.current.get('two')).toEqual([PNG, PNG]));
    rerender({ list: [...sources] });

    expect(readPageThumbnails).toHaveBeenCalledTimes(1);
    expect(readPageThumbnails).toHaveBeenCalledWith({ file: sources[0]?.file, projectId: 'prj' });
    expect(result.current.has('one')).toBe(false);
  });

  it('không có ảnh thì không có mục: ô chọn trang giữ danh sách chữ', async () => {
    const readPageThumbnails = vi.fn(async () => []);
    const gateway = { readPageThumbnails } as unknown as FloorUploadGateway;
    const { result } = renderHook(() => usePdfPageThumbnails(gateway, 'prj', [pdf('two', 2)]));

    await waitFor(() => expect(readPageThumbnails).toHaveBeenCalledTimes(1));
    expect(result.current.size).toBe(0);
  });
});
