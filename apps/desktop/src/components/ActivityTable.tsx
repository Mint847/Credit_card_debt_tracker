// Entries as a sortable, filterable table: one card (the card page's Activity tab) or every card
// (the Activity screen). Same filters, search, edit, delete with Undo and CSV as the phone app's
// spending history; older months kept as totals are listed under the table.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from '@tanstack/react-table';
import { SPEND_CATEGORIES, spendCategory, entryLabel, sortedLedger, suggestNorm, ledgerCsv, ledgerCsvFileName, parseYmd, ymd } from '@serendib/core';
import { deleteEntry } from '../lib/store';
import { cardName } from '../lib/derive';
import { fmtAmt, shortDate } from '../lib/format';
import { categoryHex } from '../lib/colors';
import { CardDot, Chip, Empty, Icon, Segmented, Tip, useToast } from './ui';
import { useWorkspace } from './Shell';
import type { Card, Entry } from '../lib/types';

interface Row { e: Entry; card: Card }
type TypeFilter = 'all' | 'purchase' | 'payment' | 'refund' | 'adjustment';
const col = createColumnHelper<Row>();

// Spending counts up, payments and refunds down, adjustments carry their sign
function signed(e: Entry) { return (e.type === 'purchase' ? 1 : e.type === 'adjustment' ? Math.sign(e.amount) : -1) * Math.abs(e.amount); }

