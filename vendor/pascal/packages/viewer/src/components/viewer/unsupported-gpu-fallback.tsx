import { vi } from '../../i18n/vi'

export function UnsupportedGpuViewerFallback() {
  return (
    <div className="flex h-full min-h-64 w-full items-center justify-center bg-[#fafafa] p-6 text-center text-neutral-900">
      <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-lg">{vi.gpuFallback.title}</h2>
        <p className="mt-2 text-neutral-600 text-sm">{vi.gpuFallback.body}</p>
      </div>
    </div>
  )
}
