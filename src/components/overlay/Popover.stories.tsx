import React, { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Popover } from './Popover';
import { Button } from '../ui/Button';

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'overlay/Popover',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Bóng nổi neo vào một phần tử kích hoạt, tự lật trên/dưới và trái/phải khi hết chỗ. Không phải modal: không phủ nền, không khoá phím tắt của canvas — chỉ Esc, bấm ra ngoài, và bàn phím bên trong bóng.',
      },
    },
  },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

// ── Nội dung mẫu ──────────────────────────────────────────────────────────────

function SampleContent() {
  return (
    <>
      <h3 className="text-[15px] font-medium leading-[20px] text-text-primary">Đối tượng cửa sổ #12</h3>
      <p className="text-[13px] leading-[18px] text-text-secondary">Rộng 1200 mm, cao 1400 mm.</p>
      <Button variant="secondary" size="sm" fullWidth>
        Đưa vào khung hình
      </Button>
    </>
  );
}

function LongContentSample() {
  return (
    <>
      <h3 className="text-[15px] font-medium leading-[20px] text-text-primary">Lịch sử 6 lần sửa</h3>
      <ul className="flex flex-col gap-1 text-[13px] leading-[18px] text-text-secondary">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index}>Lần sửa thứ {index + 1} lúc 14:3{index} — đổi kích thước tường.</li>
        ))}
      </ul>
    </>
  );
}

// ── Helper: wrapper có useState + anchorRef, đặt nút neo ở một góc viewport ────

interface PopoverStoryProps {
  readonly anchorClassName: string;
  readonly width?: number;
  readonly content?: React.ReactNode;
  readonly initialOpen?: boolean;
  readonly labelledBy?: boolean;
}

function PopoverStory({
  anchorClassName,
  width,
  content = <SampleContent />,
  initialOpen = true,
  labelledBy = false,
}: PopoverStoryProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const titleId = 'popover-story-title';

  return (
    <div className="relative h-screen w-screen bg-bg-app">
      <Button
        ref={anchorRef}
        variant="secondary"
        className={anchorClassName}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? 'Đóng bóng' : 'Mở bóng'}
      </Button>
      <Popover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={anchorRef}
        {...(width !== undefined ? { width } : {})}
        {...(labelledBy ? { 'aria-labelledby': titleId } : { 'aria-label': 'Chi tiết đối tượng' })}
      >
        {labelledBy ? (
          <span id={titleId} className="sr-only">
            Chi tiết đối tượng
          </span>
        ) : null}
        {content}
      </Popover>
    </div>
  );
}

// ── 1. BottomStart — đủ chỗ mọi phía, lật mặc định xuống dưới ─────────────────

export const BottomStart: Story = {
  render: () => <PopoverStory anchorClassName="absolute left-8 top-8" />,
  parameters: {
    docs: { description: { story: 'Neo ở góc trên-trái — đủ chỗ nên mở xuống dưới, căn trái.' } },
  },
};

// ── 2. FlipToTop — neo sát đáy màn hình, phải lật lên trên ────────────────────

export const FlipToTop: Story = {
  render: () => <PopoverStory anchorClassName="absolute bottom-8 left-8" />,
  parameters: {
    docs: { description: { story: 'Neo sát đáy màn hình — không đủ chỗ bên dưới nên bóng tự lật lên trên.' } },
  },
};

// ── 3. FlipToRight — neo sát mép phải, phải lật căn phải ──────────────────────

export const FlipToRight: Story = {
  render: () => <PopoverStory anchorClassName="absolute right-8 top-8" />,
  parameters: {
    docs: {
      description: { story: 'Neo sát mép phải màn hình — không đủ chỗ nên bóng tự lật sang căn theo mép phải.' },
    },
  },
};

// ── 4. Closed — trạng thái đóng ban đầu ───────────────────────────────────────

export const Closed: Story = {
  render: () => <PopoverStory anchorClassName="absolute left-8 top-8" initialOpen={false} />,
  parameters: {
    docs: { description: { story: 'Trạng thái đóng ban đầu — bấm nút để mở.' } },
  },
};

// ── 5. LongContent — nội dung dài, đo chiều cao thật trước khi đặt vị trí ─────

export const LongContent: Story = {
  render: () => <PopoverStory anchorClassName="absolute bottom-8 left-8" content={<LongContentSample />} />,
  parameters: {
    docs: {
      description: { story: 'Nội dung dài hơn — chiều cao được đo thật trước khi lật, không đoán trước.' },
    },
  },
};

// ── 6. NarrowWidth — width tuỳ biến, hẹp hơn mặc định 320 ─────────────────────

export const NarrowWidth: Story = {
  render: () => <PopoverStory anchorClassName="absolute left-8 top-8" width={240} />,
  parameters: {
    docs: { description: { story: 'Chiều rộng tuỳ biến (240px) qua prop `width`, mặc định là 320px.' } },
  },
};

// ── 7. WithAriaLabelledby — dùng aria-labelledby thay vì aria-label ───────────

export const WithAriaLabelledby: Story = {
  render: () => <PopoverStory anchorClassName="absolute left-8 top-8" labelledBy />,
  parameters: {
    docs: { description: { story: 'Dùng `aria-labelledby` trỏ tới tiêu đề bên trong thay vì `aria-label`.' } },
  },
};
