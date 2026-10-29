// The home screen's alerts, in the phone app's order and words: the next payment due (or "On track"),
// the "Did you pay?" check-in, overdue and CRIB warnings, over budget, recurring charges due tomorrow,
// and the month's interest. Plus the catch-up plan for an overdue card. Moved from renderDueAlerts /
// renderSpendAlerts / openRemedialSheet in index.html (Phase 3).
import { isValidDay, cycleStatus, minPaymentFor, nextDueDayFrom, daysBetween, addDays, periodSummary, billingPeriod, spendCategory, recurringNextDue, cardApr, cardName } from './domain.js';
import { activeRecurring } from './ledger-actions.js';
import { amountDueNow } from './recurring-actions.js';
import { shortDate } from './screen-rules.js';

// The data behind the alerts
export function homeAlertData(cards, todayStr) {
  var upcoming = [], overdue = [], tracked = 0, overs = [], dues = [], bleed = 0;
  var tomorrow = addDays(todayStr, 1);
  cards.forEach(function (c) {
    if (isValidDay(c.dueDay) && isValidDay(c.statementDay)) {
      var st = cycleStatus(c, todayStr);
      if (st) {
        tracked++;
        if (st.overdue) overdue.push({ card: c, st: st });
        if (st.next) upcoming.push({ card: c, due: st.next.s.due, left: st.next.remaining, min: st.next.s.minDue });
      } else if (c.balance > 0) {
        // Not tracked yet (e.g. offline at sign-in): next due day and today's minimum
        var min = minPaymentFor(c);
        upcoming.push({ card: c, due: nextDueDayFrom(c.dueDay, todayStr), left: min, min: min });
      }
    }
    var b = c.budgets || {};
    if (Object.keys(b).length) {
      var s = periodSummary(c, billingPeriod(c, todayStr));
      Object.keys(b).forEach(function (k) { if (b[k] > 0 && (s.byCat[k] || 0) > b[k]) overs.push({ card: c, cat: k, spent: s.byCat[k], budget: b[k] }); });
    }
    activeRecurring(c, todayStr).forEach(function (r) { if (recurringNextDue(r, todayStr) === tomorrow) dues.push({ card: c, item: r }); });
    if (c.balance > 0) bleed += c.balance * (cardApr(c) / 100 / 12);
  });
  upcoming.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
  overdue.sort(function (a, b) { return b.st.overdue.days - a.st.overdue.days; });
  overs.sort(function (a, b) { return (b.spent - b.budget) - (a.spent - a.budget); });
  return { upcoming: upcoming, overdue: overdue, tracked: tracked, overs: overs, dues: dues, bleed: bleed };
}

