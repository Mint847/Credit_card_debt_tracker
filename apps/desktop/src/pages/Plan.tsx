// Plan: this month's repayment strategy, as the phone app's Cards Overview works it out (budget,
// pay-first order, each card's amount, interest bleed, debt-free target), with the strategy choice
import { useNavigate } from 'react-router-dom';
import { cardApr, minPaymentFor } from '@serendib/core';
import { useApp, setStrategy } from '../lib/store';
import { cardName } from '../lib/derive';
import { fmtAmt } from '../lib/format';
import { CardTile, Chip, Empty, Icon, Panel } from '../components/ui';
import { usePlan, useWorkspace } from '../components/Shell';
import type { Strategy } from '../lib/types';

const STRATEGIES: { value: Strategy; title: string; icon: string; short: string; desc: string }[] = [
  { value: 'avalanche', title: 'Debt Avalanche', icon: 'trending_down', short: 'Saves maximum interest (Target highest APR).',
    desc: 'Priority allocation structured to crush highest APR compounding bleed before billing cycle close.' },
  { value: 'snowball', title: 'Debt Snowball', icon: 'filter_vintage', short: 'Quick psychological wins (Target lowest balance).',
    desc: 'Priority allocation structured to eliminate smallest balances first, building momentum for larger debts.' }
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

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-8 py-7 tablet:px-6 tablet:py-6 phone:space-y-4 phone:px-4 phone:py-5">
      <div className="flex items-end justify-between phone:flex-col phone:items-stretch phone:gap-3">
        <div>
          <h1 className="font-serif text-[30px] font-medium leading-tight tracking-tight phone:text-[27px]">Plan</h1>
          <p className="mt-1 text-[13px] text-faint">This month’s repayment strategy · {strat.title}</p>
        </div>
        {target && (
          <button type="button" className="btn-primary phone:h-11 phone:justify-center" onClick={() => openLog({ type: 'payment', cardId: target.id, prefill: p.alloc[target.id] })}>
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
        <Panel className="col-span-2 compact:col-span-1" title={<span className="flex items-center gap-2"><Icon name="bolt" size={18} className="text-brand-ink" />Optimized allocation</span>}
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
          <Panel title="Payoff strategy">
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
          <Panel title="Monthly budget">
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
