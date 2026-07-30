import React, { useEffect, useState } from 'react';
import { useAppShell } from '../../hooks/useAppShell';
import { StatusBar } from './StatusBar';
import { DevStateSwitcher } from './DevStateSwitcher';
import { CommandPalette } from './CommandPalette';
import { Breadcrumb } from './Breadcrumb';
import { Bell, Command, Grid2x2, Layers, MousePointer2, Move, HelpCircle, Box, type LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AppShellProps {
  leftPanelContent?: React.ReactNode;
  rightPanelContent?: React.ReactNode;
  canvasContent?: React.ReactNode;
}

export function AppShell({ leftPanelContent, rightPanelContent, canvasContent }: AppShellProps) {
  const { leftCollapsed, rightCollapsed, toggleLeft, toggleRight } = useAppShell();
  const [activeTool, setActiveTool] = useState('select');

  // Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '[') toggleLeft();
      if (e.key === ']') toggleRight();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleLeft, toggleRight]);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-app overflow-hidden">
      {/* Top Bar - 56px */}
      <header className="h-[56px] shrink-0 flex items-center px-4 w-full">
        {/* Logo mark */}
        <div className="w-8 h-8 bg-accent rounded-[8px] flex items-center justify-center mr-4 shrink-0">
          <Box className="w-5 h-5 text-white" />
        </div>
        
        {/* Breadcrumb */}
        <Breadcrumb items={[
          { id: '1', label: 'Du an' },
          { id: '2', label: 'Tang 01' },
          { id: '3', label: 'Lop Tuong' },
        ]} />
        
        <div className="flex-1" /> {/* Spacer */}
        
        {/* Command Palette Trigger */}
        <button 
          className="flex items-center space-x-2 px-3 h-8 rounded-[6px] hover:bg-bg-hover text-text-secondary transition-colors"
          title="Search commands (Cmd+K)"
        >
          <Command className="w-4 h-4" />
          <span className="text-[13px] font-medium">Search...</span>
          <kbd className="px-1.5 py-0.5 rounded-[4px] bg-bg-sunken text-[11px] font-mono text-text-muted border border-border-default ml-2">
            ⌘K
          </kbd>
        </button>
        
        {/* Notification Bell */}
        <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-hover text-text-secondary ml-2 relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-state-attention rounded-full" />
        </button>
        
        {/* Avatar */}
        <button className="w-7 h-7 rounded-full bg-accent-wash text-accent-active font-medium text-[12px] flex items-center justify-center ml-4 shrink-0">
          A
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden px-2 pb-2 gap-2">
        
        {/* Tool Rail - 56px */}
        <div className="w-[56px] shrink-0 flex flex-col items-center py-2 relative">
           <div className="flex flex-col space-y-2">
             <ToolButton icon={MousePointer2} label="Select" shortcut="V" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
             <ToolButton icon={Move} label="Move" shortcut="M" active={activeTool === 'move'} onClick={() => setActiveTool('move')} />
             <ToolButton icon={Grid2x2} label="Grid" shortcut="G" active={activeTool === 'grid'} onClick={() => setActiveTool('grid')} />
             <ToolButton icon={Layers} label="Layers" shortcut="L" active={activeTool === 'layers'} onClick={() => setActiveTool('layers')} />
           </div>
           
           <div className="mt-auto mb-2 flex flex-col space-y-2">
             <ToolButton icon={HelpCircle} label="Help" shortcut="?" />
           </div>
        </div>

        {/* Left Panel - 280px */}
        <div 
          className="shrink-0 flex transition-[width,opacity] duration-340 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden relative"
          style={{ 
            width: leftCollapsed ? 0 : 280,
            opacity: leftCollapsed ? 0 : 1,
            transitionProperty: 'width, opacity, margin',
            marginRight: leftCollapsed ? '-8px' : 0 // collapse gap
          }}
        >
          {/* Inner div to prevent content reflow during transition */}
          <div className="w-[280px] h-full transition-opacity duration-120" style={{ opacity: leftCollapsed ? 0 : 1 }}>
            {leftPanelContent}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 min-w-[640px] bg-white rounded-[16px] shadow-panel overflow-hidden relative p-3">
          {canvasContent}

          {/* Floating Tool Cluster (when both panels collapsed) */}
          <div 
            className={cn(
              "absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-float px-4 py-2 flex space-x-2 transition-all duration-340 ease-[cubic-bezier(0.32,0.72,0,1)]",
              (leftCollapsed && rightCollapsed) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
            )}
          >
             <ToolButton icon={MousePointer2} label="Select" shortcut="V" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
             <ToolButton icon={Move} label="Move" shortcut="M" active={activeTool === 'move'} onClick={() => setActiveTool('move')} />
             <div className="w-px h-6 bg-border-default self-center mx-2" />
             <button onClick={toggleLeft} className="text-[12px] font-medium px-2 hover:text-accent">Show Panels</button>
          </div>
        </div>

        {/* Right Panel - 344px */}
        <div 
          className="shrink-0 flex transition-[width,opacity] duration-340 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden relative"
          style={{ 
            width: rightCollapsed ? 0 : 344,
            opacity: rightCollapsed ? 0 : 1,
            transitionProperty: 'width, opacity, margin',
            marginLeft: rightCollapsed ? '-8px' : 0 // collapse gap
          }}
        >
          {/* Inner div to prevent content reflow */}
          <div className="w-[344px] h-full transition-opacity duration-120" style={{ opacity: rightCollapsed ? 0 : 1 }}>
            {rightPanelContent}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar 
        x={248.5} 
        y={102.1} 
        scaleLabel="12 mm/px" 
        onScaleClick={() => console.log('Scale clicked')} 
        saveStateText="Da luu luc 14:20" 
      />

      <CommandPalette />
      <DevStateSwitcher />
    </div>
  );
}

// Internal ToolButton component for the tool rail
function ToolButton({ icon: Icon, active, label, shortcut, onClick }: { icon: LucideIcon, active?: boolean, label: string, shortcut: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-10 h-10 rounded-[8px] flex items-center justify-center transition-colors group relative",
        active ? "bg-accent-wash text-accent" : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      )}
      title={`${label} (${shortcut})`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
