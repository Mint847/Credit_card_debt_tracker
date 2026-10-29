// Simulators: the minimum-payment trap, cash advances and 0% surcharge plans. Each takes a saved
// card (its rate, minimum rule or bank fee) or a custom scenario; the numbers and wording come from
// the shared core (simulators.js), as on the phone.
import { useEffect, useState, type ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useSearchParams } from 'react-router-dom';
import { simulateMinimum, simulateCashAdvance, simulateSurcharge, advanceFeeRule, simAmount, cashAdvanceApr, cashPriceRequest, SIM_PRESETS, SURCHARGE_PRESETS } from '@serendib/core';
import { useApp, findCard, noteSimulatorVisit, saveTarget } from '../lib/store';
import { cardName } from '../lib/derive';
import { CardDot, Chip, Icon, useToast } from '../components/ui';
import type { Card } from '../lib/types';

const lkr = (n: number) => 'LKR ' + new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 }).format(n);
const short = (n: number) => (n >= 1e6 ? n / 1e6 + 'M' : n / 1e3 + 'k');

function Source({ value, onChange, cards }: { value: string; onChange: (v: string) => void; cards: Card[] }) {
  const card = value !== 'custom' ? findCard(value) : undefined;
  return (
    <div>
      <label htmlFor="sim-source" className="label">Load data from</label>
      <div className="relative mt-1.5">
        <select id="sim-source" value={value} onChange={(e) => onChange(e.target.value)} className="field h-10 appearance-none pl-8">
          <option value="custom">Custom Scenario</option>
          {cards.map((c) => <option key={c.id} value={c.id} disabled={c.balance === 0}>{c.bank} {c.nick}{c.balance === 0 ? ' - Settled' : ''}</option>)}
        </select>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{card ? <CardDot card={card} /> : <Icon name="tune" size={15} className="text-faint" />}</span>
        <Icon name="expand_more" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-faint" />
      </div>
    </div>
  );
}

