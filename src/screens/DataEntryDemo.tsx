import React, { useState } from 'react';
import { Input } from '../components/ui/Input';
import { NumericField } from '../components/ui/NumericField';
import { Select } from '../components/ui/Select';
import { Combobox } from '../components/ui/Combobox';
import { FieldRow } from '../components/ui/FieldRow';

const MOCK_OPTIONS = [
  { label: 'Tường gạch 110', value: '48' },
  { label: 'Tường gạch 220', value: '21' },
  { label: 'Vách kính cường lực', value: '34' },
  { label: 'Vách thạch cao', value: '14' },
  { label: 'Vách gỗ công nghiệp', value: '4' },
];

export function DataEntryDemo() {
  const [val1, setVal1] = useState<number | undefined>(248.60);
  const [val2, setVal2] = useState<number | undefined>(48);
  const [sel1, setSel1] = useState<string>('34');
  const [com1, setCom1] = useState<string>('14');

  return (
    <div className="p-8 max-w-4xl mx-auto pb-32">
      <h1 className="text-2xl font-bold mb-8 text-text-primary">Data Entry Components</h1>
      
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-text-primary">NumericField States</h2>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-[14px] font-medium text-text-secondary mb-3">1. Empty</h3>
            <NumericField placeholder="Nhập giá trị..." unit="mm" />
          </div>
          <div>
            <h3 className="text-[14px] font-medium text-text-secondary mb-3">2. Valid / Committed</h3>
            <NumericField value={val1} onChange={setVal1} unit="m2" />
          </div>
          <div>
            <h3 className="text-[14px] font-medium text-text-secondary mb-3">3. Invalid (Min: 50)</h3>
            <NumericField value={val2} onChange={setVal2} min={50} unit="mm" />
          </div>
          <div>
            <h3 className="text-[14px] font-medium text-text-secondary mb-3">4. With Hint</h3>
            <NumericField value={21} hint="Giá trị thường nằm trong khoảng 8 - 20 mm/px" unit="mm/px" />
          </div>
          <div>
            <h3 className="text-[14px] font-medium text-text-secondary mb-3">5. Disabled</h3>
            <NumericField value={34} disabled unit="mm" />
          </div>
          <div>
            <h3 className="text-[14px] font-medium text-text-secondary mb-3">6. Read-only</h3>
            <NumericField value={14} isReadOnly unit="mm" />
          </div>
          <div>
            <h3 className="text-[14px] font-medium text-text-secondary mb-3">7. Loading</h3>
            <NumericField isLoading />
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-text-primary">Select & Combobox</h2>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-[14px] font-medium text-text-secondary mb-3">Select (Standard)</h3>
            <Select options={MOCK_OPTIONS} value={sel1} onChange={setSel1} />
          </div>
          <div>
            <h3 className="text-[14px] font-medium text-text-secondary mb-3">Combobox (Fuzzy Search)</h3>
            <Combobox options={MOCK_OPTIONS} value={com1} onChange={setCom1} />
          </div>
          <div>
            <h3 className="text-[14px] font-medium text-text-secondary mb-3">Select (Loading)</h3>
            <Select options={MOCK_OPTIONS} isLoading />
          </div>
          <div>
            <h3 className="text-[14px] font-medium text-text-secondary mb-3">Combobox (Disabled)</h3>
            <Combobox options={MOCK_OPTIONS} disabled value="4" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-text-primary">FieldRow Layout (Property Panel)</h2>
        <div className="bg-bg-surface p-4 rounded-xl border border-border-default shadow-rest max-w-md">
          <FieldRow label="Diện tích">
            <NumericField value={248.60} unit="m2" />
          </FieldRow>
          <FieldRow label="Mã trục">
            <Input value="A1-B2" />
          </FieldRow>
          <FieldRow label="Loại tường">
            <Combobox options={MOCK_OPTIONS} value="21" />
          </FieldRow>
          <FieldRow label="Khoảng cách" isLast>
            <NumericField value={14} unit="mm" hint="Giá trị thường nằm trong khoảng 8 - 20 mm" />
          </FieldRow>
        </div>
      </section>
    </div>
  );
}
