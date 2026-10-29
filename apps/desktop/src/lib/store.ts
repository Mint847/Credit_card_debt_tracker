// The app's state and actions. Account data, saving, merging and live sync go through the shared
// core (createSyncEngine, createAccountSession, prepareAccount): the same code the phone app runs,
// on the same Firestore document. Every action changes data with a core function, then commit()
// saves it (this device's cache, then the cloud as a transaction) and re-renders.
import { useSyncExternalStore } from 'react';
import {
  createSyncEngine, createAccountSession, prepareAccount, readAccountCache, saveEntry, removeEntry, restoreEntry,
  toggleRecurringPaused, setTargetPayment, runDueRecurring, skipPostedCharges, ymd, fmtLKR, cardName,
  addCard, updateCardDetails, settleCard, removeCard, setBillingCycle, matchStatement, budgetsFromInputs,
  saveRecurringItem, cancelRecurringItem, uncancelRecurringItem, saveSafetyCopy, ordinal,
  createSpace, updateSpace, removeSpace, addFunds, withdrawFromSpace, undoWithdraw, payCardFromSpace, SPACE_FORM_ERROR,
  answerNotYet, onboardingState, migrateOnboarding, welcomeIncome, replayOnboarding, TIP_SCREENS, CHECKLIST_HIDDEN_TOAST,
  buildBackupDoc, readBackup, restoreDiff, planRestore, readSafetyCopies, safetyCopyToBackup, restoreDoneText, backupFileName, BACKUP_MAX_BYTES
} from '@serendib/core';
import { auth, db, DEMO } from './firebase';
import { sampleAccount } from './sample';
import type { Card, Profile, Space, Strategy } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Status = 'starting' | 'signedOut' | 'ready';

export interface AppState {
  status: Status;
  user: { uid: string; email: string; photoURL: string } | null;
  cards: Card[];
  spaces: Space[];
  profile: Profile;
  strategy: Strategy;
  cloudReady: boolean;
  version: number;
}

// The account, as the core sees it (mutated in place by core actions, like the phone app)
let user: any = null;
let data: any = {};
let cards: Card[] = [];
let spaces: Space[] = [];
let strategy: Strategy = 'avalanche';
let pendingName: { firstName: string; lastName: string } | null = null;
let offlineNoticeShown = false;
let lastRecurringDay = '';

let state: AppState = {
  status: 'starting', user: null, cards, spaces, strategy, cloudReady: false, version: 0,
  profile: { firstName: '', lastName: '', email: '', income: '175000' }
};
const listeners = new Set<() => void>();

/* Notices (toasts) the store raises: recurring charges, offline, back online */
export interface Notice { text: string; tone?: 'info' | 'warn'; action?: { label: string; run: () => void } }
const noticeListeners = new Set<(n: Notice) => void>();
// Notices raised before anything listens (e.g. offline at sign-in, during the splash) wait for the first listener
const heldNotices: Notice[] = [];
export function onNotice(fn: (n: Notice) => void) {
  noticeListeners.add(fn);
  heldNotices.splice(0).forEach(fn);
  return () => { noticeListeners.delete(fn); };
}
function notice(n: Notice) {
  if (!noticeListeners.size) heldNotices.push(n);
  noticeListeners.forEach((f) => f(n));
}

function photoOf(u: any): string {
  if (!u) return '';
  let url = u.photoURL || '';
  if (!url && u.providerData) u.providerData.forEach((p: any) => { if (!url && p && p.photoURL && p.providerId === 'google.com') url = p.photoURL; });
  return url;
}

function snapshot(status: Status): AppState {
  return {
    status,
    user: user ? { uid: user.uid, email: (user.email || '').toLowerCase(), photoURL: photoOf(user) } : null,
    cards, spaces,
    profile: { firstName: data.firstName || '', lastName: data.lastName || '', email: (user && user.email) || data.email || '', income: data.income || '175000' },
    strategy,
    cloudReady: sync.isCloudReady(),
    version: (state ? state.version : 0) + 1
  };
}

// The core reads income and strategy from these globals, as in the phone app
function exposeGlobals() {
  const w = window as any;
  w.currentUserData = data;
  w.currentStrategy = strategy;
  w.currentUser = user;
}

function emit(status: Status = state.status) {
  exposeGlobals();
  state = snapshot(status);
  listeners.forEach((l) => l());
}

