import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  MousePointer2, Ruler, Square, DoorOpen, Box,
  HelpCircle, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  type LucideIcon,
} from 'lucide-react';
import { DURATION, EASE } from '../../lib/motion';
import { useAppShell } from '../../hooks/useAppShell';
import { StatusBar } from './StatusBar';
import { Breadcrumb } from './Breadcrumb';
import type { BreadcrumbItem } from '../../hooks/useBreadcrumb';
import { ShortcutHelp } from './ShortcutHelp';
import { useShortcutHelp } from '../../hooks/useShortcutHelp';
import { CommandPalette } from '../overlay/CommandPalette';
import { Drawer } from '../overlay/Drawer';
import { IconButton } from '../ui/IconButton';



// ─── Props ────────────────────────────────────────────────────────────────────

export interface AppShellProps {
  /** Nội dung panel trái */
  leftPanelContent?: React.ReactNode;
  /** Nội dung panel phải */
  rightPanelContent?: React.ReactNode;
  /** Nội dung canvas chính */
  canvasContent?: React.ReactNode;
  /** Breadcrumb items */
  breadcrumbs?: BreadcrumbItem[];
  /** Toạ độ con trỏ từ canvas */
  cursorX?: number;
  cursorY?: number;
  /** Tỷ lệ bản vẽ */
  scaleRatio?: string;
  scaleDensity?: string;
  /** Trạng thái lưu */
  saveText?: string;
}

// ─── Tool types ───────────────────────────────────────────────────────────────

type ToolId = 'select' | 'wall' | 'dimension' | 'door';

interface Tool {
  id: ToolId;
  icon: LucideIcon;
  label: string;
  shortcut: string;
}

const TOOLS: Tool[] = [
  { id: 'select',    icon: MousePointer2, label: 'Chọn',       shortcut: 'V' },
  { id: 'wall',      icon: Square,        label: 'Tường',       shortcut: 'W' },
  { id: 'dimension', icon: Ruler,         label: 'Kích thước',  shortcut: 'M' },
  { id: 'door',      icon: DoorOpen,      label: 'Cửa / lỗ mở', shortcut: 'L' },
];

// ─── ToolButton (internal view) ───────────────────────────────────────────────

function ToolButton({
  tool, isActive, onClick,
}: {
  tool: Tool;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <IconButton
      icon={<tool.icon className="w-[18px] h-[18px]" aria-hidden="true" />}
      aria-label={`${tool.label} (${tool.shortcut})`}
      isActive={isActive}
      onClick={onClick}
      size="lg"
    />
  );
}


// ─── PanelWrapper — xử lý animation mở/đóng ──────────────────────────────────

interface PanelWrapperProps {
  collapsed: boolean;
  width: number;
  children: React.ReactNode;
  side: 'left' | 'right';
}

