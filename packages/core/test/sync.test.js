// Account merge: cards, spaces, deletions, settings
// Ported from the Node checks that used to slice this code out of index.html; checks unchanged.
import { test, expect } from 'vitest';
import * as core from '../src/domain.js';

// The checks call the helpers by name, exactly as the app does
Object.assign(globalThis, core);

test('Account merge: cards, spaces, deletions, settings', () => {
  const failures = [];
  const check = (name, cond, extra) => { if (!cond) failures.push(name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); };
  const ids = (d) => (d.cards || []).map(c => c.id).join(',');
  const NOW = Date.UTC(2026, 9, 25);

  // The reported case: phone has cards (old, no edit times); iPad wrote an empty account later
  const phone = { lastUpdated: NOW - 86400000, income: '300000', firstName: 'Seniru', strategy: 'snowball', cards: [{ id: 'p1', balance: 100 }, { id: 'p2', balance: 200 }], spaces: [{ id: 's1' }] };
  const ipadEmpty = { lastUpdated: NOW, income: '175000', firstName: 'Seniru', strategy: 'avalanche', cards: [], spaces: [] };
  let m = mergeAccount(phone, ipadEmpty, NOW);
  check('empty newer copy keeps the phone cards', ids(m) === 'p1,p2' && m.spaces.length === 1, ids(m));
  check('untouched defaults do not override real settings', m.income === '300000' && m.strategy === 'snowball', [m.income, m.strategy]);
  m = mergeAccount(ipadEmpty, phone, NOW);
  check('same result in either order', ids(m) === 'p1,p2' && m.income === '300000');

  // Two devices with different cards: union
  m = mergeAccount({ lastUpdated: 5, cards: [{ id: 'i1' }] }, { lastUpdated: 3, cards: [{ id: 'p1' }, { id: 'p2' }] }, NOW);
  check('different cards on two devices are all kept', ids(m) === 'i1,p1,p2', ids(m));

  // Same card edited on both: newest edit wins
  m = mergeAccount({ lastUpdated: 9, cards: [{ id: 'c', balance: 1, updatedAt: 100 }] }, { lastUpdated: 2, cards: [{ id: 'c', balance: 2, updatedAt: 200 }] }, NOW);
  check('same card: newest edit wins even from the older copy', m.cards[0].balance === 2);

  // Deletion is respected, only when it is newer than the card's last edit
  m = mergeAccount({ lastUpdated: 9, cards: [], deletedCards: { c: NOW - 1000 } }, { lastUpdated: 2, cards: [{ id: 'c', updatedAt: NOW - 5000 }] }, NOW);
  check('deleted card stays deleted', m.cards.length === 0 && m.deletedCards.c === NOW - 1000);
  m = mergeAccount({ lastUpdated: 9, cards: [], deletedCards: { c: NOW - 9000 } }, { lastUpdated: 2, cards: [{ id: 'c', updatedAt: NOW - 1000 }] }, NOW);
  check('card edited after the delete is kept', m.cards.length === 1);
  m = mergeAccount({ lastUpdated: 9, cards: [], deletedCards: { c: NOW - 1000 } }, { lastUpdated: 2, cards: [{ id: 'c' }] }, NOW);
  check('old card (no edit time) removed by a deliberate delete', m.cards.length === 0);
  m = mergeAccount({ lastUpdated: 9, cards: [], deletedCards: { c: NOW - 200 * 86400000 } }, { lastUpdated: 2, cards: [{ id: 'c' }] }, NOW);
  check('tombstones expire after 180 days', !('c' in m.deletedCards));

  // Settings edited on purpose win by edit time
  m = mergeAccount({ lastUpdated: 2, income: '500000', fieldTimes: { income: 50 }, cards: [] }, { lastUpdated: 9, income: '175000', cards: [{ id: 'x' }] }, NOW);
  check('an edited income beats an unedited one', m.income === '500000' && m.fieldTimes.income === 50);
  m = mergeAccount({ lastUpdated: 2, income: '500000', fieldTimes: { income: 50 } }, { lastUpdated: 9, income: '250000', fieldTimes: { income: 80 } }, NOW);
  check('newer income edit wins', m.income === '250000');
  m = mergeAccount({ lastUpdated: 2, firstName: 'Seniru' }, { lastUpdated: 9, firstName: '' }, NOW);
  check('an empty name never replaces a real one', m.firstName === 'Seniru');

  // Defaults (name from the email, default income) never beat real values, whichever copy is newer
  m = mergeAccount({ lastUpdated: 9, firstName: 'a', income: '175000', defaults: { firstName: true, income: true }, spaces: [{ id: 's' }] }, { lastUpdated: 1, firstName: 'A', income: '200000', cards: [{ id: 'k' }] }, NOW);
  check('default-filled name and income lose to real ones', m.firstName === 'A' && m.income === '200000' && !m.defaults, [m.firstName, m.income, m.defaults]);
  m = mergeAccount({ lastUpdated: 9, firstName: 'a', defaults: { firstName: true } }, { lastUpdated: 1, firstName: 'b', defaults: { firstName: true } }, NOW);
  check('two defaults: result is still marked as a default', m.defaults && m.defaults.firstName === true);

  // Onboarding merges, numeric ids, nulls
  m = mergeAccount({ lastUpdated: 2, onboarding: { version: 2, welcomeDone: true, tipsSeen: { a: true } } }, { lastUpdated: 9, onboarding: { version: 2, tipsSeen: { b: true } } }, NOW);
  check('onboarding progress merges', m.onboarding.welcomeDone === true && m.onboarding.tipsSeen.a && m.onboarding.tipsSeen.b);
  m = mergeAccount({ lastUpdated: 2, cards: [{ id: 7 }] }, { lastUpdated: 9, cards: [{ id: '7', updatedAt: 1 }] }, NOW);
  check('numeric and string ids are the same card', m.cards.length === 1 && m.cards[0].updatedAt === 1);
  check('null copies', mergeAccount(null, null) === null && ids(mergeAccount(null, phone)) === 'p1,p2' && ids(mergeAccount(phone, null)) === 'p1,p2');
  check('no undefined values', !JSON.stringify(mergeAccount(phone, ipadEmpty, NOW), (k, v) => v === undefined ? '__UNDEF__' : v).includes('__UNDEF__'));

  // syncSig ignores updatedAt and leaves no undefined key behind
  const it = { id: 'a', v: 1 };
  const s1 = syncSig(it); it.updatedAt = 5; const s2 = syncSig(it);
  check('signature ignores the edit time', s1 === s2 && it.updatedAt === 5);
  const it2 = { id: 'b' }; syncSig(it2);
  check('signature leaves no updatedAt key on unstamped items', !Object.prototype.hasOwnProperty.call(it2, 'updatedAt'));
  expect(failures).toEqual([]);
});