const sync = createSyncEngine({
  getUser: () => user,
  getData: () => data,
  setData: (d: any) => { data = d; },
  getCards: () => cards,
  getSpaces: () => spaces,
  getFields: () => ({ firstName: data.firstName || '', lastName: data.lastName || '', income: data.income || '175000', strategy }),
  getDb: () => db || undefined,
  applyDoc: (doc: any) => loadAccount(doc),
  onCloudMerged: () => emit()
});

// keepSync: the new copy is a local change (restore / undo) to be stamped on the next save
function loadAccount(doc: any, keepSync?: boolean) {
  const p = prepareAccount(doc || {}, user);
  data = p.data;
  cards = p.cards;
  spaces = p.spaces;
  strategy = p.strategy;
  exposeGlobals();
  if (!keepSync) sync.rememberSyncState();
  emit();
}

function setCloudReady(v: boolean) {
  sync.setCloudReady(v);
  if (sync.isCloudReady()) runRecurring();
  emit();
}

// Save this change (cache, then cloud) and redraw. Returns the save's promise.
function commit(): Promise<unknown> {
  emit();
  return sync.saveUserData();
}

function fmtAmt(n: number) { return fmtLKR(n, Math.round(n * 100) % 100 ? 2 : 0); }

// Posts every due recurring charge on every card, once the cloud copy is loaded and on a new day
function runRecurring() {
  if (!sync.isCloudReady()) return;
  const t = ymd(new Date());
  lastRecurringDay = t;
  const run = runDueRecurring(cards, t), posted = run.posted;
  if (!run.changed) return;
  commit();
  if (!posted.length) return;
  const total = posted.reduce((s: number, p: any) => s + p.entry.amount, 0);
  const card = cards.find((c) => String(c.id) === String(posted[0].cardId));
  const text = posted.length === 1
    ? posted[0].item.name + ' ' + fmtAmt(total) + ' added to ' + (card ? cardName(card) : 'your card')
    : posted.length + ' recurring charges added (' + fmtAmt(total) + ')';
  setTimeout(() => notice({
    text, action: { label: 'Undo', run: () => {
      skipPostedCharges(cards, spaces, posted);
      commit();
      notice({ text: posted.length === 1 ? 'Charge removed. It won’t be added again for that month.' : 'Charges removed. They won’t be added again for those months.' });
    } }
  }), 900);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sync.isCloudReady() && lastRecurringDay !== ymd(new Date())) runRecurring();
});

const session = createAccountSession({
  db: () => db,
  auth: () => auth,
  setCloudData: (d: any) => loadAccount(d),
  setCloudReady,
  isCloudReady: () => sync.isCloudReady(),
  isOwnWrite: (stamp: number) => sync.isOwnWrite(stamp),
  mergeRemote: (doc: any) => sync.mergeIntoApp(doc),
  saveUserData: () => sync.saveUserData(),
  getLocalData: () => data,
  takePendingName: () => { const p = pendingName; pendingName = null; return p; },
  onRemoteMerged: () => emit(),
  onBackOnline: () => {
    offlineNoticeShown = false;
    emit();
    notice({ text: 'Back online. Your data is synced.' });
  }
});

/* Signing in and out: the same steps as the phone app's auth listener */
async function onSignedIn(u: any) {
  user = u;
  session.stopCloudRetry();
  session.stopLiveSync();
  sync.setCloudReady(false);
  // 1. Instant start from this account's own cache on this device
  const local = readAccountCache(u.uid, (u.email || '').toLowerCase().trim());
  if (local) { loadAccount(local); emit('ready'); }
  // 2. The cloud copy, merged; never written to before it has been read
  try {
    await session.syncAccountFromCloud(u, local, !!local);
  } catch (e: any) {
    console.warn('Couldn’t load this account from the cloud; using this device’s copy:', e && e.message);
    if (!local) loadAccount(pendingName ? { firstName: pendingName.firstName, lastName: pendingName.lastName } : {});
    if (!offlineNoticeShown) {
      offlineNoticeShown = true;
      notice({ text: 'You’re offline. Changes are saved on this device and will sync.' });
    }
    session.scheduleCloudRetry(u, !!local);
  }
  if (!auth.currentUser || auth.currentUser.uid !== u.uid) return; // signed out meanwhile
  emit('ready');
  startOnboarding();
}

function onSignedOut() {
  user = null;
  pendingName = null;
  offlineNoticeShown = false;
  session.stopCloudRetry();
  session.stopLiveSync();
  sync.setCloudReady(false);
  loadAccount({});
  emit('signedOut');
}

