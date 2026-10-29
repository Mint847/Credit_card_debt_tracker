// Guided setup: the "Get started" checklist, moving older accounts past the welcome, the welcome's
// income check and what Replay resets. The onboarding flags live in the account (data.onboarding)
// so progress follows the user across devices. Moved from the Onboarding module in index.html (Phase 3).
import { isValidDay } from './domain.js';

export var CHECKLIST = [
  { key: 'income', label: 'Set your monthly income', hint: 'Sizes your monthly repayment budget', icon: 'payments' },
  { key: 'strategy', label: 'Choose a payoff strategy', hint: 'Avalanche or Snowball', icon: 'route' },
  { key: 'card', label: 'Link your first card', hint: 'Limit and current balance', icon: 'credit_card' },
  { key: 'billing', label: 'Set a billing cycle', hint: 'Turns on due-date alerts', icon: 'event' },
  { key: 'sim', label: 'Try a simulator', hint: 'See what minimum payments really cost', icon: 'calculate' },
  { key: 'buffer', label: 'Create an emergency buffer', hint: 'A savings space for surprises', icon: 'savings' }
];
// Screens with first-visit tips (the same keys on every device, so a tip seen once stays seen)
export var TIP_SCREENS = ['screen-home', 'screen-list', 'screen-detail', 'screen-simulators', 'screen-spaces', 'view-offers', 'screen-profile'];

// The account's onboarding object, created if missing
export function onboardingState(data) {
  if (!data) return null;
  if (!data.onboarding || typeof data.onboarding !== 'object') data.onboarding = {};
  var o = data.onboarding;
  if (!o.tipsSeen || typeof o.tipsSeen !== 'object') o.tipsSeen = {};
  return o;
}

export function checklistDone(key, o, cards, spaces) {
  switch (key) {
    case 'income': return !!o.incomeSet;
    case 'strategy': return !!o.strategyChosen;
    case 'card': return cards.length > 0;
    case 'billing': return cards.some(function (c) { return isValidDay(c.statementDay) && isValidDay(c.dueDay); });
    case 'sim': return !!o.simulatorTried;
    case 'buffer': return spaces.length > 0;
    default: return false;
  }
}
// The checklist as shown: each step and whether it's done, the count, the title and progress line
export function checklistState(o, cards, spaces) {
  var items = CHECKLIST.map(function (it) { return Object.assign({ done: checklistDone(it.key, o, cards, spaces) }, it); });
  var done = items.filter(function (i) { return i.done; }).length, all = done === items.length;
  return {
    items: items, done: done, allDone: all,
    title: all ? "You're all set" : 'Get started',
    progress: all ? 'All ' + items.length + ' steps done' : done + ' of ' + items.length + ' done',
    pct: Math.round((done / items.length) * 100),
    hidden: !o || !o.version || !!o.checklistDismissed
  };
}

// Users who used the app before onboarding existed skip the welcome and tips. Returns true if o changed.
export function migrateOnboarding(o, data, cards, legacyTourDone) {
  if (o.version) return false;
  if ((data && data.hasCompletedTour === true) || legacyTourDone || cards.length > 0) {
    o.welcomeDone = true;
    o.incomeSet = true;
    o.strategyChosen = true;
    TIP_SCREENS.forEach(function (s) { o.tipsSeen[s] = true; });
  }
  o.version = 2;
  return true;
}

// The welcome's last slide: income may be left blank; otherwise it must be a positive number.
// Returns { error } or { income } ('' when left blank).
export function welcomeIncome(raw) {
  raw = String(raw == null ? '' : raw).trim();
  if (raw === '') return { income: '' };
  var inc = parseFloat(raw);
  if (isNaN(inc) || inc <= 0) return { error: 'Enter your monthly income in LKR, or leave it blank to add it later.' };
  return { income: String(Math.round(inc)) };
}

// Replay the guide: every tip again, and the checklist back unless it's all done
export function replayOnboarding(o, cards, spaces, legacyTourDone, data) {
  migrateOnboarding(o, data, cards, legacyTourDone);
  // Explicit false (not {}): Firestore merge writes would keep old true values otherwise
  TIP_SCREENS.forEach(function (s) { o.tipsSeen[s] = false; });
  var allDone = CHECKLIST.every(function (it) { return checklistDone(it.key, o, cards, spaces); });
  if (!allDone) { o.checklistDismissed = false; o.checklistCompleted = false; }
  // The welcome shows again, and this replay wins over older copies when the account merges
  o.welcomeDone = false;
  o.resetAt = Date.now();
}
export var CHECKLIST_HIDDEN_TOAST = 'Checklist hidden. You can replay the guide from Profile.';
