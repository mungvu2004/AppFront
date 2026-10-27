/**
 * Thay `blob-stream` cho lượt dựng Pascal (alias trong `vite.pascal.config.ts`).
 *
 * Xuất mặt bằng PDF của editor (`floorplan-pdfkit-document.ts`) viết `raw.pipe(blobStream())`.
 * Gói `blob-stream` thật dựng trên `require('stream')` của Node, mà Vite thay module ấy bằng một
 * đối tượng rỗng khi dựng cho trình duyệt: `new BlobStream()` ném "Cannot read properties of
 * undefined (reading 'call')" và nút xuất PDF hỏng ngay cả khi không có CSP (đo 2026-10-27). Bản
 * kèm theo còn mang function-bind/get-intrinsic — 15 chỗ cổng quét eval chặn.
 *
 * Đây chỉ là phía NHẬN của `pipe` (readable-stream của pdfkit, hay `stream` của Node): gom từng
 * khúc vào bộ nhớ, `end()` thì phát `finish` rồi `close`, `toBlob()` ghép thành `Blob`. Không có
 * áp lực ngược — `write` luôn trả `true`, vì một tệp PDF mặt bằng nằm gọn trong bộ nhớ.
 */
type Listener = (...args: unknown[]) => void;

export class BlobStream {
  private readonly chunks: BlobPart[] = [];
  private readonly listenersByEvent = new Map<string, Listener[]>();
  private blob: Blob | null = null;
  /** Số byte đã nhận — như `blob-stream` gốc. */
  length = 0;
  writable = true;

  on(event: string, listener: Listener): this {
    this.listenersByEvent.set(event, [...this.listeners(event), listener]);
    return this;
  }

  addListener(event: string, listener: Listener): this {
    return this.on(event, listener);
  }

  prependListener(event: string, listener: Listener): this {
    this.listenersByEvent.set(event, [listener, ...this.listeners(event)]);
    return this;
  }

  once(event: string, listener: Listener): this {
    const wrapped: Listener = (...args) => {
      this.removeListener(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  removeListener(event: string, listener: Listener): this {
    this.listenersByEvent.set(
      event,
      this.listeners(event).filter((candidate) => candidate !== listener),
    );
    return this;
  }

  off(event: string, listener: Listener): this {
    return this.removeListener(event, listener);
  }

  listeners(event: string): Listener[] {
    return this.listenersByEvent.get(event) ?? [];
  }

  listenerCount(event: string): number {
    return this.listeners(event).length;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const listeners = this.listeners(event);
    listeners.forEach((listener) => listener(...args));
    return listeners.length > 0;
  }

  write(chunk: BlobPart & { length?: number; byteLength?: number }): boolean {
    this.chunks.push(chunk);
    this.length += chunk.byteLength ?? chunk.length ?? 0;
    return true;
  }

  end(chunk?: BlobPart & { length?: number; byteLength?: number }): this {
    if (chunk !== undefined) this.write(chunk);
    this.writable = false;
    this.emit('finish');
    this.emit('close');
    return this;
  }

  toBlob(type = 'application/octet-stream'): Blob {
    this.blob ??= new Blob(this.chunks, { type });
    return this.blob;
  }

  toBlobURL(type?: string): string {
    return URL.createObjectURL(this.toBlob(type));
  }
}

export default function blobStream(): BlobStream {
  return new BlobStream();
}
