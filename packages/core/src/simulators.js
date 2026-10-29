// The Simulators screen's three sandboxes: the minimum-payment trap, cash advances and 0% surcharge
// plans. Numbers and wording as the phone app shows them; moved from its simulator code (Phase 3).
import { calculateCBSLAmortization, cardMinRule, cardApr, calcCashAdvance, calcSurchargeAPR, computeAdvanceFee, cardIssuer, cashAdvanceApr,
  minPaymentFor, calcMinPayoff, calcPayoff, cardFee, fmtLKR, fmtMonths, fmtPct } from './domain.js';

function lkr(n) { return new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 }).format(n); }
// "2 Yrs 3 Mo"
export function simTime(m) {
  var y = Math.floor(m / 12), rem = m % 12;
  if (y === 0) return rem + ' Mo';
  if (rem === 0) return y + ' Yr' + (y > 1 ? 's' : '');
  return y + ' Yr' + (y > 1 ? 's' : '') + ' ' + rem + ' Mo';
}
// Amounts typed into a simulator: anything but digits and the point is ignored
export function simAmount(v) { return parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, '')) || 0; }

// Minimum payment trap. card: a saved card (its rate and minimum rule) or null (the CBSL ceiling).
// Returns null for no balance, otherwise the figures and the lines the phone shows.
export function simulateMinimum(balance, card) {
  var apr = card ? cardApr(card) : 28.0;
  var aprNote = !card ? 'CBSL Statutory Ceiling' : (card.isZeroPercent ? '0% plan rate' : 'This card’s rate');
  if (!(balance > 0)) return { apr: apr, aprNote: aprNote, empty: true };
  var rule = cardMinRule(card);
  var r = calculateCBSLAmortization(balance, apr, rule.pct, rule.floor);
  if (!r) return { apr: apr, aprNote: aprNote, empty: true };
  var savings = Math.max(0, r.minTotalInterest - r.fixedTotalInterest);
  // Of this month's minimum, the part that goes to interest is the interest the rest then carries
  var first = Math.min(balance, Math.max(balance * rule.pct, rule.floor));
  var firstInterest = Math.min(first, (balance - first) * (apr / 100 / 12));
  var principal = first - firstInterest;
  var principalPct = Math.round((principal / first) * 100);
  return {
    apr: apr, aprNote: aprNote, empty: false,
    minMonths: r.minMonths, minInterest: r.minTotalInterest,
    minTime: r.minMonths >= 600 ? 'Never clears' : simTime(r.minMonths),
    minWarning: r.minMonths > 120 ? 'Payoff takes over a decade' : r.minMonths > 60 ? 'Heavy compounding interest' : 'Costly long-term debt',
    fixedPayment: r.targetFixedPayment, fixedMonths: r.fixedMonths, fixedInterest: r.fixedTotalInterest,
    fixedTitle: 'IF PAYING FIXED LKR ' + lkr(r.targetFixedPayment),
    fixedTime: simTime(r.fixedMonths),
    savings: savings,
    speed: (r.minMonths / r.fixedMonths).toFixed(1) + 'x faster payoff pace',
    firstPayment: first, principal: principal, interest: firstInterest, principalPct: principalPct, interestPct: 100 - principalPct
  };
}

// The fee rule shown under the fee field for a saved card: "Min LKR 500" / "Plus flat LKR 300" / "Flat fee (No %)"
export function advanceFeeRule(card) {
  if (!card) return { percent: null, label: 'Min LKR 500' };
  var t = cardIssuer(card).fee;
  return {
    percent: t.type === 'flat' ? 0 : t.percent,
    label: t.type === 'greater' ? 'Min LKR ' + new Intl.NumberFormat('en-LK').format(t.fixed)
      : t.type === 'plus' ? 'Plus flat LKR ' + new Intl.NumberFormat('en-LK').format(t.fixed) : 'Flat fee (No %)'
  };
}

// Cash advance trap. card: a saved card (its bank's fee and rate), or null with custom { feePct, apr }
export function simulateCashAdvance(amount, daysRaw, card, custom) {
  var d = parseFloat(daysRaw);
  var days = isFinite(d) && d >= 0 ? Math.round(d) : 30;
  var apr, res;
  if (card) {
    apr = cashAdvanceApr(card);
    res = calcCashAdvance(amount, days, card);
  } else {
    var pct = Math.max(0, parseFloat(custom && custom.feePct) || 0);
    apr = parseFloat(custom && custom.apr) || 28;
    res = calcCashAdvance(amount, days, null, { fee: computeAdvanceFee({ type: 'greater', percent: pct, fixed: 500 }, amount), apr: apr });
  }
  var out = { apr: apr, days: days, daily: 'Daily rate ' + (apr / 365).toFixed(3) + '%' };
  if (!(amount > 0)) { out.empty = true; return out; }
  var hidden = res.advanceFee + res.interest;
  out.empty = false;
  out.fee = res.advanceFee;
  out.interest = res.interest;
  out.hidden = hidden;
  out.total = amount + hidden;
  out.sub1 = 'For an LKR ' + lkr(amount) + ' withdrawal';
  out.sub2 = 'Settled in ' + days + ' day' + (days === 1 ? '' : 's');
  out.insight = '+' + ((hidden / amount) * 100).toFixed(1) + '% total cost';
  return out;
}

