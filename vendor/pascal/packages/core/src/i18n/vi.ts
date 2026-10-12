/**
 * Bảng chuỗi tiếng Việt cho `packages/core` (F-15 T5b, A6).
 * Đối tượng `as const`, lồng theo vùng — không hàm `t()`, không thư viện i18n.
 * Danh mục vật liệu (`material-library.ts`, ~130 mục) CHƯA có ở đây — xem
 * `vi-T5b.fragment` / báo cáo cho số đo và việc còn lại.
 */
export const vi = {
  wallAssembly: {
    presets: {
      exterior2x4Siding: 'Tường ngoài 2x4 — ván ốp chồng mép',
      exterior2x6Siding: 'Tường ngoài 2x6 — ván ốp chồng mép',
      exterior2x6Stucco: 'Tường ngoài 2x6 — vữa trát',
      exterior2x6Brick: 'Tường ngoài 2x6 — gạch ốp mặt',
      interior2x4Drywall: 'Tường trong 2x4 — thạch cao hai mặt',
      interior2x6Plumbing: 'Tường trong 2x6 — tường kỹ thuật ống nước',
      exteriorCmuStucco: 'Tường ngoài gạch bê tông (CMU) 8" — vữa trát',
      cmu8FurredDrywall: 'Gạch bê tông (CMU) 8" — khung gỗ kê + thạch cao',
    },
    unverifiedCmuStucco:
      'Khung gỗ kê 1x3 dày 3/4" là cách làm theo gỗ xẻ thông thường, không phải lớp lắp ráp có trích dẫn quy chuẩn; khung kê và tấm thạch cao 1/2" được vẽ chung thành một lớp hoàn thiện trong dày 1-1/4".',
    unverifiedCmuFurredDrywall:
      'Khung gỗ kê 1x3 dày 3/4" là cách làm theo gỗ xẻ thông thường, không phải lớp lắp ráp có trích dẫn quy chuẩn; khung kê và tấm thạch cao 1/2" được vẽ chung thành một lớp hoàn thiện trong dày 1-1/4".',
  },
} as const