// The alerts as shown. fmt formats an amount (the phone's fmtAmt). Each item:
// { kind, tone ('due'|'ok'|'ask'|'late'|'critical'|'budget'|'recurring'|'interest'), eyebrow, title, text, date?, cards, action? }
export function homeAlerts(cards, todayStr, fmt) {
  var d = homeAlertData(cards, todayStr), items = [];
  var u = d.upcoming[0];
  if (u) {
    var days = daysBetween(todayStr, u.due);
    var partial = u.left < u.min - 0.5;
    items.push({
      kind: 'payment', tone: 'due', eyebrow: 'Payment due', date: shortDate(u.due), cards: [u.card],
      title: days === 0 ? 'Payment Due Today' : days === 1 ? 'Payment Due Tomorrow' : 'Next Payment Due in ' + days + ' Days',
      text: partial ? fmt(u.left) + ' left of the ' + fmt(u.min) + ' minimum.' : 'Minimum Required: ' + fmt(u.left) + ' to avoid late fees and interest penalties.',
      strong: fmt(u.left),
      action: { kind: 'log-payment', label: 'Log payment', cardId: u.card.id, amount: u.left }
    });
  } else if (d.tracked && !d.overdue.length) {
    items.push({ kind: 'ontrack', tone: 'ok', eyebrow: 'On track', title: 'All minimums paid this cycle', text: 'Nice work. We’ll remind you when the next statements arrive.', cards: [] });
  }
  var worst = d.overdue[0];
  if (worst) {
    var o = worst.st.overdue, c = worst.card;
    var more = d.overdue.length > 1 ? ' · ' + (d.overdue.length - 1) + ' more card' + (d.overdue.length > 2 ? 's' : '') + ' overdue' : '';
    if (!o.answered) {
      items.push({ kind: 'ask', tone: 'ask', eyebrow: 'Check-in', title: 'Payment check', cards: [c],
        text: 'Did you pay ' + cardName(c) + '’s ' + fmt(o.amount) + ' minimum due ' + shortDate(o.since) + '?',
        action: { kind: 'ask', cardId: c.id, amount: o.amount } });
    } else if (o.days < 60) {
      items.push({ kind: 'overdue', tone: 'late', eyebrow: 'Overdue', title: 'Payment overdue · ' + o.days + (o.days === 1 ? ' day' : ' days'), cards: [c],
        text: 'Pay ' + fmt(o.amount) + ' to catch up' + (o.days >= 30 ? '. At 30+ days a missed payment can be reported to CRIB.' : '. Late fees and interest are building.') + more,
        action: { kind: 'catch-up', label: 'Catch-up plan', cardId: c.id } });
    } else {
      var left = Math.max(0, 90 - o.days);
      items.push({ kind: 'crib', tone: 'critical', eyebrow: 'Critical', title: 'CRIB Default Warning', cards: [c],
        text: cardName(c) + ' is ' + o.days + ' days past due. ' + (left > 0 ? left + (left === 1 ? ' day' : ' days') + ' before it’s classed as non-performing (90 days) and reported to CRIB.' : 'It has passed 90 days and is likely reported to CRIB as non-performing.') + more,
        action: { kind: 'catch-up', label: 'Catch-up plan', cardId: c.id }, help: 'crib' });
    }
  }
  if (d.overs.length) {
    var ob = d.overs[0];
    items.push({ kind: 'budget', tone: 'budget', eyebrow: 'Over budget', title: 'Over budget: ' + spendCategory(ob.cat).label, cards: [ob.card],
      text: fmt(ob.spent) + ' spent of a ' + fmt(ob.budget) + ' budget this period' + (d.overs.length > 1 ? ' · ' + (d.overs.length - 1) + ' more over budget' : ''),
      action: { kind: 'open-card', label: 'View card', cardId: ob.card.id } });
  }
  if (d.dues.length) {
    var dueCards = [];
    d.dues.forEach(function (x) { if (dueCards.indexOf(x.card) === -1) dueCards.push(x.card); });
    items.push({ kind: 'recurring', tone: 'recurring', eyebrow: 'Tomorrow', cards: dueCards,
      title: d.dues.length === 1 ? 'Recurring charge due tomorrow' : d.dues.length + ' recurring charges due tomorrow',
      text: d.dues.slice(0, 2).map(function (x) { return x.item.name + ' ' + fmt(Number(x.item.amount) || 0); }).join(' · ') + (d.dues.length > 2 ? ' · +' + (d.dues.length - 2) + ' more' : ''),
      action: { kind: 'open-card', label: 'View card', cardId: d.dues[0].card.id } });
  }
  if (d.bleed > 0) {
    items.push({ kind: 'interest', tone: 'interest', eyebrow: 'Interest', title: 'Monthly Compounding Bleed', chip: 'CBSL 28.0% APR Ceiling', amount: d.bleed, cards: [] });
  }
  return items;
}

// A step-by-step catch-up plan for an overdue card (the phone's remedial sheet)
export function catchUpPlan(card, cards, todayStr, fmt) {
  var st = cycleStatus(card, todayStr), o = st && st.overdue;
  var owed = o ? o.amount : amountDueNow(card);
  var untracked = cards.filter(function (c) { return c.balance > 0 && !(isValidDay(c.statementDay) && isValidDay(c.dueDay)); }).length;
  var steps = [
    { n: 1, title: 'Pay ' + fmt(owed) + ' to catch up', body: 'This brings the missed minimums up to date. Log it here once you’ve paid in your banking app.', action: { kind: 'log-payment', label: 'Log payment', amount: owed } },
    { n: 2, title: 'Pause new spending on this card', body: 'Every new purchase adds to what’s owed. Set a small budget so the app warns you before you spend.', action: { kind: 'budgets', label: 'Set budgets' } },
    { n: 3, title: 'Talk to ' + card.bank + ' before 90 days', body: 'Call the number on the back of your card and ask about a payment plan or restructuring. Banks are usually more flexible before an account reaches 90 days past due.' }
  ];
  if (untracked) steps.push({ n: 4, title: 'Track due dates on your other cards', body: untracked + ' other card' + (untracked === 1 ? '' : 's') + ' ha' + (untracked === 1 ? 's' : 've') + ' no billing cycle, so the app can’t warn you before they’re due.' });
  return {
    owed: owed,
    banner: o ? { title: fmt(o.amount) + ' overdue since ' + shortDate(o.since), body: o.days + (o.days === 1 ? ' day' : ' days') + ' past due. Accounts 90 days past due are classed as non-performing and reported to CRIB.' } : null,
    steps: steps
  };
}

// "Not yet": the check-in won't ask again about these statements
export function answerNotYet(card, todayStr) {
  var st = cycleStatus(card, todayStr), o = st && st.overdue;
  if (!o) return false;
  o.statements.forEach(function (s) { s.answered = 'no'; });
  return true;
}
