// Serendib core: calculations and data rules shared by the phone/iPad app and the desktop app.
// Moved verbatim from index.html (Phase 1). The phone app reads these as globals via browser.js.

/* CONSTANTS */
const APR = 0.28;
const MONTHLY_RATE = APR / 12;
const DAILY_RATE = APR / 365;
const MIN_PMT_PCT = 0.04;
const MIN_PMT_FLOOR = 1000;
const CA_FEE_PCT = 0.04;
const CA_FEE_MIN = 500;
const LS_KEY = "stitch_cards_v3";


/* FORMATTING */
function fmtLKR(n, dec) {
  dec = dec || 0;
  if (isNaN(n) || !isFinite(n)) return "LKR 0";
  var abs = Math.abs(n);
  var str = abs.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? "-" : "") + "LKR " + str;
}
function fmtPct(n, dec) { return n.toFixed(dec || 1) + "%"; }
function fmtMonths(m) {
  if (!isFinite(m) || m <= 0) return "< 1 Month";
  if (m > 9999) return "> 833 Yrs";
  var yr = Math.floor(m / 12), mo = Math.round(m % 12);
  if (yr > 0 && mo > 0) return yr + " Yr" + (yr > 1 ? "s" : "") + " " + mo + " Mo";
  if (yr > 0) return yr + " Yr" + (yr > 1 ? "s" : "");
  return m + " Month" + (m !== 1 ? "s" : "");
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* FINANCIAL CALCULATIONS */

/* Payoff convention used by every calculator: each month starts from a statement balance. Paying it in
   full by the due date costs no interest; whatever is left carries a month's interest into the next
   statement. The minimum is the card's rule applied to that statement balance (app default: 4%, LKR 1,000). */
var calculateCBSLAmortization = function(balance, apr, minPct, minFloor) {
    if (balance <= 0) return null;

    const monthlyRate = (apr / 100) / 12;
    const pctRule = isFinite(minPct) && minPct > 0 ? minPct : MIN_PMT_PCT;
    const floorRule = isFinite(minFloor) && minFloor >= 0 ? minFloor : MIN_PMT_FLOOR;

    // --- SCENARIO A: MINIMUM PAYMENT ---
    let minBal = balance;
    let minMonths = 0;
    let minTotalInterest = 0;
    while (minBal > 0.005 && minMonths < 600) {
        minBal -= Math.min(minBal, Math.max(minBal * pctRule, floorRule));
        minMonths++;
        const interest = minBal * monthlyRate;
        minTotalInterest += interest;
        minBal += interest;
    }

    // --- SCENARIO B: FIXED PAYMENT THAT CLEARS IT IN ABOUT 12 MONTHS (rounded up to LKR 1,000) ---
    const targetMonths = 12;
    const rawFixedPayment = monthlyRate === 0
        ? balance / targetMonths
        : (monthlyRate * balance) / ((1 - Math.pow(1 + monthlyRate, -targetMonths)) * (1 + monthlyRate));
    const targetFixedPayment = Math.ceil(rawFixedPayment / 1000) * 1000;
    const fixed = calcPayoff(balance, targetFixedPayment, apr);

    return { minMonths, minTotalInterest, fixedMonths: fixed.months, fixedTotalInterest: fixed.totalInterest, targetFixedPayment };
};

// Fixed-payment payoff: returns { months, totalInterest } (see the convention above)
function calcPayoff(balance, payment, apr) {
  var rate = (apr !== undefined) ? (apr / 100 / 12) : MONTHLY_RATE;
  if (!(balance > 0)) return { months: 0, totalInterest: 0 };
  if (payment <= 0) return { months: Infinity, totalInterest: Infinity };
  if (payment >= balance) return { months: 1, totalInterest: 0 };
  if (rate === 0) return { months: Math.ceil(balance / payment), totalInterest: 0 };
  // The part left after each payment grows by a month's interest; it has to shrink overall
  if ((balance - payment) * (1 + rate) >= balance) return { months: Infinity, totalInterest: Infinity };
  var remaining = balance, months = 0, totalInterest = 0;
  while (months < 1200) {
    months++;
    if (remaining <= payment + 0.005) break;
    remaining -= payment;
    var interest = remaining * rate;
    totalInterest += interest;
    remaining += interest;
  }
  return { months: months, totalInterest: totalInterest };
}

// Logged-in user's income wins over the browser-wide localStorage value
function getUserIncome() {
  var incStr = (window.currentUserData && window.currentUserData.income !== undefined && window.currentUserData.income !== "")
    ? window.currentUserData.income
    : "175000";
  var inc = parseFloat(incStr);
  if (isNaN(inc) || inc <= 0) inc = 175000;
  return inc;
}

function getStrategy() {
  return window.currentStrategy || "avalanche";
}

// A card's minimum-payment rule, taken from its bank when the card was added.
// Cards saved before per-bank rules existed keep the app default (4%, LKR 1,000 floor).
function cardMinRule(c) {
  var pct = c ? parseFloat(c.minPct) : NaN;
  var floor = c ? parseFloat(c.minFloor) : NaN;
  return {
    pct: isFinite(pct) && pct > 0 ? pct : MIN_PMT_PCT,
    floor: isFinite(floor) && floor >= 0 ? floor : MIN_PMT_FLOOR
  };
}

// Minimum payment, never more than what is owed
function minPaymentFor(c) {
  var r = cardMinRule(c);
  return Math.min(c.balance, Math.max(c.balance * r.pct, r.floor));
}

// The amount this card is guaranteed each month: a saved per-card target (clamped to its
// balance), or just the regulatory minimum if no target has been saved.
function cardFloor(c) {
  var minPmt = minPaymentFor(c);
  if (c.targetPayment) return Math.max(Math.min(c.targetPayment, c.balance), minPmt);
  return minPmt;
}

// Card APR in %; 0 is a valid value, so never use `||` here
function cardApr(c) {
  if (!c) return 28.0;
  if (c.isZeroPercent) return 0;
  var a = parseFloat(c.apr);
  return isFinite(a) && a >= 0 ? a : 28.0;
}

/* ── Sri Lankan credit card issuers ──
   fee:      cash-advance fee at an ATM on standard cards.
             'greater' = higher of percent and fixed, 'plus' = percent + fixed, 'flat' = fixed only.
   apr:      the bank's standard card rate. CBSL has capped card interest at 28% p.a. since Aug 2023.
   minPct / minFloor: minimum monthly payment rule (fraction of balance, LKR floor).
   verified: the fee was checked against the bank's own published tariff (asOf). Unverified banks
             use the app defaults (28%, 4% / LKR 1,000) until their tariff is confirmed.
   HSBC Sri Lanka's retail cards moved to Nations Trust Bank on 1 May 2026, so HSBC maps to ntb.
   Standard Chartered Sri Lanka's retail cards moved to DFCC Bank on 31 July 2026, so it maps to dfcc. */
var SL_CARD_ISSUERS = {
  combank:  { name: 'Commercial Bank',          aliases: ['commercialbankofceylon', 'commercialbank', 'commercial', 'combank'],
              fee: { type: 'greater', percent: 4.5, fixed: 500 },  apr: 28, minPct: 0.04, minFloor: 1000, verified: true,  asOf: 'Jul 2026' },
  boc:      { name: 'Bank of Ceylon',           aliases: ['bankofceylon', 'boc'],
              fee: { type: 'greater', percent: 4.0, fixed: 300 },  apr: 28, minPct: 0.04, minFloor: 1000, verified: false, asOf: '' },
  peoples:  { name: "People's Bank",            aliases: ['peoplesbank', 'peoples'],
              fee: { type: 'greater', percent: 4.0, fixed: 500 },  apr: 28, minPct: 0.04, minFloor: 1000, verified: true,  asOf: 'Jun 2026' },
  sampath:  { name: 'Sampath Bank',             aliases: ['sampathbank', 'sampath'],
              fee: { type: 'greater', percent: 4.0, fixed: 300 },  apr: 28, minPct: 0.04, minFloor: 1000, verified: true,  asOf: 'May 2025' },
  hnb:      { name: 'Hatton National Bank (HNB)', aliases: ['hattonnationalbank', 'hattonnational', 'hnb'],
              fee: { type: 'greater', percent: 4.0, fixed: 500 },  apr: 28, minPct: 0.04, minFloor: 1000, verified: false, asOf: '' },
  seylan:   { name: 'Seylan Bank',              aliases: ['seylanbank', 'seylan'],
              fee: { type: 'greater', percent: 4.0, fixed: 700 },  apr: 28, minPct: 0.04, minFloor: 1000, verified: true,  asOf: 'Jul 2026' },
  ntb:      { name: 'Nations Trust Bank',       aliases: ['nationstrustbank', 'nationstrust', 'americanexpress', 'amex', 'hsbc', 'ntb'],
              fee: { type: 'plus',    percent: 5.0, fixed: 1250 }, apr: 26, minPct: 0.04, minFloor: 250,  verified: true,  asOf: 'Oct 2026' },
  ndb:      { name: 'NDB Bank',                 aliases: ['nationaldevelopmentbank', 'ndbbank', 'ndb'],
              fee: { type: 'plus',    percent: 5.0, fixed: 1200 }, apr: 28, minPct: 0.04, minFloor: 1000, verified: false, asOf: '' },
  dfcc:     { name: 'DFCC Bank',                aliases: ['dfccbank', 'dfcc', 'standardchartered', 'stanchart', 'scb'],
              fee: { type: 'greater', percent: 5.0, fixed: 1250 }, apr: 28, minPct: 0.04, minFloor: 1000, verified: false, asOf: '' },
  pabc:     { name: 'Pan Asia Bank',            aliases: ['panasiabanking', 'panasiabank', 'panasia', 'pabc'],
              fee: { type: 'greater', percent: 5.0, fixed: 1000 }, apr: 26, minPct: 0.04, minFloor: 1000, verified: true,  asOf: 'Jul 2025' },
  union:    { name: 'Union Bank',               aliases: ['unionbankofcolombo', 'unionbank'],
              fee: { type: 'plus',    percent: 10.0, fixed: 750 }, apr: 28, minPct: 0.04, minFloor: 1000, verified: true,  asOf: 'Jun 2026' },
  cdb:      { name: 'CDB (Citizens Development Business Finance)', aliases: ['citizensdevelopment', 'cdb'],
              fee: { type: 'greater', percent: 5.0, fixed: 1000 }, apr: 28, minPct: 0.04, minFloor: 1000, verified: true,  asOf: 'Oct 2026' },
  cargills: { name: 'Cargills Bank',            aliases: ['cargillsbank', 'cargills'],
              fee: { type: 'greater', percent: 4.0, fixed: 500 },  apr: 28, minPct: 0.04, minFloor: 1000, verified: false, asOf: '' },
  lolc:     { name: 'LOLC Finance',             aliases: ['lolcfinance', 'lolc'],
              fee: { type: 'greater', percent: 4.0, fixed: 500 },  apr: 28, minPct: 0.04, minFloor: 1000, verified: false, asOf: '' },
'default': { name: 'Other bank',              aliases: [],
              fee: { type: 'greater', percent: 4.0, fixed: 500 },  apr: 28, minPct: 0.04, minFloor: 1000, verified: false, asOf: '' }
};

// Credit cards each issuer offers (Oct 2026, from the banks' own card pages), used for the
// card tier suggestions when adding a card. 'default' is the generic list for any other bank.
var SL_ISSUER_CARDS = {
  combank:  ['Visa Classic', 'Visa Gold', 'Visa Platinum', 'Visa Signature', 'Visa Infinite', 'Mastercard Gold', 'Mastercard Platinum', 'World Mastercard', 'UnionPay Platinum', 'UnionPay Diamond', 'JCB Platinum'],
  boc:      ['Visa Classic', 'Visa Gold', 'Visa Platinum', 'Mastercard Titanium', 'Mastercard World', 'State Sector Credit Card'],
  peoples:  ['Visa Classic', 'Mastercard Classic', 'Visa Gold', 'Mastercard Gold', 'Visa Platinum', 'Mastercard Platinum', 'Visa Signature', 'Mastercard World', 'Elegance Visa Infinite', 'Vanitha Vasana Visa Platinum', 'SME Business Credit Card'],
  sampath:  ['Visa Classic', 'Mastercard Classic', 'Visa Gold', 'Mastercard Gold', 'Visa Platinum', 'Mastercard Platinum', 'Visa Signature', 'Mastercard World', 'Visa Infinite', 'Visa Infinite Metal', 'American Express Everyday', 'American Express Platinum Ultramiles'],
  hnb:      ['Visa Gold', 'Visa Platinum', 'Visa Signature', 'Visa Infinite', 'Mastercard World', 'Affinity Credit Card'],
  seylan:   ['Visa Gold', 'Visa Platinum', 'Visa Signature', 'World Mastercard', 'Visa Infinite Metal', 'Mastercard Freedom'],
  ntb:      ['American Express Blue', 'American Express Gold', 'American Express Platinum', 'SriLankan Airlines American Express Platinum', 'American Express Explorer', 'Mastercard Platinum', 'Mastercard World', 'Mastercard Business'],
  ndb:      ['Visa Silver', 'Visa Platinum', 'Visa Signature', 'Visa Infinite'],
  dfcc:     ['Visa Platinum', 'Visa Signature', 'Visa Infinite', 'World Mastercard', 'SriLankan Airlines Visa Platinum', 'Affinity Visa'],
  pabc:     ['Mastercard Gold', 'World Mastercard', 'Black Mastercard', 'BizClass Mastercard'],
  union:    ['Visa Gold', 'Visa Platinum', 'Visa Signature'],
  cdb:      ['Mastercard Standard', 'Mastercard Gold', 'Mastercard Titanium', 'Mastercard Platinum', 'Mastercard World'],
  cargills: ['Mastercard Ascend', 'Mastercard Gold', 'Mastercard Titanium', 'Mastercard Platinum'],
  lolc:     ['Mastercard Gold', 'Mastercard Platinum', 'Mastercard World', 'Mastercard Pulse', 'Swairee Credit Card', 'Savi Credit Card'],
  'default': ['Visa Classic', 'Visa Gold', 'Visa Platinum', 'Visa Signature', 'Visa Infinite', 'Mastercard Gold', 'Mastercard Titanium', 'Mastercard Platinum', 'World Mastercard', 'American Express']
};
var SL_ISSUER_NOTES = {
  ntb: 'Includes former HSBC cards and American Express',
  dfcc: 'Includes former Standard Chartered cards'
};
Object.keys(SL_ISSUER_CARDS).forEach(function (k) {
  if (!SL_CARD_ISSUERS[k]) return;
  SL_CARD_ISSUERS[k].cards = SL_ISSUER_CARDS[k];
  if (SL_ISSUER_NOTES[k]) SL_CARD_ISSUERS[k].note = SL_ISSUER_NOTES[k];
});

// Match a typed bank name to an issuer key. The longest matching alias wins, so
// "Commercial Bank of Ceylon" resolves to combank rather than boc. Short aliases
// (4 letters or fewer, like "boc" or "hnb") must be a whole word.
function resolveIssuer(name) {
  var lower = String(name || '').toLowerCase().replace(/&/g, 'and');
  var compact = lower.replace(/[^a-z0-9]/g, '');
  if (!compact) return null;
  var words = lower.split(/[^a-z0-9]+/).filter(Boolean);
  var best = null, bestLen = 0;
  Object.keys(SL_CARD_ISSUERS).forEach(function (key) {
    if (key === 'default') return;
    var iss = SL_CARD_ISSUERS[key];
    if (iss.name.toLowerCase().replace(/[^a-z0-9]/g, '') === compact) { best = key; bestLen = Infinity; return; }
    iss.aliases.forEach(function (a) {
      var hit = a.length <= 4 ? words.indexOf(a) !== -1 : compact.indexOf(a) !== -1;
      if (hit && a.length > bestLen) { best = key; bestLen = a.length; }
    });
  });
  return best;
}

function cardIssuer(c) {
  var key = c && c.issuer && SL_CARD_ISSUERS[c.issuer] ? c.issuer : resolveIssuer(c && c.bank);
  return SL_CARD_ISSUERS[key] || SL_CARD_ISSUERS['default'];
}

function computeAdvanceFee(fee, amount) {
  var p = (fee.percent || 0) / 100;
  if (fee.type === 'plus') return amount * p + fee.fixed;
  if (fee.type === 'flat') return fee.fixed;
  return Math.max(amount * p, fee.fixed);
}

// Read live from the issuer table, so tariff corrections reach cards saved earlier
function cardFee(c, amount) {
  return computeAdvanceFee(cardIssuer(c).fee, amount);
}

// Cash advances are charged at the card's normal rate even on a 0% instalment plan,
// so this ignores isZeroPercent and uses the stored APR, then the bank's default
function cashAdvanceApr(c) {
  var a = c ? parseFloat(c.apr) : NaN;
  return isFinite(a) && a > 0 ? a : cardIssuer(c).apr;
}

function suggestNorm(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}
function suggestEscape(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

// Order matches: label starts with the query, then a word in it does, then it appears anywhere.
// Extra search terms (bank aliases like "amex" or "hsbc") count, just below a label match.
function rankSuggestions(items, query) {
  var q = suggestNorm(query);
  if (!q) return items.slice();
  var qc = q.replace(/ /g, '');
  var scored = [];
  items.forEach(function (it, idx) {
    var best = 99;
    [it.label].concat(it.terms || []).forEach(function (term, ti) {
      var t = suggestNorm(term), tc = t.replace(/ /g, '');
      var rank = (t.indexOf(q) === 0 || tc.indexOf(qc) === 0) ? 0
        : (' ' + t).indexOf(' ' + q) !== -1 ? 1
        : tc.indexOf(qc) !== -1 ? 2 : 99;
      if (ti > 0 && rank < 99) rank += 0.5;
      if (rank < best) best = rank;
    });
    if (best < 99) scored.push({ it: it, rank: best, idx: idx });
  });
  scored.sort(function (a, b) { return a.rank - b.rank || a.idx - b.idx; });
  return scored.map(function (x) { return x.it; });
}

function highlightMatch(label, query) {
  var q = String(query || '').trim();
  var i = q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i === -1) return suggestEscape(label);
  return suggestEscape(label.slice(0, i)) + '<strong class="font-semibold">' + suggestEscape(label.slice(i, i + q.length)) + '</strong>' + suggestEscape(label.slice(i + q.length));
}

function issuerNetworks(cards) {
  var nets = [];
  [['Visa', /visa/i], ['Mastercard', /mastercard/i], ['American Express', /american express/i], ['UnionPay', /unionpay/i], ['JCB', /jcb/i]].forEach(function (n) {
    if ((cards || []).some(function (c) { return n[1].test(c); })) nets.push(n[0]);
  });
  return nets.join(' · ');
}
function bankSuggestions() {
  return {
    items: Object.keys(SL_CARD_ISSUERS).filter(function (k) { return k !== 'default'; }).map(function (k) {
      var iss = SL_CARD_ISSUERS[k];
      return { label: iss.name, hint: iss.note || issuerNetworks(iss.cards), terms: iss.aliases.concat([k]) };
    }).sort(function (a, b) { return a.label.localeCompare(b.label); })
  };
}
// Tier suggestions follow the bank typed in the paired field
function tierSuggestions(bankValue) {
  var key = resolveIssuer(bankValue);
  var iss = key ? SL_CARD_ISSUERS[key] : null;
  var known = iss && iss.cards && iss.cards.length;
  return {
    header: known ? 'Suggested for ' + iss.name + ' cards' : 'Common card types',
    items: (known ? iss.cards : SL_CARD_ISSUERS['default'].cards).map(function (c) { return { label: c }; })
  };
}


// Clamp a day-of-month to the last day of the given month (e.g. 31 -> 30 in April)
function clampDay(year, month, day) {
  var last = new Date(year, month + 1, 0).getDate();
  return Math.min(day, last);
}

function isValidDay(d) {
  var n = parseInt(d, 10);
  return !isNaN(n) && n >= 1 && n <= 31;
}

// Build a "YYYY-MM-DD" string (for a date <input>) for the given day in the current month,
// formatted from local date parts so it never shifts a day via UTC conversion.
function dayToLocalDateStr(day) {
  var today = new Date();
  var y = today.getFullYear(), m = today.getMonth();
  var d = clampDay(y, m, parseInt(day, 10) || 1);
  var dt = new Date(y, m, d);
  var mm = String(dt.getMonth() + 1).padStart(2, '0');
  var dd = String(dt.getDate()).padStart(2, '0');
  return dt.getFullYear() + '-' + mm + '-' + dd;
}

// Read the day-of-month back out of a date <input>'s "YYYY-MM-DD" value by splitting the
// string directly, instead of `new Date(str)`, which parses as UTC and can shift the day.
function localDateStrToDay(value) {
  if (!value) return NaN;
  var parts = value.split('-');
  return parts.length === 3 ? parseInt(parts[2], 10) : NaN;
}

// Custom targets (capped at balance) if any are set, otherwise 25% of income
function computeMonthlyBudget(cardList) {
  var totalFloor = 0;
  cardList.forEach(function (c) {
    if (c.balance > 0) totalFloor += cardFloor(c);
  });
  // Income sets the budget; a saved per-card target only ever raises it, never shrinks it.
  return Math.max(totalFloor, getUserIncome() * 0.25);
}

// Each card's floor (its saved target, or just the minimum) first, then cascade surplus in
// priority order, each capped at its balance
function allocateMonthlyPayments(sortedActiveCards, budget) {
  var alloc = {};
  var remaining = budget;
  sortedActiveCards.forEach(function (c) {
    var floor = cardFloor(c);
    alloc[c.id] = floor;
    remaining -= floor;
  });
  sortedActiveCards.forEach(function (c) {
    if (remaining <= 0) return;
    var extra = Math.min(c.balance - alloc[c.id], remaining);
    if (extra > 0) {
      alloc[c.id] += extra;
      remaining -= extra;
    }
  });
  var total = 0;
  sortedActiveCards.forEach(function (c) { total += alloc[c.id]; });
  return { alloc: alloc, total: total };
}

// Minimum-only path, using the card's minimum-payment rule when given
function calcMinPayoff(balance, apr, rule) {
  var res = calculateCBSLAmortization(balance, apr !== undefined ? apr : 28, rule && rule.pct, rule && rule.floor);
  if (!res || res.minMonths >= 600) return { months: Infinity, totalInterest: Infinity };
  return { months: res.minMonths, totalInterest: res.minTotalInterest };
}

// "Today, 24 Oct" / "1 day, on 24 Oct" / "8 days, on 24 Oct"
function statementWhenText(daysLeft, dateString) {
    if (daysLeft === 0) return 'Today, ' + dateString;
    return daysLeft + (daysLeft === 1 ? ' day' : ' days') + ', on ' + dateString;
}

function calculateNextStatement(statementDayInt) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    
    var sd = parseInt(statementDayInt, 10);
    if (isNaN(sd) || sd < 1 || sd > 31) sd = 28;
    
    var y = today.getFullYear(), m = today.getMonth();
    var nextStatementDate = new Date(y, m, clampDay(y, m, sd));

    // On the statement day itself the statement is today (matches the Spending period)
    if (today > nextStatementDate) {
        nextStatementDate = new Date(y, m + 1, clampDay(y, m + 1, sd));
    }
    
    var diffTime = nextStatementDate.getTime() - today.getTime();
    var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    var options = { day: 'numeric', month: 'short' };
    var dateString = nextStatementDate.toLocaleDateString('en-GB', options);
    
    return { daysLeft: diffDays, dateString: dateString };
}

