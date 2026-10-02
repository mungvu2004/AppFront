/**
 * Hạn chờ cho mốc ĐẦU TIÊN sau khi vào một màn — không cho mốc nào khác.
 *
 * Lần tải đầu của một route bắt Vite dịch nguội chunk `lazy()` của nó. Đo
 * 2026-10-03: chạy BI-3 và F3 lẻ (`-g`, một worker, máy chủ vừa dựng) thì mốc đầu
 * quá hạn 5 s mặc định, còn trong cả bộ thì các bài trước đã làm ấm Vite nên xanh —
 * hạn mỏng chỉ lộ khi chạy riêng. Cùng số và cùng lý do với `FIRST_PAINT_TIMEOUT_MS`
 * của `e2e/smoke-grid.spec.ts`.
 */
export const FIRST_PAINT_TIMEOUT_MS = 15_000;
