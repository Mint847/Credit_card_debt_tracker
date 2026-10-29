// Card offers: categories, reading offer documents (current and older shapes), which of the user's
// cards an offer applies to, the feed for a filter, and the admin form's checks. Moved from the
// offers code in index.html (Phase 3); Firestore reads and writes stay in each UI.
import { SL_CARD_ISSUERS, resolveIssuer } from './domain.js';

export var OFFER_CATEGORIES = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'groceries', label: 'Groceries', icon: 'shopping_basket' },
  { key: 'dining', label: 'Dining', icon: 'restaurant' },
  { key: 'travel', label: 'Travel & Hotels', icon: 'flight' },
  { key: 'shopping', label: 'Shopping', icon: 'shopping_bag' },
  { key: 'instalments', label: '0% Instalments', icon: 'percent' },
  { key: 'fuel_bills', label: 'Fuel & Bills', icon: 'local_gas_station' },
  { key: 'health', label: 'Health & Wellness', icon: 'favorite' },
  { key: 'online', label: 'Online', icon: 'language' },
  { key: 'other', label: 'Other', icon: 'local_offer' }
];
// Older offer documents used display labels as categories
export var LEGACY_CATEGORY = { 'groceries': 'groceries', 'dining': 'dining', 'travel': 'travel', '0% epp': 'instalments', 'fuel & bills': 'fuel_bills' };
export var OFFERS_CACHE_KEY = 'serendib_offers_cache';

function localDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function offerCategory(key) {
  return OFFER_CATEGORIES.filter(function (c) { return c.key === key; })[0] || OFFER_CATEGORIES[OFFER_CATEGORIES.length - 1];
}
// A category key typed or stored anywhere → a known key ('all' when unknown)
export function offerCategoryKey(category) {
  var key = String(category || 'all').toLowerCase();
  return OFFER_CATEGORIES.some(function (c) { return c.key === key; }) ? key : (LEGACY_CATEGORY[key] || 'all');
}

// Accepts the published schema and the older sample shape, returns one consistent shape
export function normalizeOffer(o) {
  var issuer = (o.issuer && SL_CARD_ISSUERS[o.issuer]) ? o.issuer : (resolveIssuer(o.bank) || 'default');
  var cat = String(o.category || '').toLowerCase();
  cat = OFFER_CATEGORIES.some(function (c) { return c.key === cat; }) ? cat : (LEGACY_CATEGORY[cat] || 'other');
  if (cat === 'all') cat = 'other';
  var scope = o.cardScope || {};
  return {
    id: String(o.id),
    issuer: issuer,
    bank: o.bank || (SL_CARD_ISSUERS[issuer] || {}).name || 'Bank',
    merchant: o.merchant || '',
    headline: o.headline || '',
    details: o.details || o.subtext || '',
    discountText: o.discountText || '',
    category: cat,
    cardScope: {
      allCards: scope.allCards !== false && !(scope.tiers && scope.tiers.length) && !(scope.networks && scope.networks.length) && !scope.text,
      networks: scope.networks || [],
      tiers: scope.tiers || (o.tier && o.tier !== 'All' ? [o.tier] : []),
      text: scope.text || ''
    },
    validFrom: o.validFrom || '',
    validUntil: o.validUntil || o.expiryDate || '',
    days: o.days || '',
    minSpend: o.minSpend || null,
    terms: o.terms || '',
    sourceUrl: /^https:\/\//i.test(o.sourceUrl || '') ? o.sourceUrl : '',
    status: o.status || 'published'
  };
}

