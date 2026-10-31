// Log a purchase, payment or refund, or edit an entry: the phone app's log sheet as a dialog.
// Same fields, suggestions, SMS read-back, warnings and messages (all from the shared core);
// saving goes through the core's saveEntry.
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { dialogFrame, useLayout } from '../lib/layout';
import {
  SPEND_CATEGORIES, ymd, merchantItems, defaultCategory, categoryForMerchant, overLimitWarning, paymentShortcuts, smsFill,
  logSavedText, parseAmountInput, planAllocationFor, LOG_CARD_KEY, SMS_HINT
} from '@serendib/core';
import { useApp, logEntry, deleteEntry, findCard, type LogInput } from '../lib/store';
import { amountDueNow, cardName, cardTheme } from '../lib/derive';
import { fmtAmt } from '../lib/format';
import { CardDot, Icon, Segmented, useToast } from './ui';
import { Suggest } from './CardDialogs';
import type { EntryType } from '../lib/types';

export interface LogRequest {
  cardId?: string;
  type?: EntryType;
  prefill?: number;
  sms?: boolean;
  editing?: { id: string; cardId: string };
}

const TYPES: { value: EntryType; label: string }[] = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'payment', label: 'Payment' },
  { value: 'refund', label: 'Refund' }
];

function lastUsedCardId(): string | null { try { return localStorage.getItem(LOG_CARD_KEY); } catch (e) { return null; } }
function rememberCard(id: string) { try { localStorage.setItem(LOG_CARD_KEY, String(id)); } catch (e) { /* storage blocked */ } }

