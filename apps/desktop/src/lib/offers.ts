// Offers data: loaded the phone app's way (this device's cached copy first, then the published
// offers and when the collector last ran; samples when none are published), plus admin access and
// the admin review's reads and writes. Rules (categories, matching, form checks) are in the core.
import { useSyncExternalStore } from 'react';
import { OFFERS_CACHE_KEY, sampleOffers, readOfferForm, ADMIN_TOASTS } from '@serendib/core';
import { db, DEMO } from './firebase';
import { currentUser } from './store';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface OffersState { offers: any[]; updatedAt: string | null; samples: boolean; loaded: boolean }
let state: OffersState = { offers: [], updatedAt: null, samples: false, loaded: false };
const listeners = new Set<() => void>();
function set(patch: Partial<OffersState>) { state = { ...state, ...patch }; listeners.forEach((l) => l()); }
export function useOffers(): OffersState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

let loading: Promise<void> | null = null;
export function fetchOffers(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = (async () => {
    // Instant start from the last fetched offers (offers are public, so caching them is fine)
    try {
      const raw = localStorage.getItem(OFFERS_CACHE_KEY);
      const cached = raw ? JSON.parse(raw) : null;
      if (cached && Array.isArray(cached.offers) && cached.offers.length && !state.offers.length) set({ offers: cached.offers, updatedAt: cached.updatedAt || null, samples: false });
    } catch (e) { /* no cache */ }
    let live: any[] | null = null, updatedAt: string | null = null;
    if (db && !DEMO) {
      try {
        const snap = await db.collection('offers').where('status', '==', 'published').get();
        live = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        try {
          const meta = await db.collection('offers_meta').doc('status').get();
          if (meta.exists) updatedAt = (meta.data() || {}).lastRunAt || null;
        } catch (e) { /* meta is optional */ }
      } catch (e: any) {
        console.warn('Couldn’t load offers:', e && e.message);
      }
    }
    if (live && live.length) {
      set({ offers: live, updatedAt, samples: false, loaded: true });
      try { localStorage.setItem(OFFERS_CACHE_KEY, JSON.stringify({ offers: live, updatedAt, savedAt: Date.now() })); } catch (e) { /* storage full */ }
    } else if (!state.offers.length || state.samples) {
      set({ offers: sampleOffers(), samples: true, loaded: true });
    } else {
      set({ loaded: true });
    }
  })();
  return loading;
}

// Admin access is the `admin` custom claim (tools/set-admin.js); Firestore rules enforce the same claim
export async function isAdmin(): Promise<boolean> {
  const u: any = currentUser();
  if (!u || typeof u.getIdTokenResult !== 'function') return false;
  try { const r = await u.getIdTokenResult(); return !!(r && r.claims && r.claims.admin === true); } catch (e) { return false; }
}

export interface AdminData { drafts: any[]; published: any[]; meta: any }
export async function loadAdmin(): Promise<AdminData> {
  const [d, p, m] = await Promise.all([
    db.collection('offer_drafts').where('status', '==', 'pending').get(),
    db.collection('offers').where('status', '==', 'published').get(),
    db.collection('offers_meta').doc('status').get()
  ]);
  return {
    drafts: d.docs.map((x: any) => ({ id: x.id, ...x.data() })),
    published: p.docs.map((x: any) => ({ id: x.id, ...x.data() })),
    meta: m.exists ? m.data() : null
  };
}

export type AdminAction = 'approve' | 'reject' | 'save' | 'expire' | 'create';

// The phone app's admin actions. fields: the form (for approve / save / create). Returns { toast } or { error }
export async function adminAction(action: AdminAction, id: string | null, fields: any, drafts: any[]): Promise<{ toast?: string; error?: string }> {
  const now = new Date().toISOString();
  try {
    if (action === 'reject') {
      // Kept (not deleted) so the collector doesn't propose the same content again
      await db.collection('offer_drafts').doc(id).set({ status: 'rejected', rejectedAt: now }, { merge: true });
    } else if (action === 'expire') {
      await db.collection('offers').doc(id).set({ status: 'expired', expiredAt: now }, { merge: true });
    } else {
      const read = readOfferForm(fields);
      if (read.error) return { error: read.error };
      const offer = Object.assign(read.offer, { status: 'published', lastVerifiedAt: now, updatedAt: now });
      if (action === 'approve') {
        const draft = drafts.find((x) => x.id === id) || {};
        const targetId = draft.change === 'updated' && draft.targetId ? draft.targetId : id;
        offer.approvedAt = now;
        await db.collection('offers').doc(targetId).set(offer);
        await db.collection('offer_drafts').doc(id).delete();
      } else if (action === 'save') {
        await db.collection('offers').doc(id).set(offer, { merge: true });
      } else {
        offer.source = 'manual';
        offer.createdAt = now;
        await db.collection('offers').add(offer);
      }
    }
    fetchOffers(true); // refresh what users see
    return { toast: ADMIN_TOASTS[action] };
  } catch (e: any) {
    return { error: 'Couldn’t save: ' + ((e && e.message) || 'unknown error') };
  }
}
