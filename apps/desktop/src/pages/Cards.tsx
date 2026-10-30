// Cards: every card in a sortable table; picking a row opens the inspector on the right
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, getFilteredRowModel, useReactTable, type SortingState } from '@tanstack/react-table';
import { daysBetween, isValidDay } from '@serendib/core';
import { useApp } from '../lib/store';
import { amountDueNow, cardApr, cardCycle, cardName, cardPayoff, cardTheme, minPaymentFor, today, util } from '../lib/derive';
import { fmtAmt, fmtShort, pct, shortDate } from '../lib/format';
import { CardTile, Chip, Icon, UtilBar, type Tone } from '../components/ui';
import { usePlan, useWorkspace } from '../components/Shell';
import { useCardDialogs } from '../components/CardDialogs';
import type { Card } from '../lib/types';
import { useLayout } from '../lib/layout';

interface Row {
  card: Card;
  name: string;
  balance: number;
  limit: number;
  util: number;
  apr: number;
  min: number;
  plan: number;
  due: string | null;
  status: { tone: Tone; label: string };
}

function statusOf(c: Card): { tone: Tone; label: string; due: string | null } {
  const st = cardCycle(c);
  if (!(c.balance > 0)) return { tone: 'ok', label: 'Paid off', due: null };
  if (st?.overdue) return { tone: 'danger', label: 'Overdue ' + st.overdue.days + 'd', due: st.overdue.since };
  if (st?.next) {
    const d = daysBetween(today(), st.next.s.due);
    return { tone: d <= 3 ? 'warn' : 'neutral', label: d === 0 ? 'Due today' : 'Due in ' + d + 'd', due: st.next.s.due };
  }
  if (st) return { tone: 'ok', label: 'Minimum paid', due: null };
  if (!isValidDay(c.statementDay)) return { tone: 'neutral', label: 'No billing cycle', due: null };
  return { tone: 'neutral', label: 'Tracking', due: null };
}

const col = createColumnHelper<Row>();

