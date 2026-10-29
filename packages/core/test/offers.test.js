// Offers: normalising, card matching, the feed view and the admin form
import { test, expect } from 'vitest';
import { normalizeOffer, offerCardMatch, offersView, offerCardInfo, readOfferForm, collectorStatus, adminPublishedList, offerCategoryKey, sampleOffers } from '../src/offers.js';

const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const offers = [
  { id: 'a', issuer: 'sampath', bank: 'Sampath Bank', headline: 'A', category: 'dining', cardScope: { allCards: true }, validUntil: d(2), validFrom: d(-5) },
  { id: 'b', issuer: 'hnb', bank: 'HNB', headline: 'B', category: 'Travel', cardScope: { tiers: ['Platinum'] }, validUntil: d(30), validFrom: d(-1) },
  { id: 'c', issuer: 'sampath', headline: 'C', category: '0% EPP', validUntil: d(-1) },
  { id: 'e', issuer: 'combank', headline: 'E', category: 'groceries', status: 'expired', validUntil: d(5) }
];
const cards = [{ id: 'x', bank: 'Sampath Bank', nick: 'Visa' }, { id: 'y', bank: 'Hatton National Bank', nick: 'Platinum' }];

test('normalising older shapes and categories', () => {
  expect(normalizeOffer({ id: 1, bank: 'Sampath Bank', category: '0% EPP', subtext: 's', expiryDate: '2026-12-01' })).toMatchObject({ id: '1', issuer: 'sampath', category: 'instalments', details: 's', validUntil: '2026-12-01' });
  expect(offerCategoryKey('Fuel & Bills')).toBe('fuel_bills');
  expect(offerCategoryKey('nope')).toBe('all');
  expect(sampleOffers()).toHaveLength(3);
});

test('matching: bank-wide is certain, tier offers only may apply', () => {
  expect(offerCardMatch(normalizeOffer(offers[0]), cards)).toMatchObject({ certain: true });
  expect(offerCardMatch(normalizeOffer(offers[1]), cards)).toMatchObject({ certain: false });
  expect(offerCardMatch(normalizeOffer({ id: 'z', issuer: 'ntb' }), cards)).toBe(null);
});

test('the feed: live only, my cards vs explore, ending soon first, summary and empty states', () => {
  const mine = offersView({ offers, cards, mode: 'my-cards', category: 'all' });
  expect(mine.shown.map((o) => o.id)).toEqual(['a', 'b']);
  expect(mine.title).toBe('2 offers on your cards');
  expect(mine.sub).toBe('1 ending this week');
  expect(mine.chips.map((c) => c.key)).toEqual(['all', 'dining', 'travel']);
  const explore = offersView({ offers, cards: [], mode: 'explore', category: 'all', bank: 'hnb' });
  expect(explore.shown.map((o) => o.id)).toEqual(['b']);
  expect(explore.title).toBe('1 offer from 1 bank');
  expect(offersView({ offers, cards: [], mode: 'my-cards' }).empty.kind).toBe('no-cards');
  expect(offersView({ offers, cards, mode: 'my-cards', category: 'health' }).empty.title).toBe('No Health & Wellness offers for your cards right now');
});

test('an offer card’s lines', () => {
  const i = offerCardInfo(normalizeOffer(offers[0]), cards);
  expect(i.eligibility).toBe('All Sampath Bank credit cards');
  expect(i.matchLine).toBe('Your Visa qualifies');
  expect(i.urgency).toEqual({ tone: 'soon', text: 'Ends in 2 days' });
  expect(offerCardInfo(normalizeOffer({ ...offers[0], validUntil: d(0) }), cards).urgency.text).toBe('Ends today');
});

test('admin form checks, collector line, published search', () => {
  const f = { issuer: 'sampath', headline: 'H', validUntil: '2026-12-01', validFrom: '', sourceUrl: '', minSpend: '', allCards: true };
  expect(readOfferForm({ ...f, headline: '' }).error).toBe('Add a headline.');
  expect(readOfferForm({ ...f, validFrom: '2027-01-01' }).error).toBe('The start date is after the end date.');
  expect(readOfferForm({ ...f, sourceUrl: 'http://x' }).error).toBe('The bank page URL must start with https://');
  expect(readOfferForm({ ...f, minSpend: '-1' }).error).toBe('Minimum spend must be a positive number.');
  expect(readOfferForm(f).offer.contentKey).toBe('sampath||2026-12-01|');
  expect(collectorStatus(null).text).toBe("The collector hasn't run yet.");
  expect(collectorStatus({ lastRunAt: Date.now(), sources: [{ ok: false, bank: 'HNB' }] }).text).toMatch(/· Failed: HNB$/);
  expect(adminPublishedList([{ headline: 'Zed', validUntil: '2027' }, { headline: 'Alpha', validUntil: '2026' }], '').map((o) => o.headline)).toEqual(['Alpha', 'Zed']);
});
