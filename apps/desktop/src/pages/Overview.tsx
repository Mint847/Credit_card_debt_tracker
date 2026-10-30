// Overview: the month at a glance. KPIs, payoff pace, alerts, what's coming up, where the money went
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { daysBetween, sortedLedger, entryLabel, spendCategory } from '@serendib/core';
import { useApp } from '../lib/store';
import { cardName, projection, spendingByCategory, today, upcomingEvents, util } from '../lib/derive';
import { fmtAmt, fmtShort, pct, shortDate } from '../lib/format';
import { categoryHex } from '../lib/colors';
import { CardDot, Chip, Empty, Icon, Panel, UtilBar } from '../components/ui';
import { token, useIsDark } from '../lib/theme';
import { useLayout } from '../lib/layout';
import { EntryList } from '../components/EntryList';
import { VerifyBanner } from '../components/VerifyBanner';
import { AlertList, attentionCount, useAlerts } from '../components/Alerts';
import { Checklist } from '../components/Onboarding';
import { usePlan, useWorkspace } from '../components/Shell';
import type { Card, Entry } from '../lib/types';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Kpi({ label, value, sub, children, className = '' }: { label: string; value: string; sub?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={'min-w-0 px-5 py-4 compact:bg-panel phone:px-4 phone:py-3.5 ' + className}>
      <p className="label">{label}</p>
      <p className="num mt-1.5 truncate text-[22px] font-bold tracking-tight">{value}</p>
      {children}
      {sub && <p className="mt-1 truncate text-[12px] text-faint">{sub}</p>}
    </div>
  );
}