export function Cards() {
  const app = useApp();
  const p = usePlan();
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState('');
  const layout = useLayout();
  const compact = layout !== 'desktop';
  const [selectedId, setSelectedId] = useState<string | null>(compact ? null : app.cards[0]?.id || null);
  const openDialog = useCardDialogs();

  const rows = useMemo<Row[]>(() => app.cards.map((c) => {
    const s = statusOf(c);
    return {
      card: c, name: c.bank + ' ' + c.nick + ' ' + (c.last4 || ''), balance: c.balance, limit: c.limit, util: util(c), apr: cardApr(c),
      min: c.balance > 0 ? minPaymentFor(c) : 0, plan: p.alloc[c.id] || 0, due: s.due, status: { tone: s.tone, label: s.label }
    };
  }), [app, p]);

  // Columns by screen width. With the inspector open, what it already shows leaves the table:
  // under 1440 px Card, Balance, Utilisation and Status; under 1680 px also Plan; wider, everything
  const w = useWidth(), open = !!selectedId;
  const showLimit = !open || w >= 1440;
  const columnVisibility = {
    apr: w >= 1680 || (!open && w >= 1440), min: w >= 1680 || (!open && w >= 1440),
    plan: !open || w >= 1440, due: !open || w >= 1680
  };

  const columns = useMemo(() => [
    col.accessor('name', {
      header: 'Card',
      cell: (i) => {
        const c = i.row.original.card;
        return (
          <div className="flex items-center gap-3">
            <CardTile card={c} />
            <div className="min-w-0">
              <p className="max-w-[180px] truncate font-semibold">{cardName(c)}</p>
              <p className="max-w-[180px] truncate text-[12px] text-faint">{c.bank}{c.last4 ? ' ·· ' + c.last4 : ''}</p>
            </div>
          </div>
        );
      }
    }),
    col.accessor('balance', { header: 'Balance', cell: (i) => <span className="num font-semibold">{fmtAmt(i.getValue())}</span>, meta: { right: true } }),
    col.accessor('util', {
      header: 'Utilisation',
      cell: (i) => (
        <div className="flex items-center gap-2.5">
          <div className="w-16 shrink-0"><UtilBar value={i.getValue()} /></div>
          <span className={'num w-9 text-right text-[12px] font-semibold ' + (i.getValue() >= 75 ? 'text-danger' : i.getValue() >= 30 ? 'text-warn' : 'text-ok')}>{pct(i.getValue())}</span>
          {showLimit && <span className="num text-[12px] text-faint">of {fmtShort(i.row.original.limit).replace('LKR ', '')}</span>}
        </div>
      )
    }),
    col.accessor('apr', { header: 'APR', cell: (i) => <span className="num">{i.getValue()}%</span>, meta: { right: true } }),
    col.accessor('min', { header: 'Minimum', cell: (i) => <span className="num text-muted">{fmtAmt(i.getValue())}</span>, meta: { right: true } }),
    col.accessor('plan', { header: 'Plan', cell: (i) => <span className="num font-medium text-brand-ink">{fmtAmt(i.getValue())}</span>, meta: { right: true } }),
    col.accessor('due', { header: 'Next due', cell: (i) => <span className="num text-muted">{i.getValue() ? shortDate(i.getValue() as string) : '—'}</span>, sortUndefined: 'last' }),
    col.accessor((r) => r.status.label, { id: 'status', header: 'Status', cell: (i) => <Chip tone={i.row.original.status.tone}>{i.row.original.status.label}</Chip> })
  ], [showLimit]);

  const table = useReactTable({
    data: rows, columns, state: { sorting, globalFilter: filter, columnVisibility }, onSortingChange: setSorting, onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _id, value) => row.original.name.toLowerCase().includes(String(value).toLowerCase())
  });

  const selected = app.cards.find((c) => c.id === selectedId) || null;

  if (compact) return <CardList rows={rows} onAdd={() => openDialog({ kind: 'add' })} />;
  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-7 tablet:px-6 tablet:py-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="font-serif text-[30px] font-medium leading-tight tracking-tight">Cards</h1>
            <p className="mt-1 text-[13px] text-faint">{app.cards.length} cards · {fmtAmt(p.totalDebt)} owed of {fmtAmt(p.totalLimit)}</p>
          </div>
          <div className="flex gap-2">
            <div className="relative tablet:hidden">
              <Icon name="filter_list" size={18} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter cards" className="field w-56 pl-9" />
            </div>
            <button type="button" className="btn-primary" data-tip="add-card" onClick={() => openDialog({ kind: 'add' })}><Icon name="add" size={18} />Add card</button>
          </div>
        </div>

        <div className="panel overflow-x-auto" data-tip="cards-table">
          <table className="w-full whitespace-nowrap text-[13px]">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-line bg-sunken/60">
                  {hg.headers.map((h) => {
                    const right = (h.column.columnDef.meta as { right?: boolean } | undefined)?.right;
                    const sorted = h.column.getIsSorted();
                    return (
                      <th key={h.id} className={'px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint ' + (right ? 'text-right' : 'text-left')}>
                        <button type="button" onClick={h.column.getToggleSortingHandler()} className={'inline-flex items-center gap-1 hover:text-ink ' + (sorted ? 'text-ink' : '')}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <Icon name={sorted === 'asc' ? 'arrow_upward' : sorted === 'desc' ? 'arrow_downward' : 'unfold_more'} size={14} className={sorted ? '' : 'opacity-40'} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((r) => {
                const isSel = r.original.card.id === selectedId;
                return (
                  <tr key={r.id} tabIndex={0} aria-selected={isSel}
                    onClick={() => compact ? navigate('/cards/' + r.original.card.id) : setSelectedId(r.original.card.id)}
                    onDoubleClick={() => navigate('/cards/' + r.original.card.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate('/cards/' + r.original.card.id); if (e.key === ' ') { e.preventDefault(); setSelectedId(r.original.card.id); } }}
                    className={'cursor-pointer border-b border-line last:border-0 outline-none focus-visible:bg-sunken ' + (isSel ? 'bg-brand/5' : 'hover:bg-sunken')}>
                    {r.getVisibleCells().map((cell) => {
                      const right = (cell.column.columnDef.meta as { right?: boolean } | undefined)?.right;
                      return <td key={cell.id} className={'px-3.5 py-3 ' + (right ? 'text-right' : '')}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-sunken/60 text-[12px] font-semibold">
                <td className="px-4 py-2.5 text-faint">Total</td>
                <td className="num px-4 py-2.5 text-right">{fmtAmt(p.totalDebt)}</td>
                <td className="px-4 py-2.5 text-muted">{pct(p.totalLimit ? (p.totalDebt / p.totalLimit) * 100 : 0)} of {fmtShort(p.totalLimit)}</td>
                {columnVisibility.apr && <td />}
                {columnVisibility.min && <td />}
                {columnVisibility.plan && <td className="num px-4 py-2.5 text-right text-brand-ink">{fmtAmt(p.commitment)}</td>}
                {columnVisibility.due && <td />}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-faint">{compact ? 'Tap a card to open it.' : 'Click a row to inspect it, double-click or press Enter to open the card.'}</p>
      </div>
      {selected && <Inspector card={selected} plan={p.alloc[selected.id] || 0} rank={p.order.findIndex((c) => c.id === selected.id)} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

// Phones and iPads: each card as a tile with its balance, this month's plan and utilisation
function CardList({ rows, onAdd }: { rows: Row[]; onAdd: () => void }) {
  const app = useApp();
  const p = usePlan();
  const navigate = useNavigate();
  const totalUtil = p.totalLimit ? (p.totalDebt / p.totalLimit) * 100 : 0;
  return (
    <div className="space-y-4 px-4 py-5 tablet:space-y-5 tablet:px-6 tablet:py-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-[27px] font-medium leading-tight tracking-tight tablet:text-[30px]">Cards</h1>
          <p className="mt-1 text-[13px] text-faint">{app.cards.length} cards · {pct(totalUtil)} used</p>
        </div>
        <button type="button" className="btn-primary" data-tip="add-card" onClick={onAdd}><Icon name="add" size={18} />Add card</button>
      </div>
      <div className="panel grid grid-cols-2 gap-px overflow-hidden bg-line tablet:grid-cols-4">
        <div className="bg-panel px-4 py-3"><p className="label">Total owed</p><p className="num mt-1 text-[19px] font-bold">{fmtAmt(p.totalDebt)}</p></div>
        <div className="bg-panel px-4 py-3"><p className="label">This month</p><p className="num mt-1 text-[19px] font-bold text-brand-ink">{fmtAmt(p.commitment)}</p></div>
        <div className="hidden bg-panel px-4 py-3 tablet:block"><p className="label">Total limit</p><p className="num mt-1 text-[19px] font-bold">{fmtAmt(p.totalLimit)}</p></div>
        <div className="hidden bg-panel px-4 py-3 tablet:block"><p className="label">Available</p><p className="num mt-1 text-[19px] font-bold">{fmtAmt(Math.max(0, p.totalLimit - p.totalDebt))}</p></div>
      </div>
      <ul className="space-y-3 tablet:grid tablet:grid-cols-2 tablet:gap-4 tablet:space-y-0" data-tip="cards-table">
        {rows.map((r) => {
          const c = r.card;
          const rank = p.order.findIndex((x) => x.id === c.id);
          return (
            <li key={c.id}>
              <button type="button" onClick={() => navigate('/cards/' + c.id)} className="panel block w-full p-4 text-left active:bg-sunken">
                <div className="flex items-center gap-3">
                  <CardTile card={c} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{cardName(c)}</p>
                    <p className="truncate text-[12px] text-faint">{c.bank}{c.last4 ? ' ·· ' + c.last4 : ''}</p>
                  </div>
                  <Chip tone={r.status.tone}>{r.status.label}</Chip>
                </div>
                <div className="mt-3.5 flex items-end justify-between">
                  <div><p className="label">Balance</p><p className="num mt-0.5 text-[21px] font-bold tracking-tight">{fmtAmt(c.balance)}</p></div>
                  {c.balance > 0 && (
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-faint">{rank === 0 ? 'Pay first · ' : ''}This month</p>
                      <p className="num mt-0.5 text-[15px] font-semibold text-brand-ink">{fmtAmt(r.plan)}</p>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <UtilBar value={r.util} />
                  <span className={'num shrink-0 text-[12px] font-semibold ' + (r.util >= 75 ? 'text-danger' : r.util >= 30 ? 'text-warn' : 'text-ok')}>{pct(r.util)}</span>
                  <span className="num shrink-0 text-[12px] text-faint">of {fmtShort(c.limit).replace('LKR ', '')}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The card visual: its colour as a gradient, bank, name and last four digits
export function CardFace({ card, className = '' }: { card: Card; className?: string }) {
  const t = cardTheme(card);
  return (
    <div className={'relative aspect-[1.586] overflow-hidden rounded-2xl p-5 text-white shadow-pop ' + className}
      style={{ background: `linear-gradient(135deg, ${t.hex} 0%, ${t.ink} 100%)` }}>
      <div className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-black/10" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <p className="text-[12px] font-semibold opacity-90">{card.bank}</p>
          <Icon name="contactless" className="opacity-80" />
        </div>
        <div>
          <p className="num text-[15px] tracking-[0.2em] opacity-90">•••• {card.last4 || '····'}</p>
          <p className="mt-1 text-[16px] font-semibold">{card.nick}</p>
        </div>
      </div>
    </div>
  );
}

function Inspector({ card, plan, rank, onClose }: { card: Card; plan: number; rank: number; onClose: () => void }) {
  const navigate = useNavigate();
  const { openLog } = useWorkspace();
  const u = util(card);
  const st = cardCycle(card);
  const po = cardPayoff(card, plan);
  const due = amountDueNow(card);
  return (
    <aside className="scroll-thin w-[344px] shrink-0 overflow-y-auto border-l border-line bg-panel" aria-label={'Details for ' + cardName(card)}>
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <p className="label">Card details</p>
        <button type="button" className="btn-ghost h-7 w-7 justify-center px-0" onClick={onClose} aria-label="Close details"><Icon name="close" size={18} /></button>
      </div>
      <div className="px-5">
        <CardFace card={card} />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div><p className="text-[11px] text-faint">Balance</p><p className="num text-[20px] font-bold">{fmtAmt(card.balance)}</p></div>
          <div><p className="text-[11px] text-faint">Available</p><p className="num text-[20px] font-bold text-muted">{fmtAmt(Math.max(0, card.limit - card.balance))}</p></div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[12px]"><span className="text-faint">Utilisation</span><span className="num font-semibold">{pct(u)} of {fmtShort(card.limit)}</span></div>
          <UtilBar value={u} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-primary justify-center" onClick={() => openLog({ type: 'payment', cardId: card.id, prefill: due || undefined })}><Icon name="payments" size={18} />Log payment</button>
          <button type="button" className="btn-outline justify-center" onClick={() => openLog({ type: 'purchase', cardId: card.id })}><Icon name="shopping_bag" size={18} />Log spend</button>
        </div>
      </div>

      <dl className="mt-5 divide-y divide-line border-y border-line text-[13px]">
        {[
          ['Due now', st?.overdue ? <span className="font-semibold text-danger">{fmtAmt(due)} overdue</span> : fmtAmt(due)],
          ['Next due date', st?.next ? shortDate(st.next.s.due) : '—'],
          ['Statement day', card.statementDay ? 'Day ' + card.statementDay : 'Not set'],
          ['This month’s plan', <span className="text-brand-ink">{fmtAmt(plan)}{rank === 0 ? ' · pay first' : ''}</span>],
          ['Minimum', fmtAmt(card.balance > 0 ? minPaymentFor(card) : 0)],
          ['APR', cardApr(card) + '%'],
          ['Paid off on plan', po.plan.months === Infinity ? 'Never' : po.plan.months + ' months'],
          ['Paid off on minimums', po.min.months === Infinity ? 'Never' : po.min.months + ' months']
        ].map(([k, v], i) => (
          <div key={i} className="flex items-center justify-between px-5 py-2.5">
            <dt className="text-faint">{k}</dt>
            <dd className="num font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="p-5">
        <button type="button" className="btn-outline w-full justify-center" onClick={() => navigate('/cards/' + card.id)}>Open card<Icon name="arrow_forward" size={18} /></button>
      </div>
    </aside>
  );
}

function useWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}