// Shown while no live offers are published yet (empty collection) or Firestore is unreachable.
// Labelled "Sample offers" in the feed so they aren't mistaken for real bank promotions.
export function sampleOffers() {
  var inDays = function (n) { var d = new Date(); d.setDate(d.getDate() + n); return localDateStr(d); };
  return [
    {
      id: "sample1", issuer: "combank", bank: "Commercial Bank", merchant: "Keells", category: "groceries",
      headline: "25% off fresh produce at Keells", discountText: "25% off",
      details: "On weekends with Visa Gold & Platinum credit cards. Max discount LKR 2,500.",
      cardScope: { allCards: false, networks: ["Visa"], tiers: ["Gold", "Platinum"], text: "Visa Gold & Platinum cards" },
      validUntil: inDays(2), days: "Weekends", terms: "Valid only on weekends. Maximum discount LKR 2,500 per transaction."
    },
    {
      id: "sample2", issuer: "ntb", bank: "Nations Trust Bank", merchant: "Cinnamon Grand", category: "dining",
      headline: "1-for-1 main course at Cinnamon Grand", discountText: "1-for-1",
      details: "With Nations Trust American Express Platinum cards. Reservations required.",
      cardScope: { allCards: false, networks: ["American Express"], tiers: ["Platinum"], text: "American Express Platinum cards" },
      validUntil: inDays(0), terms: "Not valid on public holidays. Subject to availability."
    },
    {
      id: "sample3", issuer: "sampath", bank: "Sampath Bank", merchant: "Electronics partners", category: "instalments",
      headline: "0% interest 12-month instalment plan", discountText: "0% for 12 months",
      details: "Convert electronics purchases over LKR 50,000 via Sampath Vishwa.",
      cardScope: { allCards: true }, validUntil: inDays(10), minSpend: 50000,
      terms: "A processing fee may apply for early settlement."
    }
  ];
}

export function issuerKeyOf(c) {
  return (c.issuer && SL_CARD_ISSUERS[c.issuer]) ? c.issuer : (resolveIssuer(c.bank) || 'default');
}

// Which of the user's cards an offer applies to. Bank-wide offers apply to every card from
// that bank; tier/network offers only "may" apply, matched loosely on the card's nickname.
export function offerCardMatch(offer, userCards) {
  var mine = userCards.filter(function (c) { return issuerKeyOf(c) === offer.issuer; });
  if (!mine.length) return null;
  if (offer.cardScope.allCards) return { card: mine[0], certain: true };
  var words = offer.cardScope.tiers.concat(offer.cardScope.networks).map(function (w) { return String(w).toLowerCase(); });
  var hit = mine.filter(function (c) {
    var nick = String(c.nick || '').toLowerCase();
    return words.some(function (w) { return w && (nick.indexOf(w) !== -1 || (w === 'american express' && nick.indexOf('amex') !== -1)); });
  })[0];
  return hit ? { card: hit, certain: false } : null;
}

