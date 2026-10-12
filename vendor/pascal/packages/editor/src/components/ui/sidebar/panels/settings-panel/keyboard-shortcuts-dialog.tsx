import { Keyboard } from 'lucide-react'
import { Button } from './../../../../../components/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './../../../../../components/ui/primitives/dialog'
import {
  ShortcutToken,
  shortcutDisplayValue,
} from './../../../../../components/ui/primitives/shortcut-token'
import { primitivesAndSidebar as vi } from './../../../../../i18n/regions/primitivesAndSidebar'

type Shortcut = {
  keys: string[]
  action: string
  note?: string
}

type ShortcutCategory = {
  title: string
  shortcuts: Shortcut[]
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Điều hướng trình chỉnh sửa',
    shortcuts: [
      { keys: ['1'], action: 'Chuyển sang giai đoạn Khu đất' },
      { keys: ['2'], action: 'Chuyển sang giai đoạn Kết cấu' },
      { keys: ['3'], action: 'Chuyển sang giai đoạn Nội thất' },
      { keys: ['F'], action: 'Chuyển sang lớp Nội thất' },
      { keys: ['Z'], action: 'Chuyển sang lớp Vùng' },
      {
        keys: ['Cmd/Ctrl', 'Arrow Up'],
        action: 'Chọn tầng kế tiếp trong toà nhà đang hoạt động',
      },
      {
        keys: ['Cmd/Ctrl', 'Arrow Down'],
        action: 'Chọn tầng trước đó trong toà nhà đang hoạt động',
      },
      { keys: ['Cmd/Ctrl', 'B'], action: 'Ẩn/hiện thanh bên' },
    ],
  },
  {
    title: 'Chế độ & lịch sử',
    shortcuts: [
      { keys: ['V'], action: 'Chuyển sang chế độ Chọn' },
      { keys: ['B'], action: 'Chuyển sang chế độ Dựng' },
      { keys: ['M'], action: 'Bật công cụ đo gần nhất' },
      { keys: ['X'], action: 'Chuyển sang chế độ Xoá' },
      {
        keys: ['Esc'],
        action: 'Huỷ công cụ đang dùng và trở về chế độ Chọn',
        note: 'Giữa lúc vẽ, nó chỉ huỷ chuỗi đang vẽ và vẫn giữ công cụ sẵn sàng; bấm lần nữa để thoát công cụ.',
      },
      { keys: ['Delete / Backspace'], action: 'Xoá các đối tượng đã chọn' },
      { keys: ['Cmd/Ctrl', 'Z'], action: 'Hoàn tác' },
      { keys: ['Cmd/Ctrl', 'Shift', 'Z'], action: 'Làm lại' },
      { keys: ['Cmd/Ctrl', 'S'], action: 'Lưu' },
    ],
  },
  {
    title: 'Chọn',
    shortcuts: [
      {
        keys: ['Cmd/Ctrl', 'C'],
        action: 'Chép các đối tượng đã chọn',
        note: 'Phần đã chép có thể dán vào tầng khác, dự án khác, hoặc tab trình duyệt khác.',
      },
      {
        keys: ['Cmd/Ctrl', 'X'],
        action: 'Cắt các đối tượng đã chọn',
        note: 'Chép phần chọn vào bộ nhớ tạm, rồi xoá nó khỏi cảnh này.',
      },
      {
        keys: ['Cmd/Ctrl', 'V'],
        action: 'Dán và đặt các đối tượng đã chép',
        note:
          'Mang theo một bản xem trước dưới con trỏ. Bấm để đặt nó, hoặc nhấn Escape để huỷ.',
      },
      {
        keys: ['Cmd/Ctrl', 'Left click'],
        action: 'Thêm hoặc bỏ một đối tượng khỏi vùng chọn nhiều',
        note: 'Hoạt động ở chế độ Chọn trên khung nhìn 3D, mặt bằng 2D, và đồ thị cảnh.',
      },
      {
        keys: ['Shift', 'Left click'],
        action: 'Thêm hoặc bỏ một đối tượng khỏi vùng chọn nhiều trên khung vẽ',
        note: 'Trong đồ thị cảnh, Shift-bấm chọn dải đang hiện như trình quản lý tệp.',
      },
      {
        keys: ['Left click'],
        action: 'Di chuyển toàn bộ vùng chọn nhiều',
        note:
          'Với 2 đối tượng trở lên đã chọn, ở cả 2D và 3D: kéo vùng chọn (hoặc khung nét đứt của nó) để trượt; bấm vào nó để nhấc lên và đặt với lần bấm kế tiếp.',
      },
      {
        keys: ['R', 'T'],
        action: 'Xoay vùng chọn nhiều ±45° quanh tâm',
        note: 'Cũng hoạt động giữa lúc di chuyển khi đang mang vùng chọn.',
      },
      {
        keys: ['Cmd/Ctrl', 'G'],
        action: 'Nhóm vùng chọn nhiều (chỉ trong phiên này)',
        note:
          'Chỉ trong trình chỉnh sửa. Bấm thường vào một thành viên sau đó để chọn lại cả nhóm. Không lưu cùng dự án.',
      },
      {
        keys: ['Cmd/Ctrl', 'Shift', 'G'],
        action: 'Bỏ nhóm vùng chọn trong phiên này',
        note: 'Giữ nguyên vùng chọn hiện tại; chỉ tách nhóm của phiên này.',
      },
      {
        keys: ['Esc'],
        action: 'Bỏ chọn',
        note: 'Bấm vào khoảng trống cũng có tác dụng tương tự.',
      },
    ],
  },
  {
    title: 'Thao tác trực tiếp',
    shortcuts: [
      {
        keys: ['Cmd/Ctrl', 'Left click'],
        action: 'Di chuyển đối tượng có thể di chuyển dưới con trỏ',
        note: 'Kéo ở chế độ Chọn với một đối tượng duy nhất đã chọn. Bắt dính và đường dẫn hướng dẫn được bật theo mặc định.',
      },
      {
        keys: ['Cmd/Ctrl', 'Right click'],
        action: 'Xoay đối tượng đã chọn dưới con trỏ',
        note: 'Kéo sang trái hoặc phải ở chế độ Chọn với một đối tượng duy nhất đã chọn. Xoay bắt theo bước 15° theo mặc định.',
      },
      {
        keys: ['Cmd/Ctrl', 'Shift', 'Right click'],
        action: 'Xoay tự do',
        note: 'Giữ Shift trong lúc kéo để bỏ qua bước xoay 15°.',
      },
    ],
  },
  {
    title: 'Công cụ vẽ',
    shortcuts: [
      // Shift and Ctrl each mean one thing held and another tapped, and only
      // the hold was documented — which read as the taps not existing. Both
      // taps are listed first because they are the ones nobody discovers.
      {
        keys: ['Shift'],
        action: 'Đổi vòng chế độ bắt dính',
        note: 'Bấm rồi thả ra, không bấm gì khác, khi đang vẽ hoặc di chuyển.',
      },
      {
        keys: ['Cmd/Ctrl'],
        action: 'Đổi vòng bước lưới: 0,5 m → 0,25 m → 0,1 m → 0,05 m',
        note: 'Bấm rồi thả ra một mình. Dùng khi lưới nửa mét mặc định quá thô — ví dụ khi đặt cửa sổ.',
      },
      {
        keys: ['Shift'],
        action: 'Bỏ qua bắt dính có hướng dẫn và ràng buộc góc',
        note: 'Giữ trong lúc thực hiện cử chỉ. Hướng dẫn hoặc phản hồi đo lường thụ động có thể vẫn hiện.',
      },
      {
        keys: ['Shift'],
        action: 'Xoay tự do, bỏ qua bước bắt dính xoay 15° mặc định',
        note: 'Giữ trong lúc kéo tay cầm xoay hoặc cử chỉ xoay trực tiếp.',
      },
    ],
  },
  {
    title: 'Đặt đồ đạc',
    shortcuts: [
      {
        keys: ['R', 'T'],
        action: 'Xoay đồ đạc; với cửa đã chọn, R bật/tắt mở-đóng và T đóng lại',
      },
      {
        keys: ['E'],
        action: 'Vận hành nút đã chọn — cửa, cửa sổ, và cửa/ngăn kéo tủ chuyển động mở/đóng',
      },
      {
        keys: ['Shift'],
        action: 'Tạm thời bỏ qua ràng buộc kiểm tra khi đặt',
        note: 'Giữ trong lúc đặt.',
      },
    ],
  },
  {
    title: 'Camera',
    shortcuts: [
      {
        keys: ['W', 'A', 'S', 'D'],
        action: 'Di camera',
        note: 'Di chuyển trong không gian màn hình, giống như kéo khung nhìn camera.',
      },
      {
        keys: ['Middle click'],
        action: 'Di camera',
        note: 'Kéo bằng nút chuột giữa, hoặc giữ Space trong lúc kéo bằng nút chuột trái.',
      },
      {
        keys: ['Right click'],
        action: 'Xoay quỹ đạo camera',
        note: 'Kéo bằng nút chuột phải.',
      },
    ],
  },
]

