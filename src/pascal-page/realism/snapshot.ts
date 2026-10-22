/**
 * Thẻ R3S: "Chụp ảnh nhanh" chất lượng cao.
 *
 * Bật "Chất lượng cao" trong thanh chụp (snapshot-capture-overlay) → ảnh được vẽ
 * HQ_FRAMES lần, mỗi lần camera dời một phần pixel (dãy Halton 2,3 qua
 * `setViewOffset`), SSGI ở mức high, rồi lấy trung bình các khung → khử răng cưa
 * + nhiễu SSGI; xuất PNG. Chế độ thường không đi qua đây (1 khung + FXAA, webp).
 *
 * Mọi lần vẽ chạy ĐỒNG BỘ trong cùng một tác vụ (mỗi khung một render target
 * riêng): lời gọi `atCaptureSize`/`captureSnapshotScene` của vendor trả canvas
 * và trạng thái cảnh ngay sau phần đồng bộ của `capture`. Đọc ngược GPU làm sau.
 * Không nhập three: kiểu tối thiểu (duck typing) để vitest chạy thuần.
 */
import { create } from 'zustand'

export const HQ_FRAMES = 8
/** SSGI mức high (chế độ thường dùng SSGI_PARAMS của vendor: 2 lát × 8 bước). */
export const HQ_SSGI = { sliceCount: 3, stepCount: 16 }

export const useSnapshotHq = create<{ hq: boolean; setHq: (hq: boolean) => void }>((set) => ({
  hq: false,
  setHq: (hq) => set({ hq }),
}))

function halton(index: number, base: number): number {
  let f = 1
  let r = 0
  for (let i = index; i > 0; i = Math.floor(i / base)) {
    f /= base
    r += f * (i % base)
  }
  return r
}

/** n độ dời sub-pixel trong [-0.5, 0.5), Halton(2,3) bắt đầu từ chỉ số 1. */
export function jitterOffsets(n: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => [halton(i + 1, 2) - 0.5, halton(i + 1, 3) - 0.5])
}

/** Trung bình từng byte của các khung cùng kích thước (giữ nguyên bố cục, kể cả đệm hàng). */
export function averageFrames(frames: Uint8Array[]): Uint8Array {
  const len = frames[0]?.length ?? 0
  const sum = new Uint32Array(len)
  for (const f of frames) for (let i = 0; i < len; i++) sum[i] += f[i]!
  const out = new Uint8Array(len)
  const n = frames.length
  for (let i = 0; i < len; i++) out[i] = Math.round(sum[i]! / n)
  return out
}

type ViewCamera = {
  view: {
    enabled: boolean
    fullWidth: number
    fullHeight: number
    offsetX: number
    offsetY: number
    width: number
    height: number
  } | null
  setViewOffset(fw: number, fh: number, x: number, y: number, w: number, h: number): void
  clearViewOffset(): void
}

/**
 * Gọi `each(i)` với camera dời theo `offsets[i]` (đơn vị pixel ảnh ra `width×height`),
 * rồi trả camera về như cũ (kể cả khi đang có view offset của ô tile).
 */
export function withJitter(
  camera: ViewCamera,
  width: number,
  height: number,
  offsets: [number, number][],
  each: (i: number) => void,
): void {
  const v = camera.view?.enabled ? { ...camera.view } : null
  try {
    offsets.forEach(([dx, dy], i) => {
      if (v) {
        camera.setViewOffset(
          v.fullWidth,
          v.fullHeight,
          v.offsetX + (dx * v.width) / width,
          v.offsetY + (dy * v.height) / height,
          v.width,
          v.height,
        )
      } else camera.setViewOffset(width, height, dx, dy, width, height)
      each(i)
    })
  } finally {
    if (v) camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height)
    else camera.clearViewOffset()
  }
}

type Target = { clone(): Target; dispose(): void }
type Uniform = { value: number }

/**
 * Vẽ HQ_FRAMES khung rung vào các render target riêng (đồng bộ), trả Promise các
 * pixel trung bình cùng bố cục `readRenderTargetPixelsAsync` của `renderTarget`.
 */
export function captureHq({
  renderer,
  camera,
  giPass,
  renderTarget,
  width,
  height,
  render,
  frames = HQ_FRAMES,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: WebGPURenderer của vendor
  renderer: any
  camera: ViewCamera
  giPass: { sliceCount: Uniform; stepCount: Uniform }
  renderTarget: Target
  width: number
  height: number
  render: () => void
  frames?: number
}): Promise<Uint8Array> {
  const t0 = performance.now()
  const targets = [renderTarget, ...Array.from({ length: frames - 1 }, () => renderTarget.clone())]
  const saved = [giPass.sliceCount.value, giPass.stepCount.value]
  giPass.sliceCount.value = HQ_SSGI.sliceCount
  giPass.stepCount.value = HQ_SSGI.stepCount
  try {
    withJitter(camera, width, height, jitterOffsets(frames), (i) => {
      // scenePass chỉ vẽ lại khi node frame tiến (xem advanceNodeFrame của thumbnail-generator)
      renderer._nodes?.nodeFrame?.update?.()
      renderer.setRenderTarget(targets[i])
      try {
        render()
      } finally {
        renderer.setRenderTarget(null)
      }
    })
  } finally {
    giPass.sliceCount.value = saved[0]!
    giPass.stepCount.value = saved[1]!
  }
  return (async () => {
    const pixels: Uint8Array[] = []
    try {
      for (const t of targets) {
        pixels.push(await renderer.readRenderTargetPixelsAsync(t, 0, 0, width, height))
      }
    } finally {
      for (const t of targets.slice(1)) t.dispose()
    }
    const out = averageFrames(pixels)
    lastHqCaptureMs = Math.round(performance.now() - t0)
    ;(globalThis as { __r3sLastMs?: number }).__r3sLastMs = lastHqCaptureMs
    return out
  })()
}

/** Thời gian (ms) vẽ + đọc ngược của lần chụp HQ gần nhất — cho đo đạc. */
export let lastHqCaptureMs = 0

/** Nơi lưu dự phòng cho ảnh HQ khi trang không truyền `onThumbnailCapture`: tải file về máy. */
export function downloadSnapshot(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `anh-chup-${new Date().toISOString().replace(/[:.]/g, '-')}.${blob.type === 'image/png' ? 'png' : 'webp'}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
