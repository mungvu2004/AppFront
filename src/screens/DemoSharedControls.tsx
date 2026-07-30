import React, { useState } from 'react';
import { Slider } from '../components/ui/Slider';
import { Checkbox } from '../components/ui/Checkbox';
import { RadioGroup, Radio, IconRadioGroup } from '../components/ui/Radio';
import { Textarea } from '../components/ui/Textarea';
import { Tabs } from '../components/ui/Tabs';
import { Avatar, AvatarStack } from '../components/ui/Avatar';
import { Tooltip } from '../components/ui/Tooltip';
import { Kbd } from '../components/ui/Kbd';
import { Modal } from '../components/overlay/Modal';
import { Drawer } from '../components/overlay/Drawer';
import { ArrowLeft, ArrowRight, DoorOpen } from 'lucide-react';

export function DemoSharedControls() {
  const [sliderVal, setSliderVal] = useState(0.75);
  const [checkboxVal, setCheckboxVal] = useState(false);
  const [radioVal, setRadioVal] = useState('1');
  const [iconRadioVal, setIconRadioVal] = useState('left');
  const [textVal, setTextVal] = useState('');
  const [tabId, setTabId] = useState('tab1');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12 pb-32">
      <h1 className="text-2xl font-semibold mb-8">Shared Controls Demo</h1>

      {/* Slider */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium border-b border-border-default pb-2">1. Slider</h2>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-sm text-text-secondary mb-2">Default (Live Threshold)</p>
            <Slider min={0} max={1} step={0.01} value={sliderVal} onChange={setSliderVal} endLabels={['0.00', '1.00']} />
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-2">Disabled</p>
            <Slider min={0} max={1} step={0.01} value={0.5} onChange={() => {}} disabled endLabels={['0.00', '1.00']} />
          </div>
        </div>
      </section>

      {/* Checkbox */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium border-b border-border-default pb-2">2. Checkbox</h2>
        <div className="flex gap-8">
          <Checkbox checked={checkboxVal} onChange={setCheckboxVal} label="Default / Checked" />
          <Checkbox indeterminate label="Indeterminate" />
          <Checkbox disabled label="Disabled Unchecked" />
          <Checkbox checked disabled label="Disabled Checked" />
        </div>
      </section>

      {/* Radio */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium border-b border-border-default pb-2">3. Radio & IconRadio</h2>
        <div className="flex gap-16">
          <RadioGroup value={radioVal} onChange={setRadioVal}>
            <Radio value="1" label="Option 1" />
            <Radio value="2" label="Option 2" />
            <Radio value="3" label="Disabled Option" disabled />
          </RadioGroup>

          <div>
            <p className="text-sm text-text-secondary mb-2">Icon Radio (Door Swing)</p>
            <IconRadioGroup 
              value={iconRadioVal} 
              onChange={setIconRadioVal} 
              options={[
                { value: 'left', icon: <ArrowLeft size={16} />, label: 'Left' },
                { value: 'door', icon: <DoorOpen size={16} />, label: 'Door' },
                { value: 'right', icon: <ArrowRight size={16} />, label: 'Right' },
              ]} 
            />
          </div>
        </div>
      </section>

      {/* Textarea */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium border-b border-border-default pb-2">4. Textarea</h2>
        <div className="grid grid-cols-2 gap-8">
          <Textarea 
            label="Default with Counter" 
            value={textVal} 
            onChange={e => setTextVal(e.target.value)} 
            maxLength={100} 
            placeholder="Type here..."
          />
          <Textarea 
            label="Error State" 
            value="Invalid content" 
            onChange={() => {}} 
            error="This content violates validation rules"
          />
          <Textarea 
            label="Disabled" 
            value="Cannot edit this" 
            disabled 
          />
          <Textarea 
            label="Read Only" 
            value="Can read but not edit" 
            readOnly 
          />
        </div>
      </section>

      {/* Tabs */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium border-b border-border-default pb-2">5. Tabs</h2>
        <Tabs 
          activeId={tabId} 
          onChange={setTabId} 
          tabs={[
            { id: 'tab1', label: 'Properties', content: <div className="p-4 bg-bg-sunken rounded">Properties Panel Content</div> },
            { id: 'tab2', label: 'History', content: <div className="p-4 bg-bg-sunken rounded">History Panel Content</div> },
            { id: 'tab3', label: 'Comments', content: <div className="p-4 bg-bg-sunken rounded">Comments Panel Content</div> },
          ]} 
        />
      </section>

      {/* Avatar */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium border-b border-border-default pb-2">6. Avatar & AvatarStack</h2>
        <div className="flex gap-8 items-center">
          <Avatar initials="JD" />
          <Avatar initials="AB" presence />
          <Avatar initials="XX" size="profile" />
          
          <div className="ml-8">
            <p className="text-sm text-text-secondary mb-2">Avatar Stack</p>
            <AvatarStack 
              avatars={[
                { initials: 'A' },
                { initials: 'B' },
                { initials: 'C' },
                { initials: 'D' },
                { initials: 'E' }
              ]} 
            />
          </div>
        </div>
      </section>

      {/* Tooltip & Kbd */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium border-b border-border-default pb-2">7 & 8. Tooltip & Kbd</h2>
        <div className="flex gap-8 items-center">
          <Tooltip label="Save Draft" kbd="⌘ S">
            <button className="px-4 py-2 bg-bg-sunken rounded hover:bg-bg-hover">Hover me</button>
          </Tooltip>

          <Tooltip label="Disabled Tooltip" disabled>
            <button className="px-4 py-2 bg-bg-sunken rounded opacity-50 cursor-not-allowed">Disabled</button>
          </Tooltip>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Standalone Kbd:</span>
            <Kbd>Shift</Kbd> + <Kbd>A</Kbd>
          </div>
        </div>
      </section>

      {/* Overlays */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium border-b border-border-default pb-2">9 & 10. Overlays (Modal & Drawer)</h2>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover"
          >
            Open Modal
          </button>
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="px-4 py-2 bg-bg-sunken rounded border border-border-default hover:bg-bg-hover"
          >
            Open Drawer
          </button>
        </div>

        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          title="Leave QC Review?"
          primaryAction={{ label: 'Leave', onClick: () => setIsModalOpen(false) }}
          secondaryAction={{ label: 'Cancel', onClick: () => setIsModalOpen(false) }}
        >
          <p className="text-text-secondary">
            Your draft changes have been auto-saved. Are you sure you want to exit the current flow?
          </p>
        </Modal>

        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        >
          <div className="py-6">
            <h2 className="text-xl font-semibold mb-4">Properties Drawer</h2>
            <p className="text-text-secondary mb-8">
              This drawer slides in from the right on desktop, and becomes a bottom sheet with spring physics on screens below 1024px.
            </p>
            <button 
              onClick={() => setIsDrawerOpen(false)}
              className="px-4 py-2 bg-bg-sunken rounded border border-border-default"
            >
              Close Drawer
            </button>
          </div>
        </Drawer>
      </section>

    </div>
  );
}
