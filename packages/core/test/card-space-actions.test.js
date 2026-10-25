// Card and space actions
import { test, expect } from 'vitest';
import { addCard, updateCardDetails, settleCard, removeCard, setBillingCycle, createSpace, updateSpace, removeSpace, addFunds, fundsAmountError, withdrawFromSpace, undoWithdraw, payCardFromSpace } from '../src/card-space-actions.js';

test('add card: validation, issuer rules from the bank', () => {
  const cards = [];
  expect(addCard(cards, { bank: ' ', nick: 'Gold', limit: 1000, balance: 0 }).error).toBe('Please enter bank name and card nickname.');
  expect(addCard(cards, { bank: 'Sampath', nick: 'Gold', limit: NaN, balance: 0 }).error).toBe('Please enter a valid credit limit.');
  expect(addCard(cards, { bank: 'Sampath', nick: 'Gold', limit: 1000, balance: NaN }).error).toBe('Please enter a valid outstanding balance.');
  expect(addCard(cards, { bank: 'Sampath', nick: 'Gold', limit: 1000, balance: 2000 }).error).toBe('Balance cannot exceed the credit limit.');
  expect(cards.length).toBe(0);
  const r = addCard(cards, { bank: ' American Express ', nick: 'Gold', limit: 1000000, balance: 200000, color: 'amber' });
  expect(r.card.bank).toBe('American Express');
  expect(r.card.issuer).toBe('ntb');
  expect(r.card.apr).toBe(26);
  expect(r.card.minFloor).toBe(250);
  expect(cards.length).toBe(1);
});

test('edit card: all-or-nothing, balance change logged, 0% keeps the real APR, target clamped', () => {
  const card = { id: 'a', bank: 'Sampath Bank', nick: 'Visa', limit: 100000, balance: 50000, apr: 28, issuer: 'sampath', targetPayment: 40000, ledger: [] };
  const base = { bank: 'Sampath Bank', nick: 'Visa', limit: '100,000', balance: '30,000', apr: '28', isZeroPercent: false, color: 'rose', last4: '' };
  expect(updateCardDetails(card, Object.assign({}, base, { apr: '75' })).error).toBe('APR must be between 0.1% and 60%.');
  expect(updateCardDetails(card, Object.assign({}, base, { last4: '12a4' })).error).toBe('Last 4 digits must be exactly 4 numbers.');
  expect(updateCardDetails(card, Object.assign({}, base, { balance: '' })).error).toBe('Please enter a valid outstanding balance.');
  expect(card.balance).toBe(50000);
  const r = updateCardDetails(card, Object.assign({}, base, { bank: 'Seylan Bank', last4: '1234' }));
  expect(r.card.balance).toBe(30000);
  expect(card.issuer).toBe('seylan');
  expect(card.ledger[0]).toMatchObject({ type: 'adjustment', amount: -20000, note: 'Balance corrected' });
  expect(card.targetPayment).toBe(30000);
  expect(card.last4).toBe('1234');
  expect(card.color).toBe('rose');
  updateCardDetails(card, Object.assign({}, base, { isZeroPercent: true, apr: '' }));
  expect(card.isZeroPercent).toBe(true);
  expect(card.apr).toBe(28);
  expect(updateCardDetails(card, Object.assign({}, base, { balance: '150000' })).overLimit).toBe(true);
});

test('clear balance, delete, billing cycle', () => {
  const card = { id: 'a', balance: 5000, targetPayment: 1000, ledger: [] };
  settleCard(card);
  expect(card.balance).toBe(0);
  expect(card.targetPayment).toBeUndefined();
  expect(card.ledger[0]).toMatchObject({ type: 'payment', amount: 5000, note: 'Balance cleared' });
  expect(removeCard([{ id: 1 }, { id: 'b' }], '1').map((c) => c.id)).toEqual(['b']);
  expect(setBillingCycle(card, 0, 10).error).toBe('Please pick both a statement date and a due date.');
  expect(setBillingCycle(card, 5, 25).changed).toBe(true);
  expect(typeof card.cycleTrackedFrom).toBe('string');
  expect(setBillingCycle(card, 5, 25).changed).toBe(false);
});

test('spaces: create, edit, delete with per-field validation', () => {
  const spaces = [];
  expect(createSpace(spaces, { name: '', target: 'x', date: '' }).invalid).toEqual({ name: true, target: true, date: true });
  const s = createSpace(spaces, { name: ' Buffer ', target: '100000', date: '2027-03-01', color: '' }).space;
  expect(s).toMatchObject({ name: 'Buffer', targetLKR: 100000, currentLKR: 0, color: 'emerald' });
  expect(updateSpace(spaces, s.id, { name: 'Emergency', target: '120000', date: '2027-04-01', color: 'rose' }).space.name).toBe('Emergency');
  expect(updateSpace(spaces, 'nope', { name: 'x', target: '1', date: '2027-01-01' }).gone).toBe(true);
  expect(removeSpace(spaces, s.id)).toEqual([]);
});

test('spaces: add funds, withdraw and undo, pay a card', () => {
  const space = { id: 's1', name: 'Buffer', currentLKR: 0, targetLKR: 100000 };
  expect(fundsAmountError(NaN)).toBe('Enter a valid amount to add.');
  addFunds(space, 10000);
  expect(space.currentLKR).toBe(10000);
  expect(space.history[0].type).toBe('deposit');
  expect(withdrawFromSpace(space, 0).error).toBe('Enter an amount.');
  expect(withdrawFromSpace(space, 20000).error).toBe('This space only has LKR 10,000.');
  const w = withdrawFromSpace(space, 2500, '  Car repair ');
  expect(space.currentLKR).toBe(7500);
  expect(w.item.note).toBe('Car repair');
  expect(undoWithdraw(space, w.item)).toBe(true);
  expect(space.currentLKR).toBe(10000);
  const card = { id: 'c1', balance: 3000, ledger: [] };
  expect(payCardFromSpace(space, card, 5000).error).toBe('That’s more than the card’s LKR 3,000 balance.');
  const p = payCardFromSpace(space, card, 3000);
  expect(card.balance).toBe(0);
  expect(space.currentLKR).toBe(7000);
  expect(p.entry).toMatchObject({ type: 'payment', source: 'space', spaceId: 's1', note: 'From Buffer' });
  expect(p.item.ledgerId).toBe(p.entry.id);
});
