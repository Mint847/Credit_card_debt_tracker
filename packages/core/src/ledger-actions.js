// Spending ledger actions: log, edit, delete and undo entries, and payments made from a space.
// Moved from the App closure in index.html (Phase 1). These only change data and report back;
// each UI shows its own messages, toasts and sheets.
import { uid, ymd, isRealYmd, applyLedgerEffect, billingPeriod, periodSummary, spendCategory, ensureSpaceHistory, fmtLKR } from './domain.js';

function fmtAmt(n) { return fmtLKR(n, Math.round(n * 100) % 100 ? 2 : 0); }

export function entryLabel(e) {
  if (e.merchant) return e.merchant;
  if (e.type === 'payment') return 'Payment';
  if (e.type === 'refund') return 'Refund';
  if (e.type === 'adjustment') return e.note || 'Balance adjustment';
  return spendCategory(e.category).label;
}
export function sortedLedger(card) {
  return (card.ledger || []).slice().sort(function (a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0);
  });
}
export function isCancelled(r, today) { return !!r.cancelled || !!(r.endDate && r.endDate < today); }
export function activeRecurring(card, today) {
  return (card.recurring || []).filter(function (r) { return !isCancelled(r, today); });
}
export function monthlyRecurringTotal(card, today) {
  return activeRecurring(card, today).filter(function (r) { return !r.paused; })
    .reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
}
export function findEntry(card, id) {
  return (card.ledger || []).filter(function (e) { return e.id === id; })[0] || null;
}
export function findRecurring(card, id) {
  return (card.recurring || []).filter(function (r) { return r.id === id; })[0] || null;
}
// Keep a saved monthly target within the balance, as Edit Card does
export function afterBalanceChange(card) {
  if (!(card.balance > 0)) delete card.targetPayment;
  else if (card.targetPayment && card.targetPayment > card.balance) card.targetPayment = card.balance;
}
// Entries made by the app itself (Clear Balance, Edit Card balance, Match my statement)
export function logSystemEntry(card, type, amount, note) {
  if (!Array.isArray(card.ledger)) card.ledger = [];
  var entry = { id: uid(), date: ymd(new Date()), type: type, amount: Math.round(amount * 100) / 100, note: note, source: 'system', createdAt: Date.now() };
  applyLedgerEffect(card, entry, 1);
  card.ledger.push(entry);
  return entry;
}
// A payment made from a space: removing it puts the money back in the space
export function unlinkSpacePayment(spaces, entry) {
  if (!entry || !entry.spaceId) return null;
  var space = spaces.find(function (s) { return String(s.id) === String(entry.spaceId); });
  if (!space || !Array.isArray(space.history)) return null;
  var idx = space.history.findIndex(function (h) { return h.ledgerId === entry.id; });
  if (idx === -1) return null;
  var h = space.history.splice(idx, 1)[0];
  space.currentLKR = Math.round(((Number(space.currentLKR) || 0) + (Number(h.amount) || 0)) * 100) / 100;
  return { spaceId: space.id, item: h, index: idx };
}
export function relinkSpacePayment(spaces, link) {
  if (!link) return;
  var space = spaces.find(function (s) { return String(s.id) === String(link.spaceId); });
  if (!space) return;
  ensureSpaceHistory(space);
  space.history.splice(Math.min(link.index, space.history.length), 0, link.item);
  space.currentLKR = Math.round(((Number(space.currentLKR) || 0) - (Number(link.item.amount) || 0)) * 100) / 100;
}
export function removeEntry(card, spaces, id) {
  var i = (card.ledger || []).findIndex(function (e) { return e.id === id; });
  if (i === -1) return null;
  var e = card.ledger[i];
  applyLedgerEffect(card, e, -1);
  card.ledger.splice(i, 1);
  afterBalanceChange(card);
  return { entry: e, index: i, link: unlinkSpacePayment(spaces, e) };
}
// Put a deleted entry back where it was (the Undo after a delete)
export function restoreEntry(card, spaces, removed) {
  if (!Array.isArray(card.ledger)) card.ledger = [];
  applyLedgerEffect(card, removed.entry, 1);
  card.ledger.splice(Math.min(removed.index, card.ledger.length), 0, removed.entry);
  relinkSpacePayment(spaces, removed.link);
  afterBalanceChange(card);
}

