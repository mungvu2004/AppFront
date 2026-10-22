/**
 * Telemetry của trang 3D realism: một sender riêng cho bó Pascal (trang 3D không có sender chung),
 * cùng cách màn dashboard (`createTelemetrySender` + beacon tới `ENDPOINTS.telemetry`), tạo lười
 * ở sự kiện đầu. Tắt/bật theo `VITE_TELEMETRY_ENABLED` như mọi sender.
 */
import { ENDPOINTS } from '@/api/endpoints';
import { createUuid } from '@/lib/http/ids';
import type { TelemetryEventInput } from '@/lib/telemetry/events';
import { bindTelemetryLifecycle, createBeaconTransport, createTelemetrySender } from '@/lib/telemetry/sender';

type Track = (event: TelemetryEventInput) => void;

let track: Track | null = null;

function defaultTrack(): Track {
  const sender = createTelemetrySender({ transport: createBeaconTransport({ url: ENDPOINTS.telemetry }), sessionId: createUuid() });
  bindTelemetryLifecycle(sender);
  return (event) => sender.track(event);
}

/** Gửi một sự kiện `viewer.*`; không bao giờ ném. */
export function emitRealism(event: TelemetryEventInput): void {
  try {
    (track ??= defaultTrack())(event);
  } catch {
    // Telemetry không được làm hỏng trang 3D.
  }
}

/** Test: thay đường gửi. `null` → về sender thật. */
export function setRealismTrack(next: Track | null): void {
  track = next;
}
