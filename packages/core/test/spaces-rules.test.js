// Spaces: status line, history labels, pay-a-card suggestion
import { test, expect } from 'vitest';
import { spaceStatusLine, spaceHistoryLabel, sortedSpaceHistory, spacePayOptions } from '../src/screen-rules.js';
import { addDays, ymd } from '../src/domain.js';

const f = (n) => 'LKR ' + Math.round(n).toLocaleString('en-US');
const today = ymd(new Date());

test('space status: reached, behind, on track, date passed', () => {
  expect(spaceStatusLine({ currentLKR: 500, targetLKR: 500 }, today, f).text).toBe('Goal reached');
  expect(spaceStatusLine({ currentLKR: 100, targetLKR: 500, targetDate: addDays(today, -1) }, today, f)).toEqual({ text: 'Target date passed · LKR 400 to go', tone: 'warn' });
  const behind = spaceStatusLine({ currentLKR: 0, targetLKR: 6000, targetDate: addDays(today, 85), history: [] }, today, f);
  expect(behind.text).toMatch(/ a month for \d+ months · no deposits in the last 3 months$/);
  expect(behind.tone).toBe('warn');
  const onTrack = spaceStatusLine({ currentLKR: 5000, targetLKR: 6000, targetDate: addDays(today, 85), history: [{ type: 'deposit', amount: 5000, date: addDays(today, -10) }] }, today, f);
  expect(onTrack.text.endsWith('· on track')).toBe(true);
});

test('history labels and order', () => {
  expect(spaceHistoryLabel({ type: 'deposit' })).toEqual({ label: 'Deposit', icon: 'south_west', out: false });
  expect(spaceHistoryLabel({ type: 'withdraw', note: 'Car repair' }).label).toBe('Car repair');
  expect(spaceHistoryLabel({ type: 'card-payment' }).label).toBe('Paid a card');
  const s = { history: [{ id: 'a', date: '2026-10-01', createdAt: 1 }, { id: 'b', date: '2026-10-05', createdAt: 0 }, { id: 'c', date: '2026-10-05', createdAt: 9 }] };
  expect(sortedSpaceHistory(s).map((h) => h.id)).toEqual(['c', 'b', 'a']);
});

test('pay a card from a space: suggests the most due, capped at what the space has', () => {
  const cards = [{ id: 'x', balance: 0 }, { id: 'y', balance: 50000, limit: 100000 }, { id: 'z', balance: 1500, limit: 100000 }];
  const o = spacePayOptions({ currentLKR: 1200 }, cards);
  expect(o.owing.map((c) => c.id)).toEqual(['y', 'z']);
  expect(o.pick.id).toBe('y');
  expect(o.suggest(o.pick)).toBe(1200);
  expect(o.hint(o.pick, f)).toMatch(/due now · LKR 50,000 balance$/);
});
