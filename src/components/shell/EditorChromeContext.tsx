/**
 * Context của vỏ thu gọn cho bốn màn duyệt tầng (`isFloorEditorPath`) — xem `EditorChrome.tsx`.
 * Tách riêng để `AppLayout` (chunk vào) chỉ mang context; các mảnh menu tệp nạp lười, chỉ khi mở màn biên tập.
 */
import { createContext, useContext, type ReactNode } from 'react';

export interface EditorChrome {
  /** Menu tệp; `floors` = danh sách đổi tầng của màn (đặt trong menu, không thành nút riêng). */
  readonly fileMenu: (floors?: ReactNode) => ReactNode;
  readonly stepLabel: ReactNode;
}

const EditorChromeContext = createContext<EditorChrome | null>(null);

export function EditorChromeProvider({ value, children }: { readonly value: EditorChrome | null; readonly children: ReactNode }) {
  return <EditorChromeContext.Provider value={value}>{children}</EditorChromeContext.Provider>;
}

/** null ngoài bốn màn biên tập: thanh của màn giữ nguyên như khi có header chung. */
// eslint-disable-next-line react-refresh/only-export-components -- hook đọc context đứng cạnh Provider của nó
export function useEditorChrome(): EditorChrome | null {
  return useContext(EditorChromeContext);
}
