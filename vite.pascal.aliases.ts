/**
 * Alias riêng của lượt dựng Pascal mà mã vendor đã vá (plugin `scripts/pascal-realism.mjs`) nhập.
 * `@pascal-realism/<file>` → `src/pascal-page/realism/<file>` (TS thuần, test bằng vitest).
 */
import path from 'path';
import type { Alias } from 'vite';

const REALISM_DIR = path.resolve(__dirname, './src/pascal-page/realism').split(path.sep).join('/');

export const PASCAL_REALISM_ALIASES: Alias[] = [{ find: /^@pascal-realism\/(.*)$/, replacement: `${REALISM_DIR}/$1` }];
