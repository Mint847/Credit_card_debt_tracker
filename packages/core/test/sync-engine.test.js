// The sync engine against a fake Firestore (transactions included)
import { test, expect, beforeEach } from 'vitest';
import { createSyncEngine } from '../src/sync-engine.js';
import { readSafetyCopies } from '../src/domain.js';

function fakeDb() {
  const docs = {};
  const ref = (id) => ({ id, get: () => Promise.resolve(snap(id)), set: (v) => { docs[id] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); } });
  const snap = (id) => ({ exists: id in docs, data: () => JSON.parse(JSON.stringify(docs[id])) });
  return {
    docs,
    collection: () => ({ doc: (id) => ref(id) }),
    runTransaction: (fn) => fn({ get: (r) => Promise.resolve(snap(r.id)), set: (r, v) => { docs[r.id] = JSON.parse(JSON.stringify(v)); } })
  };
}

function device(db, uid) {
  const st = { user: { uid, email: 'Ann@Example.com' }, data: null, cards: [], spaces: [], fields: { firstName: 'Ann', lastName: '', income: '200000', strategy: 'avalanche' }, applied: [], redraws: 0 };
  st.engine = createSyncEngine({
    getUser: () => st.user, getData: () => st.data, setData: (d) => { st.data = d; },
    getCards: () => st.cards, getSpaces: () => st.spaces, getFields: () => st.fields, getDb: () => db,
    applyDoc: (doc) => { st.applied.push(doc); st.data = doc; st.cards = doc.cards; st.spaces = doc.spaces; },
    onCloudMerged: () => { st.redraws++; }
  });
  return st;
}

beforeEach(() => localStorage.clear());

test('no cloud write until the account has been loaded; local cache always written', async () => {
  const db = fakeDb(), a = device(db, 'u1');
  a.cards.push({ id: 'c1', balance: 100 });
  await a.engine.saveUserData();
  expect(db.docs.u1).toBeUndefined();
  expect(JSON.parse(localStorage.getItem('stitch_user_uid_u1')).cards[0].id).toBe('c1');
});

test('a save merges with the cloud copy, so another device’s card survives', async () => {
  const db = fakeDb();
  db.docs.u1 = { lastUpdated: 5, cards: [{ id: 'other', balance: 9, updatedAt: 3 }], spaces: [] };
  const a = device(db, 'u1');
  a.engine.setCloudReady(true);
  a.cards.push({ id: 'mine', balance: 1 });
  await a.engine.saveUserData();
  expect(db.docs.u1.cards.map((c) => c.id).sort()).toEqual(['mine', 'other']);
  expect(db.docs.u1.email).toBe('ann@example.com');
  // the device now shows the other card too, and redraws once
  expect(a.cards.map((c) => c.id).sort()).toEqual(['mine', 'other']);
  expect(a.redraws).toBe(1);
  // and recognises its own write when the live listener echoes it back
  expect(a.engine.isOwnWrite(db.docs.u1.lastUpdated)).toBe(true);
  expect(a.engine.isOwnWrite(12345)).toBe(false);
});

test('edits are stamped and deletions leave a tombstone', async () => {
  const db = fakeDb(), a = device(db, 'u1');
  a.engine.setCloudReady(true);
  a.cards.push({ id: 'k', balance: 1 }, { id: 'gone', balance: 2 });
  a.engine.rememberSyncState();
  a.cards[0].balance = 5;
  a.cards.splice(1, 1);
  const doc = a.engine.buildUserDoc();
  expect(doc.cards[0].updatedAt).toBeGreaterThan(0);
  expect(doc.deletedCards.gone).toBeGreaterThan(0);
});

test('a changed setting gets an edit time and stops being a default', () => {
  const a = device(fakeDb(), 'u1');
  a.data = { defaults: { income: true } };
  a.engine.rememberSyncState();
  a.fields = Object.assign({}, a.fields, { income: '300000' });
  const doc = a.engine.buildUserDoc();
  expect(doc.fieldTimes.income).toBeGreaterThan(0);
  expect(doc.defaults).toBeUndefined();
  expect(doc.income).toBe('300000');
});

test('a remote copy is merged in; a deletion from another device keeps a safety copy here', () => {
  const db = fakeDb(), a = device(db, 'u1');
  a.cards.push({ id: 'x', balance: 1 });
  a.engine.rememberSyncState();
  const remote = { lastUpdated: Date.now() + 1000, cards: [], spaces: [], deletedCards: { x: Date.now() + 500 } };
  const merged = a.engine.mergeIntoApp(remote);
  expect(merged.cards).toEqual([]);
  expect(a.applied.length).toBe(1);
  expect(readSafetyCopies('u1').length).toBe(1);
});

test('nothing happens without a signed-in user', async () => {
  const a = device(fakeDb(), 'u1');
  a.user = null;
  expect(a.engine.mergeIntoApp({ cards: [] })).toBe(null);
  await expect(a.engine.saveUserData()).resolves.toBeUndefined();
});