function PanelWrapper({ collapsed, width, children }: PanelWrapperProps) {

  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      animate={{
        width: collapsed ? 0 : width,
        opacity: collapsed ? 0 : 1,
      }}
      transition={{
        duration: prefersReducedMotion ? 0 : DURATION.default,
        ease: EASE.default,
      }}
      className="shrink-0 overflow-hidden"
      aria-hidden={collapsed}
    >
      {/* Bọc nội dung với chiều rộng cố định để tránh reflow khi animate */}
      <div
        className="h-full transition-opacity duration-120"
        style={{ width: `${width}px`, opacity: collapsed ? 0 : 1 }}
      >
        {children}
      </div>
    </motion.div>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell({
  leftPanelContent,
  rightPanelContent,
  canvasContent,
  breadcrumbs = [
    { id: 'project', label: 'Dự án mẫu', onClick: () => {} },
    {
      id: 'floor',
      label: 'Tầng 01',
      onClick: () => {},
      options: [
        { id: 'floor-0', label: 'Tầng hầm',  onClick: () => {} },
        { id: 'floor-1', label: 'Tầng 01',   onClick: () => {} },
        { id: 'floor-2', label: 'Tầng 02',   onClick: () => {} },
        { id: 'floor-3', label: 'Tầng 03',   onClick: () => {} },
        { id: 'floor-4', label: 'Tầng mái',  onClick: () => {} },
      ],
    },
    { id: 'layer', label: 'Lớp tường' },
  ],
  cursorX = 124.5,
  cursorY = 89.12,
  scaleRatio = '1:100',
  scaleDensity = '12 mm/px',
  saveText = 'Đã lưu lúc 14:32',
}: AppShellProps) {
  const {
    leftCollapsed, rightCollapsed, toggleLeft, toggleRight,
    rightAsOverlay, leftAsDrawer,
  } = useAppShell();


  const [activeTool, setActiveTool] = useState<ToolId>('select');
  const { isOpen: helpOpen, open: openHelp, close: closeHelp } = useShortcutHelp();

  // Drawer state cho panel trái khi < 1024px
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightOverlayOpen, setRightOverlayOpen] = useState(false);

  // Keyboard shortcuts (công cụ + help)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const map: Record<string, () => void> = {
        'v': () => setActiveTool('select'),
        'w': () => setActiveTool('wall'),
        'm': () => setActiveTool('dimension'),
        'l': () => setActiveTool('door'),
        '?': () => openHelp(),
        '[': leftAsDrawer ? () => setLeftDrawerOpen(v => !v) : toggleLeft,
        ']': rightAsOverlay ? () => setRightOverlayOpen(v => !v) : toggleRight,
      };

      const action = map[e.key.toLowerCase()];
      if (action) { e.preventDefault(); action(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [leftAsDrawer, rightAsOverlay, toggleLeft, toggleRight, openHelp]);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-app overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────── 56px ── */}
      <header className="h-[56px] shrink-0 flex items-center px-4 gap-3 w-full">
        {/* Logo */}
        <div
          className="w-8 h-8 bg-accent rounded-[8px] flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <Box className="w-[18px] h-[18px] text-white" />
        </div>

        <Breadcrumb items={breadcrumbs} />

        <div className="flex-1" aria-hidden="true" />

        {/* Toggle panel trái — luôn hiện trên desktop */}
        {!leftAsDrawer && (
          <IconButton
            icon={leftCollapsed ? <PanelLeftOpen className="w-4 h-4" aria-hidden="true" /> : <PanelLeftClose className="w-4 h-4" aria-hidden="true" />}
            aria-label={leftCollapsed ? 'Mở panel trái ([)' : 'Thu gọn panel trái ([)'}
            onClick={toggleLeft}
            size="sm"
          />
        )}

        {/* Toggle panel phải — desktop */}
        {!rightAsOverlay && (
          <IconButton
            icon={rightCollapsed ? <PanelRightOpen className="w-4 h-4" aria-hidden="true" /> : <PanelRightClose className="w-4 h-4" aria-hidden="true" />}
            aria-label={rightCollapsed ? 'Mở panel phải (])' : 'Thu gọn panel phải (])'}
            onClick={toggleRight}
            size="sm"
          />
        )}

        {/* Nút trợ giúp */}
        <IconButton
          icon={<HelpCircle className="w-4 h-4" aria-hidden="true" />}
          aria-label="Phím tắt (?)"
          onClick={openHelp}
          size="sm"
        />
      </header>

      {/* ── Vùng nội dung chính ─────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden px-2 pb-2 gap-2 min-h-0">

        {/* ── Rail icon ── 56px ── */}
        <div
          className="w-[56px] shrink-0 flex flex-col items-center py-2 gap-1"
          role="toolbar"
          aria-label="Bộ công cụ canvas"
          aria-orientation="vertical"
        >
          {TOOLS.map(tool => (
            <ToolButton
              key={tool.id}
              tool={tool}
              isActive={activeTool === tool.id}
              onClick={() => setActiveTool(tool.id)}
            />
          ))}
        </div>

        {/* ── Panel trái ── 280px ── */}
        {!leftAsDrawer && (
          <PanelWrapper collapsed={leftCollapsed} width={280} side="left">
            {leftPanelContent}
          </PanelWrapper>
        )}

        {/* ── Canvas ── flex-1 min-w-[640px] ── */}
        <main
          className="flex-1 min-w-[640px] bg-bg-surface rounded-[12px] shadow-panel overflow-hidden relative"
          aria-label="Vùng canvas"
        >
          {canvasContent}
        </main>

        {/* ── Panel phải ── 344px ── chỉ desktop >= 1280 */}
        {!rightAsOverlay && (
          <PanelWrapper collapsed={rightCollapsed} width={344} side="right">
            {rightPanelContent}
          </PanelWrapper>
        )}
      </div>

      {/* ── Status bar ── 32px ── */}
      <StatusBar
        x={cursorX}
        y={cursorY}
        scaleRatio={scaleRatio}
        scaleDensity={scaleDensity}
        saveText={saveText}
      />

      {/* ── Overlays ──────────────────────────────────────────────────────── */}

      {/* Panel trái dưới dạng Drawer khi < 1024px */}
      {leftAsDrawer && (
        <Drawer.Root isOpen={leftDrawerOpen} onClose={() => setLeftDrawerOpen(false)} size={320}>
          <Drawer.Body>{leftPanelContent}</Drawer.Body>
        </Drawer.Root>
      )}

      {/* Panel phải dưới dạng Overlay khi 1024–1279px */}
      {rightAsOverlay && (
        <Drawer.Root isOpen={rightOverlayOpen} onClose={() => setRightOverlayOpen(false)} size={400}>
          <Drawer.Body>{rightPanelContent}</Drawer.Body>
        </Drawer.Root>
      )}

      {/* CommandPalette — global */}
      <CommandPalette />

      {/* ShortcutHelp */}
      <ShortcutHelp isOpen={helpOpen} onClose={closeHelp} />
    </div>
  );
}
