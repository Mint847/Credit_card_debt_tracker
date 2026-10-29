// The home screen's payoff plan: how long the monthly budget takes to clear every card, and the
// interest it saves compared with paying only minimums. Moved from renderHomeDashboard in index.html.
import { calculateCBSLAmortization, cardMinRule, cardApr, minPaymentFor, computeMonthlyBudget, fmtLKR } from './domain.js';

// Returns { baselineMonths, baselineInterest, months, interest, curve }.
//   Baseline: each card on its own minimum rule (Infinity when one never clears).
//   Plan: each month a month's interest is added, then the budget pays every minimum and the rest
//   cascades in pay-first order (snowball: smallest balance; otherwise highest APR, then smallest).
//   months is Infinity when the budget can't cover the minimums or it takes 100 years.
//   curve[m] is the total still owed at the start of month m (curve[0] is today's total).
export function projectPlan(cards, strategy, budget) {
  var baselineInterest = 0, baselineMonths = 0;
  cards.filter(function (c) { return c.balance > 0; }).forEach(function (c) {
    var rule = cardMinRule(c);
    var res = calculateCBSLAmortization(c.balance, cardApr(c), rule.pct, rule.floor);
    if (res.minMonths === Infinity || res.minMonths >= 1200) {
      baselineMonths = Infinity;
    } else {
      baselineMonths = Math.max(baselineMonths, res.minMonths);
      baselineInterest += res.minTotalInterest;
    }
  });

  var portfolio = cards.filter(function (c) { return c.balance > 0; }).map(function (c) { return Object.assign({}, c); });
  var interest = 0, months = 0, safetyLimit = 1200;
  var total = function () { return portfolio.reduce(function (s, c) { return s + Math.max(0, c.balance); }, 0); };
  var curve = [total()];
  while (portfolio.some(function (c) { return c.balance > 0.01; }) && months < safetyLimit) {
    var monthMinReq = 0;
    portfolio.forEach(function (c) {
      if (c.balance > 0.01) {
        var i = c.balance * (cardApr(c) / 100 / 12);
        c.balance += i;
        interest += i;
        monthMinReq += minPaymentFor(c);
      }
    });
    if (budget < monthMinReq) { months = Infinity; break; }
    var surplus = budget;
    portfolio.forEach(function (c) {
      if (c.balance > 0.01) {
        var minPmt = minPaymentFor(c);
        c.balance -= minPmt;
        surplus -= minPmt;
      }
    });
    if (strategy === 'snowball') {
      portfolio.sort(function (a, b) { return a.balance - b.balance; });
    } else {
      portfolio.sort(function (a, b) {
        var d = cardApr(b) - cardApr(a);
        return d !== 0 ? d : a.balance - b.balance;
      });
    }
    for (var k = 0; k < portfolio.length; k++) {
      if (surplus <= 0.01) break;
      var cc = portfolio[k];
      if (cc.balance > 0.01) {
        var payment = Math.min(cc.balance, surplus);
        cc.balance -= payment;
        surplus -= payment;
      }
    }
    months++;
    curve.push(total());
  }
  if (months >= safetyLimit) months = Infinity;
  return { baselineMonths: baselineMonths, baselineInterest: baselineInterest, months: months, interest: interest, curve: curve };
}

// The Avalanche card's chip: how much interest Avalanche saves compared with Snowball on your
// cards (the same month-by-month plan as the home screen). Rounded to the nearest LKR 100.
export function strategySavings(cards) {
  var active = cards.filter(function (c) { return c.balance > 0; });
  if (!active.length) return { amount: 0, label: 'Saves the most interest' };
  var budget = computeMonthlyBudget(cards);
  var av = projectPlan(cards, 'avalanche', budget), sn = projectPlan(cards, 'snowball', budget);
  if (av.months === Infinity || sn.months === Infinity) return { amount: 0, label: 'Saves the most interest' };
  var saved = Math.round(Math.max(0, sn.interest - av.interest) / 100) * 100;
  return saved > 0 ? { amount: saved, label: 'Save ~' + fmtLKR(saved) } : { amount: 0, label: 'Same as Snowball' };
}
