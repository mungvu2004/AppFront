/**
 * Thẻ R3S: "Chụp ảnh nhanh" chất lượng cao (PNG, tích luỹ khung rung sub-pixel,
 * SSGI mức high). Logic ở src/pascal-page/realism/snapshot.ts (alias @pascal-realism).
 * - overlay: nút "Chất lượng cao" cạnh Viewport/Area, gửi `hq` trong sự kiện chụp
 *   (không áp cho preset — ảnh preset cần nền trong suốt, giữ đường cũ).
 * - thumbnail-generator: chuyển `hq` vào `pipeline.capture` của đường chụp thường
 *   (đường tile/ảnh sheet không đổi).
 * - snapshot-pipeline: `hq` → captureHq thay một lần vẽ; encodeCapture nhận pixel sẵn.
 * Không có `hq` → mã y như vendor.
 */
const IMPORT = "import { captureHq, useSnapshotHq } from '@pascal-realism/snapshot'\n";

export const RULES = {
  'editor/src/components/editor/snapshot-capture-overlay.tsx': [
    ["\nimport { isOverlaySnapshotSave } from './snapshot-capture'", "\nimport { isOverlaySnapshotSave } from './snapshot-capture'\n" + IMPORT.trimEnd()],
    ['\n  const handleCapture = useCallback(() => {', '\n  const realismHq = useSnapshotHq((s) => s.hq)\n  const setRealismHq = useSnapshotHq((s) => s.setHq)\n  const handleCapture = useCallback(() => {'],
    [
      '\n      transparent: isPreset,\n    })\n  }, [captureState, mode, drag, projectId, isPreset, standardAspect])',
      '\n      transparent: isPreset,\n      hq: realismHq && !isPreset,\n    })\n  }, [captureState, mode, drag, projectId, isPreset, standardAspect, realismHq])',
    ],
    [
      '\n            {isMobile && (\n              <span className="px-2 text-white/50 text-xs tabular-nums">',
      '\n            {!isPreset && (\n              <ModeButton\n                active={realismHq}\n                icon={<span className="font-mono text-[10px]">HQ</span>}\n                label={isMobile ? undefined : \'Chất lượng cao\'}\n                onClick={() => setRealismHq(!realismHq)}\n              />\n            )}\n            {isMobile && (\n              <span className="px-2 text-white/50 text-xs tabular-nums">',
    ],
  ],
  'editor/src/components/editor/thumbnail-generator.tsx': [
    ["\nimport { useCallback, useEffect, useRef } from 'react'", "\nimport { useCallback, useEffect, useRef } from 'react'\nimport { downloadSnapshot } from '@pascal-realism/snapshot'"],
    // Trang 3D của app không truyền onThumbnailCapture -> ảnh HQ tải về máy; ảnh thường giữ lỗi cũ.
    [
      "\n          const onCapture = onThumbnailCaptureRef.current\n",
      "\n          const onCapture = onThumbnailCaptureRef.current ?? ((event as { hq?: boolean }).hq === true ? downloadSnapshot : undefined)\n",
    ],
    [
      'pipeline.capture({ captureMode, cropRegion, standardSize: encodeSize, mime }),',
      'pipeline.capture({ captureMode, cropRegion, standardSize: encodeSize, mime, hq: (event as { hq?: boolean }).hq === true }),',
    ],
  ],
  'viewer/src/lib/snapshot-pipeline.ts': [
    ["\nimport { packNormalToRGB, unpackRGBToNormal } from './tsl-compat'", "\nimport { packNormalToRGB, unpackRGBToNormal } from './tsl-compat'\n" + IMPORT.trimEnd()],
    // kiểu của capture trong SnapshotPipeline
    [
      '\n    mime?: string\n  }) => Promise<SnapshotCaptureResult>',
      '\n    mime?: string\n    /** R3S: tích luỹ khung rung + SSGI high, xuất PNG. */\n    hq?: boolean\n  }) => Promise<SnapshotCaptureResult>',
    ],
    [
      '\n      capture: async ({ captureMode, cropRegion, standardSize, mime }) => {',
      '\n      capture: async ({ captureMode, cropRegion, standardSize, mime, hq }) => {',
    ],
    [
      '\n        try {\n          renderer.setRenderTarget(renderTarget)\n          pipeline.render()\n        } finally {\n          renderer.setRenderTarget(null)\n        }\n',
      '\n        const hqPixels = hq\n          ? captureHq({ renderer, camera: camera as any, giPass: giPass as any, renderTarget: renderTarget as any, width: captureWidth, height: captureHeight, render: () => pipeline.render() })\n          : undefined\n        if (!hqPixels) {\n        try {\n          renderer.setRenderTarget(renderTarget)\n          pipeline.render()\n        } finally {\n          renderer.setRenderTarget(null)\n        }\n        }\n',
    ],
    [
      '\n          standardH,\n          mime,\n        })\n      },\n      dispose: () => {\n        pipeline.dispose()',
      "\n          standardH,\n          mime: hqPixels ? 'image/png' : mime,\n          pixels: hqPixels ? await hqPixels : undefined,\n        })\n      },\n      dispose: () => {\n        pipeline.dispose()",
    ],
    // encodeCapture nhận pixel đã tích luỹ (cùng bố cục readRenderTargetPixelsAsync)
    [
      '\n    mime,\n  }: {\n    captureMode?: SnapshotCaptureMode\n    cropRegion?: SnapshotCropRegion\n    standardW: number\n    standardH: number\n    mime?: string\n  },\n): Promise<SnapshotCaptureResult> {',
      '\n    mime,\n    pixels: readyPixels,\n  }: {\n    captureMode?: SnapshotCaptureMode\n    cropRegion?: SnapshotCropRegion\n    standardW: number\n    standardH: number\n    mime?: string\n    pixels?: Uint8Array\n  },\n): Promise<SnapshotCaptureResult> {',
    ],
    [
      '\n  const pixels = (await (renderer as any).readRenderTargetPixelsAsync(',
      '\n  const pixels = readyPixels ?? (await (renderer as any).readRenderTargetPixelsAsync(',
    ],
  ],
};
