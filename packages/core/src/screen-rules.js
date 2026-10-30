// Small rules both apps' screens share: reading amounts typed in, dates and ordinals as shown,
// category budgets, the history CSV, the share text and the recurring-payment hints.
// Moved from the App closure in index.html (Phase 3).
import { parseYmd, ymd, addDays, balanceAt, cardName, clampDay, isValidDay, spendCategory, SPEND_CATEGORIES, spaceMonthsLeft, spaceMonthlyNeeded, spaceRecentPace, minPaymentFor } from './domain.js';
import { amountDueNow } from './recurring-actions.js';
import { cardDebtFreeDate, monthYear } from './plan.js';
import { isCancelled, sortedLedger } from './ledger-actions.js';

// "LKR 12,500.50" / "12500" → 12500.5; anything else → NaN
export function parseAmountInput(v) {
  var t = String(v == null ? '' : v).replace(/^\s*LKR/i, '').replace(/[,\s]/g, '');
  if (!/^-?\d*\.?\d+$/.test(t)) return NaN;
  return Math.round(parseFloat(t) * 100) / 100;
}

// "24 Oct"
export function shortDate(s) {
  var d = parseYmd(s);
  return d.getDate() + ' ' + d.toLocaleString('en-US', { month: 'short' });
}

// 1st, 2nd, 3rd, 11th, 22nd
export function ordinal(n) {
  var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// raw: { category key: text typed }. Blank means no budget. Returns { error } (the first bad
// category, in the category order) or { budgets }.
export function budgetsFromInputs(raw) {
  var next = {}, bad = null;
  SPEND_CATEGORIES.forEach(function (c) {
    var text = raw[c.key];
    if (text === undefined || !String(text).trim()) return;
    var v = parseAmountInput(text);
    if (!(v > 0)) bad = bad || c.label;
    else next[c.key] = v;
  });
  if (bad) return { error: 'Enter a valid amount for ' + bad + ', or leave it blank.' };
  return { budgets: next };
}

function csvCell(v) {
  var s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // keep spreadsheet apps from running it as a formula
  return '"' + s.replace(/"/g, '""') + '"';
}
// A card's history as CSV (the phone app's Export CSV)
export function ledgerCsv(card) {
  var rows = [['Date', 'Type', 'Amount (LKR)', 'Category', 'Merchant', 'Note', 'Source'].map(csvCell).join(',')];
  sortedLedger(card).forEach(function (e) {
    rows.push([csvCell(e.date), csvCell(e.type), String(Number(e.amount) || 0), csvCell(e.category ? spendCategory(e.category).label : ''),
      csvCell(e.merchant || ''), csvCell(e.note || ''), csvCell(e.source || '')].join(','));
  });
  return rows.join('\r\n');
}
export function ledgerCsvFileName(card, todayStr) {
  return 'serendib-' + cardName(card).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + todayStr + '.csv';
}

// Share progress: utilisation and debt-free month only; no amounts, limits or bank details
export function shareText(cards, card) {
  var intro = 'My credit card progress on Serendib: ';
  if (!(card.balance > 0)) return intro + 'this card is fully paid off.';
  var util = card.limit > 0 ? Math.round(card.balance / card.limit * 100) : null;
  var line = util === null ? 'paying it down' : util + '% of my limit used';
  var monthAgo = addDays(ymd(new Date()), -30);
  if (util !== null && (card.ledger || []).some(function (e) { return e.date > monthAgo; })) {
    var then = Math.round(balanceAt(card, monthAgo) / card.limit * 100);
    if (then > util) line += ' (down from ' + then + '% last month)';
    else if (then < util) line += ' (up from ' + then + '% last month)';
  }
  // The month the payoff plan clears this card (money freed by cleared cards moves on to it)
  var d = cardDebtFreeDate(cards, card);
  return intro + line + '.' + (d ? ' On track to be debt-free by ' + monthYear(d) + '.' : '');
}

// The line at the top of an existing recurring payment's form
export function recurringStatusText(item, todayStr, nextDue) {
  if (isCancelled(item, todayStr)) return 'Cancelled' + (item.endDate ? ' on ' + shortDate(item.endDate) : '') + '. Past charges stay in your history.';
  if (item.paused) return 'Paused. Nothing is logged until you resume it.';
  return nextDue ? 'Next charge on ' + shortDate(nextDue) + '. Changes apply from the next charge.' : 'No more charges before the end date.';
}
// "Logged on the 31st of each month, or the last day in shorter months."
export function recurringDayHint(day) {
  var d = parseInt(day, 10);
  if (!isValidDay(d)) return '';
  return 'Logged on the ' + ordinal(d) + ' of each month' + (d > 28 ? ', or the last day in shorter months.' : '.');
}
// When a new recurring payment's day has already passed this month: that day's date (to offer
// "Add this month's charge now"); otherwise null
export function chargeNowDate(day, now) {
  var d = parseInt(day, 10);
  if (!isValidDay(d)) return null;
  now = now || new Date();
  var eff = clampDay(now.getFullYear(), now.getMonth(), d);
  return eff > now.getDate() ? null : ymd(new Date(now.getFullYear(), now.getMonth(), eff));
}

// Match my statement: what the new balance would change
export function matchDiffText(card, value, fmt) {
  var d = Math.round((value - card.balance) * 100) / 100;
  if (!isFinite(value)) return 'The app shows ' + fmt(card.balance) + '.';
  return d === 0 ? 'Already matches.' : (d > 0 ? 'Adds ' : 'Reduces the balance by ') + fmt(Math.abs(d)) + '.';
}

// The monthly target a card's payoff slider allows: from its minimum to just over the balance
export function targetRange(minPayment, balance) {
  return { min: Math.floor(minPayment), max: Math.ceil(balance * 1.05 + 1) };
}

/* Spaces */
// The line under a space's progress: goal reached, on track, or how far behind
// (tone 'ok' or 'warn'; the phone shows them in green or amber)
export function spaceStatusLine(s, todayStr, fmt) {
  var cur = Number(s.currentLKR) || 0, target = Number(s.targetLKR) || 0;
  if (target > 0 && cur >= target) return { text: 'Goal reached', tone: 'ok' };
  var months = spaceMonthsLeft(s.targetDate, todayStr), need = spaceMonthlyNeeded(s, todayStr), pace = spaceRecentPace(s, todayStr);
  if (!months) return { text: 'Target date passed · ' + fmt(target - cur) + ' to go', tone: 'warn' };
  var line = fmt(Math.ceil(need)) + ' a month for ' + months + (months === 1 ? ' month' : ' months');
  if (pace >= need - 0.5) return { text: line + ' · on track', tone: 'ok' };
  return { text: line + (pace > 0 ? ' · you’re adding about ' + fmt(Math.round(pace)) + ' a month' : ' · no deposits in the last 3 months'), tone: 'warn' };
}
// A history row's label and icon; `out` is money leaving the space
export function spaceHistoryLabel(h) {
  return {
    label: h.type === 'deposit' ? (h.note || 'Deposit') : h.type === 'withdraw' ? (h.note || 'Withdrawal') : 'Paid a card',
    icon: h.type === 'deposit' ? 'south_west' : h.type === 'withdraw' ? 'north_east' : 'credit_card',
    out: h.type !== 'deposit'
  };
}
// Newest first (same day: most recently made first)
export function sortedSpaceHistory(s) {
  return (s.history || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0); });
}
// Pay a card from a space: the cards that owe something, which to suggest (most due now) and how much
export function spacePayOptions(space, cards) {
  var owing = cards.filter(function (c) { return c.balance > 0; });
  var have = Number(space.currentLKR) || 0;
  var pick = owing.slice().sort(function (a, b) { return amountDueNow(b) - amountDueNow(a); })[0] || null;
  return {
    owing: owing, pick: pick,
    suggest: function (c) { var due = amountDueNow(c); return Math.round(Math.min(have, due > 0 ? due : c.balance) * 100) / 100; },
    hint: function (c, fmt) { var due = amountDueNow(c); return (due > 0 ? fmt(due) + ' due now · ' : '') + fmt(c.balance) + ' balance'; }
  };
}

// Debt-to-income: card minimums as a share of monthly income (tone: up to 20% ok, 40% warn, above danger)
export function debtToIncome(cards, incomeStr) {
  var income = parseFloat(String(incomeStr == null ? '175000' : incomeStr));
  if (isNaN(income)) income = 0;
  var totalMin = 0;
  cards.forEach(function (c) { if (c.balance > 0) totalMin += minPaymentFor(c); });
  var pct = income > 0 ? ((totalMin / income) * 100).toFixed(1) : 0;
  var v = parseFloat(pct);
  return { pct: pct, value: v, totalMin: totalMin, tone: v > 40 ? 'danger' : v > 20 ? 'warn' : 'ok' };
}
