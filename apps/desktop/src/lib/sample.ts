// Sample account for the design prototype (Phase 2). Dates are relative to today so the screens
// always look current. Balances, statements and payments are built with the core's own rules.
import { ymd, addDays, applyLedgerEffect, runDueRecurring, statementDatesBetween, dueDateFor, resolveIssuer } from '@serendib/core';
import type { Card, Entry, Profile, Space } from './types';

let seed = 11;
function rand(): number { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
function pick<T>(list: T[]): T { return list[Math.floor(rand() * list.length)]; }

const MERCHANTS: Record<string, [string, number, number][]> = {
  groceries: [['Keells', 2500, 14000], ['Cargills Food City', 1800, 11000], ['Arpico Supercentre', 3000, 16000], ['Glomark', 2000, 9000]],
  dining: [['Pizza Hut', 2800, 7500], ['Barista', 900, 2600], ['Ministry of Crab', 9000, 24000], ['KFC', 1500, 4200], ['Burger King', 1600, 3900]],
  fuel: [['Lanka IOC', 4000, 12000], ['Ceypetco', 3500, 11000], ['PickMe', 450, 2200], ['Uber', 600, 2800]],
  shopping: [['Daraz', 1500, 18000], ['Odel', 4500, 22000], ['Abans', 9000, 65000], ['Cotton Collection', 3000, 12000]],
  bills: [['Dialog', 2200, 5600], ['Electricity (CEB)', 4500, 13000], ['Water (NWSDB)', 900, 2400]],
  health: [['Healthguard Pharmacy', 1200, 6800], ['Asiri Hospitals', 4000, 18000]],
  travel: [['SriLankan Airlines', 28000, 95000], ['Jetwing Hotels', 18000, 52000]],
  entertainment: [['Scope Cinemas', 1800, 4800], ['PVR Cinemas', 1600, 4200]]
};

interface Spec {
  id: string; bank: string; nick: string; color: string; limit: number; opening: number; apr: number;
  statementDay: number; dueDay: number; last4: string; spendPerWeek: number; cats: string[]; skipLastPayment?: boolean;
  budgets?: Record<string, number>; targetPayment?: number;
}

const SPECS: Spec[] = [
  { id: 'c_com', bank: 'Commercial Bank of Ceylon', nick: 'Visa Gold', color: 'teal', limit: 300000, opening: 118000, apr: 28,
    statementDay: 25, dueDay: 15, last4: '4821', spendPerWeek: 2, cats: ['groceries', 'dining', 'fuel', 'bills'],
    budgets: { groceries: 40000, dining: 15000, fuel: 20000 } },
  { id: 'c_hnb', bank: 'Hatton National Bank', nick: 'Platinum', color: 'rose', limit: 550000, opening: 188000, apr: 26,
    statementDay: 5, dueDay: 25, last4: '7310', spendPerWeek: 1.5, cats: ['shopping', 'travel', 'dining', 'entertainment'],
    budgets: { shopping: 30000, travel: 60000 } },
  { id: 'c_sam', bank: 'Sampath Bank', nick: 'Ultramiles', color: 'amber', limit: 200000, opening: 96000, apr: 28,
    statementDay: 18, dueDay: 8, last4: '0592', spendPerWeek: 0.8, cats: ['fuel', 'groceries', 'health'], skipLastPayment: true },
  { id: 'c_ntb', bank: 'Nations Trust Bank', nick: 'American Express Gold', color: 'indigo', limit: 400000, opening: 31000, apr: 24,
    statementDay: 10, dueDay: 1, last4: '1005', spendPerWeek: 1, cats: ['dining', 'shopping', 'bills'], targetPayment: 15000 }
];

function buildCard(s: Spec, today: string): Card {
  const from = addDays(today, -80);
  const card: Card = {
    id: s.id, bank: s.bank, nick: s.nick, color: s.color, limit: s.limit, balance: s.opening, apr: s.apr,
    issuer: resolveIssuer(s.bank), statementDay: s.statementDay, dueDay: s.dueDay, last4: s.last4,
    cycleTrackedFrom: addDays(today, -75), ledger: [], recurring: [], budgets: s.budgets, targetPayment: s.targetPayment
  };
  const entries: Entry[] = [];
  let n = 0;
  // Purchases spread over the last 80 days
  for (let d = 0; d < 80; d++) {
    if (rand() > s.spendPerWeek / 7) continue;
    const cat = pick(s.cats);
    const [merchant, lo, hi] = pick(MERCHANTS[cat]);
    entries.push({ id: s.id + '_p' + n++, date: addDays(from, d), type: 'purchase', amount: Math.round((lo + rand() * (hi - lo)) / 10) * 10,
      category: cat, merchant, source: rand() > 0.6 ? 'sms' : 'manual', createdAt: n });
  }
  // A payment ten days after each statement (the last one skipped on the overdue sample card)
  const stmts: string[] = statementDatesBetween(s.statementDay, from, today);
  const pastDue = stmts.filter((st) => dueDateFor(st, s.dueDay) < today);
  const missed = s.skipLastPayment ? pastDue[pastDue.length - 1] : null;
  stmts.forEach((st, i) => {
    const due = dueDateFor(st, s.dueDay);
    const paid = addDays(st, Math.min(10, Math.max(1, Math.round((Date.parse(due) - Date.parse(st)) / 864e5) - 2)));
    // Later payments would count towards the missed statement, so none after it either
    if (paid > today || (missed && st >= missed)) return;
    entries.push({ id: s.id + '_y' + i, date: paid, type: 'payment', amount: Math.round((15000 + rand() * 30000) / 1000) * 1000,
      source: 'manual', createdAt: 1000 + i });
  });
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  entries.forEach((e) => { applyLedgerEffect(card, e, 1); card.ledger!.push(e); });
  return card;
}

export function sampleAccount() {
  seed = 11;
  const today = ymd(new Date());
  const cards = SPECS.map((s) => buildCard(s, today));
  cards[0].recurring = [
    { id: 'r_dialog', name: 'Dialog', amount: 3490, day: 12, startDate: addDays(today, -75), category: 'bills', lastPosted: null, skipped: [] },
    { id: 'r_netflix', name: 'Netflix', amount: 2200, day: 3, startDate: addDays(today, -75), category: 'subscriptions', lastPosted: null, skipped: [] }
  ];
  cards[1].recurring = [
    { id: 'r_spotify', name: 'Spotify', amount: 999, day: 21, startDate: addDays(today, -75), category: 'subscriptions', lastPosted: null, skipped: [] },
    { id: 'r_gym', name: 'Gym membership', amount: 8500, day: 1, startDate: addDays(today, -75), category: 'health', paused: true, lastPosted: null, skipped: [] }
  ];
  // Post the recurring charges and record each statement, as the app does when it opens
  runDueRecurring(cards, today);
  const spaces: Space[] = [
    { id: 's_buffer', name: 'Emergency buffer', targetLKR: 300000, currentLKR: 112000, targetDate: addDays(today, 240), color: 'emerald',
      history: [
        { id: 'h1', date: addDays(today, -70), type: 'deposit', amount: 60000 },
        { id: 'h2', date: addDays(today, -40), type: 'deposit', amount: 35000 },
        { id: 'h3', date: addDays(today, -12), type: 'deposit', amount: 17000 }
      ] },
    { id: 's_hnb', name: 'Clear HNB by March', targetLKR: 150000, currentLKR: 46000, targetDate: addDays(today, 150), color: 'rose',
      history: [{ id: 'h4', date: addDays(today, -30), type: 'deposit', amount: 46000 }] }
  ];
  const profile: Profile = { firstName: 'Nimal', lastName: 'Perera', email: 'nimal.perera@example.com', income: '240000' };
  return { cards, spaces, profile };
}
