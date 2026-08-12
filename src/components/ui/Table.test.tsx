import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Table } from './Table';
import { MOCK_SPATIAL_PROJECT } from '../../mocks/spatial';
import { formatMm } from '../../lib/format';

// ── Shared helpers ────────────────────────────────────────────────────────────

type ReviewState = 'pending' | 'approved' | 'rejected';
interface WallRow { id: string; from: string; to: string; thickness_mm: number; confidence: number; review_state: ReviewState; }

const walls: WallRow[] = MOCK_SPATIAL_PROJECT.geometry.L1?.walls
  ? Object.values(MOCK_SPATIAL_PROJECT.geometry.L1.walls as Record<string, WallRow>)
  : [];

// ── Sorting ───────────────────────────────────────────────────────────────────

describe('Table sorting', () => {
  function SortableTable() {
    const [sortKey, setSortKey] = useState<string | undefined>();
    const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

    const handleSort = (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
        if (sortDir === null) setSortKey(undefined);
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    };

    const sorted = [...walls].sort((a, b) => {
      if (!sortKey || !sortDir) return 0;
      const av = a[sortKey as keyof WallRow];
      const bv = b[sortKey as keyof WallRow];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return (
      <Table.Root sortKey={sortKey ?? undefined} sortDir={sortDir ?? null} onSort={handleSort}>
        <Table.Header>
          <tr>
            <Table.Head sortKey="id" data-testid="col-id">Mã tường</Table.Head>
            <Table.Head sortKey="thickness_mm" data-testid="col-thickness">Độ dày</Table.Head>
          </tr>
        </Table.Header>
        <Table.Body>
          {sorted.map((row) => (
            <Table.Row key={row.id}>
              <Table.Cell data-testid={`cell-id-${row.id}`}>{row.id}</Table.Cell>
              <Table.Cell data-testid={`cell-thickness-${row.id}`}>{formatMm(row.thickness_mm)}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    );
  }

  it('renders all 48 walls', () => {
    render(<SortableTable />);
    expect(screen.getAllByRole('row')).toHaveLength(walls.length + 1); // +1 for header
  });

  it('sorts ascending on first click', () => {
    render(<SortableTable />);
    const colId = screen.getByTestId('col-id');
    fireEvent.click(colId);
    const rows = screen.getAllByRole('row').slice(1);
    const textContent = rows[0]?.querySelector('td')?.textContent;
    expect(textContent).toBe('#W-001');
    const lastContent = rows[rows.length - 1]?.querySelector('td')?.textContent;
    expect(lastContent).toBe('#W-048');
  });

  it('sorts descending on second click', () => {
    render(<SortableTable />);
    const colId = screen.getByTestId('col-id');
    fireEvent.click(colId);
    fireEvent.click(colId);
    const rows = screen.getAllByRole('row').slice(1);
    const textContent = rows[0]?.querySelector('td')?.textContent;
    expect(textContent).toBe('#W-048');
  });

  it('clears sort on third click', () => {
    render(<SortableTable />);
    const colId = screen.getByTestId('col-id');
    fireEvent.click(colId);
    fireEvent.click(colId);
    fireEvent.click(colId);
    // After 3 clicks, no aria-sort="ascending" or "descending"
    expect(colId).not.toHaveAttribute('aria-sort', 'ascending');
    expect(colId).not.toHaveAttribute('aria-sort', 'descending');
  });

  it('sets aria-sort attribute correctly', () => {
    render(<SortableTable />);
    const colThickness = screen.getByTestId('col-thickness');
    expect(colThickness).toHaveAttribute('aria-sort', 'none');
    fireEvent.click(colThickness);
    expect(colThickness).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(colThickness);
    expect(colThickness).toHaveAttribute('aria-sort', 'descending');
  });
});

// ── Multi-select ──────────────────────────────────────────────────────────────

describe('Table multi selection', () => {
  function SelectableTable() {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const allChecked = selected.size === walls.length;
    const someChecked = selected.size > 0 && !allChecked;

    return (
      <Table.Root>
        <Table.Header>
          <tr>
            <Table.CheckboxHead
              checked={allChecked}
              indeterminate={someChecked}
              onChange={(c) => setSelected(c ? new Set(walls.map((r) => r.id)) : new Set())}
            />
            <Table.Head>Mã</Table.Head>
          </tr>
        </Table.Header>
        <Table.Body>
          {walls.map((row) => (
            <Table.Row key={row.id} selected={selected.has(row.id)} aria-selected={selected.has(row.id)}>
              <Table.CheckboxCell
                rowId={row.id}
                checked={selected.has(row.id)}
                onChange={(c) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    c ? next.add(row.id) : next.delete(row.id);
                    return next;
                  })
                }
              />
              <Table.Cell>{row.id}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    );
  }

  it('starts with no rows selected', () => {
    render(<SelectableTable />);
    expect(screen.queryAllByRole('row', { selected: true })).toHaveLength(0);
  });

  it('selects a row when its checkbox is clicked', () => {
    render(<SelectableTable />);
    const firstCheckbox = screen.getAllByRole('checkbox')[1];
    if (firstCheckbox) {
      fireEvent.click(firstCheckbox);
    }
    expect(screen.getAllByRole('row', { selected: true })).toHaveLength(1);
  });

  it('selects all rows when header checkbox is clicked', () => {
    render(<SelectableTable />);
    const headerCheckbox = screen.getAllByRole('checkbox')[0];
    if (headerCheckbox) {
      fireEvent.click(headerCheckbox);
    }
    // All rows should have aria-selected=true
    expect(screen.getAllByRole('row', { selected: true })).toHaveLength(walls.length);
  });

  it('deselects all when clicking header again', () => {
    render(<SelectableTable />);
    const headerCheckbox = screen.getAllByRole('checkbox')[0];
    if (headerCheckbox) {
      fireEvent.click(headerCheckbox); // select all
      fireEvent.click(headerCheckbox); // deselect all
    }
    expect(screen.queryAllByRole('row', { selected: true })).toHaveLength(0);
  });
});

// ── Skeleton ──────────────────────────────────────────────────────────────────

describe('Table — skeleton', () => {
  it('renders 8 skeleton rows by default', () => {
    render(
      <Table.Root>
        <Table.Header>
          <tr><Table.Head>Mã</Table.Head></tr>
        </Table.Header>
        <Table.Body>
          <Table.Skeleton columns={1} />
        </Table.Body>
      </Table.Root>
    );
    // 8 body rows + 1 header row = 9
    expect(screen.getAllByRole('row')).toHaveLength(9);
  });

  it('renders custom number of skeleton rows', () => {
    render(
      <Table.Root>
        <Table.Body>
          <Table.Skeleton columns={3} rows={4} />
        </Table.Body>
      </Table.Root>
    );
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });
});

// ── Empty & Error states ──────────────────────────────────────────────────────

describe('Table empty and error states', () => {
  it('renders empty state message', () => {
    render(
      <Table.Root>
        <Table.Body>
          <Table.Empty colSpan={2} message="Không có tường nào" />
        </Table.Body>
      </Table.Root>
    );
    expect(screen.getByText('Không có tường nào')).toBeInTheDocument();
  });

  it('renders error message and retry button', () => {
    const retry = vi.fn();
    render(
      <Table.Root>
        <Table.Body>
          <Table.Error colSpan={2} message="Lỗi kết nối" onRetry={retry} />
        </Table.Body>
      </Table.Root>
    );
    expect(screen.getByText('Lỗi kết nối')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Thử lại')[0]!);
    expect(retry).toHaveBeenCalledOnce();
  });
});

// ── Virtualization DOM node count ─────────────────────────────────────────────

describe('Table.Virtual DOM node count', () => {
  const rows500 = Array.from({ length: 500 }, (_, i) => ({
    id: `#W-${String(i + 1).padStart(3, '0')}`,
    from: `#V-${i}`,
    to: `#V-${i + 1}`,
    thickness_mm: 110,
    confidence: 0.9,
    review_state: 'pending' as ReviewState,
  }));

  it('renders far fewer than 500 DOM rows (virtualization working)', () => {
    const { container } = render(
      <div style={{ height: 400, overflow: 'auto' }}>
        <table>
          <Table.Virtual
            rows={rows500}
            estimateSize={40}
            colSpan={2}
            renderRow={(row) => (
              <Table.Row key={row.id}>
                <Table.Cell>{row.id}</Table.Cell>
                <Table.Cell>{row.thickness_mm}</Table.Cell>
              </Table.Row>
            )}
          />
        </table>
      </div>
    );
    const bodyRows = container.querySelectorAll('[data-testid="table-virtual-body"] tr');
    // With 400px height and 40px rows, expect ~10-20 rendered rows + padding rows (not 500)
    // Padding rows add 2, visible rows add ~15 (10 visible + 5 overscan = 15 + padding = ≤ 20)
    expect(bodyRows.length).toBeLessThan(50);
    // console.info(`[Virtual] DOM rows rendered: ${bodyRows.length} / 500`);
  });
});

// ── No uppercase in header ────────────────────────────────────────────────────

describe('Table header casing', () => {
  it('header text is not all uppercase', () => {
    render(
      <Table.Root>
        <Table.Header>
          <tr>
            <Table.Head>Mã tường</Table.Head>
            <Table.Head>Độ dày</Table.Head>
          </tr>
        </Table.Header>
        <Table.Body />
      </Table.Root>
    );
    const headers = screen.getAllByRole('columnheader');
    headers.forEach((h) => {
      const text = h.textContent ?? '';
      // Should not be purely uppercase (would fail if text is "MÃ TƯỜNG")
      expect(text).not.toMatch(/^[A-ZÀÁẢÃẠĂẮẶẰẲẴÂẤẬẦẨẪĐÊẾỆỀỂỄÔỐỘỒỔỖƠỚỢỜỞỠƯỨỰỪỬỮ\s]+$/u);
    });
  });
});
