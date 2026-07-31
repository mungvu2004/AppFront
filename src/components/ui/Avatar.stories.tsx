import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Avatar, AvatarStack } from './Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'ui/Avatar',
  component: Avatar,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Avatar>;

const sampleAvatars = [
  { initials: 'An', alt: 'Nguyễn An' },
  { initials: 'Bk', alt: 'Trần Bình' },
  { initials: 'Cv', alt: 'Lê Chí' },
  { initials: 'Dt', alt: 'Phạm Dũng' },
  { initials: 'Em', alt: 'Hoàng Em' },
];

export const Default: Story = {
  args: { initials: 'An', alt: 'Nguyễn An' },
};

export const WithImage: Story = {
  name: 'Có ảnh',
  args: {
    src: 'https://i.pravatar.cc/28?img=1',
    alt: 'Nguyễn An',
    initials: 'An',
  },
};

export const Profile: Story = {
  name: 'Kích thước profile (64px)',
  args: { initials: 'Na', size: 'profile', alt: 'Nguyễn An' },
};

export const WithPresence: Story = {
  name: 'Có ring hiện diện',
  args: { initials: 'Bk', presence: true },
};

export const Stack3: Story = {
  name: 'Nhóm 3 người',
  render: () => <AvatarStack avatars={sampleAvatars.slice(0, 3)} max={3} />,
};

export const StackOverflow: Story = {
  name: 'Nhóm tràn (+2)',
  render: () => <AvatarStack avatars={sampleAvatars} max={3} />,
};

export const StackAll: Story = {
  name: 'Nhóm 5 người (max=5)',
  render: () => <AvatarStack avatars={sampleAvatars} max={5} />,
};

export const Empty: Story = {
  name: 'Rỗng (không có initials)',
  args: { initials: '', alt: 'Người dùng ẩn danh' },
};
