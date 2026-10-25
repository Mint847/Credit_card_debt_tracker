// Backup contents, restore preview and restore plan
import { test, expect } from 'vitest';
import { buildBackupDoc, countsText, restoreDiff, planRestore, safetyCopyToBackup } from '../src/backup-actions.js';
import { readBackup } from '../src/domain.js';

const cards = [{ id: 'a', bank: 'Sampath Bank', nick: 'Visa', limit: 1000, balance: 10, ledger: [{ id: 'e1' }, { id: 'e2' }] }];
const spaces = [{ id: 's1', name: 'Buffer', targetLKR: 100, currentLKR: 0, targetDate: '2027-01-01' }];

test('a backup round-trips through the checks', () => {
  const doc = buildBackupDoc({ firstName: 'Ann', income: '200000' }, 'snowball', cards, spaces);
  expect(doc.profile).toEqual({ firstName: 'Ann', lastName: '', income: '200000', strategy: 'snowball' });
  expect(doc.cards).not.toBe(cards);
  const res = readBackup(JSON.parse(JSON.stringify(doc)));
  expect(res.ok).toBe(true);
  expect(res.data.cards[0].id).toBe('a');
  expect(countsText(cards, spaces)).toBe('1 card · 1 space · 2 entries');
});

test('restore: what a backup adds, merge keeps everything, replace swaps and applies the profile', () => {
  const data = { cards: [{ id: 'a' }, { id: 'b' }], spaces: [{ id: 's1' }, { id: 's2' }], profile: { firstName: 'Ann', lastName: '', income: '300000', strategy: '' } };
  const diff = restoreDiff(cards, spaces, data);
  expect(diff.newCards.map((c) => c.id)).toEqual(['b']);
  expect(diff.newSpaces.map((s) => s.id)).toEqual(['s2']);
  const merge = planRestore({ income: '200000' }, 'avalanche', cards, spaces, data, 'merge', diff.newCards, diff.newSpaces);
  expect(merge.next.cards.map((c) => c.id)).toEqual(['a', 'b']);
  expect(merge.next.income).toBe('200000');
  expect(merge.before.strategy).toBe('avalanche');
  const repl = planRestore({ income: '200000', strategy: 'avalanche' }, 'avalanche', cards, spaces, data, 'replace', [], []);
  expect(repl.next.cards.map((c) => c.id)).toEqual(['a', 'b']);
  expect(repl.next.income).toBe('300000');
  expect(repl.next.strategy).toBe('avalanche');
});

test('a safety copy is shaped like a backup', () => {
  const b = safetyCopyToBackup({ at: Date.UTC(2026, 9, 1), data: { firstName: 'Ann', cards, spaces } });
  expect(b.app).toBe('serendib');
  expect(readBackup(b).ok).toBe(true);
});
