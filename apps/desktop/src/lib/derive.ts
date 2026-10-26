// Numbers the screens show, worked out exactly as the phone app does (same core functions,
// same order). Kept here so every desktop screen reads them from one place.
import {
  ymd, addDays, daysBetween, cardApr, cardTheme, cardName, computeMonthlyBudget, allocateMonthlyPayments, calcPayoff,
  calcMinPayoff, cardMinRule, cycleStatus, isValidDay, minPaymentFor, nextDueDayFrom, billingPeriod, periodSummary,
  spendCategory, recurringNextDue, statementDatesBetween, amountDueNow, activeRecurring, projectPlan
} from '@serendib/core';
import { fmtAmt as fmt } from './format';
import type { Card, Recurring, Strategy } from './types';

export const today = (): string => ymd(new Date());

export function util(c: Card): number {
  return c.limit > 0 ? (c.balance / c.limit) * 100 : 0;
}

// Utilisation bands used across the app: under 30% healthy, 30–75% watch, 75%+ high
export function utilTone(u: number): 'ok' | 'warn' | 'danger' {
  return u >= 75 ? 'danger' : u >= 30 ? 'warn' : 'ok';
}

export { cardTheme, cardName, cardApr, minPaymentFor, amountDueNow };

// Pay-first order: avalanche = highest APR first (then smaller balance), snowball = smallest balance first
export function planOrder(cards: Card[], strategy: Strategy): Card[] {
  const active = cards.filter((c) => c.balance > 0);
  if (strategy === 'snowball') active.sort((a, b) => a.balance - b.balance);
  else active.sort((a, b) => { const d = cardApr(b) - cardApr(a); return d !== 0 ? d : a.balance - b.balance; });
  return active;
}

export interface Plan {
  order: Card[];
  budget: number;
  alloc: Record<string, number>;
  commitment: number;
  totalDebt: number;
  totalLimit: number;
  interestMonth: number;
  debtFree: Date | null; // null = never at this pace
  debtFreeMonths: number;
}

// Cards Overview: budget, allocation, monthly interest and the debt-free month
export function plan(cards: Card[], strategy: Strategy): Plan {
  const order = planOrder(cards, strategy);
  const budget = computeMonthlyBudget(cards);
  const a = allocateMonthlyPayments(order, budget);
  let totalDebt = 0, totalLimit = 0, interestMonth = 0;
  cards.forEach((c) => {
    totalDebt += c.balance;
    totalLimit += c.limit;
    if (c.balance > 0) interestMonth += c.balance * (cardApr(c) / 100 / 12);
  });
  const payoff = calcPayoff(totalDebt, a.total);
  let debtFree: Date | null = null;
  if (order.length && payoff.months !== Infinity) {
    debtFree = new Date();
    debtFree.setMonth(debtFree.getMonth() + payoff.months);
  }
  return { order, budget, alloc: a.alloc, commitment: a.total, totalDebt, totalLimit, interestMonth, debtFree, debtFreeMonths: payoff.months };
}

// The home screen's payoff plan (core projectPlan: the budget pays every minimum, the rest cascades
// in pay-first order), plus a minimums-only line per card for the chart
export interface Projection {
  months: number;            // Infinity = never at this budget
  baselineMonths: number;
  interest: number;
  baselineInterest: number;
  saved: number | null;      // null = minimums never clear ("Massive amounts" on the phone)
  speedUp: number;           // how many times faster than minimums (0 when not meaningful)
  debtFree: Date | null;
  rows: { label: string; plan: number | null; minimum: number }[];
}

export function projection(cards: Card[], strategy: Strategy): Projection {
  const pr = projectPlan(cards, strategy, computeMonthlyBudget(cards));
  const done = pr.months > 0 && pr.months !== Infinity;
  const horizon = Math.min(60, Math.max(12, (done ? pr.months : 36) + 6));
  const minBal: Record<string, number> = {};
  cards.forEach((c) => { minBal[c.id] = c.balance; });
  const rows: Projection['rows'] = [];
  const start = new Date();
  for (let m = 0; m <= horizon; m++) {
    const d = new Date(start.getFullYear(), start.getMonth() + m, 1);
    rows.push({
      label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      plan: m < pr.curve.length ? Math.round(pr.curve[m]) : done ? 0 : null,
      minimum: Math.round(Object.values(minBal).reduce((s, v) => s + v, 0))
    });
    cards.forEach((c) => {
      let mb = minBal[c.id];
      if (mb > 0.005) {
        const r = cardMinRule(c);
        mb -= Math.min(mb, Math.max(mb * r.pct, r.floor));
        minBal[c.id] = mb + mb * (cardApr(c) / 100 / 12);
      }
    });
  }
  let debtFree: Date | null = null;
  if (done) { debtFree = new Date(); debtFree.setMonth(debtFree.getMonth() + pr.months); }
  const neverBase = pr.baselineMonths === Infinity;
  return {
    months: pr.months, baselineMonths: pr.baselineMonths, interest: pr.interest, baselineInterest: pr.baselineInterest,
    saved: neverBase || !done ? null : Math.max(0, pr.baselineInterest - pr.interest),
    speedUp: done && !neverBase ? pr.baselineMonths / pr.months : 0,
    debtFree, rows
  };
}

export interface Alert {
  id: string;
  tone: 'danger' | 'warn' | 'info';
  icon: string;
  title: string;
  body: string;
  card?: Card;
  action?: { label: string; amount: number };
}

