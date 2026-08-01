import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Loader2, AlertCircle, Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { Panel } from './Panel';


// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'shell/Panel',
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

// ── Wrapper ───────────────────────────────────────────────────────────────────

const PanelWrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 280, height: 480 }}>
    {children}
  </div>
);

// ── Mock content — dữ liệu chuẩn 48/21/34/14/4 và 248,60 m² ─────────────────

const MockContent = () => (
  <>
    <Panel.Group label="Tổng quan diện tích">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[13px]">
          <span className="text-text-secondary">Tổng diện tích</span>
          <span className="text-text-primary font-mono tabular-nums">248,60 m²</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-text-secondary">Số phòng</span>
          <span className="text-text-primary font-mono tabular-nums">48</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-text-secondary">Tường ngoài</span>
          <span className="text-text-primary font-mono tabular-nums">21 mm</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-text-secondary">Tường trong</span>
          <span className="text-text-primary font-mono tabular-nums">34 mm</span>
        </div>
      </div>
    </Panel.Group>
    <Panel.Divider />
    <Panel.Group label="Lớp tường">
      <div className="text-[13px] text-text-secondary">
        14 đối tượng · 4 loại
      </div>
    </Panel.Group>
  </>
);

// ── 1. Default ────────────────────────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <PanelWrapper>
      <Panel.Root className="h-full">
        <Panel.Header title="Thuộc tính" />
        <Panel.Body>
          <MockContent />
        </Panel.Body>
      </Panel.Root>
    </PanelWrapper>
  ),
  parameters: {
    docs: { description: { story: 'Trạng thái đầy đủ — header, body cuộn, nhóm, divider.' } },
  },
};

// ── 2. WithCollapse ───────────────────────────────────────────────────────────

function WithCollapseDemo() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <PanelWrapper>
      {!collapsed ? (
        <Panel.Root className="h-full">
          <Panel.Header
            title="Lớp bản vẽ"
            onCollapse={() => setCollapsed(true)}
            collapseDirection="left"
          />
          <Panel.Body>
            <MockContent />
          </Panel.Body>
        </Panel.Root>
      ) : (
        <div className="p-4 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCollapsed(false)}
          >
            Mở lại panel
          </Button>
        </div>
      )}
    </PanelWrapper>
  );
}

export const WithCollapse: Story = {
  render: () => <WithCollapseDemo />,
  parameters: {

    docs: { description: { story: 'Nút thu gọn ở header — click để đóng/mở panel.' } },
  },
};

// ── 3. Empty ──────────────────────────────────────────────────────────────────

export const Empty: Story = {
  render: () => (
    <PanelWrapper>
      <Panel.Root className="h-full">
        <Panel.Header title="Lớp bản vẽ" />
        <Panel.Body>
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <p className="text-[13px] text-text-secondary text-center">Chưa có đối tượng nào</p>
            <p className="text-[12px] text-text-muted text-center">Vẽ tường hoặc thêm lớp để bắt đầu</p>
          </div>
        </Panel.Body>
      </Panel.Root>
    </PanelWrapper>
  ),
  parameters: {
    docs: { description: { story: 'Trạng thái rỗng — không có đối tượng trong panel.' } },
  },
};

// ── 4. Loading ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  render: () => (
    <PanelWrapper>
      <Panel.Root className="h-full">
        <Panel.Header title="Thuộc tính" />
        <Panel.Body>
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" aria-hidden="true" />
            <p className="text-[13px] text-text-secondary">Đang tải...</p>
          </div>
        </Panel.Body>
      </Panel.Root>
    </PanelWrapper>
  ),
  parameters: {
    docs: { description: { story: 'Trạng thái đang tải — spinner, không tương tác.' } },
  },
};

// ── 5. Error ──────────────────────────────────────────────────────────────────

export const Error: Story = {
  render: () => (
    <PanelWrapper>
      <Panel.Root className="h-full">
        <Panel.Header title="Thuộc tính" />
        <Panel.Body>
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <AlertCircle className="w-5 h-5 text-state-violation" aria-hidden="true" />
            <p className="text-[13px] text-text-secondary text-center">Không thể tải dữ liệu</p>
            <Button variant="secondary" size="sm">
              Thử lại
            </Button>
          </div>
        </Panel.Body>

      </Panel.Root>
    </PanelWrapper>
  ),
  parameters: {
    docs: { description: { story: 'Trạng thái lỗi — icon, thông báo, nút thử lại.' } },
  },
};

// ── 6. NoPermission ───────────────────────────────────────────────────────────

export const NoPermission: Story = {
  render: () => (
    <PanelWrapper>
      <Panel.Root className="h-full">
        <Panel.Header title="Thuộc tính" />
        <Panel.Body>
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Lock className="w-5 h-5 text-text-muted" aria-hidden="true" />
            <p className="text-[13px] text-text-secondary text-center">Không có quyền xem</p>
            <p className="text-[12px] text-text-muted text-center">Liên hệ quản trị viên để được cấp quyền</p>
          </div>
        </Panel.Body>
      </Panel.Root>
    </PanelWrapper>
  ),
  parameters: {
    docs: { description: { story: 'Trạng thái không có quyền — icon khoá, hướng dẫn.' } },
  },
};

// ── 7. Collapsed ──────────────────────────────────────────────────────────────

export const Collapsed: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <div className="text-[13px] text-text-muted italic">
        Panel đang thu gọn (width: 0) — do AppShell quản lý animation. <br />
        Xem story <code>WithCollapse</code> để tương tác.
      </div>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Trạng thái thu gọn — Panel.Root bị ẩn bởi PanelWrapper trong AppShell.' } },
  },
};
