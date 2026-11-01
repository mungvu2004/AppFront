/**
 * "Một tờ nhiều tầng": người dùng thả MỘT tờ chứa mặt bằng của nhiều tầng, vẽ một khung
 * chữ nhật cho mỗi tầng trên ảnh xem trước, rồi màn tải CÙNG tệp ấy một lần cho mỗi tầng,
 * mỗi lần mang vùng cắt của tầng đó (`crop` của #5). Tầng không có khung thì không tải.
 *
 * Hook chỉ giữ khung và tầng đang chọn; gắn tệp và tải là việc của `onConfirm` (màn tải).
 */

import { useState } from 'react';

import type { DrawingCrop } from '@/api/client';
import { formatNumber } from '@/lib/format/number';

import type { FloorUploadSheetRegionsModel } from './types';

/** Diện tích tối thiểu của một khung, theo tỉ lệ trang — đúng ngưỡng của máy chủ. */
export const MIN_REGION_AREA = 0.01;

export const SHEET_COPY = {
  title: 'Chia tờ theo tầng',
  hint: 'Chọn một tầng rồi kéo trên ảnh để khoanh vùng của tầng đó. Tầng không khoanh sẽ không được tải.',
  close: 'Đóng',
  noRegion: 'Chưa khoanh',
  tooSmall: 'Vùng quá nhỏ',
} as const;

export const confirmLabel = (count: number): string => `Tải lên ${formatNumber(count, { grouping: false })} tầng`;

export interface SheetPoint {
  readonly xRatio: number;
  readonly yRatio: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Hai góc bất kỳ (kéo theo hướng nào cũng được) thành một khung đã kẹp vào trang. */
export function rectFromPoints(a: SheetPoint, b: SheetPoint): DrawingCrop {
  const x0 = clamp01(Math.min(a.xRatio, b.xRatio));
  const y0 = clamp01(Math.min(a.yRatio, b.yRatio));
  const x1 = clamp01(Math.max(a.xRatio, b.xRatio));
  const y1 = clamp01(Math.max(a.yRatio, b.yRatio));

  return { xRatio: x0, yRatio: y0, widthRatio: x1 - x0, heightRatio: y1 - y0 };
}

/** Dời khung, giữ nguyên cỡ và không cho ra khỏi trang. */
export function moveRect(rect: DrawingCrop, dx: number, dy: number): DrawingCrop {
  return {
    ...rect,
    xRatio: Math.min(1 - rect.widthRatio, Math.max(0, rect.xRatio + dx)),
    yRatio: Math.min(1 - rect.heightRatio, Math.max(0, rect.yRatio + dy)),
  };
}

export const isValidRegion = (rect: DrawingCrop): boolean => rect.widthRatio * rect.heightRatio >= MIN_REGION_AREA;

export interface SheetFloor {
  readonly id: string;
  readonly name: string;
}

export interface SheetUpload {
  readonly floorId: string;
  readonly crop: DrawingCrop;
}

export interface UseSheetRegionsOptions {
  readonly floors: readonly SheetFloor[];
  /** Ảnh của tệp đang mở (blob URL của ảnh, ảnh nhỏ của trang PDF đã chọn); `null` = chưa có. */
  readonly previewUrlFor: (fileId: string) => string | null;
  /** Gắn cùng tệp vào từng tầng và tải, mỗi tầng một vùng. */
  readonly onConfirm: (fileId: string, uploads: readonly SheetUpload[]) => void;
}

export interface SheetRegions {
  readonly model: FloorUploadSheetRegionsModel | null;
  readonly open: (fileId: string) => void;
  readonly close: () => void;
  readonly selectFloor: (floorId: string) => void;
  readonly setRegion: (floorId: string, rect: DrawingCrop) => void;
  readonly confirm: () => void;
}

/** Các tầng có khung hợp lệ, theo thứ tự tầng. */
export function uploadsOf(
  floors: readonly SheetFloor[],
  regions: ReadonlyMap<string, DrawingCrop>,
): readonly SheetUpload[] {
  return floors.flatMap((floor) => {
    const crop = regions.get(floor.id);

    return crop !== undefined && isValidRegion(crop) ? [{ floorId: floor.id, crop }] : [];
  });
}

export function useSheetRegions(options: UseSheetRegionsOptions): SheetRegions {
  const { floors } = options;
  const [fileId, setFileId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [regions, setRegions] = useState<ReadonlyMap<string, DrawingCrop>>(new Map());

  const close = (): void => {
    setFileId(null);
    setRegions(new Map());
    setSelectedFloorId(null);
  };

  const uploads = uploadsOf(floors, regions);
  const previewUrl = fileId === null ? null : options.previewUrlFor(fileId);

  return {
    model:
      fileId === null || previewUrl === null
        ? null
        : {
            title: SHEET_COPY.title,
            hint: SHEET_COPY.hint,
            closeLabel: SHEET_COPY.close,
            previewUrl,
            selectedFloorId,
            confirmLabel: confirmLabel(uploads.length),
            canConfirm: uploads.length > 0,
            floors: floors.map((floor) => {
              const rect = regions.get(floor.id) ?? null;

              return {
                floorId: floor.id,
                name: floor.name,
                rect,
                note: rect === null ? SHEET_COPY.noRegion : isValidRegion(rect) ? null : SHEET_COPY.tooSmall,
              };
            }),
          },
    open: (id) => {
      setFileId(id);
      setRegions(new Map());
      setSelectedFloorId(floors[0]?.id ?? null);
    },
    close,
    selectFloor: setSelectedFloorId,
    setRegion: (floorId, rect) => {
      setRegions((previous) => new Map(previous).set(floorId, rect));
    },
    confirm: () => {
      if (fileId === null || uploads.length === 0) return;
      options.onConfirm(fileId, uploads);
      close();
    },
  };
}
