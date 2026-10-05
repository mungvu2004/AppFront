/**
 * Bảng câu lỗi cho hai lượt ghi của màn Cổng chất lượng đầu vào (nắn thẳng và
 * gửi bốn góc). Thuần: không React, không mạng.
 *
 * Rẽ nhánh theo mã dây qua `readWireError`, không bao giờ in mã cho người dùng.
 * `reread` nói màn có nên đọc lại kết quả đo hay không: đúng khi máy chủ có thể
 * đã đổi trạng thái mà màn chưa biết (bản vẽ vừa đổi, hoặc lượt gửi mất tín hiệu).
 */

import { readWireError } from '@/lib/errors/wireError';

export interface WriteFailureSentence {
  readonly sentence: string;
  /** Có nên đọc lại kết quả đo của tầng sau lỗi này. */
  readonly reread: boolean;
}

const SENTENCES = Object.freeze({
  drawingChanged: 'Bản vẽ của tầng vừa đổi, kết quả đo đã được đọc lại; hãy xem rồi thử lại.',
  layerReviewed:
    'Tầng này đã có tỉ lệ hoặc hình học do người chỉnh, nên không nắn hay cắt lại bản vẽ được nữa.',
  invalidCorners: 'Bốn góc chưa tạo thành một khung hợp lệ; hãy chọn lại.',
  imageTooLarge: 'Ảnh bản vẽ lớn hơn mức xử lý được; hãy tải bản vẽ nhỏ hơn.',
  pdfUnreadable: 'Không đọc được trang PDF của bản vẽ; hãy tải lại tệp.',
  fileCorrupt: 'Tệp bản vẽ bị hỏng; hãy tải lại tệp.',
  queueFull: 'Hàng xử lý đang đầy; hãy thử lại sau ít phút.',
  uncertain: 'Chưa chắc máy chủ đã nhận thao tác; kết quả đo đang được đọc lại.',
});

const readKind = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const candidate: { kind?: unknown; error?: unknown } = error;

  if (typeof candidate.kind === 'string') {
    return candidate.kind;
  }

  return readKind(candidate.error);
};

/** Một lỗi ghi thành câu người đọc được; `fallbackSentence` cho mã chưa khai. */
export function describeWriteError(error: unknown, fallbackSentence: string): WriteFailureSentence {
  const wire = readWireError(error);
  const code = wire?.code;

  if (code === 'QUALITY_DRAWING_CHANGED') {
    return { sentence: SENTENCES.drawingChanged, reread: true };
  }

  if (code === 'QUALITY_LAYER_REVIEWED') {
    return { sentence: SENTENCES.layerReviewed, reread: false };
  }

  if (code === 'VALIDATION' && wire?.field === 'corners') {
    return { sentence: SENTENCES.invalidCorners, reread: false };
  }

  if (code === 'IMAGE_TOO_LARGE') {
    return { sentence: SENTENCES.imageTooLarge, reread: false };
  }

  if (code === 'PDF_UNREADABLE') {
    return { sentence: SENTENCES.pdfUnreadable, reread: false };
  }

  if (code === 'FILE_CORRUPT') {
    return { sentence: SENTENCES.fileCorrupt, reread: false };
  }

  if (code === 'DEPENDENCY_UNAVAILABLE') {
    return { sentence: SENTENCES.queueFull, reread: false };
  }

  const kind = readKind(error);

  if (kind === 'network' || kind === 'timeout') {
    return { sentence: SENTENCES.uncertain, reread: true };
  }

  return { sentence: fallbackSentence, reread: false };
}
