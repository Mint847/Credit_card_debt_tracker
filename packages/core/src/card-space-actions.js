// Card and space actions: add/edit/clear/delete cards, billing cycles, monthly targets; create, edit,
// delete, fund, withdraw from and pay a card from a space.
// Moved from the App closure in index.html (Phase 1). Data changes only; each UI shows its own messages.
import { uid, ymd, resolveIssuer, isValidDay, recordStatements, ensureSpaceHistory, applyLedgerEffect, SL_CARD_ISSUERS, fmtLKR } from './domain.js';
import { logSystemEntry, afterBalanceChange } from './ledger-actions.js';
import { initCycleTracking } from './recurring-actions.js';

function fmtAmt(n) { return fmtLKR(n, Math.round(n * 100) % 100 ? 2 : 0); }

/* ── Cards ── */

// input: { bank, nick, color, limit, balance } with limit/balance already parsed (parseFloat)
export function addCard(cards, input) {
  var bank = String(input.bank || '').trim(), nick = String(input.nick || '').trim();
  var limit = input.limit, balance = input.balance;
  if (!bank || !nick) return { error: 'Please enter bank name and card nickname.' };
  if (!limit || limit <= 0) return { error: 'Please enter a valid credit limit.' };
  if (isNaN(balance) || balance < 0) return { error: 'Please enter a valid outstanding balance.' };
  if (balance > limit) return { error: 'Balance cannot exceed the credit limit.' };
  var issuerKey = resolveIssuer(bank);
  var issuer = SL_CARD_ISSUERS[issuerKey] || SL_CARD_ISSUERS['default'];
  var card = {
    id: uid(),
    bank: bank,
    nick: nick,
    limit: limit,
    balance: balance,
    color: input.color,
    issuer: issuerKey,
    apr: issuer.apr,
    isZeroPercent: false,
    minPct: issuer.minPct,
    minFloor: issuer.minFloor
  };
  cards.push(card);
  return { card: card };
}

// input: the Edit Card form as typed: { bank, nick, limit, balance, apr, isZeroPercent, color, last4 } (strings)
// Validates everything before touching the card, so a save is all-or-nothing.
export function updateCardDetails(card, input) {
  var bank = String(input.bank || '').trim();
  var nick = String(input.nick || '').trim();
  var limit = parseFloat(String(input.limit || '').replace(/,/g, ''));
  var balanceStr = String(input.balance == null ? '' : input.balance).replace(/,/g, '').trim();
  var balance = parseFloat(balanceStr);
  var aprStr = String(input.apr == null ? '' : input.apr).replace(/%/g, '').trim();
  var isZeroPercent = !!input.isZeroPercent;
  var apr = aprStr === '' ? 28.0 : parseFloat(aprStr);
  var color = input.color;
  var last4 = String(input.last4 || '').trim();
  if (!bank || !nick) return { error: 'Please enter the bank name and card tier.' };
  if (isNaN(limit) || limit <= 0) return { error: 'Please enter a valid credit limit.' };
  if (balanceStr === '' || isNaN(balance) || balance < 0) return { error: 'Please enter a valid outstanding balance.' };
  if (!isZeroPercent && (isNaN(apr) || apr <= 0 || apr > 60)) return { error: 'APR must be between 0.1% and 60%.' };
  if (last4 && !/^\d{4}$/.test(last4)) return { error: 'Last 4 digits must be exactly 4 numbers.' };

  if (bank !== card.bank) {
    card.bank = bank;
    card.issuer = resolveIssuer(bank);
    var iss = SL_CARD_ISSUERS[card.issuer] || SL_CARD_ISSUERS['default'];
    card.minPct = iss.minPct;
    card.minFloor = iss.minFloor;
  }
  card.nick = nick;
  card.limit = limit;
  var newBalance = Math.round(balance * 100) / 100;
  if (newBalance !== card.balance) logSystemEntry(card, 'adjustment', newBalance - (Number(card.balance) || 0), 'Balance corrected');
  card.balance = newBalance;
  if (last4) card.last4 = last4; else delete card.last4;
  if (color) card.color = color;
  card.isZeroPercent = isZeroPercent;
  // Keep the real APR stored even on a 0% plan; cardApr() returns 0 while the flag is on
  if (!isZeroPercent) card.apr = apr;
  else if (!(parseFloat(card.apr) > 0)) card.apr = 28.0;
  // Saved monthly target must stay within the new balance
  if (card.balance === 0) delete card.targetPayment;
  else if (card.targetPayment && card.targetPayment > card.balance) card.targetPayment = card.balance;
  return { card: card, overLimit: card.balance > card.limit };
}

// Clear Balance (Mark as Settled): logs the payment so the history still adds up
export function settleCard(card) {
  if (card.balance > 0) logSystemEntry(card, 'payment', card.balance, 'Balance cleared');
  card.balance = 0;
  delete card.targetPayment;
}

export function removeCard(cards, id) {
  return cards.filter(function (c) { return String(c.id) !== String(id); });
}

