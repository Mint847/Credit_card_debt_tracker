// Statement cycles and payment tracking
// Ported from the Node checks that used to slice this code out of index.html; checks unchanged.
import { test, expect } from 'vitest';
import * as core from '../src/domain.js';

// The checks call the helpers by name, exactly as the app does
Object.assign(globalThis, core);

test('Statement cycles and payment tracking', () => {
  const failures = [];
  const check = (name, cond, extra) => { if (!cond) failures.push(name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); };
  const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);

  // Dates
  check('last statement on/before (same day)', lastStatementOnOrBefore(25, '2026-10-25') === '2026-10-25');
  check('last statement on/before (earlier month)', lastStatementOnOrBefore(25, '2026-10-24') === '2026-09-25');
  check('last statement Jan -> Dec', lastStatementOnOrBefore(25, '2026-01-10') === '2025-12-25');
  check('statement 31 in Feb clamps', lastStatementOnOrBefore(31, '2026-03-05') === '2026-02-28');
  check('due after statement next month', dueDateFor('2026-09-25', 10) === '2026-10-10');
  check('due same month when later', dueDateFor('2026-10-05', 25) === '2026-10-25');
  check('due day equal to statement day -> next month', dueDateFor('2026-10-05', 5) === '2026-11-05');
  check('due 31 clamps to 30 Nov', dueDateFor('2026-11-05', 31) === '2026-11-30');
  check('statement dates between', eq(statementDatesBetween(25, '2026-08-25', '2026-10-25'), ['2026-08-25', '2026-09-25', '2026-10-25']));
  check('statement dates start after from', eq(statementDatesBetween(25, '2026-08-26', '2026-10-24'), ['2026-09-25']));
  check('next statement after', nextStatementAfter(25, '2026-09-25') === '2026-10-25' && nextStatementAfter(31, '2026-01-31') === '2026-02-28');
  check('next due day from today', nextDueDayFrom(10, '2026-10-10') === '2026-10-10' && nextDueDayFrom(10, '2026-10-11') === '2026-11-10');

  // Balance at a date
  const c = { balance: 20000, ledger: [{ date: '2026-10-01', applied: 5000 }, { date: '2026-10-20', applied: -3000 }] };
  check('balance at end of 1 Oct', balanceAt(c, '2026-10-01') === 23000);
  check('balance before everything', balanceAt(c, '2026-09-30') === 18000);

  // Record statements and status
  const card = { balance: 40000, statementDay: 25, dueDay: 10, minPct: 0.04, minFloor: 1000, cycleTrackedFrom: '2026-08-25', ledger: [] };
  recordStatements(card, '2026-10-24');
  check('two statements recorded (Aug, Sep)', eq(card.statements.map(s => s.date + '>' + s.due), ['2026-08-25>2026-09-10', '2026-09-25>2026-10-10']));
  check('minimum = 4% of balance', card.statements[1].minDue === 1600);
  check('re-recording adds nothing', recordStatements(card, '2026-10-24') === false);
  let st = cycleStatus(card, '2026-10-24');
  check('both unpaid and past due -> overdue since 10 Sep', st.overdue && st.overdue.since === '2026-09-10' && st.overdue.days === 44 && st.overdue.amount === 3200, st.overdue);
  check('nothing upcoming', st.next === null);

  // A payment after the Sep statement clears the oldest first
  card.ledger.push({ date: '2026-10-01', type: 'payment', amount: 2000, applied: -2000 });
  st = cycleStatus(card, '2026-10-24');
  check('payment clears Aug, part of Sep', st.overdue.since === '2026-10-10' && st.overdue.amount === 1200, st.overdue);
  card.ledger.push({ date: '2026-10-02', type: 'payment', amount: 1200, applied: -1200 });
  st = cycleStatus(card, '2026-10-24');
  check('fully caught up', st.overdue === null);

  // Payment before a statement doesn't count towards it
  const c2 = { balance: 10000, statementDay: 25, dueDay: 10, minPct: 0.04, minFloor: 1000, cycleTrackedFrom: '2026-09-25', ledger: [{ date: '2026-09-20', type: 'payment', amount: 5000, applied: -5000 }] };
  recordStatements(c2, '2026-10-05');
  st = cycleStatus(c2, '2026-10-05');
  check('payment before statement ignored; upcoming due 10 Oct', st.next && st.next.s.due === '2026-10-10' && st.next.remaining === 1000 && !st.overdue, st.next);
  check('due today is upcoming, not overdue', cycleStatus(c2, '2026-10-10').overdue === null && cycleStatus(c2, '2026-10-10').next !== null);
  check('day after due -> 1 day overdue', cycleStatus(c2, '2026-10-11').overdue.days === 1);
  c2.balance = 0;
  check('cleared balance pays everything', cycleStatus(c2, '2026-10-11').overdue === null && cycleStatus(c2, '2026-10-11').next === null);

  // Statement balance rebuilt from the ledger when the app wasn't opened that day
  const c3 = { balance: 30000, statementDay: 25, dueDay: 10, minPct: 0.04, minFloor: 1000, cycleTrackedFrom: '2026-09-25',
    ledger: [{ date: '2026-09-28', type: 'purchase', amount: 10000, applied: 10000 }] };
  recordStatements(c3, '2026-10-01');
  check('statement balance excludes later purchases', c3.statements[0].balance === 20000 && c3.statements[0].minDue === 1000, c3.statements[0]);

  // Keeps 12
  const c4 = { balance: 50000, statementDay: 1, dueDay: 20, cycleTrackedFrom: '2025-01-01', ledger: [] };
  recordStatements(c4, '2026-10-24');
  check('keeps the latest 12 statements', c4.statements.length === 12 && c4.statements[11].date === '2026-10-01', c4.statements.length);
  expect(failures).toEqual([]);
});
