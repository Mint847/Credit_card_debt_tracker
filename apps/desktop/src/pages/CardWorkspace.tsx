// One card's workspace: header with the card and its numbers, then Overview, Activity, Recurring,
// Budgets, Calculators and Billing & statements as tabs
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type SortingState } from '@tanstack/react-table';
import {
  SPEND_CATEGORIES, spendCategory, entryLabel, sortedLedger, activeRecurring, monthlyRecurringTotal, recurringNextDue, isCancelled,
  calcCashAdvance, calcSurchargeAPR, cardFee, cashAdvanceApr, cardMinRule, daysBetween
} from '@serendib/core';
import { useApp, deleteEntry, togglePaused } from '../lib/store';
import { amountDueNow, cardApr, cardCycle, cardName, cardPayoff, cardPeriod, minPaymentFor, today, util } from '../lib/derive';
import { fmtAmt, fmtShort, longDate, pct, shortDate } from '../lib/format';
import { categoryHex } from '../lib/colors';
import { Chip, Empty, Icon, Panel, Segmented, Tip, UtilBar, useToast } from '../components/ui';
import { usePlan, useWorkspace } from '../components/Shell';
import { CardFace } from './Cards';
import type { Card, Entry, Recurring } from '../lib/types';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'activity', label: 'Activity' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'budgets', label: 'Budgets' },
  { value: 'calculators', label: 'Calculators' },
  { value: 'billing', label: 'Billing & statements' }
];