if (DEMO) {
  const s = sampleAccount();
  loadAccount({ ...s.profile, cards: s.cards, spaces: s.spaces, strategy: 'avalanche' });
  sync.setCloudReady(true);
  emit('ready');
} else if (auth) {
  auth.onAuthStateChanged((u: any) => { if (u) onSignedIn(u); else onSignedOut(); });
  // If Firebase never answers, show the sign-in page rather than a blank screen
  setTimeout(() => { if (state.status === 'starting') emit('signedOut'); }, 12000);
} else {
  setTimeout(() => emit('signedOut'), 0);
}

export function useApp(): AppState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state
  );
}

export function setPendingName(n: { firstName: string; lastName: string } | null) { pendingName = n; }

// Sign out; the cloud holds the data, so this device's copy is removed (it may be shared)
export function signOut(): Promise<void> {
  if (!auth) return Promise.resolve();
  const u = auth.currentUser;
  if (u && !sync.isCloudReady()) {
    if (!window.confirm('Some changes haven’t synced to your account yet. If you sign out now they will be lost. Sign out anyway?')) return Promise.resolve();
  }
  if (u) { try { localStorage.removeItem('stitch_user_uid_' + u.uid); } catch (e) { /* storage blocked */ } }
  session.stopCloudRetry();
  return auth.signOut().catch(() => notice({ text: 'Couldn’t sign out. Please try again.', tone: 'warn' }));
}

export function findCard(id: string | undefined): Card | undefined {
  return cards.find((c) => String(c.id) === String(id));
}

export interface LogInput {
  cardId: string;
  type: 'purchase' | 'payment' | 'refund' | 'adjustment';
  amount: number;
  date: string;
  category?: string;
  merchant?: string;
  note?: string;
  fromSms?: boolean;
  editingId?: string;
}

// Log or edit an entry. Returns the core's result: { error } | { gone } | { entry, editing, warn }
export function logEntry(input: LogInput) {
  const card = findCard(input.cardId);
  if (!card) return { error: 'That card no longer exists.' };
  const res = saveEntry(card, spaces, input);
  if (!res.error && !res.gone) commit();
  return res;
}

export function deleteEntry(cardId: string, entryId: string) {
  const card = findCard(cardId);
  if (!card) return null;
  const removed = removeEntry(card, spaces, entryId);
  if (!removed) return null;
  commit();
  return () => { const c = findCard(cardId); if (c) { restoreEntry(c, spaces, removed); commit(); } };
}

// Choosing a strategy also ticks the onboarding checklist's "strategy chosen", as on the phone
export function setStrategy(s: Strategy) {
  strategy = s;
  markOnboarding('strategyChosen');
  commit();
}

export function noteSimulatorVisit() {
  if (data.onboarding && data.onboarding.simulatorTried) return;
  markOnboarding('simulatorTried');
  commit();
}

function markOnboarding(flag: string) {
  if (!data.onboarding || typeof data.onboarding !== 'object') data.onboarding = {};
  if (!data.onboarding.tipsSeen || typeof data.onboarding.tipsSeen !== 'object') data.onboarding.tipsSeen = {};
  data.onboarding[flag] = true;
}

// Each action below returns the toast text to show (and an Undo where the phone app offers one),
// or { error } to show in the dialog. The wording matches the phone app.
export interface Done { text?: string; tone?: 'info' | 'warn'; undo?: () => void; error?: string }

function recurringText(posted: any[], prefix: string) {
  const total = posted.reduce((s: number, p: any) => s + p.entry.amount, 0);
  const card = cards.find((c) => String(c.id) === String(posted[0].cardId));
  return prefix + (posted.length === 1
    ? posted[0].item.name + ' ' + fmtAmt(total) + ' added to ' + (card ? cardName(card) : 'your card')
    : posted.length + ' recurring charges added (' + fmtAmt(total) + ')');
}
function undoPosted(posted: any[]) {
  return () => {
    skipPostedCharges(cards, spaces, posted);
    commit();
    notice({ text: posted.length === 1 ? 'Charge removed. It won’t be added again for that month.' : 'Charges removed. They won’t be added again for those months.' });
  };
}

