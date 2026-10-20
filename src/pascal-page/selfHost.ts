/**
 * Bộ giải Draco của drei lấy từ chính máy (`/draco/`, `scripts/copy-draco.mjs`), không từ
 * gstatic. Plugin `scripts/pascal-self-host.mjs` đã thay chuỗi lúc dựng; dòng này giữ
 * đúng cả khi chạy ngoài bản dựng đó. Nhập đầu tiên trong `main.tsx`, trước mọi `useGLTF`.
 */
import { useGLTF } from '@react-three/drei';

useGLTF.setDecoderPath('/draco/');
