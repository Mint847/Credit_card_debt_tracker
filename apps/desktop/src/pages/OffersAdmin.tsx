// Manage offers (admin only): review the collector's drafts, publish, edit and expire offers, add one
// by hand. The list on the left, the picked offer's form on the right. Same checks and writes as the phone.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SL_CARD_ISSUERS, OFFER_CATEGORIES, collectorStatus, adminPublishedList } from '@serendib/core';
import { isAdmin, loadAdmin, adminAction, type AdminData, type AdminAction } from '../lib/offers';
import { Chip, Empty, Icon, Segmented, useToast } from '../components/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tab = 'drafts' | 'published';
const NEW = { id: '', issuer: 'combank', category: 'dining', cardScope: { allCards: true } };

function formOf(o: any) {
  const scope = o.cardScope || {};
  return {
    issuer: o.issuer && SL_CARD_ISSUERS[o.issuer] ? o.issuer : 'combank', category: o.category || 'dining', merchant: o.merchant || '', headline: o.headline || '',
    discountText: o.discountText || '', details: o.details || '', allCards: scope.allCards !== false, scopeText: scope.text || '',
    validFrom: o.validFrom || '', validUntil: o.validUntil || '', days: o.days || '', minSpend: o.minSpend == null ? '' : String(o.minSpend),
    terms: o.terms || '', sourceUrl: o.sourceUrl || ''
  };
}

