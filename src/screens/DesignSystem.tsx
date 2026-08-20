import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Toggle } from '../components/ui/Toggle';
import { Settings, Save, Trash2, Check, RefreshCw } from 'lucide-react';

/** Fake network latency for the demo buttons. Not motion; nothing moves for it. */
const DEMO_LATENCY_MS = 800;

export function DesignSystem() {
  const [toggleChecked, setToggleChecked] = useState(false);

  const simulateAsync = async (val: boolean) => {
    await new Promise((resolve) => setTimeout(resolve, DEMO_LATENCY_MS));
    setToggleChecked(val);
  };

  const simulateAsyncError = async () => {
    await new Promise((resolve, reject) => setTimeout(reject, DEMO_LATENCY_MS));
    throw new Error('Simulated failure');
  };

  return (
    <div className="min-h-screen bg-bg-surface p-12 text-text-primary">
      <div className="mx-auto max-w-5xl space-y-16">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Quiet Blueprint v1.1</h1>
          <p className="mt-2 text-text-secondary">Foundation Components Demo</p>
        </header>

        {/* Buttons Grid */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Buttons</h2>
          
          <div className="grid grid-cols-4 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-secondary">Primary</h3>
              <div className="flex flex-col items-start gap-4">
                <Button variant="primary" size="md">Default</Button>
                <Button variant="primary" size="md" shortcut="⌘S" icon={<Save />}>With Icon & Shortcut</Button>
                <Button variant="primary" size="md" loading>Loading</Button>
                <Button variant="primary" size="md" disabled>Disabled</Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-secondary">Secondary</h3>
              <div className="flex flex-col items-start gap-4">
                <Button variant="secondary" size="md">Default</Button>
                <Button variant="secondary" size="md" icon={<Settings />}>Settings</Button>
                <Button variant="secondary" size="md" icon={<Settings />} loading>Loading</Button>
                <Button variant="secondary" size="md" disabled>Disabled</Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-secondary">Ghost</h3>
              <div className="flex flex-col items-start gap-4">
                <Button variant="ghost" size="md">Default</Button>
                <Button variant="ghost" size="md" icon={<RefreshCw />}>Refresh</Button>
                <Button variant="ghost" size="md" icon={<RefreshCw />} loading>Loading</Button>
                <Button variant="ghost" size="md" disabled>Disabled</Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-secondary">Danger</h3>
              <div className="flex flex-col items-start gap-4">
                <Button variant="danger" size="md">Delete Project</Button>
                <Button variant="danger" size="md" icon={<Trash2 />}>Delete</Button>
                <Button variant="danger" size="md" icon={<Trash2 />} loading>Deleting...</Button>
                <Button variant="danger" size="md" disabled>Disabled</Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-8">
            <h3 className="text-sm font-medium text-text-secondary">Sizes & States</h3>
            <div className="flex items-center gap-6">
              <Button size="sm">Small (32px)</Button>
              <Button size="md">Medium (36px)</Button>
              <Button size="lg">Large (40px)</Button>
              
              <div className="h-8 w-px bg-border-default mx-4" />
              
              <Button iconOnly size="md" icon={<Settings />} aria-label="Settings" />
              <Button iconOnly size="md" loading icon={<Settings />} aria-label="Loading Settings" />
            </div>
          </div>
        </section>

        <hr className="border-border-default" />

        {/* IconButtons Grid */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Icon Buttons</h2>
          <p className="text-sm text-text-secondary max-w-2xl">
            36px visual square with 40px hit area. Used for toolbars and tight spaces.
          </p>
          
          <div className="flex items-center gap-8">
            <IconButton icon={<Settings />} aria-label="Settings" />
            <IconButton icon={<Check />} isActive aria-label="Check (Active)" />
            <IconButton icon={<Settings />} loading aria-label="Loading" />
            <IconButton icon={<Settings />} disabled aria-label="Disabled" />
          </div>
        </section>

        <hr className="border-border-default" />

        {/* SegmentedControl Grid */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Segmented Control</h2>
          
          <div className="flex flex-col gap-8 max-w-md">
            <div>
              <h3 className="mb-4 text-sm font-medium text-text-secondary">Standard (Text only)</h3>
              <SegmentedControl
                defaultValue="2d"
                options={[
                  { label: '2D Plan', value: '2d' },
                  { label: '3D View', value: '3d' },
                  { label: 'Data', value: 'data' },
                ]}
              />
            </div>
            
            <div>
              <h3 className="mb-4 text-sm font-medium text-text-secondary">With Color Swatches (Wall Thickness)</h3>
              <SegmentedControl
                defaultValue="110"
                options={[
                  { label: '110 mm', value: '110', swatch: 'var(--text-muted)' },
                  { label: '220 mm', value: '220', swatch: 'var(--accent-hover)' },
                  { label: '330 mm', value: '330', swatch: 'var(--accent)' },
                ]}
              />
            </div>

            <div>
              <h3 className="mb-4 text-sm font-medium text-text-secondary">With Disabled Options</h3>
              <SegmentedControl
                defaultValue="draft"
                options={[
                  { label: 'Draft', value: 'draft' },
                  { label: 'Review', value: 'review', disabled: true },
                  { label: 'Published', value: 'published' },
                ]}
              />
            </div>
          </div>
        </section>

        <hr className="border-border-default" />

        {/* Toggle Grid */}
        <section className="space-y-6 pb-20">
          <h2 className="text-xl font-semibold">Toggle</h2>
          
          <div className="flex items-center gap-16">
            <div className="flex items-center gap-4">
              <Toggle aria-label="Simple Toggle" />
              <span className="text-sm">Default Uncontrolled</span>
            </div>

            <div className="flex items-center gap-4">
              <Toggle checked={toggleChecked} onChange={simulateAsync} aria-label="Async Toggle" />
              <span className="text-sm">Optimistic Async (800ms)</span>
            </div>

            <div className="flex items-center gap-4">
              <Toggle checked={false} onChange={simulateAsyncError} aria-label="Error Toggle" />
              <span className="text-sm">Optimistic Async (Fails)</span>
            </div>

            <div className="flex items-center gap-4">
              <Toggle disabled aria-label="Disabled Toggle" />
              <span className="text-sm">Disabled</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