function Amount({ id, label, value, onChange, presets, readOnly, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; presets?: number[]; readOnly?: boolean; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-faint">LKR</span>
        <input id={id} inputMode="decimal" value={value} readOnly={readOnly} placeholder="0" onChange={(e) => onChange(e.target.value)}
          className={'field num h-12 pl-12 text-[18px] font-bold ' + (readOnly ? 'bg-sunken text-muted' : '')} />
      </div>
      {hint && <p className="mt-1 text-[11px] text-faint">{hint}</p>}
      {presets && !readOnly && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[11px] text-faint">Presets:</span>
          {presets.map((p) => (
            <button key={p} type="button" onClick={() => onChange(String(p))}
              className={'rounded-md border px-2 py-0.5 text-[11px] font-semibold ' + (simAmount(value) === p ? 'border-brand bg-brand text-white' : 'border-line text-muted hover:bg-sunken')}>{short(p)}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Small({ id, label, value, onChange, suffix, disabled, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; suffix: string; disabled?: boolean; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative mt-1.5">
        <input id={id} inputMode="decimal" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="field num h-10 pr-14 disabled:bg-sunken disabled:text-faint" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-faint">{suffix}</span>
      </div>
      {hint && <p className="mt-1 text-[11px] text-faint">{hint}</p>}
    </div>
  );
}

function Result({ tone, eyebrow, value, lines, foot }: { tone: 'danger' | 'ok' | 'neutral'; eyebrow: string; value: string; lines: ReactNode[]; foot?: string }) {
  const c = tone === 'danger' ? 'border-danger/25 bg-danger/[0.05]' : tone === 'ok' ? 'border-ok/25 bg-ok/[0.06]' : 'border-line bg-sunken/60';
  const t = tone === 'danger' ? 'text-danger' : tone === 'ok' ? 'text-ok' : 'text-ink';
  return (
    <div className={'rounded-xl border p-5 ' + c}>
      <p className="label">{eyebrow}</p>
      <p className={'num mt-2 text-[26px] font-bold tracking-tight ' + t}>{value}</p>
      <div className="mt-1 space-y-0.5 text-[12px] text-muted">{lines.map((l, i) => <p key={i}>{l}</p>)}</div>
      {foot && <p className={'mt-3 border-t border-current/10 pt-2 text-[11px] font-semibold ' + t}>{foot}</p>}
    </div>
  );
}

function Explainer({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-panel p-4">
      <Icon name={icon} className="text-brand-ink" />
      <div><p className="text-[13px] font-semibold">{title}</p><p className="mt-1 text-[12px] leading-relaxed text-muted">{children}</p></div>
    </div>
  );
}

function Header({ title, sub, chip }: { title: string; sub: string; chip?: string }) {
  return (
    <div className="mb-5 flex items-start justify-between">
      <div><h2 className="text-[17px] font-semibold">{title}</h2><p className="mt-0.5 text-[13px] text-faint">{sub}</p></div>
      {chip && <Chip tone="info" icon="gavel">{chip}</Chip>}
    </div>
  );
}

function MinimumTrap({ cards }: { cards: Card[] }) {
  const [source, setSource] = useState('custom');
  const [custom, setCustom] = useState('');
  const card = source !== 'custom' ? findCard(source) : undefined;
  const balance = card ? String(card.balance) : custom;
  const s = simulateMinimum(simAmount(balance), card || null);
  const toast = useToast();
  // "Adopt Fixed Repayment Plan": the loaded card's monthly goal becomes the fixed payment
  const adopt = () => {
    if (!card) { toast('Load one of your cards above to adopt this plan.'); return; }
    if (s.empty) return;
    saveTarget(card.id, s.fixedPayment);
    toast('Monthly goal set: ' + lkr(s.fixedPayment) + ' on ' + cardName(card) + '. Your plan always pays at least this.');
  };
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="panel col-span-5 space-y-5 p-6">
        <Header title="Minimum Payment Sandbox" sub="See the true cost of paying only the minimum." chip="CBSL Cap: 28% APR" />
        <Source value={source} onChange={setSource} cards={cards} />
        <Amount id="sim-balance" label="Simulated balance" value={balance} onChange={setCustom} presets={SIM_PRESETS} readOnly={!!card} />
        <div className="flex items-center justify-between rounded-xl bg-sunken px-4 py-3">
          <span><span className="label block">Interest rate (APR)</span><span className="text-[11px] text-faint">{s.aprNote}</span></span>
          <span className="num text-[20px] font-bold">{s.apr.toFixed(1)}%</span>
        </div>
      </div>
      <div className="col-span-7 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Result tone="danger" eyebrow="If paying minimum" value={s.empty ? '--' : s.minTime} lines={[s.empty ? 'Interest: --' : 'Interest: ' + lkr(s.minInterest)]} foot={s.empty ? undefined : s.minWarning} />
          <Result tone="ok" eyebrow={s.empty ? 'If paying fixed' : s.fixedTitle.replace('IF PAYING FIXED', 'If paying fixed')} value={s.empty ? '--' : s.fixedTime}
            lines={[s.empty ? 'Save --' : 'Save ' + lkr(s.savings)]} foot={s.empty ? undefined : s.speed} />
        </div>
        <div className="panel p-5">
          <div className="flex items-baseline justify-between">
            <p className="panel-title">Principal vs interest velocity</p>
            <p className="text-[12px] font-semibold text-ok">{s.empty ? '--' : s.principalPct + '% Principal'}</p>
          </div>
          <p className="mt-0.5 text-[12px] text-faint">Where this month’s minimum payment goes</p>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-sunken">
            <div className="bg-ok transition-all" style={{ width: (s.empty ? 0 : s.principalPct) + '%' }} />
            <div className="bg-danger/70 transition-all" style={{ width: (s.empty ? 0 : s.interestPct) + '%' }} />
          </div>
          <div className="mt-2 flex justify-between text-[12px]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok" />Principal: {s.empty ? '--' : lkr(s.principal)}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger/70" />Interest: {s.empty ? '--' : lkr(s.interest)}</span>
          </div>
        </div>
        <Explainer icon="info" title="Why minimums cost so much">
          Most Sri Lankan banks set the minimum at about 4% of your balance. Pay only that and nearly all of the debt carries interest every month, so it lasts for years. CBSL caps card interest at 28% a year.
        </Explainer>
        <button type="button" className="btn-primary w-full justify-center" onClick={adopt}>Adopt fixed repayment plan<Icon name="arrow_forward" size={18} /></button>
      </div>
    </div>
  );
}

function CashAdvance({ cards }: { cards: Card[] }) {
  const [source, setSource] = useState('custom');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('5.0');
  const [days, setDays] = useState('30');
  const [apr, setApr] = useState('28');
  const card = source !== 'custom' ? findCard(source) : undefined;
  const rule = advanceFeeRule(card || null);
  const s = simulateCashAdvance(simAmount(amount), days, card || null, { feePct: fee, apr });
  const shownApr = card ? cashAdvanceApr(card) : parseFloat(apr) || 28;
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="panel col-span-5 space-y-5 p-6">
        <Header title="Cash Advance Trap" sub="See the true cost of ATM credit withdrawals." chip="CBSL Cap: 28% APR" />
        <Source value={source} onChange={setSource} cards={cards} />
        <Amount id="adv-amount" label="Amount withdrawn" value={amount} onChange={setAmount} presets={SIM_PRESETS} />
        <div className="grid grid-cols-2 gap-4">
          <Small id="adv-fee" label="Upfront fee" value={card ? String((rule.percent || 0).toFixed(1)) : fee} onChange={setFee} suffix="%" disabled={!!card} hint={rule.label} />
          <Small id="adv-days" label="Days to repay" value={days} onChange={setDays} suffix="Days" hint={s.daily} />
        </div>
        {card ? (
          <div className="flex items-center justify-between rounded-xl bg-sunken px-4 py-3">
            <span><span className="label block">Interest rate (APR)</span><span className="text-[11px] text-faint">This card’s rate</span></span>
            <span className="num text-[20px] font-bold">{shownApr.toFixed(1)}%</span>
          </div>
        ) : <Small id="adv-apr" label="Interest rate (APR)" value={apr} onChange={setApr} suffix="%" hint="CBSL Statutory Ceiling: 28%" />}
      </div>
      <div className="col-span-7 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Result tone="danger" eyebrow="Hidden costs" value={s.empty ? '--' : lkr(s.hidden!)} lines={[s.empty ? 'Fee: --' : 'Fee: ' + lkr(s.fee!), s.empty ? 'Interest: --' : 'Interest: ' + lkr(s.interest!)]} foot="Compounding surcharge" />
          <Result tone="neutral" eyebrow="Total owed" value={s.empty ? '--' : lkr(s.total!)} lines={[s.empty ? '--' : s.sub1!, s.empty ? '--' : s.sub2!]} foot={s.empty ? undefined : s.insight} />
        </div>
        <Explainer icon="info" title="How cash advances are charged">
          Cash advances get no interest-free period. On top of the upfront fee, interest is charged from the day you withdraw until it’s paid off in full.
        </Explainer>
      </div>
    </div>
  );
}

function Surcharge() {
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('3.0');
  const [months, setMonths] = useState('12');
  const s = simulateSurcharge(simAmount(price), fee, months);
  const toast = useToast();
  // "Negotiate cash discount": copy a message asking for the cash price, with the plan's real cost
  const negotiate = async () => {
    const text = cashPriceRequest(simAmount(price), s);
    if (!text) { toast('Enter the item’s cash price first.'); return; }
    try { await navigator.clipboard.writeText(text); toast('Copied. Show it to the shop or paste it into a message.'); }
    catch { toast('Couldn’t copy. Select the text and copy it instead.'); }
  };
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="panel col-span-5 space-y-5 p-6">
        <Header title="0% Surcharge Exposer" sub="Expose the true cost of hidden merchant fees." />
        <Amount id="sur-price" label="Item cash price" value={price} onChange={setPrice} presets={SURCHARGE_PRESETS} />
        <div className="grid grid-cols-2 gap-4">
          <Small id="sur-fee" label="Surcharge fee" value={fee} onChange={setFee} suffix="%" hint="Upfront POS card fee" />
          <Small id="sur-months" label="Plan duration" value={months} onChange={setMonths} suffix="Months" hint="0% Installments" />
        </div>
      </div>
      <div className="col-span-7 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Result tone="danger" eyebrow="Effective interest (APR)" value={s.empty ? '--' : s.apr!.toFixed(1) + '%'} lines={['True cost of the fee']} />
          <Result tone="neutral" eyebrow="Hidden costs" value={s.empty ? '--' : lkr(s.hidden!)} lines={['Upfront fee', 'Paid immediately']} />
          <Result tone="neutral" eyebrow="Total outflow" value={s.empty ? '--' : lkr(s.total!)} lines={[s.empty ? '--' : s.sub!]} foot={s.empty ? undefined : s.insight} />
        </div>
        <Explainer icon="gavel" title="Merchant surcharge directive">
          Under Visa, Mastercard &amp; CBSL Merchant Regulations, merchants cannot penalize electronic payments with unapproved surcharges. Cardholders retain the right to report illegal pass-on rates to the acquiring bank.
        </Explainer>
        <button type="button" className="btn-primary w-full justify-center" onClick={negotiate}>Negotiate cash discount<Icon name="content_copy" size={18} /></button>
      </div>
    </div>
  );
}

export function Simulators() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'minimum';
  // Opening Simulators ticks the onboarding checklist's "try a simulator", as on the phone
  useEffect(() => { noteSimulatorVisit(); }, []);
  return (
    <div className="mx-auto max-w-[1440px] px-8 py-7">
      <h1 className="font-serif text-[30px] font-medium leading-tight tracking-tight">Simulators</h1>
      <p className="mt-1 text-[13px] text-faint">Try a saved card or your own numbers. Nothing here changes your cards.</p>
      <Tabs.Root value={tab} onValueChange={(v) => setParams(v === 'minimum' ? {} : { tab: v }, { replace: true })} className="mt-6">
        <Tabs.List className="mb-5 inline-flex rounded-xl bg-sunken p-1" aria-label="Simulators" data-tip="sim-tabs">
          {[['minimum', 'Min Payment Trap', 'trending_down'], ['advance', 'Cash Advance', 'local_atm'], ['surcharge', '0% Surcharge', 'percent']].map(([v, l, i]) => (
            <Tabs.Trigger key={v} value={v} className="flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-faint transition-colors hover:text-ink data-[state=active]:bg-panel data-[state=active]:text-ink data-[state=active]:shadow-card">
              <Icon name={i} size={18} />{l}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="minimum"><MinimumTrap cards={app.cards} /></Tabs.Content>
        <Tabs.Content value="advance"><CashAdvance cards={app.cards} /></Tabs.Content>
        <Tabs.Content value="surcharge"><Surcharge /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
