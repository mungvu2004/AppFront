import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Modal } from './Modal';
import { Button } from '../ui/Button';

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'overlay/Modal',
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

// ── Nội dung mẫu ──────────────────────────────────────────────────────────────

const SampleBody = () => (
  <div className="flex flex-col gap-3 text-[14px] text-text-primary leading-relaxed">
    <p>
      Bản vẽ này có <strong>48</strong> phòng với tổng diện tích{' '}
      <strong>248,60 m²</strong>. Tường ngoài dày <strong>21 mm</strong>, tường trong{' '}
      <strong>34 mm</strong>.
    </p>
    <p>
      Sau khi xuất bản, tất cả <strong>14</strong> đối tượng thuộc{' '}
      <strong>4</strong> lớp sẽ được lưu vĩnh viễn và chia sẻ với nhóm.
    </p>
  </div>
);

// ── Helper: wrapper có useState để control isOpen ─────────────────────────────

function ModalStory({ width = 480, danger = false }: { width?: 480 | 560 | 720; danger?: boolean }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        Mở modal
      </Button>
      <Modal.Root isOpen={isOpen} onClose={() => setIsOpen(false)} width={width}>
        <Modal.Header>Xuất bản bản vẽ</Modal.Header>
        <Modal.Body>
          <SampleBody />
        </Modal.Body>
        <Modal.Footer>
          <Modal.CloseButton>Huỷ</Modal.CloseButton>
          {danger ? (
            <Button variant="danger" onClick={() => setIsOpen(false)}>
              Xoá vĩnh viễn
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setIsOpen(false)}>
              Xác nhận xuất bản
            </Button>
          )}
        </Modal.Footer>
      </Modal.Root>
    </div>
  );
}

// ── 1. Open480 ────────────────────────────────────────────────────────────────

export const Open480: Story = {
  render: () => <ModalStory width={480} />,
  parameters: {
    docs: { description: { story: 'Modal nhỏ (480px) — mở mặc định. Click "Mở modal" để mở lại sau khi đóng.' } },
  },
};

// ── 2. Open560 ────────────────────────────────────────────────────────────────

export const Open560: Story = {
  render: () => <ModalStory width={560} />,
  parameters: {
    docs: { description: { story: 'Modal vừa (560px).' } },
  },
};

// ── 3. Open720 ────────────────────────────────────────────────────────────────

export const Open720: Story = {
  render: () => <ModalStory width={720} />,
  parameters: {
    docs: { description: { story: 'Modal lớn (720px) — dùng cho form phức tạp hoặc xem trước.' } },
  },
};

// ── 4. Closed ─────────────────────────────────────────────────────────────────

function ClosedDemo() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        Mở modal
      </Button>
      <Modal.Root isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <Modal.Header>Xuất bản bản vẽ</Modal.Header>
        <Modal.Body>
          <SampleBody />
        </Modal.Body>
        <Modal.Footer>
          <Modal.CloseButton>Huỷ</Modal.CloseButton>
          <Button variant="primary" onClick={() => setIsOpen(false)}>Xác nhận</Button>
        </Modal.Footer>
      </Modal.Root>
    </div>
  );
}

export const Closed: Story = {
  render: () => <ClosedDemo />,
  parameters: {
    docs: { description: { story: 'Trạng thái đóng ban đầu — nhấn nút để mở.' } },
  },
};

// ── 5. WithPrimaryAction ──────────────────────────────────────────────────────

export const WithPrimaryAction: Story = {
  render: () => <ModalStory width={480} danger={false} />,
  parameters: {
    docs: { description: { story: 'Nút primary "Xác nhận xuất bản" — hành động dương tính.' } },
  },
};

// ── 6. WithDangerAction ───────────────────────────────────────────────────────

export const WithDangerAction: Story = {
  render: () => <ModalStory width={480} danger={true} />,
  parameters: {
    docs: { description: { story: 'Nút danger "Xoá vĩnh viễn" — màu trạng thái violation theo quy tắc bất biến #4.' } },
  },
};