// Log a new entry or save an edited one.
//   input: { type, amount, date, merchant, note, category, editingId, fromSms }, amount already parsed (NaN if invalid)
// Returns { error } when the input can't be saved (nothing is changed), otherwise
// { entry, editing, warn }; warn is at most one message (over limit, budget, utilisation step).
export function saveEntry(card, spaces, input) {
  var type = input.type, isAdj = type === 'adjustment';
  var amt = input.amount, date = input.date;
  var today = ymd(new Date());
  if (!isFinite(amt) || (isAdj ? amt === 0 : amt <= 0)) return { error: 'Enter an amount.' };
  if (Math.abs(amt) > 100000000) return { error: 'That amount looks too large.' };
  if (!isRealYmd(date)) return { error: 'Pick a date.' };
  if (date > today) return { error: 'The date can’t be in the future.' };
  var hasCat = type === 'purchase' || type === 'refund';
  var merchant = hasCat ? String(input.merchant || '').trim().slice(0, 60) : '';
  var note = String(input.note || '').trim().slice(0, 80);
  if (!Array.isArray(card.ledger)) card.ledger = [];

  var period = billingPeriod(card, today);
  var cat = input.category;
  var budget = Number((card.budgets || {})[cat]) || 0;
  var catBefore = periodSummary(card, period).byCat[cat] || 0;
  var utilBefore = card.limit > 0 ? card.balance / card.limit * 100 : 0;

  var entry;
  if (input.editingId) {
    entry = findEntry(card, input.editingId);
    if (!entry) return { gone: true };
    if (entry.spaceId) {
      var linkSpace = spaces.find(function (s) { return String(s.id) === String(entry.spaceId); });
      var linkItem = linkSpace && (linkSpace.history || []).find(function (h) { return h.ledgerId === entry.id; });
      if (linkItem && type === 'payment') {
        var diff = Math.round((amt - (Number(linkItem.amount) || 0)) * 100) / 100;
        if (diff > (Number(linkSpace.currentLKR) || 0) + 0.001) return { error: linkSpace.name + ' only has ' + fmtAmt(Number(linkSpace.currentLKR) || 0) + ' left to cover this.' };
        linkItem.amount = amt;
        linkItem.date = date;
        linkSpace.currentLKR = Math.round(((Number(linkSpace.currentLKR) || 0) - diff) * 100) / 100;
      } else if (linkItem) {
        unlinkSpacePayment(spaces, entry);
        delete entry.spaceId;
      }
    }
    applyLedgerEffect(card, entry, -1);
    entry.type = type;
    entry.amount = amt;
    entry.date = date;
    entry.merchant = merchant;
    entry.note = note;
    if (hasCat) entry.category = cat; else delete entry.category;
    entry.editedAt = Date.now();
    applyLedgerEffect(card, entry, 1);
  } else {
    entry = { id: uid(), date: date, type: type, amount: amt, merchant: merchant, note: note, source: input.fromSms ? 'sms' : 'manual', createdAt: Date.now() };
    if (hasCat) entry.category = cat;
    applyLedgerEffect(card, entry, 1);
    card.ledger.push(entry);
  }
  afterBalanceChange(card);

  // One warning at most: over limit, then budget, then a utilisation step crossed this period
  var warn = '';
  if (type === 'purchase' && card.limit > 0 && card.balance > card.limit) {
    warn = 'The card is now over its ' + fmtAmt(card.limit) + ' limit.';
  }
  if (!warn && type === 'purchase' && budget > 0 && date >= period.start) {
    var catAfter = periodSummary(card, period).byCat[cat] || 0;
    var label = spendCategory(cat).label;
    if (catBefore <= budget && catAfter > budget) warn = label + ' is over its ' + fmtAmt(budget) + ' budget.';
    else if (catBefore < budget * 0.8 && catAfter >= budget * 0.8) warn = 'You’ve used ' + Math.round(catAfter / budget * 100) + '% of your ' + label + ' budget.';
  }
  if (!warn && card.limit > 0) {
    var utilAfter = card.balance / card.limit * 100;
    var step = [90, 75, 30].filter(function (t) { return utilBefore < t && utilAfter >= t; })[0];
    if (step) {
      if (!card.utilAlerts || card.utilAlerts.period !== period.start) card.utilAlerts = { period: period.start, shown: [] };
      if (card.utilAlerts.shown.indexOf(step) === -1) {
        card.utilAlerts.shown.push(step);
        warn = 'This card is now at ' + Math.round(utilAfter) + '% of its limit' + (step === 30 ? ' (aim for under 30%).' : '.');
      }
    }
  }
  return { entry: entry, editing: !!input.editingId, warn: warn, merchant: merchant };
}
