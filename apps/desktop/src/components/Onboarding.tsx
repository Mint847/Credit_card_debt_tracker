// Guided setup for desktop: the welcome (three slides ending with income and strategy), the
// "Get started" checklist and first-visit spotlight tips on each screen. The rules and flags are the
// phone app's (shared core, onboarding.js), so progress made on one device shows on the others.
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import confetti from 'canvas-confetti';
import { checklistState, isValidDay } from '@serendib/core';
import { useApp, onboarding, finishWelcome, skipWelcome, dismissChecklist, noteChecklistComplete, markTipsSeen, skipAllTips } from '../lib/store';
import { Icon, useToast } from './ui';
import { layoutNow } from '../lib/layout';
import { useCardDialogs } from './CardDialogs';
import type { Strategy } from '../lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ── 1. Welcome ── */
export function Welcome() {
  const app = useApp();
  const navigate = useNavigate();
  const o = onboarding();
  const open = app.status === 'ready' && !!o && !!o.version && !o.welcomeDone;
  const [slide, setSlide] = useState(0);
  const [income, setIncome] = useState('');
  const [strategy, setStrategy] = useState<Strategy>(app.strategy);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setSlide(0); setError(''); setStrategy(app.strategy);
    setIncome(o.incomeSet && app.profile.income ? app.profile.income : '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  const finish = () => {
    const err = finishWelcome(income, strategy);
    if (err) { setError(err); return; }
    navigate('/');
  };
  const skip = () => { skipWelcome(); navigate('/'); };
  return (
    <Dialog.Root open onOpenChange={(v) => { if (!v) skip(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[3px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 grid w-[860px] -translate-x-1/2 -translate-y-1/2 grid-cols-[320px_1fr] overflow-hidden rounded-3xl border border-line bg-panel shadow-pop focus:outline-none tablet:w-[min(860px,calc(100vw-48px))] tablet:grid-cols-[260px_1fr] phone:inset-x-0 phone:bottom-0 phone:left-0 phone:top-auto phone:max-h-[92vh] phone:w-full phone:translate-x-0 phone:translate-y-0 phone:grid-cols-1 phone:overflow-y-auto phone:rounded-b-none phone:pb-[env(safe-area-inset-bottom)]">
          <div className="relative flex flex-col justify-between overflow-hidden p-8 text-white phone:hidden" style={{ background: 'linear-gradient(160deg, #00473c 0%, #006b5c 55%, #008374 100%)' }}>
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-serif text-[18px] font-semibold text-[#006b5c]">S</span>
              <span className="font-serif text-[20px]">Serendib</span>
            </div>
            <div className="relative">
              <Icon name={['account_balance_wallet', 'flag', 'tune'][slide]} size={44} className="opacity-90" />
              <p className="mt-3 text-[13px] text-white/75">Step {slide + 1} of 3</p>
              <div className="mt-2 flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className={'h-1.5 rounded-full transition-all ' + (i === slide ? 'w-6 bg-white' : 'w-1.5 bg-white/40')} />)}</div>
            </div>
          </div>
          <div className="flex min-h-[440px] flex-col p-8 phone:min-h-0 phone:p-5">
            <div className="flex items-center justify-end phone:justify-between">
              <div className="hidden items-center gap-1.5 phone:flex" aria-label={'Step ' + (slide + 1) + ' of 3'}>{[0, 1, 2].map((i) => <span key={i} className={'h-1.5 rounded-full transition-all ' + (i === slide ? 'w-6 bg-brand' : 'w-1.5 bg-line-strong')} />)}</div>
              <button type="button" onClick={skip} className="text-[12px] font-semibold text-faint hover:text-ink phone:py-2">Skip for now</button>
            </div>
            <div className="flex-1">
              {slide === 0 && (
                <>
                  <Dialog.Title className="font-serif text-[28px] font-medium leading-tight">See all your card debt in one place</Dialog.Title>
                  <Dialog.Description className="mt-2 text-[14px] text-muted">Link your credit cards and Serendib keeps a live picture of what you owe.</Dialog.Description>
                  <ul className="mt-6 space-y-3 text-[14px]">
                    {[['donut_large', 'Total debt & utilisation', ' across every card'], ['trending_down', 'Interest this month', ', so you can see what your debt costs'], ['notifications', 'Due-date alerts', ' once you set each card’s billing cycle']].map(([i, b, t]) => (
                      <li key={b} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-ink"><Icon name={i} size={19} /></span><span><strong>{b}</strong>{t}</span></li>
                    ))}
                  </ul>
                </>
              )}
              {slide === 1 && (
                <>
                  <Dialog.Title className="font-serif text-[28px] font-medium leading-tight">Pay the right card first</Dialog.Title>
                  <Dialog.Description className="mt-2 text-[14px] text-muted">Each month Serendib splits a safe repayment budget across your cards.</Dialog.Description>
                  <ol className="mt-6 space-y-3 text-[14px]">
                    {[<>Every card gets at least its <strong>minimum payment</strong>.</>, <>The rest goes to one <strong>priority card</strong>, chosen by your strategy.</>, <>When it’s cleared, the money <strong>rolls on to the next card</strong>.</>].map((t, i) => (
                      <li key={i} className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">{i + 1}</span><span>{t}</span></li>
                    ))}
                  </ol>
                </>
              )}
              {slide === 2 && (
                <>
                  <Dialog.Title className="font-serif text-[28px] font-medium leading-tight">Personalise your plan</Dialog.Title>
                  <Dialog.Description className="mt-2 text-[14px] text-muted">Two answers and your repayment plan is ready. You can change both later in Settings.</Dialog.Description>
                  <label htmlFor="ob-income" className="mt-6 block text-[12px] font-semibold text-muted">Monthly take-home income</label>
                  <div className="relative mt-1.5">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-faint">LKR</span>
                    <input id="ob-income" type="number" min={0} value={income} onChange={(e) => setIncome(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') finish(); }}
                      className="field num h-11 pl-12 text-[16px] font-bold" placeholder="175000" />
                  </div>
                  <p className="mt-1 text-[12px] text-faint">Sets a safe repayment budget (25% of income) and your debt-to-income score.</p>
                  <p className="mt-5 text-[12px] font-semibold text-muted">Payoff strategy</p>
                  <div role="radiogroup" aria-label="Payoff strategy" className="mt-1.5 grid grid-cols-2 gap-2">
                    {([['avalanche', 'Avalanche', 'Highest interest first. Saves the most money.'], ['snowball', 'Snowball', 'Smallest balance first. Quickest wins.']] as [Strategy, string, string][]).map(([v, t, sub]) => (
                      <button key={v} type="button" role="radio" aria-checked={strategy === v} onClick={() => setStrategy(v)}
                        className={'rounded-xl border p-3 text-left ' + (strategy === v ? 'border-2 border-brand bg-brand/5' : 'border-line hover:bg-sunken')}>
                        <span className="block text-[13px] font-semibold">{t}</span><span className="mt-0.5 block text-[12px] text-faint">{sub}</span>
                      </button>
                    ))}
                  </div>
                  {error && <p role="alert" className="mt-3 text-[12px] font-semibold text-danger">{error}</p>}
                </>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setSlide(Math.max(0, slide - 1))} className={'btn-ghost ' + (slide === 0 ? 'invisible' : '')}>Back</button>
              <button type="button" autoFocus className="btn-primary h-10 px-6 phone:h-11" onClick={() => (slide < 2 ? setSlide(slide + 1) : finish())}>{slide === 2 ? 'Finish setup' : 'Next'}</button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ── 2. Get started checklist (on the Overview) ── */
export function Checklist() {
  const app = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const openDialog = useCardDialogs();
  const o = onboarding();
  const st = o ? checklistState(o, app.cards, app.spaces) : null;
  const [celebrateUntil, setCelebrateUntil] = useState(0);
  useEffect(() => {
    if (!st || st.hidden || !st.allDone) return;
    if (noteChecklistComplete()) {
      setCelebrateUntil(Date.now() + 6000);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        confetti({ particleCount: 90, spread: 75, gravity: 1.1, origin: { y: 0.25, x: 0.5 }, colors: ['#10b981', '#34d399', '#FFD700', '#4ECDC4'] });
      }
      setTimeout(() => setCelebrateUntil(0), 6100);
    }
  }, [st && st.allDone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!st || st.hidden) return null;
  if (o.checklistCompleted && Date.now() >= celebrateUntil) return null;
  const go = (key: string) => {
    if (key === 'income') navigate('/settings#set-profile');
    else if (key === 'strategy') navigate('/settings#set-strategy');
    else if (key === 'card') openDialog({ kind: 'add' });
    else if (key === 'billing') {
      const c = app.cards.find((x) => !(isValidDay(x.statementDay) && isValidDay(x.dueDay)));
      if (!c) openDialog({ kind: 'add' }); else { navigate('/cards/' + c.id); openDialog({ kind: 'billing', cardId: c.id }); }
    } else if (key === 'sim') navigate('/simulators');
    else if (key === 'buffer') navigate('/spaces?create=1');
  };
  return (
    <section className="panel" data-tip="checklist" aria-label="Get started">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <div>
          <h2 className="text-[14px] font-semibold">{st.title}</h2>
          <p className="text-[12px] text-faint">{st.progress}</p>
        </div>
        {!st.allDone && <button type="button" className="btn-ghost h-8 text-[12px]" onClick={() => toast(dismissChecklist())}>Hide</button>}
      </div>
      <div className="mx-5 h-1.5 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-ok transition-all" style={{ width: st.pct + '%' }} /></div>
      <ul className="grid grid-cols-3 gap-1 p-3 tablet:grid-cols-2 phone:grid-cols-1 phone:p-2">
        {st.items.map((it: any) => (
          <li key={it.key}>
            <button type="button" disabled={it.done} onClick={() => go(it.key)}
              className={'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ' + (it.done ? 'cursor-default' : 'hover:bg-sunken')}>
              <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ' + (it.done ? 'bg-ok text-white' : 'border-2 border-line-strong text-transparent')}><Icon name="check" size={15} /></span>
              <span className="min-w-0">
                <span className="sr-only">{it.done ? 'Done: ' : 'To do: '}</span>
                <span className={'block truncate text-[13px] font-semibold ' + (it.done ? 'text-faint line-through' : '')}>{it.label}</span>
                {!it.done && <span className="block truncate text-[11px] text-faint">{it.hint}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── 3. Spotlight tips ── */
// touch: the wording on phones and iPads, where it differs (no keyboard shortcuts, tap rather than click)
interface Tip { tip: string; title: string; body: ReactNode; touch?: ReactNode }
const TIPS: Record<string, Tip[]> = {
  'screen-home': [
    { tip: 'checklist', title: 'Your setup checklist', body: 'Finish these steps to build your repayment plan. Each one ticks itself off as you go.' },
    { tip: 'kpis', title: 'Your debt at a glance', body: 'Total debt and limit across every card, and how much of your limit you are using. Under 30% is healthy.' },
    { tip: 'log', title: 'Log in one tap', body: 'Record a purchase, a payment or a refund, or paste a bank SMS. Every total updates straight away.',
      touch: 'Tap + to record a purchase, a payment or a refund, or paste a bank SMS. Every total updates straight away.' },
    { tip: 'alerts', title: 'What needs you', body: 'Due dates, overdue payments, budgets you have gone over and charges due tomorrow show up here, each with a label saying what it is.' },
    { tip: 'payoff', title: 'Your payoff plan', body: 'Your debt-free date and the interest your strategy saves compared with paying minimums.' },
    { tip: 'search', title: 'Search and shortcuts', body: 'Press Ctrl K to jump anywhere or run any action. Press ? to see every keyboard shortcut.',
      touch: 'Search for any card, entry or page, or run an action, from here.' }
  ],
  'screen-list': [
    { tip: 'cards-table', title: 'All your cards', body: 'Sort by any column. Click a card to see its details, or double-click to open it.',
      touch: 'Each card’s balance and how much of its limit you are using. Tap a card to open it.' },
    { tip: 'add-card', title: 'Link a card', body: 'Add each credit card with its limit and current balance. Everything else updates from here.' }
  ],
  'screen-detail': [
    { tip: 'card-menu', title: 'Card actions', body: 'Edit the card, set its billing cycle, match a statement, set budgets, share your progress, mark it settled or delete it.' },
    { tip: 'card-tabs', title: 'Everything for this card', body: 'Its activity, recurring payments, budgets, calculators and statements, one tab each.' },
    { tip: 'card-log', title: 'Log what you spend', body: 'Log purchases and payments on this card, or paste a bank SMS.' }
  ],
  'screen-simulators': [
    { tip: 'sim-tabs', title: 'Three sandboxes', body: 'The minimum payment trap, cash advance costs and the interest hidden in a "0%" plan. Load one of your cards or try your own numbers.' }
  ],
  'screen-spaces': [
    { tip: 'add-space', title: 'Build a buffer', body: 'Create a savings space for emergencies, so a surprise bill does not land on a credit card. Add money, use it when you need it and see each space’s history.' }
  ],
  'view-offers': [
    { tip: 'offers-mode', title: 'Card offers', body: 'Promotions matched to your cards, or explore every bank. Open any offer’s terms before you use it.' }
  ],
  'screen-profile': [
    { tip: 'set-income', title: 'Your income', body: 'Your monthly take-home pay. A quarter of it becomes your default repayment budget.' },
    { tip: 'set-backup', title: 'Back up your data', body: 'Download a copy of your cards, spending and spaces, and restore it if you ever need to.' },
    { tip: 'set-replay', title: 'Need a refresher?', body: 'Replay the welcome and these tips from here whenever you like.' }
  ]
};
function screenFor(path: string): string | null {
  if (path === '/') return 'screen-home';
  if (path === '/cards') return 'screen-list';
  if (/^\/cards\/[^/]+$/.test(path)) return 'screen-detail';
  if (path === '/simulators') return 'screen-simulators';
  if (path === '/spaces') return 'screen-spaces';
  if (path === '/offers') return 'view-offers';
  if (path === '/settings') return 'screen-profile';
  return null;
}

export function Tips() {
  const app = useApp();
  const loc = useLocation();
  const o = onboarding();
  const screen = screenFor(loc.pathname);
  const ready = app.status === 'ready' && !!o && o.welcomeDone && !!screen && !o.tipsSeen[screen];
  const [list, setList] = useState<Tip[]>([]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // The tips whose element is on this screen, a moment after it settles
  useEffect(() => {
    setList([]); setI(0); setRect(null);
    if (!ready) return;
    const t = setTimeout(() => setList((TIPS[screen!] || []).filter((x) => document.querySelector('[data-tip="' + x.tip + '"]'))), 700);
    return () => clearTimeout(t);
  }, [ready, screen]);
  const tip = list[i];
  // Follow the element as the page moves or resizes
  useLayoutEffect(() => {
    if (!tip) return;
    let raf = 0;
    const measure = () => {
      const el = document.querySelector('[data-tip="' + tip.tip + '"]');
      if (el) setRect(el.getBoundingClientRect());
      raf = requestAnimationFrame(measure);
    };
    const el = document.querySelector('[data-tip="' + tip.tip + '"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
    measure();
    return () => cancelAnimationFrame(raf);
  }, [tip]);
  // Paused while any other dialog is open (the tip itself is marked data-tips)
  if (!ready || !tip || !rect || document.querySelector('[role=dialog]:not([data-tips])')) return null;
  const close = () => { markTipsSeen(screen!); setList([]); };
  const next = () => (i < list.length - 1 ? setI(i + 1) : close());
  const pad = 6, W = Math.min(320, window.innerWidth - 32), below = rect.bottom + 12 + 170 < window.innerHeight;
  const left = Math.max(16, Math.min(window.innerWidth - W - 16, rect.left));
  const top = below ? rect.bottom + 12 : Math.max(16, rect.top - 12 - 170);
  return (
    <div className="fixed inset-0 z-[55]" role="dialog" data-tips aria-label={tip.title} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
      <div className="absolute inset-0" onClick={next} />
      <div className="pointer-events-none absolute rounded-xl ring-[9999px] ring-black/35 transition-all"
        style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      <div className="absolute rounded-2xl border border-line bg-panel p-4 shadow-pop" style={{ left, top, width: W }}>
        <p className="text-[11px] font-semibold text-faint">Tip {i + 1} of {list.length}</p>
        <p className="mt-1 text-[14px] font-semibold">{tip.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{layoutNow() !== 'desktop' && tip.touch ? tip.touch : tip.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" className="text-[12px] font-semibold text-faint hover:text-ink" onClick={() => { skipAllTips(); setList([]); }}>Skip tips</button>
          <button type="button" autoFocus className="btn-primary h-8" onClick={next}>{i < list.length - 1 ? 'Next' : 'Done'}</button>
        </div>
      </div>
    </div>
  );
}
