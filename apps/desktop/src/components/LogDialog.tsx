// Log spending, a payment, a refund or an adjustment (or read a bank SMS). Same rules and
// messages as the phone app's log sheet: everything is checked and saved by the core's saveEntry.
import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { SPEND_CATEGORIES, parseBankSms, ymd } from '@serendib/core';
import { useApp, logEntry, findCard, type LogInput } from '../lib/store';
import { amountDueNow, cardName, plan } from '../lib/derive';
import { fmtAmt } from '../lib/format';
import { CardDot, Icon, Segmented, useToast } from './ui';
import type { EntryType } from '../lib/types';

export interface LogRequest {
  cardId?: string;
  type?: EntryType;
  prefill?: number;
  sms?: boolean;
  editing?: { id: string; cardId: string };
}

const TYPES: { value: EntryType; label: string }[] = [
  { value: 'purchase', label: 'Spend' },
  { value: 'payment', label: 'Payment' },
  { value: 'refund', label: 'Refund' },
  { value: 'adjustment', label: 'Adjustment' }
];

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
  const [smsMode, setSmsMode] = useState(false);
  const [sms, setSms] = useState('');
  const [smsInfo, setSmsInfo] = useState('');
  const [error, setError] = useState('');
  const [fromSms, setFromSms] = useState(false);

  useEffect(() => {
    if (!request) return;
    const editingCard = request.editing && findCard(request.editing.cardId);
    const entry = editingCard && editingCard.ledger.find((e) => e.id === request.editing!.id);
    setError(''); setSms(''); setSmsInfo(''); setFromSms(false);
    setSmsMode(!!request.sms);
    if (entry && editingCard) {
      setType(entry.type); setCardId(editingCard.id); setAmount(String(entry.amount)); setDate(entry.date);
      setMerchant(entry.merchant || ''); setCategory(entry.category || 'other'); setNote(entry.note || '');
      return;
    }
    setType(request.type || 'purchase');
    setCardId(request.cardId || (app.cards.find((c) => c.balance > 0) || app.cards[0])?.id || '');
    setAmount(request.prefill ? String(Math.round(request.prefill * 100) / 100) : '');
    setDate(ymd(new Date())); setMerchant(''); setCategory('groceries'); setNote('');
  }, [request]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = findCard(cardId);
  const hasCat = type === 'purchase' || type === 'refund';
  const p = useMemo(() => plan(app.cards, app.strategy), [app]);

  // The phone app's payment shortcuts: what's due now, this month's plan amount, the full balance
  const payShortcuts = card && type === 'payment' && card.balance > 0
    ? [
        { label: 'Due now', value: amountDueNow(card) },
        { label: 'Plan', value: p.alloc[card.id] || 0 },
        { label: 'Full balance', value: card.balance }
      ].filter((s) => s.value > 0)
    : [];

  function readSms() {
    const r = parseBankSms(sms, ymd(new Date()));
    if (!r.amount) { setSmsInfo('Couldn’t find an amount in that message. Check it and try again, or enter it yourself.'); return; }
    setAmount(String(r.amount));
    if (r.merchant) setMerchant(r.merchant);
    if (r.date) setDate(r.date);
    setType(r.type === 'refund' ? 'refund' : r.type === 'payment' ? 'payment' : 'purchase');
    const match = r.last4 && app.cards.find((c) => c.last4 === r.last4);
    if (match) setCardId(match.id);
    setFromSms(true);
    setSmsMode(false);
    setSmsInfo(r.foreign ? 'Foreign currency: enter the LKR amount from your statement.' : '');
  }

  function save() {
    if (!card) { setError('Pick a card.'); return; }
    const input: LogInput = {
      cardId: card.id, type, amount: parseFloat(amount), date, merchant, note, category, fromSms,
      editingId: request?.editing?.id
    };
    const res = logEntry(input);
    if (res.error) { setError(res.error); return; }
    if (res.gone) { setError('That entry was removed on another device.'); return; }
    const what = type === 'payment' ? 'Payment' : type === 'refund' ? 'Refund' : type === 'adjustment' ? 'Adjustment' : 'Spending';
    toast(res.warn || what + (res.editing ? ' updated' : ' logged') + ' on ' + cardName(card) + '.', { tone: res.warn ? 'warn' : 'info' });
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-[10vh] z-50 w-[520px] -translate-x-1/2 rounded-2xl border border-line bg-panel shadow-pop focus:outline-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); }}>
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <Dialog.Title className="text-[15px] font-semibold">{request?.editing ? 'Edit entry' : smsMode ? 'Paste a bank SMS' : 'Log an entry'}</Dialog.Title>
            <Dialog.Close className="btn-ghost h-8 w-8 justify-center px-0" aria-label="Close"><Icon name="close" /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Record spending, a payment, a refund or a balance adjustment on a card.</Dialog.Description>

          {smsMode ? (
            <div className="space-y-3 px-6 py-5">
              <p className="text-[13px] text-muted">Paste the transaction alert your bank sent. The amount, merchant, date and card are filled in for you to check.</p>
              <textarea autoFocus value={sms} onChange={(e) => setSms(e.target.value)} rows={5} className="field h-auto py-2"
                placeholder="e.g. Your Visa card ending 4821 was used for LKR 4,350.00 at KEELLS SUPER on 24/10/2026" />
              {smsInfo && <p className="text-[12px] text-warn">{smsInfo}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn-ghost" onClick={() => setSmsMode(false)}>Enter it myself</button>
                <button type="button" className="btn-primary" onClick={readSms} disabled={!sms.trim()}>Read message</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-6 py-5">
              <div className="flex items-center justify-between">
                <Segmented value={type} options={TYPES} onChange={setType} />
                {!request?.editing && (
                  <button type="button" className="btn-ghost h-8 px-2 text-[12px]" onClick={() => setSmsMode(true)}>
                    <Icon name="sms" size={16} />Paste SMS
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 block">
                  <span className="label">Card</span>
                  <div className="relative mt-1">
                    <select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!!request?.editing} className="field appearance-none pl-8">
                      {app.cards.map((c) => <option key={c.id} value={c.id}>{c.bank} {c.nick}{c.last4 ? ' ·· ' + c.last4 : ''}</option>)}
                    </select>
                    {card && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><CardDot card={card} /></span>}
                    <Icon name="expand_more" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-faint" />
                  </div>
                </label>
                <label className="block">
                  <span className="label">Amount (LKR){type === 'adjustment' ? ' · use − to lower' : ''}</span>
                  <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="field num mt-1 text-[15px] font-semibold" placeholder="0" />
                </label>
                <label className="block">
                  <span className="label">Date</span>
                  <input type="date" value={date} max={ymd(new Date())} onChange={(e) => setDate(e.target.value)} className="field mt-1" />
                </label>
              </div>

              {payShortcuts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {payShortcuts.map((s) => (
                    <button key={s.label} type="button" onClick={() => setAmount(String(Math.round(s.value * 100) / 100))}
                      className="rounded-lg border border-line px-2.5 py-1.5 text-left hover:border-brand/50 hover:bg-brand/5">
                      <span className="block text-[11px] text-faint">{s.label}</span>
                      <span className="num block text-[12px] font-semibold">{fmtAmt(s.value)}</span>
                    </button>
                  ))}
                </div>
              )}

              {hasCat && (
                <>
                  <label className="block">
                    <span className="label">Merchant</span>
                    <input value={merchant} onChange={(e) => setMerchant(e.target.value)} className="field mt-1" placeholder="e.g. Keells" maxLength={60} />
                  </label>
                  <div>
                    <span className="label">Category</span>
                    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                      {SPEND_CATEGORIES.map((c: { key: string; label: string; icon: string }) => (
                        <button key={c.key} type="button" onClick={() => setCategory(c.key)} aria-pressed={category === c.key}
                          className={'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors ' +
                            (category === c.key ? 'border-brand bg-brand/10 text-brand-ink' : 'border-line text-muted hover:bg-sunken')}>
                          <Icon name={c.icon} size={16} /><span className="truncate">{c.label.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <label className="block">
                <span className="label">Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} className="field mt-1" maxLength={80} />
              </label>

              {smsInfo && <p className="text-[12px] text-warn">{smsInfo}</p>}
              {error && <p role="alert" className="text-[12px] font-medium text-danger">{error}</p>}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-faint"><span className="kbd">Ctrl</span> <span className="kbd">Enter</span> to save</span>
                <div className="flex gap-2">
                  <Dialog.Close className="btn-ghost">Cancel</Dialog.Close>
                  <button type="button" className="btn-primary" onClick={save}>{request?.editing ? 'Save changes' : 'Log ' + (TYPES.find((t) => t.value === type)?.label.toLowerCase() || '')}</button>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