export function CardWorkspace() {
  const { id } = useParams();
  const app = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const card = app.cards.find((c) => c.id === id);
  const tab = params.get('tab') || 'overview';
  if (!card) return <Empty icon="credit_card_off" title="Card not found" body="It may have been removed on another device." />;
  return (
    <div className="mx-auto max-w-[1440px] px-8 py-7">
      <Header card={card} />
      <Tabs.Root value={tab} onValueChange={(v) => setParams(v === 'overview' ? {} : { tab: v }, { replace: true })} className="mt-6">
        <Tabs.List className="flex gap-1 border-b border-line" aria-label="Card sections">
          {TABS.map((t) => (
            <Tabs.Trigger key={t.value} value={t.value}
              className="-mb-px border-b-2 border-transparent px-3 pb-2.5 pt-1 text-[13px] font-semibold text-faint transition-colors hover:text-ink data-[state=active]:border-brand data-[state=active]:text-ink">
              {t.label}
              {t.value === 'activity' && <span className="num ml-1.5 text-[11px] font-medium text-faint">{card.ledger.length}</span>}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="pt-5">
          <Tabs.Content value="overview"><OverviewTab card={card} /></Tabs.Content>
          <Tabs.Content value="activity"><ActivityTab card={card} focusSearch={params.get('search') === '1'} /></Tabs.Content>
          <Tabs.Content value="recurring"><RecurringTab card={card} /></Tabs.Content>
          <Tabs.Content value="budgets"><BudgetsTab card={card} /></Tabs.Content>
          <Tabs.Content value="calculators"><CalculatorsTab card={card} /></Tabs.Content>
          <Tabs.Content value="billing"><BillingTab card={card} /></Tabs.Content>
        </div>
      </Tabs.Root>
      <button type="button" className="sr-only" onClick={() => navigate('/cards')}>Back to cards</button>
    </div>
  );
}

function Header({ card }: { card: Card }) {
  const p = usePlan();
  const { openLog } = useWorkspace();
  const u = util(card);
  const st = cardCycle(card);
  const due = amountDueNow(card);
  const rank = p.order.findIndex((c) => c.id === card.id);
  return (
    <div className="flex gap-7">
      <CardFace card={card} className="w-[280px] shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-[30px] font-medium leading-tight tracking-tight">{card.bank} {card.nick}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip>{cardApr(card)}% APR</Chip>
              <Chip>Min {Math.round(cardMinRule(card).pct * 100)}% or {fmtAmt(cardMinRule(card).floor)}</Chip>
              {card.statementDay && <Chip icon="description">Statement day {card.statementDay}</Chip>}
              {card.dueDay && <Chip icon="event">Due day {card.dueDay}</Chip>}
              {rank === 0 && <Chip tone="info" icon="flag">Pay first</Chip>}
              {st?.overdue && <Chip tone="danger" icon="error">Overdue {st.overdue.days} days</Chip>}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn-outline" onClick={() => openLog({ type: 'purchase', cardId: card.id })}><Icon name="shopping_bag" size={18} />Log spend</button>
            <button type="button" className="btn-primary" onClick={() => openLog({ type: 'payment', cardId: card.id, prefill: due || undefined })}><Icon name="payments" size={18} />Log payment</button>
            <Dropdown.Root>
              <Dropdown.Trigger className="btn-outline w-9 justify-center px-0" aria-label="More actions"><Icon name="more_horiz" /></Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content align="end" sideOffset={6} className="z-50 w-56 rounded-xl border border-line bg-panel p-1.5 shadow-pop">
                  {[
                    ['edit', 'Edit card'], ['event_repeat', 'Billing cycle'], ['fact_check', 'Match my statement'], ['ios_share', 'Share progress'],
                    ['done_all', 'Clear balance'], ['delete', 'Delete card']
                  ].map(([icon, label]) => (
                    <Dropdown.Item key={label} className={'flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none data-[highlighted]:bg-sunken ' + (icon === 'delete' ? 'text-danger' : '')}>
                      <Icon name={icon} size={18} className={icon === 'delete' ? '' : 'text-faint'} />{label}
                      <span className="ml-auto text-[10px] text-faint">Phase 3</span>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </div>
        </div>
        <div className="mt-auto grid grid-cols-4 gap-6 pt-5">
          <div><p className="label">Balance</p><p className="num mt-1 text-[24px] font-bold tracking-tight">{fmtAmt(card.balance)}</p></div>
          <div>
            <p className="label">Utilisation</p>
            <p className={'num mt-1 text-[24px] font-bold tracking-tight ' + (u >= 75 ? 'text-danger' : '')}>{pct(u)}</p>
            <UtilBar value={u} className="mt-1" />
          </div>
          <div><p className="label">Due now</p><p className={'num mt-1 text-[24px] font-bold tracking-tight ' + (st?.overdue ? 'text-danger' : '')}>{fmtAmt(due)}</p>
            <p className="text-[12px] text-faint">{st?.next ? 'by ' + shortDate(st.next.s.due) : st?.overdue ? 'since ' + shortDate(st.overdue.since) : 'Nothing due'}</p></div>
          <div><p className="label">This month’s plan</p><p className="num mt-1 text-[24px] font-bold tracking-tight text-brand-ink">{fmtAmt(p.alloc[card.id] || 0)}</p>
            <p className="text-[12px] text-faint">{p.order.length > 1 && rank >= 0 ? '#' + (rank + 1) + ' of ' + p.order.length + ' in your plan' : ''}</p></div>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ card }: { card: Card }) {
  const p = usePlan();
  const { period, summary } = cardPeriod(card);
  const st = cardCycle(card);
  const plan = p.alloc[card.id] || 0;
  const po = cardPayoff(card, plan);
  const cats = Object.keys(summary.byCat).filter((k) => summary.byCat[k] > 0).sort((a, b) => summary.byCat[b] - summary.byCat[a]);
  const max = Math.max(1, ...cats.map((k) => summary.byCat[k]));
  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2 space-y-5">
        <Panel title={'This cycle · ' + shortDate(period.start) + ' – ' + shortDate(period.end)}
          action={<span className="text-[12px] text-faint">{period.hasCycle ? daysBetween(today(), period.end) + ' days to statement' : 'Calendar month (no billing cycle set)'}</span>}>
          <div className="grid grid-cols-3 gap-4 border-b border-line pb-4">
            <div><p className="text-[12px] text-faint">Spent</p><p className="num text-[18px] font-bold">{fmtAmt(summary.spent)}</p></div>
            <div><p className="text-[12px] text-faint">Payments</p><p className="num text-[18px] font-bold text-ok">{fmtAmt(summary.payments)}</p></div>
            <div><p className="text-[12px] text-faint">Top merchant</p><p className="truncate text-[15px] font-semibold">{summary.topMerchants[0]?.name || '—'}</p></div>
          </div>
          {cats.length === 0 ? <Empty icon="shopping_bag" title="No spending this cycle" /> : (
            <ul className="mt-4 space-y-2.5">
              {cats.map((k) => {
                const b = (card.budgets || {})[k];
                return (
                  <li key={k} className="grid grid-cols-[150px_1fr_110px] items-center gap-4 text-[13px]">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: categoryHex(k) }} />{spendCategory(k).label}</span>
                    <div className="relative h-2 rounded-full bg-sunken">
                      <div className="h-full rounded-full" style={{ width: (summary.byCat[k] / max) * 100 + '%', background: categoryHex(k) }} />
                    </div>
                    <span className="num text-right font-medium">{fmtAmt(summary.byCat[k])}{b ? <span className="block text-[11px] font-normal text-faint">of {fmtShort(b)}</span> : null}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Payoff">
          <div className="grid grid-cols-2 gap-4">
            {[
              { title: 'On your plan', amt: plan, r: po.plan, tone: 'text-brand-ink' },
              { title: 'Minimums only', amt: card.balance > 0 ? minPaymentFor(card) : 0, r: po.min, tone: 'text-muted' }
            ].map((x) => (
              <div key={x.title} className="rounded-xl border border-line p-4">
                <p className="text-[12px] font-semibold text-faint">{x.title}</p>
                <p className={'num mt-1 text-[20px] font-bold ' + x.tone}>{fmtAmt(x.amt)}<span className="text-[12px] font-medium text-faint"> / month</span></p>
                <div className="mt-3 flex justify-between text-[12px]">
                  <span className="text-faint">Paid off in</span>
                  <span className="num font-semibold">{x.r.months === Infinity ? 'Never' : x.r.months + ' months'}</span>
                </div>
                <div className="mt-1 flex justify-between text-[12px]">
                  <span className="text-faint">Total interest</span>
                  <span className="num font-semibold">{x.r.totalInterest === Infinity ? '—' : fmtAmt(x.r.totalInterest)}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="space-y-5">
        <Panel title="Statement status">
          {!st ? <Empty icon="event_repeat" title={card.statementDay ? 'Tracking starts next statement' : 'No billing cycle'} body="Set the statement and due days to track minimums and get due-date alerts." /> : (
            <div className="space-y-3">
              {st.overdue && (
                <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                  <p className="text-[13px] font-semibold text-danger">{fmtAmt(st.overdue.amount)} overdue since {shortDate(st.overdue.since)}</p>
                  <p className="mt-0.5 text-[12px] text-muted">{st.overdue.days} days past due. Accounts 90 days past due are reported to CRIB.</p>
                </div>
              )}
              {st.rows.slice(-3).reverse().map((r: { s: { date: string; due: string; minDue: number }; paid: number; remaining: number }) => (
                <div key={r.s.date} className="flex items-center gap-3 text-[13px]">
                  <Icon name={r.remaining <= 0.5 ? 'check_circle' : r.s.due < today() ? 'error' : 'schedule'} fill
                    className={r.remaining <= 0.5 ? 'text-ok' : r.s.due < today() ? 'text-danger' : 'text-warn'} />
                  <div className="flex-1">
                    <p className="font-medium">Statement {shortDate(r.s.date)}</p>
                    <p className="text-[11px] text-faint">Min {fmtAmt(r.s.minDue)} · due {shortDate(r.s.due)}</p>
                  </div>
                  <span className="num text-[12px] font-semibold">{r.remaining <= 0.5 ? 'Paid' : fmtAmt(r.remaining) + ' left'}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Recurring" action={<span className="num text-[12px] font-semibold">{fmtAmt(monthlyRecurringTotal(card, today()))} / mo</span>}>
          {activeRecurring(card, today()).length === 0 ? <p className="text-[13px] text-faint">No recurring payments on this card.</p> : (
            <ul className="space-y-2">
              {activeRecurring(card, today()).map((r: Recurring) => (
                <li key={r.id} className="flex items-center justify-between text-[13px]">
                  <span className={r.paused ? 'text-faint' : ''}>{r.name}{r.paused ? ' · paused' : ''}</span>
                  <span className="num">{fmtAmt(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

const ecol = createColumnHelper<Entry>();
type TypeFilter = 'all' | 'purchase' | 'payment' | 'refund' | 'adjustment';

function ActivityTab({ card, focusSearch }: { card: Card; focusSearch: boolean }) {
  const { openLog } = useWorkspace();
  const toast = useToast();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [cat, setCat] = useState('all');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusSearch) search.current?.focus(); }, [focusSearch]);

  const data = useMemo(() => sortedLedger(card).filter((e: Entry) =>
    (type === 'all' || e.type === type) && (cat === 'all' || e.category === cat) &&
    (!q || (entryLabel(e) + ' ' + (e.note || '') + ' ' + e.amount).toLowerCase().includes(q.toLowerCase()))
  ), [card, card.ledger.length, card.balance, type, cat, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    ecol.accessor('date', { header: 'Date', cell: (i) => <span className="num text-faint">{shortDate(i.getValue())}</span> }),
    ecol.accessor((e) => entryLabel(e), {
      id: 'desc', header: 'Description',
      cell: (i) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{i.getValue()}</span>
          {i.row.original.source === 'sms' && <Chip>SMS</Chip>}
          {i.row.original.source === 'recurring' && <Chip icon="autorenew">Recurring</Chip>}
          {i.row.original.note && <span className="truncate text-[12px] text-faint">{i.row.original.note}</span>}
        </span>
      )
    }),
    ecol.accessor((e) => e.category || '', {
      id: 'category', header: 'Category',
      cell: (i) => i.getValue()
        ? <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-sm" style={{ background: categoryHex(i.getValue()) }} />{spendCategory(i.getValue()).label}</span>
        : <span className="capitalize text-faint">{i.row.original.type}</span>
    }),
    ecol.accessor((e) => (e.type === 'purchase' ? 1 : e.type === 'adjustment' ? Math.sign(e.amount) : -1) * Math.abs(e.amount), {
      id: 'amount', header: 'Amount', meta: { right: true },
      cell: (i) => {
        const v = i.getValue() as number;
        return <span className={'num font-semibold ' + (v < 0 ? 'text-ok' : '')}>{v < 0 ? '−' : ''}{fmtAmt(Math.abs(v))}</span>;
      }
    }),
    ecol.display({
      id: 'actions', header: '',
      cell: (i) => (
        <span className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Tip label="Edit"><button type="button" className="btn-ghost h-7 w-7 justify-center px-0" aria-label="Edit entry"
            onClick={(ev) => { ev.stopPropagation(); openLog({ editing: { id: i.row.original.id, cardId: card.id } }); }}><Icon name="edit" size={16} /></button></Tip>
          <Tip label="Delete"><button type="button" className="btn-ghost h-7 w-7 justify-center px-0 hover:text-danger" aria-label="Delete entry"
            onClick={(ev) => {
              ev.stopPropagation();
              const undo = deleteEntry(card.id, i.row.original.id);
              if (undo) toast('Entry deleted. The balance was updated.', { action: { label: 'Undo', run: undo } });
            }}><Icon name="delete" size={16} /></button></Tip>
        </span>
      )
    })
  ], [card.id, openLog, toast]);

  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel() });

  function exportCsv() {
    const rows = [['Date', 'Type', 'Description', 'Category', 'Amount (LKR)', 'Note']].concat(
      data.map((e: Entry) => [e.date, e.type, entryLabel(e), e.category ? spendCategory(e.category).label : '', String(e.amount), e.note || '']));
    const csv = rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = cardName(card).trim().replace(/\s+/g, '-') + '-history.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="relative w-72">
          <Icon name="search" size={18} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this card’s history" className="field pl-9" />
        </div>
        <Segmented size="sm" value={type} onChange={setType}
          options={[{ value: 'all', label: 'All' }, { value: 'purchase', label: 'Spending' }, { value: 'payment', label: 'Payments' }, { value: 'refund', label: 'Refunds' }, { value: 'adjustment', label: 'Adjustments' }]} />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="field w-44">
          <option value="all">All categories</option>
          {SPEND_CATEGORIES.map((c: { key: string; label: string }) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <span className="ml-auto text-[12px] text-faint">{data.length} entries</span>
        <button type="button" className="btn-outline h-8" onClick={exportCsv}><Icon name="download" size={16} />CSV</button>
      </div>
      {data.length === 0 ? <Empty icon="receipt_long" title="No entries match" body="Try a different search or filter." /> : (
        <table className="w-full text-[13px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line bg-sunken/60">
                {hg.headers.map((h) => {
                  const right = (h.column.columnDef.meta as { right?: boolean } | undefined)?.right;
                  const sorted = h.column.getIsSorted();
                  return (
                    <th key={h.id} className={'px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-faint ' + (right ? 'text-right' : 'text-left')}>
                      {h.column.getCanSort() && h.id !== 'actions' ? (
                        <button type="button" onClick={h.column.getToggleSortingHandler()} className={'inline-flex items-center gap-1 hover:text-ink ' + (sorted ? 'text-ink' : '')}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted && <Icon name={sorted === 'asc' ? 'arrow_upward' : 'arrow_downward'} size={14} />}
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="group cursor-pointer border-b border-line last:border-0 hover:bg-sunken" onClick={() => openLog({ editing: { id: r.original.id, cardId: card.id } })}>
                {r.getVisibleCells().map((cell) => {
                  const right = (cell.column.columnDef.meta as { right?: boolean } | undefined)?.right;
                  return <td key={cell.id} className={'px-4 py-2.5 ' + (right ? 'text-right' : '') + (cell.column.id === 'actions' ? ' w-20' : '')}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RecurringTab({ card }: { card: Card }) {
  const t = today();
  const items = card.recurring || [];
  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="panel col-span-2 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="panel-title">Recurring payments</p>
          <Tip label="Built in Phase 3"><button type="button" className="btn-outline h-8"><Icon name="add" size={16} />Add recurring</button></Tip>
        </div>
        {items.length === 0 ? <Empty icon="autorenew" title="No recurring payments" body="Subscriptions and bills charged every month are logged for you on their day." /> : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-sunken/60 text-left text-[11px] font-semibold uppercase tracking-wider text-faint">
                <th className="px-5 py-2">Name</th><th className="py-2">Category</th><th className="py-2">Day</th><th className="py-2">Next charge</th><th className="py-2 text-right">Amount</th><th className="px-5 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const cancelled = isCancelled(r, t);
                const next = !cancelled && !r.paused ? recurringNextDue(r, t) : null;
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="py-3 text-muted"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: categoryHex(r.category) }} />{spendCategory(r.category).label}</span></td>
                    <td className="num py-3 text-muted">Day {r.day}</td>
                    <td className="num py-3 text-muted">{next ? shortDate(next) : '—'}</td>
                    <td className="num py-3 text-right font-semibold">{fmtAmt(r.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      {cancelled ? <Chip>Cancelled</Chip> : (
                        <button type="button" onClick={() => togglePaused(card.id, r.id)} className="group inline-flex items-center gap-2">
                          <Chip tone={r.paused ? 'warn' : 'ok'}>{r.paused ? 'Paused' : 'Active'}</Chip>
                          <span className="text-[12px] font-semibold text-brand-ink opacity-0 transition-opacity group-hover:opacity-100">{r.paused ? 'Resume' : 'Pause'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Panel title="Each month">
        <p className="num text-[24px] font-bold">{fmtAmt(monthlyRecurringTotal(card, t))}</p>
        <p className="mt-1 text-[12px] text-faint">from {activeRecurring(card, t).filter((r: Recurring) => !r.paused).length} active payments. Charges are logged automatically on their day; paused ones are skipped.</p>
      </Panel>
    </div>
  );
}

function BudgetsTab({ card }: { card: Card }) {
  const { period, summary } = cardPeriod(card);
  const budgets = card.budgets || {};
  const keys = SPEND_CATEGORIES.map((c: { key: string }) => c.key);
  const set = keys.filter((k: string) => budgets[k]);
  const unset = keys.filter((k: string) => !budgets[k]);
  return (
    <div className="grid grid-cols-3 gap-5">
      <Panel className="col-span-2" title={'Budgets · ' + shortDate(period.start) + ' – ' + shortDate(period.end)}
        action={<Tip label="Built in Phase 3"><button type="button" className="btn-outline h-8"><Icon name="tune" size={16} />Set budgets</button></Tip>}>
        {set.length === 0 ? <Empty icon="savings" title="No budgets yet" body="Set a monthly limit per category and you’ll be warned before you go over." /> : (
          <ul className="space-y-4">
            {set.map((k: string) => {
              const spent = summary.byCat[k] || 0, b = budgets[k], ratio = spent / b;
              return (
                <li key={k}>
                  <div className="mb-1.5 flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: categoryHex(k) }} />{spendCategory(k).label}</span>
                    <span className="num"><span className="font-semibold">{fmtAmt(spent)}</span><span className="text-faint"> of {fmtAmt(b)}</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-sunken">
                    <div className={'h-full rounded-full ' + (ratio > 1 ? 'bg-danger' : ratio >= 0.9 ? 'bg-warn' : 'bg-ok')} style={{ width: Math.min(100, ratio * 100) + '%' }} />
                  </div>
                  <p className={'mt-1 text-[11px] ' + (ratio > 1 ? 'text-danger' : 'text-faint')}>{ratio > 1 ? fmtAmt(spent - b) + ' over' : fmtAmt(b - spent) + ' left'}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Panel title="No budget set">
        <ul className="space-y-2">
          {unset.map((k: string) => (
            <li key={k} className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 text-muted"><span className="h-2 w-2 rounded-sm" style={{ background: categoryHex(k) }} />{spendCategory(k).label}</span>
              <span className="num text-faint">{summary.byCat[k] ? fmtAmt(summary.byCat[k]) + ' spent' : ''}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function NumField({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="relative mt-1">
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="field num pr-12" />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-faint">{suffix}</span>}
      </div>
    </label>
  );
}

function ResultRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <span className="text-faint">{label}</span>
      <span className={'num ' + (strong ? 'text-[15px] font-bold' : 'font-medium')}>{value}</span>
    </div>
  );
}

// The card page's three calculators, side by side instead of swiped
function CalculatorsTab({ card }: { card: Card }) {
  const p = usePlan();
  const [pay, setPay] = useState(String(Math.round(p.alloc[card.id] || minPaymentFor(card) || 0)));
  const [cash, setCash] = useState('50000');
  const [days, setDays] = useState('30');
  const [price, setPrice] = useState('150000');
  const [sur, setSur] = useState('6');
  const [tenure, setTenure] = useState('12');

  const po = cardPayoff(card, parseFloat(pay) || 0);
  const ca = calcCashAdvance(parseFloat(cash) || 0, parseInt(days, 10) || 0, card);
  const sa = calcSurchargeAPR(parseFloat(price) || 0, (parseFloat(sur) || 0) / 100, parseInt(tenure, 10) || 1);
  const months = (m: number) => (m === Infinity ? 'Never' : m + (m === 1 ? ' month' : ' months'));

  return (
    <div className="grid grid-cols-3 gap-5">
      <Panel title="Payoff">
        <p className="-mt-1 mb-4 text-[12px] text-faint">How long {fmtAmt(card.balance)} takes at {cardApr(card)}% APR.</p>
        <NumField label="Monthly payment" value={pay} onChange={setPay} suffix="LKR" />
        <div className="mt-4 divide-y divide-line border-t border-line pt-2">
          <ResultRow label="Paid off in" value={months(po.plan.months)} strong />
          <ResultRow label="Total interest" value={po.plan.totalInterest === Infinity ? '—' : fmtAmt(po.plan.totalInterest)} />
          <ResultRow label="On minimums" value={months(po.min.months)} />
          <ResultRow label="Interest on minimums" value={po.min.totalInterest === Infinity ? '—' : fmtAmt(po.min.totalInterest)} />
        </div>
      </Panel>
      <Panel title="Cash advance">
        <p className="-mt-1 mb-4 text-[12px] text-faint">Fee {fmtAmt(cardFee(card, parseFloat(cash) || 0))} plus {cashAdvanceApr(card)}% APR from day one.</p>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Amount" value={cash} onChange={setCash} suffix="LKR" />
          <NumField label="Days until repaid" value={days} onChange={setDays} suffix="days" />
        </div>
        <div className="mt-4 divide-y divide-line border-t border-line pt-2">
          <ResultRow label="Advance fee" value={fmtAmt(ca.advanceFee)} />
          <ResultRow label="Interest" value={fmtAmt(ca.interest)} />
          <ResultRow label="Total to repay" value={fmtAmt(ca.total)} strong />
        </div>
      </Panel>
      <Panel title="0% surcharge">
        <p className="-mt-1 mb-4 text-[12px] text-faint">The interest hidden in a “0%” plan’s handling fee.</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3"><NumField label="Price" value={price} onChange={setPrice} suffix="LKR" /></div>
          <div className="col-span-2"><NumField label="Handling fee" value={sur} onChange={setSur} suffix="%" /></div>
          <NumField label="Months" value={tenure} onChange={setTenure} />
        </div>
        <div className="mt-4 divide-y divide-line border-t border-line pt-2">
          <ResultRow label="Monthly instalment" value={fmtAmt(sa.monthly)} />
          <ResultRow label="Fee" value={fmtAmt(sa.surchargeAmt)} />
          <ResultRow label="Real yearly rate" value={pct(sa.apr, 1)} strong />
          <ResultRow label="Compounded (effective)" value={pct(sa.effectiveAPR, 1)} />
        </div>
      </Panel>
    </div>
  );
}

function BillingTab({ card }: { card: Card }) {
  const st = cardCycle(card);
  return (
    <div className="grid grid-cols-3 gap-5">
      <Panel title="Billing cycle" action={<Tip label="Built in Phase 3"><button type="button" className="btn-outline h-8"><Icon name="edit" size={16} />Change</button></Tip>}>
        <div className="space-y-3 text-[13px]">
          <div className="flex justify-between"><span className="text-faint">Statement day</span><span className="font-semibold">{card.statementDay ? 'Day ' + card.statementDay : 'Not set'}</span></div>
          <div className="flex justify-between"><span className="text-faint">Payment due day</span><span className="font-semibold">{card.dueDay ? 'Day ' + card.dueDay : 'Not set'}</span></div>
          <div className="flex justify-between"><span className="text-faint">Tracking since</span><span className="font-semibold">{card.cycleTrackedFrom ? longDate(card.cycleTrackedFrom) : '—'}</span></div>
        </div>
        <p className="mt-4 border-t border-line pt-3 text-[12px] text-faint">Each statement’s minimum is recorded on its statement day. Payments logged after it count towards it, oldest first.</p>
      </Panel>
      <div className="panel col-span-2 overflow-hidden">
        <p className="panel-title border-b border-line px-5 py-3">Statements</p>
        {!st ? <Empty icon="description" title="No statements recorded yet" /> : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-sunken/60 text-left text-[11px] font-semibold uppercase tracking-wider text-faint">
                <th className="px-5 py-2">Statement</th><th className="py-2 text-right">Balance</th><th className="py-2 text-right">Minimum</th><th className="py-2 text-right">Paid</th><th className="py-2">Due</th><th className="px-5 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {st.rows.slice().reverse().map((r: { s: { date: string; due: string; balance: number; minDue: number }; paid: number; remaining: number }) => {
                const done = r.remaining <= 0.5, late = !done && r.s.due < today();
                return (
                  <tr key={r.s.date} className="border-b border-line last:border-0">
                    <td className="num px-5 py-3 font-medium">{longDate(r.s.date)}</td>
                    <td className="num py-3 text-right">{fmtAmt(r.s.balance)}</td>
                    <td className="num py-3 text-right">{fmtAmt(r.s.minDue)}</td>
                    <td className="num py-3 text-right text-muted">{fmtAmt(r.paid)}</td>
                    <td className="num py-3 text-muted">{shortDate(r.s.due)}</td>
                    <td className="px-5 py-3 text-right"><Chip tone={done ? 'ok' : late ? 'danger' : 'warn'}>{done ? 'Paid' : late ? 'Overdue' : fmtAmt(r.remaining) + ' left'}</Chip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

