# Router Fragment — Thay Placeholder route NotFound

## Thay đổi cần làm trong `src/routes/router.tsx`

### Vị trí: Khối `const` lazy-load (dòng 28-60)

**Thêm dòng này vào danh sách các route:**

```ts
const RouteNotFound = lazy(() => import('../screens/system/NotFound').then(m => ({ default: m.NotFoundRoute })));
```

Đặt ngay sau dòng 36 (`RouteNotificationCenter`), hoặc bất kỳ chỗ nào trong khối lazy-load.

### Vị trí: Mảng `children` của route gốc (dòng 320)

**Dòng hiện tại (cần thay):**
```tsx
      { path: ROUTE_PATTERNS.notFound, element: <Placeholder name="404" /> },
```

**Dòng thay thế (đề xuất):**
```tsx
      { path: ROUTE_PATTERNS.notFound, element: suspended(<RouteNotFound />) },
```

### Xác nhận

- **Placeholder `name="404"` bị xoá hoàn toàn**, không để lại cạnh route mới.
- **Số Placeholder trước**: 6 (có trong `designSystemStates` và `notFound`)
- **Số Placeholder sau khi xoá route NotFound**: 5 (chỉ còn `designSystemStates`)
- Kiểm chứng: `grep -c Placeholder src/routes/router.tsx` trước = 6, sau = 5

### Ghi chú

- Khấm `import` từ `@/screens/system/NotFound` khớp mục D (đường nhập ổn định từ `index.ts` của thư mục màn).
- Export `NotFoundRoute` tương ứng với pattern của `AuthRoute`, `NotificationCenterRoute`, v.v.
- Bọc bằng `suspended(...)` đúng khuôn mọi route thật khác, KHÔNG phải `<RouteCanvas />` hay `Placeholder`.
