import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  'aria-label'?: string;
}

export function Tabs({ tabs, activeId, onChange, className = '', 'aria-label': ariaLabel }: TabsProps) {
  const activeTab = tabs.find(t => t.id === activeId) || tabs[0];
  
  if (!activeTab) return null;

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let newIndex = -1;
    if (e.key === 'ArrowRight') {
      newIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      newIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      newIndex = 0;
    } else if (e.key === 'End') {
      newIndex = tabs.length - 1;
    }
    
    const nextTab = newIndex !== -1 ? tabs[newIndex] : undefined;
    if (nextTab) {
      e.preventDefault();
      onChange(nextTab.id);
      // Focus the new tab
      const tabElements = document.querySelectorAll(`[role="tab"][data-tabgroup="${ariaLabel}"]`);
      if (tabElements[newIndex]) {
        (tabElements[newIndex] as HTMLElement).focus();
      }
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div 
        className="flex border-b border-border-default" 
        role="tablist" 
        aria-label={ariaLabel || 'Tabs'}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              data-tabgroup={ariaLabel}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`relative h-[36px] px-4 flex items-center justify-center text-[14px] font-medium transition-colors duration-120 outline-none
                first-letter:uppercase lowercase
                focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-[4px]
                ${isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}
              `}
            >
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId={`tab-indicator-${ariaLabel || 'tabs'}`}
                  className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-accent"
                  transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                />
              )}
            </button>
          );
        })}
      </div>
      
      <div className="relative pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeId}
            id={`panel-${activeId}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "linear" }}
            className="w-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-[8px]"
            tabIndex={0}
          >
            {activeTab.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
