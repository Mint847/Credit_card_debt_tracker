// Guided setup rules
import { test, expect } from 'vitest';
import { checklistState, migrateOnboarding, welcomeIncome, replayOnboarding, onboardingState, TIP_SCREENS } from '../src/onboarding.js';

test('checklist: each step ticks itself off', () => {
  const o = { version: 2, incomeSet: true, tipsSeen: {} };
  let s = checklistState(o, [], []);
  expect(s.done).toBe(1);
  expect(s.progress).toBe('1 of 6 done');
  s = checklistState({ ...o, strategyChosen: true, simulatorTried: true }, [{ statementDay: 5, dueDay: 25 }], [{}]);
  expect(s.allDone).toBe(true);
  expect(s.title).toBe("You're all set");
  expect(checklistState({ checklistDismissed: true, version: 2 }, [], []).hidden).toBe(true);
});

test('older accounts skip the welcome; new ones get it', () => {
  const old = onboardingState({ cards: [] }); migrateOnboarding(old, {}, [{}], false);
  expect(old).toMatchObject({ welcomeDone: true, incomeSet: true, strategyChosen: true, version: 2 });
  expect(TIP_SCREENS.every((k) => old.tipsSeen[k])).toBe(true);
  const fresh = onboardingState({}); migrateOnboarding(fresh, {}, [], false);
  expect(fresh.welcomeDone).toBeUndefined();
  expect(migrateOnboarding(fresh, {}, [], false)).toBe(false);
});

test('welcome income and replay', () => {
  expect(welcomeIncome('')).toEqual({ income: '' });
  expect(welcomeIncome('240000.6')).toEqual({ income: '240001' });
  expect(welcomeIncome('-5').error).toBe('Enter your monthly income in LKR, or leave it blank to add it later.');
  const o = { version: 2, tipsSeen: { 'screen-home': true }, checklistDismissed: true };
  replayOnboarding(o, [], [], false, {});
  expect(o.tipsSeen['screen-home']).toBe(false);
  expect(o.checklistDismissed).toBe(false);
});

import { mergeAccount } from '../src/domain.js';
test('a replay wins when copies merge; otherwise flags only turn on', () => {
  const cloud = { onboarding: { version: 2, welcomeDone: true, tipsSeen: { 'screen-home': true }, checklistDismissed: true }, cards: [], spaces: [] };
  const replayed = { onboarding: { version: 2, welcomeDone: false, tipsSeen: { 'screen-home': false }, checklistDismissed: false, resetAt: 5 }, cards: [], spaces: [] };
  const m = mergeAccount(replayed, cloud).onboarding;
  expect(m).toMatchObject({ welcomeDone: false, checklistDismissed: false, resetAt: 5 });
  expect(m.tipsSeen['screen-home']).toBe(false);
  // An older copy can't undo the replay
  expect(mergeAccount(cloud, replayed).onboarding.tipsSeen['screen-home']).toBe(false);
  // Without a replay: true wins
  const a = { onboarding: { tipsSeen: { x: true }, simulatorTried: true }, cards: [], spaces: [] };
  const b = { onboarding: { tipsSeen: { x: false, y: true } }, cards: [], spaces: [] };
  expect(mergeAccount(a, b).onboarding.tipsSeen).toEqual({ x: true, y: true });
  expect(mergeAccount(b, a).onboarding.simulatorTried).toBe(true);
});