// Cash advance: a one-off fee plus simple daily interest on the cash from the day it is
// withdrawn (Sri Lankan banks give no grace period on cash). `overrides` lets a custom
// simulator scenario supply its own fee and APR instead of a saved card's.
function calcCashAdvance(principal, days, c, overrides) {
  var advanceFee = overrides && overrides.fee !== undefined ? overrides.fee : cardFee(c, principal);
  var apr = overrides && overrides.apr !== undefined ? overrides.apr : cashAdvanceApr(c);
  var interest = principal * (apr / 100 / 365) * days;
  return { advanceFee: advanceFee, interest: interest, total: principal + advanceFee + interest };
}

// The interest rate hidden in a 0% plan's fee, via IRR (Newton-Raphson). apr is the yearly rate
// (12 x monthly), the same basis as the 28% cap; effectiveAPR is that rate compounded over a year.
function calcSurchargeAPR(purchasePrice, surchargePct, tenure) {
  tenure = Math.max(1, Math.round(tenure) || 1);
  var surchargeAmt = purchasePrice * surchargePct;
  var totalPay = purchasePrice + surchargeAmt;
  var monthly = totalPay / tenure;
  var r = surchargePct / tenure;
  for (var i = 0; i < 200; i++) {
    var npv = -purchasePrice, dnpv = 0;
    for (var t = 1; t <= tenure; t++) {
      var d = Math.pow(1 + r, t);
      npv += monthly / d;
      dnpv -= t * monthly / (d * (1 + r));
    }
    var rNew = r - npv / dnpv;
    if (Math.abs(rNew - r) < 1e-10) break;
    r = rNew;
  }
  var effectiveAPR = (Math.pow(1 + r, 12) - 1) * 100;
  return { apr: r * 12 * 100, effectiveAPR: effectiveAPR, surchargeAmt: surchargeAmt, totalPay: totalPay, monthly: monthly };
}