// The home screen's alerts: overdue (with CRIB timing), next payment due, high utilisation, budgets
export function alerts(cards: Card[]): Alert[] {
  const t = today(), out: Alert[] = [];
  const upcoming: { card: Card; due: string; left: number; min: number }[] = [];
  cards.forEach((c) => {
    if (!isValidDay(c.dueDay) || !isValidDay(c.statementDay)) return;
    const st = cycleStatus(c, t);
    if (st) {
      if (st.overdue) {
        const o = st.overdue;
        out.push({
          id: 'over-' + c.id, tone: 'danger', icon: 'error', card: c,
          title: 'Payment overdue · ' + o.days + (o.days === 1 ? ' day' : ' days'),
          body: o.days >= 60
            ? cardName(c) + ' is ' + o.days + ' days past due. At 90 days it’s classed as non-performing and reported to CRIB.'
            : 'Pay ' + fmt(o.amount) + ' to catch up' + (o.days >= 30 ? '. At 30+ days a missed payment can be reported to CRIB.' : '. Late fees and interest are building.'),
          action: { label: 'Log payment', amount: o.amount }
        });
      }
      if (st.next) upcoming.push({ card: c, due: st.next.s.due, left: st.next.remaining, min: st.next.s.minDue });
    } else if (c.balance > 0) {
      const min = minPaymentFor(c);
      upcoming.push({ card: c, due: nextDueDayFrom(c.dueDay, t), left: min, min });
    }
  });
  upcoming.sort((a, b) => (a.due < b.due ? -1 : 1));
  const u = upcoming[0];
  if (u) {
    const days = daysBetween(t, u.due);
    out.push({
      id: 'due-' + u.card.id, tone: days <= 3 ? 'warn' : 'info', icon: 'event', card: u.card,
      title: days === 0 ? 'Payment due today' : days === 1 ? 'Payment due tomorrow' : 'Next payment due in ' + days + ' days',
      body: u.left < u.min - 0.5 ? fmt(u.left) + ' left of the ' + fmt(u.min) + ' minimum.' : 'Minimum ' + fmt(u.left) + ' to avoid late fees and interest.',
      action: { label: 'Log payment', amount: u.left }
    });
  }
  cards.forEach((c) => {
    const u2 = util(c);
    if (u2 >= 75) out.push({ id: 'util-' + c.id, tone: 'warn', icon: 'speed', card: c, title: 'High utilisation · ' + Math.round(u2) + '%', body: 'Above 75% of the limit. Lenders and CRIB look for under 30%.' });
    const sum = periodSummary(c, billingPeriod(c, t));
    Object.keys(c.budgets || {}).forEach((k) => {
      const b = (c.budgets || {})[k], spent = sum.byCat[k] || 0;
      if (b > 0 && spent >= b * 0.9) {
        out.push({ id: 'bud-' + c.id + k, tone: spent > b ? 'danger' : 'warn', icon: 'savings', card: c,
          title: spendCategory(k).label + (spent > b ? ' over budget' : ' budget almost used'),
          body: fmt(spent) + ' of ' + fmt(b) + ' this cycle.' });
      }
    });
  });
  return out;
}

export interface Upcoming {
  date: string;
  kind: 'due' | 'statement' | 'recurring';
  card: Card;
  title: string;
  amount?: number;
}

// Statements, due dates and recurring charges in the next `days` days, soonest first
export function upcomingEvents(cards: Card[], days = 35): Upcoming[] {
  const t = today(), end = addDays(t, days), out: Upcoming[] = [];
  cards.forEach((c) => {
    if (isValidDay(c.statementDay)) {
      statementDatesBetween(c.statementDay, t, end).forEach((d: string) => out.push({ date: d, kind: 'statement', card: c, title: 'Statement closes' }));
    }
    if (isValidDay(c.dueDay) && c.balance > 0) {
      const due = nextDueDayFrom(c.dueDay, t);
      if (due <= end) out.push({ date: due, kind: 'due', card: c, title: 'Payment due', amount: amountDueNow(c) });
    }
    activeRecurring(c, t).forEach((r: Recurring) => {
      if (r.paused) return;
      const next = recurringNextDue(r, t);
      if (next && next <= end) out.push({ date: next, kind: 'recurring', card: c, title: r.name, amount: r.amount });
    });
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface CategoryRow { key: string; cat: { label: string; icon: string }; amount: number }

// Spending (purchases minus refunds) by category in each card's current billing period
export function spendingByCategory(cards: Card[]): { rows: CategoryRow[]; total: number } {
  const t = today(), by: Record<string, number> = {};
  let total = 0;
  cards.forEach((c) => {
    const s = periodSummary(c, billingPeriod(c, t));
    Object.keys(s.byCat).forEach((k) => { by[k] = (by[k] || 0) + s.byCat[k]; total += s.byCat[k]; });
  });
  const rows = Object.keys(by).filter((k) => by[k] > 0).map((k) => ({ key: k, cat: spendCategory(k), amount: by[k] }))
    .sort((a, b) => b.amount - a.amount);
  return { rows, total };
}

export function cardPeriod(c: Card) {
  const period = billingPeriod(c, today());
  return { period, summary: periodSummary(c, period) };
}

export function cardCycle(c: Card) {
  return cycleStatus(c, today());
}

// A card's payoff on a monthly amount and on minimums only
export function cardPayoff(c: Card, monthly: number) {
  return {
    plan: calcPayoff(c.balance, monthly, cardApr(c)),
    min: calcMinPayoff(c.balance, cardApr(c), cardMinRule(c))
  };
}
