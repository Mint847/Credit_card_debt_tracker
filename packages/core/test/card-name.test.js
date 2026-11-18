// A card's short name: the bank's first word, except a "Bank of …" bank, which goes by its initials
import { test, expect } from 'vitest';
import { cardName } from '../src/index.js';

test('a card is named by its bank’s first word', () => {
  expect(cardName({ bank: 'Sampath Bank', nick: 'Ultramiles' })).toBe('Sampath Ultramiles');
  expect(cardName({ bank: 'Hatton National Bank (HNB)', nick: 'Platinum' })).toBe('Hatton Platinum');
  expect(cardName({ bank: 'Commercial Bank of Ceylon', nick: 'Visa Gold' })).toBe('Commercial Visa Gold');
});

test('Bank of Ceylon is BOC, not “Bank”', () => {
  expect(cardName({ bank: 'Bank of Ceylon', nick: 'Visa Platinum' })).toBe('BOC Visa Platinum');
  // a bank typed as just "Bank" stays as typed
  expect(cardName({ bank: 'Bank', nick: 'Gold' })).toBe('Bank Gold');
});
