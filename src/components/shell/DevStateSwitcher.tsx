import React from 'react';
import { useDevStateSwitcher } from '../../hooks/useDevStateSwitcher';
import { Settings2 } from 'lucide-react';

export function DevStateSwitcher() {
  const { isDev, expanded, toggle } = useDevStateSwitcher();

  if (!isDev) return null;

  return (
    <div className="fixed bottom-0 right-0 z-50 pointer-events-none p-4">
      <div className="pointer-events-auto">
        {expanded ? (
          <div className="bg-bg-surface border border-border-default shadow-float rounded-[8px] p-4 w-64 flex flex-col gap-3">
             <div className="flex justify-between items-center">
                <span className="text-[13px] font-semibold text-text-primary">Dev state</span>
                <button 
                  onClick={toggle} 
                  className="text-[12px] text-text-muted hover:text-text-primary active:scale-98 transition-all"
                >
                  Close
                </button>
             </div>
             <div className="text-[12px] text-text-secondary">
               Use this panel to force UI states during development.
             </div>
          </div>
        ) : (
          <button 
            onClick={toggle}
            className="w-8 h-8 bg-bg-surface border border-border-default shadow-rest rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary transition-all duration-120 hover:shadow-float active:scale-98"
            title="Dev state switcher"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