function Editor({ offer, kind, drafts, onDone }: { offer: any; kind: 'draft' | 'published' | 'new'; drafts: any[]; onDone: (toast?: string) => void }) {
  const [f, setF] = useState(() => formOf(offer));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(formOf(offer)); setError(''); }, [offer]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });
  const trimmed = () => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
  async function run(action: AdminAction) {
    setBusy(true); setError('');
    const r = await adminAction(action, offer.id || null, trimmed(), drafts);
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    onDone(r.toast);
  }
  const field = (k: keyof typeof f, label: string, type = 'text', placeholder?: string) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted">{label}</span>
      <input type={type} value={f[k] as string} onChange={set(k)} placeholder={placeholder} className="field h-9" />
    </label>
  );
  const issuers = Object.keys(SL_CARD_ISSUERS).filter((k) => k !== 'default');
  return (
    <div className="space-y-3">
      {kind === 'draft' && offer.change === 'updated' && offer.previous && (
        <p className="rounded-lg bg-sunken px-3 py-2 text-[12px] text-muted">Was: {[offer.previous.headline, offer.previous.discountText, offer.previous.validUntil && 'until ' + offer.previous.validUntil].filter(Boolean).join(' · ')}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted">Bank</span>
          <select value={f.issuer} onChange={set('issuer')} className="field h-9">{issuers.map((k) => <option key={k} value={k}>{SL_CARD_ISSUERS[k].name}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted">Category</span>
          <select value={f.category} onChange={set('category')} className="field h-9">{OFFER_CATEGORIES.filter((c: any) => c.key !== 'all').map((c: any) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
      </div>
      {field('merchant', 'Merchant')}
      {field('headline', 'Headline')}
      {field('discountText', 'Discount (short)', 'text', 'e.g. 20% off')}
      <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted">Details</span>
        <textarea rows={2} value={f.details} onChange={set('details')} className="field h-auto py-2" /></label>
      <label className="flex items-center gap-2 text-[12px] font-semibold">
        <input type="checkbox" checked={f.allCards} onChange={set('allCards')} className="h-4 w-4 accent-[rgb(var(--brand))]" />Valid on all of this bank’s credit cards
      </label>
      {!f.allCards && field('scopeText', 'Eligible cards (if not all)', 'text', 'e.g. Visa Platinum & Signature')}
      <div className="grid grid-cols-2 gap-3">{field('validFrom', 'Valid from', 'date')}{field('validUntil', 'Valid until', 'date')}</div>
      <div className="grid grid-cols-2 gap-3">{field('days', 'Days', 'text', 'e.g. Weekends')}{field('minSpend', 'Min. spend (LKR)', 'number')}</div>
      <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted">Terms</span>
        <textarea rows={3} value={f.terms} onChange={set('terms')} className="field h-auto py-2" /></label>
      {field('sourceUrl', 'Bank page URL', 'url', 'https://')}
      {error && <p role="alert" className="text-[12px] font-semibold text-danger">{error}</p>}
      <div className="flex gap-2 pt-1">
        {kind === 'draft' && <><button type="button" disabled={busy} className="btn-primary flex-1 justify-center" onClick={() => run('approve')}>Approve</button>
          <button type="button" disabled={busy} className="btn-outline flex-1 justify-center" onClick={() => run('reject')}>Reject</button></>}
        {kind === 'published' && <><button type="button" disabled={busy} className="btn-primary flex-1 justify-center" onClick={() => run('save')}>Save changes</button>
          <button type="button" disabled={busy} className="btn-outline flex-1 justify-center text-danger" onClick={() => run('expire')}>Expire now</button></>}
        {kind === 'new' && <><button type="button" disabled={busy} className="btn-primary flex-1 justify-center" onClick={() => run('create')}>Publish</button>
          <button type="button" className="btn-outline flex-1 justify-center" onClick={() => onDone()}>Cancel</button></>}
      </div>
    </div>
  );
}

export function OffersAdmin() {
  const navigate = useNavigate();
  const toast = useToast();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>('drafts');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  async function reload() {
    try { setData(await loadAdmin()); setLoadError(false); } catch (e) { setLoadError(true); }
  }
  useEffect(() => {
    isAdmin().then((ok) => {
      setAllowed(ok);
      if (ok) reload();
      else { toast('You don’t have access to manage offers.'); navigate('/offers', { replace: true }); }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => (!data ? [] : tab === 'drafts' ? data.drafts : adminPublishedList(data.published, q)), [data, tab, q]);
  const current = adding ? NEW : list.find((o: any) => o.id === sel) || list[0];
  const cs = collectorStatus(data && data.meta);
  const done = async (msg?: string) => { setAdding(false); if (msg) toast(msg); await reload(); };
  async function approveSelected() {
    const ids = Object.keys(picked).filter((k) => picked[k]);
    if (!ids.length) { toast('Select drafts to approve first.'); return; }
    for (const id of ids) {
      const d = data!.drafts.find((x) => x.id === id);
      if (!d) continue;
      const r = await adminAction('approve', id, Object.fromEntries(Object.entries(formOf(d)).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])), data!.drafts);
      if (r.error) { toast(d.headline + ': ' + r.error, { tone: 'warn' }); continue; }
      toast(r.toast || '');
    }
    setPicked({});
    await reload();
  }

  if (allowed === null) return <div className="p-10 text-[13px] text-faint">Loading...</div>;
  if (!allowed) return null;
  return (
    <div className="flex h-full">
      <div className="flex w-[440px] shrink-0 flex-col border-r border-line">
        <div className="space-y-3 border-b border-line px-6 py-5">
          <button type="button" onClick={() => navigate('/offers')} className="flex items-center gap-1 text-[12px] font-semibold text-faint hover:text-ink"><Icon name="arrow_back" size={16} />Offers</button>
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 font-serif text-[26px] font-medium">Manage offers <Chip>Admin only</Chip></h1>
            <button type="button" className="btn-primary h-8" onClick={() => { setAdding(true); setSel(null); }}><Icon name="add" size={16} />Add</button>
          </div>
          <p className={'rounded-lg px-3 py-2 text-[12px] font-medium ' + (cs.tone === 'warn' ? 'bg-warn/10 text-warn' : cs.tone === 'ok' ? 'bg-ok/10 text-ok' : 'bg-sunken text-muted')}>{cs.text}</p>
          <Segmented value={tab} onChange={(t) => { setTab(t); setAdding(false); setSel(null); }}
            options={[{ value: 'drafts', label: 'Drafts (' + (data ? data.drafts.length : 0) + ')' }, { value: 'published', label: 'Published (' + (data ? data.published.length : 0) + ')' }]} />
          {tab === 'published' && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bank, merchant or headline" aria-label="Search published offers" className="field" />}
          {tab === 'drafts' && data && data.drafts.length > 0 && <button type="button" className="btn-outline h-8 w-full justify-center" onClick={approveSelected}>Approve selected</button>}
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto">
          {loadError && <p className="px-6 py-6 text-center text-[13px] text-danger">Could not load offers. Check your connection and admin access.</p>}
          {!data && !loadError && <p className="px-6 py-6 text-center text-[13px] text-faint">Loading...</p>}
          {data && !list.length && <Empty icon="inbox" title={tab === 'drafts' ? 'No drafts waiting for review.' : 'No published offers' + (q ? ' match your search' : '') + '.'} />}
          {list.map((o: any) => {
            const on = !adding && current && current.id === o.id;
            return (
              <div key={o.id} className={'flex items-start gap-3 border-b border-line px-6 py-3 ' + (on ? 'bg-brand/5' : 'hover:bg-sunken')}>
                {tab === 'drafts' && <input type="checkbox" aria-label="Select draft" checked={!!picked[o.id]} onChange={(e) => setPicked({ ...picked, [o.id]: e.target.checked })} className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" />}
                <button type="button" onClick={() => { setSel(o.id); setAdding(false); }} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2">
                    {tab === 'drafts' && <Chip tone={o.change === 'updated' ? 'warn' : 'ok'}>{o.change === 'updated' ? 'Updated' : 'New'}</Chip>}
                    <span className="truncate text-[12px] font-bold">{o.bank || (SL_CARD_ISSUERS[o.issuer] || {}).name}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[13px]">{o.headline || 'Untitled offer'}</span>
                  <span className="block text-[11px] text-faint">{o.merchant}{o.validUntil ? ' · until ' + o.validUntil : ''}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto px-8 py-7">
        {current ? (
          <div className="mx-auto max-w-[640px]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[15px] font-semibold">{adding ? 'New offer' : current.headline || 'Offer'}</p>
              {!adding && current.sourceUrl && /^https:\/\//i.test(current.sourceUrl) && (
                <a href={current.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[12px] font-semibold text-brand-ink">Source page<Icon name="open_in_new" size={14} /></a>
              )}
            </div>
            <div className="panel p-5"><Editor offer={current} kind={adding ? 'new' : tab === 'drafts' ? 'draft' : 'published'} drafts={data ? data.drafts : []} onDone={done} /></div>
          </div>
        ) : <Empty icon="local_offer" title="Pick an offer to review" />}
      </div>
    </div>
  );
}