export function LogDialog({ request, onClose }: { request: LogRequest | null; onClose: () => void }) {
  const app = useApp();
  const toast = useToast();
  const open = !!request;
  const [type, setType] = useState<EntryType>('purchase');
  const [cardId, setCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(ymd(new Date()));
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('groceries');
  const [note, setNote] = useState('');
  const [smsOpen, setSmsOpen] = useState(false);
  const [sms, setSms] = useState('');
  const [smsStatus, setSmsStatus] = useState<{ text: string; tone: string }>({ text: SMS_HINT, tone: 'hint' });
  const [error, setError] = useState('');
  const [fromSms, setFromSms] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const smsRef = useRef<HTMLTextAreaElement>(null);

  const editingCard = request?.editing ? findCard(request.editing.cardId) : undefined;
  const editing = editingCard ? (editingCard.ledger || []).find((e) => e.id === request!.editing!.id) : undefined;

  function resetForm(keepCard?: boolean) {
    setAmount(''); setMerchant(''); setNote(''); setSms(''); setFromSms(false); setError('');
    setSmsStatus({ text: SMS_HINT, tone: 'hint' });
    if (!keepCard) setDate(ymd(new Date()));
  }

  useEffect(() => {
    if (!request) return;
    resetForm();
    setSmsOpen(!!request.sms);
    if (editing && editingCard) {
      setType(editing.type); setCardId(editingCard.id); setAmount(String(editing.amount)); setDate(editing.date);
      setMerchant(editing.merchant || ''); setCategory(editing.category || defaultCategory(app.cards)); setNote(editing.note || '');
      return;
    }
    const pick = findCard(request.cardId) || findCard(lastUsedCardId() || undefined) || app.cards[0];
    setType(request.type || 'purchase');
    setCardId(pick ? pick.id : '');
    setAmount(request.prefill ? String(Math.round(request.prefill * 100) / 100) : '');
    setCategory(defaultCategory(app.cards));
    setTimeout(() => (request.sms ? smsRef.current : amountRef.current)?.focus(), 30);
  }, [request]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = findCard(cardId);
  const hasCat = type === 'purchase' || type === 'refund';
  const isAdjustment = type === 'adjustment';
  const warn = overLimitWarning(card, type, parseAmountInput(amount), editing);
  const shortcuts = card && type === 'payment' ? paymentShortcuts(card, amountDueNow(card), planAllocationFor(app.cards, card)) : [];

  // A merchant you've used before brings its category (picked from the list, or typed in full)
  function chooseMerchant(v: string, it?: { label: string; category?: string }) {
    setMerchant(v);
    const cat = it && it.category ? it.category : categoryForMerchant(app.cards, cardId, v);
    if (cat) setCategory(cat);
  }
  function applySms(text: string) {
    setSms(text);
    const f = smsFill(text, app.cards, ymd(new Date()));
    setSmsStatus(f.status);
    if (f.empty) { setFromSms(false); return; }
    setType(f.type);
    if (f.amount) setAmount(String(f.amount));
    else if (f.clearAmount) setAmount('');
    if (f.merchant) { setMerchant(f.merchant); const cat = categoryForMerchant(app.cards, f.cardId || cardId, f.merchant); if (cat) setCategory(cat); }
    if (f.date) setDate(f.date);
    if (f.cardId) setCardId(f.cardId);
    setFromSms(f.fromSms);
  }

  function save(addAnother: boolean) {
    if (!card) { setError('Pick a card.'); return; }
    const amt = parseAmountInput(amount);
    const input: LogInput = {
      cardId: card.id, type, amount: amt, date, merchant: hasCat ? merchant : '', note, category, fromSms,
      editingId: request?.editing?.id
    };
    const res = logEntry(input);
    if (res.error) { setError(res.error); return; }
    if (res.gone) { onClose(); return; }
    rememberCard(card.id);
    const wasEditing = !!request?.editing;
    const cid = card.id, entryId = res.entry.id;
    toast(logSavedText(type, amt, res.merchant, wasEditing, res.warn), {
      tone: res.warn ? 'warn' : 'info',
      action: wasEditing ? undefined : { label: 'Undo', run: () => { if (deleteEntry(cid, entryId)) toast('Entry removed'); } }
    });
    if (addAnother) { resetForm(true); setTimeout(() => amountRef.current?.focus(), 0); return; }
    onClose();
  }

  function remove() {
    if (!editingCard || !editing) return;
    const undo = deleteEntry(editingCard.id, editing.id);
    onClose();
    if (undo) toast('Entry deleted', { action: { label: 'Undo', run: undo } });
  }

  const layout = useLayout();
  const frame = dialogFrame(layout, 540, '7vh', '86vh');
  const statusTone = smsStatus.tone === 'ok' ? 'font-semibold text-ok' : smsStatus.tone === 'warn' ? 'font-semibold text-warn' : 'text-faint';
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content style={frame.style} className={frame.className}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(false); }}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-6 py-4 phone:border-b-0 phone:px-5 phone:pb-2 phone:pt-5">
            <Dialog.Title className="text-[15px] font-semibold phone:text-[19px] phone:font-bold phone:tracking-tight">{request?.editing ? 'Edit entry' : 'Log spending'}</Dialog.Title>
            <Dialog.Close className="btn-ghost h-8 w-8 justify-center px-0 phone:h-10 phone:w-10 phone:rounded-full phone:bg-sunken" aria-label="Close"><Icon name="close" /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Record a purchase, a payment or a refund on a card.</Dialog.Description>

          <div className="space-y-4 px-6 py-5">
            {!request?.editing && (
              <div>
                <button type="button" aria-expanded={smsOpen} aria-controls="log-sms-box" onClick={() => { setSmsOpen(!smsOpen); if (!smsOpen) setTimeout(() => smsRef.current?.focus(), 0); }}
                  className="flex items-center gap-1 text-[12px] font-bold text-brand-ink"><Icon name="sms" size={16} />Paste a bank SMS</button>
                {smsOpen && (
                  <div id="log-sms-box" className="mt-2">
                    <label htmlFor="log-sms" className="sr-only">Bank SMS</label>
                    <textarea ref={smsRef} id="log-sms" rows={3} value={sms} onChange={(e) => applySms(e.target.value)} className="field h-auto py-2" placeholder="Paste the transaction SMS from your bank" />
                    <p className={'mt-1.5 text-[11px] ' + statusTone} aria-live="polite">{smsStatus.text}</p>
                  </div>
                )}
              </div>
            )}

            {isAdjustment ? (
              <p className="text-[13px] font-semibold">Balance adjustment <span className="font-normal text-faint">(use a minus sign to reduce the balance)</span></p>
            ) : (
              <Segmented value={type} options={TYPES} onChange={setType} />
            )}

            <div>
              <p className="label mb-1.5">Card</p>
              <div role="radiogroup" aria-label="Card" className="flex flex-wrap gap-1.5">
                {(request?.editing ? app.cards.filter((c) => c.id === cardId) : app.cards).map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={c.id === cardId} disabled={!!request?.editing} onClick={() => setCardId(c.id)}
                    className={'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ' + (c.id === cardId ? 'border-ink bg-sunken text-ink' : 'border-line text-muted hover:bg-sunken')}
                    style={layout === 'phone' && c.id === cardId ? { borderColor: cardTheme(c).hex, background: cardTheme(c).soft } : undefined}>
                    <CardDot card={c} size={8} />{cardName(c)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Amount</span>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-faint">LKR</span>
                  <input ref={amountRef} id="log-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} className="field num h-11 pl-12 text-[17px] font-bold" placeholder="0" />
                </div>
              </label>
              <label className="block">
                <span className="label">Date</span>
                <input type="date" value={date} max={ymd(new Date())} onChange={(e) => setDate(e.target.value)} className="field mt-1 h-11" />
              </label>
            </div>

            {shortcuts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {shortcuts.map((s: { label: string; value: number }) => (
                  <button key={s.label} type="button" onClick={() => setAmount(String(s.value))}
                    className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold hover:border-brand/50 hover:bg-brand/5">{s.label} · {fmtAmt(s.value)}</button>
                ))}
              </div>
            )}
            {warn && <p className="text-[12px] font-semibold text-warn">{warn}</p>}

            {hasCat && (
              <>
                <div>
                  <label htmlFor="log-merchant" className="label">Merchant</label>
                  <div className="mt-1">
                    <Suggest id="log-merchant" value={merchant} maxLength={60} placeholder="e.g. Keells, Uber, Daraz"
                      onChange={(v, it) => chooseMerchant(v, it)}
                      source={() => ({ header: 'Your merchants', items: merchantItems(app.cards, cardId) })} />
                  </div>
                </div>
                <div>
                  <span className="label">Category</span>
                  <div role="radiogroup" aria-label="Category" className="mt-1.5 grid grid-cols-4 gap-1.5 phone:grid-cols-3 phone:gap-2">
                    {SPEND_CATEGORIES.map((c: { key: string; label: string; icon: string }) => (
                      <button key={c.key} type="button" role="radio" aria-checked={category === c.key} onClick={() => setCategory(c.key)}
                        className={'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors phone:h-11 phone:rounded-xl phone:px-2.5 ' +
                          (category === c.key ? 'border-brand bg-brand/10 text-brand-ink phone:border-2' : 'border-line text-muted hover:bg-sunken')}>
                        <Icon name={c.icon} size={16} /><span className="truncate">{c.label.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <label className="block">
              <span className="label">Note <span className="font-normal normal-case tracking-normal">(optional)</span></span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="field mt-1" maxLength={80} />
            </label>

            {error && <p role="alert" className="text-[12px] font-semibold text-danger">{error}</p>}

            <div className="flex items-center justify-between gap-2 pt-1 phone:pb-2">
              <span className="text-[11px] text-faint compact:invisible phone:hidden"><span className="kbd">Ctrl</span> <span className="kbd">Enter</span> to save</span>
              <div className="flex gap-2 phone:w-full [&>button]:phone:flex-1 [&>button]:phone:justify-center [&>button]:phone:whitespace-nowrap">
                {request?.editing ? (
                  <>
                    <button type="button" className="btn-outline text-danger" onClick={remove}>Delete</button>
                    <button type="button" className="btn-primary" onClick={() => save(false)}>Save changes</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn-outline" onClick={() => save(true)}>Save &amp; add another</button>
                    <button type="button" className="btn-primary" onClick={() => save(false)}>Save</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