export function togglePaused(cardId: string, itemId: string): Done {
  const res = toggleRecurringPaused(findCard(cardId), itemId);
  if (!res) return {};
  commit();
  if (res.posted.length) return { text: recurringText(res.posted, 'Resumed. '), undo: undoPosted(res.posted) };
  return { text: res.item.name + (res.item.paused ? ' paused' : ' resumed') };
}

export function saveTarget(cardId: string, amount: number): Done {
  const card = findCard(cardId);
  if (!card) return {};
  setTargetPayment(card, amount);
  commit();
  return { text: 'Monthly target saved: ' + fmtAmt(amount) };
}

export function addNewCard(input: { bank: string; nick: string; color: string; limit: number; balance: number }): Done & { id?: string } {
  const res = addCard(cards, input);
  if (res.error) return { error: res.error };
  commit();
  return { text: 'Card saved successfully', id: res.card.id };
}

export function editCard(cardId: string, input: { bank: string; nick: string; limit: string; balance: string; apr: string; isZeroPercent: boolean; color: string; last4: string }): Done {
  const card = findCard(cardId);
  if (!card) return {};
  const res = updateCardDetails(card, input);
  if (res.error) return { error: res.error };
  commit();
  // Over the limit is allowed (cards do go over); say so rather than refusing to save
  if (card.balance > card.limit) return { text: 'Saved. This card is ' + fmtLKR(card.balance - card.limit) + ' over its limit.', tone: 'warn' };
  return { text: input.isZeroPercent ? '0% Installment Plan applied' : 'Card details updated' };
}

export function clearBalance(cardId: string): Done {
  const card = findCard(cardId);
  if (!card) return {};
  settleCard(card);
  commit();
  return { text: 'Balance settled for ' + card.bank + ' ' + card.nick };
}

export function deleteCard(cardId: string): Done {
  if (user) saveSafetyCopy(user.uid, { cards, spaces }, 'Before deleting a card');
  cards = removeCard(cards, cardId);
  commit();
  return { text: 'Card deleted' };
}

export function setBilling(cardId: string, statementDay: number, dueDay: number): Done {
  const card = findCard(cardId);
  if (!card) return {};
  const res = setBillingCycle(card, statementDay, dueDay);
  if (res.error) return { error: res.error };
  commit();
  return { text: 'Billing cycle updated: statement on day ' + card.statementDay + ', due on day ' + card.dueDay };
}

export function matchBalance(cardId: string, value: number): Done {
  const card = findCard(cardId);
  if (!card) return {};
  const res = matchStatement(card, value);
  if (res.error) return { error: res.error };
  if (res.same) return { text: 'Balance already matches' };
  commit();
  const entryId = res.entry.id;
  return {
    text: 'Balance updated to ' + fmtAmt(card.balance),
    undo: () => { const c = findCard(cardId); if (c && removeEntry(c, spaces, entryId)) { commit(); notice({ text: 'Balance restored' }); } }
  };
}

export function saveBudgets(cardId: string, raw: Record<string, string>): Done {
  const card = findCard(cardId);
  if (!card) return {};
  const res = budgetsFromInputs(raw);
  if (res.error) return { error: res.error };
  card.budgets = res.budgets;
  commit();
  return { text: Object.keys(res.budgets).length ? 'Budgets saved' : 'Budgets cleared' };
}

export function saveRecurring(cardId: string, itemId: string | null, input: { name: string; amount: number; day: number; end: string; category: string; chargeNow: boolean }): Done & { gone?: boolean } {
  const card = findCard(cardId);
  if (!card) return {};
  const res = saveRecurringItem(card, itemId, { ...input, chargeNow: () => input.chargeNow });
  if (res.error) return { error: res.error };
  if (res.gone) return { gone: true };
  commit();
  if (res.editing) {
    if (res.posted.length) return { text: recurringText(res.posted, 'Saved. '), undo: undoPosted(res.posted) };
    return { text: res.name + ' updated' };
  }
  if (res.posted.length) return { text: recurringText(res.posted, res.name + ' added. '), undo: undoPosted(res.posted) };
  return { text: res.name + ' added. ' + fmtAmt(res.item.amount) + ' will be logged on the ' + ordinal(res.item.day) + ' of each month.' };
}

export function cancelRecurring(cardId: string, itemId: string): Done {
  const res = cancelRecurringItem(findCard(cardId), itemId);
  if (!res) return {};
  commit();
  return {
    text: res.item.name + ' cancelled. Past charges stay in your history.',
    undo: () => { if (uncancelRecurringItem(findCard(cardId), itemId, res.prevEnd)) commit(); }
  };
}