// The feed for a view. opts: { offers (raw), cards, mode 'my-cards'|'explore', category, bank,
// updatedAt, samples }. Returns what the screen shows: the pool, category chips with counts,
// banks to filter by, the offers in order, the summary line and which empty state (if any).
export function offersView(opts) {
  var today = localDateStr(new Date());
  var userCards = (opts.cards || []).filter(function (c) { return c && c.bank; });
  var myIssuers = {};
  userCards.forEach(function (c) { myIssuers[issuerKeyOf(c)] = true; });
  // Live offers only: published and not past their end date
  var live = (opts.offers || []).map(normalizeOffer).filter(function (o) {
    return o.status !== 'expired' && (!o.validUntil || o.validUntil >= today);
  });
  var mode = opts.mode;
  var banks = {};
  live.forEach(function (o) { banks[o.issuer] = o.bank; });
  var bank = opts.bank && opts.bank !== 'all' && banks[opts.bank] ? opts.bank : 'all';
  var pool = mode === 'my-cards'
    ? live.filter(function (o) { return myIssuers[o.issuer]; })
    : live.filter(function (o) { return bank === 'all' || o.issuer === bank; });
  var counts = {};
  pool.forEach(function (o) { counts[o.category] = (counts[o.category] || 0) + 1; });
  var category = opts.category || 'all';
  // Category chips for this view; empty ones hidden (All, and the selected one, always shown)
  var chips = OFFER_CATEGORIES.filter(function (c) { return c.key === 'all' || c.key === category || counts[c.key]; })
    .map(function (c) { return { key: c.key, label: c.label, icon: c.icon, count: c.key === 'all' ? pool.length : (counts[c.key] || 0), active: c.key === category }; });
  var bankList = Object.keys(banks).sort(function (a, b) { return banks[a].localeCompare(banks[b]); }).map(function (k) { return { key: k, name: banks[k] }; });
  var shown = (category === 'all' ? pool : pool.filter(function (o) { return o.category === category; })).slice();
  // Ending within a week first (soonest first), then newest
  var weekAhead = (function () { var d = new Date(); d.setDate(d.getDate() + 7); return localDateStr(d); })();
  shown.sort(function (a, b) {
    var aSoon = a.validUntil && a.validUntil <= weekAhead, bSoon = b.validUntil && b.validUntil <= weekAhead;
    if (aSoon !== bSoon) return aSoon ? -1 : 1;
    if (aSoon) return a.validUntil.localeCompare(b.validUntil);
    return String(b.validFrom).localeCompare(String(a.validFrom));
  });
  var endingThisWeek = pool.filter(function (o) { return o.validUntil && o.validUntil <= weekAhead; }).length;
  var updated = '';
  if (opts.updatedAt) {
    var ud = new Date(opts.updatedAt);
    if (!isNaN(ud)) updated = 'Updated ' + ud.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  var title, sub;
  if (mode === 'my-cards' && !userCards.length) {
    title = 'Offers for your cards';
    sub = 'Add a card to see what it gets you';
  } else if (mode === 'my-cards') {
    title = pool.length + (pool.length === 1 ? ' offer' : ' offers') + ' on your cards';
    sub = [endingThisWeek ? endingThisWeek + ' ending this week' : 'None ending this week', updated].filter(Boolean).join(' · ');
  } else {
    var bankCount = {}; pool.forEach(function (o) { bankCount[o.issuer] = 1; });
    var nb = Object.keys(bankCount).length;
    title = pool.length + (pool.length === 1 ? ' offer' : ' offers') + ' from ' + nb + (nb === 1 ? ' bank' : ' banks');
    sub = [endingThisWeek ? endingThisWeek + ' ending this week' : '', updated].filter(Boolean).join(' · ') || 'Across Sri Lankan card issuers';
  }
  var empty = null, catLabel = offerCategory(category).label;
  if (mode === 'my-cards' && !userCards.length) {
    empty = { kind: 'no-cards', icon: 'credit_card', title: 'Add a card to see offers for it', body: 'We’ll show the promotions your banks are running right now.' };
  } else if (!shown.length) {
    var noun = category === 'all' ? '' : catLabel + ' ';
    empty = { kind: 'none', icon: 'search_off',
      title: mode === 'my-cards' ? 'No ' + noun + 'offers for your cards right now' : 'No ' + noun + 'offers right now',
      body: mode === 'my-cards' ? 'Your banks may have offers in other categories, or check what other banks are running.' : 'Try another category or bank.',
      allCategories: category !== 'all', seeAllBanks: mode === 'my-cards' };
  }
  return { pool: pool, chips: chips, banks: bankList, bank: bank, shown: shown, title: title, sub: sub, badge: opts.samples ? 'Sample' : 'Live', samples: !!opts.samples, empty: empty, userCards: userCards };
}

// What an offer's card shows: urgency, who it's for, whether one of your cards qualifies, the details line
export function offerCardInfo(offer, userCards) {
  var todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  var match = offerCardMatch(offer, userCards);
  var urgency = null;
  if (offer.validUntil) {
    var parts = offer.validUntil.split('-');
    var exp = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    var diff = Math.round((exp - todayDate) / 86400000);
    if (diff === 0) urgency = { tone: 'today', text: 'Ends today' };
    else if (diff > 0 && diff <= 3) urgency = { tone: 'soon', text: 'Ends in ' + diff + ' days' };
  }
  var eligibility = offer.cardScope.allCards ? 'All ' + offer.bank + ' credit cards'
    : (offer.cardScope.text || ('Valid on ' + offer.cardScope.networks.concat(offer.cardScope.tiers).join(', ')));
  var matchLine = '';
  if (match && match.certain) matchLine = 'Your ' + (match.card.nick || 'card') + ' qualifies';
  else if (match) matchLine = 'Your ' + (match.card.nick || 'card') + ' may qualify, check terms';
  var meta = [];
  if (offer.validUntil) {
    var vp = offer.validUntil.split('-');
    meta.push('Until ' + new Date(+vp[0], +vp[1] - 1, +vp[2]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
  }
  if (offer.days) meta.push(offer.days);
  if (offer.minSpend) meta.push('Min. LKR ' + Number(offer.minSpend).toLocaleString('en-US'));
  return { match: match, urgency: urgency, eligibility: eligibility, matchLine: matchLine, meta: meta.join(' · '), category: offerCategory(offer.category) };
}

// The terms dialog
export function offerTerms(offer) {
  return {
    title: offer.headline || 'Terms & Conditions',
    body: offer.terms || "The bank hasn't published detailed terms for this offer here. Check the bank's site.",
    link: offer.sourceUrl ? { href: offer.sourceUrl, label: "View on " + offer.bank + "'s site" } : null
  };
}

/* Admin: review collector drafts, publish, edit and expire offers */
// Same key the collector uses to recognise an offer it has already proposed or published
export function offerContentKey(o) {
  var norm = function (v) { return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
  return [o.issuer, o.merchant, o.validUntil, o.discountText].map(norm).join('|');
}
// f: the admin form's fields (strings, allCards a boolean). Returns { offer } or { error }
export function readOfferForm(f) {
  if (!f.headline) return { error: 'Add a headline.' };
  if (!f.validUntil || !/^\d{4}-\d{2}-\d{2}$/.test(f.validUntil)) return { error: 'Add a valid end date.' };
  if (f.validFrom && f.validFrom > f.validUntil) return { error: 'The start date is after the end date.' };
  if (f.sourceUrl && !/^https:\/\//i.test(f.sourceUrl)) return { error: 'The bank page URL must start with https://' };
  var minSpend = f.minSpend === '' || f.minSpend == null ? null : Number(f.minSpend);
  if (minSpend !== null && (!isFinite(minSpend) || minSpend < 0)) return { error: 'Minimum spend must be a positive number.' };
  var offer = {
    issuer: f.issuer,
    bank: SL_CARD_ISSUERS[f.issuer].name,
    merchant: f.merchant,
    headline: f.headline,
    discountText: f.discountText,
    details: f.details,
    category: f.category,
    cardScope: { allCards: !!f.allCards, networks: [], tiers: [], text: f.allCards ? '' : f.scopeText },
    validFrom: f.validFrom,
    validUntil: f.validUntil,
    days: f.days,
    minSpend: minSpend,
    terms: f.terms,
    sourceUrl: f.sourceUrl
  };
  offer.contentKey = offerContentKey(offer);
  return { offer: offer };
}
// "Last collector run: 26 Oct, 09:00 · All banks OK" (tone 'ok' | 'warn' | 'none')
export function collectorStatus(meta) {
  if (!meta || !meta.lastRunAt) return { text: "The collector hasn't run yet.", tone: 'none' };
  var failed = (meta.sources || []).filter(function (x) { return !x.ok; });
  return {
    text: 'Last collector run: ' + new Date(meta.lastRunAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) +
      (failed.length ? ' · Failed: ' + failed.map(function (x) { return x.bank || x.issuer; }).join(', ') : ' · All banks OK'),
    tone: failed.length ? 'warn' : 'ok'
  };
}
// Published offers matching the admin search, ending soonest first
export function adminPublishedList(published, query) {
  var q = String(query || '').toLowerCase();
  return published.filter(function (o) { return !q || [o.bank, o.merchant, o.headline].join(' ').toLowerCase().indexOf(q) !== -1; })
    .sort(function (a, b) { return String(a.validUntil).localeCompare(String(b.validUntil)); });
}
export var ADMIN_TOASTS = { approve: 'Offer published', reject: 'Draft rejected', expire: 'Offer expired', save: 'Offer updated', create: 'Offer published' };
