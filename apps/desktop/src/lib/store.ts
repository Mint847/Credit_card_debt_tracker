// The app's state and actions. Every change goes through the shared core (the same functions
// the phone app calls), then subscribers re-render. In the prototype the data is a sample
// account kept in memory; Phase 3 swaps in the signed-in account and cloud sync.
import { useSyncExternalStore } from 'react';
import { saveEntry, removeEntry, restoreEntry, toggleRecurringPaused, setTargetPayment } from '@serendib/core';
import { sampleAccount } from './sample';
import type { Card, Profile, Space, Strategy } from './types';

export interface AppState {
  cards: Card[];
  spaces: Space[];
  profile: Profile;
  strategy: Strategy;
  version: number;
}

const initial = sampleAccount();
let state: AppState = { ...initial, strategy: 'avalanche', version: 0 };
const listeners = new Set<() => void>();

// The core reads income and strategy from these globals, as in the phone app
function exposeGlobals() {
  const w = window as unknown as { currentUserData: unknown; currentStrategy: string };
  w.currentUserData = state.profile;
  w.currentStrategy = state.strategy;
}
exposeGlobals();

function commit(patch: Partial<AppState> = {}) {
  state = { ...state, ...patch, cards: patch.cards || state.cards.slice(), version: state.version + 1 };
  exposeGlobals();
  listeners.forEach((l) => l());
}

export function useApp(): AppState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state
  );
}

export function findCard(id: string | undefined): Card | undefined {
  return state.cards.find((c) => c.id === id);
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

// Log or edit an entry. Returns the core's result: { error } | { entry, editing, warn }
export function logEntry(input: LogInput) {
  const card = findCard(input.cardId);
  if (!card) return { error: 'That card no longer exists.' };
  const res = saveEntry(card, state.spaces, input);
  if (!res.error && !res.gone) commit();
  return res;
}

export function deleteEntry(cardId: string, entryId: string) {
  const card = findCard(cardId);
  if (!card) return null;
  const removed = removeEntry(card, state.spaces, entryId);
  if (removed) commit();
  return removed ? () => { restoreEntry(card, state.spaces, removed); commit(); } : null;
}

export function setStrategy(strategy: Strategy) {
  commit({ strategy });
}

export function togglePaused(cardId: string, itemId: string) {
  const card = findCard(cardId);
  if (card && toggleRecurringPaused(card, itemId)) commit();
}

export function saveTarget(cardId: string, amount: number) {
  const card = findCard(cardId);
  if (!card) return { error: 'That card no longer exists.' };
  const res = setTargetPayment(card, amount);
  if (!res || !res.error) commit();
  return res || {};
}