export function removeRecurring(cardId: string, itemId: string): Done {
  const card = findCard(cardId);
  if (!card) return {};
  const item = (card.recurring || []).find((r) => r.id === itemId);
  card.recurring = (card.recurring || []).filter((r) => r.id !== itemId);
  commit();
  return { text: (item ? item.name : 'Payment') + ' removed. Its past charges stay in your history.' };
}

/* Spaces: the phone app's actions and messages */
export function findSpace(id: string | undefined): Space | undefined {
  return spaces.find((s) => String(s.id) === String(id));
}

export interface SpaceInput { name: string; target: string; date: string; color: string }

// Returns the toast, or { error, invalid } with which fields to highlight
export function newSpace(input: SpaceInput): Done & { invalid?: Record<string, boolean>; id?: string } {
  const res = createSpace(spaces, input);
  if (res.invalid) return { error: SPACE_FORM_ERROR, invalid: res.invalid };
  commit();
  return { text: 'New Space Created', id: res.space.id };
}

export function editSpace(id: string, input: SpaceInput): Done & { invalid?: Record<string, boolean> } {
  const res = updateSpace(spaces, id, input);
  if (res.invalid) return { error: SPACE_FORM_ERROR, invalid: res.invalid };
  if (res.gone) return {};
  commit();
  return { text: 'Space details updated' };
}

export function deleteSpace(id: string): Done {
  spaces = removeSpace(spaces, id);
  commit();
  return { text: 'Space deleted' };
}

export function depositToSpace(id: string, amount: number): Done {
  const space = findSpace(id);
  if (!space) return {};
  const res = addFunds(space, amount);
  if (res.error) return { error: res.error };
  commit();
  return { text: 'Added LKR ' + amount.toLocaleString() + ' to ' + space.name };
}

export function withdrawSpace(id: string, amount: number, note: string): Done {
  const space = findSpace(id);
  if (!space) return {};
  const res = withdrawFromSpace(space, amount, note);
  if (res.error) return { error: res.error };
  commit();
  const item = res.item;
  return {
    text: fmtAmt(amount) + ' withdrawn from ' + space.name,
    undo: () => { const sp = findSpace(id); if (sp && undoWithdraw(sp, item)) commit(); }
  };
}

export function payFromSpace(id: string, cardId: string, amount: number): Done {
  const space = findSpace(id), card = findCard(cardId);
  if (!space || !card) return {};
  const res = payCardFromSpace(space, card, amount);
  if (res.error) return { error: res.error };
  commit();
  const entryId = res.entry.id, name = space.name;
  return {
    text: 'Paid ' + fmtAmt(amount) + ' to ' + cardName(card) + ' from ' + name,
    undo: () => { const c = findCard(cardId); if (c && removeEntry(c, spaces, entryId)) { commit(); notice({ text: 'Payment undone; ' + name + ' restored' }); } }
  };
}

// The signed-in Firebase user (for the admin claim check)
export function currentUser() { return user; }

/* Settings: income, reset, backup and restore (the phone app's Profile actions) */
// Income as typed; a quarter of it is the default repayment budget. Ticks onboarding's "income set".
export function setIncome(value: string) {
  data.income = value;
  if (value.trim() !== '' && parseFloat(value) > 0) markOnboarding('incomeSet');
  commit();
}
// Leaving the field empty (or zero) puts back the default
export function settleIncome() {
  if (!String(data.income || '').trim() || parseFloat(data.income) <= 0) { data.income = '175000'; commit(); }
}

// Clear this account's cards, spaces and checklist progress, but keep its name, email, income and strategy
export function resetCardData(): Done {
  if (!window.confirm('Reset your card data? All cards, spaces and saved payment targets will be removed. Your name, email and income are kept.')) return {};
  if (user) saveSafetyCopy(user.uid, { cards, spaces }, 'Before resetting card data');
  cards = [];
  spaces = [];
  const ob = data.onboarding;
  if (ob) { ob.simulatorTried = false; ob.checklistCompleted = false; ob.checklistDismissed = false; }
  commit();
  return { text: 'Card data reset' };
}

