/**
 * Khối 4 — Hoá đơn. File anh em của `BillingScreen.tsx` (mục D, R-22).
 * Dưới 1024: bảng đổi thành thẻ (bố cục).
 */
import { Download, Inbox } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Table } from '@/components/ui/Table';

import type { BillingInvoicePage, BillingInvoiceRow, InvoiceStatus } from './BillingScreen';

const STATUS_BADGE_VARIANT: Readonly<Record<InvoiceStatus, 'neutral' | 'attention' | 'violation'>> = {
  paid: 'neutral',
  pending: 'attention',
  overdue: 'violation',
};

function InvoiceStatusBadge({ row }: { readonly row: BillingInvoiceRow }) {
  return <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{row.statusLabel}</Badge>;
}

function InvoiceDownloadButton({ row }: { readonly row: BillingInvoiceRow }) {
  return (
    <IconButton
      size="sm"
      icon={<Download size={18} aria-hidden="true" />}
      aria-label={row.downloadLabel}
      onClick={row.onDownload}
    />
  );
}

function InvoiceCard({ row }: { readonly row: BillingInvoiceRow }) {
  return (
    <li className="rounded-xl border border-border-default bg-bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-semibold text-text-primary">{row.codeLabel}</span>
        <InvoiceStatusBadge row={row} />
      </div>
      <dl className="mt-3 flex flex-col gap-1.5 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Kỳ</dt>
          <dd className="text-text-primary">{row.periodLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Diện tích</dt>
          <dd className="font-mono tabular-nums text-text-primary">{row.areaLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Số tiền</dt>
          <dd className="font-mono tabular-nums text-text-primary">{row.amountLabel}</dd>
        </div>
      </dl>
      <div className="mt-3 flex justify-end">
        <InvoiceDownloadButton row={row} />
      </div>
    </li>
  );
}

function InvoiceTableHeader() {
  return (
    <tr>
      <Table.Head>Mã</Table.Head>
      <Table.Head>Kỳ</Table.Head>
      <Table.Head>Diện tích</Table.Head>
      <Table.Head className="text-right">Số tiền</Table.Head>
      <Table.Head>Trạng thái</Table.Head>
      <Table.Head>
        <span className="sr-only">Tải PDF</span>
      </Table.Head>
    </tr>
  );
}

function InvoiceTableBody({ invoices }: { readonly invoices: readonly BillingInvoiceRow[] }) {
  return (
    <Table.Root>
      <Table.Header>
        <InvoiceTableHeader />
      </Table.Header>
      <Table.Body>
        {invoices.map((row) => (
          <Table.Row key={row.id}>
            <Table.Cell>{row.codeLabel}</Table.Cell>
            <Table.Cell>{row.periodLabel}</Table.Cell>
            <Table.Cell className="font-mono tabular-nums">{row.areaLabel}</Table.Cell>
            <Table.Cell className="text-right font-mono tabular-nums">{row.amountLabel}</Table.Cell>
            <Table.Cell>
              <InvoiceStatusBadge row={row} />
            </Table.Cell>
            <Table.Cell>
              <InvoiceDownloadButton row={row} />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

function InvoicesPagination({ invoicePage }: { readonly invoicePage: BillingInvoicePage }) {
  return (
    <div className="mt-4 flex w-full items-center justify-between">
      <span className="text-[13px] text-text-secondary">{invoicePage.label}</span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={invoicePage.onPrevious} disabled={invoicePage.index <= 1}>
          Trang trước
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={invoicePage.onNext}
          disabled={invoicePage.index >= invoicePage.count}
        >
          Trang sau
        </Button>
      </div>
    </div>
  );
}

export interface InvoiceTableSectionProps {
  readonly invoices: readonly BillingInvoiceRow[];
  readonly invoicePage: BillingInvoicePage;
  readonly degradedMessage: string | null;
  readonly isLoading: boolean;
  readonly isEmpty: boolean;
}

export function InvoiceTableSection({
  invoices,
  invoicePage,
  degradedMessage,
  isLoading,
  isEmpty,
}: InvoiceTableSectionProps) {
  return (
    <section className="w-full max-w-[960px] rounded-xl bg-bg-surface p-6">
      {degradedMessage !== null && <InlineAlert level="attention" message={degradedMessage} className="mb-4" />}
      <h2 className="text-[20px] font-semibold text-text-primary">Hoá đơn</h2>
      {isEmpty ? (
        <EmptyState
          className="mt-4 h-auto"
          icon={<Inbox aria-hidden="true" />}
          title="Chưa có hoá đơn nào"
          description="Hoá đơn sẽ xuất hiện ở đây sau khi bạn bắt đầu số hoá bản vẽ."
        />
      ) : isLoading ? (
        <div className="mt-4">
          <Table.Root>
            <Table.Header>
              <InvoiceTableHeader />
            </Table.Header>
            <Table.Body>
              <Table.Skeleton columns={6} rows={8} />
            </Table.Body>
          </Table.Root>
        </div>
      ) : (
        <>
          <div className="mt-4 hidden lg:block">
            <InvoiceTableBody invoices={invoices} />
          </div>
          <ul className="mt-4 flex flex-col gap-3 lg:hidden">
            {invoices.map((row) => (
              <InvoiceCard key={row.id} row={row} />
            ))}
          </ul>
          <InvoicesPagination invoicePage={invoicePage} />
        </>
      )}
    </section>
  );
}
