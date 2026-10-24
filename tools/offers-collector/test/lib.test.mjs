import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, chunkText, robotsDisallows, toOffer, planChanges, contentKey } from '../lib.mjs';

const SOURCE = { issuer: 'seylan', bank: 'Seylan Bank', url: 'https://www.seylan.lk/promotions/cards' };
const TODAY = '2026-10-24';

const extracted = (over = {}) => Object.assign({
  merchant: 'Jetwing', headline: '30% off the total bill', details: 'At Jetwing hotels.', discountText: '30% off',
  category: 'dining', allCards: true, eligibleCards: null, networks: [], tiers: [],
  validFrom: null, validUntil: '2026-11-30', days: null, minSpend: null, terms: null, detailUrl: null
}, over);

test('htmlToText keeps text and absolute links, drops scripts and nav', () => {
  const html = `<html><nav>Menu Home</nav><script>var x = 1;</script>
    <div><h2>Jetwing &amp; Co</h2><p>30% off till 30th November</p>
    <a href="/promotions/cards/jetwing">Read more</a></div><footer>Copyright</footer></html>`;
  const text = htmlToText(html, SOURCE.url);
  assert.match(text, /Jetwing & Co/);
  assert.match(text, /30% off till 30th November/);
  assert.match(text, /Read more \[https:\/\/www\.seylan\.lk\/promotions\/cards\/jetwing\]/);
  assert.doesNotMatch(text, /var x|Menu Home|Copyright/);
});

test('chunkText splits long text on line boundaries', () => {
  const text = Array.from({ length: 100 }, (_, i) => 'line ' + i + ' ' + 'x'.repeat(90)).join('\n');
  const chunks = chunkText(text, 2000);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 2000));
  assert.equal(chunks.join('\n'), text);
});

test('robotsDisallows honours * and longest-match allow', () => {
  const robots = 'User-agent: *\nDisallow: /private\nAllow: /private/offers\n\nUser-agent: OtherBot\nDisallow: /';
  assert.equal(robotsDisallows(robots, '/private/x'), true);
  assert.equal(robotsDisallows(robots, '/private/offers/1'), false);
  assert.equal(robotsDisallows(robots, '/promotions'), false);
});

test('toOffer validates and fills the stored shape', () => {
  const { offer } = toOffer(extracted({ detailUrl: 'https://www.seylan.lk/promotions/cards/jetwing', minSpend: 5000 }), SOURCE, TODAY);
  assert.equal(offer.issuer, 'seylan');
  assert.equal(offer.sourceUrl, 'https://www.seylan.lk/promotions/cards/jetwing');
  assert.equal(offer.minSpend, 5000);
  assert.equal(offer.cardScope.allCards, true);
  assert.equal(offer.contentKey, 'seylan|jetwing|2026-11-30|30% off');
});

test('toOffer skips ended, undated-invalid and headline-less offers; never trusts non-https links', () => {
  assert.equal(toOffer(extracted({ validUntil: '2026-10-01' }), SOURCE, TODAY).skip, 'already ended');
  assert.equal(toOffer(extracted({ validUntil: '2026-02-30' }), SOURCE, TODAY).skip, 'bad end date');
  assert.equal(toOffer(extracted({ headline: '  ' }), SOURCE, TODAY).skip, 'no headline');
  assert.equal(toOffer(extracted({ validUntil: null }), SOURCE, TODAY).offer.validUntil, '');
  assert.equal(toOffer(extracted({ detailUrl: 'javascript:alert(1)' }), SOURCE, TODAY).offer.sourceUrl, SOURCE.url);
  assert.equal(toOffer(extracted({ category: 'nonsense' }), SOURCE, TODAY).offer.category, 'other');
});

test('planChanges: verify unchanged, skip known drafts, mark updates and expire ended offers', () => {
  const same = toOffer(extracted(), SOURCE, TODAY).offer;
  const changed = toOffer(extracted({ merchant: 'Keells', discountText: '20% off', validUntil: '2026-12-31', category: 'groceries' }), SOURCE, TODAY).offer;
  const brandNew = toOffer(extracted({ merchant: 'Spar', discountText: '15% off' }), SOURCE, TODAY).offer;
  const rejectedAgain = toOffer(extracted({ merchant: 'Junk', discountText: '5% off' }), SOURCE, TODAY).offer;
  const published = [
    Object.assign({ id: 'p1', status: 'published' }, same),
    { id: 'p2', status: 'published', issuer: 'seylan', merchant: 'Keells', headline: '10% off', discountText: '10% off', validUntil: '2026-11-15' },
    { id: 'p3', status: 'published', issuer: 'seylan', merchant: 'Old', headline: 'Ended', discountText: 'x', validUntil: '2026-10-20' }
  ];
  const drafts = [{ id: 'dr', status: 'rejected', contentKey: rejectedAgain.contentKey }];
  const plan = planChanges({ published, drafts, extracted: [same, changed, brandNew, rejectedAgain, brandNew], today: TODAY, now: 'T', draftId: (k) => 'd_' + k });

  assert.deepEqual(plan.verify, ['p1']);
  assert.deepEqual(plan.expire, ['p3']);
  assert.equal(plan.newDrafts.length, 2);
  const upd = plan.newDrafts.find((d) => d.data.merchant === 'Keells');
  assert.equal(upd.data.change, 'updated');
  assert.equal(upd.data.targetId, 'p2');
  assert.deepEqual(upd.data.previous, { headline: '10% off', discountText: '10% off', validUntil: '2026-11-15' });
  const nw = plan.newDrafts.find((d) => d.data.merchant === 'Spar');
  assert.equal(nw.data.change, 'new');
  assert.equal(nw.data.status, 'pending');
});

test('contentKey matches the app (index.html offerContentKey) normalisation', () => {
  assert.equal(contentKey({ issuer: 'ntb', merchant: '  Cargills   Food City ', validUntil: '2026-11-30', discountText: '30% OFF' }), 'ntb|cargills food city|2026-11-30|30% off');
});