function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {keys.map((key, index) => (
        <div className="flex items-center gap-1" key={`${key}-${index}`}>
          {index > 0 ? <span className="text-[10px] text-muted-foreground">+</span> : null}
          <ShortcutToken displayValue={shortcutDisplayValue(key)} value={key} />
        </div>
      ))}
    </div>
  )
}

export function KeyboardShortcutsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full justify-start gap-2" variant="outline">
          <Keyboard className="size-4" />
          {vi.keyboardShortcutsDialog.button}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{vi.keyboardShortcutsDialog.title}</DialogTitle>
          <DialogDescription>
            {vi.keyboardShortcutsDialog.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {SHORTCUT_CATEGORIES.map((category) => (
            <section className="space-y-2" key={category.title}>
              <h3 className="font-medium text-sm">{category.title}</h3>
              <div className="overflow-hidden rounded-md border border-border/80">
                {category.shortcuts.map((shortcut, index) => (
                  <div
                    className="grid grid-cols-[minmax(130px,220px)_1fr] gap-3 px-3 py-2"
                    key={`${category.title}-${shortcut.action}`}
                  >
                    <ShortcutKeys keys={shortcut.keys} />
                    <div>
                      <p className="text-sm">{shortcut.action}</p>
                      {shortcut.note ? (
                        <p className="text-muted-foreground text-xs">{shortcut.note}</p>
                      ) : null}
                    </div>
                    {index < category.shortcuts.length - 1 ? (
                      <div className="col-span-2 border-border/60 border-b" />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
