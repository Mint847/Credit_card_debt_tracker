// The card dialogs: add / edit card, billing cycle, match my statement, clear balance, delete,
// share progress, category budgets and recurring payments. Same fields, checks and messages as the
// phone app's sheets (the checks run in the shared core); laid out as centred dialogs.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import confetti from 'canvas-confetti';
import {
  CARD_THEMES, SPEND_CATEGORIES, RECURRING_SUGGESTIONS, bankSuggestions, tierSuggestions, rankSuggestions, cardApr, isValidDay,
  parseAmountInput, matchDiffText, shareText, recurringStatusText, recurringDayHint, chargeNowDate, recurringNextDue, isCancelled,
  billingPeriod, periodSummary, ymd, parseYmd, dueDateFor, spendCategory, catchUpPlan
} from '@serendib/core';
import {
  useApp, findCard, addNewCard, editCard, clearBalance, deleteCard, setBilling, matchBalance, saveBudgets, saveRecurring,
  cancelRecurring, removeRecurring, togglePaused, type Done
} from '../lib/store';
import { fmtAmt, shortDate } from '../lib/format';
import { cardName } from '../lib/derive';
import { CardDot, Icon, useToast } from './ui';
import { dialogFrame, useLayout } from '../lib/layout';
import type { Card } from '../lib/types';

export type CardDialog =
  | { kind: 'add' }
  | { kind: 'edit' | 'billing' | 'match' | 'settle' | 'delete' | 'share' | 'budgets'; cardId: string }
  | { kind: 'recurring'; cardId: string; itemId?: string }
  | { kind: 'catchup'; cardId: string };

const Ctx = createContext<(d: CardDialog) => void>(() => {});
export const useCardDialogs = () => useContext(Ctx);

/* Building blocks */
export function Modal({ open, onClose, title, width = 480, children }: { open: boolean; onClose: () => void; title: string; width?: number; children: ReactNode }) {
  const layout = useLayout();
  const frame = dialogFrame(layout, width);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="motion-overlay fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content style={frame.style} className={frame.className}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-6 py-4 phone:border-b-0 phone:px-5 phone:pb-2 phone:pt-5">
            <Dialog.Title className="text-[15px] font-semibold phone:text-[19px] phone:font-bold phone:tracking-tight">{title}</Dialog.Title>
            <Dialog.Close className="btn-ghost h-8 w-8 justify-center px-0 phone:h-10 phone:w-10 phone:rounded-full phone:bg-sunken" aria-label="Close"><Icon name="close" /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="px-6 py-5 phone:px-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CardLine({ card }: { card: Card }) {
  return <p className="mb-4 flex items-center gap-2 text-[13px] font-semibold"><CardDot card={card} />{cardName(card)}</p>;
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-semibold text-muted">{children}</label>;
}

export function ErrorLine({ text }: { text: string }) {
  return text ? <p role="alert" className="mt-3 text-[12px] font-semibold text-danger">{text}</p> : null;
}

export function Actions({ onCancel, primary, onPrimary, danger }: { onCancel: () => void; primary: string; onPrimary: () => void; danger?: boolean }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      <button type="button" className={danger ? 'btn bg-danger text-white hover:bg-danger/90 dark:text-canvas' : 'btn-primary'} onClick={onPrimary}>{primary}</button>
    </div>
  );
}

