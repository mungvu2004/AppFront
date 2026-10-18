# `pnpm dev:be`: dev server (tự nạp lại khi sửa mã) ở http://localhost:18080 — địa chỉ duy nhất để mở.
# `/api` đi tới container web của stack f14 ở 18081. Stack đặt PUBLIC_BASE_URL=http://localhost:18080,
# đúng origin của dev server, nên đăng nhập không cần đổi gì.
VITE_API_PROXY_TARGET=http://localhost:18081
