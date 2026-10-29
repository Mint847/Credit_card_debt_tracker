// Spaces: savings buffers with a target and date. Tiles on the left, the picked space's detail
// (status, history, add / withdraw / pay a card) on the right. Rules and wording from the shared core.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { CARD_THEMES, isRealYmd, parseYmd, ymd, spaceStatusLine, spaceHistoryLabel, sortedSpaceHistory, spacePayOptions, parseAmountInput, fundsAmountError } from '@serendib/core';
import { useApp, findSpace, findCard, newSpace, editSpace, deleteSpace, depositToSpace, withdrawSpace, payFromSpace, type Done } from '../lib/store';
import { cardName } from '../lib/derive';
import { fmtAmt, shortDate } from '../lib/format';
import { Modal, Label, ErrorLine, Actions, Money, ColourPicker, colourName } from '../components/CardDialogs';
import { CardDot, Empty, Icon, useToast } from '../components/ui';
import type { Card, Space } from '../lib/types';

type Dlg = { kind: 'create' } | { kind: 'edit' | 'delete' | 'add' | 'withdraw' | 'pay'; id: string };

const hexOf = (s: Space) => (CARD_THEMES[s.color] || CARD_THEMES.emerald).hex;
const pctOf = (s: Space) => (s.targetLKR > 0 ? Math.min(100, (s.currentLKR / s.targetLKR) * 100) : 0);
const longDay = (d: string) => (isRealYmd(d) ? parseYmd(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : d);

function Ring({ space, size = 64 }: { space: Space; size?: number }) {
  const pct = pctOf(space), r = 26, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="-rotate-90" width={size} height={size} aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={hexOf(space)} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-[13px] font-bold">{Math.round(pct)}%</span>
    </div>
  );
}