// Returns { error } or { changed } (statements are rebuilt only when the days changed)
export function setBillingCycle(card, statementDay, dueDay) {
  if (!isValidDay(statementDay) || !isValidDay(dueDay)) return { error: 'Please pick both a statement date and a due date.' };
  var changed = card.statementDay !== statementDay || card.dueDay !== dueDay;
  if (changed) {
    card.statementDay = statementDay;
    card.dueDay = dueDay;
    card.statements = [];
    initCycleTracking(card, ymd(new Date()));
    recordStatements(card, ymd(new Date()));
  }
  return { changed: changed };
}

export function setTargetPayment(card, amount) {
  card.targetPayment = amount;
}

/* ── Spaces ── */

// input: { name, target (string), date, color }. Returns { invalid: { name, target, date } } or { space }
function checkSpace(input) {
  var name = String(input.name || '').trim(), target = parseFloat(input.target), date = input.date;
  var invalid = { name: !name, target: isNaN(target) || target <= 0, date: !date };
  return { name: name, target: target, date: date, color: input.color || 'emerald', invalid: invalid, ok: !invalid.name && !invalid.target && !invalid.date };
}
export var SPACE_FORM_ERROR = 'Please fill all required fields correctly.';

export function createSpace(spaces, input) {
  var v = checkSpace(input);
  if (!v.ok) return { invalid: v.invalid };
  var space = { id: Date.now().toString(), name: v.name, targetLKR: v.target, currentLKR: 0, targetDate: v.date, color: v.color };
  spaces.push(space);
  return { space: space };
}
export function updateSpace(spaces, id, input) {
  var v = checkSpace(input);
  if (!v.ok) return { invalid: v.invalid };
  var i = spaces.findIndex(function (s) { return s.id === id; });
  if (i === -1) return { gone: true };
  spaces[i].name = v.name;
  spaces[i].targetLKR = v.target;
  spaces[i].targetDate = v.date;
  spaces[i].color = v.color;
  return { space: spaces[i] };
}
export function removeSpace(spaces, id) {
  return spaces.filter(function (s) { return s.id !== id; });
}

// amount: parseFloat of the field. '' when it can be added, otherwise the message to show
export function fundsAmountError(amount) {
  return isNaN(amount) || amount <= 0 ? 'Enter a valid amount to add.' : '';
}
// Returns { error } | { item }
export function addFunds(space, amount) {
  var err = fundsAmountError(amount);
  if (err) return { error: err };
  space.currentLKR += amount;
  ensureSpaceHistory(space);
  var item = { id: uid(), date: ymd(new Date()), type: 'deposit', amount: amount, note: '', createdAt: Date.now() };
  space.history.push(item);
  return { item: item };
}

// Use money from a space. Returns { error } | { item }
export function withdrawFromSpace(space, amount, note) {
  var have = Number(space.currentLKR) || 0;
  if (!(amount > 0)) return { error: 'Enter an amount.' };
  if (amount > have + 0.001) return { error: 'This space only has ' + fmtAmt(have) + '.' };
  ensureSpaceHistory(space);
  var item = { id: uid(), date: ymd(new Date()), type: 'withdraw', amount: amount, note: String(note || '').trim().slice(0, 60), createdAt: Date.now() };
  space.history.push(item);
  space.currentLKR = Math.round((have - amount) * 100) / 100;
  return { item: item };
}
export function undoWithdraw(space, item) {
  var i = space.history.findIndex(function (h) { return h.id === item.id; });
  if (i === -1) return false;
  space.history.splice(i, 1);
  space.currentLKR = Math.round(((Number(space.currentLKR) || 0) + item.amount) * 100) / 100;
  return true;
}

// Pay a card from a space: a payment on the card, linked to a withdrawal from the space.
// Returns { error } | { entry, item }
export function payCardFromSpace(space, card, amount) {
  var cur = Number(space.currentLKR) || 0;
  if (!(amount > 0)) return { error: 'Enter an amount.' };
  if (amount > cur + 0.001) return { error: 'This space only has ' + fmtAmt(cur) + '.' };
  if (amount > card.balance + 0.001) return { error: 'That’s more than the card’s ' + fmtAmt(card.balance) + ' balance.' };
  var today = ymd(new Date());
  if (!Array.isArray(card.ledger)) card.ledger = [];
  var item = { id: uid(), date: today, type: 'card-payment', amount: amount, cardId: card.id, note: '', createdAt: Date.now() };
  var entry = { id: uid(), date: today, type: 'payment', amount: amount, merchant: '', note: 'From ' + space.name, source: 'space', spaceId: space.id, createdAt: Date.now() };
  item.ledgerId = entry.id;
  applyLedgerEffect(card, entry, 1);
  card.ledger.push(entry);
  afterBalanceChange(card);
  ensureSpaceHistory(space);
  space.history.push(item);
  space.currentLKR = Math.round((cur - amount) * 100) / 100;
  return { entry: entry, item: item };
}