export function downloadBackup(): Done {
  const blob = new Blob([JSON.stringify(buildBackupDoc(data, strategy, cards, spaces), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = backupFileName(ymd(new Date()));
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return { text: 'Backup downloaded' };
}

export interface RestorePlan { data: any; newCards: any[]; newSpaces: any[] }

// Read a backup file. Resolves to a plan to preview, or { error } (nothing is changed)
export function readBackupFile(file: File): Promise<RestorePlan | { error: string }> {
  if (file.size > BACKUP_MAX_BYTES) return Promise.resolve({ error: 'This file is too large to be a Serendib backup.' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(String(reader.result)); } catch (e) { resolve({ error: 'This file isn’t a Serendib backup.' }); return; }
      resolve(planFrom(readBackup(parsed)));
    };
    reader.onerror = () => resolve({ error: 'Couldn’t read that file.' });
    reader.readAsText(file);
  });
}
function planFrom(res: any): RestorePlan | { error: string } {
  if (!res.ok) return { error: res.error };
  const diff = restoreDiff(cards, spaces, res.data);
  return { data: res.data, newCards: diff.newCards, newSpaces: diff.newSpaces };
}

export function safetyCopies(): any[] { return user ? readSafetyCopies(user.uid) : []; }
export function planFromSafetyCopy(c: any) { return planFrom(readBackup(safetyCopyToBackup(c))); }

// Replace everything, or add what's missing. A safety copy is kept first, and Undo puts it all back.
export function applyRestore(plan: RestorePlan, mode: 'replace' | 'merge'): Done {
  const p = planRestore(data, strategy, cards, spaces, plan.data, mode, plan.newCards, plan.newSpaces);
  const before = p.before;
  if (user) saveSafetyCopy(user.uid, before, 'Before restoring a backup');
  loadAccount(p.next, true);
  commit();
  return {
    text: restoreDoneText(mode, plan.newCards, plan.newSpaces),
    undo: () => { loadAccount(before, true); commit(); notice({ text: 'Restore undone' }); }
  };
}

// The account data as the Settings screen shows it
export function accountData() { return data; }

// Delete account: saves stop while the account is being removed (and resume if that fails)
export function pauseSaves(paused: boolean) { sync.setCloudReady(!paused); emit(); }

// "Did you pay?" → "Not yet": stop asking about those statements (the overdue warning shows instead)
export function notYetPaid(cardId: string) {
  const card = findCard(cardId);
  if (card && answerNotYet(card, ymd(new Date()))) commit();
}

/* Guided setup (onboarding flags live in the account, so progress follows you across devices) */
function legacyTourDone() {
  const email = user && user.email ? String(user.email).toLowerCase().trim() : '';
  try { return !!email && localStorage.getItem('stitch_tour_completed_' + email) === 'true'; } catch (e) { return false; }
}
export function onboarding(): any { return onboardingState(data); }

// After sign-in: move older accounts past the welcome (saved if anything changed)
export function startOnboarding() {
  const o = onboardingState(data);
  if (o && migrateOnboarding(o, data, cards, legacyTourDone())) commit();
}

// The welcome's last slide. Returns an error to show, or null when done.
export function finishWelcome(incomeRaw: string, chosen: Strategy): string | null {
  const o = onboardingState(data);
  if (!o) return null;
  const check = welcomeIncome(incomeRaw);
  if (check.error) return check.error;
  if (check.income !== '') { data.income = check.income; o.incomeSet = true; }
  o.strategyChosen = true;
  o.welcomeDone = true;
  strategy = chosen;
  commit();
  return null;
}
export function skipWelcome() {
  const o = onboardingState(data);
  if (o) { o.welcomeDone = true; commit(); }
}
export function dismissChecklist(): string {
  const o = onboardingState(data);
  if (o) { o.checklistDismissed = true; commit(); }
  return CHECKLIST_HIDDEN_TOAST;
}
// The first time every step is done (the checklist then celebrates and goes away)
export function noteChecklistComplete(): boolean {
  const o = onboardingState(data);
  if (!o || o.checklistCompleted) return false;
  o.checklistCompleted = true;
  commit();
  return true;
}
export function replayGuide() {
  const o = onboardingState(data);
  if (!o) return;
  replayOnboarding(o, cards, spaces, legacyTourDone(), data);
  o.welcomeDone = false;
  commit();
}
export function markTipsSeen(screen: string) {
  const o = onboardingState(data);
  if (o && !o.tipsSeen[screen]) { o.tipsSeen[screen] = true; commit(); }
}
export function skipAllTips() {
  const o = onboardingState(data);
  if (!o) return;
  TIP_SCREENS.forEach((s: string) => { o.tipsSeen[s] = true; });
  commit();
}