function History({ space, cards }: { space: Space; cards: Card[] }) {
  const rows = sortedSpaceHistory(space);
  if (!rows.length) return <p className="py-6 text-center text-[12px] text-faint">No activity yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((h: Space['history'][number]) => {
        const l = spaceHistoryLabel(h);
        const card = h.cardId ? cards.find((c) => String(c.id) === String(h.cardId)) : undefined;
        return (
          <li key={h.id} className="flex items-center gap-3 py-2.5">
            <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ' + (l.out ? 'bg-sunken text-muted' : 'bg-ok/10 text-ok')}><Icon name={l.icon} size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{l.label}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-faint">{shortDate(h.date)}{card && <><span>·</span><CardDot card={card} size={7} />{cardName(card)}</>}</span>
            </span>
            <span className={'num whitespace-nowrap text-[13px] font-bold ' + (l.out ? '' : 'text-ok')}>{l.out ? '− ' : '+ '}{fmtAmt(Number(h.amount) || 0)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function SpaceForm({ space, onClose, onDone }: { space?: Space; onClose: () => void; onDone: (d: Done & { id?: string }) => void }) {
  const [name, setName] = useState(space?.name || '');
  const [target, setTarget] = useState(space ? String(space.targetLKR) : '');
  const [date, setDate] = useState(space?.targetDate || '');
  const [color, setColor] = useState(space?.color && CARD_THEMES[space.color] ? space.color : 'emerald');
  const [error, setError] = useState('');
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const ring = (k: string) => (bad[k] ? ' border-danger ring-1 ring-danger' : '');
  function save() {
    const input = { name, target: target.replace(/,/g, ''), date, color };
    const r = space ? editSpace(space.id, input) : newSpace(input);
    if (r.error) { setError(r.error); setBad(r.invalid || {}); return; }
    onDone(r);
  }
  return (
    <>
      {!space && <p className="-mt-1 mb-4 text-[13px] text-muted">Define your reserve buffer</p>}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="sp-name">Space name</Label>
          <input id="sp-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency Buffer" className={'field h-10' + ring('name')} />
        </div>
        <div className={bad.target ? '[&_input]:border-danger' : ''}>
          <Label htmlFor="sp-target">Target goal (LKR)</Label>
          <Money id="sp-target" value={target} onChange={setTarget} placeholder="100000" />
        </div>
        <div>
          <Label htmlFor="sp-date">Target date</Label>
          <input id="sp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={'field h-10' + ring('date')} />
        </div>
        <div className="col-span-2">
          <p className="mb-1.5 text-[12px] font-semibold text-muted">Icon colour · <span className="font-normal">{colourName(color, 'emerald')}</span></p>
          <ColourPicker value={color} onChange={setColor} defaultKey="emerald" />
        </div>
      </div>
      <ErrorLine text={error} />
      <Actions onCancel={onClose} primary={space ? 'Save changes' : 'Create space'} onPrimary={save} />
    </>
  );
}

function AmountForm({ space, kind, onClose, onDone }: { space: Space; kind: 'add' | 'withdraw'; onClose: () => void; onDone: (d: Done) => void }) {
  const [v, setV] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  function save() {
    if (kind === 'add') {
      const amt = parseFloat(v.replace(/,/g, ''));
      const err = fundsAmountError(amt);
      if (err) { setError(err); return; }
      onDone(depositToSpace(space.id, amt));
    } else {
      const r = withdrawSpace(space.id, parseAmountInput(v), note);
      if (r.error) { setError(r.error); return; }
      onDone(r);
    }
  }
  return (
    <>
      <p className="-mt-1 mb-4 text-[13px] text-muted">{kind === 'add' ? 'To ' + space.name : space.name + ' has ' + fmtAmt(Number(space.currentLKR) || 0) + '.'}</p>
      <Label htmlFor="sp-amount">{kind === 'add' ? 'Amount to add (LKR)' : 'Amount'}</Label>
      <Money id="sp-amount" value={v} onChange={setV} placeholder={kind === 'add' ? '5000' : '0'} big />
      {kind === 'withdraw' && (
        <div className="mt-4">
          <Label htmlFor="sp-note">What for? <span className="font-normal text-faint">(optional)</span></Label>
          <input id="sp-note" value={note} maxLength={60} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Car repair" className="field h-10" />
        </div>
      )}
      <ErrorLine text={error} />
      <Actions onCancel={onClose} primary={kind === 'add' ? 'Add funds' : 'Withdraw'} onPrimary={save} />
    </>
  );
}

function PayForm({ space, cards, onClose, onDone }: { space: Space; cards: Card[]; onClose: () => void; onDone: (d: Done) => void }) {
  const opts = useMemo(() => spacePayOptions(space, cards), [space, cards]);
  const [cardId, setCardId] = useState<string>(opts.pick ? opts.pick.id : '');
  const card = findCard(cardId);
  const [v, setV] = useState(opts.pick ? String(opts.suggest(opts.pick)) : '');
  const [error, setError] = useState('');
  return (
    <>
      <p className="-mt-1 mb-4 text-[13px] text-muted">From {space.name} ({fmtAmt(Number(space.currentLKR) || 0)}). This logs a payment on the card and takes it from the space.</p>
      <p className="mb-1.5 text-[12px] font-semibold text-muted" id="sp-card-label">Card</p>
      <div role="radiogroup" aria-labelledby="sp-card-label" className="mb-4 flex flex-wrap gap-2">
        {opts.owing.map((c: Card) => (
          <button key={c.id} type="button" role="radio" aria-checked={c.id === cardId} onClick={() => { setCardId(c.id); setV(String(opts.suggest(c))); }}
            className={'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold ' + (c.id === cardId ? 'border-ink bg-sunken' : 'border-line text-muted hover:bg-sunken')}>
            <CardDot card={c} size={8} />{cardName(c)}
          </button>
        ))}
      </div>
      <Label htmlFor="sp-pay">Amount</Label>
      <Money id="sp-pay" value={v} onChange={setV} big />
      {card && <p className="mt-1.5 text-[11px] text-faint">{opts.hint(card, fmtAmt)}</p>}
      <ErrorLine text={error} />
      <Actions onCancel={onClose} primary="Pay card" onPrimary={() => { const r = payFromSpace(space.id, cardId, parseAmountInput(v)); if (r.error) setError(r.error); else onDone(r); }} />
    </>
  );
}

function Detail({ space, cards, open }: { space: Space; cards: Card[]; open: (d: Dlg) => void }) {
  const toast = useToast();
  const today = ymd(new Date());
  const st = spaceStatusLine(space, today, fmtAmt);
  const has = (Number(space.currentLKR) || 0) > 0;
  const payCard = () => {
    if (!cards.some((c) => c.balance > 0)) { toast('None of your cards has a balance to pay.'); return; }
    open({ kind: 'pay', id: space.id });
  };
  return (
    <aside className="scroll-thin w-[380px] shrink-0 overflow-y-auto border-l border-line bg-panel" aria-label={space.name}>
      <div className="flex items-start justify-between px-5 pb-3 pt-5">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{space.name}</p>
          {isRealYmd(space.targetDate) && <p className="mt-0.5 text-[12px] text-faint">Target date {longDay(space.targetDate)}</p>}
        </div>
        <Dropdown.Root>
          <Dropdown.Trigger className="btn-ghost h-8 w-8 justify-center px-0" aria-label="Space options"><Icon name="more_horiz" /></Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content align="end" sideOffset={6} className="z-50 w-48 rounded-xl border border-line bg-panel p-1.5 shadow-pop">
              <Dropdown.Item onSelect={() => open({ kind: 'edit', id: space.id })} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none data-[highlighted]:bg-sunken"><Icon name="edit" size={18} className="text-faint" />Edit space</Dropdown.Item>
              <Dropdown.Item onSelect={() => open({ kind: 'delete', id: space.id })} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] text-danger outline-none data-[highlighted]:bg-sunken"><Icon name="delete" size={18} />Delete space</Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
      <div className="px-5">
        <div className="flex items-center gap-4">
          <Ring space={space} size={72} />
          <div>
            <p className="num text-[22px] font-bold">{fmtAmt(Number(space.currentLKR) || 0)}</p>
            <p className="text-[12px] text-faint">of {fmtAmt(Number(space.targetLKR) || 0)} goal</p>
          </div>
        </div>
        <p className={'mt-3 text-[12px] font-semibold ' + (st.tone === 'ok' ? 'text-ok' : 'text-warn')}>{st.text}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" className="btn-primary justify-center" onClick={() => open({ kind: 'add', id: space.id })}><Icon name="add" size={18} />Add</button>
          <button type="button" className="btn-outline justify-center" disabled={!has} onClick={() => open({ kind: 'withdraw', id: space.id })}>Withdraw</button>
          <button type="button" className="btn-outline justify-center" disabled={!has} onClick={payCard}>Pay a card</button>
        </div>
      </div>
      <div className="mt-5 border-t border-line px-5 pb-5 pt-4">
        <p className="panel-title mb-1">History</p>
        <History space={space} cards={cards} />
      </div>
    </aside>
  );
}

const TITLES: Record<Dlg['kind'], string> = {
  create: 'Create sinking fund', edit: 'Edit space details', delete: 'Delete this space?', add: 'Add funds', withdraw: 'Withdraw from space', pay: 'Pay a card'
};

export function Spaces() {
  const app = useApp();
  const toast = useToast();
  const [sel, setSel] = useState<string | null>(app.spaces[0]?.id || null);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const today = ymd(new Date());
  // The setup checklist's "Create an emergency buffer" opens the new space form
  const [params, setParams] = useSearchParams();
  useEffect(() => { if (params.get('create') === '1') { setDlg({ kind: 'create' }); setParams({}, { replace: true }); } }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = (sel && app.spaces.find((s) => s.id === sel)) || app.spaces[0] || null;
  const totalCur = app.spaces.reduce((n, s) => n + (Number(s.currentLKR) || 0), 0);
  const totalTarget = app.spaces.reduce((n, s) => n + (Number(s.targetLKR) || 0), 0);
  // The phone app's Spaces summary: the latest ten movements across all spaces
  const recent = useMemo(() => {
    const all: { h: Space['history'][number]; s: Space }[] = [];
    app.spaces.forEach((sp) => (sp.history || []).forEach((h) => all.push({ h, s: sp })));
    return all.sort((a, b) => (a.h.date < b.h.date ? 1 : a.h.date > b.h.date ? -1 : ((b.h as { createdAt?: number }).createdAt || 0) - ((a.h as { createdAt?: number }).createdAt || 0))).slice(0, 10);
  }, [app]);
  const close = () => setDlg(null);
  const done = (r: Done & { id?: string }) => {
    setDlg(null);
    if (r.text) toast(r.text, { tone: r.tone, action: r.undo ? { label: 'Undo', run: r.undo } : undefined });
    if (r.id) setSel(r.id);
  };
  const dSpace = dlg && 'id' in dlg ? findSpace(dlg.id) : undefined;
  let body = null;
  if (dlg?.kind === 'create') body = <SpaceForm onClose={close} onDone={done} />;
  else if (dSpace && dlg) {
    if (dlg.kind === 'edit') body = <SpaceForm space={dSpace} onClose={close} onDone={done} />;
    if (dlg.kind === 'add' || dlg.kind === 'withdraw') body = <AmountForm space={dSpace} kind={dlg.kind} onClose={close} onDone={done} />;
    if (dlg.kind === 'pay') body = <PayForm space={dSpace} cards={app.cards} onClose={close} onDone={done} />;
    if (dlg.kind === 'delete') body = (
      <>
        <p className="text-[13px] text-muted">This action cannot be undone. All allocated funds and tracking data for {dSpace.name} will be permanently erased.</p>
        <Actions danger onCancel={close} primary="Delete" onPrimary={() => { const id = dSpace.id; done(deleteSpace(id)); if (sel === id) setSel(null); }} />
      </>
    );
  }

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="font-serif text-[30px] font-medium leading-tight tracking-tight">Spaces</h1>
            <p className="mt-1 text-[13px] text-faint">{app.spaces.length} Active Repayment Buffer{app.spaces.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" className="btn-primary" data-tip="add-space" onClick={() => setDlg({ kind: 'create' })}><Icon name="add" size={18} />Add space</button>
        </div>
        {app.spaces.length > 0 && (
          <section className="panel mb-5 flex items-center gap-6 px-5 py-4">
            <div>
              <p className="label">Total saved</p>
              <p className="num mt-1 text-[22px] font-bold">{fmtAmt(totalCur)} <span className="text-[13px] font-medium text-faint">/ {fmtAmt(totalTarget)}</span></p>
            </div>
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-ok" style={{ width: (totalTarget > 0 ? Math.min(100, (totalCur / totalTarget) * 100) : 0) + '%' }} /></div>
            </div>
            <span className="rounded-full bg-ok/10 px-3 py-1 text-[12px] font-semibold text-ok">{Math.round(totalTarget > 0 ? (totalCur / totalTarget) * 100 : 0)}% Funded</span>
          </section>
        )}
        {app.spaces.length === 0 ? (
          <div className="panel"><Empty icon="savings" title="No Spaces Found" body="Create a space to start allocating money for upcoming bills and emergencies." /></div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {app.spaces.map((s) => {
              const st = spaceStatusLine(s, today, fmtAmt);
              const on = selected && s.id === selected.id;
              return (
                <button key={s.id} type="button" onClick={() => setSel(s.id)} aria-pressed={!!on}
                  className={'panel flex flex-col gap-4 p-5 text-left transition-shadow ' + (on ? 'ring-2 ring-brand/50' : 'hover:shadow-pop')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold">{s.name}</p>
                      <p className="mt-0.5 text-[12px] text-faint">Target: {longDay(s.targetDate)}</p>
                    </div>
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hexOf(s) }} />
                  </div>
                  <div className="flex items-center gap-4">
                    <Ring space={s} />
                    <div>
                      <p className="num text-[18px] font-bold" style={{ color: hexOf(s) }}>{fmtAmt(Number(s.currentLKR) || 0)}</p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">of {fmtAmt(Number(s.targetLKR) || 0)} goal</p>
                    </div>
                  </div>
                  <p className={'border-t border-line pt-3 text-[12px] font-semibold ' + (st.tone === 'ok' ? 'text-ok' : 'text-warn')}>{st.text}</p>
                </button>
              );
            })}
          </div>
        )}
        {recent.length > 0 && (
          <section className="panel mt-5">
            <div className="panel-head"><h2 className="panel-title">Recent activity</h2></div>
            <ul className="divide-y divide-line px-5 pb-3">
              {recent.map(({ h, s: sp }) => {
                const l = spaceHistoryLabel(h);
                return (
                  <li key={sp.id + h.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hexOf(sp) }} />
                    <span className="w-40 truncate text-faint">{sp.name}</span>
                    <span className="flex-1 truncate font-medium">{l.label}</span>
                    <span className="num w-16 text-faint">{shortDate(h.date)}</span>
                    <span className={'num w-28 text-right font-semibold ' + (l.out ? '' : 'text-ok')}>{l.out ? '− ' : '+ '}{fmtAmt(Number(h.amount) || 0)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
      {selected && <Detail space={selected} cards={app.cards} open={setDlg} />}
      <Modal open={!!dlg && !!body} onClose={close} title={dlg ? (dlg.kind === 'pay' && dSpace ? 'Pay a card from ' + dSpace.name : TITLES[dlg.kind]) : ''} width={dlg?.kind === 'create' || dlg?.kind === 'edit' ? 560 : 460}>{body}</Modal>
    </div>
  );
}
