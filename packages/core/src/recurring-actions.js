// Recurring charges, statement cycles, "match my statement" and the monthly plan amount.
// Moved from the App closure in index.html (Phase 1). Data changes only; each UI shows its own messages.
import {
  uid, ymd, addDays, clampDay, isValidDay, isRealYmd, postDueRecurringOnCard, archiveOldLedger,
  lastStatementOnOrBefore, dueDateFor, recordStatements, cycleStatus, minPaymentFor, cardApr,
  getStrategy, allocateMonthlyPayments, computeMonthlyBudget
} from './domain.js';
import { afterBalanceChange, findRecurring, removeEntry, logSystemEntry } from './ledger-actions.js';

function findCardIn(cards, id) {
  if (id === null || id === undefined) return null;
  return cards.find(function (c) { return String(c.id) === String(id); }) || null;
}

// Post this card's due recurring charges: [{ cardId, entry, item }]
export function postRecurringNow(card) {
  var posted = postDueRecurringOnCard(card, ymd(new Date())).map(function (p) { return { cardId: card.id, entry: p.entry, item: p.item }; });
  if (posted.length) afterBalanceChange(card);
  return posted;
}

// Undo posted charges; each month undone is skipped so it isn't posted again
export function skipPostedCharges(cards, spaces, posted) {
  posted.forEach(function (p) {
    var card = findCardIn(cards, p.cardId);
    if (!card || !removeEntry(card, spaces, p.entry.id)) return;
    var item = findRecurring(card, p.item.id);
    if (item) {
      if (!Array.isArray(item.skipped)) item.skipped = [];
      var month = p.entry.date.slice(0, 7);
      if (item.skipped.indexOf(month) === -1) item.skipped.push(month);
    }
  });
}

// Daily housekeeping on every card: archive old entries, post due charges, record statements.
// Returns { posted, changed }; changed is true when anything needs saving.
export function runDueRecurring(cards, today) {
  var posted = [], archived = false, cycles = false;
  cards.forEach(function (c) {
    if (archiveOldLedger(c, today)) archived = true;
    posted = posted.concat(postRecurringNow(c));
    if (refreshCycles(c, today)) cycles = true;
  });
  return { posted: posted, changed: !!(posted.length || archived || cycles) };
}

// Add (no itemId) or edit a recurring charge.
//   input: { name, amount (parsed), day, end, category, chargeNow() } (chargeNow is only asked when the day has passed)
// Returns { error } | { gone: true } | { item, posted, editing }
export function saveRecurringItem(card, itemId, input) {
  var name = String(input.name || '').trim().slice(0, 40);
  var amount = input.amount, day = input.day, end = input.end, category = input.category;
  var now = new Date(), today = ymd(now);
  if (!name) return { error: 'Enter a name, e.g. Netflix.' };
  if (!(amount > 0)) return { error: 'Enter the monthly amount.' };
  if (!isValidDay(day)) return { error: 'Day of month must be between 1 and 31.' };
  if (end && (!isRealYmd(end) || end < today)) return { error: 'The end date can’t be in the past.' };
  if (!Array.isArray(card.recurring)) card.recurring = [];
  var item;
  if (itemId) {
    item = findRecurring(card, itemId);
    if (!item) return { gone: true };
    item.name = name;
    item.amount = amount;
    item.category = category;
    item.day = day;
    item.endDate = end || null;
    return { item: item, posted: item.paused ? [] : postRecurringNow(card), editing: true, name: name };
  }
  var eff = clampDay(now.getFullYear(), now.getMonth(), day);
  var startDate;
  if (eff > now.getDate()) startDate = today;
  else if (input.chargeNow && input.chargeNow()) startDate = ymd(new Date(now.getFullYear(), now.getMonth(), eff));
  else startDate = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  item = { id: uid(), name: name, amount: amount, category: category, day: day, startDate: startDate, endDate: end || null,
    paused: false, cancelled: false, lastPosted: null, skipped: [], createdAt: Date.now() };
  card.recurring.push(item);
  return { item: item, posted: postRecurringNow(card), editing: false, name: name };
}

// Pause or resume. Months skipped while paused are never back-filled. Returns { item, posted } or null
export function toggleRecurringPaused(card, itemId) {
  var item = card && findRecurring(card, itemId);
  if (!item) return null;
  item.paused = !item.paused;
  if (!item.paused) item.startDate = ymd(new Date());
  return { item: item, posted: item.paused ? [] : postRecurringNow(card) };
}

// Cancel from today; returns { item, prevEnd } (for Undo) or null
export function cancelRecurringItem(card, itemId) {
  var item = card && findRecurring(card, itemId);
  if (!item) return null;
  var prevEnd = item.endDate || null;
  item.cancelled = true;
  item.endDate = ymd(new Date());
  return { item: item, prevEnd: prevEnd };
}
export function uncancelRecurringItem(card, itemId, prevEnd) {
  var it = card && findRecurring(card, itemId);
  if (!it) return false;
  it.cancelled = false;
  it.endDate = prevEnd;
  return true;
}

// Match my statement: log the difference as an adjustment.
// Returns { error } | { same: true } | { entry }
export function matchStatement(card, value) {
  if (!isFinite(value) || value < 0) return { error: 'Enter the balance shown on your statement.' };
  var d = Math.round((value - card.balance) * 100) / 100;
  if (d === 0) return { same: true };
  var entry = logSystemEntry(card, 'adjustment', d, 'Matched to statement');
  afterBalanceChange(card);
  return { entry: entry };
}

// Start tracking from the cycle still awaiting payment, so older cycles are never flagged
export function initCycleTracking(card, todayStr) {
  if (!isValidDay(card.statementDay) || !isValidDay(card.dueDay)) { delete card.cycleTrackedFrom; return; }
  var last = lastStatementOnOrBefore(card.statementDay, todayStr);
  card.cycleTrackedFrom = dueDateFor(last, card.dueDay) >= todayStr ? last : addDays(todayStr, 1);
}
export function refreshCycles(card, todayStr) {
  var changed = false;
  if (isValidDay(card.statementDay) && isValidDay(card.dueDay) && !card.cycleTrackedFrom) { initCycleTracking(card, todayStr); changed = true; }
  return recordStatements(card, todayStr) || changed;
}

// This card's monthly amount in the current plan (same order and budget as Cards Overview)
export function planAllocationFor(cards, card) {
  var active = cards.filter(function (c) { return c.balance > 0; });
  if (getStrategy() === 'snowball') active.sort(function (a, b) { return a.balance - b.balance; });
  else active.sort(function (a, b) { var d = cardApr(b) - cardApr(a); return d !== 0 ? d : a.balance - b.balance; });
  return allocateMonthlyPayments(active, computeMonthlyBudget(cards)).alloc[card.id] || 0;
}
// What is owed now on a card: overdue catch-up first, else the next unpaid minimum
export function amountDueNow(card) {
  var st = cycleStatus(card, ymd(new Date()));
  if (st && st.overdue) return st.overdue.amount + (st.next ? st.next.remaining : 0);
  if (st && st.next) return st.next.remaining;
  if (st) return 0;
  return minPaymentFor(card);
}
