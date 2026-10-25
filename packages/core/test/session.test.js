// Signing in: this device's cache, merging the cloud copy, live sync and the offline retry
import { test, expect, vi, beforeEach } from 'vitest';
import { readAccountCache, createAccountSession } from '../src/session.js';

beforeEach(() => localStorage.clear());

function fakeDb(cloudDoc, opts = {}) {
  const db = { listener: null, unsubscribed: 0, gets: 0 };
  db.collection = () => ({
    doc: () => ({
      get: () => {
        db.gets++;
        if (opts.fail && opts.fail()) return Promise.reject(new Error('offline'));
        return Promise.resolve({ exists: !!cloudDoc, data: () => cloudDoc });
      },
      onSnapshot: (next) => { db.listener = next; return () => { db.unsubscribed++; db.listener = null; }; }
    })
  });
  return db;
}

function makeSession(db, user, extra = {}) {
  const state = { data: null, ready: false, saves: 0, merged: [], redraws: 0, online: 0, pending: extra.pending || null };
  const session = createAccountSession({
    db: () => db,
    auth: () => ({ currentUser: user }),
    setCloudData: (d) => { state.data = d; },
    setCloudReady: (v) => { state.ready = v; },
    isCloudReady: () => state.ready,
    isOwnWrite: (stamp) => stamp === 'mine',
    mergeRemote: (doc) => { state.merged.push(doc); },
    saveUserData: () => { state.saves++; return Promise.resolve(); },
    getLocalData: () => state.data,
    takePendingName: () => { const p = state.pending; state.pending = null; return p; },
    onRemoteMerged: () => { state.redraws++; },
    onBackOnline: () => { state.online++; }
  });
  return { session, state };
}

const user = { uid: 'u1', email: ' Ann@Example.com ' };

test('the cache: own copy by uid; the old email copy only moves over for the same account', () => {
  localStorage.setItem('stitch_user_email_ann@example.com', JSON.stringify({ uid: 'someone-else', cards: [] }));
  expect(readAccountCache('u1', 'ann@example.com')).toBe(null);
  expect(localStorage.getItem('stitch_user_email_ann@example.com')).toBe(null);
  localStorage.setItem('stitch_user_email_ann@example.com', JSON.stringify({ uid: 'u1', firstName: 'Ann' }));
  expect(readAccountCache('u1', 'ann@example.com').firstName).toBe('Ann');
  localStorage.setItem('stitch_user_uid_u1', JSON.stringify({ firstName: 'Own' }));
  expect(readAccountCache('u1', null).firstName).toBe('Own');
});

test('signing in merges both copies, applies the sign-up name, saves and starts live sync', async () => {
  const db = fakeDb({ cards: [{ id: 'c' }], lastUpdated: 1 });
  const { session, state } = makeSession(db, user, { pending: { firstName: 'Ann', lastName: 'Perera' } });
  await session.syncAccountFromCloud(user, { cards: [{ id: 'l' }], lastUpdated: 2 }, true);
  expect(state.data.cards.map((c) => c.id).sort()).toEqual(['c', 'l']);
  expect(state.data.firstName).toBe('Ann');
  expect(state.data.lastName).toBe('Perera');
  expect(state.data.email).toBe('ann@example.com');
  expect(state.data.uid).toBe('u1');
  expect(state.ready).toBe(true);
  expect(state.saves).toBe(1);
  expect(state.pending).toBe(null);
  expect(typeof db.listener).toBe('function');
});

test('live sync merges only other devices\' changes', async () => {
  const db = fakeDb({ cards: [] });
  const { session, state } = makeSession(db, user);
  await session.syncAccountFromCloud(user, null, false);
  state.data.lastUpdated = 'same';
  const snap = (doc, pending) => ({ exists: true, metadata: { hasPendingWrites: !!pending }, data: () => doc });
  db.listener(snap({ lastUpdated: 'x' }, true));   // not yet written
  db.listener(snap({ lastUpdated: 'mine' }));      // this device's own write
  db.listener(snap({ lastUpdated: 'same' }));      // nothing new
  db.listener({ exists: false });
  expect(state.merged.length).toBe(0);
  db.listener(snap({ lastUpdated: 'other', cards: [{ id: 'n' }] }));
  expect(state.merged.length).toBe(1);
  expect(state.redraws).toBe(1);
  session.startLiveSync(user); // already listening: no second listener
  expect(db.unsubscribed).toBe(0);
  session.stopLiveSync();
  expect(db.unsubscribed).toBe(1);
});

test('offline: the retry runs when the connection returns and then stops', async () => {
  let offline = true;
  const db = fakeDb({ cards: [{ id: 'c' }] }, { fail: () => offline });
  const { session, state } = makeSession(db, user);
  await expect(session.syncAccountFromCloud(user, null, false)).rejects.toThrow('offline');
  expect(state.ready).toBe(false);
  vi.useFakeTimers();
  try {
    session.scheduleCloudRetry(user, false);
    offline = false;
    dispatchTestEvent('online');
    await vi.waitFor(() => expect(state.online).toBe(1));
    expect(state.ready).toBe(true);
    expect(state.data.cards[0].id).toBe('c');
    const gets = db.gets;
    vi.advanceTimersByTime(60000); // timer was cleared
    expect(db.gets).toBe(gets);
  } finally {
    vi.useRealTimers();
  }
});
