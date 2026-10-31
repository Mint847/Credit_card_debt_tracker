// Plan: this month's repayment strategy, as the phone app's Cards Overview works it out (budget,
// pay-first order, each card's amount, interest bleed, debt-free target), with the strategy choice
import { useId, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { cardApr, minPaymentFor } from '@serendib/core';
import { useApp, setStrategy } from '../lib/store';
import { cardName, cardTheme } from '../lib/derive';
import { fmtAmt } from '../lib/format';
import { useLayout } from '../lib/layout';
import { CardTile, Chip, Empty, Icon, MetricTile, Panel } from '../components/ui';
import { usePlan, useWorkspace } from '../components/Shell';
import type { Card, Strategy } from '../lib/types';
import type { Plan as PlanData } from '../lib/derive';

// phone*: the phone design's plainer wording
const STRATEGIES: { value: Strategy; title: string; icon: string; short: string; desc: string; phoneName: string; phoneSub: string; phoneDesc: string }[] = [
  { value: 'avalanche', title: 'Debt Avalanche', icon: 'trending_down', short: 'Saves maximum interest (Target highest APR).',
    desc: 'Priority allocation structured to crush highest APR compounding bleed before billing cycle close.',
    phoneName: 'Avalanche', phoneSub: 'highest interest first', phoneDesc: 'Pay the highest-interest card first. Saves you the most.' },
  { value: 'snowball', title: 'Debt Snowball', icon: 'filter_vintage', short: 'Quick psychological wins (Target lowest balance).',
    desc: 'Priority allocation structured to eliminate smallest balances first, building momentum for larger debts.',
    phoneName: 'Snowball', phoneSub: 'smallest balance first', phoneDesc: 'Clear the smallest balance first. Quick wins keep you going.' }
];

export function Plan() {
  const app = useApp();
  const p = usePlan();
  const navigate = useNavigate();
  const { openLog } = useWorkspace();
  const settled = app.cards.filter((c) => c.balance === 0);
  const target = p.order[0];
  const minTotal = app.cards.reduce((s, c) => s + (c.balance > 0 ? minPaymentFor(c) : 0), 0);
  const strat = STRATEGIES.find((s) => s.value === app.strategy) || STRATEGIES[0];
  const layout = useLayout();
  if (layout === 'phone') return <PlanPhone p={p} settled={settled} minTotal={minTotal} />;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-8 py-7 tablet:px-6 tablet:py-6 phone:space-y-4 phone:px-4 phone:py-5">
      <div className="flex items-end justify-between phone:flex-col phone:items-stretch phone:gap-3">
        <div>
          <h1 className="font-serif text-[30px] font-medium leading-tight tracking-tight phone:text-[27px]">Plan</h1>
          <p className="mt-1 text-[13px] text-faint">This month’s repayment strategy · {strat.title}</p>
        </div>
        {target && (
          <button type="button" className="btn-primary phone:h-11 phone:justify-center" data-tip="plan-pay" onClick={() => openLog({ type: 'payment', cardId: target.id, prefill: p.alloc[target.id] })}>
            <Icon name="payments" size={18} />Log this month’s payment
          </button>
        )}
      </div>

      <section className="panel grid grid-cols-4 divide-x divide-line compact:gap-px compact:divide-x-0 compact:overflow-hidden compact:bg-line tablet:grid-cols-2 phone:grid-cols-2">
        {[
          ['Total aggregate debt', fmtAmt(p.totalDebt), 'Total available credit limit: ' + fmtAmt(p.totalLimit)],
          ['Total monthly commitment', app.cards.length ? fmtAmt(p.commitment) : '--', 'Budget ' + fmtAmt(p.budget) + ' (25% of income, or your targets)'],
          ['Total interest bleed', app.cards.length ? fmtAmt(p.interestMonth) : '--', 'Estimated interest this month at your cards’ rates'],
          ['Debt-free target', p.debtFreeLabel, 'At your current monthly plan']
        ].map(([label, value, sub], i) => (
          <div key={label} className="px-5 py-4 compact:bg-panel phone:px-4 phone:py-3.5">
            <p className="label">{label}</p>
            <p className={'num mt-1.5 text-[22px] font-bold tracking-tight phone:text-[18px] ' + (i === 2 && app.cards.length ? 'text-danger' : '')}>{value}</p>
            <p className="mt-1 text-[12px] text-faint">{sub}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-3 gap-5 compact:grid-cols-1 phone:gap-4">
        <Panel tip="plan-alloc" className="col-span-2 compact:col-span-1" title={<span className="flex items-center gap-2"><Icon name="bolt" size={18} className="text-brand-ink" />Optimized allocation</span>}
          action={<Chip tone="info">{strat.title}</Chip>} bodyClass="px-3 pb-3">
          <p className="mb-3 px-2 text-[13px] text-muted">{strat.desc}</p>
          {app.cards.length === 0 && <Empty icon="credit_card" title="No cards added" body="Add a card to see this month’s plan." />}
          <ul className="space-y-1">
            {p.order.concat(settled).map((card, index) => {
              const isTarget = index === 0 && card.balance > 0;
              const isSettled = card.balance === 0;
              const alloc = isSettled ? 0 : p.alloc[card.id] || 0;
              const min = isSettled ? 0 : minPaymentFor(card);
              const surplus = alloc > min + 0.5;
              return (
                <li key={card.id}>
                  <button type="button" onClick={() => navigate('/cards/' + card.id)}
                    className={'flex w-full items-center gap-3 rounded-xl px-3 text-left transition-colors ' +
                      (isTarget ? 'border border-brand/20 bg-brand/[0.07] py-3 hover:bg-brand/10' : 'py-2.5 hover:bg-sunken') + (isSettled ? ' opacity-60' : '')}>
                    <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ' + (isTarget ? 'bg-brand text-white' : 'bg-sunken text-faint')}>{index + 1}</span>
                    <span className="phone:hidden"><CardTile card={card} size={34} /></span>
                    <span className="min-w-0 flex-1">
                      {isTarget && <span className="mb-0.5 inline-block rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">Pay first</span>}
                      <span className="block truncate text-[13px] font-semibold">{card.bank} {card.nick}</span>
                      <span className="block text-[12px] text-faint">
                        {isTarget ? 'Direct all surplus here · ' + cardApr(card) + '% APR' : isSettled ? 'No payment due' : (surplus ? 'Minimum + surplus' : 'Minimum payment') + ' · ' + cardApr(card) + '% APR'}
                      </span>
                    </span>
                    {isSettled ? <Chip tone="ok">Settled</Chip> : (
                      <span className="text-right">
                        <span className={'num block font-bold ' + (isTarget ? 'text-[16px] text-brand-ink' : 'text-[14px]')}>{fmtAmt(isTarget || surplus ? alloc : min)}</span>
                        {isTarget && <span className="block text-[10px] font-semibold uppercase tracking-wide text-faint">Target</span>}
                      </span>
                    )}
                    <Icon name="chevron_right" size={18} className="text-faint" />
                  </button>
                </li>
              );
            })}
          </ul>
          {app.cards.length > 0 && (
            <div className="mx-3 mt-3 flex items-center justify-between border-t border-line pt-3 text-[13px]">
              <span className="text-faint">Total this month</span>
              <span className="num font-bold">{fmtAmt(p.commitment)}</span>
            </div>
          )}
        </Panel>

        <div className="space-y-5 tablet:grid tablet:grid-cols-2 tablet:gap-5 tablet:space-y-0 phone:space-y-4">
          <Panel tip="plan-strategy" title="Payoff strategy">
            <div role="radiogroup" aria-label="Payoff strategy" className="space-y-2.5">
              {STRATEGIES.map((s) => {
                const on = app.strategy === s.value;
                return (
                  <button key={s.value} type="button" role="radio" aria-checked={on} onClick={() => { if (!on) setStrategy(s.value); }}
                    className={'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ' + (on ? 'border-brand bg-brand/5' : 'border-line hover:bg-sunken')}>
                    <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ' + (on ? 'bg-brand text-white' : 'bg-sunken text-muted')}><Icon name={s.icon} size={18} /></span>
                    <span className="flex-1">
                      <span className="block text-[13px] font-semibold">{s.title}</span>
                      <span className="mt-0.5 block text-[12px] text-faint">{s.short}</span>
                    </span>
                    {on && <Icon name="check_circle" fill className="text-brand-ink" />}
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel tip="plan-budget" title="Monthly budget">
            <div className="flex justify-between text-[13px]"><span className="text-faint">Bank minimums</span><span className="num font-semibold">{fmtAmt(minTotal)}</span></div>
            <div className="mt-1 flex justify-between text-[13px]"><span className="text-faint">Your target plan</span><span className="num font-semibold">{fmtAmt(p.budget)}/mo</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-brand" style={{ width: (p.budget > 0 ? Math.min(100, (minTotal / p.budget) * 100) : 0) + '%' }} />
            </div>
            <p className="mt-3 text-[12px] text-faint">The budget is 25% of your monthly income ({fmtAmt(parseFloat(app.profile.income) || 175000)}), raised if your saved card targets need more. Minimums are paid first; the rest goes to the pay-first card.</p>
            <button type="button" className="btn-outline mt-3 h-8 w-full justify-center text-[12px]" onClick={() => navigate('/settings')}><Icon name="tune" size={16} />Change income</button>
          </Panel>
          {settled.length > 0 && (
            <p className="px-1 text-[12px] text-faint">{settled.length} card{settled.length === 1 ? '' : 's'} paid off: {settled.map(cardName).join(', ')}.</p>
          )}
        </div>
      </div>
    </div>
  );
}


// Phones: the same plan, laid out for one hand. What to pay this month first, then the numbers, where the money
// goes, the strategy and the budget. The values and actions are the ones above.
function PlanPhone({ p, settled, minTotal }: { p: PlanData; settled: Card[]; minTotal: number }) {
  const app = useApp();
  const navigate = useNavigate();
  const { openLog } = useWorkspace();
  const target = p.order[0];
  const strat = STRATEGIES.find((s) => s.value === app.strategy) || STRATEGIES[0];
  const has = app.cards.length > 0;
  const income = parseFloat(app.profile.income) || 175000;
  const extra = Math.max(0, p.commitment - minTotal);
  const minShare = p.budget > 0 ? Math.min(100, (minTotal / p.budget) * 100) : 0;
  const amountFor = (c: Card) => {
    const alloc = p.alloc[c.id] || 0, min = minPaymentFor(c);
    return c.id === target?.id || alloc > min + 0.5 ? alloc : min;
  };

  return (
    <div className="space-y-4 px-4 pb-6 pt-5">
      <div>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight">Plan</h1>
        <p className="mt-0.5 text-sm text-faint">{strat.phoneName} · {strat.phoneSub}</p>
      </div>

      {/* This month: the amount, the card to pay first and the split across cards */}
      <section className="panel p-5">
        <p className="text-sm font-semibold text-muted">This month you pay</p>
        {target ? (
          <>
            {p.commitment > 0 ? <SplitRing p={p} /> : <p className="num mt-1 text-[34px] font-extrabold leading-none tracking-tight">{fmtAmt(p.commitment)}</p>}
            <p className="mt-4 flex items-center gap-2 text-sm">
              <span className="shrink-0 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">Pay first</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{cardName(target)}</span>
            </p>
            <button type="button" className="btn-primary mt-4 w-full justify-center" data-tip="plan-pay"
              onClick={() => openLog({ type: 'payment', cardId: target.id, prefill: p.alloc[target.id] })}>
              <Icon name="payments" size={18} />Log this month’s payment
            </button>
          </>
        ) : (
          <>
            <p className="num mt-1 text-[34px] font-extrabold leading-none tracking-tight">{has ? fmtAmt(p.commitment) : '--'}</p>
            <p className="mt-3 text-sm text-muted">{has ? 'Every card is paid off. Nothing to pay this month.' : 'Add a card to see this month’s plan.'}</p>
          </>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <MetricTile label="Total debt" value={fmtAmt(p.totalDebt)} sub={'of ' + fmtAmt(p.totalLimit) + ' limit'} />
        <MetricTile accent="danger" label="Interest" value={has ? fmtAmt(p.interestMonth) : '--'} sub="This month, at your cards’ rates" />
        <MetricTile label="Debt-free" value={p.debtFreeLabel} sub="On this plan" />
        <MetricTile label="Budget" value={fmtAmt(p.budget)} sub="Each month" />
      </div>

      {/* Where the money goes: every card, the pay-first one on top */}
      <section className="panel p-4" data-tip="plan-alloc">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">Where your money goes</h2>
          <Chip tone="info">{strat.phoneName}</Chip>
        </div>
        <p className="mt-1 text-sm text-muted">{strat.phoneDesc}</p>
        {!has && <Empty icon="credit_card" title="No cards added" body="Add a card to see this month’s plan." />}
        <ul className="mt-3 space-y-2">
          {p.order.concat(settled).map((card, index) => {
            const isTarget = index === 0 && card.balance > 0;
            const isSettled = card.balance === 0;
            const surplus = !isSettled && (p.alloc[card.id] || 0) > minPaymentFor(card) + 0.5;
            return (
              <li key={card.id}>
                <button type="button" onClick={() => navigate('/cards/' + card.id)}
                  className={'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors ' +
                    'bg-sunken active:bg-line/70' + (isSettled ? ' opacity-70' : '')}>
                  <span className="relative shrink-0">
                    <CardTile card={card} size={42} />
                    {!isSettled && (
                      <span className={'absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ring-2 ' +
                        (isTarget ? 'bg-brand text-white' : 'bg-panel text-muted') + ' ring-[rgb(var(--sunken))]'}>{index + 1}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[15px] font-semibold leading-snug">{card.bank} {card.nick}</span>
                    <span className="mt-0.5 block text-xs text-faint">
                      {isSettled ? 'Paid off' : (isTarget ? 'All extra money goes here' : surplus ? 'Minimum + extra' : 'Minimum payment') + ' · ' + cardApr(card) + '% APR'}
                    </span>
                  </span>
                  {isSettled ? <Chip tone="ok" icon="check">Settled</Chip> : (
                    <span className={'num shrink-0 text-right font-bold ' + (isTarget ? 'text-lg text-brand-ink' : 'text-base')}>{fmtAmt(amountFor(card))}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {has && (
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm text-muted">Total this month</span>
            <span className="num text-base font-bold">{fmtAmt(p.commitment)}</span>
          </div>
        )}
      </section>

      <section className="panel p-4" data-tip="plan-strategy">
        <h2 className="text-base font-bold">Payoff strategy</h2>
        <div role="radiogroup" aria-label="Payoff strategy" className="mt-3 grid grid-cols-2 gap-2.5">
          {STRATEGIES.map((s) => {
            const on = app.strategy === s.value;
            return (
              <button key={s.value} type="button" role="radio" aria-checked={on} aria-label={s.title} onClick={() => { if (!on) setStrategy(s.value); }}
                className={'relative flex flex-col items-start rounded-2xl p-3.5 text-left transition-colors ' + (on ? 'bg-brand/[0.08]' : 'bg-sunken active:bg-line/70')}>
                <span className={'flex h-9 w-9 items-center justify-center rounded-xl ' + (on ? 'bg-brand text-white' : 'bg-panel text-muted')}><Icon name={s.icon} size={19} /></span>
                {on && <Icon name="check_circle" fill size={20} className="absolute right-3 top-3 text-brand-ink" />}
                <span className="mt-2.5 text-[15px] font-bold">{s.phoneName}</span>
                <span className="mt-0.5 text-xs leading-snug text-faint">{s.phoneDesc}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel p-4" data-tip="plan-budget">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold">Monthly budget</h2>
          <span className="num text-base font-bold">{fmtAmt(p.budget)}</span>
        </div>
        <div className="meter-reveal mt-3 flex h-2 overflow-hidden rounded-full bg-sunken">
          <div className="h-full bg-brand" style={{ width: minShare + '%' }} />
          <div className="h-full bg-brand/35" style={{ width: (p.budget > 0 ? Math.min(100 - minShare, (extra / p.budget) * 100) : 0) + '%' }} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" />Bank minimums <span className="num font-semibold">{fmtAmt(minTotal)}</span></span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand/35" />Extra <span className="num font-semibold">{fmtAmt(extra)}</span></span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">A quarter of your monthly income ({fmtAmt(income)}), raised if your card targets need more. Minimums are paid first; the rest goes to the pay-first card.</p>
        <button type="button" className="btn-outline mt-3 w-full justify-center" onClick={() => navigate('/settings')}><Icon name="tune" size={18} />Change income</button>
      </section>

      {settled.length > 0 && (
        <p className="px-1 text-xs text-faint">{settled.length} card{settled.length === 1 ? '' : 's'} paid off: {settled.map(cardName).join(', ')}.</p>
      )}
    </div>
  );
}


// Phones: this month's money as a thin ring, one arc per card in its own colour (largest first, clockwise from
// the top, small gaps between), the total in the centre and the cards listed beside it. Tap a card or its arc
// to see its amount in the centre. Six or more cards keep the four largest and fold the rest into "Other".
interface Slice { id: string; name: string; color: string; amount: number; others?: string[] }
function SplitRing({ p }: { p: PlanData }) {
  const [sel, setSel] = useState<string | null>(null);
  const maskId = useId();
  const rows: Slice[] = p.order.map((c) => ({ id: c.id, name: cardName(c), color: cardTheme(c).hex, amount: p.alloc[c.id] || 0 }))
    .filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  const rest = rows.slice(4);
  const slices: Slice[] = rows.length >= 6
    ? [...rows.slice(0, 4), { id: 'other', name: 'Other', color: 'rgb(var(--faint))', amount: rest.reduce((s, r) => s + r.amount, 0), others: rest.map((r) => r.name) }]
    : rows;
  const total = slices.reduce((s, r) => s + r.amount, 0);
  const SIZE = 140, SW = 12, R = (SIZE - SW) / 2, C = 2 * Math.PI * R, GAP = 5;
  const many = slices.length > 1;
  let at = 0;
  const arcs = slices.map((s) => { const len = (s.amount / total) * C; const a = { ...s, start: at, len }; at += len; return a; });
  const shown = slices.find((s) => s.id === sel);
  const share = (n: number) => Math.round((n / total) * 100) + '%';
  const centre = Math.round(shown ? shown.amount : total).toLocaleString('en-US');
  const toggle = (id: string) => setSel(sel === id ? null : id);
  return (
    <div className="mt-3 flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={'0 0 ' + SIZE + ' ' + SIZE} width={SIZE} height={SIZE} className="-rotate-90" role="img"
          aria-label={'This month’s split: ' + slices.map((s) => s.name + ' ' + fmtAmt(s.amount) + ' (' + share(s.amount) + ')').join(', ')}>
          {/* Draws the ring in clockwise when it appears (index.css .ring-draw) */}
          <mask id={maskId}>
            <circle className="ring-draw" cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="white" strokeWidth={SW + 4}
              strokeDasharray={C} strokeDashoffset={0} style={{ '--c': C } as CSSProperties} />
          </mask>
          <g mask={'url(#' + maskId + ')'}>
            {arcs.map((a) => (
              <circle key={a.id} cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={a.color} strokeWidth={SW}
                strokeLinecap={many ? 'round' : 'butt'}
                strokeDasharray={many ? Math.max(0.01, a.len - GAP - SW) + ' ' + C : undefined}
                strokeDashoffset={many ? -(a.start + (GAP + SW) / 2) : undefined}
                opacity={sel && sel !== a.id ? 0.25 : 1} className="cursor-pointer transition-opacity duration-200" onClick={() => toggle(a.id)} />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
          <span className="text-xs font-semibold text-faint">LKR</span>
          <span className={'num font-extrabold leading-tight tracking-tight ' + (centre.length > 8 ? 'text-lg' : 'text-[22px]')}>{centre}</span>
          <span className="max-w-[108px] truncate text-xs text-faint">{shown ? shown.name.split(' ')[0] + ' · ' + share(shown.amount) : 'this month'}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-0.5">
        {slices.map((s) => (
          <li key={s.id}>
            <button type="button" aria-pressed={sel === s.id} onClick={() => toggle(s.id)}
              className={'flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left transition-opacity duration-200 ' + (sel === s.id ? 'bg-sunken' : '') + (sel && sel !== s.id ? ' opacity-40' : '')}>
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.name}</span>
                <span className="block text-xs text-muted"><span className="num font-semibold text-ink">{fmtAmt(s.amount)}</span> · {share(s.amount)}</span>
                {s.others && <span className="block truncate text-xs text-faint">{s.others.join(', ')}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