// 0% surcharge exposer: the interest hidden in a "0%" plan's fee
export function simulateSurcharge(price, feePct, monthsRaw) {
  var months = parseInt(monthsRaw, 10) || 12;
  var rate = parseFloat(feePct) || 0;
  if (!(price > 0) || months <= 0) return { empty: true };
  var s = calcSurchargeAPR(price, rate / 100, months);
  return {
    empty: false, hidden: s.surchargeAmt, total: s.totalPay, apr: s.apr, monthly: s.monthly,
    sub: 'For an LKR ' + lkr(price) + ' item', insight: '+' + rate.toFixed(1) + '% total cost'
  };
}

export var SIM_PRESETS = [100000, 250000, 500000, 1000000];
export var SURCHARGE_PRESETS = [50000, 100000, 250000, 500000];

/* The card page's calculators (the phone's Payoff / Cash advance / 0% surcharge tabs) */
// Where the payoff slider starts: the saved target, else 2.5x the minimum (within the slider's range)
export function payoffStart(card) {
  var minPmt = minPaymentFor(card);
  var r = { min: Math.floor(minPmt), max: Math.ceil(card.balance * 1.05 + 1) };
  var v = card.targetPayment ? card.targetPayment : Math.round(minPmt * 2.5);
  return { value: Math.min(r.max, Math.max(r.min, v)), min: r.min, max: r.max };
}
// The four slider presets, clamped to the slider's range
export function payoffPreset(card, preset) {
  var minPmt = minPaymentFor(card);
  var v = preset === 'rec' ? Math.max(minPmt * 3, card.balance * 0.1) : preset === 'half' ? card.balance * 0.5 : preset === 'full' ? card.balance : minPmt;
  var s = payoffStart(card);
  return Math.min(s.max, Math.max(s.min, Math.round(v)));
}
// Minimums against a fixed monthly payment, with the savings tag and the headline under it
export function cardPayoffSim(card, payment) {
  var balance = card.balance;
  if (!(balance > 0)) return { paidOff: true, minDuration: 'Paid off', minInterest: fmtLKR(0), planDuration: 'Paid off', planInterest: fmtLKR(0), payment: fmtLKR(0) + ' / mo', tag: '', headline: 'This card is fully paid off. Nothing to pay this month.' };
  var minPmt = minPaymentFor(card);
  var minRes = calcMinPayoff(balance, cardApr(card), cardMinRule(card));
  var out = {
    paidOff: false,
    minDuration: !isFinite(minRes.months) ? 'Never clears!' : fmtMonths(minRes.months),
    minInterest: !isFinite(minRes.totalInterest) ? 'Unending' : fmtLKR(Math.round(minRes.totalInterest)),
    payment: fmtLKR(payment) + ' / mo'
  };
  var planRes = calcPayoff(balance, payment, cardApr(card));
  if (!isFinite(planRes.months)) return Object.assign(out, { planDuration: 'Too low to pay down', planInterest: 'N/A', tag: '', headline: 'This payment is below the monthly interest. Please increase the amount.' });
  var planInt = Math.round(planRes.totalInterest);
  var tag = isFinite(minRes.totalInterest) ? (Math.max(0, Math.round(minRes.totalInterest) - planInt) > 0 ? 'Save ' + fmtLKR(Math.max(0, Math.round(minRes.totalInterest) - planInt)) : 'Optimal!') : 'Save enormously!';
  var extra = Math.round(payment - minPmt);
  var minMo = isFinite(minRes.months) ? minRes.months : 9999;
  var saved = ((minMo - planRes.months) / 12).toFixed(1);
  var headline = payment >= balance ? 'Clear your entire balance this month and save ' + fmtLKR(Math.round(isFinite(minRes.totalInterest) ? minRes.totalInterest : 0)) + ' in interest!'
    : extra > 0 ? 'Pay ' + fmtLKR(extra) + ' more per month and be debt-free ~' + saved + ' years earlier!'
    : 'Currently at the bank minimum. Pay extra to cut years of debt.';
  return Object.assign(out, { planDuration: fmtMonths(planRes.months), planInterest: fmtLKR(planInt), tag: tag, headline: headline });
}
// A cash advance on this card repaid after 15, 30 or 60 days, and the effective yearly rate
export function cardAdvanceSim(card, amount) {
  if (!amount || amount < 1) return null;
  var rows = [15, 30, 60].map(function (d) {
    var r = calcCashAdvance(amount, d, card);
    return { days: d, total: r.total, cost: r.interest + r.advanceFee };
  });
  var r60 = calcCashAdvance(amount, 60, card);
  return { principal: amount, fee: cardFee(card, amount), rows: rows, effRate: fmtPct(((r60.total / amount) - 1) * (365 / 60) * 100, 1) + ' p.a.' };
}
export var CARD_SURCHARGE_TENURES = [3, 6, 12];

// "Negotiate Cash Discount": a short message to show or send the shop, with what the "0%" plan really costs
export function cashPriceRequest(price, sim) {
  if (!sim || sim.empty) return '';
  return 'I’d like to pay the cash price of ' + 'LKR ' + lkr(price) + '. The 0% plan adds a ' + 'LKR ' + lkr(sim.hidden) +
    ' fee, which works out to about ' + sim.apr.toFixed(1) + '% a year. Could you offer a cash discount instead?';
}
