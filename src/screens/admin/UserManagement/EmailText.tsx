import { Fragment } from 'react';

/** Cắt sau `@` và sau mỗi `.`: "hoang.bao@example.com" → hoang. | bao@ | example. | com. */
const BREAK_AFTER = /(?<=[@.])/u;

/**
 * Email trong ô hẹp: xuống dòng ở ranh giới đọc được (sau `@`, sau `.`) thay vì giữa một đoạn ("example.c / om").
 * `<wbr>` không đổi chữ — sao chép và trình đọc màn hình vẫn thấy nguyên địa chỉ. Đoạn nào vẫn dài hơn cả ô thì
 * `overflow-wrap:anywhere` của chỗ gọi là lưới cuối.
 */
export function EmailText({ email }: { readonly email: string }) {
  const parts = email.split(BREAK_AFTER);

  return (
    <>
      {parts.map((part, index) => (
        // Khoá theo thứ tự: các mảnh của một chuỗi cố định, không bao giờ xếp lại.
        <Fragment key={index}>
          {index > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </>
  );
}
EmailText.displayName = 'EmailText';