export function Overview() {
  const app = useApp();
  const p = usePlan();
  const navigate = useNavigate();
  const { openLog } = useWorkspace();
  const t = today();
  const totalUtil = p.totalLimit > 0 ? (p.totalDebt / p.totalLimit) * 100 : 0;
  const pj = useMemo(() => projection(app.cards, app.strategy), [app]);
  const count = attentionCount(useAlerts());
  const upcoming = useMemo(() => upcomingEvents(app.cards, 35), [app]);
  const spend = useMemo(() => spendingByCategory(app.cards), [app]);
  const recent = useMemo(() => {
    const all: { c: Card; e: Entry }[] = [];
    app.cards.forEach((c) => sortedLedger(c).slice(0, 12).forEach((e: Entry) => all.push({ c, e })));
    return all.sort((a, b) => (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : 0)).slice(0, 8);
  }, [app]);
  const nextDue = upcoming.find((u) => u.kind === 'due');
  const layout = useLayout();
  useIsDark();
  const c = { brand: token('brand'), faint: token('faint'), line: token('line'), panel: token('panel'), ink: token('ink') };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-8 py-7 tablet:px-6 tablet:py-6 phone:space-y-4 phone:px-4 phone:py-5">
      <VerifyBanner />
      <Checklist />
      <div className="flex items-end justify-between phone:flex-col phone:items-stretch phone:gap-4">
        <div>
          <h1 className="font-serif text-[30px] font-medium leading-tight tracking-tight phone:text-[27px]">{greeting()}, {app.profile.firstName}</h1>
          <p className="mt-1 text-[13px] text-faint">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {app.cards.length} cards ·{' '}
            {app.strategy === 'avalanche' ? 'Avalanche' : 'Snowball'} plan
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-outline phone:hidden" onClick={() => openLog({ sms: true })}><Icon name="sms" size={18} />Paste SMS</button>
          <button type="button" className="btn-primary phone:h-11 phone:flex-1 phone:justify-center" onClick={() => openLog({ type: 'payment', cardId: p.order[0]?.id, prefill: p.order[0] ? p.alloc[p.order[0].id] : undefined })}>
            <Icon name="payments" size={18} />Log this month’s payment
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {/* Phone and iPad: a grid with hairlines between cells (the line colour shows through 1px gaps) */}
      <section className="panel grid grid-cols-5 divide-x divide-line compact:gap-px compact:divide-x-0 compact:overflow-hidden compact:bg-line tablet:grid-cols-3 phone:grid-cols-2" data-tip="kpis">
        <Kpi label="Total debt" value={fmtAmt(p.totalDebt)} sub={'of ' + fmtAmt(p.totalLimit) + ' total limit'} className="phone:col-span-2" />
        <Kpi label="Utilisation" value={pct(totalUtil, 1)} className="phone:col-span-2">
          <div className="relative mt-2">
            <UtilBar value={totalUtil} />
            {/* The 30% line: the phone app's safe limit */}
            <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-ink/60" style={{ left: '30%' }} title="30% target" />
          </div>
          <p className="mt-1.5 text-[12px] text-faint">Safe Limit: {fmtAmt(p.totalLimit * 0.3)} · Target &lt;30%</p>
        </Kpi>
        <Kpi label="Monthly commitment" value={fmtAmt(p.commitment)} sub="Your plan for this month" />
        <Kpi label="Interest bleed" value={fmtAmt(p.interestMonth)} sub="Per month at today’s balances" />
        <Kpi label="Debt-free" className="tablet:col-span-2 phone:col-span-2"
          value={pj.debtFree ? pj.debtFree.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : app.cards.some((c) => c.balance > 0) ? 'Never' : '--'}
          sub={pj.debtFree ? pj.months + (pj.months === 1 ? ' month' : ' months') + (pj.speedUp >= 1 ? ' · ' + pj.speedUp.toFixed(1) + 'x faster than minimums' : '') : 'The budget doesn’t cover the minimums'} />
      </section>

      <div className="grid grid-cols-3 gap-5 compact:grid-cols-1 phone:gap-4">
        {/* Payoff pace */}
        <Panel tip="payoff" className="col-span-2 compact:col-span-1" title="Payoff pace" fold="payoff"
          summary={pj.debtFree ? 'Debt-free ' + pj.debtFree.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : undefined}
          action={<div className="flex items-center gap-4 text-[12px] text-faint phone:gap-2.5 phone:text-[11px]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" />Your plan</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-faint" />Minimums only</span>
          </div>}>
          <div className="h-[248px] phone:-mx-2 phone:h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pj.rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPlan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.brand} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={c.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={c.line} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={48} tick={{ fontSize: 11, fill: c.faint }} />
                <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => fmtShort(v).replace('LKR ', '')} tick={{ fontSize: 11, fill: c.faint }} />
                <Tooltip
                  contentStyle={{ background: c.panel, border: '1px solid ' + c.line, borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: c.ink, fontWeight: 600 }}
                  formatter={(v: number, name: string) => [fmtAmt(v), name === 'plan' ? 'Your plan' : 'Minimums only']} />
                <Area type="monotone" dataKey="minimum" stroke={c.faint} strokeDasharray="4 4" strokeWidth={1.5} fill="none" isAnimationActive={false} />
                <Area type="monotone" dataKey="plan" stroke={c.brand} strokeWidth={2} fill="url(#gPlan)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-4 border-t border-line pt-4 text-[12px] phone:grid-cols-1 phone:gap-2 phone:text-[13px] phone:[&>div]:flex phone:[&>div]:items-baseline phone:[&>div]:justify-between">
            <div><p className="text-faint">Interest on your plan</p><p className="num mt-0.5 text-[14px] font-semibold">{pj.months === Infinity ? '—' : fmtAmt(pj.interest)}</p></div>
            <div><p className="text-faint">Interest paying minimums</p><p className="num mt-0.5 text-[14px] font-semibold">{pj.baselineMonths === Infinity ? 'Never paid off' : fmtAmt(pj.baselineInterest)}</p></div>
            <div><p className="text-faint">Your plan saves</p><p className="num mt-0.5 text-[14px] font-semibold text-ok">{pj.saved === null ? 'Massive amounts' : fmtAmt(pj.saved)}</p></div>
          </div>
        </Panel>

        {/* Alerts: the phone app's, from the shared core */}
        <Panel tip="alerts" title="Needs attention" fold="alerts" summary={count > 0 ? <Chip tone="danger">{count} Attention</Chip> : 'All clear'} action={count > 0 ? <Chip tone="danger">{count} Attention</Chip> : undefined} bodyClass="px-2 pb-2">
          <AlertList />
        </Panel>
      </div>

      <div className="grid grid-cols-3 gap-5 tablet:grid-cols-2 phone:grid-cols-1 phone:gap-4">
        {/* Upcoming */}
        <Panel title="Next 5 weeks" fold="upcoming" summary={nextDue ? 'Next due ' + shortDate(nextDue.date) : upcoming.length ? upcoming.length + ' coming up' : 'Nothing scheduled'} action={nextDue && <span className="text-[12px] text-faint">Next due {shortDate(nextDue.date)}</span>} bodyClass="px-2 pb-3">
          {upcoming.length === 0 && <Empty icon="event_available" title="Nothing scheduled" body="Add billing cycles to your cards to see statements and due dates here." />}
          <ol className="scroll-thin max-h-[300px] overflow-y-auto">
            {upcoming.slice(0, 12).map((u, i) => {
              const d = daysBetween(t, u.date);
              return (
                <li key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-sunken">
                  <div className="w-11 shrink-0 text-center">
                    <p className="text-[10px] font-semibold uppercase text-faint">{new Date(u.date + 'T00:00').toLocaleDateString('en-GB', { month: 'short' })}</p>
                    <p className="num text-[17px] font-bold leading-tight">{+u.date.slice(8)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                      <Icon name={u.kind === 'due' ? 'payments' : u.kind === 'statement' ? 'description' : 'autorenew'} size={15}
                        className={u.kind === 'due' ? 'text-danger' : 'text-faint'} />
                      {u.title}
                    </p>
                    <p className="flex items-center gap-1.5 truncate text-[11px] text-faint"><CardDot card={u.card} size={7} />{cardName(u.card)} · {d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' days'}</p>
                  </div>
                  {u.kind === 'due' && !(u.amount! > 0.5) ? <Chip tone="ok">Minimum paid</Chip>
                    : u.amount !== undefined && <span className="num text-[12px] font-semibold">{fmtAmt(u.amount)}</span>}
                </li>
              );
            })}
          </ol>
        </Panel>

        {/* Spending by category */}
        <Panel title="Spending this cycle" fold="spending" summary={<span className="num font-semibold text-ink">{fmtAmt(spend.total)}</span>} action={<span className="num text-[12px] font-semibold">{fmtAmt(spend.total)}</span>}>
          {spend.rows.length === 0 && <Empty icon="shopping_bag" title="No spending yet" body="Spending logged in each card’s current billing period shows here." />}
          {spend.rows.length > 0 && (
            <>
              <div className="mb-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {spend.rows.map((r) => <div key={r.key} style={{ width: (r.amount / spend.total) * 100 + '%', background: categoryHex(r.key) }} />)}
              </div>
              <ul className="space-y-2.5">
                {spend.rows.slice(0, 7).map((r) => (
                  <li key={r.key} className="flex items-center gap-2.5 text-[13px]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: categoryHex(r.key) }} />
                    <span className="flex-1 truncate">{spendCategory(r.key).label}</span>
                    <span className="text-[11px] text-faint">{pct((r.amount / spend.total) * 100)}</span>
                    <span className="num w-24 text-right font-medium">{fmtAmt(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        {/* Pay-first order */}
        <Panel className="tablet:col-span-2" title="This month’s plan" fold="plan" summary={<span className="num font-semibold text-ink">{fmtAmt(p.commitment)}</span>} action={<Link to="/plan" className="text-[12px] font-semibold text-brand-ink hover:underline">Open plan</Link>} bodyClass="px-2 pb-3">
          <ol>
            {p.order.map((c, i) => (
              <li key={c.id}>
                <button type="button" onClick={() => navigate('/cards/' + c.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-sunken">
                  <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ' + (i === 0 ? 'bg-brand text-white' : 'bg-sunken text-faint')}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13px] font-medium"><CardDot card={c} size={8} />{cardName(c)}</p>
                    <p className="text-[11px] text-faint">{i === 0 ? 'Pay first · ' : ''}{c.apr}% APR · {Math.round(util(c))}% used</p>
                  </div>
                  <span className="num text-[13px] font-semibold">{fmtAmt(p.alloc[c.id] || 0)}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mx-3 mt-2 flex items-center justify-between border-t border-line pt-3 text-[12px]">
            <span className="text-faint">Total this month</span>
            <span className="num font-semibold">{fmtAmt(p.commitment)}</span>
          </div>
        </Panel>
      </div>

      {/* Recent activity */}
      <Panel title="Recent activity" fold="recent" summary={recent.length ? 'Latest ' + shortDate(recent[0].e.date) : 'No entries yet'} action={<Link to="/activity" className="text-[12px] font-semibold text-brand-ink hover:underline">View all</Link>} bodyClass="pb-2">
        {layout === 'phone' ? <EntryList rows={recent} onOpen={(c, e) => openLog({ editing: { id: e.id, cardId: c.id } })} /> : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-y border-line text-left text-[11px] font-semibold uppercase tracking-wider text-faint">
              <th className="px-5 py-2 font-semibold">Date</th><th className="py-2 font-semibold">Description</th><th className="py-2 font-semibold">Category</th>
              <th className="py-2 font-semibold">Card</th><th className="px-5 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(({ c, e }) => {
              const credit = e.type === 'payment' || e.type === 'refund' || (e.type === 'adjustment' && e.amount < 0);
              return (
                <tr key={e.id} onClick={() => openLog({ editing: { id: e.id, cardId: c.id } })} className="cursor-pointer border-b border-line last:border-0 hover:bg-sunken">
                  <td className="num whitespace-nowrap px-5 py-2.5 text-faint">{shortDate(e.date)}</td>
                  <td className="py-2.5 font-medium">{entryLabel(e)}{e.source === 'sms' && <Chip tone="neutral">SMS</Chip>}</td>
                  <td className="py-2.5 text-muted">
                    {e.category ? <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: categoryHex(e.category) }} />{spendCategory(e.category).label}</span> : e.type === 'payment' ? 'Payment' : '—'}
                  </td>
                  <td className="py-2.5"><span className="flex items-center gap-1.5 text-muted"><CardDot card={c} size={8} />{cardName(c)}</span></td>
                  <td className={'num whitespace-nowrap px-5 py-2.5 text-right font-semibold ' + (credit ? 'text-ok' : '')}>{credit ? '−' : ''}{fmtAmt(Math.abs(e.amount))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </Panel>
    </div>
  );
}

