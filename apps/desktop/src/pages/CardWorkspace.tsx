// One card's workspace: header with the card and its numbers, then Overview, Activity, Recurring,
// Budgets, Calculators and Billing & statements as tabs
import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import {
  SPEND_CATEGORIES, spendCategory, activeRecurring, monthlyRecurringTotal, recurringNextDue, isCancelled,
  calcSurchargeAPR, cardFee, cashAdvanceApr, cardMinRule, daysBetween, payoffStart, payoffPreset, cardPayoffSim, cardAdvanceSim,
  CARD_SURCHARGE_TENURES, fmtLKR, fmtPct
} from '@serendib/core';
import { useApp, togglePaused, saveTarget } from '../lib/store';
import { useCardDialogs } from '../components/CardDialogs';
import { ActivityTable } from '../components/ActivityTable';
import { amountDueNow, cardApr, cardCycle, cardPayoff, cardPeriod, cardTheme, minPaymentFor, today, util } from '../lib/derive';
import { fmtAmt, fmtShort, longDate, pct, shortDate } from '../lib/format';
import { categoryHex } from '../lib/colors';
import { BUDGET_COLORS, Chip, Empty, Icon, Meter, Panel, UtilBar, useToast } from '../components/ui';
import { usePlan, useWorkspace } from '../components/Shell';
import { CardFace } from './Cards';
import type { Card, Recurring } from '../lib/types';
import { useLayout } from '../lib/layout';

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
  // The card's own colour, used by the phone design (the selected tab)
  const accent = { '--card': cardTheme(card).hex, '--card-soft': cardTheme(card).soft } as CSSProperties;
  return (
    <div className="mx-auto max-w-[1440px] px-8 py-7 tablet:px-6 tablet:py-6 phone:px-4 phone:py-4" style={accent}>
      <Header card={card} />
      <Tabs.Root value={tab} onValueChange={(v) => setParams(v === 'overview' ? {} : { tab: v }, { replace: true })} className="mt-6 phone:mt-5">
        <Tabs.List className="flex gap-1 border-b border-line phone:-mx-4 phone:gap-2 phone:overflow-x-auto phone:border-b-0 phone:px-4 phone:pb-1 phone:[scrollbar-width:none]" aria-label="Card sections" data-tip="card-tabs">
          {TABS.map((t) => (
            <Tabs.Trigger key={t.value} value={t.value}
              className="-mb-px border-b-2 border-transparent px-3 pb-2.5 pt-1 text-[13px] font-semibold phone:mb-0 phone:shrink-0 phone:whitespace-nowrap phone:rounded-full phone:border-b-0 phone:bg-panel phone:px-4 phone:py-2 phone:text-[14px] phone:shadow-card text-faint transition-colors hover:text-ink data-[state=active]:border-brand data-[state=active]:text-ink phone:data-[state=active]:bg-[var(--card-soft)] phone:data-[state=active]:text-ink">
              {t.label}
              {t.value === 'activity' && <span className="num ml-1.5 text-[11px] font-medium text-faint phone:text-current phone:opacity-75">{(card.ledger || []).length}</span>}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="pt-5 phone:pt-4">
          <Tabs.Content value="overview"><OverviewTab card={card} /></Tabs.Content>
          <Tabs.Content value="activity"><ActivityTable cards={[card]} single focusSearch={params.get('search') === '1'} /></Tabs.Content>
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
  const openDialog = useCardDialogs();
  const u = util(card);
  const st = cardCycle(card);
  const due = amountDueNow(card);
  const rank = p.order.findIndex((c) => c.id === card.id);
  return (
    <div className="flex gap-7 tablet:gap-6 phone:flex-col phone:gap-4">
      <CardFace card={card} className="w-[280px] shrink-0 tablet:w-[230px] tablet:self-start phone:mx-auto phone:w-full phone:max-w-[340px]" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4 tablet:flex-col tablet:gap-3 phone:flex-col phone:gap-3.5">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-[30px] font-medium leading-tight tracking-tight tablet:text-[26px] phone:whitespace-normal phone:text-[24px]">{card.bank} {card.nick}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip>{cardApr(card)}% APR</Chip>
              <Chip>Min {Math.round(cardMinRule(card).pct * 100)}% or {fmtAmt(cardMinRule(card).floor)}</Chip>
              {card.statementDay && <Chip icon="description">Statement day {card.statementDay}</Chip>}
              {card.dueDay && <Chip icon="event">Due day {card.dueDay}</Chip>}
              {rank === 0 && <Chip tone="info" icon="flag">Pay first</Chip>}
              {st?.overdue && (
                <button type="button" onClick={() => openDialog({ kind: 'catchup', cardId: card.id })} className="inline-flex items-center gap-1.5">
                  <Chip tone="danger" icon="error">Overdue {st.overdue.days} days</Chip>
                  <span className="text-[12px] font-semibold text-danger hover:underline">Catch up</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2 phone:w-full [&>button:not(:last-child)]:phone:flex-1 [&>button]:phone:justify-center" data-tip="card-log">
            <button type="button" className="btn-outline" onClick={() => openLog({ type: 'purchase', cardId: card.id })}><Icon name="shopping_bag" size={18} />Log spend</button>
            <button type="button" className="btn-primary" onClick={() => openLog({ type: 'payment', cardId: card.id, prefill: due || undefined })}><Icon name="payments" size={18} />Log payment</button>
            <Dropdown.Root>
              <Dropdown.Trigger className="btn-outline w-9 justify-center px-0" aria-label="More actions" data-tip="card-menu"><Icon name="more_horiz" /></Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content align="end" sideOffset={6} className="z-50 w-56 rounded-xl border border-line bg-panel p-1.5 shadow-pop">
                  {([
                    ['edit', 'Edit card', 'edit'], ['event_repeat', 'Billing cycle', 'billing'], ['fact_check', 'Match my statement', 'match'],
                    ['savings', 'Category budgets', 'budgets'], ['ios_share', 'Share progress', 'share'],
                    ...(card.balance > 0 ? [['done_all', 'Clear balance', 'settle']] : []), ['delete', 'Delete card', 'delete']
                  ] as [string, string, 'edit' | 'billing' | 'match' | 'budgets' | 'share' | 'settle' | 'delete'][]).map(([icon, label, kind]) => (
                    <Dropdown.Item key={label} onSelect={() => openDialog({ kind, cardId: card.id })}
                      className={'flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none data-[highlighted]:bg-sunken ' + (icon === 'delete' ? 'text-danger' : '')}>
                      <Icon name={icon} size={18} className={icon === 'delete' ? '' : 'text-faint'} />{label}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </div>
        </div>
        <div data-tip="card-stats" className="mt-auto grid grid-cols-4 gap-6 pt-5 tablet:grid-cols-2 tablet:gap-x-6 tablet:gap-y-4 phone:grid-cols-2 phone:gap-x-4 phone:gap-y-4 phone:pt-4 [&_p.num]:phone:text-[20px]">
          <div><p className="label">Balance</p><p className="num mt-1 text-[24px] font-bold tracking-tight">{fmtAmt(card.balance)}</p></div>
          <div>
            <p className="label">Utilisation</p>
            <p className={'num mt-1 text-[24px] font-bold tracking-tight ' + (u >= 75 ? 'text-danger' : '')}>{pct(u)}</p>
            <UtilBar value={u} card={card} className="mt-1" />
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
    <div className="grid grid-cols-3 gap-5 compact:grid-cols-1 phone:gap-4">
      <div className="col-span-2 compact:col-span-1 space-y-5">
        <Panel tip="card-cycle" title={'This cycle · ' + shortDate(period.start) + ' – ' + shortDate(period.end)}
          action={<span className="text-[12px] text-faint">{period.hasCycle ? daysBetween(today(), period.end) + ' days to statement' : 'Calendar month (no billing cycle set)'}</span>}>
          <div className="grid grid-cols-3 gap-4 border-b border-line pb-4 phone:gap-3 phone:border-b-0 [&_p.num]:phone:text-[16px]">
            <div><p className="text-[12px] text-faint">Spent</p><p className="num text-[18px] font-bold">{fmtAmt(summary.spent)}</p></div>
            <div><p className="text-[12px] text-faint">Payments</p><p className="num text-[18px] font-bold text-ok">{fmtAmt(summary.payments)}</p></div>
            <div><p className="text-[12px] text-faint">Top merchant</p><p className="truncate text-[15px] font-semibold">{summary.topMerchants[0]?.name || '—'}</p></div>
          </div>
          {cats.length === 0 ? <Empty icon="shopping_bag" title="No spending this cycle" /> : (
            <ul className="mt-4 space-y-2.5">
              {cats.map((k) => {
                const b = (card.budgets || {})[k];
                return (
                  <li key={k} className="grid grid-cols-[150px_1fr_110px] items-center gap-4 text-[13px] phone:grid-cols-[1fr_72px_auto] phone:gap-3">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: categoryHex(k) }} />{spendCategory(k).label}</span>
                    <div className="relative h-2 rounded-full bg-sunken">
                      <div className="meter-reveal h-full rounded-full" style={{ width: (summary.byCat[k] / max) * 100 + '%', background: categoryHex(k) }} />
                    </div>
                    <span className="num text-right font-medium">{fmtAmt(summary.byCat[k])}{b ? <span className="block text-[11px] font-normal text-faint">of {fmtShort(b)}</span> : null}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Payoff">
          <div className="grid grid-cols-2 gap-4 phone:grid-cols-1 phone:gap-3">
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

function RecurringTab({ card }: { card: Card }) {
  const layout = useLayout();
  const t = today();
  const openDialog = useCardDialogs();
  const toast = useToast();
  const items = card.recurring || [];
  return (
    <div className="grid grid-cols-3 gap-5 compact:grid-cols-1 phone:gap-4">
      <div className="panel col-span-2 compact:col-span-1 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="panel-title">Recurring payments</p>
          <button type="button" className="btn-outline h-8" onClick={() => openDialog({ kind: 'recurring', cardId: card.id })}><Icon name="add" size={16} />Add recurring</button>
        </div>
        {items.length === 0 ? <Empty icon="autorenew" title="No recurring payments" body="Subscriptions and bills charged every month are logged for you on their day." /> : layout === 'phone' ? (
          <ul>
            {items.map((r) => {
              const cancelled = isCancelled(r, t);
              const next = !cancelled && !r.paused ? recurringNextDue(r, t) : null;
              return (
                <li key={r.id} className="border-b border-line last:border-0">
                  <button type="button" onClick={() => openDialog({ kind: 'recurring', cardId: card.id, itemId: r.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-sunken">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sunken" style={{ color: categoryHex(r.category) }}><Icon name={spendCategory(r.category).icon} size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{r.name}</span>
                      <span className="block truncate text-[12px] text-faint">Day {r.day}{next ? ' · next ' + shortDate(next) : ''}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="num text-[14px] font-semibold">{fmtAmt(r.amount)}</span>
                      <Chip tone={cancelled ? 'neutral' : r.paused ? 'warn' : 'ok'}>{cancelled ? 'Cancelled' : r.paused ? 'Paused' : 'Active'}</Chip>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
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
                  <tr key={r.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-sunken" onClick={() => openDialog({ kind: 'recurring', cardId: card.id, itemId: r.id })}>
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="py-3 text-muted"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: categoryHex(r.category) }} />{spendCategory(r.category).label}</span></td>
                    <td className="num py-3 text-muted">Day {r.day}</td>
                    <td className="num py-3 text-muted">{next ? shortDate(next) : '—'}</td>
                    <td className="num py-3 text-right font-semibold">{fmtAmt(r.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      {cancelled ? <Chip>Cancelled</Chip> : (
                        <button type="button" onClick={(e) => {
                          e.stopPropagation();
                          const d = togglePaused(card.id, r.id);
                          if (d.text) toast(d.text, { action: d.undo ? { label: 'Undo', run: d.undo } : undefined });
                        }} className="group inline-flex items-center gap-2">
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
  const phone = useLayout() === 'phone';
  const { period, summary } = cardPeriod(card);
  const openDialog = useCardDialogs();
  const budgets = card.budgets || {};
  const keys = SPEND_CATEGORIES.map((c: { key: string }) => c.key);
  const set = keys.filter((k: string) => budgets[k]);
  const unset = keys.filter((k: string) => !budgets[k]);
  return (
    <div className="grid grid-cols-3 gap-5 compact:grid-cols-1 phone:gap-4">
      <Panel className="col-span-2 compact:col-span-1" title={'Budgets · ' + shortDate(period.start) + ' – ' + shortDate(period.end)}
        action={<button type="button" className="btn-outline h-8" onClick={() => openDialog({ kind: 'budgets', cardId: card.id })}><Icon name="tune" size={16} />Set budgets</button>}>
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
                  {phone ? <Meter value={ratio * 100} colors={BUDGET_COLORS} className="!h-2" /> : (
                  <div className="h-2 overflow-hidden rounded-full bg-sunken">
                    <div className={'h-full rounded-full ' + (ratio > 1 ? 'bg-danger' : ratio >= 0.9 ? 'bg-warn' : 'bg-ok')} style={{ width: Math.min(100, ratio * 100) + '%' }} />
                  </div>
                  )}
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

// The card page's three calculators, side by side instead of swiped. Numbers and wording come
// from the shared core (simulators.js), as on the phone's card page.
function CalculatorsTab({ card }: { card: Card }) {
  const toast = useToast();
  const start = payoffStart(card);
  const [pay, setPay] = useState(start.value);
  const [cash, setCash] = useState('');
  const [price, setPrice] = useState('');
  const [sur, setSur] = useState('3');
  const [tenure, setTenure] = useState(6);
  useEffect(() => { setPay(payoffStart(card).value); }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sim = cardPayoffSim(card, pay);
  const adv = cardAdvanceSim(card, parseFloat(cash));
  const amt = parseFloat(price), pct = parseFloat(sur) / 100;
  const sc = amt >= 1 && !isNaN(pct) && pct >= 0 ? calcSurchargeAPR(amt, pct, tenure) : null;
  const fill = start.max > start.min ? ((pay - start.min) / (start.max - start.min)) * 100 : 0;
  // Phones: the slider in the card's own colour
  const sliderColor = useLayout() === 'phone' ? cardTheme(card).hex : 'rgb(var(--brand))';

  return (
    <div className="grid grid-cols-3 gap-5 compact:grid-cols-1 phone:gap-4">
      <Panel title="Payoff simulator" action={sim.tag ? <Chip tone="ok">{sim.tag}</Chip> : undefined}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-danger/20 bg-danger/[0.04] p-3">
            <p className="label">Minimum only</p>
            <p className="mt-1 text-[15px] font-bold text-danger">{sim.minDuration}</p>
            <p className="num text-[12px] text-muted">{sim.minInterest} interest</p>
          </div>
          <div className="rounded-xl border border-ok/20 bg-ok/[0.05] p-3">
            <p className="label">Fixed plan</p>
            <p className="mt-1 text-[15px] font-bold text-ok">{sim.planDuration}</p>
            <p className="num text-[12px] text-muted">{sim.planInterest} interest</p>
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="label">Simulate monthly payment</span>
          <span className="num text-[15px] font-bold">{sim.payment}</span>
        </div>
        <input type="range" aria-label="Monthly payment" min={start.min} max={start.max} step={500} value={pay} disabled={sim.paidOff}
          onChange={(e) => setPay(parseFloat(e.target.value))} className="slider mt-2 w-full accent-[rgb(var(--brand))]"
          style={{ accentColor: sliderColor, '--slider': sliderColor, background: 'linear-gradient(to right, ' + sliderColor + ' ' + fill + '%, rgb(var(--sunken)) ' + fill + '%)' } as CSSProperties} />
        <div className="mt-1 flex justify-between text-[11px] font-semibold text-faint">
          {([['min', 'Min'], ['rec', 'Recommended'], ['half', '50%'], ['full', 'Full']] as const).map(([k, l]) => (
            <button key={k} type="button" disabled={sim.paidOff} onClick={() => setPay(payoffPreset(card, k))} className={'hover:text-ink ' + (k === 'rec' ? 'text-brand-ink' : '')}>{l}</button>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-sunken px-3 py-2 text-[12px] text-muted">{sim.headline}</p>
        <button type="button" className="btn-primary mt-3 w-full justify-center" disabled={sim.paidOff}
          onClick={() => toast(saveTarget(card.id, pay).text || '')}><Icon name="add" size={18} />Set automated monthly repayment goal</button>
        <p className="mt-2 text-center text-[11px] text-faint">{card.targetPayment ? 'Saved goal ' + fmtAmt(card.targetPayment) + ' a month. Your plan always pays at least this.' : 'Consistent monthly payments dramatically suppress the CBSL 28% compounding interest cycle.'}</p>
      </Panel>

      <Panel title="Cash advance">
        <p className="-mt-1 mb-4 text-[12px] text-faint">Fee {fmtAmt(cardFee(card, parseFloat(cash) || 0))} plus {cashAdvanceApr(card)}% APR from the day you withdraw.</p>
        <NumField label="Amount to withdraw" value={cash} onChange={setCash} suffix="LKR" />
        {!adv ? <p className="mt-6 text-center text-[12px] text-faint">Enter an amount to see what it costs.</p> : (
          <div className="mt-4 space-y-3">
            <div className="divide-y divide-line border-y border-line">
              <ResultRow label="Withdrawal" value={fmtLKR(adv.principal, 2)} />
              <ResultRow label="Upfront fee" value={fmtLKR(adv.fee, 2)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {adv.rows.map((r: { days: number; total: number; cost: number }) => (
                <div key={r.days} className="rounded-xl border border-line p-3 text-center">
                  <p className="text-[11px] font-semibold text-faint">Repaid in {r.days} days</p>
                  <p className="num mt-1 text-[13px] font-bold">{fmtLKR(r.total, 2)}</p>
                  <p className="num text-[11px] text-danger">+{fmtLKR(r.cost, 2)} cost</p>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-faint">Effective rate over 60 days: <strong className="num text-ink">{adv.effRate}</strong></p>
          </div>
        )}
      </Panel>

      <Panel title="0% surcharge">
        <p className="-mt-1 mb-4 text-[12px] text-faint">The interest hidden in a “0%” plan’s upfront fee.</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><NumField label="Purchase amount" value={price} onChange={setPrice} suffix="LKR" /></div>
          <NumField label="Surcharge" value={sur} onChange={setSur} suffix="%" />
        </div>
        <div role="radiogroup" aria-label="Instalment months" className="mt-3 flex gap-2">
          {CARD_SURCHARGE_TENURES.map((n: number) => (
            <button key={n} type="button" role="radio" aria-checked={tenure === n} onClick={() => setTenure(n)}
              className={'flex-1 rounded-lg border py-1.5 text-[12px] font-semibold ' + (tenure === n ? 'border-brand bg-brand/10 text-brand-ink' : 'border-line text-muted hover:bg-sunken')}>{n} months</button>
          ))}
        </div>
        {!sc ? <p className="mt-6 text-center text-[12px] text-faint">Enter a purchase amount to see its true cost.</p> : (
          <div className="mt-4 divide-y divide-line border-t border-line pt-2">
            <ResultRow label="True yearly rate" value={fmtPct(sc.apr, 1)} strong />
            <ResultRow label="Purchase" value={fmtLKR(amt, 2)} />
            <ResultRow label="Surcharge" value={fmtLKR(sc.surchargeAmt, 2)} />
            <ResultRow label="Total you pay" value={fmtLKR(sc.totalPay, 2)} />
            <ResultRow label={'Monthly over ' + tenure + ' months'} value={fmtLKR(sc.monthly, 2)} />
          </div>
        )}
      </Panel>
    </div>
  );
}

function BillingTab({ card }: { card: Card }) {
  const layout = useLayout();
  const st = cardCycle(card);
  const openDialog = useCardDialogs();
  return (
    <div className="grid grid-cols-3 gap-5 compact:grid-cols-1 phone:gap-4">
      <Panel title="Billing cycle" action={<button type="button" className="btn-outline h-8" onClick={() => openDialog({ kind: 'billing', cardId: card.id })}><Icon name="edit" size={16} />Change</button>}>
        <div className="space-y-3 text-[13px]">
          <div className="flex justify-between"><span className="text-faint">Statement day</span><span className="font-semibold">{card.statementDay ? 'Day ' + card.statementDay : 'Not set'}</span></div>
          <div className="flex justify-between"><span className="text-faint">Payment due day</span><span className="font-semibold">{card.dueDay ? 'Day ' + card.dueDay : 'Not set'}</span></div>
          <div className="flex justify-between"><span className="text-faint">Tracking since</span><span className="font-semibold">{card.cycleTrackedFrom ? longDate(card.cycleTrackedFrom) : '—'}</span></div>
        </div>
        <p className="mt-4 border-t border-line pt-3 text-[12px] text-faint">Each statement’s minimum is recorded on its statement day. Payments logged after it count towards it, oldest first.</p>
      </Panel>
      <div className="panel col-span-2 compact:col-span-1 overflow-hidden">
        <p className="panel-title border-b border-line px-5 py-3">Statements</p>
        {!st ? <Empty icon="description" title="No statements recorded yet" /> : layout === 'phone' ? (
          <ul>
            {st.rows.slice().reverse().map((r: { s: { date: string; due: string; balance: number; minDue: number }; paid: number; remaining: number }) => {
              const done = r.remaining <= 0.5, late = !done && r.s.due < today();
              return (
                <li key={r.s.date} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="num text-[14px] font-medium">{longDate(r.s.date)}</p>
                    <p className="num text-[12px] text-faint">Balance {fmtAmt(r.s.balance)} · min {fmtAmt(r.s.minDue)}</p>
                    <p className="num text-[12px] text-faint">Paid {fmtAmt(r.paid)} · due {shortDate(r.s.due)}</p>
                  </div>
                  <Chip tone={done ? 'ok' : late ? 'danger' : 'warn'}>{done ? 'Paid' : late ? 'Overdue' : fmtAmt(r.remaining) + ' left'}</Chip>
                </li>
              );
            })}
          </ul>
        ) : (
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
