import React, { useState, useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Table } from './Table';
import { TableActionBar } from './TableActionBar';
import { Badge } from './Badge';
import { ConfidenceMeter } from './ConfidenceMeter';
import { MOCK_SPATIAL_PROJECT } from '../../mocks/spatial';
import { formatLength } from '../../lib/format/measure';
import { confidenceLevel } from '../../lib/format/semantic';

// ── Extract wall data from mock ───────────────────────────────────────────────

type ReviewState = 'pending' | 'approved' | 'rejected';

interface WallRow {
  id: string;
  from: string;
  to: string;
  thickness_mm: number;
  confidence: number;
  review_state: ReviewState;
}

const walls: WallRow[] = MOCK_SPATIAL_PROJECT.geometry.L1?.walls
  ? Object.values(MOCK_SPATIAL_PROJECT.geometry.L1.walls as Record<string, WallRow>)
  : [];

// 500-row dataset for virtualization story
const walls500: WallRow[] = Array.from({ length: 500 }, (_, i) => ({
  id: `#W-${String(i + 1).padStart(3, '0')}`,
  from: `#V-${String(i).padStart(3, '0')}`,
  to: `#V-${String(i + 1).padStart(3, '0')}`,
  thickness_mm: [110, 220, 330][i % 3] ?? 110,
  confidence: 0.6 + (i % 40) / 100,
  review_state: (['pending', 'approved', 'rejected'] as ReviewState[])[i % 3] ?? 'pending',
}));

const stateVariant = (s: ReviewState) =>
  s === 'approved' ? 'verified' : s === 'rejected' ? 'violation' : 'neutral';

const stateLabel = (s: ReviewState) =>
  s === 'approved' ? 'Đã duyệt' : s === 'rejected' ? 'Từ chối' : 'Chờ duyệt';

const noop = (): void => undefined;

// ── Storybook meta ────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'ui/Table',
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

// ── 1. Empty ──────────────────────────────────────────────────────────────────

export const Empty: Story = {
  render: () => (
    <div className="h-64 border border-border-default rounded-lg overflow-hidden">
      <Table.Root>
        <Table.Header>
          <tr>
            <Table.Head>Mã tường</Table.Head>
            <Table.Head>Độ dày</Table.Head>
            <Table.Head>Độ tin cậy</Table.Head>
            <Table.Head>Trạng thái</Table.Head>
          </tr>
        </Table.Header>
        <Table.Body>
          <Table.Empty colSpan={4} message="Không có tường nào" />
        </Table.Body>
      </Table.Root>
    </div>
  ),
};

// ── 2. Loading (skeleton) ─────────────────────────────────────────────────────

export const Loading: Story = {
  render: () => (
    <div className="h-64 border border-border-default rounded-lg overflow-hidden">
      <Table.Root>
        <Table.Header>
          <tr>
            <Table.Head>Mã tường</Table.Head>
            <Table.Head>Độ dày</Table.Head>
            <Table.Head>Độ tin cậy</Table.Head>
            <Table.Head>Trạng thái</Table.Head>
          </tr>
        </Table.Header>
        <Table.Body>
          <Table.Skeleton columns={4} rows={8} />
        </Table.Body>
      </Table.Root>
    </div>
  ),
};

// ── 3. Error ──────────────────────────────────────────────────────────────────

export const Error: Story = {
  render: () => (
    <div className="h-64 border border-border-default rounded-lg overflow-hidden">
      <Table.Root>
        <Table.Header>
          <tr>
            <Table.Head>Mã tường</Table.Head>
            <Table.Head>Độ dày</Table.Head>
          </tr>
        </Table.Header>
        <Table.Body>
          <Table.Error colSpan={2} message="Không thể tải dữ liệu" onRetry={noop} />
        </Table.Body>
      </Table.Root>
    </div>
  ),
};

// ── 4. Data: 48 walls from mock ───────────────────────────────────────────────

