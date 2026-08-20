import React from 'react';
import { AppShell } from '../components/shell/AppShell';
import { Panel } from '../components/shell/Panel';

export function ShellDemo() {
  const leftPanel = (
    <Panel header="Architecture" headerAction={<span className="text-[12px] text-text-muted">v2</span>} className="h-full">
      <div className="space-y-6">
        <section>
          <h4 className="text-[13px] font-semibold leading-[18px] text-text-secondary mb-3">Levels</h4>
          <div className="space-y-1">
             <div className="px-2 py-1.5 rounded-[6px] hover:bg-bg-hover text-[14px]">Level 01</div>
             <div className="px-2 py-1.5 rounded-[6px] bg-bg-selected text-[14px]">Level 02</div>
             <div className="px-2 py-1.5 rounded-[6px] hover:bg-bg-hover text-[14px]">Level 03</div>
          </div>
        </section>
        
        <section>
          <h4 className="text-[13px] font-semibold leading-[18px] text-text-secondary mb-3">Layers</h4>
          <div className="space-y-1 text-[14px]">
             {Array.from({ length: 20 }).map((_, i) => (
               <div key={`layer-${i + 1}`} className="px-2 py-1.5 rounded-[6px] hover:bg-bg-hover">
                 Layer {i + 1}
               </div>
             ))}
          </div>
        </section>
      </div>
    </Panel>
  );

  const rightPanel = (
    <Panel header="Properties" className="h-full">
      <div className="space-y-6">
        <section>
          <h4 className="text-[13px] font-semibold leading-[18px] text-text-secondary mb-3">Dimensions</h4>
          <div className="grid grid-cols-2 gap-4">
             <div>
               <div className="text-[12px] text-text-muted mb-1">Length</div>
               <div className="text-[14px]">2400 mm</div>
             </div>
             <div>
               <div className="text-[12px] text-text-muted mb-1">Height</div>
               <div className="text-[14px]">3200 mm</div>
             </div>
          </div>
        </section>
      </div>
    </Panel>
  );

  const canvas = (
    <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-border-default rounded-[12px] bg-bg-sunken text-text-secondary">
       <div className="text-center max-w-sm">
         <h2 className="text-[16px] font-semibold text-text-primary mb-2">Canvas Area</h2>
         <p className="text-[14px] leading-relaxed">
           Cmd+K to search. [ and ] to toggle panels. Use the dev switch at the bottom right.
         </p>
       </div>
    </div>
  );

  return (
    <AppShell 
      leftPanelContent={leftPanel}
      rightPanelContent={rightPanel}
      canvasContent={canvas}
    />
  );
}