// A text field with a suggestion list (the phone app's attachSuggest): arrow keys, Enter, Escape
export function Suggest({ id, value, onChange, source, placeholder, maxLength }: {
  id: string; value: string; onChange: (v: string, item?: { label: string; category?: string }) => void;
  source: () => { header?: string; items: { label: string; hint?: string; terms?: string[]; category?: string }[] }; placeholder?: string; maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const src = source();
  type Item = { label: string; hint?: string; terms?: string[]; category?: string };
  const shown: Item[] = useMemo(() => rankSuggestions(src.items, value).slice(0, 8), [src.items, value]);
  const choose = (it: { label: string; category?: string }) => { onChange(it.label, it); setOpen(false); setActive(-1); };
  return (
    <div className="relative">
      <input id={id} value={value} placeholder={placeholder} maxLength={maxLength} autoComplete="off" role="combobox"
        aria-expanded={open && shown.length > 0} aria-controls={id + '-list'} className="field h-10"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open || !shown.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % shown.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? shown.length - 1 : a - 1)); }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(shown[active]); }
          else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
        }} />
      {open && shown.length > 0 && (
        <ul id={id + '-list'} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-line bg-panel p-1 shadow-pop scroll-thin">
          {src.header && <li className="label px-2.5 pb-1 pt-1.5" role="presentation">{src.header}</li>}
          {shown.map((it, i) => (
            <li key={it.label} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(it); }}
              className={'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13px] ' + (i === active ? 'bg-sunken' : 'hover:bg-sunken')}>
              <span className="truncate">{it.label}</span>{it.hint && <span className="truncate text-[11px] text-faint">{it.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A colour's name; spaces default to emerald, cards to teal
export function colourName(k: string, defaultKey = 'teal') {
  const base = String(CARD_THEMES[k].name).replace(' (default)', '');
  return k === defaultKey ? base + ' (default)' : base;
}

export function ColourPicker({ value, onChange, defaultKey = 'teal' }: { value: string; onChange: (k: string) => void; defaultKey?: string }) {
  return (
    <div role="radiogroup" aria-label="Icon colour" className="flex flex-wrap gap-2">
      {Object.keys(CARD_THEMES).map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} aria-label={colourName(k, defaultKey)} title={colourName(k, defaultKey)} onClick={() => onChange(k)}
          className={'h-8 w-8 rounded-full ring-offset-2 ring-offset-panel transition ' + (value === k ? 'ring-2 ring-ink' : 'hover:scale-110')}
          style={{ background: CARD_THEMES[k].hex }} />
      ))}
    </div>
  );
}

export function Money({ id, value, onChange, placeholder, big }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; big?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-faint">LKR</span>
      <input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={'field num pl-11 ' + (big ? 'h-12 text-[18px] font-bold' : 'h-10')} />
    </div>
  );
}

/* Add / edit card */
function CardForm({ card, onClose, onDone }: { card?: Card; onClose: () => void; onDone: (d: Done & { id?: string }) => void }) {
  const [bank, setBank] = useState(card?.bank || '');
  const [nick, setNick] = useState(card?.nick || '');
  const [color, setColor] = useState(card && CARD_THEMES[card.color] ? card.color : 'teal');
  const [limit, setLimit] = useState(card ? String(card.limit || '') : '');
  const [balance, setBalance] = useState(card ? String(card.balance ?? '') : '');
  const [zero, setZero] = useState(!!card?.isZeroPercent);
  // The card's real (non-0%) APR, so turning 0% off restores it
  const storedApr = card ? parseFloat(String(card.apr)) : NaN;
  const [apr, setApr] = useState(card ? String(isFinite(storedApr) && storedApr > 0 ? storedApr : card.isZeroPercent ? 28 : cardApr(card)) : '');
  const [last4, setLast4] = useState(card?.last4 || '');
  const [error, setError] = useState('');
  function save() {
    const res = card
      ? editCard(card.id, { bank, nick, limit, balance, apr, isZeroPercent: zero, color, last4 })
      : addNewCard({ bank, nick, color, limit: parseFloat(limit.replace(/,/g, '')), balance: parseFloat(balance.replace(/,/g, '')) });
    if (res.error) { setError(res.error); return; }
    onDone(res);
  }
  return (
    <>
      {!card && <p className="-mt-1 mb-4 text-[13px] text-muted">Saved to your account and synced to your devices.</p>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cf-bank">Bank name</Label>
          <Suggest id="cf-bank" value={bank} onChange={setBank} source={bankSuggestions} placeholder="Start typing, e.g. Sampath" />
        </div>
        <div>
          <Label htmlFor="cf-nick">{card ? 'Card network & tier' : 'Card tier / nickname'}</Label>
          <Suggest id="cf-nick" value={nick} onChange={setNick} source={() => tierSuggestions(bank)} placeholder="e.g. Visa Platinum, or your own name" />
        </div>
        <div>
          <Label htmlFor="cf-limit">{card ? 'Total credit limit (LKR)' : 'Credit limit (LKR)'}</Label>
          <Money id="cf-limit" value={limit} onChange={setLimit} placeholder="300,000" />
        </div>
        <div>
          <Label htmlFor="cf-balance">{card ? 'Current outstanding balance (LKR)' : 'Current balance (LKR)'}</Label>
          <Money id="cf-balance" value={balance} onChange={setBalance} placeholder="0" />
        </div>
        {card && (
          <>
            <div>
              <Label htmlFor="cf-apr">Interest rate (APR %)</Label>
              <input id="cf-apr" inputMode="decimal" value={apr} onChange={(e) => setApr(e.target.value)} disabled={zero} className="field num h-10 disabled:opacity-50" />
            </div>
            <div>
              <Label htmlFor="cf-last4">Last 4 digits <span className="font-normal text-faint">(optional)</span></Label>
              <input id="cf-last4" inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value)} placeholder="e.g. 4521" className="field num h-10" />
              <p className="mt-1 text-[11px] text-faint">Matches pasted bank SMS to this card. Never enter the full card number.</p>
            </div>
            <label className="col-span-2 flex cursor-pointer items-center justify-between rounded-xl border border-line px-4 py-3">
              <span><span className="block text-[13px] font-semibold">0% Installment Plan</span><span className="block text-[12px] text-faint">Treat this card as 0% interest</span></span>
              <input type="checkbox" checked={zero} onChange={(e) => setZero(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--brand))]" />
            </label>
          </>
        )}
        <div className="col-span-2">
          <p className="mb-1.5 text-[12px] font-semibold text-muted">Icon colour · <span className="font-normal">{CARD_THEMES[color].name}</span></p>
          <ColourPicker value={color} onChange={setColor} />
        </div>
      </div>
      <ErrorLine text={error} />
      <Actions onCancel={onClose} primary={card ? 'Save changes' : 'Add card'} onPrimary={save} />
    </>
  );
}

