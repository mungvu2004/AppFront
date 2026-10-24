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

// F2: 8 -> 4 khung (đọc ngược song song) để rút thời gian chụp.
export const HQ_FRAMES = 4
/** SSGI mức high (chế độ thường dùng SSGI_PARAMS của vendor: 2 lát × 8 bước). */
export const HQ_SSGI = { sliceCount: 3, stepCount: 16 }

const HQ_KEY = 'appfront.pascal.snapshot-hq'

function readHq(): boolean {
  try {
    return localStorage.getItem(HQ_KEY) === '1'
  } catch {
    return false
  }
}

/** Lựa chọn HQ nhớ qua lần tải trang (localStorage; lỗi -> chỉ nhớ trong phiên). */
export const useSnapshotHq = create<{ hq: boolean; setHq: (hq: boolean) => void }>((set) => ({
  hq: readHq(),
  setHq: (hq) => {
    try {
      localStorage.setItem(HQ_KEY, hq ? '1' : '0')
    } catch {
      // private mode: nhớ trong phiên thôi
    }
    set({ hq })
  },
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
  for (const f of frames) for (let i = 0; i < len; i++) sum[i] = sum[i]! + f[i]!
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
  const frameMs: number[] = []
  try {
    withJitter(camera, width, height, jitterOffsets(frames), (i) => {
      const tf = performance.now()
      // scenePass chỉ vẽ lại khi node frame tiến (xem advanceNodeFrame của thumbnail-generator)
      renderer._nodes?.nodeFrame?.update?.()
      renderer.setRenderTarget(targets[i])
      try {
        render()
      } finally {
        renderer.setRenderTarget(null)
      }
      frameMs.push(Math.round(performance.now() - tf))
    })
  } finally {
    giPass.sliceCount.value = saved[0]!
    giPass.stepCount.value = saved[1]!
  }
  const tSubmit = performance.now()
  return (async () => {
    let pixels: Uint8Array[]
    try {
      pixels = await Promise.all(
        targets.map((t) => renderer.readRenderTargetPixelsAsync(t, 0, 0, width, height) as Promise<Uint8Array>),
      )
    } finally {
      for (const t of targets.slice(1)) t.dispose()
    }
    const tRead = performance.now()
    const out = averageFrames(pixels)
    const tEnd = performance.now()
    lastHqCaptureMs = Math.round(tEnd - t0)
    // đo đạc (F2b): khung 0 đồng bộ ~ biên dịch shader/pipeline; readback gồm cả thời gian GPU vẽ
    const g = globalThis as { __r3sLastMs?: number; __r3sTimings?: unknown }
    g.__r3sLastMs = lastHqCaptureMs
    g.__r3sTimings = {
      frameSyncMs: frameMs,
      readbackMs: Math.round(tRead - tSubmit),
      averageMs: Math.round(tEnd - tRead),
      doneAt: tEnd,
    }
    return out
  })()
}

/** Thời gian (ms) vẽ + đọc ngược của lần chụp HQ gần nhất — cho đo đạc. */
export let lastHqCaptureMs = 0

/** `<tên dự án>-<yyyyMMdd-HHmm>.webp|png` (giờ máy); ký tự cấm trong tên file -> '-'. */
export function snapshotFileName(projectName: string | null | undefined, type: string, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`
  const base = (projectName ?? '').replace(/[\/:*?"<>|\u0000-\u001f]+/g, '-').trim() || 'anh-chup'
  return `${base}-${stamp}.${type === 'image/png' ? 'png' : 'webp'}`
}

/** Trang 3D không có API lưu snapshot: ảnh chụp (thường lẫn HQ) tải file về máy. */
export function downloadSnapshot(blob: Blob, projectName?: string | null): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = snapshotFileName(projectName, blob.type)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