/* ── Card colours: one table for every place a card is shown ──
   bg/icon/bar are the Tailwind classes the card list and card screen already used;
   hex/ink/soft are for inline styles and CSS variables (accent, text on tint, tint). */
var CARD_THEMES = {
  teal:    { name: 'Teal (default)',    bg: 'bg-teal-50',    icon: 'text-teal-600',    text: 'text-teal-700',    bar: 'bg-teal-500',    hex: '#14b8a6', ink: '#0f766e', soft: 'rgba(20,184,166,.12)', inkDark: '#5eead4' },
  rose:    { name: 'Rose',              bg: 'bg-rose-50',    icon: 'text-rose-600',    text: 'text-rose-700',    bar: 'bg-rose-500',    hex: '#f43f5e', ink: '#be123c', soft: 'rgba(244,63,94,.12)', inkDark: '#fda4af' },
  amber:   { name: 'Amber / Gold',      bg: 'bg-amber-50',   icon: 'text-amber-600',   text: 'text-amber-700',   bar: 'bg-amber-500',   hex: '#f59e0b', ink: '#b45309', soft: 'rgba(245,158,11,.14)', inkDark: '#fcd34d' },
  emerald: { name: 'Emerald',           bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700', bar: 'bg-emerald-500', hex: '#10b981', ink: '#047857', soft: 'rgba(16,185,129,.12)', inkDark: '#6ee7b7' },
  violet:  { name: 'Violet',            bg: 'bg-violet-50',  icon: 'text-violet-600',  text: 'text-violet-700',  bar: 'bg-violet-500',  hex: '#8b5cf6', ink: '#6d28d9', soft: 'rgba(139,92,246,.12)', inkDark: '#c4b5fd' },
  sky:     { name: 'Sky Blue',          bg: 'bg-sky-50',     icon: 'text-sky-600',     text: 'text-sky-700',     bar: 'bg-sky-500',     hex: '#0ea5e9', ink: '#0369a1', soft: 'rgba(14,165,233,.12)', inkDark: '#7dd3fc' },
  slate:   { name: 'Slate / Titanium',  bg: 'bg-slate-100',  icon: 'text-slate-600',   text: 'text-slate-700',   bar: 'bg-slate-600',   hex: '#475569', ink: '#334155', soft: 'rgba(71,85,105,.12)', inkDark: '#cbd5e1' },
  indigo:  { name: 'Indigo / Navy',     bg: 'bg-indigo-50',  icon: 'text-indigo-600',  text: 'text-indigo-700',  bar: 'bg-indigo-600',  hex: '#4f46e5', ink: '#4338ca', soft: 'rgba(79,70,229,.12)', inkDark: '#a5b4fc' },
  red:     { name: 'Crimson / Ruby',    bg: 'bg-red-50',     icon: 'text-red-600',     text: 'text-red-700',     bar: 'bg-red-600',     hex: '#dc2626', ink: '#b91c1c', soft: 'rgba(220,38,38,.12)', inkDark: '#fca5a5' },
  fuchsia: { name: 'Fuchsia / Magenta', bg: 'bg-fuchsia-50', icon: 'text-fuchsia-600', text: 'text-fuchsia-700', bar: 'bg-fuchsia-500', hex: '#d946ef', ink: '#a21caf', soft: 'rgba(217,70,239,.12)', inkDark: '#f0abfc' },
  cyan:    { name: 'Cyan / Ocean',      bg: 'bg-cyan-50',    icon: 'text-cyan-600',    text: 'text-cyan-700',    bar: 'bg-cyan-500',    hex: '#06b6d4', ink: '#0e7490', soft: 'rgba(6,182,212,.12)', inkDark: '#67e8f9' }
};
function cardTheme(card) { return CARD_THEMES[card && card.color] || CARD_THEMES.teal; }
function cardName(c) { return String(c.bank || '').split(' ')[0] + ' ' + (c.nick || ''); }
/* ── Spend ledger: categories, statement periods, balance effects, recurring charges, SMS parsing ── */
var SPEND_CATEGORIES = [
  { key: 'groceries', label: 'Groceries', icon: 'shopping_basket', bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', offer: 'groceries' },
  { key: 'dining', label: 'Dining', icon: 'restaurant', bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-500', offer: 'dining' },
  { key: 'fuel', label: 'Fuel & Transport', icon: 'local_gas_station', bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', offer: 'fuel_bills' },
  { key: 'shopping', label: 'Shopping', icon: 'shopping_bag', bg: 'bg-sky-50', text: 'text-sky-700', bar: 'bg-sky-500', offer: 'shopping' },
  { key: 'bills', label: 'Bills & Utilities', icon: 'receipt_long', bg: 'bg-slate-100', text: 'text-slate-700', bar: 'bg-slate-500', offer: 'fuel_bills' },
  { key: 'subscriptions', label: 'Subscriptions', icon: 'subscriptions', bg: 'bg-indigo-50', text: 'text-indigo-700', bar: 'bg-indigo-500', offer: 'online' },
  { key: 'travel', label: 'Travel', icon: 'flight', bg: 'bg-cyan-50', text: 'text-cyan-700', bar: 'bg-cyan-500', offer: 'travel' },
  { key: 'health', label: 'Health', icon: 'favorite', bg: 'bg-rose-50', text: 'text-rose-700', bar: 'bg-rose-500', offer: 'health' },
  { key: 'entertainment', label: 'Entertainment', icon: 'movie', bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', bar: 'bg-fuchsia-500', offer: 'other' },
  { key: 'education', label: 'Education', icon: 'school', bg: 'bg-teal-50', text: 'text-teal-700', bar: 'bg-teal-500', offer: 'other' },
  { key: 'other', label: 'Other', icon: 'more_horiz', bg: 'bg-slate-100', text: 'text-slate-600', bar: 'bg-slate-400', offer: 'other' }
];
function spendCategory(key) {
  return SPEND_CATEGORIES.filter(function (c) { return c.key === key; })[0] || SPEND_CATEGORIES[SPEND_CATEGORIES.length - 1];
}

// Common recurring charges in Sri Lanka, for the recurring payment name field
var RECURRING_SUGGESTIONS = [
  { label: 'Netflix', category: 'subscriptions' }, { label: 'Spotify', category: 'subscriptions' },
  { label: 'YouTube Premium', category: 'subscriptions' }, { label: 'Disney+', category: 'subscriptions' },
  { label: 'Apple iCloud', category: 'subscriptions' }, { label: 'Google One', category: 'subscriptions' },
  { label: 'Microsoft 365', category: 'subscriptions' }, { label: 'ChatGPT Plus', category: 'subscriptions' },
  { label: 'Dialog', category: 'bills' }, { label: 'Mobitel', category: 'bills' }, { label: 'SLT-Mobitel Fibre', category: 'bills' },
  { label: 'Hutch', category: 'bills' }, { label: 'Airtel', category: 'bills' }, { label: 'Electricity (CEB)', category: 'bills' },
  { label: 'Water (NWSDB)', category: 'bills' }, { label: 'PickMe', category: 'fuel' }, { label: 'Uber One', category: 'fuel' },
  { label: 'Gym membership', category: 'health' }, { label: 'Insurance premium', category: 'bills' },
  { label: 'School fees', category: 'education' }
];

function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseYmd(s) {
  var p = String(s || '').split('-').map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
}
function addDays(s, n) {
  var d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function daysBetween(a, b) {
  return Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
}
function isRealYmd(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  return ymd(parseYmd(s)) === s;
}

// The card's statement period containing refStr: from the day after the previous statement date
// to the next one (purchases on the statement day belong to that statement). Calendar month
// when the card has no billing cycle.
function billingPeriod(card, refStr) {
  var ref = parseYmd(refStr || ymd(new Date()));
  if (card && isValidDay(card.statementDay)) {
    var sd = parseInt(card.statementDay, 10);
    var y = ref.getFullYear(), m = ref.getMonth();
    var thisStmt = new Date(y, m, clampDay(y, m, sd));
    var end, prevStmt;
    if (ref <= thisStmt) {
      end = thisStmt;
      prevStmt = new Date(y, m - 1, clampDay(y, m - 1, sd));
    } else {
      end = new Date(y, m + 1, clampDay(y, m + 1, sd));
      prevStmt = thisStmt;
    }
    var start = new Date(prevStmt.getFullYear(), prevStmt.getMonth(), prevStmt.getDate() + 1);
    return { start: ymd(start), end: ymd(end), hasCycle: true };
  }
  return {
    start: ymd(new Date(ref.getFullYear(), ref.getMonth(), 1)),
    end: ymd(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)),
    hasCycle: false
  };
}

// Apply (sign 1) or reverse (sign -1) an entry's effect on the card's balance.
// Purchases add, payments and refunds subtract, adjustments carry their own sign. The balance
// never goes below zero; `applied` records the change actually made so reversing is exact.
function applyLedgerEffect(card, entry, sign) {
  var bal = Number(card.balance) || 0;
  if (sign > 0) {
    var amt = Number(entry.amount) || 0;
    var delta = entry.type === 'adjustment' ? amt : (entry.type === 'purchase' ? amt : -amt);
    var next = Math.max(0, Math.round((bal + delta) * 100) / 100);
    entry.applied = Math.round((next - bal) * 100) / 100;
    card.balance = next;
  } else {
    card.balance = Math.max(0, Math.round((bal - (Number(entry.applied) || 0)) * 100) / 100);
  }
}

// Totals for one period: spending (purchases minus refunds) by category, payments, top merchants
function periodSummary(card, period) {
  var spent = 0, payments = 0, byCat = {}, merchants = {};
  (card.ledger || []).forEach(function (e) {
    if (e.date < period.start || e.date > period.end) return;
    var amt = Number(e.amount) || 0;
    if (e.type === 'purchase' || e.type === 'refund') {
      var s = e.type === 'purchase' ? amt : -amt;
      var cat = e.category || 'other';
      spent += s;
      byCat[cat] = (byCat[cat] || 0) + s;
      if (e.merchant) {
        var mk = suggestNorm(e.merchant);
        if (!merchants[mk]) merchants[mk] = { name: e.merchant, total: 0 };
        merchants[mk].total += s;
      }
    } else if (e.type === 'payment') {
      payments += amt;
    }
  });
  var top = Object.keys(merchants).map(function (k) { return merchants[k]; })
    .filter(function (m) { return m.total > 0; })
    .sort(function (a, b) { return b.total - a.total; }).slice(0, 3);
  Object.keys(byCat).forEach(function (k) { if (byCat[k] < 0) byCat[k] = 0; });
  return { spent: Math.max(0, spent), payments: payments, byCat: byCat, topMerchants: top };
}

// Due dates (YYYY-MM-DD) a recurring charge should have posted by todayStr but hasn't yet
function recurringDueDates(item, todayStr) {
  if (!item || item.paused || !(Number(item.amount) > 0) || !isValidDay(item.day) || !isRealYmd(item.startDate)) return [];
  var out = [];
  var day = parseInt(item.day, 10);
  var start = parseYmd(item.startDate);
  var y = start.getFullYear(), m = start.getMonth();
  for (var guard = 0; guard < 120; guard++) {
    var due = ymd(new Date(y, m, clampDay(y, m, day)));
    if (due > todayStr || (item.endDate && due > item.endDate)) break;
    var month = due.slice(0, 7);
    if (due >= item.startDate && (!item.lastPosted || month > item.lastPosted) && (item.skipped || []).indexOf(month) === -1) out.push(due);
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

// Next date a recurring charge will post (null if it has ended)
function recurringNextDue(item, todayStr) {
  if (!item || item.paused || !isValidDay(item.day)) return null;
  var day = parseInt(item.day, 10);
  var t = parseYmd(todayStr);
  var y = t.getFullYear(), m = t.getMonth();
  for (var k = 0; k < 24; k++) {
    var due = ymd(new Date(y, m, clampDay(y, m, day)));
    var month = due.slice(0, 7);
    m++;
    if (m > 11) { m = 0; y++; }
    if (item.endDate && due > item.endDate) return null;
    if (item.startDate && due < item.startDate) continue;
    if ((item.lastPosted && month <= item.lastPosted) || (item.skipped || []).indexOf(month) !== -1) continue;
    return due;
  }
  return null;
}

// Post every due recurring charge on one card. Entry ids are rec_<item>_<YYYY-MM>, so a month
// can never be posted twice. Returns [{ entry, item }].
function postDueRecurringOnCard(card, todayStr) {
  var posted = [];
  if (!Array.isArray(card.recurring) || !card.recurring.length) return posted;
  if (!Array.isArray(card.ledger)) card.ledger = [];
  card.recurring.forEach(function (item) {
    recurringDueDates(item, todayStr).forEach(function (due) {
      var month = due.slice(0, 7);
      var id = 'rec_' + item.id + '_' + month;
      if (!card.ledger.some(function (e) { return e.id === id; })) {
        var entry = { id: id, date: due, type: 'purchase', amount: Number(item.amount), category: item.category || 'subscriptions',
          merchant: item.name, note: 'Recurring payment', source: 'recurring', recurringId: item.id, createdAt: Date.now() };
        applyLedgerEffect(card, entry, 1);
        card.ledger.push(entry);
        posted.push({ entry: entry, item: item });
      }
      if (!item.lastPosted || month > item.lastPosted) item.lastPosted = month;
    });
  });
  return posted;
}

// Keep the user document small: entries older than 24 months become monthly totals
function archiveOldLedger(card, todayStr) {
  if (!Array.isArray(card.ledger) || !card.ledger.length) return false;
  var t = parseYmd(todayStr);
  var cutoff = ymd(new Date(t.getFullYear(), t.getMonth() - 24, 1));
  var keep = [], moved = false;
  card.ledger.forEach(function (e) {
    if (e.date && e.date < cutoff) {
      var month = e.date.slice(0, 7);
      if (!card.ledgerArchive) card.ledgerArchive = {};
      var a = card.ledgerArchive[month] || (card.ledgerArchive[month] = { spent: 0, payments: 0, byCategory: {} });
      var amt = Number(e.amount) || 0;
      if (e.type === 'purchase' || e.type === 'refund') {
        var s = e.type === 'purchase' ? amt : -amt;
        a.spent += s;
        a.byCategory[e.category || 'other'] = (a.byCategory[e.category || 'other'] || 0) + s;
      } else if (e.type === 'payment') {
        a.payments += amt;
      }
      moved = true;
    } else {
      keep.push(e);
    }
  });
  if (moved) card.ledger = keep;
  return moved;
}

// Read a pasted bank transaction SMS. Nothing is saved from this directly: the result only
// fills the form for the user to check.
var SMS_MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function parseBankSms(text, todayStr) {
  var t = String(text || '').replace(/\s+/g, ' ').trim();
  var out = { amount: null, foreign: '', merchant: '', date: '', type: 'purchase', last4: '' };
  if (!t) return out;
  var today = todayStr || ymd(new Date());

  var CUR = '(LKR|SLR|Rs\\.?|රු\\.?|USD|EUR|GBP|AUD|SGD|INR|AED|JPY|CAD)';
  var m = t.match(new RegExp(CUR + '\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)', 'i'));
  var cur = m ? m[1] : null, num = m ? m[2] : null;
  if (!m) {
    var m2 = t.match(new RegExp('([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*' + CUR, 'i'));
    if (m2) { num = m2[1]; cur = m2[2]; }
  }
  if (num) {
    var val = parseFloat(num.replace(/,/g, ''));
    var code = cur.toUpperCase().replace(/\./g, '');
    if (code === 'LKR' || code === 'SLR' || code === 'RS' || cur.indexOf('රු') === 0) out.amount = val;
    else out.foreign = code + ' ' + num;
  }

  if (/\b(refund|reversal|reversed)\b/i.test(t)) out.type = 'refund';
  else if (/\b(payment (?:of|received|made)|thank you for (?:your )?payment|paid to your card|credited to your (?:card|account))\b/i.test(t)) out.type = 'payment';

  var mm = t.match(/\b(?:at|@)\s+([A-Za-z0-9&'.\- ]{2,40}?)(?=\s+(?:on|for|dated|via|ref|avl|available|bal|balance|card|from)\b|[,;]|\s+\d{1,2}[\/\-.]\d{1,2}|$)/i)
    || t.match(/\bmerchant\s*[:\-]\s*([A-Za-z0-9&'.\- ]{2,40}?)(?=[,;]|\s+on\b|$)/i);
  if (mm && out.type === 'purchase') out.merchant = mm[1].replace(/\s+/g, ' ').trim();

  var d = null;
  var iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  var dmy = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  var named = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s\-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-,]*(\d{2,4})?\b/i);
  if (iso) d = iso[1] + '-' + iso[2] + '-' + iso[3];
  else if (dmy) {
    var yy = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
    d = yy + '-' + String(dmy[2]).padStart(2, '0') + '-' + String(dmy[1]).padStart(2, '0');
  } else if (named) {
    var ny = named[3] ? (named[3].length === 2 ? '20' + named[3] : named[3]) : today.slice(0, 4);
    d = ny + '-' + String(SMS_MONTHS[named[2].toLowerCase()]).padStart(2, '0') + '-' + String(named[1]).padStart(2, '0');
  }
  if (d && isRealYmd(d) && d <= today) out.date = d;

  var l4 = t.match(/(?:ending(?:\s+(?:with|in))?|ends\s+with|x{2,}|\*{2,}|#)\s*(\d{4})\b/i);
  if (l4) out.last4 = l4[1];
  return out;
}

/* ── Statement cycles: due dates, statement minimums, paid / overdue ── */
// Latest statement date on or before refStr
function lastStatementOnOrBefore(statementDay, refStr) {
  var r = parseYmd(refStr), sd = parseInt(statementDay, 10), y = r.getFullYear(), m = r.getMonth();
  var d = new Date(y, m, clampDay(y, m, sd));
  if (d > r) d = new Date(y, m - 1, clampDay(y, m - 1, sd));
  return ymd(d);
}
// A statement's payment due date: the first due day after the statement date
function dueDateFor(stmtStr, dueDay) {
  var s = parseYmd(stmtStr), dd = parseInt(dueDay, 10), y = s.getFullYear(), m = s.getMonth();
  var d = new Date(y, m, clampDay(y, m, dd));
  if (d <= s) d = new Date(y, m + 1, clampDay(y, m + 1, dd));
  return ymd(d);
}
// Statement dates from fromStr to toStr (inclusive), oldest first
function statementDatesBetween(statementDay, fromStr, toStr) {
  var out = [], f = parseYmd(fromStr), sd = parseInt(statementDay, 10);
  var y = f.getFullYear(), m = f.getMonth() - 1;
  for (var guard = 0; guard < 40; guard++) {
    var d = ymd(new Date(y, m, clampDay(y, m, sd)));
    if (d > toStr) break;
    if (d >= fromStr) out.push(d);
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}
// First statement date after stmtStr
function nextStatementAfter(statementDay, stmtStr) {
  return statementDatesBetween(statementDay, addDays(stmtStr, 1), addDays(stmtStr, 62))[0];
}
// The due day this month, or next month if it has passed (today counts)
function nextDueDayFrom(dueDay, todayStr) {
  var t = parseYmd(todayStr), dd = parseInt(dueDay, 10), y = t.getFullYear(), m = t.getMonth();
  var d = ymd(new Date(y, m, clampDay(y, m, dd)));
  return d >= todayStr ? d : ymd(new Date(y, m + 1, clampDay(y, m + 1, dd)));
}
// Balance at the end of dateStr: today's balance minus everything logged after it
function balanceAt(card, dateStr) {
  var b = Number(card.balance) || 0;
  (card.ledger || []).forEach(function (e) { if (e.date > dateStr) b -= Number(e.applied) || 0; });
  return Math.max(0, Math.round(b * 100) / 100);
}
// Snapshot each statement (balance and minimum due) from cycleTrackedFrom up to today. Keeps 12.
function recordStatements(card, todayStr) {
  if (!isValidDay(card.statementDay) || !isValidDay(card.dueDay) || !card.cycleTrackedFrom) return false;
  if (!Array.isArray(card.statements)) card.statements = [];
  var have = {}, changed = false;
  card.statements.forEach(function (s) { have[s.date] = true; });
  statementDatesBetween(card.statementDay, card.cycleTrackedFrom, todayStr).forEach(function (d) {
    if (have[d]) return;
    var bal = balanceAt(card, d);
    var minDue = Math.round(minPaymentFor({ balance: bal, minPct: card.minPct, minFloor: card.minFloor }) * 100) / 100;
    card.statements.push({ date: d, due: dueDateFor(d, card.dueDay), balance: bal, minDue: minDue });
    changed = true;
  });
  if (changed) {
    card.statements.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (card.statements.length > 12) card.statements.splice(0, card.statements.length - 12);
  }
  return changed;
}
// Which statement minimums are paid. Payments logged after a statement count towards it,
// oldest unpaid first; a cleared balance pays everything.
function cycleStatus(card, todayStr) {
  var st = (card.statements || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  if (!st.length) return null;
  var rows = st.map(function (s) { return { s: s, paid: 0, remaining: Math.max(0, Number(s.minDue) || 0) }; });
  if (!(Number(card.balance) > 0)) {
    rows.forEach(function (r) { r.paid = r.remaining; r.remaining = 0; });
  } else {
    (card.ledger || []).filter(function (e) { return e.type === 'payment'; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; })
      .forEach(function (p) {
        var left = Number(p.amount) || 0;
        rows.forEach(function (r) {
          if (left <= 0 || r.remaining <= 0 || p.date <= r.s.date) return;
          var take = Math.min(left, r.remaining);
          r.paid = Math.round((r.paid + take) * 100) / 100;
          r.remaining = Math.round((r.remaining - take) * 100) / 100;
          left -= take;
        });
      });
  }
  var unpaid = rows.filter(function (r) { return r.remaining > 0.5; });
  var missed = unpaid.filter(function (r) { return r.s.due < todayStr; });
  var next = unpaid.filter(function (r) { return r.s.due >= todayStr; })[0] || null;
  return {
    rows: rows,
    latest: rows[rows.length - 1],
    next: next,
    overdue: missed.length ? {
      since: missed[0].s.due,
      days: daysBetween(missed[0].s.due, todayStr),
      amount: Math.round(missed.reduce(function (s, r) { return s + r.remaining; }, 0) * 100) / 100,
      statements: missed.map(function (r) { return r.s; }),
      // Asked once, about the oldest missed payment; later months don't hide the warnings
      answered: missed[0].s.answered === 'no'
    } : null
  };
}

/* ── Spaces: history, months left, monthly amount needed, recent pace ── */
// Ids go into onclick attributes, so keep them to letters, digits, - and _
function safeId(id) { return String(id == null ? '' : id).replace(/[^\w-]/g, ''); }
// Older spaces have no history: start it with one "Opening balance" deposit on the day the space was made
function ensureSpaceHistory(space) {
  if (Array.isArray(space.history)) return false;
  space.history = [];
  var cur = Number(space.currentLKR) || 0;
  if (cur > 0) {
    var made = Number(space.id);
    var date = isFinite(made) && made > 1e12 ? ymd(new Date(made)) : ymd(new Date());
    space.history.push({ id: 'open_' + safeId(space.id), date: date, type: 'deposit', amount: cur, note: 'Opening balance', createdAt: isFinite(made) ? made : Date.now() });
  }
  return true;
}
// Whole months from today to the target date (0 once it has passed)
function spaceMonthsLeft(targetDate, todayStr) {
  if (!isRealYmd(targetDate) || targetDate <= todayStr) return 0;
  var t = parseYmd(todayStr), d = parseYmd(targetDate);
  var months = (d.getFullYear() - t.getFullYear()) * 12 + (d.getMonth() - t.getMonth());
  if (d.getDate() > t.getDate()) months++;
  return Math.max(1, months);
}
function spaceMonthlyNeeded(space, todayStr) {
  var left = Math.max(0, (Number(space.targetLKR) || 0) - (Number(space.currentLKR) || 0));
  if (!left) return 0;
  var months = spaceMonthsLeft(space.targetDate, todayStr);
  return months ? left / months : left;
}
// Average net amount added per month over the last 90 days
function spaceRecentPace(space, todayStr) {
  var from = addDays(todayStr, -90), net = 0;
  (space.history || []).forEach(function (h) {
    if (h.date <= from || h.note === 'Opening balance') return;
    net += h.type === 'deposit' ? (Number(h.amount) || 0) : -(Number(h.amount) || 0);
  });
  return net / 3;
}

/* ── Backup files: build and check. Only known fields are kept, so a bad file can't inject anything ── */
var BACKUP_VERSION = 1;
function _num(v, min, max) { var n = Number(v); return isFinite(n) && n >= (min == null ? -Infinity : min) && n <= (max == null ? Infinity : max) ? n : null; }
function _str(v, max) { return typeof v === 'string' ? v.slice(0, max) : null; }
function _pick(src, out, key, val) { if (val !== null && val !== undefined) out[key] = val; }
function _ymdOrNull(v) { return typeof v === 'string' && isRealYmd(v) ? v : null; }
var LEDGER_TYPES = ['purchase', 'payment', 'refund', 'adjustment'], LEDGER_SOURCES = ['manual', 'sms', 'recurring', 'system', 'space'];
function cleanEntry(e) {
  if (!e || typeof e !== 'object') return null;
  var out = {}, id = safeId(e.id), date = _ymdOrNull(e.date), amt = _num(e.amount, -1e9, 1e9);
  if (!id || !date || amt === null || LEDGER_TYPES.indexOf(e.type) === -1) return null;
  out.id = id; out.date = date; out.type = e.type; out.amount = amt;
  if (SPEND_CATEGORIES.some(function (c) { return c.key === e.category; })) out.category = e.category;
  _pick(e, out, 'merchant', _str(e.merchant, 60));
  _pick(e, out, 'note', _str(e.note, 80));
  out.source = LEDGER_SOURCES.indexOf(e.source) !== -1 ? e.source : 'manual';
  _pick(e, out, 'applied', _num(e.applied, -1e9, 1e9));
  _pick(e, out, 'createdAt', _num(e.createdAt, 0));
  _pick(e, out, 'editedAt', _num(e.editedAt, 0));
  if (e.recurringId) out.recurringId = safeId(e.recurringId);
  if (e.spaceId) out.spaceId = safeId(e.spaceId);
  return out;
}
function cleanRecurring(r) {
  if (!r || typeof r !== 'object') return null;
  var id = safeId(r.id), name = _str(r.name, 40), amt = _num(r.amount, 0.01, 1e8);
  if (!id || !name || amt === null || !isValidDay(r.day) || !_ymdOrNull(r.startDate)) return null;
  var out = { id: id, name: name, amount: amt, day: parseInt(r.day, 10), startDate: r.startDate, endDate: _ymdOrNull(r.endDate),
    paused: !!r.paused, cancelled: !!r.cancelled, lastPosted: /^\d{4}-\d{2}$/.test(r.lastPosted || '') ? r.lastPosted : null,
    skipped: Array.isArray(r.skipped) ? r.skipped.filter(function (m) { return /^\d{4}-\d{2}$/.test(m); }).slice(0, 240) : [] };
  out.category = SPEND_CATEGORIES.some(function (c) { return c.key === r.category; }) ? r.category : 'subscriptions';
  _pick(r, out, 'createdAt', _num(r.createdAt, 0));
  return out;
}
function cleanCard(c) {
  if (!c || typeof c !== 'object') return null;
  var bank = _str(c.bank, 80), nick = _str(c.nick, 80), limit = _num(c.limit, 0, 1e10), balance = _num(c.balance, 0, 1e10);
  if (!bank || !bank.trim() || nick === null || limit === null || balance === null) return null;
  var out = { id: safeId(c.id) || uid(), bank: bank, nick: nick, limit: limit, balance: balance, color: CARD_THEMES[c.color] ? c.color : 'teal' };
  out.issuer = SL_CARD_ISSUERS[c.issuer] ? c.issuer : resolveIssuer(bank);
  _pick(c, out, 'apr', _num(c.apr, 0, 100));
  if (c.isZeroPercent) out.isZeroPercent = true;
  _pick(c, out, 'minPct', _num(c.minPct, 0.001, 1));
  _pick(c, out, 'minFloor', _num(c.minFloor, 0, 1e7));
  if (isValidDay(c.statementDay)) out.statementDay = parseInt(c.statementDay, 10);
  if (isValidDay(c.dueDay)) out.dueDay = parseInt(c.dueDay, 10);
  _pick(c, out, 'targetPayment', _num(c.targetPayment, 0.01, 1e10));
  if (/^\d{4}$/.test(c.last4 || '')) out.last4 = c.last4;
  _pick(c, out, 'cycleTrackedFrom', _ymdOrNull(c.cycleTrackedFrom));
  out.ledger = (Array.isArray(c.ledger) ? c.ledger.slice(0, 6000) : []).map(cleanEntry).filter(Boolean);
  out.recurring = (Array.isArray(c.recurring) ? c.recurring.slice(0, 100) : []).map(cleanRecurring).filter(Boolean);
  if (c.budgets && typeof c.budgets === 'object') {
    out.budgets = {};
    SPEND_CATEGORIES.forEach(function (k) { var v = _num(c.budgets[k.key], 0.01, 1e9); if (v !== null) out.budgets[k.key] = v; });
  }
  if (Array.isArray(c.statements)) out.statements = c.statements.slice(-12).map(function (s) {
    if (!s || !_ymdOrNull(s.date) || !_ymdOrNull(s.due)) return null;
    var o = { date: s.date, due: s.due, balance: _num(s.balance, 0, 1e10) || 0, minDue: _num(s.minDue, 0, 1e10) || 0 };
    if (s.answered === 'no') o.answered = 'no';
    return o;
  }).filter(Boolean);
  if (c.ledgerArchive && typeof c.ledgerArchive === 'object') {
    out.ledgerArchive = {};
    Object.keys(c.ledgerArchive).slice(0, 600).forEach(function (m) {
      var a = c.ledgerArchive[m];
      if (!/^\d{4}-\d{2}$/.test(m) || !a || typeof a !== 'object') return;
      var by = {};
      if (a.byCategory && typeof a.byCategory === 'object') SPEND_CATEGORIES.forEach(function (k) { var v = _num(a.byCategory[k.key]); if (v !== null) by[k.key] = v; });
      out.ledgerArchive[m] = { spent: _num(a.spent) || 0, payments: _num(a.payments) || 0, byCategory: by };
    });
  }
  return out;
}
function cleanSpace(s) {
  if (!s || typeof s !== 'object') return null;
  var name = _str(s.name, 60), target = _num(s.targetLKR, 0, 1e10), cur = _num(s.currentLKR, 0, 1e10);
  if (!name || !name.trim() || target === null || cur === null) return null;
  var out = { id: safeId(s.id) || String(Date.now()), name: name, targetLKR: target, currentLKR: cur, targetDate: _ymdOrNull(s.targetDate) || '', color: _str(s.color, 20) || 'emerald' };
  out.history = (Array.isArray(s.history) ? s.history.slice(0, 3000) : []).map(function (h) {
    if (!h || ['deposit', 'withdraw', 'card-payment'].indexOf(h.type) === -1 || !_ymdOrNull(h.date) || _num(h.amount, 0, 1e10) === null) return null;
    var o = { id: safeId(h.id) || uid(), date: h.date, type: h.type, amount: Number(h.amount) };
    _pick(h, o, 'note', _str(h.note, 60));
    _pick(h, o, 'createdAt', _num(h.createdAt, 0));
    if (h.cardId) o.cardId = safeId(h.cardId);
    if (h.ledgerId) o.ledgerId = safeId(h.ledgerId);
    return o;
  }).filter(Boolean);
  return out;
}
// Returns { ok, error?, data: { exportedAt, profile, cards, spaces }, entries }
function readBackup(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'This file isn\u2019t a Serendib backup.' };
  var legacy = obj.app === undefined && Array.isArray(obj.cards);
  if (!legacy && obj.app !== 'serendib') return { ok: false, error: 'This file isn\u2019t a Serendib backup.' };
  if (!legacy && !(Number(obj.version) >= 1)) return { ok: false, error: 'This backup\u2019s format isn\u2019t recognised.' };
  if (!legacy && Number(obj.version) > BACKUP_VERSION) return { ok: false, error: 'This backup was made by a newer version of Serendib. Update the app and try again.' };
  var rawCards = Array.isArray(obj.cards) ? obj.cards : [], rawSpaces = Array.isArray(obj.spaces) ? obj.spaces : [];
  if (rawCards.length > 50 || rawSpaces.length > 50) return { ok: false, error: 'This backup has more cards or spaces than Serendib supports.' };
  var cards = rawCards.map(cleanCard).filter(Boolean), spaces = rawSpaces.map(cleanSpace).filter(Boolean);
  if (cards.length < rawCards.length || spaces.length < rawSpaces.length) return { ok: false, error: 'Some cards or spaces in this backup are damaged, so nothing was restored.' };
  var seen = {};
  cards.forEach(function (c) { if (seen[c.id]) c.id = uid(); seen[c.id] = true; });
  var p = legacy ? obj : (obj.profile || {}), profile = {};
  _pick(p, profile, 'firstName', _str(p.firstName, 60));
  _pick(p, profile, 'lastName', _str(p.lastName, 60));
  var inc = _num(p.income, 0, 1e10);
  if (inc !== null) profile.income = String(inc);
  if (p.strategy === 'avalanche' || p.strategy === 'snowball') profile.strategy = p.strategy;
  var data = { exportedAt: _str(obj.exportedAt, 40) || '', profile: profile, cards: cards, spaces: spaces };
  if (JSON.stringify(data).length > 900000) return { ok: false, error: 'This backup is too large to restore (over 900 KB).' };
  var entries = cards.reduce(function (n, c) { return n + c.ledger.length; }, 0);
  return { ok: true, data: data, entries: entries };
}

/* ── Account sync: merge two copies of an account so no device can wipe another's data ──
   Cards and spaces merge by id. When both copies have an item, the one edited most recently
   (updatedAt) wins. An item is only removed when a device deleted it on purpose (a tombstone in
   deletedCards / deletedSpaces), so a new or empty device can never remove anything.
   Name, income and strategy carry their own edit times (fieldTimes); values filled in by default
   (defaults: { field: true }) never override a value the user actually set. */
var SYNC_FIELDS = ['firstName', 'lastName', 'income', 'strategy'];
var TOMBSTONE_DAYS = 180;
function syncFilled(v) { return v !== undefined && v !== null && v !== ''; }
// Signature of an item's content, ignoring its edit time
function syncSig(item) {
  var had = Object.prototype.hasOwnProperty.call(item, 'updatedAt'), u = item.updatedAt;
  delete item.updatedAt;
  var s = JSON.stringify(item);
  if (had) item.updatedAt = u;
  return s;
}
function mergeTombstones(a, b, now) {
  var out = {}, cutoff = (now || Date.now()) - TOMBSTONE_DAYS * 86400000;
  [a, b].forEach(function (t) {
    if (!t || typeof t !== 'object') return;
    Object.keys(t).forEach(function (id) {
      var ts = Number(t[id]) || 0;
      if (ts > cutoff && ts > (out[id] || 0)) out[id] = ts;
    });
  });
  return out;
}
// primary's order first; on equal edit times the primary copy is kept
function mergeItems(primary, secondary, tombs) {
  var byId = {}, order = [];
  function add(item) {
    if (!item || typeof item !== 'object' || item.id === undefined || item.id === null) return;
    var id = String(item.id), cur = byId[id];
    if (!cur) { byId[id] = item; order.push(id); return; }
    if ((Number(item.updatedAt) || 0) > (Number(cur.updatedAt) || 0)) byId[id] = item;
  }
  (primary || []).forEach(add);
  (secondary || []).forEach(add);
  return order.map(function (id) { return byId[id]; }).filter(function (item) {
    var ts = tombs[String(item.id)] || 0;
    return !(ts > 0 && ts >= (Number(item.updatedAt) || 0));
  });
}
function mergeOnboarding(a, b) {
  if (!a || typeof a !== 'object') return b || {};
  if (!b || typeof b !== 'object') return a;
  var out = Object.assign({}, a, b);
  ['welcomeDone', 'checklistDismissed', 'checklistCompleted', 'simulatorTried'].forEach(function (k) { if (a[k] || b[k]) out[k] = true; });
  out.version = Math.max(Number(a.version) || 0, Number(b.version) || 0) || undefined;
  if (out.version === undefined) delete out.version;
  out.tipsSeen = Object.assign({}, a.tipsSeen || {}, b.tipsSeen || {});
  Object.keys(out.tipsSeen).forEach(function (k) { out.tipsSeen[k] = !!((a.tipsSeen || {})[k] || (b.tipsSeen || {})[k]); });
  return out;
}
function mergeAccount(a, b, now) {
  if (!a && !b) return null;
  if (!a) return Object.assign({}, b);
  if (!b) return Object.assign({}, a);
  now = now || Date.now();
  var la = Number(a.lastUpdated) || 0, lb = Number(b.lastUpdated) || 0;
  var aNewer = la >= lb, newer = aNewer ? a : b, older = aNewer ? b : a;
  var out = Object.assign({}, older, newer);
  var dc = mergeTombstones(a.deletedCards, b.deletedCards, now), ds = mergeTombstones(a.deletedSpaces, b.deletedSpaces, now);
  out.cards = mergeItems(newer.cards, older.cards, dc);
  out.spaces = mergeItems(newer.spaces, older.spaces, ds);
  out.deletedCards = dc;
  out.deletedSpaces = ds;
  var fa = a.fieldTimes || {}, fb = b.fieldTimes || {}, ft = {};
  var weight = function (d) { return (d.cards || []).length + (d.spaces || []).length; };
  var real = function (d, k) { return syncFilled(d[k]) && !(d.defaults && d.defaults[k]); };
  var dflt = {};
  SYNC_FIELDS.forEach(function (k) {
    var ta = Number(fa[k]) || 0, tb = Number(fb[k]) || 0, pickA;
    if (ta !== tb) pickA = ta > tb;
    else if (real(a, k) !== real(b, k)) pickA = real(a, k); // a default never beats a value the user set
    else if (!syncFilled(a[k]) || !syncFilled(b[k])) pickA = syncFilled(a[k]);
    else if (weight(a) !== weight(b)) pickA = weight(a) > weight(b); // neither edited: trust the copy holding real data
    else pickA = aNewer;
    var v = pickA ? a[k] : b[k];
    if (v === undefined) delete out[k]; else out[k] = v;
    if (Math.max(ta, tb)) ft[k] = Math.max(ta, tb);
    var src = pickA ? a : b;
    if (src.defaults && src.defaults[k]) dflt[k] = true;
  });
  out.fieldTimes = ft;
  if (Object.keys(dflt).length) out.defaults = dflt; else delete out.defaults;
  out.onboarding = mergeOnboarding(a.onboarding, b.onboarding);
  out.hasCompletedTour = !!(a.hasCompletedTour || b.hasCompletedTour);
  out.lastUpdated = Math.max(la, lb);
  return out;
}

// Safety net: each device keeps its last few copies of the account's cards and spaces
var SAFETY_MAX = 5;
function readSafetyCopies(uid) {
  try { var l = JSON.parse(localStorage.getItem('serendib_safety_' + uid) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}
function saveSafetyCopy(uid, doc, reason) {
  if (!uid || !doc || !((doc.cards || []).length || (doc.spaces || []).length)) return;
  var list = readSafetyCopies(uid);
  var sig = JSON.stringify([(doc.cards || []).map(function (c) { return c.id + ':' + c.balance + ':' + ((c.ledger || []).length); }),
    (doc.spaces || []).map(function (s) { return s.id + ':' + s.currentLKR; })]);
  if (list.length && list[0].sig === sig) return;
  list.unshift({ at: Date.now(), sig: sig, reason: reason || '',
    data: { firstName: doc.firstName || '', lastName: doc.lastName || '', income: doc.income || '', strategy: doc.strategy || '',
      cards: JSON.parse(JSON.stringify(doc.cards || [])), spaces: JSON.parse(JSON.stringify(doc.spaces || [])) } });
  // Keep as many recent copies as storage allows
  for (var keep = SAFETY_MAX; keep >= 1; keep--) {
    try { localStorage.setItem('serendib_safety_' + uid, JSON.stringify(list.slice(0, keep))); return; } catch (e) {}
  }
}

/* DEFAULT SEED DATA */
var DEFAULT_CARDS = [
  { bank: "Commercial Bank of Ceylon", nick: "Visa Gold", limit: 300000, balance: 125000, color: "teal" },
  { bank: "Hatton National Bank", nick: "Platinum", limit: 550000, balance: 285000, color: "rose" },
  { bank: "Sampath Bank", nick: "Ultramiles", limit: 200000, balance: 122000, color: "amber" }
];

export {
  APR,
  BACKUP_VERSION,
  CARD_THEMES,
  CA_FEE_MIN,
  CA_FEE_PCT,
  DAILY_RATE,
  DEFAULT_CARDS,
  LEDGER_SOURCES,
  LEDGER_TYPES,
  LS_KEY,
  MIN_PMT_FLOOR,
  MIN_PMT_PCT,
  MONTHLY_RATE,
  RECURRING_SUGGESTIONS,
  SAFETY_MAX,
  SL_CARD_ISSUERS,
  SL_ISSUER_CARDS,
  SL_ISSUER_NOTES,
  SMS_MONTHS,
  SPEND_CATEGORIES,
  SYNC_FIELDS,
  TOMBSTONE_DAYS,
  _num,
  _pick,
  _str,
  _ymdOrNull,
  addDays,
  allocateMonthlyPayments,
  applyLedgerEffect,
  archiveOldLedger,
  balanceAt,
  bankSuggestions,
  billingPeriod,
  calcCashAdvance,
  calcMinPayoff,
  calcPayoff,
  calcSurchargeAPR,
  calculateCBSLAmortization,
  calculateNextStatement,
  cardApr,
  cardFee,
  cardFloor,
  cardIssuer,
  cardMinRule,
  cardName,
  cardTheme,
  cashAdvanceApr,
  clampDay,
  cleanCard,
  cleanEntry,
  cleanRecurring,
  cleanSpace,
  computeAdvanceFee,
  computeMonthlyBudget,
  cycleStatus,
  dayToLocalDateStr,
  daysBetween,
  dueDateFor,
  ensureSpaceHistory,
  fmtLKR,
  fmtMonths,
  fmtPct,
  getStrategy,
  getUserIncome,
  highlightMatch,
  isRealYmd,
  isValidDay,
  issuerNetworks,
  lastStatementOnOrBefore,
  localDateStrToDay,
  mergeAccount,
  mergeItems,
  mergeOnboarding,
  mergeTombstones,
  minPaymentFor,
  nextDueDayFrom,
  nextStatementAfter,
  parseBankSms,
  parseYmd,
  periodSummary,
  postDueRecurringOnCard,
  rankSuggestions,
  readBackup,
  readSafetyCopies,
  recordStatements,
  recurringDueDates,
  recurringNextDue,
  resolveIssuer,
  safeId,
  saveSafetyCopy,
  spaceMonthlyNeeded,
  spaceMonthsLeft,
  spaceRecentPace,
  spendCategory,
  statementDatesBetween,
  statementWhenText,
  suggestEscape,
  suggestNorm,
  syncFilled,
  syncSig,
  tierSuggestions,
  uid,
  ymd
};
