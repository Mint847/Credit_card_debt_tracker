// Loading an account copy into an app: which settings are still defaults, the name to show,
// and the cards and spaces in their current shape. Moved from setCloudData in index.html (Phase 3);
// each UI then draws from the result.
import { ensureSpaceHistory, resolveIssuer } from './domain.js';

// user: the signed-in Firebase user (for a name when the account has none), or null.
// Changes `data` in place (as the phone app always has) and returns
// { data, cards, spaces, strategy, income, initials }.
export function prepareAccount(data, user) {
  data = data || {};
  // Fields this copy didn't have, so they're filled by defaults below (name from the email, default income)
  var dflt = Object.assign({}, data.defaults || {});
  if (!data.firstName) dflt.firstName = true;
  if (!data.income) dflt.income = true;
  if (!data.strategy) dflt.strategy = true;
  if (Object.keys(dflt).length) data.defaults = dflt; else delete data.defaults;

  var fname = data.firstName, lname = data.lastName;
  if (!fname && user) {
    if (user.displayName) {
      var parts = user.displayName.trim().split(" ");
      fname = parts[0];
      if (parts.length > 1) lname = parts.slice(1).join(" ");
    } else if (user.email) {
      fname = user.email.split("@")[0];
    }
  }
  fname = fname || "User";
  lname = lname || "";
  data.firstName = fname;
  data.lastName = lname;

  var cards = Array.isArray(data.cards) ? data.cards : [];
  var spaces = Array.isArray(data.spaces) ? data.spaces : [];
  spaces.forEach(ensureSpaceHistory);
  cards.forEach(function (c) {
    if (c.issuer === undefined) c.issuer = resolveIssuer(c.bank);
    if (c.apr === undefined) c.apr = 28.0;
  });
  return {
    data: data,
    cards: cards,
    spaces: spaces,
    strategy: data.strategy ? data.strategy : "avalanche",
    income: data.income ? data.income : "175000",
    initials: fname.charAt(0).toUpperCase() + (lname ? lname.charAt(0).toUpperCase() : "")
  };
}