export function ActivityTable({ cards, single, focusSearch }: { cards: Card[]; single?: boolean; focusSearch?: boolean }) {
  const { openLog } = useWorkspace();
  const toast = useToast();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [cat, setCat] = useState('all');
  const [cardId, setCardId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusSearch) search.current?.focus(); }, [focusSearch]);

  const shownCards = single ? cards : cardId === 'all' ? cards : cards.filter((c) => c.id === cardId);
  const text = suggestNorm(q);
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    shownCards.forEach((card) => sortedLedger(card).forEach((e: Entry) => {
      if (type !== 'all' && e.type !== type) return;
      if (cat !== 'all' && e.category !== cat) return;
      if (from && e.date < from) return;
      if (to && e.date > to) return;
      if (text && suggestNorm((e.merchant || '') + ' ' + (e.note || '')).indexOf(text) === -1) return;
      out.push({ e, card });
    }));
    return out;
  }, [shownCards, type, cat, from, to, text, cards.map((c) => (c.ledger || []).length + ':' + c.balance).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = type !== 'all' || cat !== 'all' || !!from || !!to || !!text;
  const total = (cards || []).reduce((n, c) => n + (c.ledger || []).length, 0);

  const columns = useMemo(() => [
    col.accessor((r) => r.e.date, { id: 'date', header: 'Date', cell: (i) => <span className="num text-faint">{shortDate(i.getValue())}</span> }),
    col.accessor((r) => entryLabel(r.e), {
      id: 'desc', header: 'Description',
      cell: (i) => {
        const e = i.row.original.e;
        return (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{i.getValue()}</span>
            {e.source === 'sms' && <Chip>SMS</Chip>}
            {e.source === 'recurring' && <Chip icon="autorenew">Recurring</Chip>}
            {e.note && e.source !== 'recurring' && <span className="truncate text-[12px] text-faint">{e.note}</span>}
          </span>
        );
      }
    }),
    col.accessor((r) => r.e.category || '', {
      id: 'category', header: 'Category',
      cell: (i) => i.getValue()
        ? <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-sm" style={{ background: categoryHex(i.getValue()) }} />{spendCategory(i.getValue()).label}</span>
        : <span className="capitalize text-faint">{i.row.original.e.type}</span>
    }),
    ...(single ? [] : [col.accessor((r) => cardName(r.card), {
      id: 'card', header: 'Card',
      cell: (i) => <span className="flex items-center gap-1.5 text-muted"><CardDot card={i.row.original.card} size={8} /><span className="truncate">{i.getValue()}</span></span>
    })]),
    col.accessor((r) => signed(r.e), {
      id: 'amount', header: 'Amount', meta: { right: true },
      cell: (i) => { const v = i.getValue() as number; return <span className={'num font-semibold ' + (v < 0 ? 'text-ok' : '')}>{v < 0 ? '−' : ''}{fmtAmt(Math.abs(v))}</span>; }
    }),
    col.display({
      id: 'actions', header: '',
      cell: (i) => {
        const { e, card } = i.row.original;
        return (
          <span className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Tip label="Edit"><button type="button" className="btn-ghost h-7 w-7 justify-center px-0" aria-label="Edit entry"
              onClick={(ev) => { ev.stopPropagation(); openLog({ editing: { id: e.id, cardId: card.id } }); }}><Icon name="edit" size={16} /></button></Tip>
            <Tip label="Delete"><button type="button" className="btn-ghost h-7 w-7 justify-center px-0 hover:text-danger" aria-label="Delete entry"
              onClick={(ev) => {
                ev.stopPropagation();
                const undo = deleteEntry(card.id, e.id);
                if (undo) toast('Entry deleted', { action: { label: 'Undo', run: undo } });
              }}><Icon name="delete" size={16} /></button></Tip>
          </span>
        );
      }
    })
  ], [single, openLog, toast]);

  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  // The phone app's Export CSV: one card's full history
  const csvCard = shownCards.length === 1 ? shownCards[0] : null;
  function exportCsv() {
    if (!csvCard) return;
    const blob = new Blob(['﻿' + ledgerCsv(csvCard)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ledgerCsvFileName(csvCard, ymd(new Date()));
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // Months older than two years are kept as totals only
  const archive = csvCard && !filtered ? Object.keys(csvCard.ledgerArchive || {}).sort().reverse() : [];

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="relative w-64">
          <Icon name="search" size={18} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchant or note" aria-label="Search" className="field pl-9" />
        </div>
        {!single && (
          <select value={cardId} onChange={(e) => setCardId(e.target.value)} className="field w-48" aria-label="Card">
            <option value="all">All cards</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{cardName(c)}</option>)}
          </select>
        )}
        <Segmented size="sm" value={type} onChange={setType}
          options={[{ value: 'all', label: 'All' }, { value: 'purchase', label: 'Purchases' }, { value: 'payment', label: 'Payments' }, { value: 'refund', label: 'Refunds' }, { value: 'adjustment', label: 'Adjustments' }]} />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="field w-44" aria-label="Category">
          <option value="all">All categories</option>
          {SPEND_CATEGORIES.map((c: { key: string; label: string }) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <div className="flex items-center gap-1.5 text-[12px] text-faint">
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="field h-9 w-36" aria-label="From date" />
          to
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="field h-9 w-36" aria-label="To date" />
        </div>
        <span className="ml-auto text-[12px] text-faint">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
        <Tip label={csvCard ? 'Download ' + cardName(csvCard) + '’s history' : 'Pick one card to export its history'}>
          <span><button type="button" className="btn-outline h-8" disabled={!csvCard} onClick={exportCsv}><Icon name="download" size={16} />Export CSV</button></span>
        </Tip>
      </div>
      {rows.length === 0 ? <Empty icon="receipt_long" title={total ? 'No entries match.' : single ? 'Nothing logged on this card yet.' : 'Nothing logged yet.'} body={total ? 'Try a different search or filter.' : undefined} /> : (
        <table className="w-full table-fixed text-[13px]">
          <colgroup>
            <col className="w-24" /><col /><col className="w-44" />{!single && <col className="w-48" />}<col className="w-32" /><col className="w-20" />
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line bg-sunken/60">
                {hg.headers.map((h) => {
                  const right = (h.column.columnDef.meta as { right?: boolean } | undefined)?.right;
                  const sorted = h.column.getIsSorted();
                  return (
                    <th key={h.id} className={'px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-faint ' + (right ? 'text-right' : 'text-left')}>
                      {h.id !== 'actions' ? (
                        <button type="button" onClick={h.column.getToggleSortingHandler()} className={'inline-flex items-center gap-1 hover:text-ink ' + (sorted ? 'text-ink' : '')}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted && <Icon name={sorted === 'asc' ? 'arrow_upward' : 'arrow_downward'} size={14} />}
                        </button>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.original.card.id + r.original.e.id} className="group cursor-pointer border-b border-line last:border-0 hover:bg-sunken"
                onClick={() => openLog({ editing: { id: r.original.e.id, cardId: r.original.card.id } })}>
                {r.getVisibleCells().map((cell) => {
                  const right = (cell.column.columnDef.meta as { right?: boolean } | undefined)?.right;
                  return <td key={cell.id} className={'overflow-hidden px-4 py-2.5 ' + (right ? 'text-right' : '')}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {archive.length > 0 && csvCard && (
        <div className="border-t border-line px-4 py-3">
          <p className="mb-1.5 text-[12px] font-semibold">Older months (totals only)</p>
          <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-[12px]">
            {archive.map((m) => {
              const a = (csvCard.ledgerArchive || {})[m];
              return (
                <div key={m} className="flex justify-between">
                  <span>{parseYmd(m + '-01').toLocaleString('en-US', { month: 'short', year: 'numeric' })}</span>
                  <span className="num text-faint">{fmtAmt(a.spent || 0)} spent · {fmtAmt(a.payments || 0)} paid</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