export const WallsTable: Story = {
  name: '48 tường thực tế',
  render: function WallsTableStory() {
    const [sortKey, setSortKey] = useState<string | undefined>();
    const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const handleSort = useCallback((key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
        if (sortDir === null) setSortKey(undefined);
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    }, [sortKey, sortDir]);

    const sorted = [...walls].sort((a, b) => {
      if (!sortKey || !sortDir) return 0;
      const av = a[sortKey as keyof WallRow];
      const bv = b[sortKey as keyof WallRow];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const allChecked = selected.size === sorted.length;
    const someChecked = selected.size > 0 && !allChecked;

    const toggleAll = (checked: boolean) => {
      setSelected(checked ? new Set(sorted.map((r) => r.id)) : new Set());
    };

    const toggleRow = (id: string, checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        checked ? next.add(id) : next.delete(id);
        return next;
      });
    };

    return (
      <div className="relative h-[520px] border border-border-default rounded-lg overflow-hidden">
        <Table.Root sortKey={sortKey ?? undefined} sortDir={sortDir ?? null} onSort={handleSort}>
          <Table.Header>
            <tr>
              <Table.CheckboxHead
                checked={allChecked}
                indeterminate={someChecked}
                onChange={toggleAll}
              />
              <Table.Head sortKey="id">Mã tường</Table.Head>
              <Table.Head sortKey="thickness_mm">Độ dày</Table.Head>
              <Table.Head sortKey="confidence">Độ tin cậy</Table.Head>
              <Table.Head sortKey="review_state">Trạng thái</Table.Head>
            </tr>
          </Table.Header>
          <Table.Body>
            {sorted.map((row) => (
              <Table.Row
                key={row.id}
                selected={selected.has(row.id)}
                isAttention={confidenceLevel(row.confidence) === 'needsReview'}
                onClick={() => toggleRow(row.id, !selected.has(row.id))}
              >
                <Table.CheckboxCell
                  rowId={row.id}
                  checked={selected.has(row.id)}
                  onChange={(c) => toggleRow(row.id, c)}
                />
                <Table.Cell className="font-mono text-[13px]">{row.id}</Table.Cell>
                <Table.Cell>{formatLength(row.thickness_mm, { unit: 'mm' })}</Table.Cell>
                <Table.Cell>
                  <ConfidenceMeter value={row.confidence} />
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={stateVariant(row.review_state)}>
                    {stateLabel(row.review_state)}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        <TableActionBar
          selectedCount={selected.size}
          entityName="tường"
          onApprove={noop}
          onReject={noop}
          onChangeThickness={noop}
          onDeselect={() => setSelected(new Set())}
        />
      </div>
    );
  },
};

// ── 5. Virtualized: 500 rows ──────────────────────────────────────────────────

export const Virtualized500: Story = {
  name: 'Ảo hóa 500 dòng',
  render: function VirtualStory() {
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggleRow = (id: string, checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        checked ? next.add(id) : next.delete(id);
        return next;
      });
    };

    return (
      <div className="relative h-[520px] border border-border-default rounded-lg overflow-hidden" id="virtual-table-container">
        <div className="h-full overflow-auto" id="virtual-scroll-root">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-bg-sunken">
              <tr>
                <Table.Head>Mã tường</Table.Head>
                <Table.Head>Độ dày</Table.Head>
                <Table.Head>Độ tin cậy</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
              </tr>
            </thead>
            <Table.Virtual
              rows={walls500}
              estimateSize={40}
              colSpan={4}
              renderRow={(row) => (
                <Table.Row
                  key={row.id}
                  selected={selected.has(row.id)}
                  isAttention={confidenceLevel(row.confidence) === 'needsReview'}
                  onClick={() => toggleRow(row.id, !selected.has(row.id))}
                >
                  <Table.Cell className="font-mono text-[13px]">{row.id}</Table.Cell>
                  <Table.Cell>{formatLength(row.thickness_mm, { unit: 'mm' })}</Table.Cell>
                  <Table.Cell>
                    <ConfidenceMeter value={row.confidence} noTooltip />
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={stateVariant(row.review_state)}>
                      {stateLabel(row.review_state)}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              )}
            />
          </table>
        </div>
      </div>
    );
  },
};

// ── 6. No permission ──────────────────────────────────────────────────────────

export const NoPermission: Story = {
  name: 'Không có quyền',
  render: () => (
    <div className="h-64 border border-border-default rounded-lg overflow-hidden opacity-60 pointer-events-none select-none">
      <Table.Root>
        <Table.Header>
          <tr>
            <Table.Head>Mã tường</Table.Head>
            <Table.Head>Độ dày</Table.Head>
          </tr>
        </Table.Header>
        <Table.Body>
          <Table.Empty colSpan={2} message="Bạn không có quyền xem dữ liệu này" />
        </Table.Body>
      </Table.Root>
    </div>
  ),
};

// ── 7. Collapsed ──────────────────────────────────────────────────────────────

export const Collapsed: Story = {
  name: 'Thu gọn (null)',
  render: () => <React.Fragment />,
};