/* Billing cycle */
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fullDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

// A day of the month picked from a calendar. Only the day is kept (it repeats every month); the calendar opens
// on the month it next falls in, with the cycle's other date marked so the gap between them is easy to see.
function DayPicker({ id, value, onChange, at, other, otherName }: {
  id: string; value: number; onChange: (day: number) => void; at: Date; other: Date; otherName: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(at.getFullYear(), at.getMonth(), 1));
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) setMonth(new Date(at.getFullYear(), at.getMonth(), 1)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const y = month.getFullYear(), m = month.getMonth();
  const count = new Date(y, m + 1, 0).getDate();
  const lead = new Date(y, m, 1).getDay();
  const today = new Date();
  const focusDay = (d: number) => grid.current?.querySelector<HTMLButtonElement>('[data-day="' + d + '"]')?.focus();
  const onKey = (e: React.KeyboardEvent, d: number) => {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    if (!step) return;
    e.preventDefault();
    focusDay(Math.min(count, Math.max(1, d + step)));
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button id={id} type="button" className="field flex h-10 items-center justify-between gap-2 text-left">
          <span>Day {value}</span>
          <Icon name="calendar_month" size={18} className="text-faint" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} collisionPadding={12}
          onOpenAutoFocus={(e) => { e.preventDefault(); requestAnimationFrame(() => focusDay(value <= count ? value : count)); }}
          className="z-[70] w-[284px] rounded-xl border border-line bg-panel p-3 shadow-pop focus:outline-none">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="btn-ghost h-8 w-8 justify-center px-0" aria-label="Previous month" onClick={() => setMonth(new Date(y, m - 1, 1))}><Icon name="chevron_left" /></button>
            <p className="text-[13px] font-semibold" aria-live="polite">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
            <button type="button" className="btn-ghost h-8 w-8 justify-center px-0" aria-label="Next month" onClick={() => setMonth(new Date(y, m + 1, 1))}><Icon name="chevron_right" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-faint" aria-hidden="true">
            {WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}
          </div>
          <div ref={grid} className="grid grid-cols-7 gap-y-0.5" role="group" aria-label="Days">
            {Array.from({ length: lead }, (_, i) => <span key={'b' + i} />)}
            {Array.from({ length: count }, (_, i) => {
              const d = i + 1, date = new Date(y, m, d);
              const picked = sameDay(date, at), marked = sameDay(date, other), isToday = sameDay(date, today);
              return (
                <button key={d} type="button" data-day={d} tabIndex={d === Math.min(value, count) ? 0 : -1}
                  aria-pressed={picked} aria-label={date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (marked ? ', ' + otherName : '')}
                  onClick={() => { onChange(d); setOpen(false); }} onKeyDown={(e) => onKey(e, d)}
                  className={'mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ' +
                    (picked ? 'bg-brand font-semibold text-white dark:text-canvas' : marked ? 'font-semibold text-brand-ink ring-1 ring-inset ring-brand/50 hover:bg-sunken' : 'hover:bg-sunken') +
                    (isToday && !picked ? ' underline decoration-2 underline-offset-4' : '')}>
                  {d}
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-[11px] text-faint">
            <span className="inline-block h-3 w-3 rounded-full ring-1 ring-inset ring-brand/50" aria-hidden="true" />{otherName}: {fullDate(other)}
            <span className="ml-auto">Repeats monthly</span>
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Billing({ card, onClose, onDone }: { card: Card; onClose: () => void; onDone: (d: Done) => void }) {
  const todayDay = new Date().getDate();
  const [sd, setSd] = useState(isValidDay(card.statementDay) ? card.statementDay! : todayDay);
  const [dd, setDd] = useState(isValidDay(card.dueDay) ? card.dueDay! : todayDay);
  const [error, setError] = useState('');
  // Where these days next fall: the next statement (today counts), and the first due day after it
  const stmtStr: string = billingPeriod({ statementDay: sd }, ymd(new Date())).end;
  const dueStr: string = dueDateFor(stmtStr, dd);
  const stmt = parseYmd(stmtStr) as Date, due = parseYmd(dueStr) as Date;
  const gap = Math.round((due.getTime() - stmt.getTime()) / 864e5);
  return (
    <>
      <CardLine card={card} />
      <div className="grid grid-cols-2 gap-4">
        {/* Labels top-aligned, fields level (a label may wrap on narrow screens) */}
        <div className="flex flex-col">
          <Label htmlFor="bc-statement">Statement date</Label>
          <div className="mt-auto"><DayPicker id="bc-statement" value={sd} onChange={setSd} at={stmt} other={due} otherName="Payment due" /></div>
        </div>
        <div className="flex flex-col">
          <Label htmlFor="bc-due">Payment due date</Label>
          <div className="mt-auto"><DayPicker id="bc-due" value={dd} onChange={setDd} at={due} other={stmt} otherName="Statement" /></div>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-lg bg-sunken px-3 py-2.5 text-[12px] text-muted" aria-live="polite">
        <Icon name="event" size={16} className="mt-px text-faint" />
        <span>Next statement on <b className="font-semibold text-ink">{fullDate(stmt)}</b>, payment due <b className="font-semibold text-ink">{fullDate(due)}</b> ({gap} {gap === 1 ? 'day' : 'days'} later).</span>
      </p>
      <p className="mt-3 text-[12px] text-faint">Changing these starts tracking again from the cycle that’s still awaiting payment.</p>
      <ErrorLine text={error} />
      <Actions onCancel={onClose} primary="Save changes" onPrimary={() => { const r = setBilling(card.id, sd, dd); if (r.error) setError(r.error); else onDone(r); }} />
    </>
  );
}

/* Match my statement */
function Match({ card, onClose, onDone }: { card: Card; onClose: () => void; onDone: (d: Done) => void }) {
  const [v, setV] = useState(String(Number(card.balance) || 0));
  const [error, setError] = useState('');
  return (
    <>
      <CardLine card={card} />
      <p className="-mt-1 mb-4 text-[13px] text-muted">Enter the outstanding balance from your latest statement or banking app. The difference is logged as an adjustment, so your history still adds up.</p>
      <Label htmlFor="match-amount">Actual balance</Label>
      <Money id="match-amount" value={v} onChange={setV} big />
      <p className="mt-2 text-[12px] text-faint" aria-live="polite">{matchDiffText(card, parseAmountInput(v), fmtAmt)}</p>
      <ErrorLine text={error} />
      <Actions onCancel={onClose} primary="Update balance" onPrimary={() => { const r = matchBalance(card.id, parseAmountInput(v)); if (r.error) setError(r.error); else onDone(r); }} />
    </>
  );
}

/* Share progress */
function Share({ card, onClose }: { card: Card; onClose: () => void }) {
  const app = useApp();
  const toast = useToast();
  const text = shareText(app.cards, card);
  async function copy() {
    try { await navigator.clipboard.writeText(text); toast('Copied. Paste it anywhere to share.'); onClose(); }
    catch (e) { toast('Couldn’t copy. Select the text and copy it instead.', { tone: 'warn' }); }
  }
  return (
    <>
      <CardLine card={card} />
      <p className="label mb-1.5">This is exactly what will be shared</p>
      <div className="rounded-xl border border-line bg-sunken p-4 text-[14px] leading-relaxed">{text}</div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-faint"><Icon name="lock" size={15} />No balances, limits or bank details are included.</p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        {typeof navigator.share === 'function' && (
          <button type="button" className="btn-outline" onClick={() => navigator.share({ text }).then(onClose, () => {})}><Icon name="ios_share" size={18} />Share</button>
        )}
        <button type="button" className="btn-primary" onClick={copy}><Icon name="content_copy" size={18} />Copy text</button>
      </div>
    </>
  );
}

/* Category budgets */
function Budgets({ card, onClose, onDone }: { card: Card; onClose: () => void; onDone: (d: Done) => void }) {
  const cur = periodSummary(card, billingPeriod(card, ymd(new Date())));
  const [raw, setRaw] = useState<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    SPEND_CATEGORIES.forEach((c: { key: string }) => { r[c.key] = card.budgets && card.budgets[c.key] ? String(card.budgets[c.key]) : ''; });
    return r;
  });
  const [error, setError] = useState('');
  return (
    <>
      <CardLine card={card} />
      <p className="-mt-1 mb-4 text-[13px] text-muted">A monthly limit per category on this card. Leave blank for no budget. You’ll get a warning at 80% and when you go over.</p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
        {SPEND_CATEGORIES.map((c: { key: string; label: string; icon: string }) => (
          <div key={c.key} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sunken text-muted"><Icon name={c.icon} size={17} /></span>
            <label htmlFor={'bud-' + c.key} className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{c.label}</span>
              <span className="block text-[11px] text-faint">{fmtAmt(cur.byCat[c.key] || 0)} this period</span>
            </label>
            <input id={'bud-' + c.key} inputMode="decimal" autoComplete="off" placeholder="No budget" value={raw[c.key]}
              onChange={(e) => setRaw({ ...raw, [c.key]: e.target.value })} className="field num h-9 w-28 text-right" />
          </div>
        ))}
      </div>
      <ErrorLine text={error} />
      <Actions onCancel={onClose} primary="Save budgets" onPrimary={() => { const r = saveBudgets(card.id, raw); if (r.error) setError(r.error); else onDone(r); }} />
    </>
  );
}

/* Recurring payment: add, edit, pause, cancel, remove */
function RecurringForm({ card, itemId, onClose, onDone }: { card: Card; itemId?: string; onClose: () => void; onDone: (d: Done) => void }) {
  const today = ymd(new Date());
  const item = itemId ? (card.recurring || []).find((r) => r.id === itemId) : undefined;
  const gone = !!item && isCancelled(item, today);
  const [name, setName] = useState(item?.name || '');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [category, setCategory] = useState(item?.category || 'subscriptions');
  const [day, setDay] = useState(String(item ? item.day : new Date().getDate()));
  const [end, setEnd] = useState(item && item.endDate && !item.cancelled ? item.endDate : '');
  const [now, setNow] = useState(false);
  const [error, setError] = useState('');
  const nowDate = !item ? chargeNowDate(day, new Date()) : null;
  function save() {
    const r = saveRecurring(card.id, item ? item.id : null, { name, amount: parseAmountInput(amount), day: parseInt(day, 10), end, category, chargeNow: now });
    if (r.error) { setError(r.error); return; }
    if (r.gone) { onClose(); return; }
    onDone(r);
  }
  return (
    <>
      <CardLine card={card} />
      {item && <p className="mb-4 rounded-lg bg-sunken px-3 py-2 text-[12px] text-muted">{recurringStatusText(item, today, recurringNextDue(item, today))}</p>}
      <fieldset disabled={gone} className="space-y-4 disabled:opacity-60">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="rec-name">Name</Label>
            <Suggest id="rec-name" value={name} maxLength={40} placeholder="e.g. Netflix, Dialog, Gym"
              onChange={(v, it) => { setName(v); if (it && it.category) setCategory(it.category); }}
              source={() => ({ header: 'Popular in Sri Lanka', items: RECURRING_SUGGESTIONS.map((s: { label: string; category: string }) => ({ label: s.label, hint: spendCategory(s.category).label, category: s.category })) })} />
          </div>
          <div>
            <Label htmlFor="rec-amount">Monthly amount</Label>
            <Money id="rec-amount" value={amount} onChange={setAmount} placeholder="0" />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-muted" id="rec-cat-label">Category</p>
          <div role="radiogroup" aria-labelledby="rec-cat-label" className="grid grid-cols-4 gap-1.5">
            {SPEND_CATEGORIES.map((c: { key: string; label: string; icon: string }) => (
              <button key={c.key} type="button" role="radio" aria-checked={category === c.key} onClick={() => setCategory(c.key)}
                className={'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-medium ' + (category === c.key ? 'border-brand bg-brand/10 text-brand-ink' : 'border-line text-muted hover:bg-sunken')}>
                <Icon name={c.icon} size={16} /><span className="truncate">{c.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="rec-day">Day of month</Label>
            <input id="rec-day" type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} className="field num h-10" />
            <p className="mt-1 text-[11px] text-faint">{recurringDayHint(day)}</p>
          </div>
          <div>
            <Label htmlFor="rec-end">Ends <span className="font-normal text-faint">(optional)</span></Label>
            <input id="rec-end" type="date" min={today} value={end} onChange={(e) => setEnd(e.target.value)} className="field h-10" />
          </div>
        </div>
        {nowDate && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" checked={now} onChange={(e) => setNow(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
            <span>
              <span className="block text-[13px] font-semibold">Add this month’s charge now ({shortDate(nowDate)})</span>
              <span className="mt-0.5 block text-[11px] text-faint">Leave this off if it’s already in the balance you entered for this card.</span>
            </span>
          </label>
        )}
      </fieldset>
      <ErrorLine text={error} />
      <div className="mt-6 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {item && gone && <button type="button" className="btn-outline text-danger" onClick={() => onDone(removeRecurring(card.id, item.id))}>Remove from list</button>}
          {item && !gone && (
            <>
              <button type="button" className="btn-outline" onClick={() => onDone(togglePaused(card.id, item.id))}>{item.paused ? 'Resume' : 'Pause'}</button>
              <button type="button" className="btn-outline text-danger" onClick={() => onDone(cancelRecurring(card.id, item.id))}>Cancel it</button>
            </>
          )}
        </div>
        {!gone && (
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
            <button type="button" className="btn-primary" onClick={save}>{item ? 'Save changes' : 'Add'}</button>
          </div>
        )}
      </div>
    </>
  );
}

/* Catch-up plan for an overdue card */
function CatchUp({ card, cards, onLog, onBudgets }: { card: Card; cards: Card[]; onLog: (amount: number) => void; onBudgets: () => void }) {
  const plan = catchUpPlan(card, cards, ymd(new Date()), fmtAmt);
  return (
    <>
      <CardLine card={card} />
      {plan.banner && (
        <div className="mb-4 rounded-xl border border-danger/25 bg-danger/5 p-3">
          <p className="text-[13px] font-semibold text-danger">{plan.banner.title}</p>
          <p className="mt-0.5 text-[12px] text-danger/80">{plan.banner.body}</p>
        </div>
      )}
      <ol className="space-y-4">
        {plan.steps.map((s: { n: number; title: string; body: string }) => (
          <li key={s.n} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sunken text-[13px] font-bold">{s.n}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">{s.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{s.body}</p>
              {s.n === 1 && <button type="button" className="btn-primary mt-2 h-8" onClick={() => onLog(plan.owed)}>Log payment</button>}
              {s.n === 2 && <button type="button" className="btn-outline mt-2 h-8" onClick={onBudgets}>Set budgets</button>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

const TITLES: Record<CardDialog['kind'], string> = {
  add: 'Link a credit card', edit: 'Edit card details', billing: 'Update billing cycle', match: 'Match my statement',
  settle: 'Settle this card?', delete: 'Delete this card?', share: 'Share progress', budgets: 'Category budgets', recurring: 'Recurring payment',
  catchup: 'Catch-up plan'
};

export function CardDialogsProvider({ children, onCardAdded, onCardDeleted, onLogPayment }: { children: ReactNode; onCardAdded: (id: string) => void; onCardDeleted: (id: string) => void; onLogPayment: (cardId: string, amount: number) => void }) {
  const [d, setD] = useState<CardDialog | null>(null);
  const toast = useToast();
  const app = useApp();
  const close = () => setD(null);
  const done = (r: Done & { id?: string }) => {
    const was = d;
    setD(null);
    if (r.text) toast(r.text, { tone: r.tone, action: r.undo ? { label: 'Undo', run: r.undo } : undefined });
    if (was?.kind === 'add' && r.id) onCardAdded(r.id);
  };
  const card = d && 'cardId' in d ? findCard(d.cardId) : undefined;
  // The card was removed on another device while its dialog was open
  useEffect(() => { if (d && 'cardId' in d && !card) setD(null); }, [app, d, card]);

  let title = d ? TITLES[d.kind] : '';
  if (d?.kind === 'recurring' && !d.itemId) title = 'Add recurring payment';
  let body: ReactNode = null;
  if (d?.kind === 'add') body = <CardForm onClose={close} onDone={done} />;
  else if (card && d) {
    switch (d.kind) {
      case 'edit': body = <CardForm card={card} onClose={close} onDone={done} />; break;
      case 'billing': body = <Billing card={card} onClose={close} onDone={done} />; break;
      case 'match': body = <Match card={card} onClose={close} onDone={done} />; break;
      case 'share': body = <Share card={card} onClose={close} />; break;
      case 'budgets': body = <Budgets card={card} onClose={close} onDone={done} />; break;
      case 'recurring': body = <RecurringForm card={card} itemId={d.itemId} onClose={close} onDone={done} />; break;
      case 'catchup': body = <CatchUp card={card} cards={app.cards} onLog={(amount) => { setD(null); onLogPayment(card.id, amount); }} onBudgets={() => setD({ kind: 'budgets', cardId: card.id })} />; break;
      case 'settle':
        body = (
          <>
            <CardLine card={card} />
            <p className="text-[13px] text-muted">This will update the outstanding balance of {card.bank} {card.nick} to zero.</p>
            <Actions onCancel={close} primary="Settle" onPrimary={() => {
              done(clearBalance(card.id));
              confetti({ particleCount: 100, spread: 80, gravity: 1.2, origin: { y: 0.1, x: 0.5 }, colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A8E6CF'] });
            }} />
          </>
        );
        break;
      case 'delete':
        body = (
          <>
            <CardLine card={card} />
            <p className="text-[13px] text-muted">This action cannot be undone. The spending history, recurring payments, budgets and payoff plan for {card.bank} {card.nick} will be permanently erased.</p>
            <Actions danger onCancel={close} primary="Delete" onPrimary={() => { const id = card.id; done(deleteCard(id)); onCardDeleted(id); }} />
          </>
        );
        break;
    }
  }
  return (
    <Ctx.Provider value={setD}>
      {children}
      <Modal open={!!d} onClose={close} title={title} width={d?.kind === 'budgets' || d?.kind === 'recurring' || d?.kind === 'add' || d?.kind === 'edit' ? 600 : 480}>{body}</Modal>
    </Ctx.Provider>
  );
}
