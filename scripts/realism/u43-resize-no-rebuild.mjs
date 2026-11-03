/**
 * U43: đổi cỡ canvas (mở panel "Cảnh" → canvas hẹp lại) không dựng lại cả chuỗi hậu kỳ.
 * Trước: `size.width`/`size.height` nằm trong deps của effect dựng pipeline → mỗi lần đổi cỡ dựng lại mọi pass,
 * mọi vật thể biên dịch/ẩn lại ~20 s. Effect chỉ dùng size cho chặn cỡ 0 (+ log), nên deps chỉ cần boolean
 * "có cỡ". RenderPipeline/PassNode tự theo cỡ renderer mỗi khung.
 */
const PP = 'viewer/src/components/viewer/post-processing.tsx';

export const RULES = {
  [PP]: [
    [
      '  // Build / rebuild the post-processing pipeline\n  useEffect(() => {\n',
      '  const hasSize = size.width >= 1 && size.height >= 1\n  // Build / rebuild the post-processing pipeline\n  useEffect(() => {\n',
    ],
    ['    size.height,\n    size.width,\n    zoneLayers,\n', '    hasSize,\n    zoneLayers,\n'],
  ],
};
